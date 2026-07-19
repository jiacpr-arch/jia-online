-- นักเรียน pre-course (จ่ายค่าคอร์ส on-site เต็มราคาแล้ว) ต้องไม่ได้รับคูปองส่วนลด ฿100
-- ปัญหา: ส่งโค้ด (JIA-STUDENT / VCH- แบบ pre_course) ให้นักเรียนที่จ่ายเงินแล้วมาเรียน
-- ออนไลน์ก่อนเข้าคลาสจริง แต่ใบประกาศ/หน้าจอ/ข้อความ LINE โชว์ "ส่วนลด ฿100 คอร์ส On-site"
-- เหมือน lead ทั่วไป → นักเรียนเข้าใจว่ายังมีส่วนลดค้างอยู่ และมาขอเงินคืน ฿100
--
-- แก้ฝั่ง DB สองจุด:
--  1) redeem_lead_code คืนค่า source ของโค้ดด้วย เพื่อให้ frontend รู้ว่าเป็นโค้ด pre_course
--     แล้วไม่ออก/ไม่แสดงคูปอง ฿100 (ฝั่ง UI แก้ใน App.jsx)
--  2) online_students.pre_course สำหรับให้ customer-followup-drip ข้ามข้อความขายคอร์ส
--     on-site + คูปอง (คนกลุ่มนี้จ่ายและจองแล้ว)

alter table public.online_students
  add column if not exists pre_course boolean not null default false;

-- เพิ่มคอลัมน์ที่คืนไม่ได้ด้วย create or replace — ต้อง drop แล้วสร้างใหม่
-- (drop แล้วสิทธิ์เดิมหาย ต้อง revoke/grant ซ้ำท้ายไฟล์)
drop function if exists public.redeem_lead_code(text, text, text);

create function public.redeem_lead_code(p_code text, p_name text, p_phone text)
returns table (
  status text, unlock_modules int[], company text,
  expires_at timestamptz, multi_use boolean, redeemed_at timestamptz, source text
)
language plpgsql security definer set search_path = public
as $$
declare r public.lead_promo_codes%rowtype;
begin
  select * into r from public.lead_promo_codes where lead_promo_codes.code = p_code limit 1;
  if not found then
    return query select 'not_found'::text, null::int[], null::text, null::timestamptz, null::boolean, null::timestamptz, null::text;
    return;
  end if;
  if r.expires_at <= now() then
    return query select 'expired'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text;
    return;
  end if;
  if not r.multi_use then
    if r.redeemed_at is not null then
      return query select 'already'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text;
      return;
    end if;
    update public.lead_promo_codes
      set redeemed_at = now(), redeemed_phone = p_phone, name = p_name
      where lead_promo_codes.code = p_code and lead_promo_codes.redeemed_at is null;
    if not found then
      return query select 'race'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text;
      return;
    end if;
  end if;
  return query select 'ok'::text, r.unlock_modules, r.company, r.expires_at, r.multi_use, r.redeemed_at, r.source;
end;
$$;

revoke all on function public.redeem_lead_code(text, text, text) from public;
grant execute on function public.redeem_lead_code(text, text, text) to anon;
