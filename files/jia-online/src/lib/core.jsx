// แกนกลางที่ใช้ร่วมกันระหว่างหน้าเว็บผู้เรียน (App.jsx) และหน้าแอดมิน (admin/Admin.jsx):
// แบรนด์/สี, config, helper Supabase/analytics/auth, ข้อมูลคอร์ส, ไอคอน, สไตล์
// แยกออกมาเพื่อให้หน้าแอดมินโหลดแบบ lazy (ผู้เรียนไม่ต้องดาวน์โหลดโค้ดแอดมิน ~1,800 บรรทัด)
import { track } from "@vercel/analytics";
import { useState } from "react";
import { shuffled } from "../game/storyEngine";

// ==================== BRAND ====================
export const B = { red: "#C8102E", dkRed: "#9B0020", black: "#1A1A1A", white: "#FFFFFF", cream: "#FFF8F0", gray: "#F5F5F5", ltGray: "#E8E8E8", dkGray: "#666", green: "#22C55E", gold: "#F59E0B" };
export const SERIF = "'Bai Jamjuree', 'Noto Sans Thai', sans-serif"; // ฟอนต์ใบประกาศ (หัวข้อ + ชื่อผู้เรียน)

// ========== CONFIG ==========
export const FREE_LAUNCH = false; // cutover แล้ว (ก.ค. 2569) — บทที่ 1 ฟรี บทที่เหลือเก็บเงินตาม PRICING, Claim CTA เปิดใช้งาน
export const LAUNCH_END = "31 กรกฎาคม 2569";
export const LINE_URL = "https://line.me/R/ti/p/@jiacpr";
export const LINE_QR_URL = "https://qr-official.line.me/sid/L/jiacpr.png";
// ========== META PIXEL (Facebook Ads) ==========
// แมป event ภายใน → Meta standard event เพื่อใช้เป็นเป้า optimize โฆษณาได้ตรงๆ
// (base pixel code + PageView อยู่ใน index.html — dataset "morroo" 966371002896288)
export const FB_EVENT_MAP = {
  signup_complete: "CompleteRegistration",   // สมัครสำเร็จ = คอนเวอร์ชันหลัก
  register_complete: "CompleteRegistration", // ลงทะเบียนรับใบประกาศฯ
  line_oa_added: "Lead",                     // แอด LINE OA แล้ว
  line_oa_confirm_added: "Lead",             // กดยืนยัน "เพิ่มเพื่อนแล้ว"
  teaser_quiz_complete: "ViewContent",       // ทำควิซเกริ่นนำจบ (สนใจจริง)
};
export const fbTrack = (name, props) => {
  try {
    if (typeof window === "undefined" || !window.fbq) return;
    const std = FB_EVENT_MAP[name];
    if (std) window.fbq("track", std, props || {});
    else window.fbq("trackCustom", name, props || {}); // เก็บ event ที่เหลือไว้ทำ Custom Audience
  } catch (e) {}
};
export const safeTrack = (name, props) => { try { track(name, props); } catch(e) {} try { fbTrack(name, props); } catch(e) {} };
export const genLinkCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = ""; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
// token สุ่มต่อท้ายชื่อไฟล์สลิป — bucket เป็น public, ชื่อไฟล์เดิม (ชื่อ+timestamp) เดาได้ง่าย
export const randToken = () => Math.random().toString(36).slice(2, 10);
export const getLinkCode = () => { let code = load("line_link_code", null); if (!code) { code = genLinkCode(); save("line_link_code", code); } return code; };
// ล้างสถานะผู้เรียนทั้งหมด (เปลี่ยนคนเรียนบนเครื่องเดิม) — ลบทุกคีย์ jia_* ยกเว้นเซสชันแอดมิน
// กันเคสคนใหม่สืบทอด signed_up/purchased/promo ของคนเก่า แล้วข้ามหน้าสมัคร/รับโค้ดไม่ได้
export const ADMIN_LS_KEYS = new Set(["jia_admin_auth", "jia_admin_key"]);
export const resetLearner = () => {
  try {
    const rm = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("jia_") && !ADMIN_LS_KEYS.has(k)) rm.push(k);
    }
    rm.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
};
// ข้อความ prefill ที่ลูกค้ากดส่งเข้า @jiacpr — โค้ด JIA-LINK ต้องอยู่หน้าสุดเสมอ (webhook ภายนอกจับคู่กับ customers.line_link_code → เขียน line_user_id กลับ)
// นักเรียน pre-course จ่ายเงิน+จองคลาสแล้ว — ข้อความต้องไม่อ้างว่า "ได้รับส่วนลด" (กันเข้าใจผิดเรื่องเงินคืน)
export const lineLinkDeepLink = (code) => `https://line.me/R/oaMessage/%40jiacpr/?${encodeURIComponent("JIA-LINK-" + code + "\n" + (isPreCourseStudent()
  ? "สนใจคอร์ส CPR & AED 🙏 กำลังเรียนทฤษฎีออนไลน์ก่อนเข้าคลาส (pre-course) มีคำถามเรื่องวันอบรมภาคปฏิบัติ สอบถามได้ไหมครับ/คะ"
  : "สนใจคอร์ส CPR & AED 🙏 เรียนออนไลน์อยู่และได้รับส่วนลดแล้ว อยากนัดวันมาเรียนภาคปฏิบัติ ไม่ทราบว่าสะดวกวันไหนบ้างครับ/ค่ะ"))}`;
export const markLineAdded = (user) => {
  save("line_added", true); save("line_added_at", new Date().toISOString());
  safeTrack("line_oa_added"); phCapture("line_oa_added", {});
  const u = user || load("user", null);
  if (u?.phone) {
    const tail = u.phone.replace(/\D/g, "").slice(-9);
    // ผูก line_link_code ไว้กับเรคคอร์ดลูกค้าก่อน เพื่อให้ line-webhook จับคู่ข้อความ "JIA-LINK-<code>" → เขียน line_user_id กลับได้
    supaRest("customers", "PATCH", { line_added: true, line_added_at: new Date().toISOString(), line_link_code: getLinkCode() }, `?tel=ilike.*${tail}`);
  }
};
export const SUPABASE_URL = "https://tpoiyykbgsgnrdwzgzvn.supabase.co";
export const SUPABASE_KEY = "sb_publishable_1kXSE788PB9XqH_2vU3pqg_6xtqI1Mf";

// ========== AUTH GATE (บังคับสมัครหลังจบบท 1) ==========
export const AUTH_GATE_ENABLED = true;          // เปิดด่านบังคับสมัคร (false = กลับไป flow เดิม)
export const LIFF_ID = "2010458255-JAxIKawy";     // LIFF ID จาก LINE Developers (PUBLIC) — channel "JIA CPR Online" / provider JiaTrainingcenter
// PUBLIC PostHog project key (override ได้ผ่าน env ใน Vercel) — hardcode ไว้เพราะก่อนหน้านี้ env ไม่ได้ตั้ง
// ทำให้ PostHog เงียบสนิท วัดผลโฆษณาไม่ได้ (โปรเจกต์ "Default project" org JiaLucksa, us.posthog.com)
export const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || "phc_zYMrFeM7HEGEBUdgeyixzNw24pt5XUom38QAAJfAwgLr";
export const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
export const GATE_VARIANT_DEFAULT = "soft"; // soft (แอด LINE แบบข้ามได้ ลด drop) | before-course (ควิซเกริ่นนำ→สมัคร→เข้าคอร์ส) | after-lesson-1
export const FN_URL = (n) => `${SUPABASE_URL}/functions/v1/${n}`;
// LINE เป็นล็อกอินหลักของทั้ง cpr.morroo.com และ class.jiacpr.com (คนละเว็บ บัญชีเดียวกัน) —
// เรียก edge function "line-auth" ของ Hub (repo jia-learning-hub) ตรง ๆ จากเบราว์เซอร์ ไม่ใช่ของเว็บนี้เอง
export const HUB_LINE_AUTH_URL = FN_URL("line-auth");
// ห้ามใส่ Authorization ตรงนี้ — line-auth ตีความ header Bearer ว่าเป็นโหมด "เชื่อมบัญชีที่ล็อกอินอยู่แล้ว"
// (link mode) ถ้าส่ง publishable key ไปจะถูกตีความเป็น token ผู้ใช้ปลอม แล้วโดนปฏิเสธด้วย 401
export const LINE_AUTH_HEADERS = { "Content-Type": "application/json", apikey: SUPABASE_KEY };

// ========== PRICING ==========
export const PRICING = {
  single: 35,       // ฿35 ต่อหัวข้อ
  bundle3: 100,     // ฿100 ต่อ 3 หัวข้อ
  full: 149,        // ฿149 Full Course + Final Exam
  freeModule: 1,    // บทที่ 1 ฟรี (CPR ผู้ใหญ่)
};

// ========== PROMO CODE (Lead Capture) ==========
export const PROMO_ENABLED = true;                 // เปิดระบบ lead-capture (ปิดเพื่อซ่อน CTA ทั้งหมด)
export const PROMO_FREE_MODULES = [1, 2, 3];       // โค้ดปลดล็อก: CPR ผู้ใหญ่ + ทารก + Choking ผู้ใหญ่
export const PROMO_EXPIRY_DAYS = 7;                // โค้ดหมดอายุภายใน 7 วันหลัง claim
export const PROMO_CODE_PREFIX = "LEAD-";          // prefix แยกจาก JIA- (on-site coupon)
export const VOUCHER_ALL_MODULES = [1, 2, 3, 4, 5, 6, 7]; // voucher เต็มคอร์ส: ปลดล็อกทุกบท + แบบทดสอบสุดท้าย
export const STANDING_NEVER_EXPIRES = "2099-12-31T23:59:59Z"; // sentinel: โค้ดกลางที่ตั้งให้ไม่หมดอายุ
export const VOUCHER_SOURCES = [
  { value: "voucher_sale", label: "ขาย Voucher" },
  { value: "pre_course",   label: "Pre-course (ก่อนเข้าคลาสจริง)" },
];
export const LEAD_SOURCES = [
  { value: "facebook",  label: "Facebook (เพจ JIA หรือกลุ่ม)" },
  { value: "tiktok",    label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "line_oa",   label: "LINE Official @jiacpr" },
  { value: "google",    label: "Google ค้นหา" },
  { value: "friend",    label: "เพื่อน/คนรู้จักแนะนำ" },
  { value: "workplace", label: "ที่ทำงาน/โรงเรียน" },
  { value: "youtube",   label: "YouTube" },
  { value: "event",     label: "งาน/อีเวนต์ออฟไลน์" },
  { value: "other",     label: "อื่นๆ (โปรดระบุ)" },
];

