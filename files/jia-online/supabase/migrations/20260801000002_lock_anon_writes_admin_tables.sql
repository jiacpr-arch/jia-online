-- ปิดสิทธิ์เขียนของ anon — apply แล้วบน remote (2026-08-01) เฉพาะส่วนที่พิสูจน์จาก
-- pg_stat_statements แล้วว่าไม่มีแอปไหนบน DB ร่วม (jia-unified) ใช้:
--   - settings:    ไม่เคยมี INSERT/UPDATE/DELETE เลย (pg_stat_user_tables = 0 ทั้งหมด)
--   - promo_codes: มีแต่ INSERT (ออกคูปองจากแอป) — ไม่เคยมี UPDATE/DELETE เลย
--
-- ⚠️ ยังไม่แตะ users/staff ตามแผนเดิม: ตรวจ statement cache แล้วพบว่าแอปเดิม (jiacpr.com)
-- ยังใช้ anon เขียนอยู่จริง — `UPDATE public.users SET last_login` (54 calls) และ
-- `INSERT INTO public.staff (id, name)` (7 calls) — ถ้าปิดตอนนี้ login/จัดการ staff
-- ของแอปนั้นพัง ต้องย้าย flow เหล่านั้นไป server-side (แบบ admin-api) ก่อน แล้วค่อยรัน:
--   drop policy if exists anon_insert on public.users;
--   drop policy if exists anon_update on public.users;
--   revoke insert, update, delete on public.users from anon;
--   drop policy if exists anon_insert on public.staff;
--   drop policy if exists anon_update on public.staff;
--   drop policy if exists anon_delete on public.staff;
--   revoke insert, update, delete on public.staff from anon;

drop policy if exists anon_insert on public.settings;
drop policy if exists anon_update on public.settings;
revoke insert, update, delete on public.settings from anon;

drop policy if exists anon_update on public.promo_codes;
drop policy if exists anon_delete on public.promo_codes;
revoke update, delete on public.promo_codes from anon;
