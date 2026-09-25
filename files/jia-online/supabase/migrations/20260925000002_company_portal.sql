-- พอร์ทัล HR (B2B): ลิงก์ลับ cpr.morroo.com/org/<token> ให้ฝ่าย HR ของบริษัทดูความคืบหน้าพนักงานเองได้
-- โดยไม่ต้องขอรายงานจากแอดมินทุกครั้ง แอดมินสร้าง/เพิกถอนลิงก์ในแท็บ "รายงานคะแนน (บริษัท)"
-- token สุ่ม 32 ตัวอักษร (เดาไม่ได้) — ตารางเปิด RLS ไม่มี policy, anon เข้าผ่าน RPC company_portal เท่านั้น
-- ข้อมูลที่คืน: ชื่อ, เบอร์แบบปิดบัง (เห็น 4 ตัวท้าย), สถานะ, คะแนนรายบท/ปลายภาค, วันที่ — ไม่มีอีเมล/เบอร์เต็ม

create table if not exists public.company_portal_links (
  token text primary key check (length(token) >= 24),
  company text not null,
  label text,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count int not null default 0
);
create index if not exists company_portal_links_company_idx on public.company_portal_links(company);
alter table public.company_portal_links enable row level security;

create or replace function public.company_portal(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link public.company_portal_links;
begin
  select * into v_link from public.company_portal_links
   where token = p_token and revoked_at is null and (expires_at is null or expires_at > now());
  if v_link.token is null then return null; end if;

  update public.company_portal_links
     set last_viewed_at = now(), view_count = view_count + 1
   where token = v_link.token;

  return jsonb_build_object(
    'company', v_link.company,
    'label', v_link.label,
    'expiresAt', v_link.expires_at,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', s.name,
        'phone', case when length(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g')) >= 4
                      then 'xxx-xxx-' || right(regexp_replace(s.phone, '\D', '', 'g'), 4) else '' end,
        'status', s.status,
        'finalScore', s.final_score,
        'chapterScores', coalesce(s.chapter_scores, '{}'::jsonb),
        'registeredAt', s.registered_at,
        'completedAt', s.completed_at
      ) order by s.registered_at desc nulls last)
      from public.online_students s where s.company = v_link.company
    ), '[]'::jsonb),
    'vouchers', jsonb_build_object(
      'issued', (select count(*) from public.lead_promo_codes c where c.company = v_link.company),
      'redeemed', (select count(*) from public.lead_promo_codes c where c.company = v_link.company and c.redeemed_at is not null)
    )
  );
end
$$;
revoke all on function public.company_portal(text) from public;
grant execute on function public.company_portal(text) to anon, authenticated, service_role;
