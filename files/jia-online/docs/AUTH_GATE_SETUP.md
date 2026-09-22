# ตั้งค่าด่านบังคับสมัคร (LINE เป็นล็อกอินหลัก — บัญชีเดียวกับ class.jiacpr.com)

ฟีเจอร์ (flow ปัจจุบัน — `GATE_VARIANT_DEFAULT = "soft"`):
เปิดเว็บ → บังคับสมัคร (**เข้าสู่ระบบด้วย LINE** เป็นปุ่มหลัก / "ไม่มี LINE? กรอกชื่อ-เบอร์" เป็นทางสำรอง) →
หน้าแอด @jiacpr (โชว์คูปอง ฿100 บนจอ) → **ปลดคอร์สทั้งหมด**

**27 กันยายน 2026 — เปลี่ยนจาก "LINE/Google/Email สามทาง" เป็น "LINE หลัก + ชื่อ-เบอร์สำรอง":**
Google login และ Email OTP ไม่เคยถูกเดินสายเรียกจริง (ธงเปิดไว้เฉยๆ ในโค้ดเก่า ไม่มี `signInWithOAuth`/
`signInWithOtp` ที่ไหนเลย) จึงตัดออกแทนที่จะซ่อมของที่ไม่เคยทำงาน ตอนนี้ล็อกอิน LINE ให้ **Supabase session
จริง** (ผ่าน `supabase-js`) แทนการผูกแค่ `line_user_id` เข้ากับแถว `customers` แบบเดิม และล็อกอิน LINE
เดียวกันนี้ใช้ได้ทั้งที่ cpr.morroo.com (เว็บนี้) และ class.jiacpr.com (Hub) — **คนเดียวกัน บัญชีเดียวกัน**
รายละเอียดทางเทคนิคของการเชื่อมสองเว็บอยู่ที่ repo `jia-learning-hub`,
`docs/line-integration.md` (หัวข้อ "Cross-site identity")

### ⚠️ ข้อจำกัด cross-provider (@jiacpr) — ยังเป็นแบบนี้อยู่
Login channel "JIA CPR Online" (Channel ID `2010458255`) อยู่ใต้ provider **JiaTrainingcenter** แต่ OA
**@jiacpr** (Messaging API Channel ID `1657175600`) อยู่ใต้ provider ของอีกบัญชี (เข้าถึงไม่ได้) → LINE ออก
`userId` แยกตาม provider ทำให้:
- ❌ LIFF เด้งแอด @jiacpr อัตโนมัติไม่ได้ · ❌ push คูปองเข้าแชต @jiacpr ตรงจาก login ไม่ได้ · ✅ ใช้ login
  ยืนยันตัวตน/เก็บลูกค้าได้ปกติ (คนละเรื่องกับ `sub`/LINE user id ซึ่งเหมือนกันทุก channel ใน provider เดียวกัน
  — Hub ใช้ค่านี้เป็นคีย์เชื่อมบัญชี ไม่เกี่ยวกับข้อจำกัดนี้)

**วิธีรับมือ (ทำไว้แล้วในโค้ด):** หลังสมัคร → ไปหน้า `LineAddPrompt` เสมอ → **โชว์คูปอง ฿100 บนจอ** (บันทึก
`promo_codes` ใช้หน้าร้านได้) + ให้แอด @jiacpr ผ่าน QR/deep link เอง

**การออกคูปอง ฿100 (คอร์สจบแล้ว):** เส้นทาง LINE ล็อกอิน (ส่วนใหญ่) ออกให้ที่ edge function
`signup-push` (service role, ไม่ผ่าน client) เส้นทางสำรองชื่อ+เบอร์ (`Register`, `submitQuiz` จบคอร์สทีหลัง,
`LineAddPrompt`/`Certificate` ที่ต้อง fallback) เรียก `issueOnlineCoupon()` (`src/App.jsx`) ซึ่งไปที่
`public.issue_online_coupon` บน Hub (`class.jiacpr.com`) — RPC นี้ตรวจ `customer_id`+เบอร์ที่ตรงกับ
`public.customers` และต้องมี `online_students.completed_at` ของ customer นั้นแล้วจึงออกโค้ดให้ (เรียกซ้ำ
ปลอดภัย คืนโค้ดเดิม) Hub **ปิด anon INSERT บน `promo_codes` แล้ว** — ห้าม insert ตรงจาก client อีก
(ใช้ไม่ได้แล้วจริง ๆ) ยกเว้น **คูปองแคมเปญเกม** (`genCampaignCoupon`, ให้ตามชนะเกม ไม่ใช่ตามเรียนจบคอร์ส)
ที่ยังค้าง insert ตรงแบบเดิมอยู่ (ดู `⚠️ TODO` ในโค้ด) — ต้องตัดสินใจว่าจะออก RPC ใหม่เฉพาะกรณีนี้ หรือปรับ
`issue_online_coupon` ให้ครอบคลุม

