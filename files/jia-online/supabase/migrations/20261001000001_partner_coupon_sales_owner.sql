-- คูปองพาร์ทเนอร์ = เซลล์ของบริษัทเองเป็นคนแจก → ลูกค้าที่ใช้คูปองเป็น "ลูกค้าของเซลล์คนนั้น" เท่านั้น
--   1) lead_promo_codes.sales_rep_id → jiaroo_team(id): แอดมินเลือกเซลล์เจ้าของคูปองตอนสร้าง/แก้ชุด
--      (company ยังเป็น "ชื่อที่โชว์ให้ลูกค้า" เหมือนเดิม — ชื่อใน jiaroo_team เป็นชื่อ LINE ไม่เหมาะโชว์ลูกค้า)
--   2) sales_owner_for_phone(): เบอร์ลูกค้า → เซลล์เจ้าของ (คูปองใบแรกที่ใช้ชนะ ถ้าเคยใช้หลายใบ)
--      ใช้ใน edge function เท่านั้น (service_role) — ไม่เปิดให้ anon กันไล่เบอร์ดูว่าใครเป็นลูกค้าใคร
--   3) trigger แจ้งเซลล์เจ้าของทาง LINE (edge function notify-sales-rep):
--      - ลูกค้ากดรับสิทธิ์คูปอง (redeemed_at ถูกตั้ง)
--      - ลูกค้าเรียนจบ (online_students.completed_at ถูกตั้ง) → จังหวะขายภาคปฏิบัติ on-site
--      การจอง on-site → notify-new-booking ใส่ชื่อเจ้าของในข้อความกลุ่ม + ส่งตรงหาเซลล์คนนั้น
--      ลูกค้าทัก @jiacpr → line-webhook ส่งต่อให้เซลล์เจ้าของ
--
-- ต้อง deploy edge function `notify-sales-rep` ก่อน (supabase/functions/notify-sales-rep)
-- Apply via Supabase MCP `apply_migration` or `supabase db push`

alter table public.lead_promo_codes
  add column if not exists sales_rep_id uuid references public.jiaroo_team(id) on delete set null;

create index if not exists idx_lead_promo_partner_redeemed_phone
  on public.lead_promo_codes (right(regexp_replace(coalesce(redeemed_phone, ''), '\D', '', 'g'), 9))
  where source = 'partner_coupon' and redeemed_at is not null;

-- ========== เบอร์ลูกค้า → เซลล์เจ้าของ ==========
-- display_name/contact_* = สิ่งที่โชว์ลูกค้า (ตามที่กรอกในคูปอง, ไม่มีเบอร์ใช้เบอร์ในทีมแทน)
-- rep_line_user_id = ปลายทาง push แจ้งเตือนเซลล์ (null = ยังไม่ผูกเซลล์ → ไม่มีใครถูกแจ้ง)
create or replace function public.sales_owner_for_phone(p_phone text)
returns table (
  code text, display_name text, contact_line text, contact_phone text, sponsor_value int,
  sales_rep_id uuid, rep_name text, rep_line_user_id text, redeemed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.code, l.company, l.sponsor_line, coalesce(l.sponsor_phone, t.phone), l.sponsor_value,
         l.sales_rep_id, t.name, case when t.active then t.line_user_id end, l.redeemed_at
    from public.lead_promo_codes l
    left join public.jiaroo_team t on t.id = l.sales_rep_id
   where l.source = 'partner_coupon'
     and l.redeemed_at is not null
     and length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)) = 9
     and right(regexp_replace(coalesce(l.redeemed_phone, ''), '\D', '', 'g'), 9)
         = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
   order by l.redeemed_at asc
   limit 1;
$$;
revoke all on function public.sales_owner_for_phone(text) from public, anon, authenticated;
grant execute on function public.sales_owner_for_phone(text) to service_role;

-- ========== trigger → edge function notify-sales-rep ==========
-- pg_net async + exception guard: การแจ้งเตือนพังต้องไม่บล็อกการ redeem/บันทึกเรียนจบ
create or replace function public.notify_sales_rep_post(p_event text, p_record jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_secret text;
begin
  select value into v_secret from public.jiaroo_secrets
    where tenant_slug = 'jiaroo' and key = 'NOTIFY_WEBHOOK_SECRET';
  perform net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/notify-sales-rep',
    body := jsonb_build_object('event', p_event, 'record', p_record),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, ''))
  );
exception when others then
  null;
end;
$$;
revoke execute on function public.notify_sales_rep_post(text, jsonb) from public, anon, authenticated;

-- ลูกค้ากดรับสิทธิ์คูปองพาร์ทเนอร์ (redeem_lead_code ตั้ง redeemed_at ครั้งเดียวต่อใบ)
create or replace function public.notify_sales_rep_redeemed_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.source = 'partner_coupon' and NEW.sales_rep_id is not null
     and OLD.redeemed_at is null and NEW.redeemed_at is not null then
    perform public.notify_sales_rep_post('redeemed', jsonb_build_object(
      'code', NEW.code, 'name', NEW.name, 'phone', NEW.redeemed_phone));
  end if;
  return NEW;
exception when others then
  return NEW;
end;
$$;
revoke execute on function public.notify_sales_rep_redeemed_fn() from public, anon, authenticated;

create or replace trigger notify_sales_rep_redeemed
after update of redeemed_at on public.lead_promo_codes
for each row execute function public.notify_sales_rep_redeemed_fn();

-- ลูกค้าเรียนจบ (แอปทั้ง INSERT แถวใหม่พร้อม completed_at และ PATCH แถวเดิม) — ยิงเฉพาะลูกค้าที่มีเซลล์เจ้าของ
create or replace function public.notify_sales_rep_completed_fn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.completed_at is not null
     and (TG_OP = 'INSERT' or OLD.completed_at is null)
     and exists (select 1 from public.sales_owner_for_phone(NEW.phone) o where o.rep_line_user_id is not null) then
    perform public.notify_sales_rep_post('completed', jsonb_build_object(
      'name', NEW.name, 'phone', NEW.phone, 'final_score', NEW.final_score, 'customer_id', NEW.customer_id));
  end if;
  return NEW;
exception when others then
  return NEW;
end;
$$;
revoke execute on function public.notify_sales_rep_completed_fn() from public, anon, authenticated;

create or replace trigger notify_sales_rep_completed
after insert or update of completed_at on public.online_students
for each row execute function public.notify_sales_rep_completed_fn();
