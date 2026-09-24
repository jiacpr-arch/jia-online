-- Unified identity Phase 5: server-side final-exam integrity for jia-online.
--
-- grade-quiz now requires a real Supabase access token (verified via auth.getUser) for the final
-- exam module and records every attempt here. Combined with the Edge Function no longer returning
-- the correct-answer set for that module at all, a rate limit checked against this table is what
-- stops someone from hammering the endpoint to brute-force a pass by pure guessing (the endpoint
-- used to accept any subset of questions with no auth at all, and always echoed back the correct
-- answer for whatever was submitted — see supabase/functions/grade-quiz/index.ts).
--
-- RLS is enabled with no policies at all: default-deny for anon/authenticated, only the service
-- role (grade-quiz itself) can read or write here, matching public.course_progress's own pattern
-- in 20260620000000_auth_gate.sql.
create table public.online_exam_attempts(
  id bigint generated always as identity primary key,
  auth_user_id uuid not null,
  module_id int not null,
  score int not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index online_exam_attempts_rate_limit_idx on public.online_exam_attempts(auth_user_id, module_id, created_at desc);
alter table public.online_exam_attempts enable row level security;
