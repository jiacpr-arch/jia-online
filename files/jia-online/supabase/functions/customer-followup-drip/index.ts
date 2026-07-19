// customer-followup-drip
// ระบบตามลูกค้าอัตโนมัติทาง LINE (เฟส 2) — enqueue ตามเงื่อนไข แล้วส่งคิวที่ค้าง
//
// กลุ่มที่ตาม:
//   A) จบคอร์สออนไลน์แล้ว แต่ยังไม่จอง on-site  → unpaid_d0 / d3 / d7 (มีคูปอง)
//   B) เรียนค้าง (กำลังเรียน)                    → stuck_d2 / d5
//   (3 เดือน / 11 เดือน enqueue โดย online-course-broadcast?action=enqueue)
//
// Safeguards: ส่งเฉพาะ customer ที่มี line_user_id, กันส่งซ้ำ (customer_id+type),
//   เฉพาะคนที่อยู่ในกรอบเวลา (กัน backlog), และ kill-switch DRIP_ENABLED
//
// Auth: ?key=<CRON_KEY>  |  actions: run (default) | preview (ไม่ส่ง/ไม่บันทึก) | send | status

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TENANT = "jiaroo";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_KEY = Deno.env.get("CRON_KEY") || ""; // ตั้งผ่าน env เท่านั้น — ห้าม hardcode
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const DAY = 86400000;
const FOOTER = "— JIA TRAINER CENTER";

async function loadToken(): Promise<string> {
  const env = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
  if (env) return env;
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "LINE_CHANNEL_ACCESS_TOKEN").maybeSingle();
  return data?.value || "";
}

// kill-switch: ส่งจริงเฉพาะเมื่อ jiaroo_secrets.DRIP_ENABLED = 'on'
async function dripEnabled(): Promise<boolean> {
  const env = Deno.env.get("DRIP_ENABLED");
  if (env) return env === "on";
  const { data } = await supa.from("jiaroo_secrets").select("value")
    .eq("tenant_slug", TENANT).eq("key", "DRIP_ENABLED").maybeSingle();
  return (data?.value || "off") === "on";
}

