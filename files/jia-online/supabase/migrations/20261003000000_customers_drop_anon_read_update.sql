-- ปิดการอ่าน/แก้ตาราง customers ด้วย anon key (ชื่อ/เบอร์/อีเมลลูกค้าทั้งหมดเคยดึงได้ด้วย publishable key ในบันเดิล)
--
-- ตรวจก่อนปิด (25 ก.ย. → 2 ต.ค. 2569): pg_stat_statements ของ role anon/authenticated ไม่มี SELECT/UPDATE
-- บน customers เพิ่มขึ้นเลยตลอด 7 วัน และ edge_logs 24 ชม. มีแค่ POST (สมัคร) จาก cpr.morroo.com
-- การ INSERT ทุกแบบในสถิติตรงกับโค้ดสมัคร/จองของ cpr.morroo.com ซึ่งเปลี่ยนเป็น Prefer: return=minimal แล้ว
-- (WRITE_ONLY_TABLES ใน src/lib/core.jsx) — return=representation ต้องผ่าน SELECT policy จะโดนปฏิเสธหลังปิด
-- ทดสอบกับ PostgREST จริงแล้ว: ตาราง insert-only + return=minimal = สำเร็จ, return=representation = ล้มเหลว
--
-- คงไว้: anon_insert (สมัครสมาชิก/จอง) — แอดมินและ edge function ใช้ service role ไม่กระทบ
-- ย้อนกลับ (ถ้ามีแอปพัง): create policy anon_read on public.customers for select to anon using (true);
drop policy if exists "Anyone can view customers" on public.customers;
drop policy if exists anon_read on public.customers;
drop policy if exists anon_update on public.customers;
