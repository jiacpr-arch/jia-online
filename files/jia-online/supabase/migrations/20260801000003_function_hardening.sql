-- เก็บตกจาก Supabase advisor + docs/SECURITY_FOLLOWUP.md (เช็คสถานะจริง 2026-08-01):
--  1) line_broadcasts_due_3mo/11mo และ notify_new_*_fn เป็น SECURITY DEFINER ที่ anon/
--     authenticated ยังเรียกผ่าน /rest/v1/rpc ได้ — ฟังก์ชันภายใน (cron/trigger) ไม่ควรเปิด
--  2) jiaroo_set_updated_at, line_broadcasts_due_* มี search_path แบบ mutable
--     (function_search_path_mutable) — ตั้งเป็น public กัน search_path hijack
--     (ใช้ 'public' ไม่ใช่ '' เพราะ body เดิมอาจอ้างตารางแบบไม่ qualify — ไม่ทำของเดิมพัง)
--
-- ⚠️ ก่อน apply: ตรวจว่า cron/trigger ที่เรียกฟังก์ชันเหล่านี้รันด้วย role อื่น (postgres/
--    service_role) จริง — ปกติ pg_cron รันเป็นเจ้าของ job และ trigger รันเป็นเจ้าของตาราง จึงไม่กระทบ

-- ต้อง revoke จาก PUBLIC ด้วย — ฟังก์ชันใน Postgres ให้สิทธิ์ EXECUTE กับ PUBLIC โดย default
-- แค่ revoke จาก anon/authenticated ไม่พอ (ยังได้สิทธิ์ผ่าน PUBLIC อยู่ดี — เหตุที่ advisor ยังธง
-- notify_new_student_fn ทั้งที่ 20260703000002 เคย revoke ไปแล้ว)
-- trigger/cron ไม่กระทบ: trigger ตรวจ EXECUTE ตอน CREATE TRIGGER เท่านั้น, pg_cron รันเป็นเจ้าของ job
revoke execute on function public.line_broadcasts_due_3mo() from public, anon, authenticated;
revoke execute on function public.line_broadcasts_due_11mo() from public, anon, authenticated;
revoke execute on function public.notify_new_student_fn() from public, anon, authenticated;
revoke execute on function public.notify_new_booking_fn() from public, anon, authenticated;

alter function public.line_broadcasts_due_3mo() set search_path = public;
alter function public.line_broadcasts_due_11mo() set search_path = public;
alter function public.jiaroo_set_updated_at() set search_path = public;
