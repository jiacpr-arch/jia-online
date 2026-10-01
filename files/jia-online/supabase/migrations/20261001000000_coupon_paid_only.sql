-- คูปองส่วนลด ฿100 คอร์ส on-site ให้เฉพาะคนที่ "จ่ายเงิน" ซื้อคอร์สออนไลน์เท่านั้น — คนเรียนฟรีไม่ได้ส่วนลด
--
-- 1) issue_online_coupon: นอกจากต้องเรียนจบ (completed_at) และไม่ใช่ pre-course แล้ว ต้องมีหลักฐานการจ่ายเงิน
--    - online_purchases.payment_status = 'ชำระแล้ว' (Stripe / สลิปที่แอดมินอนุมัติ) จับคู่ด้วยเบอร์ 9 หลักท้าย หรือ
--    - redeem voucher ที่ขาย (lead_promo_codes.source = 'voucher_sale')
--    ไม่ผ่าน → issued=false (แอปซ่อนคูปองอยู่แล้วด้วย noOnsiteCoupon)
-- 2) ล้าง online_students.coupon_code ของคูปองที่ถูกยกเลิก (used_by = 'ยกเลิก: เรียนฟรี ...') —
--    ไม่งั้น drip LINE ยังส่งโค้ดที่ใช้ไม่ได้ และ RPC จะคืนโค้ดเดิมกลับไป
--
-- หมายเหตุ: คูปองที่ออกให้คนเรียนฟรีถูกยกเลิกไปแล้ว 1 ต.ค. 2569 (190 ใบ) ด้วย
--   update promo_codes set used=1, used_at=now(), used_by='ยกเลิก: เรียนฟรี (ไม่มีสิทธิ์ส่วนลด)'
--   บันทึกรายใบใน learning_hub.online_audit (action = 'revokeFreeCoupon')
--   คืนสิทธิ์รายใบ: update promo_codes set used=0, used_at=null, used_by='' where code='JIA-XXXXXX';

create or replace function public.issue_online_coupon(p_customer_id text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare cust record; su record; new_code text; tries int:=0; tail text;
begin
 if p_customer_id is null or length(p_customer_id) not between 5 and 60 then return jsonb_build_object('issued',false); end if;
 select * into cust from public.customers where id=p_customer_id;
 -- Same ownership proof attachLocal uses (public.jia_online_account, Phase 1): the caller must know
 -- the customer's own phone, not just their (somewhat guessable, timestamp-based) customer id.
 if cust.id is null or right(regexp_replace(coalesce(cust.tel,''),'\D','','g'),9)<>right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9) or length(right(regexp_replace(coalesce(p_phone,''),'\D','','g'),9))<9 then
  return jsonb_build_object('issued',false);
 end if;
 tail := right(regexp_replace(coalesce(cust.tel,''),'\D','','g'),9);

 -- เรียนฟรีไม่ได้คูปอง: ต้องจ่ายเงินซื้อคอร์สออนไลน์ หรือใช้ voucher ที่ขาย
 if not exists(select 1 from public.online_purchases op
                where op.payment_status='ชำระแล้ว'
                  and (op.customer_id=cust.id or right(regexp_replace(coalesce(op.phone,''),'\D','','g'),9)=tail))
    and not exists(select 1 from public.lead_promo_codes l
                    where l.source='voucher_sale' and l.redeemed_at is not null
                      and right(regexp_replace(coalesce(l.redeemed_phone,''),'\D','','g'),9)=tail) then
  return jsonb_build_object('issued',false);
 end if;

 select * into su from public.online_students where customer_id=cust.id and completed_at is not null and not coalesce(pre_course,false) order by registered_at desc limit 1 for update;
 if su.id is null then return jsonb_build_object('issued',false); end if;
 -- online_students.coupon_code defaults to '' (not null), so "has a coupon already" must check for a
 -- non-empty value, not just non-null.
 if nullif(su.coupon_code,'') is not null then return jsonb_build_object('issued',true,'code',su.coupon_code,'alreadyIssued',true); end if;

 loop
  tries:=tries+1;
  new_code:='JIA-'||upper(substr(md5(random()::text||clock_timestamp()::text||tries::text),1,6));
  begin
   insert into public.promo_codes(code,type,discount,staff_name,used) values(new_code,'online',100,'issue_online_coupon',0);
   exit;
  exception when unique_violation then
   if tries>=8 then raise exception 'ออกคูปองไม่สำเร็จ กรุณาลองใหม่'; end if;
  end;
 end loop;
 update public.online_students set coupon_code=new_code where id=su.id;
 return jsonb_build_object('issued',true,'code',new_code,'alreadyIssued',false);
end $function$;

update public.online_students os set coupon_code=''
 from public.promo_codes c
 where c.code=os.coupon_code and c.used_by like 'ยกเลิก: เรียนฟรี%';
