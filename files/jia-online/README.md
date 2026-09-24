# JIA TRAINER CENTER — คอร์ส CPR & AED ออนไลน์ (cpr.morroo.com)

แอป React (Vite) หน้าเดียว สำหรับคอร์ส CPR & AED ออนไลน์ + เกม CPR HERO + หน้าแอดมิน
Backend ทั้งหมดอยู่บน Supabase โปรเจกต์ `tpoiyykbgsgnrdwzgzvn` (DB `jia-unified` ใช้ร่วมกับแอปอื่นของ JIA)

## โครงสร้าง repo

```
files/jia-online/            ← Root Directory ของโปรเจกต์ Vercel (ตั้งใน dashboard ไม่ใช่ใน repo)
  src/App.jsx                ← เกือบทั้งแอป: landing, คอร์ส, ควิซ, ชำระเงิน, ใบประกาศ, จอง On-site, admin
  src/game/                  ← เกม CPR HERO (GamePage, storyEngine, scenarios, EcgStrip, sound, characters)
  public/                    ← รูปตัวละคร/ฉากเกม, โลโก้, หน้า static (exam-prep-*.html), รูปแอด
  supabase/functions/        ← Edge Functions (deploy ด้วย supabase CLI, verify_jwt=false ทุกตัว)
  supabase/migrations/       ← SQL ที่ apply บน production แล้ว (เก็บไว้เป็นประวัติ + ใช้ rerun ได้)
  docs/                      ← SECURITY_FOLLOWUP (งาน security ค้าง), AUTH_GATE_SETUP, CPR_HERO_GAME_PLAN
.github/workflows/mirror-to-gitlab.yml  ← ทุก push/delete บน GitHub → mirror ไป gitlab.com/jiacpr/jia-online
```

## รันในเครื่อง

```bash
cd files/jia-online
npm ci
npm run dev      # http://localhost:5173
npm run build    # ต้องผ่านก่อนเปิด PR (ไม่มี lint/test script)
```

## Deploy

- **หน้าเว็บ**: push เข้า `main` → Vercel deploy production อัตโนมัติ (`cpr.morroo.com`)
  ทุก branch/PR ได้ preview URL เอง
- **Edge Functions**: `supabase functions deploy <name> --project-ref tpoiyykbgsgnrdwzgzvn`
  (ทุกตัว `--no-verify-jwt`) — deploy ก่อน merge โค้ดหน้าเว็บที่เรียกใช้
- **Migrations**: apply ด้วย Supabase MCP / SQL editor แล้ว commit ไฟล์ไว้ใน `supabase/migrations/`

### Edge Functions ใน repo นี้

| ฟังก์ชัน | หน้าที่ |
|---|---|
| `admin-api` | หน้า admin ทั้งหมด — ตรวจ `x-admin-key` ฝั่ง server แล้วใช้ service_role |
| `grade-quiz` | ตรวจข้อสอบท้ายบท + Final Exam ฝั่ง server (เฉลยไม่อยู่ในบันเดิล) |
| `stripe-checkout` / `stripe-webhook` | ซื้อบทเรียนผ่าน Stripe, บันทึกสิทธิ์ลง `online_purchases` |
| `account-progress` / `auth-line-link` / `signup-push` | บัญชีผู้เรียน, ผูก LINE, แจ้งเตือนสมัคร |
| `line-webhook` | รับ webhook จาก LINE OA @jiacpr เก็บ user_id ลูกค้า |
| `notify-new-student` | แจ้งทีมทาง LINE เมื่อมีนักเรียนใหม่ (trigger บน `online_students`) |
| `notify-new-booking` | แจ้งทีมทาง LINE เมื่อมีการจอง On-site (trigger บน `bookings`) + งาน cron เตือนสลิปค้าง/รอบเรียนใกล้ถึง |
| `customer-followup-drip` | ส่งข้อความติดตามลูกค้าตามลำดับ (pg_cron รายวัน) |

ฟังก์ชันอื่นในโปรเจกต์ Supabase เดียวกันแต่เป็นของแอปอื่น (source อยู่ repo อื่น):
`bcpr-api` (class.morroo.com), `jiaroo-line-webhook` / `online-course-broadcast` (jiaroo CRM),
`learning-api` / `learning-source-bridge` (learning hub)

