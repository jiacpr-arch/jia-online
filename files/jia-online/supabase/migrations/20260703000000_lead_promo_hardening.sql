-- Security hardening for lead_promo_codes (jia-online owned table)
-- แก้ 3 เรื่องที่พบจากรีวิวความปลอดภัย:
--   1) idx_lead_promo_email ยังเป็น unique เข้มทั้งตาราง (ไม่ partial) — ลูกค้าเก่าที่เคย
--      redeem โค้ด lead-capture แล้ว ออก voucher เต็มคอร์สด้วยอีเมลเดิมไม่ได้ (bug)
--   2) การ redeem (UPDATE โดย anon) เดิมแก้คอลัมน์ไหนก็ได้ ขอแค่ตั้ง redeemed_at — ผู้ใช้
--      สามารถเขียนทับ unlock_modules/email/phone ของโค้ดที่ยังไม่ redeem ได้
--   3) redeem policy ไม่เคยเช็ค expires_at ฝั่ง server — โค้ดหมดอายุยัง redeem ได้ถ้า bypass client
--
-- ตารางนี้เป็นของแอป jia-online โดยเฉพาะ (ไม่ใช่ตารางที่ใช้ร่วมกับแอปอื่น) จึงปรับได้ปลอดภัย
-- Apply via Supabase MCP `apply_migration` or `supabase db push` once reviewed.

-- 1) email index → partial (กันซ้ำเฉพาะโค้ดที่ยังไม่ redeem) ให้สอดคล้องกับ idx_lead_promo_phone_active
drop index if exists public.idx_lead_promo_email;
create unique index if not exists idx_lead_promo_email_active
  on public.lead_promo_codes (lower(email))
  where redeemed_at is null and email is not null and email <> '';

-- 2) + 3) redeem policy: เพิ่มเงื่อนไข "ยังไม่หมดอายุ" ใน USING
drop policy if exists lead_promo_anon_redeem on public.lead_promo_codes;
create policy lead_promo_anon_redeem on public.lead_promo_codes
  for update to anon
  using (redeemed_at is null and expires_at > now())
  with check (redeemed_at is not null);

-- 2) จำกัดคอลัมน์ที่ anon แก้ได้ตอน redeem ให้เหลือเฉพาะที่ flow ใช้จริง
--    (redeemed_at, redeemed_phone, name) — บล็อกการเขียนทับ unlock_modules / email / phone / company ฯลฯ
revoke update on public.lead_promo_codes from anon;
grant update (redeemed_at, redeemed_phone, name) on public.lead_promo_codes to anon;
