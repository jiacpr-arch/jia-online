// notify-sales-rep
// แจ้งเซลล์ "เจ้าของลูกค้า" ทาง LINE (ส่งตรงหาคนเดียว ไม่เข้ากลุ่ม) — ลูกค้าคูปองพาร์ทเนอร์เป็นของเซลล์ที่แจกคูปองเท่านั้น
// เจ้าของ = public.sales_owner_for_phone(เบอร์) (คูปองใบแรกที่ลูกค้าใช้ + lead_promo_codes.sales_rep_id)
//
// เรียกโดย:
//   trigger notify_sales_rep_redeemed  (lead_promo_codes)  → { event: "redeemed",  record: { code, name, phone } }
//   trigger notify_sales_rep_completed (online_students)   → { event: "completed", record: { name, phone, final_score } }
//   line-webhook (ลูกค้าทัก @jiacpr)                        → { event: "line_message", record: { name, phone, text } }
//
// กันส่งซ้ำ: completed / line_message บันทึกลง lead_capture_events (code ของคูปอง + event_type)
//   completed ส่งครั้งเดียวต่อคูปอง, line_message ส่งไม่เกิน 1 ครั้งต่อ LINE_MESSAGE_GAP_HOURS ชม.
//
// Secrets: LINE_CHANNEL_ACCESS_TOKEN (fallback jiaroo_secrets) — channel เดียวกับที่ notify-new-booking ใช้ส่งหาทีม
//          NOTIFY_WEBHOOK_SECRET ตรวจกับ header x-webhook-secret (fail closed)
// เทสต์แบบไม่ส่งจริง: body { "dry_run": true, ... } → คืนข้อความตัวอย่าง

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);
const WEBHOOK_SECRET = Deno.env.get("NOTIFY_WEBHOOK_SECRET") || "";
const LINE_MESSAGE_GAP_HOURS = 6;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function loadToken(): Promise<string> {
  const env = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return data?.value || "";
}

type Owner = {
  code: string; display_name: string | null; contact_line: string | null; contact_phone: string | null;
  sales_rep_id: string | null; rep_name: string | null; rep_line_user_id: string | null;
};

async function getOwner(phone: string): Promise<Owner | null> {
  const { data } = await supa.rpc("sales_owner_for_phone", { p_phone: phone || "" });
  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

// ส่งไปแล้วหรือยัง (ภายใน withinHours ชม. — null = ตลอดกาล)
async function alreadySent(code: string, eventType: string, withinHours: number | null): Promise<boolean> {
  let q = supa.from("lead_capture_events").select("code", { count: "exact", head: true })
    .eq("code", code).eq("event_type", eventType);
  if (withinHours) q = q.gte("created_at", new Date(Date.now() - withinHours * 3600000).toISOString());
  const { count } = await q;
  return (count || 0) > 0;
}

function buildText(event: string, rec: any, owner: Owner): string | null {
  const name = rec.name || "(ไม่ระบุชื่อ)";
  const phone = rec.phone || "-";
  const head = `👤 ลูกค้าของคุณ (คูปอง ${owner.code})\nชื่อ: ${name}\nเบอร์: ${phone}\n\n`;
  if (event === "redeemed") {
    return `🎟️ ลูกค้าใช้คูปองของคุณแล้ว\n\n${head}` +
      `ลูกค้าเริ่มเรียนคอร์สออนไลน์แล้ว ทักไปแนะนำตัวได้เลย ลูกค้ารายนี้เป็นของคุณ`;
  }
  if (event === "completed") {
    const score = rec.final_score != null ? `คะแนนสอบ: ${rec.final_score}%\n\n` : "";
    return `🏆 ลูกค้าของคุณเรียนจบแล้ว\n\n${head}${score}` +
      `ใบประกาศออนไลน์เป็นภาคทฤษฎีเท่านั้น ลูกค้ายังต้องฝึกภาคปฏิบัติ\n` +
      `จังหวะดีที่สุดในการโทรเสนอคอร์ส on-site — ติดต่อภายในวันนี้`;
  }
  if (event === "line_message") {
    const text = String(rec.text || "").slice(0, 300);
    return `💬 ลูกค้าของคุณทัก LINE @jiacpr\n\n${head}ข้อความ: ${text}\n\n` +
      `ตอบลูกค้าใน OA หรือติดต่อกลับเองได้เลย`;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!WEBHOOK_SECRET) return json({ error: "server missing NOTIFY_WEBHOOK_SECRET" }, 503);
  if ((req.headers.get("x-webhook-secret") || "") !== WEBHOOK_SECRET) return json({ error: "unauthorized" }, 401);

  let payload: any = {};
  try { payload = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const event: string = payload?.event || "";
  const rec = payload?.record || {};
  const dryRun = payload?.dry_run === true;

  const owner = await getOwner(rec.phone || "");
  if (!owner) return json({ ok: true, skipped: "no owner" });
  if (!owner.rep_line_user_id) return json({ ok: true, skipped: "rep has no LINE / not assigned", code: owner.code });

  const text = buildText(event, rec, owner);
  if (!text) return json({ error: "unknown event" }, 400);

  const dedupeType = event === "completed" ? "rep_notified_completed"
                   : event === "line_message" ? "rep_notified_line_message" : null;
  if (dedupeType && await alreadySent(owner.code, dedupeType, event === "line_message" ? LINE_MESSAGE_GAP_HOURS : null)) {
    return json({ ok: true, skipped: "already notified", code: owner.code });
  }

  if (dryRun) return json({ ok: true, dry_run: true, rep: owner.rep_name, preview: text });

  const token = await loadToken();
  if (!token) return json({ error: "no LINE token" }, 500);
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: owner.rep_line_user_id, messages: [{ type: "text", text }] }),
  });
  if (!r.ok) return json({ ok: false, status: r.status, error: (await r.text()).slice(0, 200) }, 502);

  if (dedupeType) {
    await supa.from("lead_capture_events").insert({ code: owner.code, event_type: dedupeType, metadata: { rep: owner.rep_name } });
  }
  return json({ ok: true, sent: 1, rep: owner.rep_name });
});