### Secrets / env ที่ต้องมี (ชื่อเท่านั้น ค่าอยู่ใน Supabase / Vercel)

- Supabase function secrets: `ADMIN_API_KEY`, `NOTIFY_WEBHOOK_SECRET`, `CRON_KEY`, `LINE_CHANNEL_ACCESS_TOKEN`,
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- ตาราง `jiaroo_secrets` (tenant `jiaroo`): `NOTIFY_WEBHOOK_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` — trigger/cron ใช้แนบ header
- Vercel env (ไม่บังคับ): `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` — ถ้าไม่ตั้งจะใช้ public key ที่ฝังในโค้ด

## ลิงก์พิเศษของแอป

| URL | ผล |
|---|---|
| `/game` หรือ `/?game=1` | เข้าหน้าเลือกเคสเกม CPR HERO ทันที (QR บูธ/อีเวนต์) |
| `/game?random=play` หรือ `/?game=random` | สุ่มเคสเล่นทันทีเต็มจอ (ลิงก์ยิงแอด รูปแบบเดียวกับ firstaid.morroo.com) |
| `/admin` | หน้าแอดมิน (ต้องมี admin key) |
| `/cert-example.html` | ตัวอย่างใบประกาศสำหรับทีมขาย (ถ้า merge PR #80) |
| `?camp=<code>` | แคมเปญ LINE OA (คูปอง/ปลดล็อกคอร์ส ตามที่กำหนดใน `CAMPAIGNS`) |

## คูปองพาร์ทเนอร์ (QR) — สำหรับเจ้าหน้าที่ JIA
ธุรกิจพันธมิตร (เช่น ออฟฟิศที่ส่งของประจำที่อ้อมน้อย) อยากแจกคูปองให้ลูกค้าของเขา
สแกน QR แล้วเรียนคอร์ส CPR & AED ออนไลน์ได้ฟรีทั้งคอร์สทันที (เห็นมูลค่า ฿149)
คูปองไม่ซ้ำ ใบละ 1 สิทธิ์ หลังใช้/เรียนจบจะเห็น LINE + เบอร์โทรของพาร์ทเนอร์ให้ลูกค้าติดต่อกลับ
(ลูกค้ายังได้คูปองส่วนลด ฿100 คอร์ส On-site ของ JIA ตามปกติด้วย)

วิธีออกคูปอง:
1. เข้าหน้าแอดมิน (`/admin`) → แท็บ **"คูปองพาร์ทเนอร์ (QR)"**
2. กรอกชื่อพาร์ทเนอร์, รหัสย่อ (ใช้ขึ้นต้นโค้ด เช่น `OMNOI`), LINE, เบอร์โทร, มูลค่าที่โชว์, จำนวนใบ และวันหมดอายุ แล้วกด "สร้างชุดคูปอง"
3. กด "พิมพ์ชุดนี้" (หรือ "พิมพ์ใบที่ยังไม่ใช้" ในรายการด้านล่าง) เพื่อเปิดหน้าพิมพ์ A4 (8 ใบ/หน้า) แล้วกดพิมพ์ หรือกด "บันทึกรูป" ต่อใบเพื่อส่งให้พาร์ทเนอร์ทาง LINE
4. ดูยอดใช้ + รายชื่อคนใช้คูปองได้ในหน้าเดียวกัน และแก้ไข LINE/เบอร์ทีหลังได้โดยไม่ต้องพิมพ์คูปองใหม่ (คูปองที่พิมพ์ไปแล้วยังใช้ได้ปกติ แค่หน้าเว็บจะโชว์ข้อมูลติดต่อใหม่)

## เอกสารที่ควรอ่านก่อนแก้

- `docs/SECURITY_FOLLOWUP.md` — สถานะงาน security และสิ่งที่ยังค้าง (PII, paywall, RLS)
- `docs/AUTH_GATE_SETUP.md` — ด่านสมัคร/ล็อกอิน (LINE LIFF, Google, Email OTP)
- `docs/CPR_HERO_GAME_PLAN.md` — โครงเกม CPR HERO

## ติดต่อ

JIA TRAINER CENTER · โทร 088-558-8078 · LINE @jiacpr · jiacpr@gmail.com · jiacpr.com
