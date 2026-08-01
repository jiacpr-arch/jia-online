-- เก็บตกจาก Supabase advisor — apply แล้วบน remote (2026-08-01):
--  1) line_broadcasts_due_3mo/11mo และ notify_new_*_fn เป็น SECURITY DEFINER ที่ anon/
--     authenticated เรียกผ่าน /rest/v1/rpc ได้ — ฟังก์ชันภายใน (cron/trigger) ไม่ควรเปิด
--  2) jiaroo_set_updated_at, line_broadcasts_due_* มี search_path แบบ mutable
--     (function_search_path_mutable) — ตั้งเป็น public กัน search_path hijack
--     (ใช้ 'public' ไม่ใช่ '' เพราะ body เดิมอาจอ้างตารางแบบไม่ qualify — ไม่ทำของเดิมพัง)
--
-- ต้อง revoke จาก PUBLIC ด้วย — Postgres ให้สิทธิ์ EXECUTE กับ PUBLIC โดย default
-- แค่ revoke จาก anon/authenticated ไม่พอ (ยังได้ผ่าน PUBLIC — เหตุที่ advisor ยังธง
-- notify_new_student_fn ทั้งที่ 20260703000002 เคย revoke ไปแล้ว) แต่เมื่อ revoke PUBLIC
-- ต้อง grant ให้ service_role ชัดเจน — edge function online-course-broadcast เรียก
-- line_broadcasts_due_* ด้วย service key ซึ่งเดิมได้สิทธิ์ผ่าน PUBLIC
-- trigger/cron ไม่กระทบ: trigger ตรวจ EXECUTE ตอน CREATE TRIGGER เท่านั้น,
-- cron ทั้งหมดรันเป็น postgres (ตรวจ cron.job แล้ว)

revoke execute on function public.line_broadcasts_due_3mo() from public, anon, authenticated;
revoke execute on function public.line_broadcasts_due_11mo() from public, anon, authenticated;
revoke execute on function public.notify_new_student_fn() from public, anon, authenticated;
revoke execute on function public.notify_new_booking_fn() from public, anon, authenticated;
grant execute on function public.line_broadcasts_due_3mo() to service_role;
grant execute on function public.line_broadcasts_due_11mo() to service_role;

alter function public.line_broadcasts_due_3mo() set search_path = public;
alter function public.line_broadcasts_due_11mo() set search_path = public;
alter function public.jiaroo_set_updated_at() set search_path = public;
