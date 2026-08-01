# Security review — follow-up actions

รีวิวความปลอดภัยรอบนี้แก้จุดที่ทำได้ปลอดภัยแล้วใน PR (ดู "แก้แล้วใน PR นี้"
ด้านล่าง) ส่วนที่เหลือด้านล่างนี้ **ต้องตัดสินใจ/ลงมือเพิ่ม** เพราะกระทบ
ฐานข้อมูลที่ใช้ร่วมกันหลายแอป หรือเป็นการปรับสถาปัตยกรรม จึงไม่รวมเป็น
migration ที่ auto-apply

---

## สถานะล่าสุด (2026-07-03) — apply ตรงบน remote แล้ว
- ✅ ปิด `public.users.password_hash` จาก anon/authenticated (column-level) — migration `20260703000001`
- ✅ `lead_promo_codes` hardening (index + redeem lock) — migration `20260703000000`
- ✅ trigger `notify_new_student_fn` แนบ header + revoke EXECUTE ของ SECURITY DEFINER RPC — migration `20260703000002`
- ⏳ ยังต้องทำ: ตั้ง env/secret 3 ตัว, redeploy edge functions, PII/admin auth, paywall server-side, slips bucket, leaked-password protection, search_path

---

## สถานะรอบนี้ (2026-08-01) — แก้ในโค้ดแล้ว รอ deploy + apply migration
แก้ใน PR นี้ (โค้ดฝั่ง repo — ยังไม่แตะ DB จริง):
- ✅ **เฉลยควิซออกจากบันเดิลแล้ว** — ย้ายไป edge function `grade-quiz` (ตรวจฝั่ง server ทั้งข้อสอบท้ายบทและ Final Exam); `COURSE` ในบันเดิลไม่มีคำตอบอีกต่อไป
- ✅ **อัปโหลดสลิปไม่ปลดล็อกทันทีแล้ว** — เข้าคิว "รอตรวจสอบ" ปลดล็อกเมื่อแอดมินตั้ง `payment_status = "ชำระแล้ว"` เท่านั้น (client sync ผ่าน RPC `get_purchase_by_id`)
- ✅ **แอดมินเปิดสลิปผ่าน signed URL** — admin-api เพิ่ม action `sign_slip` (อายุ 10 นาที) รองรับ bucket private
- ✅ **stripe-checkout ตัด path สำรอง** ที่เชื่อ `items/amount` จาก client (type อื่นนอกจาก `online_purchase` → 400)

ลำดับ deploy (ต้องทำตามลำดับ ไม่งั้นฟีเจอร์พัง):
1. Deploy `grade-quiz` (verify_jwt=false) + `admin-api` เวอร์ชันใหม่ + `stripe-checkout` เวอร์ชันใหม่
2. Apply migration `20260801000001` (RPC `get_purchase_by_id`)
3. Deploy frontend ใหม่
4. Apply migration `20260801000000` (slips bucket → private) — หลัง frontend+admin-api ใหม่ขึ้นแล้วเท่านั้น
5. Apply migration `20260801000002` (ปิด anon write: staff/settings/users/promo_codes) และ
   `20260801000003` (revoke execute + search_path) — **ตรวจ consumer แอปอื่นบน DB ร่วมก่อน**

ยังเหลือ (ไม่อยู่ใน PR นี้):
- ⏳ เปิด **leaked password protection** (Supabase Dashboard → Auth → ปุ่มเดียว)
- ⏳ ปิด anon SELECT ตาราง PII ที่เหลือ (`customers`, `bookings`, `sales_tracking`, …) — ตรวจ consumer ก่อน
- ⏳ ฟังก์ชัน `wmc_*` 15 ตัว (SECURITY DEFINER + PIN) — revoke จาก anon ถ้าไม่มีแอปไหนใช้
- ⏳ ใบประกาศ/คูปองยังออกฝั่ง client (สถานะ "ผ่าน" อยู่ใน localStorage) — ขั้นถัดไปคือผูกกับ
  ผลสอบที่ server บันทึกเอง (ต้องมี identity จริง เช่น LINE/Supabase Auth ทุกเคสก่อน)

---

## ✅ ทำแล้ว: `public.users.password_hash` (คงไว้เป็นบันทึก)

### 1. `public.users.password_hash` เปิดให้ anon อ่านได้ (14 แถวมี hash จริง)
RLS policy `anon_read` บนตาราง `users` เป็น `USING (true)` และ anon key ฝังอยู่ใน
บันเดิลหน้าเว็บ = ใครก็ดึง username + password_hash ของแอดมินได้ผ่าน
`/rest/v1/users?select=*`

