-- (1) คำขอใบกำกับภาษีเต็มรูป — ผู้ซื้อ/บริษัทกรอกข้อมูลผู้เสียภาษีหลังชำระเงิน แอดมินออกใบใน FlowAccount
--     แล้วบันทึกเลขที่ใบกลับที่แท็บ "ใบกำกับภาษี" (ยังไม่ต่อ API FlowAccount อัตโนมัติ)
-- (2) รีวิวคอร์ส — เฉพาะคนที่เรียนจบแล้ว (online_students.completed_at) 1 คน 1 รีวิว แก้ไขได้
--     แสดงบนหน้าแรกเฉพาะที่แอดมินอนุมัติแล้ว (แก้รีวิว = กลับไปรออนุมัติใหม่)
-- ตารางเปิด RLS ไม่มี policy (default-deny) — anon ผ่าน RPC SECURITY DEFINER ด้านล่างเท่านั้น, แอดมินผ่าน admin-api

-- ==================== (1) TAX INVOICE REQUESTS ====================
create table if not exists public.tax_invoice_requests (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid,
  stripe_session_id text,
  buyer_type text not null default 'company' check (buyer_type in ('company', 'person')),
  name text not null,
  tax_id text not null check (tax_id ~ '^[0-9]{13}$'),
  branch text,
  address text not null,
  email text,
  phone text not null,
  amount numeric,
  modules text,
  status text not null default 'รอออก' check (status in ('รอออก', 'ออกแล้ว', 'ยกเลิก')),
  invoice_no text,
  admin_note text,
  created_at timestamptz not null default now(),
  issued_at timestamptz
);
create index if not exists tax_invoice_requests_status_idx on public.tax_invoice_requests(status, created_at desc);
alter table public.tax_invoice_requests enable row level security;