// ========== PARTNER COUPON (QR ใบละ 1 สิทธิ์ — ธุรกิจพันธมิตรแจกให้ลูกค้าเรียนคอร์สเต็มฟรี) ==========
export const SITE_URL = "https://cpr.morroo.com";
export const PARTNER_SOURCE = "partner_coupon";
export const genPartnerCode = (prefix) => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = (prefix || "JIA") + "-"; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
// LINE ID พาร์ทเนอร์ → ลิงก์เปิดแชต: ใส่ลิงก์เต็มมาก็ใช้ตรงๆ, "@..." = LINE OA, อื่นๆ = LINE ส่วนตัว (เลข ID)
export const partnerLineUrl = (v) => {
  const s = (v || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("@")) return `https://line.me/R/ti/p/${encodeURIComponent(s)}`;
  return `https://line.me/ti/p/~${encodeURIComponent(s)}`;
};
export const getPartnerSponsor = () => load("partner_sponsor", null);

export const supaRest = async (table, method = "GET", body = null, filters = "") => {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
  if (method === "POST" || method === "PATCH") h.Prefer = "return=representation";
  const opts = { method, headers: h };
  if (body && method !== "GET" && method !== "DELETE") opts.body = JSON.stringify(body);
  try { const res = await fetch(url, opts); return res.ok ? (await res.text().then(t => t ? JSON.parse(t) : [])) : []; } catch(e) { console.error("Supabase:", e); return []; }
};

// เรียก SECURITY DEFINER RPC (ใช้กับ lead_promo_codes ที่ปิด anon SELECT/INSERT/UPDATE ตรงแล้ว)
// ฟังก์ชันคืน TABLE → PostgREST ส่งกลับเป็น array; error → คืน null
export const supaRpc = async (fn, args = {}) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  } catch (e) { console.error("Supabase RPC:", e); return null; }
};

// ===== Admin data access ผ่าน server-side admin-api (ใช้ service_role หลังด่านรหัสแอดมิน) =====
// รหัสแอดมินถูกส่งเป็น x-admin-key ให้ edge function ตรวจฝั่ง server แล้วจึงเข้าถึงข้อมูล
// (เลิกใช้ anon key อ่าน/เขียนตาราง PII จากฝั่ง client — ตัด client-trust)
export let _adminKey = null;
try { _adminKey = sessionStorage.getItem("jia_admin_key") || null; } catch (e) {}
export const setAdminKey = (k) => { _adminKey = k || null; try { if (k) sessionStorage.setItem("jia_admin_key", k); else sessionStorage.removeItem("jia_admin_key"); } catch (e) {} };
export const adminRest = async (table, method = "GET", body = null, filters = "") => {
  try {
    const res = await fetch(FN_URL("admin-api"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "x-admin-key": _adminKey || "" },
      body: JSON.stringify({ table, method, filters, body }),
    });
    if (!res.ok) return [];
    const t = await res.text(); return t ? JSON.parse(t) : [];
  } catch (e) { console.error("adminApi:", e); return []; }
};
export const adminPing = async (key) => {
  try {
    const res = await fetch(FN_URL("admin-api"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "x-admin-key": key || "" },
      body: JSON.stringify({ table: "__ping" }),
    });
    return res.ok;
  } catch (e) { return false; }
};
export const genCoupon = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = "JIA-"; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };

// ออกคูปอง ฿100 ผ่าน RPC ฝั่งเซิร์ฟเวอร์ (class.jiacpr.com's public.issue_online_coupon) แทนการสุ่มโค้ด
// เองแล้ว POST เข้า promo_codes ตรงจาก client แบบเดิม (Hub ปิด anon insert บนตารางนี้แล้ว — ช่องโหว่เดิม)
// เซิร์ฟเวอร์ตรวจสิทธิ์จาก customer_id + เบอร์โทรที่ตรงกับ public.customers และต้องมี
// online_students.completed_at ของ customer นั้นตั้งไว้แล้วจึงจะออกโค้ดให้ (เรียกซ้ำปลอดภัย คืนโค้ดเดิม)
// คืน null ถ้าออกไม่สำเร็จ (ยังไม่ผ่านเกณฑ์ / ไม่มี customer_id ฯลฯ) — ผู้เรียกต้องรับมือกรณีนี้เอง
export const issueOnlineCoupon = async (customerId, phone) => {
  const cleanPhone = (phone || "").replace(/\D/g, "");
  if (!customerId || cleanPhone.length < 9) return null;
  const res = await supaRpc("issue_online_coupon", { p_customer_id: customerId, p_phone: cleanPhone });
  return res && res.issued && res.code ? res.code : null;
};

// แคมเปญคูปองจากเกม — แจกเฉพาะช่วงแคมเปญเท่านั้น (นอกช่วง ชนะเกมจะไม่ออกคูปอง) + คูปองหมดอายุวันสุดท้ายของช่วง
// ✏️ เพิ่ม/แก้แถวเพื่อเปิดแคมเปญใหม่ (YYYY-MM-DD ตามเวลาไทย) — แคมเปญวันเดียวใช้ start = end
// key = ลิงก์เฉพาะกิจ: คูปองออกเฉพาะคนที่เข้าผ่าน ?camp=<key> เท่านั้น (คนเข้าเว็บเองไม่ได้) — ไม่ใส่ key = ได้ทุกคนในช่วงวัน
// unlockCourse = เข้าผ่านลิงก์ในวันแคมเปญ → ปลดคอร์สออนไลน์ครบทุกบท (สิทธิ์ติดเครื่องถาวร เรียนต่อ/สอบ/
// รับใบประกาศวันหลังได้ — รับสิทธิ์ได้เฉพาะวันแคมเปญเท่านั้น; ด่านสมัคร+ดูวิดีโอ+สอบ ยังบังคับตามปกติ)
export const GAME_VOUCHER_CAMPAIGNS = [
  { start: "2026-08-06", end: "2026-08-06", event: "แคมเปญ LINE @jiacpr", key: "line0806", unlockCourse: true }, // auto-reply แอด LINE OA 6 ส.ค. — วันเดียว + ผ่านลิงก์เท่านั้น
  { start: "2026-10-01", end: "2026-10-31", event: "งาน TCAS Fair" },
];
export const activeGameVoucherCampaign = () => {
  const t = todayISOTH();
  return GAME_VOUCHER_CAMPAIGNS.find(c => t >= c.start && t <= c.end && (!c.key || load("game_camp", null) === c.key)) || null;
};
export const todayISOTH = () => { const t = new Date(Date.now() + 7 * 3600 * 1000); return t.toISOString().slice(0, 10); }; // วันนี้เวลาไทย (UTC+7)
export const thaiShortDate = (iso) => { try { const [y, m, d] = iso.split("-").map(Number); const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return `${d} ${months[m - 1]} ${(y + 543) % 100}`; } catch (e) { return iso; } };
export const genLeadCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = PROMO_CODE_PREFIX; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
export const VOUCHER_CODE_PREFIX = "VCH-"; // voucher เต็มคอร์ส (ขาย/pre-course) — แยก prefix จาก LEAD- (lead-capture ฟรี 3 บท)
export const genVoucherCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = VOUCHER_CODE_PREFIX; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
export const normalizePhone = (s) => (s || "").replace(/\D/g, "");
export const normalizeEmail = (s) => (s || "").trim().toLowerCase();
export const daysUntil = (iso) => { if (!iso) return 0; const ms = new Date(iso).getTime() - Date.now(); return Math.max(0, Math.ceil(ms / 86400000)); };
export const genIdempotencyKey = (email, phone) => `${normalizeEmail(email)}|${normalizePhone(phone)}|${Math.floor(Date.now() / 60000)}`.slice(0, 80);
export const save = (k, v) => { try { localStorage.setItem(`jia_${k}`, JSON.stringify(v)); } catch(e){} };
export const load = (k, d) => { try { const v = localStorage.getItem(`jia_${k}`); return v ? JSON.parse(v) : d; } catch(e){ return d; } };

// ========== QUIZ RANDOMIZATION ==========
// สุ่มโจทย์จากคลัง + สลับลำดับตัวเลือก พร้อม remap เฉลย ทุกครั้งที่เข้าทำแบบทดสอบ
export const QUIZ_DRAW_N = (mod) => (mod.vid ? 5 : 10); // บทเรียน 5 ข้อ, ข้อสอบสุดท้าย 10 ข้อ
// เฉลยไม่อยู่ในบันเดิลแล้ว (ย้ายไป edge function grade-quiz) — จำ index คำถามต้นฉบับ (i)
// และลำดับสุ่มของตัวเลือก (order) ไว้ เพื่อแปลงคำตอบกลับเป็น index ต้นฉบับตอนส่งตรวจ
export const drawQuiz = (mod) =>
  shuffled(mod.quiz.map((q, i) => ({ ...q, i }))).slice(0, Math.min(QUIZ_DRAW_N(mod), mod.quiz.length)).map((q) => {
    const order = shuffled(q.c.map((_, i) => i));
    return { q: q.q, c: order.map((i) => q.c[i]), i: q.i, order };
  });

// ========== AUTH HELPERS (LIFF / Supabase Auth / PostHog — โหลดแบบ on-demand) ==========
export let _liff = null;
export const loadLiff = async () => {
  if (_liff) return _liff;
  if (!LIFF_ID) return null;
  try { const mod = await import("@line/liff"); const liff = mod.default || mod; await liff.init({ liffId: LIFF_ID }); _liff = liff; return liff; }
  catch (e) { console.error("liff init", e); return null; }
};
export let _supa = null;
export const getSupabase = async () => {
  if (_supa) return _supa;
  const { createClient } = await import("@supabase/supabase-js");
  _supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _supa;
};
export let _ph = null, _phTried = false;
export const getPosthog = async () => {
  if (_phTried) return _ph;
  _phTried = true;
  if (!POSTHOG_KEY) return null;
  // capture_pageview: true → ได้ $pageview พร้อม utm_* /fbclid อัตโนมัติทุกครั้งที่เปิด (ไว้วัดผลโฆษณา)
  try { const mod = await import("posthog-js"); const posthog = mod.default || mod; posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, capture_pageview: true }); _ph = posthog; return posthog; }
  catch (e) { return null; }
};
export const phCapture = (name, props) => { getPosthog().then(ph => { try { ph && ph.capture(name, props); } catch(e){} }); };

