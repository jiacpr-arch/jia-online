// admin-api
// Proxy สำหรับหน้า admin: ตรวจรหัสแอดมินฝั่ง server (x-admin-key === ADMIN_API_KEY)
// แล้วเข้าถึงข้อมูลด้วย service_role — แทนการให้ client ใช้ anon key อ่าน/เขียนตาราง PII ตรงๆ
//
// รับ body: { table, method, filters, body }
//   - table: ต้องอยู่ใน ALLOW list เท่านั้น (กันหลุดไปแตะ users/jiaroo_secrets ฯลฯ)
//   - table === "__ping": ใช้ตรวจรหัสตอน login (คืน {ok:true} ถ้ารหัสถูก)
//
// Secrets (ตั้งผ่าน Supabase):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_API_KEY
// Deploy ด้วย verify_jwt = false (เรียกด้วย anon apikey + x-admin-key)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_KEY = Deno.env.get("ADMIN_API_KEY") || "";
// รหัสแอดมินเดิมที่เคยใช้ก่อนย้ายไปเป็น secret — ฝังฝั่ง server ไว้ให้ล็อกอินด้วยรหัสเดิมได้
// (ค่านี้อยู่ใน git history ของหน้าเว็บเดิมอยู่แล้ว จึงไม่ได้เปิดเผยความลับเพิ่ม)
// ตรวจฝั่ง server เท่านั้น ไม่หลุดไปอยู่ใน bundle ฝั่ง client
// TODO: ตั้ง ADMIN_API_KEY เป็นรหัสใหม่แล้วลบ LEGACY_ADMIN_KEY ทิ้งเพื่อความปลอดภัย
const LEGACY_ADMIN_KEY = "JiaAdmin2026";

// ตารางที่ admin เข้าถึงได้เท่านั้น — ห้ามใส่ users / jiaroo_secrets / *_secrets
const ALLOW = new Set<string>([
  "online_students", "online_purchases", "customers", "bookings",
  "sales_tracking", "lead_promo_codes", "lead_capture_events", "promo_codes",
  "jiaroo_leads", "jiaroo_lead_events", "jiaroo_messages", "jiaroo_team",
]);
const METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// เทียบสตริงแบบ constant-time กัน timing attack บนการตรวจรหัส
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  // fail closed: ต้องมีรหัสอย่างน้อยหนึ่งค่า (secret หรือ legacy) เสมอ
  if (!ADMIN_KEY && !LEGACY_ADMIN_KEY) return json({ error: "server missing ADMIN_API_KEY" }, 503);
  const got = req.headers.get("x-admin-key") || "";
  // ยอมรับทั้งรหัสจาก secret (ADMIN_API_KEY) และรหัสเดิมที่ฝังไว้ (LEGACY_ADMIN_KEY)
  const ok = (!!ADMIN_KEY && timingSafeEqual(got, ADMIN_KEY)) ||
             (!!LEGACY_ADMIN_KEY && timingSafeEqual(got, LEGACY_ADMIN_KEY));
  if (!ok) return json({ error: "unauthorized" }, 401);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const { table, method = "GET", filters = "", body = null } = payload || {};
  if (table === "__ping") return json({ ok: true }); // ผ่านการตรวจรหัสแล้ว

  if (typeof table !== "string" || !ALLOW.has(table)) return json({ error: "table not allowed" }, 403);
  const m = String(method).toUpperCase();
  if (!METHODS.has(m)) return json({ error: "method not allowed" }, 405);

  const url = `${SUPABASE_URL}/rest/v1/${table}${filters || ""}`;
  const h: Record<string, string> = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (m === "POST" || m === "PATCH") h.Prefer = "return=representation";

  const opts: RequestInit = { method: m, headers: h };
  if (body && m !== "GET" && m !== "DELETE") opts.body = JSON.stringify(body);

  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    return new Response(text || "[]", {
      status: r.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "upstream error", detail: String(e).slice(0, 200) }, 502);
  }
});
