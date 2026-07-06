-- โค้ดกลาง (multi-use) สำหรับนักเรียน pre-course: โค้ดเดียวใช้ได้ทุกคน ทุกวัน ไม่หมดอายุ
-- โจทย์: อยากให้นักเรียนที่จะมาเข้าคลาสจริง "เรียนออนไลน์มาก่อน" โดยเจ้าหน้าที่ไม่ต้อง
-- ออก voucher รายคนทุกวัน — แจกโค้ดกลางตัวเดียว (เช่นแปะใน LINE/ใบยืนยันการจอง) ได้เลย
--
-- ต่อยอดตาราง lead_promo_codes เดิม: เพิ่ม flag multi_use
--  - โค้ด multi_use จะไม่ถูก mark redeemed_at (ใช้ซ้ำได้เรื่อยๆ) — ติดตามรายคนผ่าน
--    lead_capture_events (event_type='redeemed' พร้อมชื่อ+เบอร์ใน metadata) และ
--    online_students เหมือน flow เดิม
--  - กัน anon UPDATE แถวโค้ดกลาง (ไม่งั้นใครก็ PATCH redeemed_at ปิดโค้ดของทุกคนได้)
--  - unique index phone/email เดิมต้องไม่นับแถว multi_use (แถวโค้ดกลางไม่ผูกกับคนจริง
--    ใช้ค่า placeholder แทน)

alter table public.lead_promo_codes
  add column if not exists multi_use boolean not null default false;

-- เดิมกันเบอร์ซ้ำเฉพาะโค้ดรายคนที่ยังไม่ redeem — โค้ดกลางไม่ผูกเบอร์ใคร ต้อง exclude
drop index if exists public.idx_lead_promo_phone_active;
create unique index if not exists idx_lead_promo_phone_active
  on public.lead_promo_codes (phone)
  where redeemed_at is null and not multi_use;

drop index if exists public.idx_lead_promo_email;
create unique index if not exists idx_lead_promo_email
  on public.lead_promo_codes (lower(email))
  where email is not null and email <> '' and not multi_use;

-- anon แก้ไขได้เฉพาะ redeem transition ของโค้ดรายคนเท่านั้น
drop policy if exists lead_promo_anon_redeem on public.lead_promo_codes;
create policy lead_promo_anon_redeem on public.lead_promo_codes
  for update to anon
  using (redeemed_at is null and not multi_use)
  with check (redeemed_at is not null);

-- Seed โค้ดกลางตัวแรก: JIA-STUDENT ปลดล็อกเต็มคอร์ส (ทุกบท + แบบทดสอบสุดท้าย) ใช้ได้ตลอด
insert into public.lead_promo_codes
  (code, email, phone, name, source, unlock_modules, expires_at, multi_use)
values
  ('JIA-STUDENT', '', 'standing:JIA-STUDENT', 'โค้ดกลางนักเรียน Pre-course',
   'pre_course', '{1,2,3,4,5,6,7}', '2099-12-31T23:59:59Z', true)
on conflict (code) do nothing;
