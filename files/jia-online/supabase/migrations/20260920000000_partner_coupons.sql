-- คูปองพาร์ทเนอร์ (QR ใบละ 1 สิทธิ์): ธุรกิจพันธมิตร (เช่น ออฟฟิศอ้อมน้อย) แจกคูปองกระดาษให้ลูกค้าของเขา
-- สแกน QR → ?promo=<CODE> → กรอกชื่อ+เบอร์ → ปลดคอร์สออนไลน์ครบทุกบทฟรี (มูลค่า ฿149)
-- หลังใช้/เรียนจบ หน้าเว็บโชว์ LINE + เบอร์โทรของ "พาร์ทเนอร์ผู้มอบคูปอง" ให้ลูกค้าติดต่อกลับ
--
-- ต่อยอด lead_promo_codes เดิม (ไม่สร้างตารางใหม่ → admin-api ไม่ต้อง deploy ซ้ำ):
--   source = 'partner_coupon', multi_use = false, unlock_modules = {1..7},
--   phone placeholder 'coupon:<CODE>' (ผ่าน partial unique index เหมือน 'standing:<CODE>')
--   company = ชื่อพาร์ทเนอร์ (สืบทอดไป online_students.company → รายงานคะแนนรายบริษัทใช้ได้เลย)
--   sponsor_line / sponsor_phone / sponsor_value = ช่องทางติดต่อ + มูลค่าที่โชว์ (แอดมินกรอกเอง แก้ทีหลังได้)
--
-- Apply via Supabase MCP `apply_migration` or `supabase db push`

alter table public.lead_promo_codes
  add column if not exists sponsor_line  text,   -- LINE ID (@oa หรือ id ส่วนตัว) หรือลิงก์เต็ม
  add column if not exists sponsor_phone text,
  add column if not exists sponsor_value int;    -- มูลค่าที่โชว์บนคูปอง/หน้าเว็บ (฿149)

create index if not exists idx_lead_promo_partner
  on public.lead_promo_codes (company, created_at desc)
  where source = 'partner_coupon';

-- ========== RPC: อ่านข้อมูลพาร์ทเนอร์ของคูปอง (ไม่มี PII) ==========
-- ให้หน้า redeem โชว์แบนเนอร์ "คูปองเรียนฟรีจาก … มูลค่า ฿…" ก่อนกรอกชื่อ
-- คืนเฉพาะแถว source='partner_coupon' — โค้ดชนิดอื่นได้ 0 แถว (กันใช้ enumerate โค้ด lead/voucher)
create or replace function public.get_partner_coupon(p_code text)
returns table (
  status text, company text, sponsor_line text, sponsor_phone text,
  sponsor_value int, expires_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select case
           when l.redeemed_at is not null then 'redeemed'
           when l.expires_at <= now()     then 'expired'
           else 'valid' end,
         l.company, l.sponsor_line, l.sponsor_phone, l.sponsor_value, l.expires_at
  from public.lead_promo_codes l
  where l.code = upper(trim(p_code)) and l.source = 'partner_coupon'
  limit 1;
$$;
revoke all on function public.get_partner_coupon(text) from public;
grant execute on function public.get_partner_coupon(text) to anon;

-- ========== redeem_lead_code: คืน sponsor_* เพิ่มท้ายสุด ==========
-- เปลี่ยน return type ต้อง drop แล้วสร้างใหม่ (สิทธิ์เดิมหาย → revoke/grant ซ้ำท้ายไฟล์)
-- body เดิมทุกบรรทัดจาก 20260719000000_pre_course_no_coupon.sql + 3 คอลัมน์ใหม่
drop function if exists public.redeem_lead_code(text, text, text);

create function public.redeem_lead_code(p_code text, p_name text, p_phone text)
returns table (
  status text, unlock_modules int[], company text,
  expires_at timestamptz, multi_use boolean, redeemed_at timestamptz, source text,
  sponsor_line text, sponsor_phone text, sponsor_value int
)
language plpgsql security definer set search_path = public
as $$
declare r public.lead_promo_codes%rowtype;
begin
  select * into r from public.lead_promo_codes where lead_promo_codes.code = p_code limit 1;
  if not found then
    return query select 'not_found'::text, null::int[], null::text, null::timestamptz, null::boolean, null::timestamptz, null::text, null::text, null::text, null::int;
    return;
  end if;
  if r.expires_at <= now() then
    return query select 'expired'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text, null::text, null::text, null::int;
    return;
  end if;
  if not r.multi_use then
    if r.redeemed_at is not null then
      return query select 'already'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text, null::text, null::text, null::int;
      return;
    end if;
    update public.lead_promo_codes
      set redeemed_at = now(), redeemed_phone = p_phone, name = p_name
      where lead_promo_codes.code = p_code and lead_promo_codes.redeemed_at is null;
    if not found then
      return query select 'race'::text, null::int[], null::text, r.expires_at, r.multi_use, r.redeemed_at, null::text, null::text, null::text, null::int;
      return;
    end if;
  end if;
  return query select 'ok'::text, r.unlock_modules, r.company, r.expires_at, r.multi_use, r.redeemed_at, r.source,
                      r.sponsor_line, r.sponsor_phone, r.sponsor_value;
end;
$$;

revoke all on function public.redeem_lead_code(text, text, text) from public;
grant execute on function public.redeem_lead_code(text, text, text) to anon;
