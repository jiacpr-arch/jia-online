// notify-new-student
// แจ้งเตือนแอดมิน (LINE + อีเมล) เมื่อมีนักเรียนใหม่สมัครคอร์ส CPR ออนไลน์
// ทริกเกอร์ผ่าน Supabase Database Webhook: INSERT บนตาราง public.online_students
//
// Secrets ที่ใช้ (ตั้งผ่าน Supabase):
//   LINE_CHANNEL_ACCESS_TOKEN  (มีอยู่แล้ว — fallback อ่านจากตาราง jiaroo_secrets)
//   ADMIN_LINE_USER_ID         LINE userId ของแอดมินที่จะรับ push
//   RESEND_API_KEY             สำหรับส่งอีเมล (ไม่ตั้ง = ข้ามอีเมล ส่งแต่ LINE)
//   NOTIFY_EMAIL_TO            ผู้รับอีเมล (default jiacpr@gmail.com)
//   NOTIFY_EMAIL_FROM          ผู้ส่ง (default onboarding@resend.dev)
//   NOTIFY_WEBHOOK_SECRET      กันยิง endpoint มั่ว (ตรวจกับ header x-webhook-secret)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const ADMIN_LINE_USER_ID = Deno.env.get("ADMIN_LINE_USER_ID") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const EMAIL_TO = Deno.env.get("NOTIFY_EMAIL_TO") || "jiacpr@gmail.com";
const EMAIL_FROM = Deno.env.get("NOTIFY_EMAIL_FROM") || "JIA CPR <onboarding@resend.dev>";
const WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") || "";

// อ่าน LINE token แบบเดียวกับ online-course-broadcast (env ก่อน แล้วค่อย fallback ตาราง secrets)
async function loadToken(): Promise<string> {
  const env = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return data?.value || "";
}

async function pushLine(token: string, to: string, text: string) {
  if (!token || !to) return { ok: false, skipped: "missing token or admin userId" };
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  return { ok: r.ok, status: r.status, body: r.ok ? "" : (await r.text()).slice(0, 300) };
}

async function sendEmail(subject: string, text: string) {
  if (!RESEND_API_KEY) return { ok: false, skipped: "no RESEND_API_KEY" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      subject,
      text,
    }),
  });
  return { ok: r.ok, status: r.status, body: r.ok ? "" : (await r.text()).slice(0, 300) };
}

Deno.serve(async (req: Request) => {
  // กัน endpoint ถูกยิงมั่ว (ตั้ง NOTIFY_WEBHOOK_SECRET แล้วใส่ header x-webhook-secret ใน webhook)
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-webhook-secret") || new URL(req.url).searchParams.get("secret") || "";
    if (got !== WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { /* ignore */ }

  // รองรับทั้ง payload ของ Database Webhook ({ type, table, record }) และเรียกทดสอบตรงๆ
  const rec = payload?.record || payload || {};
  if (payload?.type && payload.type !== "INSERT") {
    return new Response(JSON.stringify({ ignored: payload.type }), { headers: { "Content-Type": "application/json" } });
  }

  const name = rec.name || "(ไม่ระบุชื่อ)";
  const phone = rec.phone || "-";
  const email = rec.email || "-";

  // จำนวนนักเรียนรวมล่าสุด (ไว้โชว์ในข้อความ)
  const { count } = await supa.from("online_students").select("*", { count: "exact", head: true });
  const total = count ?? "?";

  const text =
    `🆕 นักเรียนใหม่ CPR ออนไลน์\n\n` +
    `ชื่อ: ${name}\nเบอร์: ${phone}\nอีเมล: ${email}\n\n` +
    `รวมนักเรียนทั้งหมด ${total} คน\nดูได้ที่ jiacpr.com/online?admin=1`;

  const token = await loadToken();
  const [line, mail] = await Promise.all([
    pushLine(token, ADMIN_LINE_USER_ID, text),
    sendEmail(`🆕 นักเรียนใหม่ CPR: ${name}`, text),
  ]);

  return new Response(JSON.stringify({ ok: true, total, line, mail, ran_at: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
