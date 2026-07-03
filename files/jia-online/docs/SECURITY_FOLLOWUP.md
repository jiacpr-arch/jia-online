# Security review — follow-up actions

รีวิวความปลอดภัยรอบนี้แก้จุดที่ทำได้ปลอดภัยแล้วใน PR (ดู "แก้แล้วใน PR นี้"
ด้านล่าง) ส่วนที่เหลือด้านล่างนี้ **ต้องตัดสินใจ/ลงมือเพิ่ม** เพราะกระทบ
ฐานข้อมูลที่ใช้ร่วมกันหลายแอป หรือเป็นการปรับสถาปัตยกรรม จึงไม่รวมเป็น
migration ที่ auto-apply

---

## ⚠️ ต้องทำทันที (manual)

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

**ทางแก้ที่ถูกต้อง:** ให้ admin ใช้สิทธิ์จริง แทน anon
- ทำ edge function ฝั่ง server ที่ตรวจ auth ของแอดมินแล้วใช้ `service_role` อ่าน/เขียน
  (frontend admin เรียกผ่าน function นี้แทน `supaRest` ตรงๆ), หรือ
- ใช้ Supabase Auth + role `admin` แล้วตั้ง RLS ให้ตาราง PII อ่านได้เฉพาะ role นั้น

เมื่อ admin ไม่ใช้ anon แล้ว จึงจะ **ปิด policy `anon_read`/`anon_update` แบบ `USING (true)`
บน `customers`, `online_students`, `online_purchases`, `promo_codes`, `settings`, `staff`,
`pdpa_log`** ได้โดยไม่ทำให้ทั้งแอปพัง (ตอนนี้ปิดไม่ได้เพราะ flow ปกติพึ่ง anon อ่านเอง)

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
| `VITE_ADMIN_PASSWORD` | Vercel (build env) | เข้าหน้า admin ไม่ได้ |
| `CRON_KEY` | Supabase function `customer-followup-drip` | function ตอบ 503 (drip ไม่ทำงาน) |
| `NOTIFY_WEBHOOK_SECRET` | Supabase function `notify-new-student` | function ตอบ 503 (ไม่แจ้งเตือนนักเรียนใหม่) |

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
