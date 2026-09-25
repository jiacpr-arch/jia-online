-- เลิกให้หน้าเว็บ cpr.morroo.com อ่าน/แก้ตาราง customers ตรง ๆ ด้วย anon key (ขั้นแรกของการปิด anon SELECT/UPDATE
-- บนตาราง PII — ดู docs/SECURITY_FOLLOWUP.md) เดิมหน้าเว็บ:
--   - PATCH customers?tel=ilike.*<เบอร์> ตั้ง line_link_code/line_added → ใครรู้เบอร์คนอื่นก็เปลี่ยน line_link_code ของเขาได้
--     แล้วส่ง "JIA-LINK-<โค้ดตัวเอง>" เข้า LINE OA → line-webhook ผูก LINE ของผู้โจมตีเข้ากับลูกค้าคนนั้น (รับข้อความ/คูปองแทน)
--   - GET customers?tel=ilike.*<เบอร์>&select=line_user_id → polling ว่าผูก LINE สำเร็จหรือยัง
-- แทนด้วย RPC 2 ตัว:
--   customer_set_line_link: มี customer_id → ต้องตรงทั้ง id+เบอร์; ไม่มี (ผู้เรียนเก่า) → แก้ได้เฉพาะแถวของเบอร์นั้นที่ยัง
--     ไม่เคยผูก LINE (line_user_id is null) กันยึดบัญชีที่ผูกแล้ว
--   customer_line_linked: ต้องรู้ทั้งเบอร์ + line_link_code (ความลับที่อยู่ในเครื่องผู้เรียน) ถึงจะรู้สถานะการผูก
-- หมายเหตุ: policy anon_read/anon_update บน customers ยังเปิดอยู่ (แอปอื่นในเครือยังใช้) — ปิดเมื่อย้ายแอปอื่นเสร็จ

create or replace function public.customer_set_line_link(p_customer_id text, p_phone text, p_code text, p_mark_added boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_tail text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9); v_n int;
begin
  if length(v_tail) < 9 or coalesce(p_code, '') !~ '^[A-Z0-9]{6}$' then return false; end if;
  update public.customers c
     set line_link_code = p_code,
         line_added = case when p_mark_added then true else c.line_added end,
         line_added_at = case when p_mark_added then now() else c.line_added_at end
   where right(regexp_replace(coalesce(c.tel, ''), '\D', '', 'g'), 9) = v_tail
     and (case when nullif(p_customer_id, '') is not null then c.id = p_customer_id else c.line_user_id is null end);
  get diagnostics v_n = row_count;
  return v_n > 0;
end
$$;

create or replace function public.customer_line_linked(p_phone text, p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customers c
     where c.line_link_code = p_code and coalesce(p_code, '') <> ''
       and right(regexp_replace(coalesce(c.tel, ''), '\D', '', 'g'), 9) = right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9)
       and c.line_user_id is not null
  )
$$;

revoke all on function public.customer_set_line_link(text, text, text, boolean) from public;
revoke all on function public.customer_line_linked(text, text) from public;
grant execute on function public.customer_set_line_link(text, text, text, boolean) to anon, authenticated, service_role;
grant execute on function public.customer_line_linked(text, text) to anon, authenticated, service_role;
