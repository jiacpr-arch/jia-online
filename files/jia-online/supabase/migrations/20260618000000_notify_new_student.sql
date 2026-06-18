-- แจ้งเตือนทีมเซลส์เมื่อมีนักเรียนใหม่ (online_students) ผ่าน Edge Function notify-new-student
--
-- ส่ง LINE ถึงทุกคนใน jiaroo_team ที่มี line_user_id
-- ใช้ pg_net (async, non-blocking) + security definer เพื่อให้ role anon ที่ insert เรียกได้
-- มี exception guard: ถ้าการแจ้งเตือนพัง ต้องไม่บล็อกการสมัครเรียน
--
-- ต้อง deploy edge function `notify-new-student` ก่อน (supabase/functions/notify-new-student)

create or replace function public.notify_new_student_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-student',
    body := jsonb_build_object('type', 'INSERT', 'table', 'online_students', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists notify_new_student on public.online_students;
create trigger notify_new_student
after insert on public.online_students
for each row execute function public.notify_new_student_fn();