// ===== บทข้อความ =====
function couponLine(code: string | null) {
  return code ? `🎁 คูปองส่วนลด ฿100 คอร์สภาคปฏิบัติ on-site (โค้ด ${code})`
              : `🎁 มีคูปองส่วนลด ฿100 คอร์สภาคปฏิบัติ on-site (พิมพ์ขอรับโค้ดได้เลย)`;
}
// paid = นักเรียน pre-course (จ่ายค่าคอร์ส on-site แล้ว) — ข้อความต้องไม่พูดถึงคูปอง/ส่วนลด
// ไม่งั้นนักเรียนเข้าใจว่ามีส่วนลดค้างอยู่แล้วมาขอเงินคืน
const MSG: Record<string, (name: string, code: string | null, paid?: boolean) => string> = {
  unpaid_d0: (n, c) => `สวัสดีคุณ ${n} 🎉\nยินดีด้วยที่จบคอร์ส CPR & AED ออนไลน์! 🏆\n\nทฤษฎีแน่นแล้ว เหลือ "ลงมือจริง" กับหุ่นให้มั่นใจ 💪\n${couponLine(c)}\n\nสนใจรอบไหน พิมพ์ตอบกลับได้เลย เดี๋ยวจัดให้ครับ\n${FOOTER}`,
  unpaid_d3: (n, c) => `คุณ ${n} ครับ 🚑\nงานวิจัยบอกว่าคนที่ "ฝึกกับหุ่นจริง" ช่วยชีวิตได้มั่นใจกว่าหลายเท่า\n\nคอร์ส on-site ใช้เวลาแค่ครึ่งวัน ได้ใบเซอร์ภาคปฏิบัติ + ฝึกใช้ AED จริง\n${couponLine(c)}\nอยากได้รอบเสาร์/อาทิตย์ บอกได้นะครับ\n${FOOTER}`,
  unpaid_d7: (n, c) => `คุณ ${n} 😊 ${couponLine(c)} ยังใช้ได้อยู่นะครับ\nถ้ามีคำถามเรื่องวันเวลา/สถานที่/ราคา พิมพ์ถามได้เลย ยินดีช่วยเลือกให้ครับ\n${FOOTER}`,
  stuck_d2: (n, _c, paid) => paid
    ? `คุณ ${n} 👋 เห็นว่าเรียนทฤษฎี CPR ออนไลน์ค้างไว้นิดเดียวเอง!\nเรียนให้จบก่อนวันอบรม จะได้เต็มที่กับการฝึกภาคปฏิบัติครับ\n👉 เรียนต่อ: cpr.morroo.com\n${FOOTER}`
    : `คุณ ${n} 👋 เห็นว่าเรียน CPR ออนไลน์ค้างไว้นิดเดียวเอง!\nเหลืออีกไม่กี่บทก็ได้ใบประกาศ + คูปองส่วนลดแล้วนะครับ\n👉 เรียนต่อ: cpr.morroo.com\n${FOOTER}`,
  stuck_d5: (n, _c, paid) => paid
    ? `คุณ ${n} 💪 ทักษะ CPR ช่วยชีวิตคนใกล้ตัวได้จริง อย่าเพิ่งหยุดกลางทางนะครับ\nเรียนทฤษฎีให้จบก่อนวันเข้าคลาส แล้วพบกันในวันอบรมครับ\n👉 cpr.morroo.com\n${FOOTER}`
    : `คุณ ${n} 💪 ทักษะ CPR ช่วยชีวิตคนใกล้ตัวได้จริง อย่าเพิ่งหยุดกลางทางนะครับ\nเรียนจบรับใบประกาศ + คูปอง on-site ฿100 ฟรีๆ\n👉 cpr.morroo.com\n${FOOTER}`,
};

// เลือกสเต็ปตามจำนวนวัน (มีกรอบเวลา กัน backlog ถ้าผูก LINE ช้า)
function unpaidStep(days: number): string | null {
  if (days >= 1 && days <= 2) return "unpaid_d0";
  if (days >= 3 && days <= 5) return "unpaid_d3";
  if (days >= 7 && days <= 10) return "unpaid_d7";
  return null;
}
function stuckStep(days: number): string | null {
  if (days >= 2 && days <= 4) return "stuck_d2";
  if (days >= 5 && days <= 9) return "stuck_d5";
  return null;
}

