-- Lead promo PII lockdown + redeem hardening (jia-online)
-- แก้ 2 เรื่องจากรีวิวความปลอดภัย:
--
--  A1) PII รั่ว: policy anon SELECT บน lead_promo_codes / lead_capture_events เดิมเป็น
--      `using (true)` → ใครมี anon key (ฝังใน bundle) ยิง GET ...?select=* ดูดชื่อ/เบอร์/
--      อีเมล/โค้ดของทุก lead ได้ทั้งตาราง (RLS ระดับแถวกันการ enumerate ไม่ได้ตราบใดที่ยัง
--      using(true)) — และ anon INSERT `with check(true)` ยัง self-issue โค้ดที่ตั้ง
--      unlock_modules เต็มคอร์สเองได้
--
--  A2) Regression: migration 20260704000000_standing_student_promo.sql สร้าง policy
--      lead_promo_anon_redeem ใหม่โดย "ตัดเงื่อนไข expires_at > now()" ที่
--      20260703000000_lead_promo_hardening.sql เพิ่งเพิ่มไว้ → โค้ดหมดอายุถูก redeem ผ่าน
--      API ได้อีก และ drop การจำกัดคอลัมน์ UPDATE ทำให้ anon เขียนทับคอลัมน์อื่นได้
--
-- วิธีแก้: ย้ายการเข้าถึง lead_promo_codes ทั้งหมด (อ่านโดยโค้ด, dedup, สร้าง, redeem) ไปที่
-- SECURITY DEFINER RPC แล้วปิด anon SELECT/INSERT/UPDATE ตรงบนตาราง — โดย RPC บังคับ
-- unlock_modules ฝั่ง server และเช็ค expiry/atomic redeem ฝั่ง server (แก้ทั้ง A1 และ A2)
--
-- ตารางนี้เป็นของแอป jia-online โดยเฉพาะ ปรับได้ปลอดภัย
-- Apply via Supabase MCP `apply_migration` or `supabase db push` — ทดสอบบน branch ก่อน prod

-- ========== RPC: อ่านโค้ดด้วย code เป๊ะ (หน้า redeem) ==========
create or replace function public.lookup_lead_code(p_code text)
returns table (
  code text, expires_at timestamptz, redeemed_at timestamptz,
  name text, unlock_modules int[], company text, multi_use boolean
)
language sql security definer set search_path = public stable
as $$
  select l.code, l.expires_at, l.redeemed_at, l.name, l.unlock_modules, l.company, l.multi_use
  from public.lead_promo_codes l
  where l.code = p_code
  limit 1;
$$;

-- ========== RPC: dedup ด้วยอีเมล/เบอร์ เป๊ะ (pre-check ตอน claim) ==========
create or replace function public.find_lead_promo_by_contact(p_email text, p_phone text)
returns table (
  code text, expires_at timestamptz, redeemed_at timestamptz,
  name text, unlock_modules int[]
)
language sql security definer set search_path = public stable
as $$
  select l.code, l.expires_at, l.redeemed_at, l.name, l.unlock_modules
  from public.lead_promo_codes l
  where not l.multi_use
    and (
      (p_email is not null and p_email <> '' and lower(l.email) = lower(p_email))
      or (p_phone is not null and p_phone <> '' and l.phone = p_phone)
    )
  order by l.created_at desc
  limit 1;
$$;

-- ========== RPC: สร้างโค้ด lead ใหม่ (บังคับ unlock_modules ฝั่ง server) ==========
-- คืนแถวที่สร้าง; ถ้าชน unique (เบอร์/อีเมล/code/idempotency) จะคืนว่าง → client re-check
create or replace function public.claim_lead_code(
  p_code text, p_email text, p_phone text, p_name text,
  p_line_id text, p_source text, p_source_other text,
  p_expires_at timestamptz, p_idempotency_key text, p_customer_id text
)
returns table (
  code text, expires_at timestamptz, redeemed_at timestamptz,
  unlock_modules int[], name text
)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  insert into public.lead_promo_codes
    (code, email, phone, name, line_id, source, source_other,
     unlock_modules, created_at, expires_at, idempotency_key, customer_id,
     email_sent_status, multi_use)
  values
    (p_code, p_email, p_phone, p_name, p_line_id, p_source, p_source_other,
     '{1,2,3}'::int[], now(), p_expires_at, p_idempotency_key, p_customer_id,
     'pending', false)
  on conflict do nothing
  returning lead_promo_codes.code, lead_promo_codes.expires_at,
            lead_promo_codes.redeemed_at, lead_promo_codes.unlock_modules,
            lead_promo_codes.name;
end;
$$;

-- ========== RPC: redeem โค้ด (atomic + เช็ค expiry ฝั่ง server = แก้ A2) ==========
-- status: 'ok' | 'not_found' | 'expired' | 'already' | 'race'
-- โค้ดกลาง (multi_use) ไม่ mark redeemed_at (ใช้ซ้ำได้) — ติดตามรายคนผ่าน lead_capture_events
create or replace function public.redeem_lead_code(p_code text, p_name text, p_phone text)
returns table (
  status text, unlock_modules int[], company text,
  expires_at timestamptz, multi_use boolean, redeemed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare r public.lead_promo_codes%rowtype;
begin
  select * into r from public.lead_promo_codes where code = p_code limit 1;
  if not found then
    return query select 'not_found'::text, null::int[], null::text, null::timestamptz, null::boolean, null::timestamptz;
    return;
  end if;
  if r.expires_at <= now() then
    return query select 'expired'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at;
    return;
  end if;
  if not r.multi_use then
    if r.redeemed_at is not null then
      return query select 'already'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at;
      return;
    end if;
    update public.lead_promo_codes
      set redeemed_at = now(), redeemed_phone = p_phone, name = p_name
      where code = p_code and redeemed_at is null;
    if not found then
      return query select 'race'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at;
      return;
    end if;
  end if;
  return query select 'ok'::text, r.unlock_modules, r.company, r.expires_at, r.multi_use, r.redeemed_at;
end;
$$;

-- ========== สิทธิ์: เปิดเฉพาะ RPC ให้ anon เรียก ==========
revoke all on function public.lookup_lead_code(text) from public;
revoke all on function public.find_lead_promo_by_contact(text, text) from public;
revoke all on function public.claim_lead_code(text, text, text, text, text, text, text, timestamptz, text, text) from public;
revoke all on function public.redeem_lead_code(text, text, text) from public;
grant execute on function public.lookup_lead_code(text) to anon;
grant execute on function public.find_lead_promo_by_contact(text, text) to anon;
grant execute on function public.claim_lead_code(text, text, text, text, text, text, text, timestamptz, text, text) to anon;
grant execute on function public.redeem_lead_code(text, text, text) to anon;

-- ========== ปิดการเข้าถึงตรงบนตาราง lead_promo_codes สำหรับ anon ==========
-- ทุกอย่างต้องผ่าน RPC ข้างบนเท่านั้น (กัน select=* dump PII และ self-issue โค้ด)
drop policy if exists lead_promo_anon_select on public.lead_promo_codes;
drop policy if exists lead_promo_anon_insert on public.lead_promo_codes;
drop policy if exists lead_promo_anon_redeem on public.lead_promo_codes;
revoke select, insert, update, delete on public.lead_promo_codes from anon;

-- ========== lead_capture_events: คง INSERT (analytics) ปิด SELECT ==========
drop policy if exists lead_events_anon_select on public.lead_capture_events;
revoke select on public.lead_capture_events from anon;
-- lead_events_anon_insert (with check true) ยังคงอยู่สำหรับบันทึก event ฝั่ง client