export const getGateVariant = () => load("gate_variant", GATE_VARIANT_DEFAULT);
export const isSignedUp = () => { const u = load("user", null); return !!(load("signed_up", false) || u?.line_user_id || u?.auth_user_id); };
// นักเรียน pre-course = redeem โค้ดที่ source เป็น pre_course (เช่น JIA-STUDENT) — จ่ายค่าคอร์ส
// on-site เต็มราคาแล้ว ห้ามออก/แสดงคูปองส่วนลด ฿100 ซ้ำ (ไม่งั้นถูกทวงส่วนลด/ขอเงินคืน)
export const isPreCourseStudent = () => !!load("pre_course_student", false);

// UTM: เก็บครั้งแรกที่เข้า ก่อน replaceState จะลบ query ทิ้ง
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
export const captureUTM = () => {
  try {
    const p = new URLSearchParams(window.location.search); const got = {};
    UTM_KEYS.forEach(k => { const v = p.get(k); if (v) got[k] = v; });
    if (Object.keys(got).length && !load("utm", null)) { save("utm", got); save("landing_url", window.location.href.slice(0, 500)); }
  } catch (e) {}
};
export const getUTM = () => load("utm", {});

export const mergeProgressLocal = (a, b) => {
  const done = [...new Set([...(a?.done || []), ...(b?.done || [])])].sort((x, y) => x - y);
  const scores = { ...(a?.scores || {}) };
  for (const [k, v] of Object.entries(b?.scores || {})) scores[k] = Math.max(Number(scores[k] || 0), Number(v || 0));
  return { done, scores };
};

export const FN_HEADERS = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// บันทึก progress ขึ้น account (เรียนต่อข้ามเครื่อง) — เรียกหลัง save("progress") ทุกครั้งถ้า signedUp
// มี auth_user_id (ล็อกอิน LINE แล้ว) → ใช้ access token สดจาก supabase-js เสมอ (auto-refresh เอง)
// แทนที่จะใช้ line_id_token ที่เก็บไว้ตอนล็อกอินซึ่งหมดอายุใน ~1 ชม. แล้ว sync เงียบ ๆ ใช้ไม่ได้อีก
export const syncProgressRemote = async (np) => {
  try {
    const u = load("user", null); if (!u) return;
    if (u.auth_user_id) {
      const supa = await getSupabase();
      const { data: { session } } = await supa.auth.getSession();
      if (session?.access_token) {
        await fetch(FN_URL("account-progress"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ action: "save", access_token: session.access_token, progress: np }) });
        return;
      }
    }
    if (u.line_user_id) { const idt = load("line_id_token", null); if (idt) await fetch(FN_URL("account-progress"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ action: "save", id_token: idt, progress: np }) }); }
  } catch (e) {}
};

// ผูกโปรไฟล์กลางที่ Hub (learning_hub.people ผ่าน RPC public.jia_identity) — เรียกตรงจากเบราว์เซอร์ได้เลย
// เพราะเว็บนี้อยู่ Supabase โปรเจกต์เดียวกับ class.jiacpr.com (tpoiyykbgsgnrdwzgzvn) ไม่ต้องผ่าน /sso หรือ
// บัตรผ่านแบบที่แอปข้ามโปรเจกต์ (bls/acls) ต้องใช้ — แค่มี Supabase session ของโปรเจกต์นี้ (จาก LINE หรือ
// อีเมล) ก็เรียก RPC นี้ได้ทันที ให้ชื่อที่ยืนยันแล้ว/บัตรนักเรียนเป็นชุดเดียวกับ Hub และแอปอื่นในเครือ
// best-effort เสมอ (ไม่มีชื่อให้บันทึกก็แค่คืนโปรไฟล์เปล่า) — พังไม่กระทบ flow ล็อกอินเดิม
export const syncHubIdentity = async (supa, { nameTh = "", phone = "" } = {}) => {
  try {
    const { data: me } = await supa.rpc("jia_identity", { action: "me" });
    if (!me) return null;
    if (!me.profileComplete && nameTh && nameTh.trim().length >= 2) {
      const { data: saved } = await supa.rpc("jia_identity", { action: "saveProfile", payload: { nameTh: nameTh.trim(), phone: phone || "", pdpaConsent: true } });
      return saved || me;
    }
    return me;
  } catch (e) { return null; }
};
export const pickHub = (p) => (p ? { nameTh: p.nameTh, cardNo: p.cardNo, cardToken: p.cardToken, verifyLevel: p.verifyLevel, nameLocked: p.nameLocked } : undefined);

// เข้าสู่ระบบด้วย LINE — ล็อกอินหลักของทั้ง cpr.morroo.com และ class.jiacpr.com (บัญชีเดียวกัน)
// ลำดับ: LIFF login (ถ้ายังไม่ได้ล็อกอิน จะนำทางออกจากหน้าแล้วกลับมาทำต่อตอน mount) → line-auth ของ Hub
// (ยืนยัน id_token กับ LINE จริง คืน token_hash ใช้ครั้งเดียว ไม่ใช่ session ตรง ๆ) → แลกเป็น Supabase
// session ด้วย verifyOtp ฝั่งเบราว์เซอร์เอง → ผูกลูกค้าเดิม (ถ้าเคยกรอกชื่อ-เบอร์ไว้) เข้ากับบัญชีนี้ก่อน
// → auth-line-link (เดิม: upsert customers/course_progress + ออกคูปอง + ส่งข้อความต้อนรับ) → resolve
// ให้ตรงกับ Hub ผ่าน jia_online_account('me') แล้วค่อยบันทึกลง localStorage → sync โปรไฟล์กลาง (บัตรนักเรียน)
// silent=true = เรียกจากเอฟเฟกต์ auto-link เงียบ ๆ ในแอป LINE — ถ้ายังไม่ได้ล็อกอิน LIFF จะไม่บังคับ redirect
export const signInWithLine = async ({ phone = "", name = "", silent = false } = {}) => {
  const liff = await loadLiff();
  if (!liff) return null;
  if (!liff.isLoggedIn()) {
    if (silent) return null;
    save("line_login_pending", { phone, name, gate_variant: getGateVariant() });
    liff.login({ redirectUri: window.location.href });
    return null; // เบราว์เซอร์กำลังจะนำทางออกไปหน้า LINE login
  }
  let idToken = null; try { idToken = liff.getIDToken(); } catch (e) {}
  if (!idToken) return null;

  const callLineAuth = async () => {
    const res = await fetch(HUB_LINE_AUTH_URL, { method: "POST", headers: LINE_AUTH_HEADERS, body: JSON.stringify({ idToken }) });
    let data = {}; try { data = await res.json(); } catch (e) {}
    return { ok: res.ok, data };
  };
  let result = await callLineAuth();
  if (!result.ok) {
    // id_token ที่ LIFF ถืออยู่หมดอายุ (~1 ชม.) หรือ LIFF ค้าง session เก่า — บังคับล็อกอินใหม่หนึ่งครั้ง
    try { liff.logout(); } catch (e) {}
    if (silent) return null;
    save("line_login_pending", { phone, name, gate_variant: getGateVariant() });
    liff.login({ redirectUri: window.location.href });
    return null;
  }
  if (!result.data?.tokenHash) return null;

  const supa = await getSupabase();
  const { data: verified, error } = await supa.auth.verifyOtp({ token_hash: result.data.tokenHash, type: "magiclink" });
  if (error || !verified?.session) return null;
  const authUserId = verified.session.user.id;
  const switchedAccount = forgetOtherAccount(authUserId);
  if (switchedAccount) { phone = ""; name = ""; }

  // ผูกแถวลูกค้าเดิม (สมัครด้วยชื่อ+เบอร์แบบไม่ผ่าน LINE มาก่อน) เข้ากับบัญชี LINE ที่เพิ่งล็อกอิน
  // ก่อนเรียก auth-line-link เสมอ — ไม่งั้น auth-line-link จะมองว่าเป็นคนละคน (จับคู่ด้วย line_user_id
  // เท่านั้น โดยตั้งใจ กันคนอื่นยึดบัญชีด้วยการกรอกเบอร์ปลายทาง) แล้วสร้างแถวซ้ำ
  const localUser = load("user", null);
  if (localUser?.customer_id && !localUser?.auth_user_id && localUser?.phone) {
    try { await supa.rpc("jia_online_account", { action: "attachLocal", payload: { customerId: localUser.customer_id, phone: localUser.phone } }); } catch (e) {}
  }

  save("line_id_token", idToken);
  let profile = {}; try { profile = await liff.getProfile(); } catch (e) {}
  let isFriend = true; try { const fs = await liff.getFriendship(); isFriend = !!fs?.friendFlag; } catch (e) {}
  const usePhone = phone || localUser?.phone || "";
  const useName = name || localUser?.name || profile.displayName || "";
  const linkRes = await fetch(FN_URL("auth-line-link"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({
    id_token: idToken, phone: usePhone, pdpa: true, display_name: useName,
    utm: getUTM(), landing_url: load("landing_url", null), local_progress: load("progress", { done: [], scores: {} }),
    gate_variant: getGateVariant(),
    pre_course: isPreCourseStudent(), // ให้ server ข้ามการออกคูปอง ฿100 + ข้อความขายให้นักเรียน pre-course
  }) });
  let linkData = {}; try { linkData = await linkRes.json(); } catch (e) {}

  // ยืนยัน/เติมข้อมูลบัญชีให้ตรงกับที่ Hub เห็น (ผูก course_progress.auth_user_id ที่ auth-line-link
  // ยังไม่ทันเซ็ตด้วย เผื่อแถว course_progress มาจากรอบก่อนที่ migration cross-site ยังไม่ backfill)
  let meData = {}; try { const { data } = await supa.rpc("jia_online_account", { action: "me" }); meData = data || {}; } catch (e) {}
  const hubProfile = await syncHubIdentity(supa, { nameTh: meData.name || linkData.name || useName, phone: meData.phone || usePhone });

  const u = {
    name: meData.name || linkData.name || useName,
    phone: meData.phone || usePhone,
    line_user_id: linkData.line_user_id || meData.lineUserId,
    auth_user_id: authUserId,
    customer_id: meData.customerId || linkData.customer_id,
    hub: pickHub(hubProfile),
  };
  save("user", u); save("signed_up", true); save("enrolled", true);
  save("line_added", false); // ยืนยันแอดจริงตอนกด "เพิ่มเพื่อนแล้ว" (ตรวจ cross-provider ไม่ได้)
  let progress = linkData.progress || load("progress", { done: [], scores: {} });
  if (meData.progress) progress = mergeProgressLocal(progress, meData.progress);
  save("progress", progress);
  if (linkData.coupon && !isPreCourseStudent()) save("coupon", linkData.coupon);
  save("signup_pending", null); save("line_login_pending", null);
  safeTrack("signup_complete", { provider: "line", is_friend: isFriend });
  phCapture("signup_complete", { provider: "line", variant: getGateVariant() });
  if (switchedAccount) window.location.reload(); // หน้าจอยังถือความก้าวหน้า/ชื่อของบัญชีก่อนอยู่ในหน่วยความจำ
  return { user: u, progress, isFriend };
};

