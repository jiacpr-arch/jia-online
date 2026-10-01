// signup-push
// ยิงข้อความต้อนรับ (ไม่มีคูปอง — ส่วนลดให้เฉพาะคนที่จ่ายเงิน) เข้าแชต LINE ของลูกค้าหลังสมัครเสร็จ
// เรียกภายในจาก auth-line-link (หลัง upsert สำเร็จ เฉพาะคนที่มี line_user_id)
// หรือเรียกตรงก็ได้: POST { line_user_id, name }
//
// Secrets ที่ใช้:
//   LINE_CHANNEL_ACCESS_TOKEN  (Messaging API @jiacpr — มีอยู่แล้ว / fallback jiaroo_secrets)
//   SIGNUP_PUSH_SECRET         (ออปชัน) กันยิงมั่ว — ตรวจกับ header x-internal-secret
//
// เทสต์ไม่ส่งจริง: ?dry_run=1 หรือ body { dry_run: true } → คืนข้อความตัวอย่าง

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);
const INTERNAL_SECRET = Deno.env.get("SIGNUP_PUSH_SECRET") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-internal-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function loadToken(): Promise<string> {
  const env = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return data?.value || "";
}

async function pushLine(to: string, text: string) {
  const token = await loadToken();
  if (!token) return { ok: false, error: "no LINE token" };
  try {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
    });
    // 403 = ลูกค้ายังไม่ได้แอดเพื่อน — ไม่ถือว่า error ที่ต้อง block (drip จะตามทีหลัง)
    if (!r.ok) return { ok: false, status: r.status, detail: (await r.text()).slice(0, 160) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 160) };
  }
}

// แยกเป็นฟังก์ชันเพื่อให้ auth-line-link import มาเรียกตรงได้ (ไม่ต้อง http รอบสอง)
// pre_course = นักเรียนที่จ่ายค่าคอร์ส on-site เต็มราคาแล้ว มาเรียนออนไลน์ก่อนเข้าคลาส
// → ห้ามออก/ส่งคูปอง ฿100 (เคยส่งให้ทุกคน ทำให้นักเรียนกลุ่มนี้ทวงส่วนลด/ขอเงินคืน)
export async function runSignupPush(opts: { line_user_id: string; name?: string; dry_run?: boolean; pre_course?: boolean; no_coupon?: boolean }) {
  const { line_user_id, name } = opts;
  if (!line_user_id) return { ok: false, error: "missing line_user_id" };

  if (opts.pre_course) {
    const text =
      `🎉 ยินดีต้อนรับ${name ? " คุณ" + name : ""}! ผูกบัญชีคอร์ส CPR & AED ออนไลน์เรียบร้อย\n\n` +
      `เรียนทฤษฎีออนไลน์ให้จบก่อนวันอบรม แล้วพบกันในคลาสภาคปฏิบัติครับ 💙\n` +
      `มีคำถามเรื่องวันเวลา/สถานที่ ทักแชตนี้ได้เลย`;
    if (opts.dry_run) return { ok: true, dry_run: true, coupon: null, preview: text };
    const push = await pushLine(line_user_id, text);
    return { ...push, coupon: null };
  }

  // คูปองส่วนลด ฿100 ให้เฉพาะคนที่จ่ายเงินซื้อคอร์สออนไลน์ — ตอนสมัครยังเรียนฟรีอยู่ จึงไม่แนบคูปอง
  // (คนที่จ่ายเงินได้คูปองตอนเรียนจบผ่าน issue_online_coupon ฝั่งแอป) — no_coupon คงไว้ให้ client เก่าส่งมาได้
  const text =
    `🎉 ยินดีต้อนรับ${name ? " คุณ" + name : ""}! สมัครคอร์ส CPR & AED ออนไลน์เรียบร้อย\n\n` +
    `เริ่มเรียนคอร์สออนไลน์ได้เลย เรียนจบรับใบประกาศนียบัตร สนใจเรียนภาคปฏิบัติ (on-site) ทักแชตนี้ได้ทันที`;
  if (opts.dry_run) return { ok: true, dry_run: true, coupon: null, preview: text };
  const push = await pushLine(line_user_id, text);
  return { ...push, coupon: null };
}

// รันเซิร์ฟเวอร์เฉพาะตอนถูกเรียกเป็น entrypoint โดยตรง (กัน Deno.serve ทำงานซ้ำตอน auth-line-link import มาใช้ runSignupPush)
if (import.meta.main) {
  Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    const url = new URL(req.url);
    if (INTERNAL_SECRET) {
      const got = req.headers.get("x-internal-secret") || url.searchParams.get("secret") || "";
      if (got !== INTERNAL_SECRET) return json({ error: "unauthorized" }, 401);
    }
    let payload: any = {};
    try { payload = await req.json(); } catch { /* ignore */ }
    const dry_run = payload?.dry_run === true || url.searchParams.get("dry_run") === "1";
    const res = await runSignupPush({ line_user_id: payload?.line_user_id, name: payload?.name, dry_run, pre_course: payload?.pre_course === true, no_coupon: payload?.no_coupon === true });
    return json(res, 200);
  });
}