### A/B ตำแหน่งด่าน (`gate_placement` ใน PostHog)
`before-course` = ควิซเกริ่นนำหน้าแรก · `after-lesson-1` = ให้ดูบท 1 ฟรีก่อนแล้วค่อยกั้น · `soft` (ค่าเริ่มต้น
ปัจจุบัน) = แอด LINE แบบข้ามได้ ลด drop

## ล็อกอิน LINE ทำงานอย่างไร (`signInWithLine` ใน `src/App.jsx`)

1. `loadLiff()` → ถ้ายังไม่ได้ล็อกอิน LIFF: เก็บ `{phone,name,gate_variant}` ไว้ที่ `localStorage
   jia_line_login_pending` แล้ว `liff.login({redirectUri: location.href})` (นำทางออกจากหน้า แล้วกลับมาที่
   URL เดิมพร้อม LIFF login แล้ว — mount effect จะอ่าน `line_login_pending` แล้วเรียกฟังก์ชันนี้ต่อให้เอง)
2. `liff.getIDToken()` → POST ไปที่ **`line-auth` ของ Hub** (`https://tpoiyykbgsgnrdwzgzvn.supabase.co
   /functions/v1/line-auth` — edge function อยู่ใน repo `jia-learning-hub`, ไม่ใช่ของเว็บนี้) ด้วย
   header **เฉพาะ** `apikey`+`Content-Type` (`LINE_AUTH_HEADERS`) — **ห้ามใส่ `Authorization`** เพราะ
   `line-auth` ตีความ header นั้นว่าเป็นโหมด "เชื่อมบัญชีที่ล็อกอินอยู่แล้ว" (link mode) ถ้าส่ง publishable
   key ไปจะถูกตีความเป็น token ผู้ใช้ปลอมแล้วโดน 401
3. `line-auth` ยืนยัน id_token กับ LINE จริง (`aud` ต้องอยู่ใน allowlist `LINE_LOGIN_CHANNEL_IDS` ของ Hub
   ซึ่งรวม channel ของเว็บนี้ `2010458255` ไว้แล้ว), หา/สร้างบัญชี Hub ที่ตรงกับ LINE user นี้ (รวมถึงใช้บัญชี
   เดิมจากเว็บ First Aid ถ้ามี) แล้วคืน `token_hash` แบบใช้ครั้งเดียว — **ไม่ใช่ session ตรงๆ**
4. เบราว์เซอร์เอง `supabase.auth.verifyOtp({token_hash, type:'magiclink'})` แลก `token_hash` เป็น
   Supabase session จริง (เก็บโดย `supabase-js` เอง, refresh อัตโนมัติ)
5. ถ้ามีลูกค้าเดิมที่กรอกชื่อ-เบอร์ไว้ก่อน (ยังไม่มี `auth_user_id`) → เรียก RPC `jia_online_account`
   action `attachLocal` ผูกแถวเดิมเข้ากับบัญชีที่เพิ่ง sign in ก่อนเรียกขั้นถัดไป (ไม่งั้นจะถูกมองว่าเป็นคนละคน)
6. เรียก edge function `auth-line-link` (ของเดิม) เพื่อ upsert `customers`/`course_progress`, ออกคูปอง
   ฿100 และส่งข้อความต้อนรับเข้าแชต — เหมือนเดิมทุกอย่าง เพียงแต่ตอนนี้มี Supabase session จริงคู่กันด้วย
7. เรียก RPC `jia_online_account` action `me` เพื่อยืนยัน/backfill ให้ตรงกับสิ่งที่ Hub เห็น แล้วบันทึก
   `localStorage jia_user` พร้อม `auth_user_id`

`syncProgressRemote` เมื่อมี `auth_user_id` จะขอ access token สดจาก `supabase.auth.getSession()` ทุกครั้ง
(แทน token ที่เก็บไว้ตอนล็อกอินซึ่งหมดอายุใน ~1 ชม.) — sync พังเงียบๆ หลังจากนั้นแบบเดิมจะไม่เกิดอีก

### ผลข้างเคียงด้านความปลอดภัยที่รับไว้
เว็บนี้เก็บ Supabase session ไว้ใน `localStorage` ผ่าน `supabase-js` (Hub เก็บเป็น HttpOnly cookie ที่ฝั่ง
เซิร์ฟเวอร์แทน) — ถ้าเว็บนี้มีช่องโหว่ XSS ผู้โจมตีจะได้ session ของผู้ใช้คนนั้นไปด้วย ยอมรับผลนี้เพราะเว็บนี้
ไม่มีเซิร์ฟเวอร์ของตัวเองให้ proxy การล็อกอินผ่าน จึงห้ามเพิ่ม RPC ที่ `authenticated` อ่านข้อมูลคนอื่นได้

