-- เดิม idx_lead_promo_phone เป็น unique แบบเข้มบน phone ทั้งตาราง ทำให้ลูกค้าคนเดียวกัน
-- รับโค้ดใหม่ไม่ได้เลยถ้าเคยมีโค้ดเก่า (แม้จะถูก redeem/expired ไปแล้ว) — เป็นปัญหาต่อฟีเจอร์
-- ออก voucher เต็มคอร์สให้ลูกค้าที่เคยได้โค้ด lead-capture ฟรีมาก่อน
-- แก้ให้เหลือแค่กันโค้ด "ที่ยังไม่ redeem" ซ้ำ (สอดคล้องกับ idx_lead_promo_email ที่เป็น partial อยู่แล้ว)
drop index if exists public.idx_lead_promo_phone;
create unique index if not exists idx_lead_promo_phone_active
  on public.lead_promo_codes (phone)
  where redeemed_at is null;
