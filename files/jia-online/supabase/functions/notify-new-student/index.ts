// notify-new-student
// แจ้งเตือนทีมเซลส์ทาง LINE เมื่อมีนักเรียนใหม่สมัครคอร์ส CPR ออนไลน์
// ทริกเกอร์ผ่าน Supabase Database Webhook: INSERT บนตาราง public.online_students
// ส่งหาทุกคนใน jiaroo_team ที่มี line_user_id
//
// Secrets ที่ใช้ (ตั้งผ่าน Supabase):
//   LINE_CHANNEL_ACCESS_TOKEN  (มีอยู่แล้ว — fallback อ่านจากตาราง jiaroo_secrets)
//   NOTIFY_WEBHOOK_SECRET      (ออปชัน) กันยิง endpoint มั่ว — ตรวจกับ header x-webhook-secret
//
// เทสต์แบบไม่ส่งจริง: POST ?dry_run=1 หรือ body { "dry_run": true }
//   → คืนจำนวนผู้รับ + ข้อความตัวอย่าง โดยไม่ push LINE

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") || "";

// อ่าน LINE token แบบเดียวกับ online-course-broadcast (env ก่อน แล้วค่อย fallback ตาราง secrets)
async function loadToken(): Promise<string> {
  const env = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return data?.value || "";
}

// ผู้รับ = ทุกคนในทีมเซลส์ที่มี line_user_id
async function getTeamRecipients(): Promise<string[]> {
  const { data } = await supa.from("jiaroo_team").select("line_user_id");
  const ids = (data || []).map((r: { line_user_id: string | null }) => r.line_user_id)
    .filter((x: string | null): x is string => !!x);
  return [...new Set(ids)];
}

async function pushMany(token: string, ids: string[], text: string) {
  if (!token) return { sent: 0, failed: 0, skipped: "no LINE token" };
  let sent = 0, failed = 0;
  const errors: string[] = [];
  for (const to of ids) {
    try {
      const r = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
      });
      if (r.ok) sent++;
      else { failed++; errors.push(`${to.slice(0, 8)}…: HTTP ${r.status} ${(await r.text()).slice(0, 120)}`); }
    } catch (e) {
      failed++; errors.push(`${to.slice(0, 8)}…: ${String(e).slice(0, 120)}`);
    }
  }
  return { sent, failed, errors };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // กัน endpoint ถูกยิงมั่ว — fail closed: ต้องตั้ง NOTIFY_WEBHOOK_SECRET เสมอ
  // (trigger notify_new_student_fn จะแนบ header x-webhook-secret จาก jiaroo_secrets ให้เอง)
  if (!WEBHOOK_SECRET) return new Response("server missing NOTIFY_WEBHOOK_SECRET", { status: 503 });
  {
    const got = req.headers.get("x-webhook-secret") || url.searchParams.get("secret") || "";
    if (got !== WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { /* ignore */ }

  const dryRun = payload?.dry_run === true || url.searchParams.get("dry_run") === "1";

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
    `รวมนักเรียนทั้งหมด ${total} คน\nดูได้ที่ cpr.morroo.com/admin`;

  const recipients = await getTeamRecipients();

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, recipients: recipients.length, total, preview: text }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = await loadToken();
  const line = await pushMany(token, recipients, text);

  return new Response(JSON.stringify({ ok: true, total, recipients: recipients.length, line, ran_at: new Date().toISOString() }), {
    headers: { "Content-Type": "application/json" },
  });
});
