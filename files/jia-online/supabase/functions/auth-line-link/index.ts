// auth-line-link
// ยืนยันการล็อกอินด้วย LINE (LIFF) ฝั่ง server แล้ว upsert ลูกค้า + เก็บ/รวม progress
// เรียกจาก frontend หลัง LIFF login: POST { id_token, phone, pdpa, display_name, utm, landing_url, local_progress, gate_variant }
//
// สำคัญ: ยืนยัน id_token กับ LINE เสมอ — ห้ามเชื่อ line_user_id ที่ client ส่งมาตรงๆ
//
// Secrets ที่ใช้:
//   LINE_LOGIN_CHANNEL_ID   (Login channel id — ใช้เป็น client_id ตอน verify; fallback jiaroo_secrets)
//   SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
//   (signup-push ใช้ LINE_CHANNEL_ACCESS_TOKEN ต่อ)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { runSignupPush } from "../signup-push/index.ts";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function loadChannelId(): Promise<string> {
  const env = Deno.env.get("LINE_LOGIN_CHANNEL_ID") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_LOGIN_CHANNEL_ID").maybeSingle();
  return data?.value || "";
}

// รวม progress สองชุด: union ของ done + เก็บคะแนนสูงสุดต่อบท
function mergeProgress(a: any, b: any) {
  const doneA: number[] = Array.isArray(a?.done) ? a.done : [];
  const doneB: number[] = Array.isArray(b?.done) ? b.done : [];
  const done = [...new Set([...doneA, ...doneB])].sort((x, y) => x - y);
  const scores: Record<string, number> = { ...(a?.scores || {}) };
  for (const [k, v] of Object.entries(b?.scores || {})) {
    scores[k] = Math.max(Number(scores[k] || 0), Number(v || 0));
  }
  return { done, scores };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { id_token, phone, pdpa, display_name, utm, landing_url, local_progress, gate_variant } = body;
  if (!id_token) return json({ error: "missing id_token" }, 400);
  if (!pdpa) return json({ error: "pdpa consent required" }, 400);

  // 1) ยืนยัน id_token กับ LINE
  const channelId = await loadChannelId();
  if (!channelId) return json({ error: "server missing LINE_LOGIN_CHANNEL_ID" }, 500);
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token, client_id: channelId }),
  });
  if (!verifyRes.ok) return json({ error: "line verify failed", detail: (await verifyRes.text()).slice(0, 160) }, 401);
  const claims = await verifyRes.json();
  const lineUserId: string = claims.sub;
  const name = (display_name || claims.name || "").toString().slice(0, 80);
  if (!lineUserId) return json({ error: "no sub in token" }, 401);

  const cleanPhone = (phone || "").toString().replace(/\D/g, "");
  const nowIso = new Date().toISOString();

  // 2) upsert customers — กันซ้ำ: ถ้ามีแถว legacy match เบอร์อยู่แล้ว ให้ UPDATE ไม่สร้างใหม่
  const baseFields: Record<string, unknown> = {
    line_user_id: lineUserId,
    auth_provider: "line",
    oauth_sub: lineUserId,
    display_name: name,
    name: name || undefined,
    tel: cleanPhone || undefined,
    pdpa_consent_at: nowIso,
    signup_at: nowIso,
    source: "online-course",
    line_added: true,
    line_added_at: nowIso,
    gate_variant: gate_variant || null,
    utm_source: utm?.utm_source || null,
    utm_medium: utm?.utm_medium || null,
    utm_campaign: utm?.utm_campaign || null,
    utm_content: utm?.utm_content || null,
    utm_term: utm?.utm_term || null,
    landing_url: landing_url || null,
  };

  let customerId: string | null = null;
  // หาแถวเดิม: จับคู่เฉพาะด้วยตัวตน LINE ที่ verify แล้ว (line_user_id / oauth_sub) เท่านั้น
  // ห้ามจับคู่ด้วยเบอร์โทรที่ client ส่งมา — มิฉะนั้นผู้ใช้จะยึดบัญชีคนอื่นได้ด้วยการกรอกเบอร์ปลายทาง
  let existing: any = null;
  {
    const { data: byLine } = await supa.from("customers")
      .select("id").or(`line_user_id.eq.${lineUserId},oauth_sub.eq.${lineUserId}`).limit(1);
    existing = Array.isArray(byLine) && byLine[0] ? byLine[0] : null;
  }
  if (existing?.id) {
    customerId = existing.id;
    await supa.from("customers").update(baseFields).eq("id", customerId);
  } else {
    customerId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    await supa.from("customers").insert({ id: customerId, ...baseFields });
  }

  // 3) merge + เก็บ progress ผูกบัญชี
  const { data: existingProg } = await supa.from("course_progress")
    .select("done, scores").eq("customer_id", customerId).maybeSingle();
  const merged = mergeProgress(existingProg || {}, local_progress || {});
  await supa.from("course_progress").upsert({
    customer_id: customerId, line_user_id: lineUserId,
    done: merged.done, scores: merged.scores, updated_at: nowIso,
  }, { onConflict: "customer_id" });

  // 4) online_students "กำลังเรียน" ถ้ายังไม่มี
  const { data: stu } = await supa.from("online_students").select("id").eq("customer_id", customerId).limit(1);
  if (!Array.isArray(stu) || stu.length === 0) {
    await supa.from("online_students").insert({
      customer_id: customerId, name: name, phone: cleanPhone, status: "กำลังเรียน",
    });
  }

  // 5) ยิงข้อความต้อนรับ + คูปอง ฿100 เข้าแชต LINE ทุกครั้งที่สมัครสำเร็จ (ด่านอยู่ก่อนเรียน)
  const push = await runSignupPush({ line_user_id: lineUserId, name });
  const coupon: string | null = (push as any)?.coupon || null;

  return json({ ok: true, customer_id: customerId, line_user_id: lineUserId, name, progress: merged, coupon });
});
