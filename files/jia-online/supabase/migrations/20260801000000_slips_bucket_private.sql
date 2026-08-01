-- ปิด bucket `slips` จาก public — สลิปโอนเงินมี PII/ข้อมูลธนาคาร แต่เดิม bucket เป็น public
-- และ policy SELECT แบบกว้าง ("Anyone can view slips") เปิดให้ ใครก็ list + เปิดดูสลิปทุกใบได้
-- (Supabase advisor: public_bucket_allows_listing — เช็คสถานะจริงแล้ว 2026-08-01)
--
-- คู่กับโค้ดรอบนี้: หน้า admin เปลี่ยนไปเปิดสลิปผ่าน admin-api action `sign_slip`
-- (service_role ออก signed URL อายุ 10 นาที) — ลิงก์ public เดิมที่เก็บใน
-- online_purchases.slip_url ยังใช้เป็นตัวชี้ไฟล์ได้ แค่เปิดตรงไม่ได้แล้ว
--
-- ⚠️ Apply หลัง deploy admin-api เวอร์ชันใหม่ + frontend ใหม่แล้วเท่านั้น ไม่งั้นแอดมินเปิดสลิปไม่ได้
-- ⚠️ DB นี้ใช้ร่วมหลายแอป — ตรวจก่อนว่าไม่มีแอปอื่นเปิดสลิปผ่านลิงก์ public (เช็คแล้วในแอปนี้: ไม่มี)

-- 1) bucket เป็น private (ลิงก์ /object/public/slips/... จะ 404 ทันที)
update storage.buckets set public = false where id = 'slips';

-- 2) เอา policy SELECT แบบกว้างออก — เหลือทางเดียวคือ signed URL จาก service_role
drop policy if exists "Anyone can view slips" on storage.objects;

-- 3) การอัปโหลดจากหน้าเว็บยังทำได้ตามเดิม — policy "Anyone can upload slips" (INSERT) มีอยู่แล้ว
--    (เช็คสถานะจริง 2026-08-01) จึงไม่ต้องแตะ; bucket private ไม่กระทบการ INSERT