// ========== EMAIL IDENTITY (ทางเลือกสำรอง — LINE เป็นหลัก อีเมลเป็นรอง) ==========
// ไม่สร้างลูกค้าใหม่/ไม่แทนที่ flow สมัครเดิม — ใช้ "ผูก" (attachLocal) เข้ากับแถวลูกค้าที่มีอยู่แล้ว
// จากการสมัครด้วยชื่อ-เบอร์ (SignupGate/Register/Claim ทุกทาง) เข้ากับ Supabase session จริงที่ยืนยัน
// อีเมลแล้ว — เหมือนกับที่ signInWithLine ทำก่อนเรียก auth-line-link ทุกอย่าง เพียงแต่ไม่มี auth-line-link
// ให้เรียก (ฟังก์ชันนั้นผูกกับ id_token ของ LINE เท่านั้น) จึงไม่แตะ customers/online_students/coupon เลย
// ปลอดภัยกับทุก entry point ที่มีอยู่แล้วโดยไม่ต้องแก้ตรรกะการสร้างลูกค้า/คอร์สที่มีความเสี่ยงสูงกว่า
export const requestEmailIdentityOtp = async (email) => {
  const supa = await getSupabase();
  const { error } = await supa.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw Error(error.message || "ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่");
};
export const verifyEmailIdentityOtp = async ({ email, token }) => {
  const supa = await getSupabase();
  const { data, error } = await supa.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data?.session) throw Error("รหัส OTP ไม่ถูกต้องหรือหมดอายุ");
  const authUserId = data.session.user.id;
  const switchedAccount = forgetOtherAccount(authUserId);
  const localUser = load("user", null);
  if (localUser?.customer_id && !localUser?.auth_user_id && localUser?.phone) {
    try { await supa.rpc("jia_online_account", { action: "attachLocal", payload: { customerId: localUser.customer_id, phone: localUser.phone } }); } catch (e) {}
  }
  let meData = {}; try { const { data: d } = await supa.rpc("jia_online_account", { action: "me" }); meData = d || {}; } catch (e) {}
  const hubProfile = await syncHubIdentity(supa, { nameTh: localUser?.name || meData.name || "", phone: localUser?.phone || meData.phone || "" });
  const u = {
    ...(localUser || {}),
    name: meData.name || localUser?.name || "",
    phone: meData.phone || localUser?.phone || "",
    customer_id: meData.customerId || localUser?.customer_id,
    auth_user_id: authUserId,
    hub: pickHub(hubProfile) || localUser?.hub,
  };
  save("user", u); save("signup_pending", null);
  let progress = load("progress", { done: [], scores: {} });
  if (meData.progress) { progress = mergeProgressLocal(progress, meData.progress); save("progress", progress); }
  safeTrack("identity_verified", { provider: "email" }); phCapture("identity_verified", { provider: "email" });
  if (switchedAccount) window.location.reload(); // หน้าจอยังถือความก้าวหน้า/ชื่อของบัญชีก่อนอยู่ในหน่วยความจำ
  return { user: u, progress };
};

// ========== ออกจากระบบ (บัญชี JIA บนเครื่องนี้ + ที่ class.jiacpr.com) ==========
// cpr.morroo.com ลงทะเบียนที่ Hub เป็น client "cpr-online" — หน้า class.jiacpr.com/sso/logout ปิด session ของ Hub
// (ไม่งั้นคนถัดไปบนเครื่องเดียวกันเข้า Hub แล้วอยู่ในบัญชีเดิม) แล้วพากลับมาที่ return_path บนเว็บนี้
export const HUB_LOGOUT_URL = "https://class.jiacpr.com/sso/logout";
export const HUB_CLIENT_ID = "cpr-online";
export const HUB_REDIRECT_URI = "https://cpr.morroo.com/auth/hub/callback";
export const hasLiffLogin = () => { try { for (let i = 0; i < localStorage.length; i++) { if ((localStorage.key(i) || "").startsWith("LIFF_STORE:")) return true; } } catch (e) {} return false; };
// ปิด session บัญชีบนเครื่องนี้: Supabase ของเว็บนี้ (scope local — เครื่องอื่นของผู้เรียนไม่หลุด) + LINE Login ของ LIFF
// นอกแอป LINE (ไม่งั้นคนถัดไปกด "เข้าสู่ระบบด้วย LINE" แล้วได้บัญชี LINE เดิมทันทีโดยไม่ถาม)
export const endAccountSession = async () => {
  try { const supa = await getSupabase(); await supa.auth.signOut({ scope: "local" }); } catch (e) {}
  try {
    if (_liff || hasLiffLogin()) {
      const liff = await loadLiff();
      if (liff && !liff.isInClient() && liff.isLoggedIn()) liff.logout();
    }
  } catch (e) {}
};
// ไปหน้า logout ของ Hub (เฉพาะบนโดเมนจริง — Hub ส่งกลับได้แค่ origin ของ redirect ที่ลงทะเบียนไว้) ที่อื่นแค่โหลดหน้าใหม่
export const goHubLogout = (returnPath = "/") => {
  if (window.location.origin !== new URL(HUB_REDIRECT_URI).origin) { window.location.reload(); return; }
  const q = new URLSearchParams({ client_id: HUB_CLIENT_ID, redirect_uri: HUB_REDIRECT_URI, return_path: returnPath });
  window.location.assign(`${HUB_LOGOUT_URL}?${q.toString()}`);
};
// "ออกจากระบบ": ปิดบัญชีทุกที่ แต่เก็บข้อมูลการเรียนในเครื่องไว้ (บทที่ซื้อ/ปลดล็อกอยู่ในเครื่องนี้เท่านั้น — ล้างทิ้ง
// แล้ว login กลับมาก็ไม่คืน) จำไว้ว่าเป็นของบัญชีไหน (signed_out_account) → บัญชีเดิม login กลับมาเรียนต่อได้ทุกอย่าง,
// คนอื่น login บนเครื่องนี้ = ล้างข้อมูลของคนก่อนก่อน (forgetOtherAccount) ไม่ให้ชื่อ/เบอร์/ความก้าวหน้าไปปนบัญชีใหม่
// และกันเอฟเฟกต์ auto-link LINE ในแอป LINE ล็อกอินกลับเองเงียบ ๆ จนกว่าจะกดเข้าสู่ระบบเอง
export const logoutAccount = async () => {
  const u = load("user", null);
  await endAccountSession();
  if (u?.auth_user_id) save("signed_out_account", u.auth_user_id);
  if (u) save("user", { ...u, auth_user_id: undefined, hub: undefined });
  save("line_id_token", null);
  goHubLogout("/");
};
// "เริ่มใหม่ / เปลี่ยนคนเรียน": ล้างข้อมูลผู้เรียนในเครื่อง + ปิดบัญชีที่ login อยู่ (เดิมล้างแค่ข้อมูล session ยังค้าง)
export const startOverLearner = async () => {
  const wasSignedIn = !!load("user", null)?.auth_user_id;
  await endAccountSession();
  resetLearner();
  if (wasSignedIn) goHubLogout("/"); else window.location.reload();
};
// เรียกหลัง login สำเร็จ (LINE/อีเมล) ก่อนอ่านข้อมูลในเครื่อง — ข้อมูลในเครื่องเป็นของบัญชีที่เพิ่งออกจากระบบไป
// และคนที่ login ตอนนี้เป็นคนละบัญชี → ล้างก่อน คืน true (ผู้เรียกต้องทิ้งชื่อ/เบอร์ที่อ่านมาจากข้อมูลเดิมด้วย)
export const forgetOtherAccount = (authUserId) => {
  const prev = load("signed_out_account", null);
  if (!prev) return false;
  if (prev === authUserId) { save("signed_out_account", null); return false; }
  resetLearner();
  return true;
};