async function enqueueDrip(preview: boolean) {
  const now = Date.now();
  const [studentsRes, custRes, bookingsRes, existingRes] = await Promise.all([
    supa.from("online_students").select("customer_id,name,status,completed_at,registered_at,coupon_code,pre_course").limit(10000),
    supa.from("customers").select("id,name,line_user_id").not("line_user_id", "is", null).limit(10000),
    supa.from("bookings").select("customer_id").not("customer_id", "is", null).limit(10000),
    supa.from("line_broadcasts").select("customer_id,type").limit(100000),
  ]);
  const custMap = new Map<string, { line_user_id: string; name: string }>();
  for (const c of custRes.data || []) if (c.line_user_id) custMap.set(c.id, { line_user_id: c.line_user_id, name: c.name });
  const booked = new Set<string>((bookingsRes.data || []).map((b: any) => b.customer_id));
  const already = new Set<string>((existingRes.data || []).map((r: any) => `${r.customer_id}|${r.type}`));

  const toInsert: any[] = [];
  for (const s of studentsRes.data || []) {
    const cust = s.customer_id ? custMap.get(s.customer_id) : null;
    if (!cust) continue; // ส่งเฉพาะคนที่ผูก LINE แล้ว
    const name = s.name || cust.name || "";
    const status = s.status || "";
    const preCourse = !!s.pre_course; // จ่ายค่าคอร์ส on-site แล้ว — ห้ามส่งข้อความขาย/คูปอง
    let type: string | null = null;
    if (status.startsWith("จบคอร์ส") && s.completed_at && !booked.has(s.customer_id)) {
      if (preCourse) continue; // จบทฤษฎีแล้ว รอเข้าคลาสที่จองไว้ — ไม่ต้องตามขาย on-site
      type = unpaidStep(Math.floor((now - new Date(s.completed_at).getTime()) / DAY));
    } else if (status === "กำลังเรียน" && s.registered_at) {
      type = stuckStep(Math.floor((now - new Date(s.registered_at).getTime()) / DAY));
    }
    if (!type) continue;
    if (already.has(`${s.customer_id}|${type}`)) continue;
    already.add(`${s.customer_id}|${type}`); // กันซ้ำในรอบเดียวกัน
    toInsert.push({
      customer_id: s.customer_id, line_user_id: cust.line_user_id, type,
      message_text: MSG[type](name, s.coupon_code || null, preCourse),
      scheduled_at: new Date().toISOString(), status: "pending",
    });
  }
  if (preview) {
    const byType: Record<string, number> = {};
    for (const r of toInsert) byType[r.type] = (byType[r.type] || 0) + 1;
    return { preview: true, would_enqueue: toInsert.length, by_type: byType, sample: toInsert.slice(0, 3).map(r => ({ type: r.type, text: r.message_text })) };
  }
  let enq = 0;
  for (const row of toInsert) { const r = await supa.from("line_broadcasts").insert(row); if (!r.error) enq++; }
  return { enqueued: enq };
}

async function sendPending(token: string, limit = 80) {
  if (!token) return { error: "no LINE token" };
  const { data: pending } = await supa.from("line_broadcasts").select("*")
    .eq("status", "pending").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(limit);
  if (!pending || pending.length === 0) return { sent: 0, failed: 0 };
  let sent = 0, failed = 0;
  for (const b of pending) {
    try {
      const r = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: b.line_user_id, messages: [{ type: "text", text: b.message_text }] }),
      });
      if (r.ok) { await supa.from("line_broadcasts").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", b.id); sent++; }
      else { const t = await r.text(); await supa.from("line_broadcasts").update({ status: "failed", error: `HTTP ${r.status}: ${t.slice(0, 400)}` }).eq("id", b.id); failed++; }
    } catch (e) { await supa.from("line_broadcasts").update({ status: "failed", error: String(e).slice(0, 400) }).eq("id", b.id); failed++; }
  }
  return { sent, failed };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  // fail closed: ถ้ายังไม่ตั้ง CRON_KEY ให้ปฏิเสธทุก request (กันยิงส่ง LINE มั่วเมื่อ config หลุด)
  if (!CRON_KEY) return new Response("server missing CRON_KEY", { status: 503 });
  const key = url.searchParams.get("key") || req.headers.get("x-cron-key") || "";
  if (key !== CRON_KEY) return new Response("unauthorized", { status: 401 });
  const action = url.searchParams.get("action") || "run";

  if (action === "status") {
    const [{ count: pending }, { count: sent }] = await Promise.all([
      supa.from("line_broadcasts").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supa.from("line_broadcasts").select("*", { count: "exact", head: true }).eq("status", "sent"),
    ]);
    return json({ ok: true, drip_enabled: await dripEnabled(), pending, sent });
  }
  if (action === "preview") return json(await enqueueDrip(true)); // ไม่บันทึก ไม่ส่ง

  if (!(await dripEnabled())) return json({ disabled: true, note: "ตั้ง jiaroo_secrets.DRIP_ENABLED='on' เพื่อเปิดส่งจริง" });

  if (action === "send") return json(await sendPending(await loadToken()));

  // default: enqueue + send
  const enq = await enqueueDrip(false);
  const snd = await sendPending(await loadToken());
  return json({ ...enq, ...snd, ran_at: new Date().toISOString() });
});

function json(o: unknown) { return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } }); }
