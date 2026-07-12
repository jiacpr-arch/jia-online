-- ล็อก RLS ของ online_purchases (+ ปิด anon DELETE บน bookings) และเพิ่ม RPC เช็คสถานะ
-- การจ่ายเงินผ่าน Stripe ด้วย session_id — คู่กับ stripe-checkout/stripe-webhook ที่ดึง
-- เข้า repo รอบนี้
--
-- ปัญหาที่พบจากรีวิว (เช็คสถานะจริงบน DB แล้ว — 2026-07-12):
--  1) online_purchases: RLS เปิดให้ anon SELECT ได้ทั้งตาราง (using(true)) — เห็นเบอร์/
--     ยอดเงิน/ลิงก์สลิปของทุกคน ทั้งที่หน้า admin เปลี่ยนไปอ่านผ่าน admin-api
--     (service_role) แล้ว ฝั่งผู้เรียนก็ไม่เคยต้อง SELECT ตารางนี้เลย — ตรงกับที่
--     docs/SECURITY_FOLLOWUP.md เคยระบุไว้ว่าปิดได้เลย (บรรทัด "ตารางที่หน้า admin
--     อ่านเท่านั้น ... ปิด anon SELECT ได้")
--  2) online_purchases: anon INSERT ไม่มีการจำกัดค่า — client ยิง POST
--     payment_status="ชำระแล้ว" ตรงๆ ได้โดยไม่ต้องจ่ายเงินจริงเลย (ค่านี้ควรมาจาก
--     stripe-webhook เท่านั้น)
--  3) bookings: มี policy anon_delete using(true) — ใครก็ลบ booking ของทุกคนได้ด้วย
--     anon key เดียวกับที่ฝังในบันเดิลเว็บ ไม่มีเหตุผลทางธุรกิจใดต้องเปิดกว้างขนาดนี้
--     (ต่างจาก anon_read/anon_update ของ bookings ที่ยังไม่แตะรอบนี้ เพราะ DB นี้
--     ใช้ร่วมกับแอปอื่น — ต้องตรวจ consumer อื่นก่อนตามที่ SECURITY_FOLLOWUP.md ระบุไว้)
--
-- Apply via Supabase MCP `apply_migration` or `supabase db push` — ทดสอบบน branch ก่อน prod

-- ========== online_purchases: ปิด anon SELECT/UPDATE/DELETE ==========
drop policy if exists anon_read on public.online_purchases;

-- INSERT: อนุญาตเฉพาะแถวที่ไม่ได้ตั้งค่าเป็น "ชำระแล้ว" เอง (ค่านี้ต้องมาจาก webhook
-- ที่ใช้ service_role เท่านั้น) — ยังคง INSERT ไว้เพราะ flow แจ้งสลิปโอนเงิน
-- (Store/Payment) ยัง insert ตรงด้วย anon key ตามเดิม (ไม่เปลี่ยน UX ตามที่ตกลงไว้)
drop policy if exists anon_insert on public.online_purchases;
create policy anon_insert on public.online_purchases
  for insert to anon
  with check (payment_status is distinct from 'ชำระแล้ว');

revoke select, update, delete on public.online_purchases from anon;

-- ========== bookings: ปิดเฉพาะ anon DELETE (ช่องโหว่ชัดเจน ไม่มีเหตุผลทางธุรกิจ) ==========
drop policy if exists anon_delete on public.bookings;
revoke delete on public.bookings from anon;

-- ========== RPC: เช็คสถานะจ่ายเงินด้วย stripe_session_id (ไม่เปิด SELECT ทั้งตาราง) ==========
-- คืนเฉพาะ modules + payment_status ของ session นั้น — ไม่มีเบอร์/ยอดเงิน/ข้อมูลคนอื่น
create or replace function public.get_purchase_by_session(p_session_id text)
returns table (modules text, payment_status text)
language sql security definer set search_path = public stable
as $$
  select p.modules, p.payment_status
  from public.online_purchases p
  where p.stripe_session_id = p_session_id
  limit 1;
$$;

revoke all on function public.get_purchase_by_session(text) from public;
grant execute on function public.get_purchase_by_session(text) to anon;
