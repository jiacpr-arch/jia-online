-- Rotate drip cron auth: อ่าน CRON_KEY จาก Supabase Vault แทน hardcode ในไฟล์ที่ commit
--
-- ปัญหา: 20260619000000_customer_followup_drip_cron.sql ฝัง `?key=JiaCron2026` ตรงๆ ในคำสั่ง
-- cron (ทั้งที่ customer-followup-drip/index.ts:20 เขียนว่า "ตั้งผ่าน env เท่านั้น — ห้าม hardcode")
-- → ใครมี repo ยิง ?key=JiaCron2026&action=preview เห็นชื่อ+โค้ดลูกค้า, action=send สั่ง LINE push จริงได้
--
-- วิธีแก้: reschedule job ให้ดึงคีย์จาก vault.decrypted_secrets ตอน "รัน" (คำสั่งใน $$...$$ ถูก
-- eval ทุกครั้งที่ cron ยิง ไม่ใช่ตอน schedule) → ไม่มีค่าลับอยู่ในไฟล์ migration อีก
-- ส่งคีย์ให้ drip ผ่าน header x-cron-key (ฟังก์ชันรองรับที่ index.ts:137) กันคีย์โผล่ใน URL/log
--
-- ⚠️ ก่อน/หลัง apply migration นี้ ผู้ดูแลต้องทำ 2 ขั้น (คีย์เดิม JiaCron2026 ถือว่าหลุดแล้ว ตั้งใหม่):
--   1) สร้าง secret ใน Vault ด้วยคีย์ใหม่:
--        select vault.create_secret('<NEW_CRON_KEY>', 'CRON_KEY');
--      (ถ้ามีอยู่แล้ว: select vault.update_secret((select id from vault.secrets where name='CRON_KEY'), '<NEW_CRON_KEY>');)
--   2) ตั้ง env secret ของ edge function ให้ตรงกัน:
--        supabase secrets set CRON_KEY='<NEW_CRON_KEY>'
--      (ทั้ง customer-followup-drip และ online-course-broadcast อ่านค่านี้)
--
-- Apply via Supabase MCP `apply_migration` or `supabase db push` — ทดสอบบน branch ก่อน prod

-- ลบ job เดิมที่ฝังคีย์ (unschedule เฉพาะที่มีอยู่ — ไม่ error ถ้าไม่มี)
select cron.unschedule(jobid)
from cron.job
where jobname in ('drip_enqueue_lifecycle', 'drip_run');

-- 1) enqueue lifecycle 3/11 เดือน (online-course-broadcast) — คงกลไก query param เดิมของฟังก์ชันนี้
--    (ไม่อยู่ใน repo จึงไม่แน่ใจว่ารองรับ header) แต่ดึงคีย์จาก vault แทน hardcode
select cron.schedule('drip_enqueue_lifecycle', '0 3 * * *', $job$
  select net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/online-course-broadcast?action=enqueue&key='
           || coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'CRON_KEY'), ''),
    timeout_milliseconds := 20000
  )
$job$);

-- 2) drip ตามลูกค้า — คีย์จาก vault ส่งผ่าน header x-cron-key
select cron.schedule('drip_run', '10 3 * * *', $job$
  select net.http_post(
    url := 'https://tpoiyykbgsgnrdwzgzvn.supabase.co/functions/v1/customer-followup-drip',
    headers := jsonb_build_object(
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_KEY')
    ),
    timeout_milliseconds := 20000
  )
$job$);
