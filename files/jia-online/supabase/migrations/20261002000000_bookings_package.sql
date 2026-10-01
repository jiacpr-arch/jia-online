-- แพ็กเกจคอร์ส CPR & AED (เจ้าของตัดสินใจ 2 ต.ค. 2569): ฟอร์มจอง lead ของ cpr.morroo.com ให้เลือก
-- แพ็กเกจ A / B / C แล้วบันทึกไว้ในคอลัมน์นี้ (ใส่ใน note ด้วยให้เซลล์เห็นในการแจ้งเตือน LINE)
--   A = ค่าเรียน + face shield ฟรี + ใบ JIA ฟรี (฿500)
--   B = A + ใบรับรองโรงพยาบาล W Medical (฿700)
--   C = B + pocket mask (฿990)
-- ใช้ชื่อ cpr_package ไม่ใช่ package: bookings.package มีอยู่แล้วบน production (ค่า '' / 'fixed' จากฟอร์ม
-- จองอื่น) — ไม่แตะคอลัมน์นั้น
-- เพิ่มคอลัมน์อย่างเดียว nullable — แถวเดิมและแอปอื่นที่ใช้ตาราง bookings ร่วมกันไม่ได้รับผลกระทบ
--
-- Apply via Supabase MCP `apply_migration` or `supabase db push`
alter table public.bookings add column if not exists cpr_package text;
alter table public.bookings drop constraint if exists bookings_cpr_package_check;
alter table public.bookings add constraint bookings_cpr_package_check check (cpr_package is null or cpr_package in ('A','B','C'));
-- ฟอร์มยิง insert ด้วย anon key — ให้สิทธิ์คอลัมน์นี้ชัดเจน (ไม่มีผลถ้า anon มีสิทธิ์ insert ทั้งตารางอยู่แล้ว)
grant insert (cpr_package) on public.bookings to anon;
