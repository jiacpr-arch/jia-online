-- 1) trigger notify_new_student_fn: แนบ header x-webhook-secret จาก jiaroo_secrets
--    (คู่กับ notify-new-student ที่ตอนนี้ fail closed — ต้องตั้ง secret เดียวกันทั้ง
--     jiaroo_secrets.NOTIFY_WEBHOOK_SECRET และ env ของ edge function)
-- 2) revoke EXECUTE ของ SECURITY DEFINER RPC จาก client (trigger/cron ยังทำงานได้ตามเดิม)
--
-- applied ตรงบน remote แล้ว (2026-07-03) — เก็บไฟล์ไว้เพื่อ track/ทำซ้ำ

create or replace function public.notify_new_student_fn()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_secret text;
begin
  select value into v_secret from public.jiaroo_secrets
    where tenant_slug = 'jiaroo' and key = 'NOTIFY_WEBHOOK_SECRET';
  perform net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-student',
    body := jsonb_build_object('type','INSERT','table','online_students','record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', coalesce(v_secret,''))
  );
  return NEW;
exception when others then
  return NEW;
end; $$;

revoke execute on function public.notify_new_student_fn() from anon, authenticated;
revoke execute on function public.line_broadcasts_due_3mo() from anon, authenticated;
revoke execute on function public.line_broadcasts_due_11mo() from anon, authenticated;
