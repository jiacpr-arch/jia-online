# ตั้งค่าด่านบังคับสมัคร (LINE LIFF + Google + Email OTP)

ฟีเจอร์ (flow ปัจจุบัน — `GATE_VARIANT_DEFAULT = "before-course"`):
เปิดเว็บครั้งแรก → **ควิซเกริ่นนำ CPR 5 ข้อ (พร้อมรูป)** → **บังคับสมัคร** (LINE หลัก / Google / Email OTP) → เด้งแอด @jiacpr → **ปลดคอร์สทั้งหมด** + ส่งคูปอง ฿100 เข้าแชต LINE
โค้ดทั้งหมด deploy ได้เลย แต่ **การล็อกอินจริงจะทำงานเมื่อตั้งค่าด้านล่างครบ** (ระหว่างนี้ปุ่ม LINE จะซ่อนถ้า `LIFF_ID` ว่าง — ทดสอบ Email OTP แทนได้)

### รูปควิซเกริ่นนำ
วางไฟล์รูปจริงใน `public/teaser/q1.png`..`q5.png` (ดู `public/teaser/README.md`) — ถ้ายังไม่มีไฟล์ ระบบโชว์กล่อง emoji ประกอบให้อัตโนมัติ (ไม่มีรูปแตก). คำถาม/รูปแก้ได้ที่ `TEASER_QUIZ` ใน `src/App.jsx`

### A/B ตำแหน่งด่าน (`gate_placement` ใน PostHog)
`before-course` = ควิซเกริ่นนำหน้าแรก (ค่าปัจจุบัน) · `after-lesson-1` = ให้ดูบท 1 ฟรีก่อนแล้วค่อยกั้น · `soft` = แอด LINE แบบข้ามได้ (flow เดิม)

## สิ่งที่ต้องตั้งค่า (เจ้าของบัญชี)

### A. LINE Login + LIFF (ล็อกอินหลัก)
1. LINE Developers Console → provider เดียวกับ @jiacpr Messaging API → สร้าง **LINE Login channel**
2. Login channel → **Linked LINE Official Account** = @jiacpr → เปิด **Add friend option = aggressive** (กลไกเด้งแอดเพื่อนตอนล็อกอิน)
3. สร้าง **LIFF app**: Endpoint URL = URL ที่ deploy (HTTPS), Scope `openid` + `profile`, Size = Full
4. นำค่ามาใส่:
   - **LIFF ID** → `src/App.jsx` ค่าคงที่ `LIFF_ID` (PUBLIC)
   - **Login channel ID** → Supabase: ตาราง `jiaroo_secrets` (tenant `jiaroo`, key `LINE_LOGIN_CHANNEL_ID`) หรือ env ของ edge function

### B. Google login
1. Google Cloud Console → Credentials → **OAuth 2.0 Client ID (Web)**
2. Authorized redirect URI = `https://tpoiyykbgsgnrdwzgzvn.supabase.co/auth/v1/callback`
3. เก็บ Client ID + Secret

### C. Supabase Auth
1. Dashboard → Authentication → Providers → **Google**: ใส่ Client ID/Secret, เปิดใช้
2. Providers → **Email**: เปิด, ใช้แบบ OTP
3. URL Configuration: Site URL + Redirect URLs = origin ของแอป

### D. Secrets (สรุป)
| ค่า | ใส่ที่ | Public? |
| --- | --- | --- |
| LIFF ID | `App.jsx` `LIFF_ID` | ✅ PUBLIC |
| LINE Login channel ID | `jiaroo_secrets.LINE_LOGIN_CHANNEL_ID` (หรือ env) | 🔒 SECRET |
| LINE_CHANNEL_ACCESS_TOKEN | มีอยู่แล้ว (ใช้ push คูปอง) | 🔒 SECRET |
| Google client id/secret | Supabase Auth provider | 🔒 SECRET |
| SUPABASE_SERVICE_ROLE_KEY | env ของ edge function (มีอยู่แล้ว) | 🔒 SECRET |

## Deploy
1. Migration: `supabase/migrations/20260620000000_auth_gate.sql` (คอลัมน์ auth/UTM + ตาราง `course_progress` + RLS)
2. Edge functions: `supabase functions deploy auth-line-link signup-push account-progress`
3. Frontend: build ปกติ (Vercel) — ใส่ `LIFF_ID` ก่อน build

## A/B test (ออปชัน)
ใส่ `POSTHOG_KEY` ใน `App.jsx` แล้วสร้าง feature flag `gate_placement` ใน PostHog
payload = `before-course` | `after-lesson-1` (ค่าเริ่มต้น) | `soft`

## ปิดด่านชั่วคราว
ตั้ง `AUTH_GATE_ENABLED = false` ใน `App.jsx` → กลับไป flow เดิม (แอด LINE แบบข้ามได้)

## ทดสอบ
- เปิดในเบราว์เซอร์ LINE → ผ่านบท 1 → ด่านโผล่ → กด LINE → consent + เพิ่มเพื่อน → กลับมา → บท 2 ปลด
- ตรวจ DB: `select line_user_id, auth_provider, pdpa_consent_at, utm_source from customers order by signup_at desc limit 5;`
- คูปอง: หลังสมัครได้ข้อความ LINE มีรหัส `JIA-XXXXXX` (ลอง `?dry_run=1` ก่อน) + `select * from promo_codes where code='...';`
- ข้ามเครื่อง: ล็อกอินเครื่อง A เรียน 1-2 → ล็อกอินเครื่อง B (LINE เดิม) → progress merge มา