// ========== CERTIFICATE EXPORT HELPERS (PDF / รูปภาพ) ==========
export const LOGO_SRC = "/logo.png"; // วางไฟล์โลโก้ไว้ที่ files/jia-online/public/logo.png
export const sanitizeFileName = (name) => (name || "ใบประกาศนียบัตร")
  .normalize("NFC")
  .replace(/[\\/:*?"<>|]+/g, "")
  .replace(/\s+/g, "_")
  .slice(0, 40) || "certificate";
// แปลง DOM node เป็น PNG data URL ความละเอียดสูง (retina) ด้วย html-to-image (dynamic import → code-split)
export const captureNodeToPng = async (node) => {
  const { toPng } = await import("html-to-image");
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch {} } // รอฟอนต์โหลดเสร็จก่อน capture
  const opts = { pixelRatio: Math.max(2, window.devicePixelRatio || 1), backgroundColor: "#FFFFFF", cacheBust: true, width: node.offsetWidth, height: node.offsetHeight };
  try {
    return await toPng(node, opts);
  } catch (e) {
    // ฟอนต์ Google (cross-origin) embed ไม่ได้ → ลองใหม่โดยข้ามการฝังฟอนต์ ใช้ serif fallback แทน เพื่อให้ดาวน์โหลดสำเร็จเสมอ
    return await toPng(node, { ...opts, skipFonts: true });
  }
};
// แชร์ไฟล์ผ่าน share sheet ของมือถือก่อน (เซฟลง Photos/Files หรือส่ง LINE ได้); ถ้าไม่รองรับ → ดาวน์โหลดแบบ <a download>
export const deliverBlob = async (blob, filename, mime) => {
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "JIA Certificate" });
      return;
    }
  } catch (e) {
    if (e && e.name === "AbortError") return; // ผู้ใช้กดยกเลิก share sheet — ถือว่าปกติ
    // อื่น ๆ: ตกไปใช้ดาวน์โหลดด้านล่าง
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

// กราฟิกตกแต่งใบประกาศ (กรอบทอง + คลื่นน้ำเงิน + ซีล + ริบบิ้น) — ไม่มีข้อความ วางเป็นเลเยอร์พื้นหลัง
export const CERT_DECO = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 900 636" preserveAspectRatio="none">
<defs>
<linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F1D481"/><stop offset="0.5" stop-color="#C49A48"/><stop offset="1" stop-color="#8C6B22"/></linearGradient>
<linearGradient id="ch" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B8862F"/><stop offset="0.5" stop-color="#F3DB8E"/><stop offset="1" stop-color="#B8862F"/></linearGradient>
<radialGradient id="cs" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stop-color="#F6E3A0"/><stop offset="0.55" stop-color="#C9A24B"/><stop offset="1" stop-color="#8C6B22"/></radialGradient>
</defs>
<rect width="900" height="636" fill="#FFFDF7"/>
<g transform="scale(0.85)">
<path d="M0,0 L232,0 C168,44 92,40 76,112 C60,176 40,170 0,212 Z" fill="#1B315A"/>
<path d="M0,0 L198,0 C146,36 88,33 74,108 C58,172 36,156 0,186 Z" fill="#0E1E3C"/>
<path d="M198,0 C146,36 88,33 74,108 C58,172 36,156 0,186" fill="none" stroke="url(#ch)" stroke-width="5.5"/>
<path d="M232,0 C168,44 92,40 76,112 C60,176 40,170 0,212" fill="none" stroke="url(#ch)" stroke-width="2.2" opacity="0.8"/>
</g>
<g transform="translate(900,636) rotate(180) scale(0.85)">
<path d="M0,0 L232,0 C168,44 92,40 76,112 C60,176 40,170 0,212 Z" fill="#1B315A"/>
<path d="M0,0 L198,0 C146,36 88,33 74,108 C58,172 36,156 0,186 Z" fill="#0E1E3C"/>
<path d="M198,0 C146,36 88,33 74,108 C58,172 36,156 0,186" fill="none" stroke="url(#ch)" stroke-width="5.5"/>
<path d="M232,0 C168,44 92,40 76,112 C60,176 40,170 0,212" fill="none" stroke="url(#ch)" stroke-width="2.2" opacity="0.8"/>
</g>
<rect x="22" y="22" width="856" height="592" fill="none" stroke="url(#cg)" stroke-width="2.5"/>
<rect x="30" y="30" width="840" height="576" fill="none" stroke="url(#cg)" stroke-width="1" opacity="0.6"/>
<g stroke="url(#cg)" stroke-width="2" fill="none">
<path d="M838,30 h34 v34"/><path d="M845,38 h22 v22" stroke-width="1"/>
<path d="M62,606 h-34 v-34"/><path d="M55,598 h-22 v-22" stroke-width="1"/>
</g>
<g fill="url(#cg)" stroke="url(#cg)">
<line x1="305" y1="376" x2="438" y2="376" stroke="#B8862F" stroke-width="1.4"/><line x1="462" y1="376" x2="595" y2="376" stroke="#B8862F" stroke-width="1.4"/>
<rect x="445" y="371" width="10" height="10" transform="rotate(45 450 376)"/>
<circle cx="305" cy="376" r="2.2" stroke="none"/><circle cx="595" cy="376" r="2.2" stroke="none"/>
</g>
<g transform="translate(160,500)">
<circle r="34" fill="url(#cs)" stroke="#8C6B22" stroke-width="1.5"/><circle r="26.5" fill="none" stroke="#FFF4D6" stroke-width="1.1" opacity="0.7"/>
<rect x="-13" y="-11" width="26" height="22" rx="3" fill="#0E1E3C"/><rect x="-13" y="-11" width="26" height="7" rx="3" fill="#1B315A"/>
<line x1="-7" y1="-15" x2="-7" y2="-8" stroke="#FFF4D6" stroke-width="2.4" stroke-linecap="round"/><line x1="7" y1="-15" x2="7" y2="-8" stroke="#FFF4D6" stroke-width="2.4" stroke-linecap="round"/>
<g fill="#FFF4D6"><circle cx="-6" cy="0" r="1.5"/><circle cx="0" cy="0" r="1.5"/><circle cx="6" cy="0" r="1.5"/><circle cx="-6" cy="6" r="1.5"/><circle cx="0" cy="6" r="1.5"/></g>
</g>
<g transform="translate(740,500)">
<circle r="34" fill="url(#cs)" stroke="#8C6B22" stroke-width="1.5"/><circle r="26.5" fill="none" stroke="#FFF4D6" stroke-width="1.1" opacity="0.7"/>
<path transform="translate(-12,-11)" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#C8102E"/>
<polyline points="-10,0 -4,0 -1,-5 2,4 5,-1 8,0 11,0" fill="none" stroke="#FFF" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
</g>
<g transform="translate(450,500)">
<path d="M-150,-4 l-26,0 l8,15 l-8,15 l26,0 Z" fill="#8C6B22"/><path d="M150,-4 l26,0 l-8,15 l8,15 l-26,0 Z" fill="#8C6B22"/>
<rect x="-150" y="-29" width="300" height="58" rx="6" fill="#0E1E3C" stroke="url(#ch)" stroke-width="2.5"/>
<rect x="-144" y="-23" width="288" height="46" rx="4" fill="none" stroke="url(#ch)" stroke-width="0.8" opacity="0.55"/>
</g>
</svg>`;

// ========== PURCHASE HELPERS ==========
export const getPurchased = () => {
  const stored = load("purchased", null);
  // สิทธิ์ปลดทุกบทจากแคมเปญวันเดียว (camp_course_unlock เช่น LINE OA 6 ส.ค.) — รวมกับบทที่ปลดจากโค้ด
  const promoUnlocked = load("camp_course_unlock", false)
    ? [1, 2, 3, 4, 5, 6, 7]
    : load("promo_unlocked", []);
  if (stored && stored.length) return promoUnlocked.length ? [...new Set([...stored, ...promoUnlocked])] : stored;
  if (load("grandfathered", false)) return [1,2,3,4,5,6,7];
  // grandfather: เฉพาะ user ที่เข้าใช้งานจริงในช่วง FREE_LAUNCH เท่านั้น จึงคงสิทธิ์เรียนฟรีทุกบท
  // (ห้ามผูกกับ "enrolled" ซึ่งถูกตั้ง true ทุกครั้งที่สมัคร — จะทำให้ผู้สมัครใหม่หลัง cutover ได้ครบคอร์สฟรี)
  if (FREE_LAUNCH) { save("grandfathered", true); return [1,2,3,4,5,6,7]; }
  const base = [PRICING.freeModule];
  return promoUnlocked.length ? [...new Set([...base, ...promoUnlocked])] : base;
};
export const savePurchased = (ids) => { save("purchased", ids); };
// สลิปโอนเงิน: ไม่ปลดล็อกทันทีตอนอัปโหลดแล้ว — รอแอดมินตรวจและตั้ง payment_status = "ชำระแล้ว"
// ก่อน (เดิมอัปโหลดรูปอะไรก็ได้ก็ปลดล็อกเลย) เก็บรายการรอตรวจไว้ในเครื่อง แล้วเช็คสถานะกับ
// server ผ่าน RPC get_purchase_by_id (คืนเฉพาะ status+modules ของ id ที่ถือไว้ ไม่เปิดทั้งตาราง)
export const getPendingSlips = () => load("pending_slips", []);
export const savePendingSlips = (list) => save("pending_slips", list);
export const syncPendingSlips = async () => {
  const pending = getPendingSlips();
  if (!pending.length) return false;
  let unlocked = false; const remain = [];
  for (const p of pending) {
    const res = await supaRpc("get_purchase_by_id", { p_id: p.id });
    const row = Array.isArray(res) && res.length ? res[0] : null;
    if (row?.payment_status === "ชำระแล้ว") {
      const mods = (row.modules || "").split(",").map(Number).filter(Boolean);
      savePurchased([...new Set([...(load("purchased", []) || []), ...mods])]);
      unlocked = true;
    } else if (row && ["ปฏิเสธ", "ยกเลิก"].includes(row.payment_status)) {
      // แอดมินปฏิเสธสลิป — เอาออกจากคิวรอ (ผู้เรียนติดต่อทาง LINE ได้)
    } else {
      remain.push(p); // ยังรอตรวจ (หรือเช็คไม่สำเร็จ) — เก็บไว้เช็ครอบหน้า
    }
  }
  savePendingSlips(remain);
  return unlocked;
};
export const isModuleAccessible = (id, purchased) => purchased.includes(id) || (id === 7 && purchased.filter(x => x <= 6).length === 6);
export const calcPrice = (count) => {
  if (count >= 6) return PRICING.full;
  const tiered = count >= 3
    ? Math.floor(count / 3) * PRICING.bundle3 + (count % 3) * PRICING.single
    : count * PRICING.single;
  // อย่าให้เลือกบางหัวข้อแพงกว่าคอร์สเต็ม (เช่น 5 หัวข้อ = 170 > 149)
  return Math.min(tiered, PRICING.full);
};

// ========== COURSE DATA ==========
// ควิซเกริ่นนำหน้าแรก (CPR ผู้ใหญ่ ง่ายๆ เน้นกำลังใจ ไม่มีเกณฑ์ผ่าน) — ตัวล่อก่อนเก็บ LINE
// img: รูปประกอบ (วางไฟล์จริงทับใน public/teaser/ ภายหลัง) — ถ้าโหลดไม่ได้ใช้ emoji fallback
export const TEASER_QUIZ = [
  { q: "เจอคนหมดสติล้มอยู่ สิ่งแรกที่ควรทำคืออะไร?", c: ["รีบวิ่งเข้าไปทันที", "ดูความปลอดภัยรอบตัวก่อนเข้าไป", "ถ่ายคลิปไว้ก่อน", "เดินเลี่ยงไป"], a: 1, img: "/teaser/q1.webp", emoji: "⚠️", hint: "ความปลอดภัยของผู้ช่วยมาก่อนเสมอ" },
  { q: "เบอร์โทรขอรถพยาบาล/แพทย์ฉุกเฉินในไทยคือเบอร์อะไร?", c: ["191", "1669", "1112", "1133"], a: 1, img: "/teaser/q2.webp", emoji: "📞", hint: "จำง่ายๆ 1669 — สายด่วนการแพทย์ฉุกเฉิน" },
  { q: "การกดหน้าอก CPR ควรกดตรงไหน?", c: ["กลางหน้าอก", "ที่ท้อง", "ที่คอ", "ที่ไหล่"], a: 0, img: "/teaser/q3.webp", emoji: "🫶", hint: "วางส้นมือกลางหน้าอก" },
  { q: "ควรกดหน้าอกเร็วประมาณเท่าไร?", c: ["ช้าๆ สบายๆ", "100–120 ครั้งต่อนาที", "เร็วที่สุดเท่าที่ทำได้", "ไม่สำคัญ"], a: 1, img: "/teaser/q4.webp", emoji: "🥁", hint: "จังหวะพอๆ กับเพลงเร็ว ~100–120/นาที" },
  { q: "เครื่อง AED (เครื่องกระตุกหัวใจ) คนทั่วไปใช้ได้ไหม?", c: ["ใช้ได้ เครื่องมีเสียงบอกทุกขั้นตอน", "ใช้ได้เฉพาะหมอ", "อันตราย ห้ามแตะ", "ต้องเรียน 1 ปีก่อน"], a: 0, img: "/teaser/q5.webp", emoji: "❤️‍🩹", hint: "AED ออกแบบให้คนทั่วไปใช้ได้ มีเสียงนำทุกขั้นตอน" },
];

export const COURSE = { title: "CPR & AED ออนไลน์", price: FREE_LAUNCH ? 0 : PRICING.full, modules: [
  { id: 1, title: "บทที่ 1: CPR ผู้ใหญ่", short: "CPR ผู้ใหญ่", desc: "เทคนิคการช่วยชีวิตผู้ใหญ่ขั้นพื้นฐาน ตามมาตรฐาน 2025", vid: "IbvE4PnW_80", dur: 54, quiz: [
    { q: "ขั้นตอนแรกก่อนเข้าช่วยเหลือผู้หมดสติคืออะไร?", c: ["ทำ CPR ทันที", "โทร 1669", "ประเมินความปลอดภัยของที่เกิดเหตุ (Scene Safety)", "ใช้ AED"] },
    { q: "การประเมินการตอบสนอง ทำอย่างไร?", c: ["เขย่าตัวแรงๆ", "ตบบ่าพร้อมตะโกน \"คุณ...คุณ...เป็นยังไงบ้าง\"", "ตรวจชีพจร", "ตบหน้า"] },
    { q: "ความลึกในการกดหน้าอกผู้ใหญ่คือเท่าไร?", c: ["อย่างน้อย 3 ซม.", "อย่างน้อย 5 ซม. ถึง 6 ซม.", "อย่างน้อย 7 ซม.", "อย่างน้อย 10 ซม."] },
    { q: "อัตราความเร็วในการกดหน้าอกที่ถูกต้องคือเท่าไร?", c: ["80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "120-140 ครั้ง/นาที", "60-80 ครั้ง/นาที"] },
    { q: "อัตราส่วนกดหน้าอก:ช่วยหายใจ ในผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "30:1"] },
    { q: "ประเมินการหายใจของผู้ป่วยใช้เวลานานเท่าไร?", c: ["5 วินาที", "ไม่เกิน 10 วินาที", "30 วินาที", "1 นาที"] },
    { q: "ถ้าผู้ป่วยหายใจเฮือก (gasping) ถือว่าอย่างไร?", c: ["หายใจปกติ ไม่ต้องช่วย", "ไม่ใช่การหายใจปกติ ต้องเริ่ม CPR ทันที", "หายใจดีขึ้นแล้ว", "รอดูอาการก่อน"] },
    { q: "ควรปล่อยให้หน้าอกคืนตัวสุดหลังกดแต่ละครั้งหรือไม่?", c: ["ไม่ต้อง กดถี่ๆ ไปเลย", "ควร ปล่อยให้อกคืนตัวสุดทุกครั้ง", "ปล่อยแค่ครึ่งเดียวพอ", "ไม่มีผลต่อประสิทธิภาพ"] },
    { q: "ถ้าไม่มั่นใจเรื่องการเป่าปาก สามารถทำอะไรแทนได้?", c: ["ไม่ต้องช่วยเลย", "กดหน้าอกอย่างเดียวต่อเนื่อง (Hands-only CPR)", "รอรถพยาบาลอย่างเดียว", "เป่าจมูกแทน"] },
    { q: "ควรสลับคนกดหน้าอกทุกกี่นาที เพื่อคงคุณภาพการกด?", c: ["ทุก 30 วินาที", "ทุก 2 นาที", "ทุก 10 นาที", "ไม่ต้องสลับ"] },
    { q: "ระหว่างทำ CPR ควรหยุดกดหน้าอกได้นานสุดกี่วินาที?", c: ["ไม่เกิน 10 วินาที", "30 วินาที", "1 นาที", "หยุดได้ตามสะดวก"] },
    { q: "เมื่อโทร 1669 ควรทำอะไรร่วมด้วยเสมอ?", c: ["วางสายทันทีหลังบอกที่อยู่", "เปิดลำโพงไว้ให้เจ้าหน้าที่แนะนำระหว่างช่วย", "ปิดเสียงโทรศัพท์", "ให้คนอื่นคุยแทน"] },
  ]},
  { id: 2, title: "บทที่ 2: CPR ทารก", short: "CPR ทารก", desc: "เทคนิค CPR สำหรับทารก ความแตกต่างจากผู้ใหญ่", vid: "fu65-_ENCLo", dur: 50, quiz: [
    { q: "การกดหน้าอกทารก ใช้อะไรกด?", c: ["ฝ่ามือ 2 ข้าง", "สันมือ หรือ 2 นิ้วโป้ง", "กำปั้น", "ฝ่ามือ 1 ข้าง"] },
    { q: "ความลึกในการกดหน้าอกทารกคือเท่าไร?", c: ["2 ซม.", "ประมาณ 4 ซม. หรือ 1.5 นิ้ว (1/3 ของความหนาหน้าอก)", "5 ซม.", "1 ซม."] },
    { q: "อัตราส่วนกดหน้าอก:เป่าปาก สำหรับทารก (ผู้ช่วย 1 คน)?", c: ["15:2", "30:2", "30:1", "10:2"] },
    { q: "ถ้ามีผู้ช่วยเหลือ 2 คน อัตราส่วนกด:เป่า เปลี่ยนเป็นเท่าไร?", c: ["30:2", "15:2", "30:1", "10:2"] },
    { q: "ตำแหน่งกดหน้าอกทารกอยู่ที่ไหน?", c: ["กึ่งกลางหน้าอก ใต้แนวราวนม", "ด้านซ้ายหน้าอก", "บนท้อง", "ที่คอ"] },
    { q: "ท่านอนของทารกตอนทำ CPR คือแบบไหน?", c: ["นอนหงายบนพื้นแข็ง", "นอนคว่ำ", "อุ้มตั้งขึ้น", "นอนตะแคง"] },
    { q: "ประเมินการตอบสนองของทารกทำอย่างไร?", c: ["เขย่าตัวแรงๆ", "ดีดฝ่าเท้าเบาๆ พร้อมเรียก ห้ามเขย่า", "จับหัวเขย่า", "ตบหน้า"] },
    { q: "ทำไมแนวทางล่าสุดจึงเลิกใช้เทคนิค \"2 นิ้ว\" กดหน้าอกทารก?", c: ["ใช้แรงเกินไป", "กดได้ไม่ลึกพอ", "ทำยากเกินไป", "ใช้เวลานานกว่า"] },
    { q: "ถ้ามือโอบรอบอกทารกด้วย 2 นิ้วโป้งไม่ถึง ใช้วิธีใดแทน?", c: ["ใช้กำปั้น", "ใช้ส้นมือข้างเดียว", "ใช้ฝ่ามือ 2 ข้าง", "งดกดหน้าอก"] },
    { q: "อัตราเร็วในการกดหน้าอกทารกเทียบกับผู้ใหญ่เป็นอย่างไร?", c: ["ช้ากว่าผู้ใหญ่มาก", "เท่ากับผู้ใหญ่ คือ 100-120 ครั้ง/นาที", "เร็วกว่าผู้ใหญ่เท่าตัว", "ไม่มีมาตรฐาน"] },
    { q: "การเป่าปากช่วยหายใจทารก ต้องครอบปากผู้ช่วยที่ส่วนไหนของทารก?", c: ["ปากอย่างเดียว", "จมูกอย่างเดียว", "ทั้งปากและจมูกพร้อมกัน", "ไม่ต้องเป่า"] },
  ]},
  { id: 3, title: "บทที่ 3: สิ่งอุดกั้นทางเดินหายใจ ผู้ใหญ่", short: "Choking ผู้ใหญ่", desc: "วิธีช่วยเหลือผู้ใหญ่สำลัก แยกแยะอุดกั้นบางส่วนและสมบูรณ์", vid: "_nT-BcNoUzE", dur: 51, quiz: [
    { q: "การอุดกั้นบางส่วน สังเกตอย่างไร?", c: ["พูดไม่ออก หน้าเขียว", "ผู้ป่วยยังพูดได้ ไอเสียงดัง", "ใช้มือจับคอ", "หมดสติ"] },
    { q: "การอุดกั้นสมบูรณ์ (อันตรายถึงชีวิต) สังเกตอย่างไร?", c: ["ไอเสียงดัง ยังพูดได้", "พูดไม่ออก ใช้มือจับคอ หน้าเขียว ไอไม่มีเสียง", "หน้าแดง แต่ยังพูดได้", "เจ็บคอเล็กน้อย"] },
    { q: "ถ้าผู้ป่วยยังไอได้เสียงดัง ควรทำอย่างไร?", c: ["ตบหลังทันที", "กดท้อง Heimlich", "ให้ผู้ป่วยไอต่อไป ห้ามตบหลัง", "โทร 1669"] },
    { q: "การอุดกั้นสมบูรณ์ ช่วยเหลืออย่างไร (แนวทาง 2025)?", c: ["กดท้อง Heimlich อย่างเดียว", "ตบหลัง 5 ครั้ง สลับกดท้อง 5 ครั้ง จนกว่าสิ่งอุดกั้นจะหลุด", "เป่าปากทันที", "ให้ดื่มน้ำ"] },
    { q: "วิธี Heimlich Maneuver ตำแหน่งกดท้องอยู่ที่ไหน?", c: ["เหนือสะดือ ต่ำกว่ากระดูกหน้าอก", "กลางหน้าอก", "ที่สะดือพอดี", "ใต้สะดือ"] },
    { q: "ถ้าผู้ป่วยสำลักจนหมดสติ ต้องทำอย่างไร?", c: ["ทำ Heimlich ต่อ", "วางลงบนพื้น เริ่มทำ CPR ทันที", "ให้ดื่มน้ำ", "นั่งรอรถพยาบาล"] },
    { q: "ก่อนเป่าปากช่วยหายใจหลังผู้ป่วยสำลักหมดสติ ควรทำอะไรก่อน?", c: ["เป่าเลยไม่ต้องดู", "เปิดปากดูก่อน เขี่ยออกเฉพาะของที่เห็นชัด", "ล้วงนิ้วกวาดในคอทันที", "ให้ดื่มน้ำล้างคอ"] },
    { q: "ทำไมจึงห้ามล้วงนิ้วกวาดในคอแบบมองไม่เห็น (blind sweep)?", c: ["เสียเวลาเปล่า", "อาจดันสิ่งอุดกั้นลึกลงไปกว่าเดิม", "ทำให้ผู้ป่วยเจ็บ", "ไม่มีเหตุผลพิเศษ"] },
    { q: "ทำไมการกดหน้าอก (CPR) จึงช่วยคนสำลักที่หมดสติได้ด้วย?", c: ["ไม่ได้ช่วยอะไรเรื่องสำลัก", "แรงกดหน้าอกช่วยดันสิ่งอุดกั้นออกได้ด้วย", "ทำให้ผู้ป่วยตื่นเร็วขึ้นเฉยๆ", "ต้องรอแพทย์เท่านั้น"] },
    { q: "คนท้องแก่หรืออ้วนมากที่ท้องโตจนโอบรอบเอวไม่ได้ ควรช่วยสำลักอย่างไร?", c: ["กดท้อง Heimlich แรงกว่าปกติ", "เปลี่ยนเป็นกดหน้าอก (Chest Thrust) ที่กระดูกอกส่วนล่างแทน", "งดช่วยเหลือ รอรถพยาบาลอย่างเดียว", "จับนอนคว่ำเคาะหลัง"] },
  ]},
  { id: 4, title: "บทที่ 4: สิ่งอุดกั้นทางเดินหายใจ ทารก", short: "Choking ทารก", desc: "วิธีช่วยเหลือทารกสำลัก ตบหลังสลับกดหน้าอก", vid: "pCgxwQUzph0", dur: 32, quiz: [
    { q: "ถ้าทารกยังร้องได้ ไอเสียงดัง ควรทำอย่างไร?", c: ["ตบหลังทันที", "ปล่อยให้ไอเอาสิ่งอุดกั้นออกเอง ห้ามตบหลัง", "กดท้อง", "จับขาสะบัด"] },
    { q: "ท่าตบหลังทารก จับทารกอย่างไร?", c: ["อุ้มตั้งขึ้น", "คว่ำหน้าบนแขน ศีรษะต่ำกว่าลำตัว", "วางนอนหงายบนพื้น", "จับตั้งศีรษะขึ้น"] },
    { q: "ตบหลังทารก ตบตรงไหน กี่ครั้ง?", c: ["กึ่งกลางกระดูกสะบักทั้ง 2 ข้าง จำนวน 5 ครั้ง", "ตบที่ศีรษะ 3 ครั้ง", "ตบที่ก้น 5 ครั้ง", "ตบที่ท้อง 5 ครั้ง"] },
    { q: "หลังตบหลัง 5 ครั้ง ยังไม่ออก ทำอะไรต่อ?", c: ["ตบหลังต่อ", "พลิกหงาย กดหน้าอก 5 ครั้ง ใต้แนวราวนม", "ใช้นิ้วล้วงคอ", "เป่าปาก"] },
    { q: "ข้อห้ามในการช่วยทารกสำลัก?", c: ["ห้ามตบหลัง", "ห้ามกดหน้าอก", "ห้ามจับขาสะบัด ห้ามกดท้องแบบผู้ใหญ่ ห้ามล้วงนิ้วเข้าปาก", "ห้ามเป่าปาก"] },
    { q: "ข้อห้ามข้อใดอันตรายที่สุดต่อคอและสมองทารก?", c: ["ห้ามตบหลังแรงเกินไป", "ห้ามจับขาสะบัดห้อยหัว", "ห้ามอุ้มตอนตบหลัง", "ห้ามเรียกชื่อทารก"] },
    { q: "ทำไมห้ามกดท้องแบบผู้ใหญ่ (Heimlich) กับทารก?", c: ["ทำได้ยากเกินไป", "เสี่ยงบาดเจ็บตับ/ม้ามของทารก", "ไม่มีผลอะไร", "ใช้เวลานานกว่า"] },
    { q: "ถ้าทารกยังไอเสียงดังหรือร้องได้อยู่ ควรทำอย่างไร?", c: ["ตบหลังทันที", "ปล่อยให้ไอเอาสิ่งอุดกั้นออกเอง ห้ามตบหลัง", "กดหน้าอกทันที", "ให้ดื่มน้ำ"] },
  ]},
  { id: 5, title: "บทที่ 5: Megacode — CPR & AED ผู้ใหญ่", short: "CPR & AED ผู้ใหญ่", desc: "การใช้เครื่อง AED ร่วมกับ CPR และการช่วยจนรอด", vid: "dQ9TcHdhIr0", dur: 217, quiz: [
    { q: "ตำแหน่งแปะแผ่น AED ที่แนะนำคือ?", c: ["ทั้ง 2 แผ่นบนหน้าอก", "แผ่นแรกใต้ไหปลาร้าขวา แผ่นสองใต้ราวนมซ้ายแนวรักแร้", "แผ่นบนท้อง 2 แผ่น", "แผ่นบนหลัง 2 แผ่น"] },
    { q: "ก่อนกดปุ่ม Shock ต้องดูอะไร?", c: ["ดูว่าเครื่องเปิดอยู่", "ดูว่าไม่มีใครสัมผัสตัวผู้ป่วย", "ดูว่าแผ่นติดแน่น", "ดูว่าผู้ป่วยหายใจ"] },
    { q: "ก่อนกดปุ่ม Shock ต้องตะโกนว่าอะไร?", c: ["\"ถอยเลย!\"", "\"หลบออก!\"", "\"ฉันถอย คุณถอย ทุกคนถอย!\"", "\"ห้ามแตะ!\""] },
    { q: "จะหยุดปั๊มหัวใจได้เมื่อไหร่?", c: ["เมื่อเหนื่อย", "ทีมฉุกเฉินมาถึง / ผู้ป่วยหายใจเอง / ผู้ป่วยรู้สึกตัว", "เมื่อครบ 5 นาที", "เมื่อ AED ช็อกแล้ว"] },
    { q: "ถ้าผู้ป่วยหายใจเองแล้วแต่ยังไม่รู้สึกตัว ต้องทำอย่างไร?", c: ["ปิดเครื่อง AED แล้วรอ", "กด CPR ต่อ", "จัดท่านอนตะแคงกึ่งคว่ำ (Recovery Position) ดูการหายใจทุก 2 นาที", "ให้ดื่มน้ำ"] },
    { q: "ถ้าตัวผู้ป่วยเปียกน้ำ ก่อนแปะแผ่น AED ต้องทำอะไรก่อน?", c: ["แปะทับไปเลย รีบๆ", "เช็ดหน้าอกให้แห้งก่อน", "รอให้แห้งเองอย่างเดียว", "ไม่ต้องใช้ AED"] },
    { q: "ทำไมห้ามแปะแผ่น AED บนตัวที่เปียกน้ำ?", c: ["แผ่นจะหลุดง่าย", "ไฟฟ้าจะวิ่งบนผิวน้ำแทนที่จะผ่านหัวใจ ช็อกไม่ได้ผล", "ทำให้เครื่องพัง", "ไม่มีเหตุผลพิเศษ"] },
    { q: "หลังเครื่อง AED ช็อกแล้ว ต้องทำอะไรทันที?", c: ["รอดูอาการก่อน", "กดหน้าอกต่อทันที 2 นาที แล้วให้เครื่องวิเคราะห์ใหม่", "ปิดเครื่องพัก", "ช็อกซ้ำทันที"] },
    { q: "ระหว่างที่ AED กำลังวิเคราะห์จังหวะหัวใจ ต้องทำอะไร?", c: ["กดหน้าอกต่อไปเรื่อยๆ", "ห้ามสัมผัสตัวผู้ป่วยเด็ดขาด", "เป่าปากช่วยหายใจ", "จับชีพจร"] },
    { q: "ทำไมต้องย้ายผู้ป่วยจากขอบสระที่ลื่นไปพื้นแห้งก่อนเริ่มช่วย?", c: ["เพื่อความสวยงาม", "ขอบสระลื่นและอันตราย ต้องหาที่มั่นคงปลอดภัยก่อน", "ไม่มีเหตุผลพิเศษ", "เพื่อให้คนอื่นมองเห็นง่าย"] },
  ]},
  { id: 6, title: "บทที่ 6: Megacode — CPR & AED ทารก/เด็ก", short: "CPR & AED ทารก/เด็ก", desc: "ขั้นตอนการช่วยเหลือและการใช้ AED สำหรับเด็กทารก", vid: "lCbImOmcrNA", dur: 119, quiz: [
    { q: "เวลากดหน้าอกทารก ควรกดลึกประมาณเท่าไหร่?", c: ["1 เซนติเมตร", "4 เซนติเมตร", "6 เซนติเมตร", "8 เซนติเมตร"] },
    { q: "ถ้ามีผู้ช่วยเหลือ 2 คน ควรกดหน้าอกกี่ครั้ง แล้วเป่าปากกี่ครั้ง?", c: ["กด 30 ครั้ง เป่า 2 ครั้ง", "กด 15 ครั้ง เป่า 2 ครั้ง", "กด 5 ครั้ง เป่า 1 ครั้ง", "กด 10 ครั้ง เป่า 2 ครั้ง"] },
    { q: "ตำแหน่งในการติดแผ่น AED สำหรับทารก ที่ดีที่สุดคือข้อใด?", c: ["ติดที่หน้าอกด้านซ้ายและขวา", "ติดที่หน้าอกด้านหน้าและแผ่นหลัง", "ติดที่หน้าผากและท้อง", "ติดที่ท้องและหลัง"] },
    { q: "ก่อนกดปุ่มช็อก (Shock) ด้วยเครื่อง AED ต้องทำอะไรก่อน?", c: ["ตรวจดูชีพจร", "เป่าลมเพิ่ม 1 ครั้ง", "บอกให้ทุกคนถอยห่างจากตัวเด็ก", "ถอดแผ่น AED ออกก่อน"] },
    { q: "ถ้าไม่มีแผ่น AED สำหรับเด็ก ควรทำอย่างไร?", c: ["ไม่ต้องช็อก", "ใช้แผ่นผู้ใหญ่ แต่ต้องแน่ใจว่าแผ่นไม่แตะกัน", "รอให้มีคนเอาอุปกรณ์สำหรับเด็กมา", "กด CPR อย่างเดียว ไม่ต้องใช้ AED"] },
    { q: "ถ้ามีแผ่น AED สำหรับเด็กโดยเฉพาะ ควรใช้แผ่นไหน?", c: ["ใช้แผ่นผู้ใหญ่ดีกว่าเสมอ", "ใช้แผ่นเด็กโดยเฉพาะ", "ใช้แผ่นไหนก็ได้ไม่ต่างกัน", "ไม่ต้องใช้แผ่นเลย"] },
    { q: "เด็กจมน้ำ ก่อนเริ่มกดหน้าอกควรทำอะไรก่อน (ต่างจากผู้ใหญ่ที่หัวใจหยุดเต้นเฉยๆ)?", c: ["กดหน้าอกเลยไม่ต้องเป่า", "เป่าปากช่วยหายใจ 2 ครั้งก่อน เพราะเป็นภาวะขาดออกซิเจน", "รอให้น้ำไหลออกจากปอดก่อน", "จับพลิกคว่ำเขย่า"] },
    { q: "เด็กจมน้ำแม้ฟื้นและหายใจเองแล้ว ต้องทำอย่างไรต่อ?", c: ["ปล่อยกลับไปเล่นต่อได้เลย", "ต้องไปตรวจโรงพยาบาลทุกราย เพราะภาวะแทรกซ้อนทางปอดอาจเกิดตามหลัง", "ให้นอนพักที่บ้าน", "ให้ดื่มน้ำอุ่นเยอะๆ"] },
    { q: "อัตราส่วนกด:เป่า สำหรับเด็ก เมื่อมีผู้ช่วยเหลือ 2 คน?", c: ["30:2", "15:2", "10:1", "5:1"] },
  ]},
  { id: 7, title: "แบบทดสอบสุดท้าย", short: "Final Exam", desc: "ทดสอบความรู้ทั้งหมด 6 บท ต้องได้ 80% ขึ้นไปจึงผ่าน", vid: null, dur: null, quiz: [
    { q: "ขั้นตอนแรกเมื่อพบผู้หมดสติคืออะไร?", c: ["ทำ CPR ทันที", "โทร 1669", "ประเมินความปลอดภัยที่เกิดเหตุ (Scene Safety)", "ใช้ AED"] },
    { q: "ประเมินการหายใจใช้เวลาเท่าไร?", c: ["5 วินาที", "ไม่เกิน 10 วินาที", "30 วินาที", "1 นาที"] },
    { q: "อัตราส่วนกด:เป่า ผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "5:1"] },
    { q: "ความลึกกดหน้าอกผู้ใหญ่?", c: ["3 ซม.", "อย่างน้อย 5 ซม. ถึง 6 ซม.", "7 ซม.", "10 ซม."] },
    { q: "ความเร็วกดหน้าอก?", c: ["60-80 ครั้ง/นาที", "80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "120-150 ครั้ง/นาที"] },
    { q: "กดหน้าอกทารก ใช้อะไร?", c: ["ฝ่ามือ 2 ข้าง", "สันมือ หรือ 2 นิ้วโป้ง", "กำปั้น", "ฝ่ามือ 1 ข้าง"] },
    { q: "ผู้ใหญ่สำลักขั้นรุนแรง ทำอย่างไร?", c: ["ให้ดื่มน้ำ", "ตบหลัง 5 ครั้ง สลับกดท้อง 5 ครั้ง", "กดท้อง Heimlich ทันที", "เป่าปาก"] },
    { q: "ห้ามทำอะไรกับทารกที่สำลัก?", c: ["ห้ามตบหลัง", "ห้ามกดท้อง ห้ามจับขาสะบัด", "ห้ามกดหน้าอก", "ห้ามเป่าปาก"] },
    { q: "ก่อนกด Shock ต้องตะโกนว่าอะไร?", c: ["\"ถอยเลย!\"", "\"ฉันถอย คุณถอย ทุกคนถอย!\"", "\"หลบออก!\"", "\"ห้ามแตะ!\""] },
    { q: "จะหยุดปั๊มหัวใจเมื่อไหร่?", c: ["เมื่อเหนื่อย", "เมื่อครบ 5 นาที", "ทีมฉุกเฉินมาถึง / ผู้ป่วยหายใจเอง / ผู้ป่วยรู้สึกตัว", "เมื่อ AED ช็อกแล้ว"] },
    { q: "ความลึกกดหน้าอกทารก?", c: ["1 ซม.", "ประมาณ 4 ซม. (1/3 ของความหนาหน้าอก)", "6 ซม.", "8 ซม."] },
    { q: "ตำแหน่งกดหน้าอกทารกอยู่ที่ไหน?", c: ["กึ่งกลางหน้าอก ใต้แนวราวนม", "ด้านซ้ายหน้าอก", "บนท้อง", "ที่คอ"] },
    { q: "อัตราส่วนกด:เป่า ทารก ผู้ช่วยเหลือ 2 คน?", c: ["30:2", "15:2", "30:1", "10:2"] },
    { q: "ท่าตบหลังทารกที่ถูกต้องคือแบบไหน?", c: ["อุ้มตั้งขึ้น", "คว่ำหน้าบนแขน ศีรษะต่ำกว่าลำตัว", "วางนอนหงายบนพื้น", "จับตั้งศีรษะขึ้น"] },
    { q: "ข้อห้ามที่อันตรายที่สุดกับทารกสำลัก?", c: ["ห้ามตบหลัง", "ห้ามจับขาสะบัดห้อยหัว", "ห้ามอุ้ม", "ห้ามเรียกชื่อ"] },
    { q: "ตำแหน่งแปะแผ่น AED ผู้ใหญ่ที่ถูกต้อง?", c: ["ทั้ง 2 แผ่นบนหน้าอก", "แผ่นแรกใต้ไหปลาร้าขวา แผ่นสองใต้ราวนมซ้ายแนวรักแร้", "แผ่นบนท้อง 2 แผ่น", "แผ่นบนหลัง 2 แผ่น"] },
    { q: "ถ้าไม่มีแผ่น AED สำหรับเด็ก ควรทำอย่างไร?", c: ["ไม่ต้องช็อก", "ใช้แผ่นผู้ใหญ่ แต่ต้องแน่ใจว่าแผ่นไม่แตะกัน", "รอให้มีอุปกรณ์เด็กมาก่อน", "กด CPR อย่างเดียว"] },
    { q: "เด็กจมน้ำ ก่อนกดหน้าอกควรทำอะไรก่อน?", c: ["เป่าปากช่วยหายใจ 2 ครั้งก่อน", "กดหน้าอกอย่างเดียว", "รอน้ำไหลออกจากปอดก่อน", "จับพลิกคว่ำเขย่า"] },
    { q: "คนท้องแก่ที่ท้องโตจนโอบรอบเอวไม่ได้ สำลักขั้นรุนแรง ควรช่วยอย่างไร?", c: ["กดท้อง Heimlich แรงกว่าปกติ", "เปลี่ยนเป็นกดหน้าอก (Chest Thrust) ที่กระดูกอกส่วนล่างแทน", "งดช่วยเหลือ รอรถพยาบาล", "จับนอนคว่ำเคาะหลังแรงๆ"] },
    { q: "ก่อนเป่าปากช่วยหายใจหลังผู้ป่วยสำลักหมดสติ ควรทำอะไรก่อน?", c: ["เป่าเลยไม่ต้องดู", "เปิดปากดูก่อน เขี่ยออกเฉพาะของที่เห็นชัด", "ล้วงนิ้วกวาดในคอทันที", "ให้ดื่มน้ำล้างคอ"] },
    { q: "ถ้าไม่มั่นใจเรื่องการเป่าปาก สามารถทำอะไรแทนได้?", c: ["ไม่ต้องช่วยเลย", "กดหน้าอกอย่างเดียวต่อเนื่อง (Hands-only CPR)", "รอรถพยาบาลอย่างเดียว", "เป่าจมูกแทน"] },
    { q: "ควรสลับคนกดหน้าอกทุกกี่นาที?", c: ["ทุก 30 วินาที", "ทุก 2 นาที", "ทุก 10 นาที", "ไม่ต้องสลับ"] },
  ]},
]};

// ==================== ICONS ====================
export const icons = {
  play: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M8 5v14l11-7z"/></svg>,
  check: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  lock: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke={c} strokeWidth="2"/></svg>,
  star: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  cert: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>,
  arrow: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  back: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  heart: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  book: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
  qr: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4" rx=".5"/></svg>,
  line: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.93 1.95 5.5 4.86 7.15-.19.67-.68 2.42-.78 2.79-.12.46.17.45.36.33.15-.1 2.38-1.62 3.35-2.28.7.1 1.43.16 2.21.16 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/></svg>,
  save: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  replay: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>,
  warn: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2L1 21h22L12 2zm0 15a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm-1-2h2V10h-2v5z"/></svg>,
  phone: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>,
};
export const I = ({ name, size = 20, color = B.black }) => icons[name]?.(size, color) || null;

// โลโก้ JIA TRAINER CENTER — แสดงรูปจาก public/logo.png ถ้าโหลดไม่ได้ fallback เป็นไอคอน cert เดิม
export const Logo = ({ size = 120 }) => {
  const [err, setErr] = useState(false);
  if (err) return (<div style={{ margin: "0 auto", width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: `${B.gold}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><I name="cert" size={size * 0.3} color={B.gold}/></div>);
  return <img src={LOGO_SRC} alt="JIA TRAINER CENTER" onError={() => setErr(true)} style={{ width: size, height: "auto", maxWidth: "100%", display: "block", margin: "0 auto" }}/>;
};

// ==================== STYLES ====================
export const css = {
  btn: (bg, color, full) => ({ background: bg, color, border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all .2s", ...(full ? { width: "100%", display: "block" } : {}) }),
  card: { background: B.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
  header: (bg) => ({ background: bg, color: B.white, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }),
  page: { minHeight: "100vh", background: B.cream },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 20px" },
};

