// grade-quiz
// ตรวจข้อสอบท้ายบท/ข้อสอบสุดท้ายฝั่ง server — เฉลยอยู่ที่นี่เท่านั้น ไม่อยู่ในบันเดิลหน้าเว็บ
// (เดิมเฉลยทุกข้อฝังใน COURSE ของ App.jsx → เปิด view-source ก็เห็นเฉลย/ปั๊มใบเซอร์ได้)
//
// POST { module_id, questions: [origIndex...], answers: [origChoiceIndex...], access_token? }
//   - questions: index ของคำถามใน quiz ต้นฉบับของบทนั้น (client สุ่มลำดับคำถาม/ตัวเลือกเอง
//     แล้วแปลงคำตอบกลับเป็น index ต้นฉบับก่อนส่ง) — ต้องส่งมาให้ครบตามจำนวนที่สุ่มจริงเท่านั้น
//     (REQUIRED_COUNT ด้านล่าง ต้องตรงกับ QUIZ_DRAW_N ใน src/App.jsx เสมอ) ห้ามส่งบางข้อแล้วได้ 100%
//   - answers: index ตัวเลือกต้นฉบับที่ผู้เรียนเลือก (ตำแหน่งตรงกับ questions)
//   - access_token: Supabase JWT ของผู้เรียน — จำเป็นเฉพาะ FINAL_MODULE_ID (ข้อสอบปลายภาค) เท่านั้น
// ตอบ { score, correct, total, passed, corrects? }
//   - corrects: คืนให้เฉพาะบทเรียน (ให้ UI ไฮไลต์เฉลยตอนรีวิวได้) — ข้อสอบปลายภาคไม่คืนเฉลยกลับไปเลย
//     (เดิมคืนเฉลยทุกครั้งไม่ว่าใครเรียก ไม่มี auth ไม่มี rate limit → ไล่ยิงทีละคำถามก็ดึงเฉลยครบชุดได้)
//
// Deploy ด้วย verify_jwt = false (เรียกด้วย anon apikey; ข้อสอบปลายภาคยืนยันตัวตนเองด้วย access_token
// ผ่าน SUPABASE_SERVICE_ROLE_KEY ข้างใน ไม่ใช่ผ่าน gateway JWT verification)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

// เฉลยต่อบท: ANSWER_KEY[module_id][questionIndex] = index ตัวเลือกที่ถูก (อิงลำดับใน COURSE)
// ต้องแก้ไฟล์นี้คู่กับ src/App.jsx เสมอเมื่อเพิ่ม/ลบ/สลับคำถาม
const ANSWER_KEY: Record<string, number[]> = {
  "1": [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  "2": [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 2],
  "3": [1, 1, 2, 1, 0, 1, 1, 1, 1, 1],
  "4": [1, 1, 0, 1, 2, 1, 1, 1],
  "5": [1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
  "6": [1, 1, 1, 2, 1, 1, 1, 1, 1],
  "7": [2, 1, 1, 1, 2, 1, 1, 1, 1, 2, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
};

// จำนวนข้อที่ต้องส่งมาพอดี ต่อ module — ต้องตรงกับ QUIZ_DRAW_N(mod) ใน src/App.jsx เสมอ
// (บทเรียน 1-6 มี vid → 5 ข้อ, ข้อสอบปลายภาค (module สุดท้าย ไม่มี vid) → 10 ข้อ)
const REQUIRED_COUNT: Record<string, number> = { "1": 5, "2": 5, "3": 5, "4": 5, "5": 5, "6": 5, "7": 10 };
// module สุดท้ายใน COURSE.modules ของ src/App.jsx (id ไม่มี vid) — จุดเดียวที่บังคับ auth+rate limit+ไม่คืนเฉลย
const FINAL_MODULE_ID = "7";
const MAX_ATTEMPTS_PER_DAY = 5;

const PASS_PCT = 80;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const moduleId = String(body?.module_id);
  const key = ANSWER_KEY[moduleId];
  const requiredCount = REQUIRED_COUNT[moduleId];
  if (!key || !requiredCount) return json({ error: "unknown module" }, 400);

  const questions = body?.questions;
  const answers = body?.answers;
  if (!Array.isArray(questions) || !Array.isArray(answers) ||
      questions.length !== answers.length || questions.length !== requiredCount) {
    return json({ error: "bad payload" }, 400);
  }
  // คำถามต้องเป็น index ที่มีจริงและไม่ซ้ำ (กันส่งข้อเดียวซ้ำๆ ปั๊มคะแนน)
  const seen = new Set<number>();
  for (const qi of questions) {
    if (!Number.isInteger(qi) || qi < 0 || qi >= key.length || seen.has(qi)) {
      return json({ error: "bad question index" }, 400);
    }
    seen.add(qi);
  }

  // ข้อสอบปลายภาค: ต้องยืนยันตัวตนจริง + จำกัดจำนวนครั้งต่อวัน กันปลอมผลสอบ/ไล่เดาแบบสุ่มเอาคะแนนผ่าน
  const isFinal = moduleId === FINAL_MODULE_ID;
  let authUserId: string | null = null;
  if (isFinal) {
    const accessToken = typeof body?.access_token === "string" ? body.access_token : "";
    if (!accessToken) return json({ error: "กรุณาเข้าสู่ระบบก่อนทำข้อสอบปลายภาค" }, 401);
    const { data, error } = await supa.auth.getUser(accessToken);
    if (error || !data?.user) return json({ error: "เข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง" }, 401);
    authUserId = data.user.id;
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supa.from("online_exam_attempts").select("id", { count: "exact", head: true })
      .eq("auth_user_id", authUserId).eq("module_id", Number(moduleId)).gte("created_at", since);
    if ((count || 0) >= MAX_ATTEMPTS_PER_DAY) {
      return json({ error: "ทำข้อสอบปลายภาคครบจำนวนครั้งที่กำหนดต่อวันแล้ว กรุณาลองใหม่วันถัดไป" }, 429);
    }
  }

  let correct = 0;
  const corrects: number[] = [];
  questions.forEach((qi: number, i: number) => {
    corrects.push(key[qi]);
    if (answers[i] === key[qi]) correct++;
  });
  const total = questions.length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= PASS_PCT;

  if (isFinal && authUserId) {
    try { await supa.from("online_exam_attempts").insert({ auth_user_id: authUserId, module_id: Number(moduleId), score, passed }); }
    catch { /* บันทึก attempt ไม่สำเร็จไม่ควรบล็อกผลสอบที่ตรวจถูกต้องแล้ว — แค่ rate limit รอบต่อไปจะหลวมกว่าที่ตั้งใจ */ }
  }

  const result: Record<string, unknown> = { score, correct, total, passed };
  if (!isFinal) result.corrects = corrects; // บทเรียน 1-6: คืนเฉลยให้รีวิวได้ตามเดิม
  return json(result);
});