`users` เป็นตารางที่ **ใช้ร่วมกับแอปอื่นบน DB `jia-unified`** จึงต้องตรวจว่าไม่มีแอปไหน
อ่าน `users` ด้วย anon key ก่อน แล้วค่อยรัน (แอป jia-online ไม่แตะตารางนี้เลย):

```sql
-- ซ่อน password_hash จาก anon โดยไม่พังการอ่านคอลัมน์ทั่วไป
revoke select on public.users from anon;
grant select (id, username, name, role, registered_at, last_login) on public.users to anon;
-- หรือถ้าไม่มีแอปไหนต้องอ่าน users ผ่าน anon เลย ให้ปิดทั้งตาราง:
-- revoke select on public.users from anon;
```

---

## PII รั่ว/แก้ได้เพราะ admin ใช้ anon key ร่วมกับผู้ใช้ทั่วไป

หน้า admin (`jiacpr.com/online?admin=1`) อ่าน/เขียน `customers`, `online_students`,
`online_purchases`, `lead_promo_codes`, `bookings`, `sales_tracking` ด้วย **anon key
ตัวเดียวกับผู้ใช้ทั่วไป** ทำให้ต้องเปิด policy `anon` แบบกว้าง (`USING (true)`) —
เท่ากับ PII ของลูกค้าทุกคน (ชื่อ เบอร์ อีเมล บริษัท สลิปโอนเงิน) อ่าน/แก้ได้โดยใครก็ตาม
ที่มี anon key

