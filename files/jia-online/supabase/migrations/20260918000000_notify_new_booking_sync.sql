-- ซิงก์สิ่งที่ apply อยู่บน production แล้ว (2026-07-28 → 2026-08-14) ให้มีใน repo
-- ทั้งหมดนี้รันซ้ำได้ (idempotent) — บน production จะไม่เปลี่ยนอะไรเพราะตรงกันอยู่แล้ว
--
-- 1) trigger แจ้งเตือนทีมเซลส์ทาง LINE เมื่อมี booking ใหม่ (edge function notify-new-booking)
--    ใช้ pg_net (async, non-blocking) + security definer ให้ role anon ที่ insert เรียกได้
--    มี exception guard: ถ้าการแจ้งเตือนพัง ต้องไม่บล็อกการจอง
--    แนบ header x-webhook-secret จาก jiaroo_secrets (function ฝั่ง edge fail closed
--    ต้องตั้ง secret เดียวกันทั้ง jiaroo_secrets.NOTIFY_WEBHOOK_SECRET และ env ของ edge function)
--
-- 2) pg_cron 3 งาน ที่เรียก notify-new-booking ในโหมด ?job=… (เวลาเป็น UTC; +7 = เวลาไทย)
--    notify-pending-slips-am  30 1 * * *   (08:30 ไทย) เตือนสลิป class.morroo.com ค้างตรวจเกิน 12 ชม.
--    notify-pending-slips-pm  30 10 * * *  (17:30 ไทย) เตือนสลิปค้างตรวจ รอบบ่าย
--    notify-class-reminder    0 1 * * *    (08:00 ไทย) รายชื่อผู้เรียนของรอบที่จะเริ่มในอีก 3 วัน
--
-- ต้อง deploy edge function `notify-new-booking` ก่อน (supabase/functions/notify-new-booking)

create or replace function public.notify_new_booking_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  select value into v_secret from public.jiaroo_secrets
    where tenant_slug = 'jiaroo' and key = 'NOTIFY_WEBHOOK_SECRET';
  perform net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-booking',
    body := jsonb_build_object('type', 'INSERT', 'table', 'bookings', 'record', to_jsonb(NEW)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, ''))
  );
  return NEW;
exception when others then
  return NEW;
end;
$$;

revoke execute on function public.notify_new_booking_fn() from public, anon, authenticated;

drop trigger if exists notify_new_booking on public.bookings;
create trigger notify_new_booking
after insert on public.bookings
for each row execute function public.notify_new_booking_fn();

-- ---------------------------------------------------------------------------
-- pg_cron — unschedule ของเดิมก่อน (ถ้ามี) แล้ว schedule ใหม่ให้ตรงกับ production
do $$
declare j record;
begin
  for j in select jobid from cron.job
    where jobname in ('notify-pending-slips-am', 'notify-pending-slips-pm', 'notify-class-reminder')
  loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

select cron.schedule('notify-pending-slips-am', '30 1 * * *', $job$
  select net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-booking?job=pending-slips',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',
      (select value from jiaroo_secrets where tenant_slug='jiaroo' and key='NOTIFY_WEBHOOK_SECRET'))
  );
$job$);

select cron.schedule('notify-pending-slips-pm', '30 10 * * *', $job$
  select net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-booking?job=pending-slips',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',
      (select value from jiaroo_secrets where tenant_slug='jiaroo' and key='NOTIFY_WEBHOOK_SECRET'))
  );
$job$);

select cron.schedule('notify-class-reminder', '0 1 * * *', $job$
  select net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-new-booking?job=class-reminder',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret',
      (select value from jiaroo_secrets where tenant_slug='jiaroo' and key='NOTIFY_WEBHOOK_SECRET'))
  );
$job$);
