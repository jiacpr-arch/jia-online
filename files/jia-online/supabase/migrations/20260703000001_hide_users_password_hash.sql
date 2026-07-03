-- Security: ห้าม role ฝั่ง client (anon/authenticated) อ่านคอลัมน์ password_hash ของ public.users
-- เดิม anon/authenticated มี SELECT ทั้งตาราง + RLS anon_read USING(true) => ดึง hash รหัสแอดมินได้
-- ใช้ column-level grant: คงสิทธิ์อ่านคอลัมน์ที่ไม่ใช่ความลับไว้ เพื่อไม่ให้ระบบจัดการผู้ใช้พัง
--
-- หมายเหตุ: ตาราง users อยู่บน DB รวม (jia-unified) — applied ตรงบน remote แล้ว (2026-07-03)
-- ไฟล์นี้เก็บไว้เพื่อ track ประวัติ/ทำซ้ำได้ (REVOKE/GRANT เป็น idempotent)

revoke select on public.users from anon;
revoke select on public.users from authenticated;
grant select (id, username, name, role, registered_at, last_login) on public.users to anon;
grant select (id, username, name, role, registered_at, last_login) on public.users to authenticated;
