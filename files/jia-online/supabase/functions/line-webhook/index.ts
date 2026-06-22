// line-webhook
// รับ event จาก LINE Messaging API (@jiacpr) แล้วเก็บ/จับคู่ line_user_id เข้ากับลูกค้า
// ตั้ง Webhook URL ที่ LINE Developers Console → Messaging API:
//   https://<project>.functions.supabase.co/functions/v1/line-webhook  (เปิด Use webhook = ON)
//
// การจับคู่: ลูกค้ากดปุ่ม "เพิ่ม LINE + ผูกบัญชี" ในแอป → ส่งข้อความ prefill ขึ้นต้น "JIA-LINK-<code>"
//   ฝั่งแอปเขียน customers.line_link_code = <code> ไว้ก่อน → webhook จับคู่ code → เขียน line_user_id กลับ
//
// Secrets ที่ใช้ (env ก่อน, fallback jiaroo_secrets tenant=jiaroo):
//   JIACPR_LINE_CHANNEL_SECRET → fallback LINE_CHANNEL_SECRET        (ตรวจลายเซ็น x-line-signature)
//   JIACPR_LINE_CHANNEL_ACCESS_TOKEN → fallback LINE_CHANNEL_ACCESS_TOKEN  (ดึงโปรไฟล์ + ตอบกลับ)
//   หมายเหตุ: @jiacpr เป็นคนละ channel กับ jiaroo (jiaroo-line-webhook) จึงต้องใช้คีย์ JIACPR_* แยก
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-line-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function loadSecretValue(key: string): Promise<string> {
  const env = Deno.env.get(key) || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", key).maybeSingle();
  return data?.value || "";
}

// @jiacpr Messaging API เป็นคนละ channel กับ jiaroo — ใช้คีย์เฉพาะของ @jiacpr ก่อน
// (env JIACPR_* → jiaroo_secrets JIACPR_* → fallback คีย์ทั่วไป) เพื่อไม่ทับ secret ของ jiaroo-line-webhook
async function loadJiacprSecret(jiacprKey: string, fallbackKey: string): Promise<string> {
  const specific = await loadSecretValue(jiacprKey);
  if (specific) return specific;
  return await loadSecretValue(fallbackKey);
}

// ออก channel access token ของ @jiacpr เองจาก channel id + secret (client_credentials, อายุ 30 วัน)
// แล้ว cache ลง jiaroo_secrets เพื่อไม่ต้องออกใหม่ทุกครั้ง — ผู้ใช้ไม่ต้องเข้า Developers Console
async function mintJiacprToken(): Promise<string> {
  const channelId = await loadSecretValue("JIACPR_LINE_CHANNEL_ID");
  const channelSecret = await loadJiacprSecret("JIACPR_LINE_CHANNEL_SECRET", "LINE_CHANNEL_SECRET");
  if (!channelId || !channelSecret) return "";
  try {
    const r = await fetch("https://api.line.me/v2/oauth/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: channelId, client_secret: channelSecret }),
    });
    if (!r.ok) return "";
    const tok = (await r.json())?.access_token || "";
    if (tok) {
      await supa.from("jiaroo_secrets").upsert(
        { tenant_slug: TENANT, key: "JIACPR_LINE_CHANNEL_ACCESS_TOKEN", value: tok },
        { onConflict: "tenant_slug,key" },
      );
    }
    return tok;
  } catch (_e) { return ""; }
}

// token ของ @jiacpr: ใช้ค่าที่ cache ไว้ก่อน, ถ้าไม่มีค่อย mint ใหม่ (force=true เพื่อ re-mint ตอนเจอ 401)
async function getJiacprToken(force = false): Promise<string> {
  if (!force) {
    const cached = await loadSecretValue("JIACPR_LINE_CHANNEL_ACCESS_TOKEN");
    if (cached) return cached;
  }
  return await mintJiacprToken();
}

// ตรวจลายเซ็น LINE: base64( HMAC-SHA256(rawBody, channelSecret) ) === x-line-signature
async function validSignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const computed = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return computed === signature;
  } catch (_e) {
    return false;
  }
}

// ดึงโปรไฟล์ — auto re-mint token ครั้งเดียวถ้าเจอ 401 (token หมดอายุ/เปลี่ยน)
async function lineGetProfile(lineUserId: string): Promise<any> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getJiacprToken(attempt === 1);
    if (!token) return null;
    try {
      const r = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) return await r.json();
      if (r.status !== 401) return null;
    } catch (_e) { return null; }
  }
  return null;
}

