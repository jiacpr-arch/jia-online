-- ด่านบังคับสมัคร/ล็อกอินหลังจบบทที่ 1 (LINE LIFF + Google + Email OTP)
--
-- เพิ่มข้อมูลตัวตน (auth provider / oauth sub / supabase auth_user_id) + UTM ลง customers
-- และตาราง course_progress สำหรับเก็บความคืบหน้าผูกกับบัญชี (เรียนต่อข้ามเครื่อง)
--
-- หมายเหตุความปลอดภัย: ปัจจุบัน role anon มีสิทธิ์ REST กว้างบน customers/online_students
-- (ทั้งแอปเขียนผ่าน anon key) ซึ่งเป็นความเสี่ยง "เดิม" — migration นี้ "ไม่ขยาย" สิทธิ์นั้น
-- และตั้ง course_progress ให้ "ไม่มี anon policy" คือเขียน/อ่านได้เฉพาะผ่าน edge function
-- (service_role) ที่ยืนยันตัวตนแล้วเท่านั้น เพื่อกันการปลอม progress ของผู้อื่น

-- ===== 1) customers: คอลัมน์ตัวตน + PDPA + UTM =====
alter table public.customers
  add column if not exists auth_provider   text,            -- 'line' | 'google' | 'email'
  add column if not exists auth_user_id    uuid,            -- supabase auth.users.id (google/email)
  add column if not exists oauth_sub       text,            -- LINE userId หรือ google sub
  add column if not exists display_name    text,            -- ชื่อจาก provider
  add column if not exists pdpa_consent_at timestamptz,
  add column if not exists signup_at       timestamptz,
  add column if not exists gate_variant    text,            -- before-course | after-lesson-1 | soft
  add column if not exists utm_source      text,
  add column if not exists utm_medium      text,
  add column if not exists utm_campaign    text,
  add column if not exists utm_content     text,
  add column if not exists utm_term        text,
  add column if not exists landing_url     text;

-- partial unique index = แกนกันบัญชีซ้ำ (ใช้กับ upsert on conflict ใน edge function)
create unique index if not exists customers_line_user_id_uidx
  on public.customers (line_user_id) where line_user_id is not null;
create unique index if not exists customers_auth_user_id_uidx
  on public.customers (auth_user_id) where auth_user_id is not null;

-- ===== 2) course_progress: ความคืบหน้าผูกบัญชี (cross-device) =====
create table if not exists public.course_progress (
  id           bigint generated always as identity primary key,
  customer_id  text,
  auth_user_id uuid,
  line_user_id text,
  done         int[]       not null default '{}',
  scores       jsonb       not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (customer_id)
);
create index if not exists course_progress_line_uidx on public.course_progress(line_user_id);
create index if not exists course_progress_auth_uidx on public.course_progress(auth_user_id);

alter table public.course_progress enable row level security;
-- ไม่มี policy สำหรับ anon => default deny: client เขียน/อ่านตรงไม่ได้ ต้องผ่าน edge (service_role)
-- ผู้ใช้ Google/email ที่มี Supabase JWT อ่านแถวตัวเองได้
drop policy if exists course_progress_owner_read on public.course_progress;
create policy course_progress_owner_read on public.course_progress
  for select to authenticated using (auth.uid() = auth_user_id);