## สิ่งที่ต้องตั้งค่า (เจ้าของบัญชี — ทำแล้ว ไม่ต้องทำซ้ำ นอกจากเปลี่ยน channel)

### LINE Login + LIFF
1. LINE Developers Console → provider **JiaTrainingcenter** → **LINE Login channel** "JIA CPR Online"
   (Channel ID `2010458255`) — สร้างไว้แล้ว
2. **LIFF app**: Endpoint URL = `https://cpr.morroo.com`, Scope `openid` + `profile`, Size = Full —
   สร้างไว้แล้ว, LIFF ID `2010458255-JAxIKawy`
3. **สำคัญ:** ฝั่ง Hub (`jia-learning-hub`) ต้องมี channel id นี้อยู่ใน env `LINE_LOGIN_CHANNEL_IDS` ของ
   edge function `line-auth` (ค่าเริ่มต้นมี `2010458255` รวมอยู่แล้วเป็น fallback ในโค้ด แต่ตั้ง env ไว้ชัดเจน
   ดีกว่าพึ่ง fallback) และต้องมี `https://cpr.morroo.com` อยู่ใน `LINE_AUTH_ALLOWED_ORIGINS` (ค่าเริ่มต้น
   เป็นโดเมนนี้อยู่แล้ว) ไม่งั้นเบราว์เซอร์ของเว็บนี้เรียก `line-auth` ตรงๆ จะโดน CORS บล็อก

### Secrets (สรุป)
| ค่า | ใส่ที่ | Public? |
| --- | --- | --- |
| LIFF ID | `App.jsx` `LIFF_ID` | ✅ PUBLIC |
| LINE Login channel ID (`2010458255`) | `jiaroo_secrets.LINE_LOGIN_CHANNEL_ID` (เว็บนี้) + `LINE_LOGIN_CHANNEL_IDS` ของ Hub | 🔒 SECRET (แต่ไม่ใช่ความลับจริง — เป็น client_id สาธารณะ) |
| LINE_CHANNEL_ACCESS_TOKEN | มีอยู่แล้ว (ใช้ push คูปอง) | 🔒 SECRET |
| SUPABASE_SERVICE_ROLE_KEY | env ของ edge function (มีอยู่แล้ว) | 🔒 SECRET |

## Deploy
1. Migration: `supabase/migrations/20260620000000_auth_gate.sql` (คอลัมน์ auth/UTM + ตาราง `course_progress`
   + RLS) — apply แล้ว; migration ฝั่ง Hub `20260927100000_cross_site_identity.sql` ต้อง apply ก่อนด้วย
   (ดู `jia-learning-hub`)
2. Edge functions: `supabase functions deploy auth-line-link signup-push account-progress`
3. Frontend: build ปกติ (Vercel) — ใส่ `LIFF_ID` ก่อน build

## A/B test (ออปชัน)
ใส่ `POSTHOG_KEY` ใน `App.jsx` แล้วสร้าง feature flag `gate_placement` ใน PostHog
payload = `before-course` | `after-lesson-1` | `soft` (ค่าเริ่มต้น)

## ปิดด่านชั่วคราว
ตั้ง `AUTH_GATE_ENABLED = false` ใน `App.jsx` → กลับไป flow เดิม (แอด LINE แบบข้ามได้)

## ทดสอบ
- เปิดในเบราว์เซอร์ LINE → ด่านโผล่ → กด "เข้าสู่ระบบด้วย LINE" → consent → กลับมาที่เว็บ → ปลดคอร์สทันที
- เปิดนอกแอป LINE (เบราว์เซอร์ปกติ) → กด "เข้าสู่ระบบด้วย LINE" → เด้งไปหน้า LINE login เว็บ → กลับมา → ผ่าน
- ตรวจ DB: `select line_user_id, auth_provider, auth_user_id, pdpa_consent_at, utm_source from customers order by signup_at desc limit 5;`
- คูปอง: หลังสมัครได้ข้อความ LINE มีรหัส `JIA-XXXXXX` (ลอง `?dry_run=1` ก่อน) + `select * from promo_codes where code='...';`
- ข้ามเครื่อง: ล็อกอินเครื่อง A เรียน 1-2 → ล็อกอินเครื่อง B (LINE เดิม) → progress merge มา
- ข้ามเว็บ: ล็อกอิน LINE ที่นี่ → เปิด `https://class.jiacpr.com/account` → กด LINE → เห็นเป็นบัญชีเดียวกัน
  (แผงคอร์สออนไลน์ใน `/account` แสดงสถานะ/คูปองตรงกัน)
- ลูกค้าที่เคยกรอกชื่อ-เบอร์ไว้ก่อน (ทางสำรอง) แล้วมาล็อกอิน LINE ทีหลัง → `customers` ยังมีแถวเดียว (ไม่สร้างซ้ำ)
