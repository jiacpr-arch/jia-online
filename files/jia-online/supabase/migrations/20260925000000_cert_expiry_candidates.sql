-- เตือนต่ออายุใบประกาศ (customer-followup-drip) — ใบประกาศออนไลน์กลางอยู่ที่ Hub (learning_hub.person_certificates)
-- ซึ่ง schema learning_hub ไม่ได้เปิดผ่าน PostgREST → เปิดฟังก์ชันอ่านอย่างเดียวให้ service_role เรียกได้เท่านั้น
-- คืนใบคอร์ส cpr ที่ยังไม่ถูกเพิกถอน และหมดอายุภายในช่วงที่กำหนด (วันจากตอนนี้: ลบ = หมดไปแล้ว)
create or replace function public.online_cert_expiry_candidates(p_from_days int default -8, p_to_days int default 31)
returns table (user_id uuid, number text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select pc.user_id, pc.number, pc.expires_at
  from learning_hub.person_certificates pc
  where pc.course_id = 'cpr'
    and pc.revoked_at is null
    and pc.expires_at >= now() + make_interval(days => p_from_days)
    and pc.expires_at <  now() + make_interval(days => p_to_days)
    -- ข้ามคนที่ได้ใบใหม่ (ยังไม่หมดอายุ) ไปแล้ว
    and not exists (
      select 1 from learning_hub.person_certificates n
      where n.user_id = pc.user_id and n.course_id = pc.course_id and n.revoked_at is null
        and n.issued_at > pc.issued_at and n.expires_at > now()
    )
$$;
revoke all on function public.online_cert_expiry_candidates(int, int) from public, anon, authenticated;
grant execute on function public.online_cert_expiry_candidates(int, int) to service_role;
