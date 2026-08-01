// grade-quiz
// ตรวจข้อสอบท้ายบท/ข้อสอบสุดท้ายฝั่ง server — เฉลยอยู่ที่นี่เท่านั้น ไม่อยู่ในบันเดิลหน้าเว็บ
// (เดิมเฉลยทุกข้อฝังใน COURSE ของ App.jsx → เปิด view-source ก็เห็นเฉลย/ปั๊มใบเซอร์ได้)
//
// POST { module_id, questions: [origIndex...], answers: [origChoiceIndex...] }
//   - questions: index ของคำถามใน quiz ต้นฉบับของบทนั้น (client สุ่มลำดับคำถาม/ตัวเลือกเอง
//     แล้วแปลงคำตอบกลับเป็น index ต้นฉบับก่อนส่ง)
//   - answers: index ตัวเลือกต้นฉบับที่ผู้เรียนเลือก (ตำแหน่งตรงกับ questions)
// ตอบ { score, correct, total, passed, corrects: [เฉลยของข้อที่ส่งมา] }
//   - ส่ง corrects กลับเฉพาะชุดข้อที่ผู้เรียนเพิ่งส่งคำตอบ เพื่อให้ UI ไฮไลต์เฉลยตอนรีวิวได้
//
// Deploy ด้วย verify_jwt = false (เรียกด้วย anon apikey)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

  const key = ANSWER_KEY[String(body?.module_id)];
  if (!key) return json({ error: "unknown module" }, 400);

  const questions = body?.questions;
  const answers = body?.answers;
  if (!Array.isArray(questions) || !Array.isArray(answers) || questions.length === 0 ||
      questions.length !== answers.length || questions.length > key.length) {
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

  let correct = 0;
  const corrects: number[] = [];
  questions.forEach((qi: number, i: number) => {
    corrects.push(key[qi]);
    if (answers[i] === key[qi]) correct++;
  });
  const total = questions.length;
  const score = Math.round((correct / total) * 100);
  return json({ score, correct, total, passed: score >= PASS_PCT, corrects });
});
