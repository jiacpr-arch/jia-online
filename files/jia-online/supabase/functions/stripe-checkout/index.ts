// stripe-checkout
// สร้าง Stripe Checkout Session — ดึงเข้า repo จากโค้ดที่ deploy อยู่จริง (เดิมไม่เคย commit)
// แล้วปิดช่องโหว่: เดิม client ส่ง amount/items มาเองแล้วฟังก์ชันเชื่อตรงๆ ไม่ตรวจสอบเลย
//
// สำหรับ type === "online_purchase" (ซื้อบทเรียนออนไลน์ — path เดียวที่แอปนี้ใช้จริง):
//   - คำนวณราคาใหม่ฝั่ง server จาก metadata.modules (ไม่เชื่อ items/amount จาก client)
//   - สร้างแถว online_purchases (status "รอชำระ") ฝั่ง server เอง ก่อนเรียก Stripe แล้วผูก
//     stripe_session_id ของแถวนั้นกับ session ที่สร้างจริง — กัน webhook match ผิดแถว
//   - ต่อท้าย successUrl ด้วย session_id={CHECKOUT_SESSION_ID} ให้ Stripe แทนค่าให้เอง
// type อื่น (เช่น "booking") ยังไม่มีที่ไหนในแอปเรียกใช้ — คงพฤติกรรมเดิม (เชื่อ client) ไว้ก่อน
//
// POST { type, items, metadata:{phone,modules,name}, successUrl, cancelUrl }
// Secrets ที่ใช้: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY (มีอยู่แล้ว)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ต้องตรงกับ PRICING/calcPrice ใน src/App.jsx — ห้ามเชื่อราคาจาก client อีกต่อไป
const PRICING = { single: 35, bundle3: 100, full: 149 };
function calcPrice(count: number): number {
  if (count >= 6) return PRICING.full;
  const tiered = count >= 3
    ? Math.floor(count / 3) * PRICING.bundle3 + (count % 3) * PRICING.single
    : count * PRICING.single;
  return Math.min(tiered, PRICING.full);
}
// id 1 ฟรีอยู่แล้ว, id 7 คือแบบทดสอบสุดท้าย (ปลดล็อกอัตโนมัติเมื่อผ่านบท 1-6) — ซื้อได้เฉพาะ 2-6
const MODULE_NAMES: Record<number, string> = {
  2: "บทที่ 2: CPR ทารก",
  3: "บทที่ 3: สิ่งอุดกั้นทางเดินหายใจ ผู้ใหญ่",
  4: "บทที่ 4: สิ่งอุดกั้นทางเดินหายใจ ทารก",
  5: "บทที่ 5: Megacode — CPR & AED ผู้ใหญ่",
  6: "บทที่ 6: Megacode — CPR & AED ทารก/เด็ก",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { type, items, metadata, successUrl, cancelUrl } = await req.json();

    if (type === "online_purchase") {
      const phone = String(metadata?.phone || "").trim();
      const name = String(metadata?.name || "").trim();
      if (!phone) return json({ error: "missing phone" }, 400);

      const modIds = String(metadata?.modules || "")
        .split(",").map((s: string) => parseInt(s, 10))
        .filter((n: number) => Number.isInteger(n));
      const uniqueMods = [...new Set(modIds)].filter((id) => MODULE_NAMES[id]);
      if (!uniqueMods.length) return json({ error: "no valid modules" }, 400);

      const amount = calcPrice(uniqueMods.length);
      const lineItems = [{
        price_data: {
          currency: "thb",
          product_data: { name: `JIA Online: ${uniqueMods.map((id) => MODULE_NAMES[id]).join(", ")}` },
          unit_amount: amount * 100,
        },
        quantity: 1,
      }];

      // สร้างแถว "รอชำระ" ฝั่ง server ก่อนเรียก Stripe — client ไม่ต้อง insert เองอีกต่อไป
      const { data: pending, error: insertErr } = await supa
        .from("online_purchases")
        .insert({ phone, modules: uniqueMods.join(","), amount, payment_status: "รอชำระ" })
        .select("id")
        .single();
      if (insertErr || !pending) {
        console.error("online_purchases insert error:", insertErr);
        return json({ error: "create pending purchase failed" }, 500);
      }

      // ต่อ query string ตรงๆ (ห้ามผ่าน URLSearchParams — จะเข้ารหัส {} ทิ้ง ทำให้ Stripe
      // ไม่แทนค่า placeholder ให้)
      const base = successUrl || "https://cpr.morroo.com/";
      const sep = base.includes("?") ? "&" : "?";
      const successUrlFinal = `${base}${sep}session_id={CHECKOUT_SESSION_ID}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "promptpay"],
        line_items: lineItems,
        mode: "payment",
        success_url: successUrlFinal,
        cancel_url: cancelUrl || "https://cpr.morroo.com",
        metadata: { type: "online_purchase", phone, modules: uniqueMods.join(","), name, purchase_id: pending.id },
      });

      await supa.from("online_purchases").update({ stripe_session_id: session.id }).eq("id", pending.id);

      return json({ url: session.url, sessionId: session.id });
    }

    // type อื่น (เช่น booking) — ยังไม่มี caller ในแอปนี้ วันนี้คงพฤติกรรมเดิมไว้ก่อน
    const lineItems = (items || []).map((item: { name: string; amount: number; quantity?: number }) => ({
      price_data: {
        currency: "thb",
        product_data: { name: item.name },
        unit_amount: item.amount * 100,
      },
      quantity: item.quantity || 1,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "promptpay"],
      line_items: lineItems,
      mode: "payment",
      success_url: successUrl || "https://cpr.morroo.com",
      cancel_url: cancelUrl || "https://cpr.morroo.com",
      metadata: { type: type || "general", ...(metadata || {}) },
    });
    return json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return json({ error: err.message }, 400);
  }
});
