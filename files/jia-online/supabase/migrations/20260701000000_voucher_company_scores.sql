-- Voucher (เต็มคอร์ส) สำหรับลูกค้าจ่ายเงินมาแล้ว + tagging บริษัทสำหรับรายงานคะแนน B2B pre-course
--
-- ต่อยอดจาก lead_promo_codes (Phase 0 lead-capture) ให้ใช้ออกโค้ด voucher ปลดล็อกเต็มคอร์สได้ด้วย
-- (ไม่แยกตารางใหม่ — ใช้ unlock_modules ที่มีอยู่แล้ว แค่ตั้งให้ครบ 1-7 แทน [1,2,3])
--
-- company ผูกไว้ตอนพนักงานออกโค้ด (lead_promo_codes.company) แล้ว "สืบทอด" มาที่
-- online_students.company ตอนลูกค้า redeem เพื่อให้ Admin กรอง/ออกรายงานคะแนนตามบริษัทให้ HR ได้
--
-- chapter_scores เก็บคะแนนรายบท (module id -> คะแนน %) เขียนตรงจาก client เหมือน final_score เดิม
-- ไม่ใช้ course_progress/edge function เพราะ course_progress ผูกกับการล็อกอินจริง (LINE/Google/Email OTP)
-- เท่านั้น ในขณะที่ลูกค้า voucher/pre-course ส่วนใหญ่ลงทะเบียนแบบชื่อ+เบอร์โทรอย่างเดียว (soft gate)

alter table public.lead_promo_codes
  add column if not exists company text;

create index if not exists idx_lead_promo_company
  on public.lead_promo_codes (company)
  where company is not null;

alter table public.online_students
  add column if not exists company        text,
  add column if not exists chapter_scores jsonb not null default '{}'::jsonb;

create index if not exists idx_online_students_company
  on public.online_students (company)
  where company is not null;
