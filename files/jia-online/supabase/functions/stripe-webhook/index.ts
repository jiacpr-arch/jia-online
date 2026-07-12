// stripe-webhook
// รับ webhook จาก Stripe (checkout.session.completed) แล้วมาร์ก payment_status = "ชำระแล้ว"
// ดึงเข้า repo จากโค้ดที่ deploy อยู่จริง (เดิมไม่เคย commit) — สิ่งที่แก้จากของเดิม:
//   เดิม match แถวด้วย phone + payment_status='รอชำระ' — ถ้ามีมากกว่า 1 แถว pending
//   ของเบอร์เดียวกัน (เช่นมีคนแทรก insert ปลอมเข้ามา) จะโดนมาร์กจ่ายแล้วไปด้วยทุกแถว
//   ตอนนี้ match ด้วย stripe_session_id ที่ stripe-checkout ผูกไว้กับแถวนั้นโดยเฉพาะ
//
// Auth: ตรวจ Stripe-Signature ด้วย STRIPE_WEBHOOK_SECRET (fail closed อยู่แล้วในโค้ดเดิม)
// Secrets ที่ใช้: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("No signature", { status: 400 });

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, endpointSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};
      const type = meta.type;

      console.log("✅ Payment completed:", type, meta);

      if (type === "online_purchase") {
        // match ด้วย stripe_session_id เป๊ะๆ — กันมาร์กแถวอื่นของเบอร์เดียวกันเป็นจ่ายแล้วไปด้วย
        await supabase
          .from("online_purchases")
          .update({
            payment_status: "ชำระแล้ว",
            paid_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id)
          .eq("payment_status", "รอชำระ");
      } else if (type === "booking") {
        const bookingId = meta.booking_id;
        if (bookingId) {
          await supabase
            .from("bookings")
            .update({
              payment_status: "ชำระแล้ว",
              payment_mode: "Stripe",
              stripe_session_id: session.id,
            })
            .eq("id", bookingId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
