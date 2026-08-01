-- ปิดสิทธิ์เขียนของ anon บนตารางที่ "ไม่มีเหตุผลทางธุรกิจ" ให้ผู้ใช้ทั่วไป (anon key ฝังใน
-- บันเดิลเว็บ) แก้ไขได้ — จาก Supabase advisor (rls_policy_always_true, เช็คสถานะจริง 2026-08-01):
--   - staff:       anon INSERT/UPDATE/DELETE ได้ → ใครก็เพิ่ม/แก้/ลบข้อมูลพนักงานได้
--   - settings:    anon INSERT/UPDATE ได้        → ใครก็แก้ค่าตั้งระบบได้
--   - users:       anon INSERT/UPDATE ได้        → ใครก็สร้าง/แก้บัญชีแอดมินได้ (SELECT ถูกจำกัด
--                  คอลัมน์ไปแล้วใน 20260703000001 — password_hash ปิดจาก anon แล้ว)
--   - promo_codes: anon UPDATE/DELETE ได้        → ใครก็แก้ส่วนลด/ลบคูปองคนอื่นได้
--                  (คง INSERT+SELECT ไว้ — flow ออกคูปองตอนสมัคร/จบคอร์ส/ชนะเกม ยัง INSERT
--                  จาก client ตรง และหน้าจองอ่านคูปองเพื่อ validate; ย้ายไป server-side ค่อยปิดต่อ)
--
-- หน้า admin ของแอปนี้เขียนตารางเหล่านี้ผ่าน admin-api (service_role) แล้ว — ไม่กระทบ
-- ⚠️ DB นี้ใช้ร่วมหลายแอป — ก่อน apply ให้ตรวจว่าไม่มีแอปอื่นเขียนตารางเหล่านี้ด้วย anon key
--    (แอป jia-online ตรวจแล้ว: ไม่มี write จาก client เหลืออยู่)

-- staff: เหลือแค่ SELECT (ถ้าไม่มีแอปไหนอ่านด้วย anon ค่อยปิด SELECT เพิ่มภายหลัง)
drop policy if exists anon_insert on public.staff;
drop policy if exists anon_update on public.staff;
drop policy if exists anon_delete on public.staff;
revoke insert, update, delete on public.staff from anon;

-- settings: เหลือแค่ SELECT
drop policy if exists anon_insert on public.settings;
drop policy if exists anon_update on public.settings;
revoke insert, update, delete on public.settings from anon;

-- users: เหลือแค่ SELECT แบบจำกัดคอลัมน์ (ตาม 20260703000001)
drop policy if exists anon_insert on public.users;
drop policy if exists anon_update on public.users;
revoke insert, update, delete on public.users from anon;

-- promo_codes: ปิดเฉพาะ UPDATE/DELETE (INSERT/SELECT ยังใช้โดย flow ออก/ตรวจคูปองฝั่ง client)
drop policy if exists anon_update on public.promo_codes;
drop policy if exists anon_delete on public.promo_codes;
revoke update, delete on public.promo_codes from anon;
