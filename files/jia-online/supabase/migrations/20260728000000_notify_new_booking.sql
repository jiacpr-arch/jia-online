-- แจ้งเตือนทีมเซลส์ทาง LINE เมื่อมีลูกค้ากดจองคลาส (bookings) ใหม่
--
-- ใช้ pg_net (async, non-blocking) + security definer เพื่อให้ role anon ที่ insert เรียกได้
-- มี exception guard: ถ้าการแจ้งเตือนพัง ต้องไม่บล็อกการจอง
-- แนบ header x-webhook-secret จาก jiaroo_secrets (คู่กับ notify-new-booking ที่ fail closed
-- ต้องตั้ง secret เดียวกันทั้ง jiaroo_secrets.NOTIFY_WEBHOOK_SECRET และ env ของ edge function)
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

revoke execute on function public.notify_new_booking_fn() from anon, authenticated;

drop trigger if exists notify_new_booking on public.bookings;
create trigger notify_new_booking
after insert on public.bookings
for each row execute function public.notify_new_booking_fn();
