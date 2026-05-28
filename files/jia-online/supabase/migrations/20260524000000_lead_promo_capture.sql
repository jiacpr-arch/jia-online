-- Lead Capture + Promo Code Unlock
-- Phase 0: schema for capturing leads in exchange for promo codes that unlock
-- bundle 3 modules (Module 1, 2, 3) of the JIA Online CPR course.
--
-- Not reusing the existing `promo_codes` table — that one is for on-site
-- discount coupons issued AFTER course completion (different semantics).
--
-- Apply via Supabase MCP `apply_migration` or `supabase db push` once reviewed.

create table if not exists public.lead_promo_codes (
  code              text primary key,
  email             text not null,
  phone             text not null,
  name              text not null,
  line_id           text,
  source            text not null,
  source_other      text,
  unlock_modules    int[] not null default '{1,2,3}',
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  redeemed_at       timestamptz,
  redeemed_phone    text,
  email_sent_at     timestamptz,
  email_sent_status text default 'pending',
  idempotency_key   text unique,
  customer_id       text
);

create unique index if not exists idx_lead_promo_email
  on public.lead_promo_codes (lower(email))
  where email is not null and email <> '';

create unique index if not exists idx_lead_promo_phone
  on public.lead_promo_codes (phone);

create index if not exists idx_lead_promo_expires
  on public.lead_promo_codes (expires_at)
  where redeemed_at is null;

create index if not exists idx_lead_promo_source
  on public.lead_promo_codes (source);

create index if not exists idx_lead_promo_created
  on public.lead_promo_codes (created_at desc);

create table if not exists public.lead_capture_events (
  id          bigserial primary key,
  code        text references public.lead_promo_codes(code) on delete cascade,
  event_type  text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_lead_capture_events_code
  on public.lead_capture_events (code);

create index if not exists idx_lead_capture_events_created
  on public.lead_capture_events (created_at desc);

-- Row level security
alter table public.lead_promo_codes  enable row level security;
alter table public.lead_capture_events enable row level security;

-- anon can create new claims and read them by code (needed for redeem flow
-- and for duplicate pre-check). UPDATE is constrained to the redeem
-- transition only (redeemed_at: null -> not null).
drop policy if exists lead_promo_anon_insert  on public.lead_promo_codes;
drop policy if exists lead_promo_anon_select  on public.lead_promo_codes;
drop policy if exists lead_promo_anon_redeem  on public.lead_promo_codes;

create policy lead_promo_anon_insert on public.lead_promo_codes
  for insert to anon
  with check (true);

create policy lead_promo_anon_select on public.lead_promo_codes
  for select to anon
  using (true);

create policy lead_promo_anon_redeem on public.lead_promo_codes
  for update to anon
  using (redeemed_at is null)
  with check (redeemed_at is not null);

drop policy if exists lead_events_anon_insert on public.lead_capture_events;
drop policy if exists lead_events_anon_select on public.lead_capture_events;

create policy lead_events_anon_insert on public.lead_capture_events
  for insert to anon
  with check (true);

create policy lead_events_anon_select on public.lead_capture_events
  for select to anon
  using (true);
