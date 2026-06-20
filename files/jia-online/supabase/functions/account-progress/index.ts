// account-progress
// บันทึก/โหลดความคืบหน้าคอร์สแบบผูกบัญชี (เรียนต่อข้ามเครื่อง)
// เขียนผ่าน service_role เท่านั้น + ยืนยันตัวตนทุกครั้งกันปลอม progress ของผู้อื่น
//   - LINE: ส่ง { id_token }  → verify กับ LINE, sub ต้องตรง line_user_id
//   - Google/Email: ส่ง { access_token } (Supabase JWT) → getUser, id ต้องตรง auth_user_id
//
// POST { action:"save"|"load", id_token?|access_token?, customer_id?, progress? }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function mergeProgress(a: any, b: any) {
  const done = [...new Set([...(a?.done || []), ...(b?.done || [])])].sort((x: number, y: number) => x - y);
  const scores: Record<string, number> = { ...(a?.scores || {}) };
  for (const [k, v] of Object.entries(b?.scores || {})) scores[k] = Math.max(Number(scores[k] || 0), Number(v || 0));
  return { done, scores };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { action, id_token, access_token, progress } = body;

  // ยืนยันตัวตน → ได้ตัวกรองว่าผู้เรียกเป็นเจ้าของแถวไหน
  let lineUserId: string | null = null;
  let authUserId: string | null = null;
  if (id_token) {
    const channelId = await loadChannelId();
    const v = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token, client_id: channelId }),
    });
    if (!v.ok) return json({ error: "line verify failed" }, 401);
    lineUserId = (await v.json()).sub;
  } else if (access_token) {
    const { data, error } = await supa.auth.getUser(access_token);
    if (error || !data?.user) return json({ error: "supabase auth failed" }, 401);
    authUserId = data.user.id;
  } else {
    return json({ error: "missing token" }, 401);
  }

  const col = lineUserId ? "line_user_id" : "auth_user_id";
  const val = lineUserId || authUserId;

  if (action === "load") {
    const { data } = await supa.from("course_progress").select("done, scores").eq(col, val).maybeSingle();
    return json({ ok: true, progress: data || { done: [], scores: {} } });
  }

  if (action === "save") {
    const { data: existing } = await supa.from("course_progress")
      .select("customer_id, done, scores").eq(col, val).maybeSingle();
    const merged = mergeProgress(existing || {}, progress || {});
    if (existing?.customer_id) {
      await supa.from("course_progress").update({ done: merged.done, scores: merged.scores, updated_at: new Date().toISOString() }).eq("customer_id", existing.customer_id);
    } else {
      // ยังไม่มีแถว (เคสหายาก: save ก่อน auth-line-link) → ผูกกับลูกค้าที่มี id ตรง provider
      const { data: cust } = await supa.from("customers").select("id").eq(col, val).maybeSingle();
      await supa.from("course_progress").upsert({
        customer_id: cust?.id || (lineUserId ? "line_" + lineUserId : "auth_" + authUserId),
        line_user_id: lineUserId, auth_user_id: authUserId,
        done: merged.done, scores: merged.scores, updated_at: new Date().toISOString(),
      }, { onConflict: "customer_id" });
    }
    return json({ ok: true, progress: merged });
  }

  return json({ error: "unknown action" }, 400);
});
