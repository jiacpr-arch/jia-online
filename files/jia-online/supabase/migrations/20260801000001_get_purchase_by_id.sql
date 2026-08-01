-- RPC เช็คสถานะการแจ้งชำระด้วยสลิป — คู่กับโค้ดรอบนี้ที่เลิกปลดล็อกบทเรียนทันทีตอนอัปโหลดสลิป
-- (เดิมอัปโหลดรูปอะไรก็ได้ก็ปลดล็อกเลย ไม่รอแอดมินตรวจ) ตอนนี้ client เก็บ id ของแถว
-- online_purchases ที่ตัวเองสร้างไว้ แล้ว poll สถานะผ่าน RPC นี้ — ปลดล็อกเมื่อแอดมินตั้ง
-- payment_status = 'ชำระแล้ว' เท่านั้น
--
-- ขอบเขตข้อมูล: คืนเฉพาะ modules + payment_status ของ id (uuid สุ่ม) ที่ถืออยู่ —
-- ไม่มีเบอร์โทร/ยอดเงิน/ลิงก์สลิป และเดา id คนอื่นไม่ได้ในทางปฏิบัติ
-- (แบบเดียวกับ get_purchase_by_session ใน 20260712000002)

create or replace function public.get_purchase_by_id(p_id uuid)
returns table (modules text, payment_status text)
language sql security definer set search_path = public stable
as $$
  select p.modules, p.payment_status
  from public.online_purchases p
  where p.id = p_id
  limit 1;
$$;

revoke all on function public.get_purchase_by_id(uuid) from public;
grant execute on function public.get_purchase_by_id(uuid) to anon;
