-- ระบบตามลูกค้าอัตโนมัติ (เฟส 2) — เปิดสวิตช์ + ตั้ง cron รายวัน
--
-- ต้อง deploy edge function `customer-followup-drip` ก่อน
-- kill-switch: jiaroo_secrets (tenant 'jiaroo', key 'DRIP_ENABLED') = 'on' | 'off'
--   ปิดด่วน: update jiaroo_secrets set value='off' where tenant_slug='jiaroo' and key='DRIP_ENABLED';

update jiaroo_secrets set value = 'on' where tenant_slug = 'jiaroo' and key = 'DRIP_ENABLED';
insert into jiaroo_secrets (tenant_slug, key, value)
  select 'jiaroo', 'DRIP_ENABLED', 'on'
  where not exists (select 1 from jiaroo_secrets where tenant_slug = 'jiaroo' and key = 'DRIP_ENABLED');

-- cron รายวัน (เวลาไทย ~10:00 = 03:00 UTC)
-- 1) enqueue lifecycle 3/11 เดือน (ใช้ฟังก์ชันเดิม online-course-broadcast, enqueue อย่างเดียว)
select cron.schedule('drip_enqueue_lifecycle', '0 3 * * *',
  $$select net.http_post(url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/online-course-broadcast?action=enqueue&key=JiaCron2026', timeout_milliseconds := 20000)$$);
-- 2) drip ตามลูกค้า: enqueue กลุ่มใหม่ (unpaid/stuck) + ส่งคิวที่ค้างทั้งหมด
select cron.schedule('drip_run', '10 3 * * *',
  $$select net.http_post(url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/customer-followup-drip?key=JiaCron2026', timeout_milliseconds := 20000)$$);
