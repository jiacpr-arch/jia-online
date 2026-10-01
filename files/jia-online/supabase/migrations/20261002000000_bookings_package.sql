-- แพ็กเกจคอร์ส CPR & AED สำหรับประชาชน (A / B / C) — เก็บแพ็กเกจที่ลูกค้าเลือกจากฟอร์ม lead (cpr.morroo.com)
--   A = เรียน on-site + face shield ฟรี + ใบประกาศ JIA ฟรี            ฿500
--   B = A + ใบรับรองโรงพยาบาล W Medical                              ฿700
--   C = B + pocket mask (แนะนำ)                                     ฿990
-- เพิ่มคอลัมน์อย่างเดียว (nullable) — booking เดิม/ช่องทางอื่นไม่กระทบ; ใส่ซ้ำใน note ด้วยให้เซลล์เห็นใน LINE แจ้งเตือน
alter table public.bookings add column if not exists package text;

do $$ begin
  alter table public.bookings add constraint bookings_package_chk check (package is null or package in ('A','B','C'));
exception when duplicate_object then null; end $$;
