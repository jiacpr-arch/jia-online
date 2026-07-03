// signup-push
// ยิงข้อความ "ผ่านบทที่ 1 แล้ว + คูปอง ฿100" เข้าแชต LINE ของลูกค้าหลังสมัครเสร็จ
// เรียกภายในจาก auth-line-link (หลัง upsert สำเร็จ เฉพาะคนที่มี line_user_id)
// หรือเรียกตรงก็ได้: POST { line_user_id, name }
//
// Secrets ที่ใช้:
//   LINE_CHANNEL_ACCESS_TOKEN  (Messaging API @jiacpr — มีอยู่แล้ว / fallback jiaroo_secrets)
//   SIGNUP_PUSH_SECRET         (ออปชัน) กันยิงมั่ว — ตรวจกับ header x-internal-secret
//
// เทสต์ไม่ส่งจริง: ?dry_run=1 หรือ body { dry_run: true } → คืนคูปอง + ข้อความตัวอย่าง

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

const genCoupon = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let r = "JIA-";
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)];
  return r;
};

// แยกเป็นฟังก์ชันเพื่อให้ auth-line-link import มาเรียกตรงได้ (ไม่ต้อง http รอบสอง)
export async function runSignupPush(opts: { line_user_id: string; name?: string; dry_run?: boolean }) {
  const { line_user_id, name } = opts;
  if (!line_user_id) return { ok: false, error: "missing line_user_id" };

  // ออกคูปอง ฿100 (เหมือน submitQuiz ฝั่ง frontend) แล้วบันทึกให้ redeem ได้
  // retry เมื่อชนรหัสซ้ำ (code unique) — ห้ามคืนคูปองที่ insert ไม่สำเร็จ ไม่งั้นลูกค้าได้โค้ด redeem ไม่ได้
  let coupon = genCoupon();
  if (!opts.dry_run) {
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const { error } = await supa.from("promo_codes")
        .insert({ code: coupon, type: "online", discount: 100, staff_name: "system" });
      if (!error) { saved = true; break; }
      coupon = genCoupon();
    }
    if (!saved) return { ok: false, error: "could not issue coupon" };
  }

  const text =
    `🎉 ยินดีต้อนรับ${name ? " คุณ" + name : ""}! สมัครคอร์ส CPR & AED ออนไลน์เรียบร้อย\n\n` +
    `ขอบคุณที่ลองทำควิซกับเรา 💙 คุณได้รับ "คูปองส่วนลด ฿100" สำหรับคอร์สภาคปฏิบัติ (on-site) ที่ JIA Trainer Center\n\n` +
    `รหัสคูปอง: ${coupon}\n\n` +
    `เริ่มเรียนคอร์สออนไลน์ได้เลย เรียนจบรับใบประกาศนียบัตร แล้วทักแชตนี้เพื่อจองรอบ on-site ได้ทันที`;

  if (opts.dry_run) return { ok: true, dry_run: true, coupon, preview: text };

  const token = await loadToken();
  if (!token) return { ok: false, error: "no LINE token", coupon };
  try {
    const r = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: line_user_id, messages: [{ type: "text", text }] }),
    });
    // 403 = ลูกค้ายังไม่ได้แอดเพื่อน — ไม่ถือว่า error ที่ต้อง block (drip จะตามทีหลัง)
    if (!r.ok) return { ok: false, coupon, status: r.status, detail: (await r.text()).slice(0, 160) };
    return { ok: true, coupon };
  } catch (e) {
    return { ok: false, coupon, error: String(e).slice(0, 160) };
  }
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
    const res = await runSignupPush({ line_user_id: payload?.line_user_id, name: payload?.name, dry_run });
    return json(res, 200);
  });
}