// ตอบกลับ — auto re-mint token ครั้งเดียวถ้าเจอ 401
async function lineReply(replyToken: string, text: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getJiacprToken(attempt === 1);
    if (!token) return;
    try {
      const r = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
      });
      if (r.ok || r.status !== 401) return;
    } catch (_e) { return; }
  }
}

// แยกโค้ด 6 ตัวจากข้อความที่ขึ้นต้น JIA-LINK-XXXXXX (อาจมีข้อความต่อท้าย)
function extractLinkCode(text: string): string | null {
  const m = (text || "").match(/JIA-LINK-([A-Z0-9]{6})/i);
  return m ? m[1].toUpperCase() : null;
}

// จับคู่ code → เขียน line_user_id กลับเข้า customers + course_progress; คืน customer_id ถ้าสำเร็จ
async function linkByCode(code: string, lineUserId: string): Promise<string | null> {
  const { data: cust } = await supa.from("customers").select("id").eq("line_link_code", code).maybeSingle();
  if (!cust?.id) return null;
  const nowIso = new Date().toISOString();
  // กันชน unique index: ถ้า line_user_id นี้ผูกกับลูกค้ารายอื่นอยู่แล้ว ปล่อยให้ของเดิมคงไว้
  const { data: clash } = await supa.from("customers").select("id").eq("line_user_id", lineUserId).maybeSingle();
  if (clash?.id && clash.id !== cust.id) return clash.id;
  await supa.from("customers").update({ line_user_id: lineUserId, line_added: true, line_added_at: nowIso }).eq("id", cust.id);
  await supa.from("course_progress").update({ line_user_id: lineUserId }).eq("customer_id", cust.id);
  return cust.id;
}

async function logInbound(row: {
  line_user_id?: string | null; event_type?: string | null; message_text?: string | null;
  matched_customer_id?: string | null; raw_payload?: unknown;
}): Promise<void> {
  try { await supa.from("line_inbound_log").insert(row as any); } catch (_e) { /* non-fatal */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const rawBody = await req.text();

  // 1) ตรวจลายเซ็น — กัน event ปลอม
  const secret = await loadJiacprSecret("JIACPR_LINE_CHANNEL_SECRET", "LINE_CHANNEL_SECRET");
  const signature = req.headers.get("x-line-signature") || "";
  if (!secret) return json({ error: "server missing LINE_CHANNEL_SECRET" }, 500);
  if (!signature || !(await validSignature(secret, rawBody, signature))) {
    return json({ error: "invalid signature" }, 401);
  }

  let body: any = {};
  try { body = JSON.parse(rawBody || "{}"); } catch { return json({ error: "bad json" }, 400); }
  const events: any[] = Array.isArray(body?.events) ? body.events : [];

  // 2) จัดการแต่ละ event (ทำให้ครบก่อนตอบ 200 — payload เล็ก) — token ออก/ดึงจาก cache ใน getJiacprToken เอง
  for (const ev of events) {
    const lineUserId: string | null = ev?.source?.userId || null;
    const type: string = ev?.type || "";
    try {
      if (type === "message" && ev?.message?.type === "text") {
        const text: string = ev.message.text || "";
        const code = extractLinkCode(text);
        let matched: string | null = null;
        if (code && lineUserId) matched = await linkByCode(code, lineUserId);
        await logInbound({ line_user_id: lineUserId, event_type: "message", message_text: text.slice(0, 500), matched_customer_id: matched, raw_payload: ev });
        if (matched && ev.replyToken) {
          await lineReply(ev.replyToken, "ผูกบัญชีเรียบร้อยแล้วค่ะ ✅ จะส่งโปรโมชั่น คูปองต่ออายุ และแจ้งเตือนทบทวน CPR ให้ทาง LINE นี้นะคะ 💙");
        }
      } else if (type === "follow") {
        let displayName: string | null = null;
        if (lineUserId) {
          const profile = await lineGetProfile(lineUserId);
          displayName = profile?.displayName || null;
        }
        await logInbound({ line_user_id: lineUserId, event_type: "follow", message_text: displayName, matched_customer_id: null, raw_payload: ev });
      } else if (type === "unfollow") {
        await logInbound({ line_user_id: lineUserId, event_type: "unfollow", message_text: null, matched_customer_id: null, raw_payload: ev });
      } else {
        await logInbound({ line_user_id: lineUserId, event_type: type || "unknown", message_text: null, matched_customer_id: null, raw_payload: ev });
      }
    } catch (_e) { /* event เดียวพังไม่ล้มทั้ง batch */ }
  }

  return json({ ok: true });
});