**✅ ทำแล้วบางส่วน (PR #42):** หน้า admin เปลี่ยนไปเรียกผ่าน edge function `admin-api`
ที่ตรวจรหัสแอดมินฝั่ง server (`x-admin-key === ADMIN_API_KEY`) แล้วใช้ `service_role`
เข้าถึงข้อมูล — เลิกใช้ anon key อ่าน/เขียน PII จาก client แล้ว
- รหัสแอดมินไม่อยู่ในบันเดิลอีกต่อไป (เดิม `VITE_ADMIN_PASSWORD`) → ย้ายไปเป็น
  `ADMIN_API_KEY` ที่ตั้งบน function `admin-api` เท่านั้น
- **Deploy:** deploy `admin-api` ด้วย `verify_jwt = false` + ตั้ง `ADMIN_API_KEY`
  **ก่อน** deploy frontend ใหม่ (ไม่งั้นหน้า admin ล็อกอินไม่ได้)

**ขั้นต่อไป — apply หลังยืนยันว่า admin-api ใช้งานได้จริง** (ยังไม่ได้ทำ เพราะต้องเช็คว่า
ไม่มีแอปอื่นบน DB รวมอ่านตารางเหล่านี้ผ่าน anon):
```sql
-- ตารางที่หน้า admin อ่านเท่านั้น (แอปฝั่งผู้เรียนไม่ได้ SELECT) → ปิด anon SELECT ได้
-- public flow ยังต้อง INSERT/UPDATE ได้ จึงปิดเฉพาะ SELECT
drop policy if exists anon_read on public.online_students;
drop policy if exists anon_read on public.online_purchases;
-- bookings / sales_tracking: ตรวจก่อนว่าไม่มี consumer อื่น แล้วค่อยทำแบบเดียวกัน
-- customers / lead_promo_codes: ยังปิด SELECT ทั้งหมดไม่ได้ (public อ่าน record ตัวเองด้วย)
--   ต้องทำ policy แบบผูกกับ auth_user_id / กรองด้วย code แทน
```
> เหลือ: `customers`, `settings`, `staff`, `pdpa_log`, `promo_codes` — ตรวจ consumer แล้วปิด/รัดทีละตัว

---

## Paywall / สิทธิ์เรียน อยู่ฝั่ง client ล้วน

การปลดล็อกบทเรียนเก็บใน `localStorage` (`jia_purchased`) และตรวจฝั่ง client ทั้งหมด —
เปิด devtools ตั้งค่าเองก็ปลดล็อกครบคอร์สได้ นอกจากนี้:
- **Stripe success**: กลับมาที่หน้าเว็บแล้วปลดล็อกจาก `?stripe=success&modules=...` บน URL
  โดยไม่ verify session จริงกับ Stripe → ใครพิมพ์ URL เองก็ได้ทั้งคอร์สฟรี
  ต้องมี edge function `verify` เซสชัน Stripe แล้วบันทึกสิทธิ์ฝั่ง server
- **ราคา**: `calcPrice` คำนวณฝั่ง client แล้วส่ง `amount` ให้ `stripe-checkout` — ต้องคำนวณ
  ราคาใหม่ฝั่ง server จากรายการบทที่เลือก ห้ามเชื่อ amount จาก client
- **แจ้งสลิป**: อัปโหลดรูปอะไรก็ปลดล็อกก่อนแอดมินอนุมัติ — สิทธิ์ควรผูกกับสถานะ
  `payment_status` ฝั่ง server ที่แอดมินอนุมัติแล้วเท่านั้น

## ใบประกาศ / คูปอง ฿100 ปลอมได้

เฉลยควิซทุกข้ออยู่ในบันเดิล (`COURSE`) และสถานะ "ผ่าน" อยู่ใน `localStorage` →
ออกใบเซอร์/ปั๊มคูปอง ฿100 ได้โดยไม่ต้องเรียนจริง ต้องให้ฝั่ง server เป็นคนตรวจข้อสอบ
และออกคูปอง/ใบประกาศ

## Storage: bucket `slips` เป็น public + list ได้

สลิปโอนเงิน (มีข้อมูลธนาคาร/PII) อยู่ใน bucket public ชื่อไฟล์เดาได้ (ชื่อ+timestamp)
ควรเปลี่ยนเป็น bucket private แล้วใช้ signed URL ให้แอดมินดู และตั้งชื่อไฟล์แบบสุ่ม

## อื่นๆ (จาก Supabase advisor)
- เปิด **leaked password protection** ใน Auth settings
- ตั้ง `search_path` ให้ฟังก์ชัน `line_broadcasts_due_3mo/11mo`, `jiaroo_set_updated_at`
  และ revoke EXECUTE ของ `line_broadcasts_due_*` / `notify_new_student_fn` จาก anon/authenticated

---

## ✅ แก้แล้วใน PR นี้ + ตัวแปรที่ต้องตั้งเพิ่ม

หลัง merge ต้องตั้ง env ใหม่ ไม่งั้นฟีเจอร์ที่เกี่ยวข้องจะหยุดทำงาน (fail closed โดยตั้งใจ):

| ตัวแปร | ตั้งที่ | ผลถ้าไม่ตั้ง |
|---|---|---|
| `ADMIN_API_KEY` | Supabase function `admin-api` (= รหัสแอดมินใหม่) | เข้าหน้า admin ไม่ได้ (401/503) |
| `CRON_KEY` | Supabase function `customer-followup-drip` | function ตอบ 503 (drip ไม่ทำงาน) |
| `NOTIFY_WEBHOOK_SECRET` | Supabase function `notify-new-student` | function ตอบ 503 (ไม่แจ้งเตือนนักเรียนใหม่) |

> หมายเหตุ: เดิมแผนจะใช้ `VITE_ADMIN_PASSWORD` (Vercel) แต่หลังทำ `admin-api` แล้ว
> รหัสแอดมินถูกตรวจฝั่ง server ล้วน — ตั้งแค่ `ADMIN_API_KEY` ที่ function พอ ไม่ต้องมี env ฝั่ง build
> **ต้อง deploy `admin-api` (verify_jwt=false) + ตั้ง `ADMIN_API_KEY` ก่อน deploy frontend ใหม่**

**notify-new-student**: ตอนนี้ function ต้องมี secret (fail closed) แต่ DB trigger
`notify_new_student_fn` ยัง **ไม่ได้แนบ header `x-webhook-secret`** ต้องอัปเดต trigger ให้
ดึง secret จาก `jiaroo_secrets` แล้วแนบไปด้วย (เก็บ secret ไว้ใน DB ไม่ commit ลงซอร์ส):

```sql
create or replace function public.notify_new_student_fn()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_secret text;
begin
  select value into v_secret from public.jiaroo_secrets
    where tenant_slug = 'jiaroo' and key = 'NOTIFY_WEBHOOK_SECRET';
  perform net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-student',
    body := jsonb_build_object('type','INSERT','table','online_students','record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', coalesce(v_secret,''))
  );
  return NEW;
exception when others then return NEW;
end; $$;
```
(ตั้งค่าเดียวกันทั้งใน `jiaroo_secrets` และ env `NOTIFY_WEBHOOK_SECRET` ของ function)