-- เลขประจำตัวผู้เสียภาษี 13 หลัก + ตรวจ check digit (สูตรเดียวกับเลขบัตรประชาชน)
create or replace function public.thai_tax_id_valid(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare s int := 0; i int;
begin
  if p is null or p !~ '^[0-9]{13}$' then return false; end if;
  for i in 1..12 loop s := s + substr(p, i, 1)::int * (14 - i); end loop;
  return (11 - s % 11) % 10 = substr(p, 13, 1)::int;
end $$;

-- p: { phone, name, taxId, branch, address, email, buyerType, purchaseId?, stripeSessionId? }
-- อ้างอิงการซื้อ (ถ้ามี) ต้องเป็นของเบอร์เดียวกันและชำระแล้ว → ดึงยอด/บทเรียนจากฝั่ง server
-- จำกัด 5 คำขอ/เบอร์/วัน กันสแปม คืน { id } หรือ { error }
create or replace function public.request_tax_invoice(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g');
  v_tax text := regexp_replace(coalesce(p->>'taxId', ''), '\D', '', 'g');
  v_name text := left(trim(coalesce(p->>'name', '')), 200);
  v_addr text := left(trim(coalesce(p->>'address', '')), 500);
  v_pur public.online_purchases;
  v_id uuid;
begin
  if length(v_phone) < 9 then return jsonb_build_object('error', 'กรุณากรอกเบอร์โทรที่ใช้ตอนซื้อ'); end if;
  if length(v_name) < 2 then return jsonb_build_object('error', 'กรุณากรอกชื่อบริษัท/ชื่อผู้เสียภาษี'); end if;
  if not public.thai_tax_id_valid(v_tax) then return jsonb_build_object('error', 'เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (13 หลัก)'); end if;
  if length(v_addr) < 10 then return jsonb_build_object('error', 'กรุณากรอกที่อยู่ตามทะเบียนให้ครบ'); end if;
  if (select count(*) from public.tax_invoice_requests t
       where right(t.phone, 9) = right(v_phone, 9) and t.created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('error', 'ส่งคำขอครบจำนวนต่อวันแล้ว กรุณาติดต่อ LINE @jiacpr');
  end if;

  if nullif(p->>'stripeSessionId', '') is not null then
    select * into v_pur from public.online_purchases where stripe_session_id = p->>'stripeSessionId';
  elsif nullif(p->>'purchaseId', '') is not null and (p->>'purchaseId') ~ '^[0-9a-f-]{36}$' then
    select * into v_pur from public.online_purchases where id = (p->>'purchaseId')::uuid;
  end if;
  if v_pur.id is not null and (right(regexp_replace(coalesce(v_pur.phone, ''), '\D', '', 'g'), 9) <> right(v_phone, 9)
                               or v_pur.payment_status <> 'ชำระแล้ว') then
    v_pur := null; -- อ้างอิงไม่ตรงเบอร์/ยังไม่ชำระ → เก็บคำขอไว้ให้แอดมินตรวจเอง ไม่ผูกยอด
  end if;

  insert into public.tax_invoice_requests(purchase_id, stripe_session_id, buyer_type, name, tax_id, branch, address, email, phone, amount, modules)
  values (v_pur.id, v_pur.stripe_session_id,
          case when p->>'buyerType' = 'person' then 'person' else 'company' end,
          v_name, v_tax, left(nullif(trim(coalesce(p->>'branch', '')), ''), 100), v_addr,
          left(nullif(trim(coalesce(p->>'email', '')), ''), 200), v_phone, v_pur.amount, v_pur.modules)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'linked', v_pur.id is not null);
end
$$;

-- ==================== (2) COURSE REVIEWS ====================
create table if not exists public.course_reviews (
  id bigint generated always as identity primary key,
  customer_id text not null unique references public.customers(id) on delete cascade,
  display_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_reviews_public_idx on public.course_reviews(approved, created_at desc);
alter table public.course_reviews enable row level security;

-- ส่ง/แก้รีวิว — ยืนยัน customer_id + เบอร์ และต้องเรียนจบแล้ว; ชื่อที่แสดง = ชื่อ + อักษรแรกของนามสกุล
create or replace function public.submit_course_review(p_customer_id text, p_phone text, p_rating int, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text; v_parts text[]; v_display text;
begin
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('error', 'กรุณาให้คะแนน 1-5 ดาว'); end if;
  select c.name into v_name from public.customers c
   where c.id = p_customer_id
     and right(regexp_replace(coalesce(c.tel, ''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
     and length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 9;
  if v_name is null then return jsonb_build_object('error', 'ไม่พบข้อมูลผู้เรียน'); end if;
  if not exists (select 1 from public.online_students s where s.customer_id = p_customer_id and s.completed_at is not null) then
    return jsonb_build_object('error', 'รีวิวได้หลังเรียนจบคอร์สแล้ว');
  end if;
  v_parts := regexp_split_to_array(trim(v_name), '\s+');
  v_display := left(v_parts[1], 40) || case when array_length(v_parts, 1) > 1 then ' ' || left(v_parts[2], 1) || '.' else '' end;
  insert into public.course_reviews(customer_id, display_name, rating, comment)
  values (p_customer_id, v_display, p_rating, left(nullif(trim(coalesce(p_comment, '')), ''), 600))
  on conflict (customer_id) do update
    set rating = excluded.rating, comment = excluded.comment, display_name = excluded.display_name,
        approved = false, updated_at = now();
  return jsonb_build_object('ok', true);
end
$$;

-- รีวิวที่อนุมัติแล้วสำหรับหน้าแรก + ค่าเฉลี่ย (ไม่มี customer_id/ข้อมูลติดต่อ)
create or replace function public.public_course_reviews(p_limit int default 12)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'count', (select count(*) from public.course_reviews where approved),
    'avg', (select round(avg(rating)::numeric, 1) from public.course_reviews where approved),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('name', r.display_name, 'rating', r.rating, 'comment', r.comment, 'at', r.created_at))
                         from (select * from public.course_reviews where approved and comment is not null
                               order by rating desc, created_at desc limit least(greatest(coalesce(p_limit, 12), 1), 50)) r), '[]'::jsonb)
  )
$$;

revoke all on function public.thai_tax_id_valid(text) from public;
revoke all on function public.request_tax_invoice(jsonb) from public;
revoke all on function public.submit_course_review(text, text, int, text) from public;
revoke all on function public.public_course_reviews(int) from public;
grant execute on function public.thai_tax_id_valid(text) to anon, authenticated, service_role;
grant execute on function public.request_tax_invoice(jsonb) to anon, authenticated, service_role;
grant execute on function public.submit_course_review(text, text, int, text) to anon, authenticated, service_role;
grant execute on function public.public_course_reviews(int) to anon, authenticated, service_role;
