-- ระบบชวนเพื่อน (referral)
--   ผู้เรียนที่สมัครแล้วได้ลิงก์ cpr.morroo.com/?ref=<code> ของตัวเอง
--   เพื่อนที่เข้าผ่านลิงก์: สมัคร → บันทึก event "signup"; ซื้อผ่าน Stripe → ลด REFERRAL_DISCOUNT_PCT (20%)
--   คำนวณฝั่ง server ใน stripe-checkout แล้ว stripe-webhook บันทึก event "purchase" เมื่อจ่ายจริง
-- ตารางทั้งสองเปิด RLS ไม่มี policy (default-deny) — anon เข้าผ่าน RPC SECURITY DEFINER ด้านล่างเท่านั้น
-- แอดมินดูผ่าน admin-api (service role)

create table if not exists public.referral_codes (
  code text primary key,
  customer_id text not null unique references public.customers(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;

create table if not exists public.referral_events (
  id bigint generated always as identity primary key,
  code text not null references public.referral_codes(code) on delete cascade,
  kind text not null check (kind in ('signup', 'purchase')),
  customer_id text references public.customers(id) on delete set null, -- เพื่อนที่สมัคร (kind=signup)
  purchase_id uuid,                                                     -- online_purchases.id (kind=purchase)
  amount numeric,
  discount numeric,
  created_at timestamptz not null default now()
);
create unique index if not exists referral_events_signup_uniq on public.referral_events(customer_id) where kind = 'signup';
create unique index if not exists referral_events_purchase_uniq on public.referral_events(purchase_id) where kind = 'purchase';
create index if not exists referral_events_code_idx on public.referral_events(code);
alter table public.referral_events enable row level security;

-- เบอร์ 9 หลักท้าย (รูปแบบเดียวกับที่แอปจับคู่ customers.tel)
create or replace function public.referral_phone_tail(p text)
returns text language sql immutable set search_path = '' as $$
  select right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9)
$$;

-- โค้ดชวนเพื่อนของฉัน (สร้างให้ถ้ายังไม่มี) + สถิติ — ยืนยันความเป็นเจ้าของด้วย customer_id + เบอร์ที่ตรงกับ customers
-- (รูปแบบเดียวกับ issue_online_coupon) คืน null ถ้าไม่ผ่าน
create or replace function public.referral_my_code(p_customer_id text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if p_customer_id is null or length(public.referral_phone_tail(p_phone)) < 9 then return null; end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id
                 and public.referral_phone_tail(c.tel) = public.referral_phone_tail(p_phone)) then
    return null;
  end if;
  select code into v_code from public.referral_codes where customer_id = p_customer_id;
  while v_code is null loop
    v_code := 'R';
    for i in 1..6 loop v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1); end loop;
    begin
      insert into public.referral_codes(code, customer_id) values (v_code, p_customer_id);
    exception when unique_violation then
      -- ชนโค้ดเดิม → สุ่มใหม่; ชน customer_id (เรียกพร้อมกัน) → ใช้ของที่มีอยู่
      select code into v_code from public.referral_codes where customer_id = p_customer_id;
    end;
  end loop;
  return jsonb_build_object(
    'code', v_code,
    'signups', (select count(*) from public.referral_events e where e.code = v_code and e.kind = 'signup'),
    'purchases', (select count(*) from public.referral_events e where e.code = v_code and e.kind = 'purchase')
  );
end
$$;

-- เพื่อนสมัครผ่านลิงก์ชวน — บันทึกครั้งเดียวต่อเพื่อน 1 คน (ยืนยัน customer_id + เบอร์ของเพื่อน, ห้ามชวนตัวเอง,
-- นับเฉพาะลูกค้าที่เพิ่งสร้างภายใน 3 วัน กันเอาลูกค้าเก่ามาผูกย้อนหลัง) คืน true ถ้าบันทึก/เคยบันทึกแล้ว
create or replace function public.referral_record_signup(p_code text, p_customer_id text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_owner text;
begin
  select customer_id into v_owner from public.referral_codes where code = upper(trim(coalesce(p_code, '')));
  if v_owner is null or v_owner = p_customer_id then return false; end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id
                 and public.referral_phone_tail(c.tel) = public.referral_phone_tail(p_phone)
                 and length(public.referral_phone_tail(p_phone)) >= 9
                 and coalesce(c.created_at, now()) > now() - interval '3 days') then
    return false;
  end if;
  if exists (select 1 from public.customers o where o.id = v_owner
             and public.referral_phone_tail(o.tel) = public.referral_phone_tail(p_phone)) then
    return false; -- เบอร์เดียวกับเจ้าของโค้ด = ชวนตัวเอง
  end if;
  insert into public.referral_events(code, kind, customer_id)
    values (upper(trim(p_code)), 'signup', p_customer_id)
    on conflict do nothing;
  return true;
end
$$;

-- ตรวจโค้ดก่อนแสดงส่วนลดบนหน้าร้าน (ไม่เปิดข้อมูลเจ้าของโค้ด) — ราคาจริงคำนวณใหม่ใน stripe-checkout เสมอ
create or replace function public.referral_code_valid(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.referral_codes where code = upper(trim(coalesce(p_code, ''))))
$$;

revoke all on function public.referral_phone_tail(text) from public;
revoke all on function public.referral_my_code(text, text) from public;
revoke all on function public.referral_record_signup(text, text, text) from public;
revoke all on function public.referral_code_valid(text) from public;
grant execute on function public.referral_phone_tail(text) to anon, authenticated, service_role;
grant execute on function public.referral_my_code(text, text) to anon, authenticated, service_role;
grant execute on function public.referral_record_signup(text, text, text) to anon, authenticated, service_role;
grant execute on function public.referral_code_valid(text) to anon, authenticated, service_role;
