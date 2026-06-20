import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { useState, useEffect, useCallback, useRef } from "react";

// ==================== BRAND ====================
const B = { red: "#C8102E", dkRed: "#9B0020", black: "#1A1A1A", white: "#FFFFFF", cream: "#FFF8F0", gray: "#F5F5F5", ltGray: "#E8E8E8", dkGray: "#666", green: "#22C55E", gold: "#F59E0B" };
const SERIF = "'Trirong', 'Noto Sans Thai', Georgia, serif"; // ฟอนต์เซริฟไทยสำหรับใบประกาศ (หัวข้อ + ชื่อผู้เรียน)

// ========== CONFIG ==========
const FREE_LAUNCH = true; // ยังเปิดฟรีจนถึง ก.ค. 2569 — flip เป็น false เมื่อพร้อม cutover (จะเปิด Claim CTA + lock บทที่ 4-6 อัตโนมัติ)
const LAUNCH_END = "31 กรกฎาคม 2569";
const LINE_URL = "https://line.me/R/ti/p/@jiacpr";
const LINE_QR_URL = "https://qr-official.line.me/sid/L/jiacpr.png";
const safeTrack = (name, props) => { try { track(name, props); } catch(e) {} };
const genLinkCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = ""; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
const getLinkCode = () => { let code = load("line_link_code", null); if (!code) { code = genLinkCode(); save("line_link_code", code); } return code; };
const lineLinkDeepLink = (code) => `https://line.me/R/oaMessage/%40jiacpr/?${encodeURIComponent("JIA-LINK-" + code)}`;
const markLineAdded = (user) => {
  save("line_added", true); save("line_added_at", new Date().toISOString());
  safeTrack("line_oa_added");
  const u = user || load("user", null);
  if (u?.phone) {
    const tail = u.phone.replace(/\D/g, "").slice(-9);
    supaRest("customers", "PATCH", { line_added: true, line_added_at: new Date().toISOString() }, `?tel=ilike.*${tail}`);
  }
};
const SUPABASE_URL = "https://tpoiyykbgsgnrdwzgzvn.supabase.co";
const SUPABASE_KEY = "sb_publishable_1kXSE788PB9XqH_2vU3pqg_6xtqI1Mf";

// ========== AUTH GATE (บังคับสมัครหลังจบบท 1) ==========
const AUTH_GATE_ENABLED = true;          // เปิดด่านบังคับสมัคร (false = กลับไป flow เดิม)
const LIFF_ID = "2010458255-JAxIKawy";     // LIFF ID จาก LINE Developers (PUBLIC) — channel "JIA CPR Online" / provider JiaTrainingcenter
const GOOGLE_LOGIN_ENABLED = true;        // ต้องเปิด Google provider ใน Supabase Auth ก่อนใช้จริง
const EMAIL_OTP_ENABLED = true;           // ต้องเปิด Email (OTP) provider ใน Supabase Auth
const POSTHOG_KEY = "";                   // PUBLIC PostHog project key. ว่าง = ไม่ทำ A/B (ใช้ตัวแปรด่าน default)
const POSTHOG_HOST = "https://us.i.posthog.com";
const GATE_VARIANT_DEFAULT = "before-course"; // before-course (ควิซเกริ่นนำ→สมัคร→เข้าคอร์ส) | after-lesson-1 | soft
const FN_URL = (n) => `${SUPABASE_URL}/functions/v1/${n}`;

// ========== PRICING ==========
const PRICING = {
  single: 35,       // ฿35 ต่อหัวข้อ
  bundle3: 100,     // ฿100 ต่อ 3 หัวข้อ
  full: 149,        // ฿149 Full Course + Final Exam
  freeModule: 1,    // บทที่ 1 ฟรี (CPR ผู้ใหญ่)
};

// ========== PROMO CODE (Lead Capture) ==========
const PROMO_ENABLED = true;                 // เปิดระบบ lead-capture (ปิดเพื่อซ่อน CTA ทั้งหมด)
const PROMO_FREE_MODULES = [1, 2, 3];       // โค้ดปลดล็อก: CPR ผู้ใหญ่ + ทารก + Choking ผู้ใหญ่
const PROMO_EXPIRY_DAYS = 7;                // โค้ดหมดอายุภายใน 7 วันหลัง claim
const PROMO_CODE_PREFIX = "LEAD-";          // prefix แยกจาก JIA- (on-site coupon)
const LEAD_SOURCES = [
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

const supaRest = async (table, method = "GET", body = null, filters = "") => {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
  if (method === "POST" || method === "PATCH") h.Prefer = "return=representation";
  const opts = { method, headers: h };
  if (body && method !== "GET" && method !== "DELETE") opts.body = JSON.stringify(body);
  try { const res = await fetch(url, opts); return res.ok ? (await res.text().then(t => t ? JSON.parse(t) : [])) : []; } catch(e) { console.error("Supabase:", e); return []; }
};
const genCoupon = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = "JIA-"; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
const genLeadCode = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = PROMO_CODE_PREFIX; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
const normalizePhone = (s) => (s || "").replace(/\D/g, "");
const normalizeEmail = (s) => (s || "").trim().toLowerCase();
const daysUntil = (iso) => { if (!iso) return 0; const ms = new Date(iso).getTime() - Date.now(); return Math.max(0, Math.ceil(ms / 86400000)); };
const genIdempotencyKey = (email, phone) => `${normalizeEmail(email)}|${normalizePhone(phone)}|${Math.floor(Date.now() / 60000)}`.slice(0, 80);
const save = (k, v) => { try { localStorage.setItem(`jia_${k}`, JSON.stringify(v)); } catch(e){} };
const load = (k, d) => { try { const v = localStorage.getItem(`jia_${k}`); return v ? JSON.parse(v) : d; } catch(e){ return d; } };

// ========== AUTH HELPERS (LIFF / Supabase Auth / PostHog — โหลดแบบ on-demand) ==========
let _liff = null;
const loadLiff = async () => {
  if (_liff) return _liff;
  if (!LIFF_ID) return null;
  try { const mod = await import("@line/liff"); const liff = mod.default || mod; await liff.init({ liffId: LIFF_ID }); _liff = liff; return liff; }
  catch (e) { console.error("liff init", e); return null; }
};
let _supa = null;
const getSupabase = async () => {
  if (_supa) return _supa;
  const { createClient } = await import("@supabase/supabase-js");
  _supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  return _supa;
};
let _ph = null, _phTried = false;
const getPosthog = async () => {
  if (_phTried) return _ph;
  _phTried = true;
  if (!POSTHOG_KEY) return null;
  try { const mod = await import("posthog-js"); const posthog = mod.default || mod; posthog.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, capture_pageview: false }); _ph = posthog; return posthog; }
  catch (e) { return null; }
};
const phCapture = (name, props) => { getPosthog().then(ph => { try { ph && ph.capture(name, props); } catch(e){} }); };

const getGateVariant = () => load("gate_variant", GATE_VARIANT_DEFAULT);
const isSignedUp = () => { const u = load("user", null); return !!(load("signed_up", false) || u?.line_user_id || u?.auth_user_id); };

// UTM: เก็บครั้งแรกที่เข้า ก่อน replaceState จะลบ query ทิ้ง
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const captureUTM = () => {
  try {
    const p = new URLSearchParams(window.location.search); const got = {};
    UTM_KEYS.forEach(k => { const v = p.get(k); if (v) got[k] = v; });
    if (Object.keys(got).length && !load("utm", null)) { save("utm", got); save("landing_url", window.location.href.slice(0, 500)); }
  } catch (e) {}
};
const getUTM = () => load("utm", {});

const mergeProgressLocal = (a, b) => {
  const done = [...new Set([...(a?.done || []), ...(b?.done || [])])].sort((x, y) => x - y);
  const scores = { ...(a?.scores || {}) };
  for (const [k, v] of Object.entries(b?.scores || {})) scores[k] = Math.max(Number(scores[k] || 0), Number(v || 0));
  return { done, scores };
};

const FN_HEADERS = { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

// บันทึก progress ขึ้น account (เรียนต่อข้ามเครื่อง) — เรียกหลัง save("progress") ทุกครั้งถ้า signedUp
const syncProgressRemote = async (np) => {
  try {
    const u = load("user", null); if (!u) return;
    if (u.line_user_id) { const idt = load("line_id_token", null); if (idt) await fetch(FN_URL("account-progress"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ action: "save", id_token: idt, progress: np }) }); }
    else if (u.auth_user_id) { const at = load("sb_access_token", null); if (at) await fetch(FN_URL("account-progress"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ action: "save", access_token: at, progress: np }) }); }
  } catch (e) {}
};

// ทำ LINE signup ให้เสร็จ (เรียกหลัง LIFF login redirect กลับมา / หรือกรณี login อยู่แล้ว)
const finishLineSignup = async () => {
  const liff = await loadLiff();
  if (!liff || !liff.isLoggedIn()) return null;
  const pending = load("signup_pending", {}) || {};
  let idToken = null; try { idToken = liff.getIDToken(); } catch (e) {}
  if (!idToken) return null;
  let profile = {}; try { profile = await liff.getProfile(); } catch (e) {}
  let isFriend = true; try { const fs = await liff.getFriendship(); isFriend = !!fs?.friendFlag; } catch (e) {}
  save("line_id_token", idToken);
  const res = await fetch(FN_URL("auth-line-link"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({
    id_token: idToken, phone: pending.phone || "", pdpa: true, display_name: profile.displayName || "",
    utm: getUTM(), landing_url: load("landing_url", null), local_progress: load("progress", { done: [], scores: {} }),
    gate_variant: pending.gate_variant || getGateVariant(),
  }) });
  let data = {}; try { data = await res.json(); } catch (e) {}
  if (!data?.ok) return null;
  const u = { name: data.name || profile.displayName || pending.name || "", phone: pending.phone || "", line_user_id: data.line_user_id, customer_id: data.customer_id };
  save("user", u); save("signed_up", true); save("line_added", false); // ยืนยันแอดจริงตอนกด "เพิ่มเพื่อนแล้ว" (ตรวจ cross-provider ไม่ได้)
  if (data.progress) save("progress", data.progress);
  if (data.coupon) save("coupon", data.coupon);
  save("signup_pending", null); save("line_login_pending", false); save("enrolled", true);
  safeTrack("signup_complete", { provider: "line", is_friend: isFriend });
  phCapture("signup_complete", { provider: "line", variant: getGateVariant() });
  return { user: u, progress: data.progress, isFriend };
};

// ทำ signup ให้เสร็จสำหรับ Google/Email (มี Supabase session แล้ว)
const finalizeOAuthSignup = async (provider) => {
  const supa = await getSupabase();
  const { data: { session } } = await supa.auth.getSession();
  if (!session) return null;
  const pending = load("signup_pending", {}) || {};
  const authUserId = session.user.id;
  const email = session.user.email || "";
  const name = session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";
  save("sb_access_token", session.access_token);
  const fields = { auth_provider: provider, auth_user_id: authUserId, oauth_sub: authUserId, email, name: name || undefined, display_name: name || undefined, tel: pending.phone || undefined, pdpa_consent_at: new Date().toISOString(), signup_at: new Date().toISOString(), source: "online-course", gate_variant: pending.gate_variant || getGateVariant(), landing_url: load("landing_url", null), ...getUTM() };
  const existing = await supaRest("customers", "GET", null, `?auth_user_id=eq.${authUserId}&select=id&limit=1`);
  let customerId;
  if (Array.isArray(existing) && existing[0]) { customerId = existing[0].id; await supaRest("customers", "PATCH", fields, `?id=eq.${customerId}`); }
  else { customerId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6); await supaRest("customers", "POST", { id: customerId, ...fields }); await supaRest("online_students", "POST", { customer_id: customerId, name: name || "", phone: pending.phone || "", email, status: "กำลังเรียน" }); }
  let progress = load("progress", { done: [], scores: {} });
  try { const r = await fetch(FN_URL("account-progress"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ action: "save", access_token: session.access_token, progress }) }); const d = await r.json(); if (d?.progress) progress = mergeProgressLocal(progress, d.progress); } catch (e) {}
  const u = { name: name || "", phone: pending.phone || "", email, auth_user_id: authUserId, customer_id: customerId };
  save("user", u); save("signed_up", true); save("progress", progress); save("signup_pending", null); save("oauth_pending", false); save("enrolled", true);
  safeTrack("signup_complete", { provider });
  phCapture("signup_complete", { provider, variant: getGateVariant() });
  return { user: u, progress };
};

// ========== CERTIFICATE EXPORT HELPERS (PDF / รูปภาพ) ==========
const LOGO_SRC = "/logo.png"; // วางไฟล์โลโก้ไว้ที่ files/jia-online/public/logo.png
const sanitizeFileName = (name) => (name || "ใบประกาศนียบัตร")
  .normalize("NFC")
  .replace(/[\\/:*?"<>|]+/g, "")
  .replace(/\s+/g, "_")
  .slice(0, 40) || "certificate";
// แปลง DOM node เป็น PNG data URL ความละเอียดสูง (retina) ด้วย html-to-image (dynamic import → code-split)
const captureNodeToPng = async (node) => {
  const { toPng } = await import("html-to-image");
  return await toPng(node, {
    pixelRatio: Math.max(2, window.devicePixelRatio || 1),
    backgroundColor: "#FFFFFF",
    cacheBust: true,
    width: node.offsetWidth,
    height: node.offsetHeight,
  });
};
// แชร์ไฟล์ผ่าน share sheet ของมือถือก่อน (เซฟลง Photos/Files หรือส่ง LINE ได้); ถ้าไม่รองรับ → ดาวน์โหลดแบบ <a download>
const deliverBlob = async (blob, filename, mime) => {
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
const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();

// กราฟิกตกแต่งใบประกาศ (กรอบทอง + คลื่นน้ำเงิน + ซีล + ริบบิ้น) — ไม่มีข้อความ วางเป็นเลเยอร์พื้นหลัง
const CERT_DECO = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 900 636" preserveAspectRatio="none">
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
<line x1="305" y1="376" x2="438" y2="376" stroke-width="1.4"/><line x1="462" y1="376" x2="595" y2="376" stroke-width="1.4"/>
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
const getPurchased = () => {
  const stored = load("purchased", null);
  const promoUnlocked = load("promo_unlocked", []);
  if (stored && stored.length) return promoUnlocked.length ? [...new Set([...stored, ...promoUnlocked])] : stored;
  if (load("grandfathered", false)) return [1,2,3,4,5,6,7];
  // grandfather: user ที่เคย enrolled ในช่วง FREE_LAUNCH ให้คงสิทธิ์เรียนฟรีทุกบท
  if (FREE_LAUNCH || load("enrolled", false)) { save("grandfathered", true); return [1,2,3,4,5,6,7]; }
  const base = [PRICING.freeModule];
  return promoUnlocked.length ? [...new Set([...base, ...promoUnlocked])] : base;
};
const savePurchased = (ids) => { save("purchased", ids); };
const isModuleAccessible = (id, purchased) => purchased.includes(id) || (id === 7 && purchased.filter(x => x <= 6).length === 6);
const calcPrice = (count) => {
  if (count >= 6) return PRICING.full;
  if (count >= 3) return Math.floor(count / 3) * PRICING.bundle3 + (count % 3) * PRICING.single;
  return count * PRICING.single;
};

// ========== COURSE DATA ==========
// ควิซเกริ่นนำหน้าแรก (CPR ผู้ใหญ่ ง่ายๆ เน้นกำลังใจ ไม่มีเกณฑ์ผ่าน) — ตัวล่อก่อนเก็บ LINE
// img: รูปประกอบ (วางไฟล์จริงทับใน public/teaser/ ภายหลัง) — ถ้าโหลดไม่ได้ใช้ emoji fallback
const TEASER_QUIZ = [
  { q: "เจอคนหมดสติล้มอยู่ สิ่งแรกที่ควรทำคืออะไร?", c: ["รีบวิ่งเข้าไปทันที", "ดูความปลอดภัยรอบตัวก่อนเข้าไป", "ถ่ายคลิปไว้ก่อน", "เดินเลี่ยงไป"], a: 1, img: "/teaser/q1.webp", emoji: "⚠️", hint: "ความปลอดภัยของผู้ช่วยมาก่อนเสมอ" },
  { q: "เบอร์โทรขอรถพยาบาล/แพทย์ฉุกเฉินในไทยคือเบอร์อะไร?", c: ["191", "1669", "1112", "1133"], a: 1, img: "/teaser/q2.webp", emoji: "📞", hint: "จำง่ายๆ 1669 — สายด่วนการแพทย์ฉุกเฉิน" },
  { q: "การกดหน้าอก CPR ควรกดตรงไหน?", c: ["กลางหน้าอก", "ที่ท้อง", "ที่คอ", "ที่ไหล่"], a: 0, img: "/teaser/q3.webp", emoji: "🫶", hint: "วางส้นมือกลางหน้าอก" },
  { q: "ควรกดหน้าอกเร็วประมาณเท่าไร?", c: ["ช้าๆ สบายๆ", "100–120 ครั้งต่อนาที", "เร็วที่สุดเท่าที่ทำได้", "ไม่สำคัญ"], a: 1, img: "/teaser/q4.webp", emoji: "🥁", hint: "จังหวะพอๆ กับเพลงเร็ว ~100–120/นาที" },
  { q: "เครื่อง AED (เครื่องกระตุกหัวใจ) คนทั่วไปใช้ได้ไหม?", c: ["ใช้ได้ เครื่องมีเสียงบอกทุกขั้นตอน", "ใช้ได้เฉพาะหมอ", "อันตราย ห้ามแตะ", "ต้องเรียน 1 ปีก่อน"], a: 0, img: "/teaser/q5.webp", emoji: "❤️‍🩹", hint: "AED ออกแบบให้คนทั่วไปใช้ได้ มีเสียงนำทุกขั้นตอน" },
];

const COURSE = { title: "CPR & AED ออนไลน์", price: FREE_LAUNCH ? 0 : PRICING.full, modules: [
  { id: 1, title: "บทที่ 1: CPR ผู้ใหญ่", short: "CPR ผู้ใหญ่", desc: "เทคนิคการช่วยชีวิตผู้ใหญ่ขั้นพื้นฐาน ตามมาตรฐาน 2025", vid: "IbvE4PnW_80", dur: 54, quiz: [
    { q: "ขั้นตอนแรกก่อนเข้าช่วยเหลือผู้หมดสติคืออะไร?", c: ["ทำ CPR ทันที", "โทร 1669", "ประเมินความปลอดภัยของที่เกิดเหตุ (Scene Safety)", "ใช้ AED"], a: 2 },
    { q: "การประเมินการตอบสนอง ทำอย่างไร?", c: ["เขย่าตัวแรงๆ", "ตบบ่าพร้อมตะโกน \"คุณ...คุณ...เป็นยังไงบ้าง\"", "ตรวจชีพจร", "ตบหน้า"], a: 1 },
    { q: "ความลึกในการกดหน้าอกผู้ใหญ่คือเท่าไร?", c: ["อย่างน้อย 3 ซม.", "อย่างน้อย 5 ซม. ถึง 6 ซม.", "อย่างน้อย 7 ซม.", "อย่างน้อย 10 ซม."], a: 1 },
    { q: "อัตราความเร็วในการกดหน้าอกที่ถูกต้องคือเท่าไร?", c: ["80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "120-140 ครั้ง/นาที", "60-80 ครั้ง/นาที"], a: 1 },
    { q: "อัตราส่วนกดหน้าอก:ช่วยหายใจ ในผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "30:1"], a: 1 },
  ]},
  { id: 2, title: "บทที่ 2: CPR ทารก", short: "CPR ทารก", desc: "เทคนิค CPR สำหรับทารก ความแตกต่างจากผู้ใหญ่", vid: "fu65-_ENCLo", dur: 50, quiz: [
    { q: "การกดหน้าอกทารก ใช้อะไรกด?", c: ["ฝ่ามือ 2 ข้าง", "สันมือ หรือ 2 นิ้วโป้ง", "กำปั้น", "ฝ่ามือ 1 ข้าง"], a: 1 },
    { q: "ความลึกในการกดหน้าอกทารกคือเท่าไร?", c: ["2 ซม.", "ประมาณ 4 ซม. หรือ 1.5 นิ้ว (1/3 ของความหนาหน้าอก)", "5 ซม.", "1 ซม."], a: 1 },
    { q: "อัตราส่วนกดหน้าอก:เป่าปาก สำหรับทารก (ผู้ช่วย 1 คน)?", c: ["15:2", "30:2", "30:1", "10:2"], a: 1 },
    { q: "ถ้ามีผู้ช่วยเหลือ 2 คน อัตราส่วนกด:เป่า เปลี่ยนเป็นเท่าไร?", c: ["30:2", "15:2", "30:1", "10:2"], a: 1 },
    { q: "ตำแหน่งกดหน้าอกทารกอยู่ที่ไหน?", c: ["กึ่งกลางหน้าอก ใต้แนวราวนม", "ด้านซ้ายหน้าอก", "บนท้อง", "ที่คอ"], a: 0 },
  ]},
  { id: 3, title: "บทที่ 3: สิ่งอุดกั้นทางเดินหายใจ ผู้ใหญ่", short: "Choking ผู้ใหญ่", desc: "วิธีช่วยเหลือผู้ใหญ่สำลัก แยกแยะอุดกั้นบางส่วนและสมบูรณ์", vid: "_nT-BcNoUzE", dur: 51, quiz: [
    { q: "การอุดกั้นบางส่วน สังเกตอย่างไร?", c: ["พูดไม่ออก หน้าเขียว", "ผู้ป่วยยังพูดได้ ไอเสียงดัง", "ใช้มือจับคอ", "หมดสติ"], a: 1 },
    { q: "การอุดกั้นสมบูรณ์ (อันตรายถึงชีวิต) สังเกตอย่างไร?", c: ["ไอเสียงดัง ยังพูดได้", "พูดไม่ออก ใช้มือจับคอ หน้าเขียว ไอไม่มีเสียง", "หน้าแดง แต่ยังพูดได้", "เจ็บคอเล็กน้อย"], a: 1 },
    { q: "ถ้าผู้ป่วยยังไอได้เสียงดัง ควรทำอย่างไร?", c: ["ตบหลังทันที", "กดท้อง Heimlich", "ให้ผู้ป่วยไอต่อไป ห้ามตบหลัง", "โทร 1669"], a: 2 },
    { q: "วิธี Heimlich Maneuver ตำแหน่งกดท้องอยู่ที่ไหน?", c: ["เหนือสะดือ ต่ำกว่ากระดูกหน้าอก", "กลางหน้าอก", "ที่สะดือพอดี", "ใต้สะดือ"], a: 0 },
    { q: "ถ้าผู้ป่วยสำลักจนหมดสติ ต้องทำอย่างไร?", c: ["ทำ Heimlich ต่อ", "วางลงบนพื้น เริ่มทำ CPR ทันที", "ให้ดื่มน้ำ", "นั่งรอรถพยาบาล"], a: 1 },
  ]},
  { id: 4, title: "บทที่ 4: สิ่งอุดกั้นทางเดินหายใจ ทารก", short: "Choking ทารก", desc: "วิธีช่วยเหลือทารกสำลัก ตบหลังสลับกดหน้าอก", vid: "pCgxwQUzph0", dur: 32, quiz: [
    { q: "ถ้าทารกยังร้องได้ ไอเสียงดัง ควรทำอย่างไร?", c: ["ตบหลังทันที", "ปล่อยให้ไอเอาสิ่งอุดกั้นออกเอง ห้ามตบหลัง", "กดท้อง", "จับขาสะบัด"], a: 1 },
    { q: "ท่าตบหลังทารก จับทารกอย่างไร?", c: ["อุ้มตั้งขึ้น", "คว่ำหน้าบนแขน ศีรษะต่ำกว่าลำตัว", "วางนอนหงายบนพื้น", "จับตั้งศีรษะขึ้น"], a: 1 },
    { q: "ตบหลังทารก ตบตรงไหน กี่ครั้ง?", c: ["กึ่งกลางกระดูกสะบักทั้ง 2 ข้าง จำนวน 5 ครั้ง", "ตบที่ศีรษะ 3 ครั้ง", "ตบที่ก้น 5 ครั้ง", "ตบที่ท้อง 5 ครั้ง"], a: 0 },
    { q: "หลังตบหลัง 5 ครั้ง ยังไม่ออก ทำอะไรต่อ?", c: ["ตบหลังต่อ", "พลิกหงาย กดหน้าอก 5 ครั้ง ใต้แนวราวนม", "ใช้นิ้วล้วงคอ", "เป่าปาก"], a: 1 },
    { q: "ข้อห้ามในการช่วยทารกสำลัก?", c: ["ห้ามตบหลัง", "ห้ามกดหน้าอก", "ห้ามจับขาสะบัด ห้ามกดท้องแบบผู้ใหญ่ ห้ามล้วงนิ้วเข้าปาก", "ห้ามเป่าปาก"], a: 2 },
  ]},
  { id: 5, title: "บทที่ 5: Megacode — CPR & AED ผู้ใหญ่", short: "CPR & AED ผู้ใหญ่", desc: "การใช้เครื่อง AED ร่วมกับ CPR และการช่วยจนรอด", vid: "dQ9TcHdhIr0", dur: 217, quiz: [
    { q: "ตำแหน่งแปะแผ่น AED ที่แนะนำคือ?", c: ["ทั้ง 2 แผ่นบนหน้าอก", "แผ่นแรกใต้ไหปลาร้าขวา แผ่นสองใต้ราวนมซ้ายแนวรักแร้", "แผ่นบนท้อง 2 แผ่น", "แผ่นบนหลัง 2 แผ่น"], a: 1 },
    { q: "ก่อนกดปุ่ม Shock ต้องดูอะไร?", c: ["ดูว่าเครื่องเปิดอยู่", "ดูว่าไม่มีใครสัมผัสตัวผู้ป่วย", "ดูว่าแผ่นติดแน่น", "ดูว่าผู้ป่วยหายใจ"], a: 1 },
    { q: "ก่อนกดปุ่ม Shock ต้องตะโกนว่าอะไร?", c: ["\"ถอยเลย!\"", "\"หลบออก!\"", "\"ฉันถอย คุณถอย ทุกคนถอย!\"", "\"ห้ามแตะ!\""], a: 2 },
    { q: "จะหยุดปั๊มหัวใจได้เมื่อไหร่?", c: ["เมื่อเหนื่อย", "ทีมฉุกเฉินมาถึง / ผู้ป่วยหายใจเอง / ผู้ป่วยรู้สึกตัว", "เมื่อครบ 5 นาที", "เมื่อ AED ช็อกแล้ว"], a: 1 },
    { q: "ถ้าผู้ป่วยหายใจเองแล้วแต่ยังไม่รู้สึกตัว ต้องทำอย่างไร?", c: ["ปิดเครื่อง AED แล้วรอ", "กด CPR ต่อ", "จัดท่านอนตะแคงกึ่งคว่ำ (Recovery Position) ดูการหายใจทุก 2 นาที", "ให้ดื่มน้ำ"], a: 2 },
  ]},
  { id: 6, title: "บทที่ 6: Megacode — CPR & AED ทารก/เด็ก", short: "CPR & AED ทารก/เด็ก", desc: "ขั้นตอนการช่วยเหลือและการใช้ AED สำหรับเด็กทารก", vid: "lCbImOmcrNA", dur: 119, quiz: [
    { q: "เวลากดหน้าอกทารก ควรกดลึกประมาณเท่าไหร่?", c: ["1 เซนติเมตร", "4 เซนติเมตร", "6 เซนติเมตร", "8 เซนติเมตร"], a: 1 },
    { q: "ถ้ามีผู้ช่วยเหลือ 2 คน ควรกดหน้าอกกี่ครั้ง แล้วเป่าปากกี่ครั้ง?", c: ["กด 30 ครั้ง เป่า 2 ครั้ง", "กด 15 ครั้ง เป่า 2 ครั้ง", "กด 5 ครั้ง เป่า 1 ครั้ง", "กด 10 ครั้ง เป่า 2 ครั้ง"], a: 1 },
    { q: "ตำแหน่งในการติดแผ่น AED สำหรับทารก ที่ดีที่สุดคือข้อใด?", c: ["ติดที่หน้าอกด้านซ้ายและขวา", "ติดที่หน้าอกด้านหน้าและแผ่นหลัง", "ติดที่หน้าผากและท้อง", "ติดที่ท้องและหลัง"], a: 1 },
    { q: "ก่อนกดปุ่มช็อก (Shock) ด้วยเครื่อง AED ต้องทำอะไรก่อน?", c: ["ตรวจดูชีพจร", "เป่าลมเพิ่ม 1 ครั้ง", "บอกให้ทุกคนถอยห่างจากตัวเด็ก", "ถอดแผ่น AED ออกก่อน"], a: 2 },
    { q: "ถ้าไม่มีแผ่น AED สำหรับเด็ก ควรทำอย่างไร?", c: ["ไม่ต้องช็อก", "ใช้แผ่นผู้ใหญ่ แต่ต้องแน่ใจว่าแผ่นไม่แตะกัน", "รอให้มีคนเอาอุปกรณ์สำหรับเด็กมา", "กด CPR อย่างเดียว ไม่ต้องใช้ AED"], a: 1 },
  ]},
  { id: 7, title: "แบบทดสอบสุดท้าย", short: "Final Exam", desc: "ทดสอบความรู้ทั้งหมด 6 บท ต้องได้ 80% ขึ้นไปจึงผ่าน", vid: null, dur: null, quiz: [
    { q: "ขั้นตอนแรกเมื่อพบผู้หมดสติคืออะไร?", c: ["ทำ CPR ทันที", "โทร 1669", "ประเมินความปลอดภัยที่เกิดเหตุ (Scene Safety)", "ใช้ AED"], a: 2 },
    { q: "ประเมินการหายใจใช้เวลาเท่าไร?", c: ["5 วินาที", "ไม่เกิน 10 วินาที", "30 วินาที", "1 นาที"], a: 1 },
    { q: "อัตราส่วนกด:เป่า ผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "5:1"], a: 1 },
    { q: "ความลึกกดหน้าอกผู้ใหญ่?", c: ["3 ซม.", "อย่างน้อย 5 ซม. ถึง 6 ซม.", "7 ซม.", "10 ซม."], a: 1 },
    { q: "ความเร็วกดหน้าอก?", c: ["60-80 ครั้ง/นาที", "80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "120-150 ครั้ง/นาที"], a: 2 },
    { q: "กดหน้าอกทารก ใช้อะไร?", c: ["ฝ่ามือ 2 ข้าง", "สันมือ หรือ 2 นิ้วโป้ง", "กำปั้น", "ฝ่ามือ 1 ข้าง"], a: 1 },
    { q: "ผู้ใหญ่สำลักขั้นรุนแรง ทำอย่างไร?", c: ["ให้ดื่มน้ำ", "ตบหลัง 5 ครั้ง สลับกดท้อง 5 ครั้ง", "กดท้อง Heimlich ทันที", "เป่าปาก"], a: 1 },
    { q: "ห้ามทำอะไรกับทารกที่สำลัก?", c: ["ห้ามตบหลัง", "ห้ามกดท้อง ห้ามจับขาสะบัด", "ห้ามกดหน้าอก", "ห้ามเป่าปาก"], a: 1 },
    { q: "ก่อนกด Shock ต้องตะโกนว่าอะไร?", c: ["\"ถอยเลย!\"", "\"ฉันถอย คุณถอย ทุกคนถอย!\"", "\"หลบออก!\"", "\"ห้ามแตะ!\""], a: 1 },
    { q: "จะหยุดปั๊มหัวใจเมื่อไหร่?", c: ["เมื่อเหนื่อย", "เมื่อครบ 5 นาที", "ทีมฉุกเฉินมาถึง / ผู้ป่วยหายใจเอง / ผู้ป่วยรู้สึกตัว", "เมื่อ AED ช็อกแล้ว"], a: 2 },
  ]},
]};

// ==================== ICONS ====================
const icons = {
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
};
const I = ({ name, size = 20, color = B.black }) => icons[name]?.(size, color) || null;

// โลโก้ JIA TRAINER CENTER — แสดงรูปจาก public/logo.png ถ้าโหลดไม่ได้ fallback เป็นไอคอน cert เดิม
const Logo = ({ size = 120 }) => {
  const [err, setErr] = useState(false);
  if (err) return (<div style={{ margin: "0 auto", width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: `${B.gold}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><I name="cert" size={size * 0.3} color={B.gold}/></div>);
  return <img src={LOGO_SRC} alt="JIA TRAINER CENTER" onError={() => setErr(true)} style={{ width: size, height: "auto", maxWidth: "100%", display: "block", margin: "0 auto" }}/>;
};

// ==================== STYLES ====================
const css = {
  btn: (bg, color, full) => ({ background: bg, color, border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all .2s", ...(full ? { width: "100%", display: "block" } : {}) }),
  card: { background: B.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
  header: (bg) => ({ background: bg, color: B.white, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }),
  page: { minHeight: "100vh", background: B.cream },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 20px" },
};

// ==================== MORROO NETWORK ADS ====================
const MORROO_ADS = [
  { id: "advice", brand: "Morroo Advice", emoji: "🩺", tag: "AI ปรึกษาสุขภาพ", headline: "ไม่สบายใจ? ถาม AI หมอก่อน", desc: "ปรึกษาอาการกับ AI ภาษาไทย ตอบใน 5 วินาที — ฟรี 3 ครั้ง/วัน", cta: "เริ่มปรึกษาฟรี", url: "https://advice.morroo.com", bg: "#3B82F6", bgLight: "#3B82F612" },
  { id: "lab", brand: "Lab.morroo", emoji: "🔬", tag: "AI อ่านผล Lab", headline: "อ่านผล Lab ไม่เข้าใจ?", desc: "ถ่ายรูปใบผลตรวจ → AI อ่านให้ใน 30 วิ พร้อม flag ค่าผิดปกติเป็นภาษาไทย", cta: "ลองอ่านผลฟรี", url: "https://lab.morroo.com", bg: "#0EA5E9", bgLight: "#0EA5E912" },
  { id: "roodee", brand: "RooDee (รู้ดี)", emoji: "📚", tag: "ติวสอบด้วย AI", headline: "เตรียมลูกสอบ ป.1 / TCAS?", desc: "ข้อสอบ 5,000+ ข้อ · AI วิเคราะห์จุดอ่อน · Mock Exam จำลองสนามจริง", cta: "เริ่มเรียนฟรี", url: "https://pocket.morroo.com", bg: "#8B5CF6", bgLight: "#8B5CF612" },
  { id: "roodeeme", brand: "คู่มือข้างตัว", emoji: "⚕️", tag: "AI ผู้ช่วยแพทย์", headline: "หมอ/นศพ. พกคู่มือไว้ในมือถือ", desc: "ICD-10 ไทย · ตรวจยาตีกัน · คำนวณ Drug Dose · ฝึก Long Case กับ AI-คนไข้", cta: "ใช้ฟรี 20 ครั้ง/เดือน", url: "https://roodee.me", bg: "#DC2626", bgLight: "#DC262612" },
];

function MorrooAdBanner() {
  const [ad] = useState(() => MORROO_ADS[Math.floor(Math.random() * MORROO_ADS.length)]);
  const trackedUrl = `${ad.url}${ad.url.includes("?") ? "&" : "?"}utm_source=cpr.morroo.com&utm_medium=banner&utm_campaign=morroo_network&utm_content=${ad.id}`;
  return (
    <a href={trackedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit", marginBottom: 16 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 18, border: `1px solid ${ad.bg}30`, position: "relative", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, color: B.dkGray, letterSpacing: 1, textTransform: "uppercase", opacity: 0.55 }}>โฆษณา</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ minWidth: 52, height: 52, borderRadius: 14, background: ad.bgLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{ad.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ad.bg, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>{ad.tag}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 4, lineHeight: 1.3 }}>{ad.headline}</div>
            <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5, marginBottom: 10 }}>{ad.desc}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ad.bg, color: B.white, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8 }}>{ad.cta} →</div>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${B.gray}`, fontSize: 10, color: B.dkGray, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>by <strong style={{ color: ad.bg }}>{ad.brand}</strong></span>
          <span style={{ opacity: 0.6 }}>morroo network</span>
        </div>
      </div>
    </a>
  );
}

// ==================== NEWS / BLOG ====================
const NEWS_SITE_SLUG = "jiacpr";

function useNewsList(limit = 6) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cols = "id,url_slug,title,meta_description,cover_image_url,category,published_at,keywords";
      const data = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&select=${cols}&order=published_at.desc.nullslast&limit=${limit}`);
      if (!cancelled) { setPosts(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return { posts, loading };
}

const fmtBlogDate = (d, long = false) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("th-TH", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" }); }
  catch (e) { return ""; }
};

const CPR_KEYWORDS = /(CPR|AED|ช่วยชีวิต|หัวใจหยุด|Heimlich|สำลัก|กดหน้าอก|ฟื้นคืนชีพ|ปั๊มหัวใจ|ช็อกหัวใจ)/i;
const isCprPost = (p) => CPR_KEYWORDS.test(p.title || "") || CPR_KEYWORDS.test(p.category || "") || CPR_KEYWORDS.test(p.meta_description || "") || CPR_KEYWORDS.test(p.keywords || "");

function NewsCarousel({ posts, openBlog, goAll, title, subtitle, accent }) {
  if (!posts || posts.length === 0) return null;
  const ac = accent || B.red;
  return (
    <div style={{ ...css.wrap, paddingTop: 8, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
        <button onClick={goAll} style={{ background: "none", border: "none", color: ac, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}>ดูทั้งหมด →</button>
      </div>
      {subtitle && <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>{subtitle}</div>}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", marginRight: -20, paddingRight: 20 }}>
        {posts.map(p => (
          <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ flex: "0 0 230px", scrollSnapAlign: "start", background: B.white, border: "none", borderRadius: 14, overflow: "hidden", textAlign: "left", cursor: "pointer", padding: 0, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            {p.cover_image_url
              ? <div style={{ width: "100%", aspectRatio: "16/10", background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
              : <div style={{ width: "100%", aspectRatio: "16/10", background: `linear-gradient(135deg, ${ac}, ${B.dkRed})`, display: "flex", alignItems: "center", justifyContent: "center", color: B.white, fontSize: 13, fontWeight: 700, padding: 12, textAlign: "center" }}>{p.category || "บทความ"}</div>}
            <div style={{ padding: 12 }}>
              {p.category && <div style={{ fontSize: 10, color: ac, fontWeight: 700, marginBottom: 4, letterSpacing: .5 }}>{p.category}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
              {p.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6 }}>{fmtBlogDate(p.published_at)}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NewsSection({ openBlog, goAll, title = "ข่าวสาร & บทความ", subtitle = "", cprOnly = false, max = 6 }) {
  const { posts, loading } = useNewsList(cprOnly ? 24 : 24);
  if (loading || posts.length === 0) return null;
  const cpr = posts.filter(isCprPost).slice(0, max);
  if (cprOnly) {
    if (cpr.length === 0) return null;
    return <NewsCarousel posts={cpr} openBlog={openBlog} goAll={goAll} title={title || "บทความ CPR & การช่วยชีวิต"} subtitle={subtitle || "ทบทวนความรู้เพิ่มเติม"} accent={B.red}/>;
  }
  const general = posts.filter(p => !isCprPost(p)).slice(0, max);
  return (
    <>
      {cpr.length > 0 && <NewsCarousel posts={cpr} openBlog={openBlog} goAll={goAll} title="บทความ CPR & การช่วยชีวิต" subtitle="เนื้อหาเข้มข้นจาก JIA Trainer Center" accent={B.red}/>}
      {general.length > 0 && <NewsCarousel posts={general} openBlog={openBlog} goAll={goAll} title={title} subtitle={subtitle}/>}
    </>
  );
}

// ข่าวช่วยชีวิต/AED จากฟีดสาธารณะของ jiaaed.com — ทุกการ์ดลิงก์ออกไปข่าวต้นฉบับ
// (ลิขสิทธิ์เป็นของสำนักข่าวเดิม) ถ้าฟีดล่ม/ออฟไลน์จะซ่อนทั้ง section
function JiaAedNewsSection({ max = 5 }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://jiaaed.com/api/news/public?limit=${max}`);
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [max]);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ ...css.wrap, paddingTop: 8, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ข่าวช่วยชีวิต & AED</h3>
        <a href="https://jiaaed.com" target="_blank" rel="noopener noreferrer" style={{ color: B.red, fontSize: 13, fontWeight: 600, textDecoration: "none", padding: 4 }}>jiaaed.com →</a>
      </div>
      <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>อัปเดตจาก JiaAED — แตะข่าวเพื่ออ่านต้นฉบับ</div>
      {items.map((n, i) => (
        <a key={n.source_url || i} href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "12px 14px", marginBottom: 8, background: B.white, borderRadius: 14, textDecoration: "none", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 10, color: B.red, fontWeight: 700, marginBottom: 3, letterSpacing: .5 }}>{[n.topic, n.source_name].filter(Boolean).join(" · ")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.45 }}>{n.source_title}</div>
          {n.our_blurb && <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.our_blurb}</div>}
          {n.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 5 }}>{fmtBlogDate(n.published_at, true)}</div>}
        </a>
      ))}
    </div>
  );
}

function BlogList({ goBack, openBlog }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cols = "id,url_slug,title,meta_description,cover_image_url,category,published_at";
      const data = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&select=${cols}&order=published_at.desc.nullslast&limit=60`);
      if (!cancelled) { setPosts(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>ข่าวสาร & บทความ</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        {loading ? <div style={{ textAlign: "center", color: B.dkGray, padding: 40 }}>กำลังโหลด...</div>
          : posts.length === 0 ? <div style={{ textAlign: "center", color: B.dkGray, padding: 40 }}>ยังไม่มีบทความ</div>
          : posts.map(p => (
            <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ display: "flex", gap: 12, width: "100%", padding: 12, marginBottom: 10, background: B.white, border: "none", borderRadius: 14, cursor: "pointer", textAlign: "left", alignItems: "flex-start" }}>
              {p.cover_image_url
                ? <div style={{ width: 96, height: 72, flexShrink: 0, borderRadius: 10, background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
                : <div style={{ width: 96, height: 72, flexShrink: 0, borderRadius: 10, background: `linear-gradient(135deg, ${B.red}, ${B.dkRed})` }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                {p.category && <div style={{ fontSize: 10, color: B.red, fontWeight: 700, marginBottom: 2 }}>{p.category}</div>}
                <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                {p.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 4 }}>{fmtBlogDate(p.published_at, true)}</div>}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}

function BlogDetail({ slug, goBack, openBlog }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await supaRest("blog_posts", "GET", null, `?url_slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
      const p = Array.isArray(data) && data[0] ? data[0] : null;
      if (!cancelled) { setPost(p); setLoading(false); }
      if (p) {
        const cols = "id,url_slug,title,cover_image_url,category,published_at";
        const rel = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&url_slug=neq.${encodeURIComponent(slug)}&select=${cols}&order=published_at.desc.nullslast&limit=4`);
        if (!cancelled) setRelated(Array.isArray(rel) ? rel : []);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);
  if (loading) return (<div style={css.page}><div style={css.header(B.red)}><button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>กำลังโหลด...</div></div></div>);
  if (!post) return (<div style={css.page}><div style={css.header(B.red)}><button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ไม่พบบทความ</div></div><div style={{ ...css.wrap, paddingTop: 40, textAlign: "center", color: B.dkGray }}>บทความนี้อาจถูกลบหรือยังไม่เผยแพร่</div></div>);
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 16, paddingBottom: 60 }}>
        {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} style={{ width: "100%", borderRadius: 14, marginBottom: 14, display: "block" }}/>}
        {post.category && <div style={{ fontSize: 11, color: B.red, fontWeight: 700, marginBottom: 6, letterSpacing: .5 }}>{post.category.toUpperCase()}</div>}
        <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, margin: "0 0 10px" }}>{post.title}</h1>
        {post.published_at && <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 18 }}>{fmtBlogDate(post.published_at, true)}</div>}
        {post.meta_description && <div style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6, marginBottom: 16, padding: "12px 14px", background: `${B.gold}10`, borderLeft: `3px solid ${B.gold}`, borderRadius: 6 }}>{post.meta_description}</div>}
        {post.content_html && <div className="jia-blog-content" style={{ fontSize: 15, lineHeight: 1.8, color: B.black, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: post.content_html }}/>}
        {related.length > 0 && <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>บทความอื่นที่น่าสนใจ</h3>
          {related.map(p => (
            <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ display: "flex", gap: 12, width: "100%", padding: 10, marginBottom: 8, background: B.white, border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", alignItems: "center" }}>
              {p.cover_image_url
                ? <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
                : <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, background: `linear-gradient(135deg, ${B.red}, ${B.dkRed})` }}/>}
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
            </button>
          ))}
        </>}
      </div>
    </div>
  );
}

// ==================== LANDING ====================
function Landing({ go, enterCourse, openBlog }) {
  const [a, setA] = useState(false); useEffect(() => { setTimeout(() => setA(true), 100); }, []);
  return (<div style={css.page}>
    <div style={{ background: `linear-gradient(135deg, ${B.red} 0%, ${B.dkRed} 100%)`, color: B.white, padding: "52px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.06)" }}/>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", opacity: a ? 1 : 0, transform: a ? "translateY(0)" : "translateY(20px)", transition: "all .6s ease" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: .85, marginBottom: 8, fontWeight: 600 }}>JIA TRAINER CENTER</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>คอร์ส CPR & AED</h1>
        <h2 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 16px", opacity: .95 }}>ออนไลน์</h2>
        {FREE_LAUNCH && <div style={{ display: "inline-block", background: B.gold, color: B.black, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>เรียนฟรี! เดือนแรกเท่านั้น</div>}
        {!FREE_LAUNCH && <div style={{ display: "inline-block", background: B.gold, color: B.black, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>บทที่ 1 เรียนฟรี!</div>}
        <p style={{ fontSize: 14, opacity: .9, lineHeight: 1.7, marginBottom: 28 }}>เรียนรู้การช่วยชีวิตขั้นพื้นฐาน มาตรฐาน 2025<br/>ดูวิดีโอ • ทำแบบทดสอบ • รับใบประกาศนียบัตร</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.15)", borderRadius: 16, padding: "14px 28px", marginBottom: 28 }}>
          {FREE_LAUNCH ? (<><span style={{ fontSize: 44, fontWeight: 800 }}>ฟรี!</span><div style={{ textAlign: "left", fontSize: 12 }}><div style={{ textDecoration: "line-through", opacity: .7 }}>ปกติ ฿100</div><div style={{ opacity: .85 }}>+ คูปองส่วนลด ฿100</div></div></>) : (<><span style={{ fontSize: 44, fontWeight: 800 }}>฿35</span><div style={{ textAlign: "left", fontSize: 12 }}><div style={{ opacity: .85 }}>ต่อหัวข้อ</div><div style={{ opacity: .7 }}>Full Course ฿149</div></div></>)}
        </div>
        <div><button onClick={enterCourse} style={{ ...css.btn(B.white, B.red), padding: "16px 52px", fontSize: 16 }}>{FREE_LAUNCH ? "เรียนฟรีเลย →" : "เรียนเลย →"}</button></div>
      </div>
    </div>

    {/* Lead Capture CTA — แสดงเมื่อ promo เปิด หลังจบ free launch และยังไม่เคย claim โค้ด */}
    {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_code", null) && <div style={{ ...css.wrap, paddingTop: 24 }}>
      <button onClick={() => go("claim")} style={{ width: "100%", background: `linear-gradient(135deg, ${B.gold} 0%, #E08800 100%)`, color: B.white, border: "none", borderRadius: 16, padding: 18, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 16px rgba(245,158,11,.25)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I name="star" size={26} color={B.white}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .9, textTransform: "uppercase", letterSpacing: 1 }}>โปรพิเศษ</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>รับโค้ดเรียนฟรี 3 บทหลัก</div>
          <div style={{ fontSize: 12, opacity: .95, marginTop: 2 }}>แค่กรอกข้อมูล • มูลค่า ฿{PRICING.bundle3}</div>
        </div>
        <I name="arrow" size={18} color={B.white}/>
      </button>
    </div>}

    {/* Pricing Section */}
    {!FREE_LAUNCH && <div style={{ ...css.wrap, paddingTop: 36, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เลือกแพ็กเกจ</h3>
      {[
        { label: "1 หัวข้อ", price: "฿35", desc: "เลือกหัวข้อที่สนใจ", bg: B.white, border: B.ltGray, badge: null },
        { label: "3 หัวข้อ", price: "฿100", desc: "เฉลี่ย ฿33/หัวข้อ", bg: B.white, border: B.ltGray, badge: "ประหยัด 5%" },
        { label: "Full Course", price: "฿149", desc: "6 หัวข้อ + Final Exam + Certificate + คูปอง On-site ฿100", bg: `${B.red}06`, border: B.red, badge: "แนะนำ" },
      ].map((p, i) => (
        <div key={i} style={{ background: p.bg, borderRadius: 14, padding: 16, marginBottom: 12, border: `2px solid ${p.border}`, position: "relative" }}>
          {p.badge && <div style={{ position: "absolute", top: -10, right: 12, background: p.badge === "แนะนำ" ? B.red : B.gold, color: B.white, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8 }}>{p.badge}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</div><div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>{p.desc}</div></div>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{p.price}</div>
          </div>
        </div>
      ))}
      <button onClick={() => go("store")} style={{ ...css.btn(B.red, B.white, true), marginTop: 4 }}>เลือกซื้อหัวข้อ →</button>
    </div>}

    <div style={{ ...css.wrap, paddingTop: FREE_LAUNCH ? 36 : 0, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เรียนอะไรบ้าง?</h3>
      {COURSE.modules.slice(0, 6).map((m, i) => (<div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12, background: B.white, borderRadius: 14, padding: "14px 16px" }}><div style={{ minWidth: 38, height: 38, borderRadius: 10, background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", color: B.red, fontWeight: 800, fontSize: 15 }}>{String(i + 1).padStart(2, "0")}</div><div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.short} {i === 0 && !FREE_LAUNCH ? <span style={{ background: B.green, color: B.white, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>ฟรี</span> : null}</div><div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>{m.desc}</div></div></div>))}
      <div style={{ background: `${B.gold}18`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 4 }}><I name="cert" size={26} color={B.gold}/><div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>+ แบบทดสอบสุดท้าย & ใบประกาศนียบัตร</div></div>
    </div>
    <NewsSection openBlog={openBlog} goAll={() => go("blog")} title="ข่าวสาร & บทความ" subtitle="อัปเดตใหม่ทุกวัน — เคสจริง บทความ และทิปส์ช่วยชีวิต"/>
    <JiaAedNewsSection/>
    <div style={{ ...css.wrap, paddingBottom: 24 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 24, border: `1px solid ${B.red}12` }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}><h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>ทำไมต้องเรียน CPR?</h3><p style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ข้อมูลจากงานวิจัย</p></div>
        {[{ n: "10%", c: B.red, t: "ทุก 1 นาทีที่ไม่ได้ทำ CPR\nโอกาสรอดชีวิตลดลง 10%" }, { n: "3-6 เดือน", c: B.gold, t: "ทักษะ CPR เสื่อมลง\nภายใน 3-6 เดือนหลังอบรม" }, { n: "58%", c: B.green, t: "ผู้ทบทวนทุกเดือนทำได้ \"ดีเยี่ยม\"\nเทียบกับ 15% ที่ทบทวนปีละครั้ง" }].map((r, i) => (<div key={i} style={{ background: `${r.c}08`, borderRadius: 12, padding: 14, marginBottom: 14, borderLeft: `4px solid ${r.c}` }}><div style={{ fontSize: 28, fontWeight: 800, color: r.c }}>{r.n}</div><div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.t}</div></div>))}
      </div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 16 }}><MorrooAdBanner/></div>
    <div style={{ ...css.wrap, paddingBottom: 100 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{[{ icon: "play", l: "6 วิดีโอ", s: "เรียนได้ทุกที่" },{ icon: "book", l: "Quiz ทุกบท", s: "ทดสอบความเข้าใจ" },{ icon: "cert", l: "ใบประกาศฯ", s: "มาตรฐาน 2025" },{ icon: "heart", l: "คูปอง ฿100", s: "ใช้ตอนเรียน on-site" }].map((f, i) => (<div key={i} style={{ background: B.white, borderRadius: 14, padding: 16, textAlign: "center" }}><I name={f.icon} size={22} color={B.red}/><div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{f.l}</div><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{f.s}</div></div>))}</div></div>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.08)", zIndex: 100 }}><div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, color: B.dkGray }}>{FREE_LAUNCH ? "ช่วง Launch พิเศษ" : "เริ่มต้น"}</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{FREE_LAUNCH ? "ฟรี!" : "฿35/หัวข้อ"}</div></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => { const txt = "เรียน CPR & AED ออนไลน์! ได้ใบ Certificate + คูปองส่วนลด"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://jiacpr.com/online" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://jiacpr.com/online") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn(B.white, B.red), padding: "10px 14px", border: `1px solid ${B.red}30`, fontSize: 13 }}>แชร์</button><button onClick={enterCourse} style={css.btn(B.red, B.white)}>{FREE_LAUNCH ? "เรียนฟรี" : "เรียนเลย"}</button></div></div></div>
  </div>);
}

// ==================== STORE (เลือกซื้อหัวข้อ) ====================
function Store({ go }) {
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState("select"); // select → payment → done
  const [uploading, setUploading] = useState(false);
  const [slipDone, setSlipDone] = useState(false);
  const purchased = getPurchased();
  const user = load("user", null);
  const buyable = COURSE.modules.filter(m => m.id <= 6 && !purchased.includes(m.id));

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(buyable.map(m => m.id));
  const total = calcPrice(selected.length);
  const isFull = selected.length + purchased.filter(x => x <= 6).length >= 6;

  const [stripePaying, setStripePaying] = useState(false);
  const payWithStripe = async () => {
    setStripePaying(true);
    try {
      const moduleNames = selected.map(id => COURSE.modules.find(x => x.id === id)?.short).filter(Boolean);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          type: "online_purchase",
          items: [{ name: `JIA Online: ${moduleNames.join(", ")}`, amount: total }],
          metadata: { phone: user?.phone || "", modules: selected.join(","), name: user?.name || "" },
          successUrl: window.location.origin + window.location.pathname + "?stripe=success&modules=" + selected.join(","),
          cancelUrl: window.location.origin + window.location.pathname + "?stripe=cancel",
        }),
      });
      const data = await res.json();
      if (data.url) {
        supaRest("online_purchases", "POST", { phone: user?.phone || "", modules: selected.join(","), amount: total, payment_status: "รอชำระ" });
        window.location.href = data.url;
      } else { alert("เกิดข้อผิดพลาด: " + (data.error || "ไม่สามารถสร้างลิงก์ชำระเงินได้")); }
    } catch(err) { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); console.error(err); }
    setStripePaying(false);
  };

  const handleSlip = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileName = (user?.name || "student") + "_course_" + Date.now() + ".jpg";
        const byteChars = atob(reader.result.split(",").pop());
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: "image/jpeg" });
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
          body: blob
        });
        if (uploadRes.ok) {
          const data = { url: `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}` };
          supaRest("online_purchases", "POST", { phone: user?.phone || "", modules: selected.join(","), amount: total, slip_url: data.url, payment_status: "แจ้งชำระแล้ว" });
          const newPurchased = [...new Set([...purchased, ...selected])];
          savePurchased(newPurchased);
          setSlipDone(true);
        } else { alert("อัพโหลดไม่สำเร็จ กรุณาส่งสลิปทาง LINE แทน"); }
      } catch(err) { alert("เกิดข้อผิดพลาด กรุณาส่งสลิปทาง LINE"); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (slipDone) return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>ซื้อสำเร็จ!</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>ปลดล็อก {selected.length} หัวข้อแล้ว เข้าเรียนได้เลย</p>
      <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 20, padding: "14px 40px", fontSize: 16 }}>เข้าเรียนเลย →</button>
    </div></div>
  );

  if (step === "payment") return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => setStep("select")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ชำระเงิน ฿{total}</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ ...css.card, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>สรุปรายการ</div>
        {selected.map(id => { const m = COURSE.modules.find(x => x.id === id); return <div key={id} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${B.gray}` }}>{m.short}</div>; })}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${B.ltGray}` }}>
          <span style={{ fontWeight: 600 }}>รวม {selected.length} หัวข้อ</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: B.red }}>฿{total}</span>
        </div>
        {isFull && <div style={{ fontSize: 12, color: B.green, marginTop: 6 }}>ครบ 6 หัวข้อ! ได้ Final Exam + Full Certificate + คูปอง ฿100 ฟรี</div>}
      </div>
      <div style={{ ...css.card, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>ชำระออนไลน์ (บัตรเครดิต / PromptPay)</div>
        <button onClick={payWithStripe} disabled={stripePaying} style={{ ...css.btn("#635BFF", B.white), padding: "14px 32px", fontSize: 15, width: "100%", opacity: stripePaying ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
          {stripePaying ? "กำลังเปิดหน้าชำระเงิน..." : "ชำระผ่าน Stripe"}
        </button>
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 8 }}>รองรับ Visa / Mastercard / PromptPay — ปลดล็อคทันที</div>
      </div>
      <div style={{ ...css.card, textAlign: "center", marginBottom: 14, position: "relative" }}>
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: B.white, padding: "0 12px", fontSize: 12, color: B.dkGray }}>หรือ</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>โอนเงินเข้าบัญชี</div>
        <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: B.dkGray }}>ธนาคารกสิกรไทย</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, margin: "6px 0" }}>134-3-11564-0</div>
          <div style={{ fontSize: 13, color: B.dkGray }}>บริษัท โรจน์รุ่งธุรกิจ จำกัด</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText("1343115640"); alert("คัดลอกเลขบัญชีแล้ว!"); }} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>คัดลอกเลขบัญชี</button>
      </div>
      <div style={{ ...css.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>อัพโหลดสลิป</div>
        <label style={{ ...css.btn(B.red, B.white), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          <I name="save" size={18} color={B.white}/> {uploading ? "กำลังอัพโหลด..." : "เลือกรูปสลิป"}
          <input type="file" accept="image/*" capture="environment" onChange={handleSlip} disabled={uploading} style={{ display: "none" }}/>
        </label>
      </div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> หรือส่งสลิปทาง LINE @jiacpr</a>
    </div></div>
  );

  return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>เลือกซื้อหัวข้อ</div></div>
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 120 }}>
      {/* Already purchased */}
      {purchased.filter(x => x <= 6).length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 8 }}>หัวข้อที่ซื้อแล้ว ({purchased.filter(x => x <= 6).length})</div>
        {purchased.filter(x => x <= 6).map(id => { const m = COURSE.modules.find(x => x.id === id); return (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 6, background: `${B.green}08`, borderRadius: 10, border: `1px solid ${B.green}30` }}>
            <I name="check" size={16} color={B.green}/><span style={{ fontSize: 13, fontWeight: 600 }}>{m.short}</span>
            {id === PRICING.freeModule && <span style={{ fontSize: 10, background: B.green, color: B.white, padding: "2px 6px", borderRadius: 4, marginLeft: "auto" }}>ฟรี</span>}
          </div>
        ); })}
      </div>}

      {/* Buyable modules */}
      {buyable.length > 0 ? (<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>เลือกหัวข้อที่ต้องการ</div>
          <button onClick={selectAll} style={{ fontSize: 12, color: B.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>เลือกทั้งหมด</button>
        </div>
        {buyable.map(m => { const sel = selected.includes(m.id); return (
          <button key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, background: sel ? `${B.red}06` : B.white, border: sel ? `2px solid ${B.red}` : `1px solid ${B.ltGray}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, border: sel ? `2px solid ${B.red}` : `2px solid ${B.ltGray}`, background: sel ? B.red : B.white, display: "flex", alignItems: "center", justifyContent: "center" }}>{sel && <I name="check" size={14} color={B.white}/>}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{m.short}</div><div style={{ fontSize: 12, color: B.dkGray }}>{m.desc}</div></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.red }}>฿{PRICING.single}</div>
          </button>
        ); })}

        {/* Promo code redeem — gateway to Claim component (ซ่อนระหว่าง FREE_LAUNCH เพราะทุกบทฟรีอยู่แล้ว) */}
        {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_redeemed", false) && <button onClick={() => go("claim")} style={{ width: "100%", marginTop: 12, padding: "12px 14px", background: B.white, border: `2px dashed ${B.gold}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I name="star" size={18} color={B.gold}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.black }}>มีโค้ดส่วนลด 100%?</div>
            <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>ปลดล็อก {PROMO_FREE_MODULES.length} บทฟรี — ใช้โค้ดที่นี่</div>
          </div>
          <I name="arrow" size={14} color={B.gold}/>
        </button>}

        {/* Price tiers */}
        <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>ยิ่งซื้อเยอะยิ่งถูก!</div>
          <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.8 }}>
            1 หัวข้อ = ฿{PRICING.single}<br/>
            3 หัวข้อ = ฿{PRICING.bundle3} <span style={{ color: B.green }}>(ประหยัด ฿{PRICING.single * 3 - PRICING.bundle3})</span><br/>
            Full 6 หัวข้อ + Final = ฿{PRICING.full} <span style={{ color: B.green }}>(ประหยัด ฿{PRICING.single * 6 - PRICING.full})</span>
          </div>
        </div>
      </>) : (
        <div style={{ textAlign: "center", padding: 20 }}>
          <I name="check" size={40} color={B.green}/>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>ซื้อครบทุกหัวข้อแล้ว!</div>
          <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 16 }}>เข้าเรียนเลย →</button>
        </div>
      )}
    </div>

    {/* Bottom bar */}
    {selected.length > 0 && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.1)", zIndex: 100 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 12, color: B.dkGray }}>{selected.length} หัวข้อ</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>฿{total}</div></div>
        <button onClick={() => setStep("payment")} style={css.btn(B.red, B.white)}>ชำระเงิน →</button>
      </div>
    </div>}
  </div>);
}

// ==================== LINE ADD PROMPT ====================
function LineAddPrompt({ go, user, variant = "post-register" }) {
  const linkCode = getLinkCode();
  const deepLink = lineLinkDeepLink(linkCode);
  const preCourse = variant === "pre-course";
  // หลังสมัครเสร็จ: โชว์คูปอง ฿100 บนจอ (ออก/บันทึกถ้ายังไม่มี — ครอบคลุมทั้ง LINE/Google/Email)
  const coupon = (!preCourse && isSignedUp())
    ? (load("coupon", null) || (() => { const c = genCoupon(); save("coupon", c); try { supaRest("promo_codes", "POST", { code: c, type: "online", discount: 100, staff_name: "system" }); } catch (e) {} return c; })())
    : null;
  // gate ก่อนเรียน = ข้ามได้ (strong-soft) แต่จด line_skipped_at ไว้เพื่อไม่เด้งซ้ำ + ให้แบนเนอร์ในคอร์สตามต่อ
  useEffect(() => { safeTrack("line_gate_view", { variant }); }, [variant]);
  const onAdded = () => { markLineAdded(user); safeTrack("line_oa_confirm_added", { variant }); go("course"); };
  const onSkip = () => { safeTrack("line_oa_skipped", { variant }); save("line_skipped_at", new Date().toISOString()); go("course"); };
  const onClickLink = () => { safeTrack("line_oa_clicked", { variant, has_link_code: true }); };
  const title = preCourse ? "เพิ่ม LINE ก่อนเริ่มเรียน 🎓"
    : variant === "post-register" ? "เกือบเสร็จแล้ว! เพิ่ม LINE เพื่อรับสิทธิ์เต็ม"
    : "อย่าลืมเพิ่ม LINE!";
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        {preCourse && <button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>}
        <div style={{ fontSize: 16, fontWeight: 700 }}>เพิ่ม LINE @jiacpr</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        {coupon && <div style={{ ...css.card, textAlign: "center", marginBottom: 14, border: `2px solid ${B.gold}`, background: `${B.gold}10` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: B.black }}>🎉 สมัครสำเร็จ! รับคูปองส่วนลด ฿100</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", margin: "10px 0" }}>{coupon}</div>
          <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.6 }}>เก็บรหัสนี้ไว้ใช้เป็นส่วนลดคอร์สภาคปฏิบัติ (on-site) — แจ้งตอนจอง หรือกรอกตอนชำระเงิน</div>
        </div>}
        <div style={{ ...css.card, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#06C75518", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <I name="line" size={36} color="#06C755"/>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
          {preCourse && <p style={{ fontSize: 13, color: "#06994A", fontWeight: 600, lineHeight: 1.6, margin: "0 0 12px" }}>แอด LINE @jiacpr เพื่อปลดล็อกคอร์สเรียนฟรี + เก็บสิทธิ์ไว้เรียนต่อได้ทุกอุปกรณ์ — ใช้เวลาไม่ถึง 10 วินาที</p>}
          <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7, margin: "0 0 16px" }}>
            แอด LINE @jiacpr เพื่อ:<br/>
            <strong style={{ color: B.black }}>✓</strong> รับใบ Certificate แบบ PDF<br/>
            <strong style={{ color: B.black }}>✓</strong> แจ้งเตือนทบทวน CPR ทุก 3 เดือน<br/>
            <strong style={{ color: B.black }}>✓</strong> รับโปรต่ออายุ + คูปองพิเศษ<br/>
            <strong style={{ color: B.black }}>✓</strong> สอบถามได้ตลอด
          </p>
          <div style={{ background: B.white, border: `2px solid ${B.ltGray}`, borderRadius: 14, padding: 12, display: "inline-block", marginBottom: 14 }}>
            <img src={LINE_QR_URL} alt="LINE QR @jiacpr" width="180" height="180" style={{ display: "block" }} onError={(e) => { e.target.style.display = "none"; }}/>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: "#06C755" }}>@jiacpr</div>
          </div>
          <a href={deepLink} onClick={onClickLink} target="_blank" rel="noopener noreferrer"
             style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            <I name="line" size={22} color={B.white}/> เพิ่มเพื่อน + ผูกบัญชีอัตโนมัติ
          </a>
          <div style={{ fontSize: 11, color: B.dkGray, marginBottom: 12, lineHeight: 1.5 }}>
            (กดปุ่ม → LINE จะเด้งข้อความ <strong style={{ fontFamily: "monospace", color: B.red }}>JIA-LINK-{linkCode}</strong> ขึ้นมา → กดส่ง = ผูกบัญชีให้รับโปรอัตโนมัติ)
          </div>
          <button onClick={onAdded} style={{ ...css.btn(B.red, B.white, true), marginBottom: 8 }}>
            <I name="check" size={16} color={B.white}/> เพิ่มเพื่อนแล้ว → เข้าเรียนเลย
          </button>
          <button onClick={onSkip} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: "8px 12px", cursor: "pointer", textDecoration: "underline" }}>
            ข้ามไปก่อน (เพิ่มได้ทีหลัง)
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TEASER QUIZ (ควิซเกริ่นนำหน้าแรก) ====================
// 5 ข้อ ทีละข้อ + รูป + feedback ทันที (ตอบผิดไปต่อได้) → จอสรุป → ปุ่มสมัคร (เก็บ LINE)
function TeaserQuizImg({ item }) {
  const [broken, setBroken] = useState(false);
  if (broken || !item.img) return (
    <div style={{ width: "100%", aspectRatio: "16/10", borderRadius: 14, background: `linear-gradient(135deg, ${B.red}10, ${B.gold}12)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16, border: `1px solid ${B.ltGray}` }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>{item.emoji || "❤️"}</div>
    </div>
  );
  return <img src={item.img} alt="" onError={() => setBroken(true)} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", borderRadius: 14, marginBottom: 16, display: "block", background: B.gray }}/>;
}

function TeaserQuiz({ go }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);   // index ที่เลือกในข้อปัจจุบัน (null = ยังไม่เลือก)
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => { safeTrack("teaser_quiz_view", {}); phCapture("teaser_quiz_view", {}); }, []);
  const total = TEASER_QUIZ.length;
  const item = TEASER_QUIZ[idx];

  const choose = (ci) => { if (picked !== null) return; setPicked(ci); if (ci === item.a) setCorrect(c => c + 1); };
  const next = () => {
    if (idx + 1 < total) { setIdx(idx + 1); setPicked(null); }
    else { const score = correct; setFinished(true); safeTrack("teaser_quiz_complete", { score, total }); phCapture("teaser_quiz_complete", { score, total }); }
  };
  const startSignup = () => { save("teaser_done", true); go("signupgate"); };

  if (finished) {
    return (
      <div style={css.page}>
        <div style={{ ...css.wrap, paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ ...css.card, textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>เก่งมาก! ทำได้ {correct}/{total} ข้อ</h2>
            <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.7, margin: "0 0 20px" }}>นี่เป็นแค่น้ำจิ้ม 😉 คอร์สเต็มมีวิดีโอสอนละเอียด + ฝึกจริง + ใบประกาศนียบัตร<br/><strong style={{ color: B.black }}>สมัครฟรีเพื่อปลดคอร์สทั้งหมด + รับคูปองส่วนลด ฿100</strong></p>
            <button onClick={startSignup} style={{ ...css.btn(B.red, B.white, true), marginBottom: 10 }}>สมัครฟรี & เริ่มเรียน →</button>
            <button onClick={() => { save("teaser_done", true); go("landing"); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 13, padding: "6px 12px", cursor: "pointer", textDecoration: "underline" }}>ดูรายละเอียดคอร์สก่อน</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>JIA TRAINER CENTER</div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: .9 }}>ทดสอบความรู้ CPR</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        {/* progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {TEASER_QUIZ.map((_, i) => <div key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i < idx ? B.green : i === idx ? B.red : B.ltGray, transition: "all .3s" }}/>)}
        </div>
        <div style={css.card}>
          <TeaserQuizImg item={item}/>
          <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 4 }}>ข้อ {idx + 1} จาก {total}</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.5 }}>{item.q}</h3>
          {item.c.map((c, ci) => {
            let bg = B.gray, border = "transparent", color = B.black;
            if (picked !== null) {
              if (ci === item.a) { bg = `${B.green}18`; border = B.green; }
              else if (ci === picked) { bg = `${B.red}12`; border = B.red; }
            }
            return (
              <button key={ci} onClick={() => choose(ci)} disabled={picked !== null} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "13px 16px", marginBottom: 8, background: bg, border: `2px solid ${border}`, borderRadius: 10, fontSize: 14, color, cursor: picked === null ? "pointer" : "default" }}>
                <span style={{ flex: 1 }}>{c}</span>
                {picked !== null && ci === item.a && <I name="check" size={18} color={B.green}/>}
              </button>
            );
          })}
          {picked !== null && (
            <div style={{ background: `${B.gold}10`, borderRadius: 10, padding: "10px 14px", margin: "6px 0 12px", fontSize: 13, color: "#92600A", textAlign: "center" }}>
              {picked === item.a ? "✅ ถูกต้อง! " : "💡 "}{item.hint}
            </div>
          )}
          {picked !== null && <button onClick={next} style={css.btn(B.red, B.white, true)}>{idx + 1 < total ? "ข้อต่อไป →" : "ดูผลลัพธ์ →"}</button>}
        </div>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <button onClick={() => { save("teaser_done", true); go("signupgate"); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: 6, cursor: "pointer", textDecoration: "underline" }}>ข้ามไปสมัครเลย</button>
        </div>
      </div>
    </div>
  );
}

// ==================== SIGNUP GATE (บังคับสมัคร) ====================
// จอเดียว: เลือก LINE / Google / Email (OTP) + กรอกเบอร์ + ยินยอม PDPA → ปลดเนื้อหา
function SignupGate({ go, setUser, setProgress }) {
  const [phone, setPhone] = useState(() => load("user", {})?.phone || "");
  const [pdpa, setPdpa] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("choose"); // choose | email | otp
  const [busy, setBusy] = useState(null);      // null | 'line' | 'google' | 'email'
  const [err, setErr] = useState("");
  useEffect(() => { safeTrack("signup_gate_view", { variant: getGateVariant() }); phCapture("gate_shown", { variant: getGateVariant() }); }, []);

  const phoneOk = phone.replace(/\D/g, "").length >= 9;
  const baseOk = () => { if (!phoneOk) { setErr("กรุณากรอกเบอร์โทรที่ถูกต้อง"); return false; } if (!pdpa) { setErr("กรุณายินยอม PDPA ก่อนสมัคร"); return false; } setErr(""); return true; };
  const savePending = () => save("signup_pending", { phone: phone.replace(/\D/g, ""), pdpa: true, gate_variant: getGateVariant() });

  const handleLine = async () => {
    if (!baseOk()) return;
    setBusy("line"); savePending(); save("line_login_pending", true);
    const liff = await loadLiff();
    if (!liff) { setErr("ยังไม่ได้ตั้งค่า LINE Login — ลองเข้าด้วย Google หรืออีเมลก่อนได้เลย"); setBusy(null); save("line_login_pending", false); return; }
    try {
      if (!liff.isLoggedIn()) { liff.login({ botPrompt: "aggressive" }); return; } // redirect ออก → กลับมาเสร็จที่ App mount
      const r = await finishLineSignup();
      // @jiacpr อยู่คนละ provider → liff.getFriendship() เชื่อถือไม่ได้ → ไปหน้าแอด @jiacpr เสมอ (โชว์คูปองที่นั่น)
      if (r) { setUser(r.user); if (r.progress) setProgress(r.progress); go("lineprompt"); }
      else { setErr("เข้าสู่ระบบ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง"); setBusy(null); }
    } catch (e) { setErr("เข้าสู่ระบบ LINE ไม่สำเร็จ ลองใหม่อีกครั้ง"); setBusy(null); }
  };
  const handleGoogle = async () => {
    if (!baseOk()) return;
    setBusy("google"); savePending(); save("oauth_pending", true);
    try { const supa = await getSupabase(); await supa.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + window.location.pathname } }); }
    catch (e) { setErr("เข้าสู่ระบบ Google ไม่สำเร็จ"); setBusy(null); save("oauth_pending", false); }
  };
  const sendOtp = async () => {
    if (!baseOk()) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErr("กรุณากรอกอีเมลที่ถูกต้อง"); return; }
    setBusy("email");
    try { const supa = await getSupabase(); const { error } = await supa.auth.signInWithOtp({ email }); if (error) throw error; setStep("otp"); setErr(""); }
    catch (e) { setErr("ส่งรหัสไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    setBusy(null);
  };
  const verifyOtp = async () => {
    setBusy("email");
    try {
      const supa = await getSupabase();
      const { error } = await supa.auth.verifyOtp({ email, token: otp.trim(), type: "email" });
      if (error) { setErr("รหัสไม่ถูกต้องหรือหมดอายุ"); setBusy(null); return; }
      savePending(); save("oauth_pending", true);
      const r = await finalizeOAuthSignup("email");
      if (r) { setUser(r.user); if (r.progress) setProgress(r.progress); go("lineprompt"); }
      else { setErr("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง"); setBusy(null); }
    } catch (e) { setErr("ยืนยันไม่สำเร็จ"); setBusy(null); }
  };

  const phoneField = (
    <div style={{ marginBottom: 12, textAlign: "left" }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทรศัพท์ *</label>
      <input type="tel" placeholder="เช่น 081-234-5678" value={phone} onChange={e => { setPhone(e.target.value); setErr(""); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
    </div>
  );
  const pdpaField = (
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16, textAlign: "left" }}>
      <input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr(""); }} style={{ marginTop: 3, width: 18, height: 18 }}/>
      <span style={{ fontSize: 11, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บและใช้ข้อมูลส่วนบุคคล (ชื่อ, เบอร์โทร, อีเมล/LINE) เพื่อจัดการหลักสูตร ออกใบประกาศนียบัตร และแจ้งข้อมูลหลักสูตร</span>
    </label>
  );

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>สมัครเพื่อเรียนต่อ</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <div style={{ ...css.card, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><I name="star" size={36} color={B.gold}/></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>อีกขั้นเดียว! 🎉</h2>
          <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7, margin: "0 0 18px" }}>สมัครฟรีเพื่อ <strong style={{ color: B.black }}>ปลดคอร์สเต็ม + รับคูปองส่วนลด ฿100</strong> — เรียนต่อข้ามเครื่องได้ด้วย</p>

          {step !== "otp" && <>{phoneField}{pdpaField}</>}

          {step === "choose" && <>
            {LIFF_ID && <button onClick={handleLine} disabled={!!busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, border: "none", fontWeight: 700, fontSize: 15, marginBottom: 10, cursor: "pointer", opacity: busy ? .6 : 1 }}><I name="line" size={22} color={B.white}/> {busy === "line" ? "กำลังเข้าสู่ระบบ..." : "เข้าด้วย LINE (แนะนำ)"}</button>}
            {GOOGLE_LOGIN_ENABLED && <button onClick={handleGoogle} disabled={!!busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: B.white, borderRadius: 12, padding: "13px 24px", color: B.black, border: `2px solid ${B.ltGray}`, fontWeight: 700, fontSize: 15, marginBottom: 10, cursor: "pointer", opacity: busy ? .6 : 1 }}><span style={{ fontSize: 18, fontWeight: 800, color: "#4285F4" }}>G</span> {busy === "google" ? "กำลังเปิด Google..." : "เข้าด้วย Google"}</button>}
            {EMAIL_OTP_ENABLED && <button onClick={() => { if (baseOk()) setStep("email"); }} disabled={!!busy} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 13, padding: "8px 12px", cursor: "pointer", textDecoration: "underline" }}>ใช้อีเมลแทน (รับรหัส OTP)</button>}
            {!LIFF_ID && <div style={{ fontSize: 11, color: B.gold, marginTop: 10 }}>* ปุ่ม LINE จะใช้งานได้เมื่อตั้งค่า LIFF เสร็จ</div>}
          </>}

          {step === "email" && <>
            <input type="email" placeholder="อีเมลของคุณ" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }}/>
            <button onClick={sendOtp} disabled={busy === "email"} style={{ ...css.btn(B.red, B.white, true), marginBottom: 8 }}>{busy === "email" ? "กำลังส่ง..." : "ส่งรหัส OTP →"}</button>
            <button onClick={() => { setStep("choose"); setErr(""); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: 6, cursor: "pointer", textDecoration: "underline" }}>← กลับ</button>
          </>}

          {step === "otp" && <>
            <p style={{ fontSize: 12, color: B.dkGray, margin: "0 0 12px" }}>กรอกรหัส 6 หลักที่ส่งไปยัง<br/><strong style={{ color: B.black }}>{email}</strong></p>
            <input type="text" inputMode="numeric" placeholder="รหัส 6 หลัก" value={otp} onChange={e => { setOtp(e.target.value); setErr(""); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 18, letterSpacing: 4, textAlign: "center", outline: "none", boxSizing: "border-box", marginBottom: 12 }}/>
            <button onClick={verifyOtp} disabled={busy === "email"} style={{ ...css.btn(B.red, B.white, true), marginBottom: 8 }}>{busy === "email" ? "กำลังยืนยัน..." : "ยืนยัน & เรียนต่อ →"}</button>
            <button onClick={() => { setStep("email"); setOtp(""); setErr(""); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: 6, cursor: "pointer", textDecoration: "underline" }}>← เปลี่ยนอีเมล</button>
          </>}

          {err && <div style={{ color: B.red, fontSize: 12, marginTop: 12 }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}

// ==================== REGISTER (+ PDPA) ====================
function Register({ go, setUser }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" }); const [err, setErr] = useState({}); const [pdpa, setPdpa] = useState(false);
  const submit = () => {
    const e = {}; if (!f.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล"; if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง"; if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนลงทะเบียน"; if (Object.keys(e).length) return setErr(e);
    const cleanPhone = f.phone.replace(/\D/g, "");
    const userData = { name: f.name.trim(), phone: cleanPhone, email: f.email };
    setUser(userData); save("user", userData);
    const custId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const linkCode = genLinkCode(); save("line_link_code", linkCode);
    const finalProgress = load("progress", { done: [], scores: {} });
    const finalModId = COURSE.modules[COURSE.modules.length - 1].id;
    const completed = finalProgress.done.includes(finalModId);
    const coupon = load("coupon", null) || (completed ? (() => { const c = genCoupon(); save("coupon", c); return c; })() : null);
    const finalScore = finalProgress.scores[finalModId] || null;
    supaRest("customers", "POST", { id: custId, name: userData.name, tel: cleanPhone, email: f.email || "", source: "online-course", line_link_code: linkCode });
    if (completed) {
      const renew = new Date(); renew.setMonth(renew.getMonth() + 6);
      supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, email: f.email || "", status: "จบคอร์ส ✅", completed_at: new Date().toISOString(), final_score: finalScore, coupon_code: coupon, renew_date: renew.toISOString().split("T")[0] });
      supaRest("sales_tracking", "POST", { name: userData.name, phone: cleanPhone, completed_date: new Date().toISOString(), score: finalScore, coupon_code: coupon, follow_status: "ยังไม่ติดต่อ" });
      if (coupon) supaRest("promo_codes", "POST", { code: coupon, type: "online", discount: 100, staff_name: "system" });
    } else {
      supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, email: f.email || "", status: "กำลังเรียน" });
    }
    save("enrolled", true);
    safeTrack("register_complete", { has_email: !!f.email, completed });
    go("certificate");
  };
  const field = (key, label, ph, type = "text") => (<div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label><input type={type} placeholder={ph} value={f[key]} onChange={e => { setF({...f, [key]: e.target.value}); setErr({...err, [key]: undefined}); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${err[key] ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>{err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}</div>);
  return (<div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ลงทะเบียนรับใบเกียรติบัตร</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={css.card}><h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 6 }}>ยินดีด้วย! คุณผ่านข้อสอบแล้ว</h3><p style={{ fontSize: 13, color: B.dkGray, margin: "0 0 18px", lineHeight: 1.6 }}>กรอกข้อมูลด้านล่างเพื่อออกใบประกาศนียบัตรในชื่อของคุณ</p>{field("name", "ชื่อ-นามสกุล *", "เช่น สมชาย ใจดี")}{field("phone", "เบอร์โทรศัพท์ *", "เช่น 081-234-5678", "tel")}{field("email", "อีเมล (ไม่บังคับ)", "เช่น name@email.com", "email")}
        <div style={{ marginTop: 8 }}><label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr({...err, pdpa: undefined}); }} style={{ marginTop: 3, width: 18, height: 18 }}/><span style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บรวบรวมและใช้ข้อมูลส่วนบุคคล (ชื่อ, เบอร์โทร, อีเมล) เพื่อจัดการหลักสูตรออนไลน์ การออกใบประกาศนียบัตร และการแจ้งข้อมูลหลักสูตร ข้อมูลจะไม่ถูกเปิดเผยต่อบุคคลภายนอก</span></label>{err.pdpa && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.pdpa}</div>}</div>
      </div>
      <button onClick={submit} style={{ ...css.btn(B.red, B.white, true), marginTop: 20 }}>ลงทะเบียนรับใบประกาศนียบัตร →</button>
    </div></div>);
}

// ==================== CLAIM (Lead Capture + Promo Code) ====================
function Claim({ go, setUser, initialStep = "form", initialCode = "" }) {
  const [step, setStep] = useState(initialStep);
  const u0 = load("user", null);
  const [form, setForm] = useState({
    name: u0?.name || "",
    phone: u0?.phone || "",
    email: u0?.email || "",
    source: "",
    sourceOther: "",
    lineId: "",
  });
  const [err, setErr] = useState({});
  const [pdpa, setPdpa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [claimed, setClaimed] = useState(() => {
    const code = load("promo_code", null);
    const exp = load("promo_expires", null);
    return code && exp ? { code, expires_at: exp, modules: load("promo_unlocked", []).length ? load("promo_unlocked", []) : PROMO_FREE_MODULES, name: u0?.name || "" } : null;
  });
  const [redeemCode, setRedeemCode] = useState(initialCode || "");
  const [redeemErr, setRedeemErr] = useState("");
  const [copied, setCopied] = useState(false);

  const F = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(e => ({ ...e, [k]: undefined })); };

  const checkDuplicate = async () => {
    const email = normalizeEmail(form.email);
    const phone = normalizePhone(form.phone);
    if (!email && !phone) return null;
    const filters = [];
    if (email) filters.push(`email.eq.${encodeURIComponent(email)}`);
    if (phone) filters.push(`phone.eq.${encodeURIComponent(phone)}`);
    const q = filters.length === 1 ? `?${filters[0]}` : `?or=(${filters.join(",")})`;
    const res = await supaRest("lead_promo_codes", "GET", null, `${q}&select=code,expires_at,redeemed_at,name,unlock_modules&order=created_at.desc&limit=1`);
    if (!Array.isArray(res) || !res.length) return null;
    const r = res[0];
    return { ...r, expired: new Date(r.expires_at) < new Date() };
  };

  const submitForm = async () => {
    const e = {};
    if (!form.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล";
    const phone = normalizePhone(form.phone);
    if (phone.length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง";
    const email = normalizeEmail(form.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "กรุณากรอกอีเมลที่ถูกต้อง (สำหรับส่งโค้ดสำรอง)";
    if (!form.source) e.source = "กรุณาเลือกช่องทางที่รู้จัก JIA";
    if (form.source === "other" && !form.sourceOther.trim()) e.sourceOther = "กรุณาระบุช่องทาง";
    if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนรับโค้ด";
    if (Object.keys(e).length) { setErr(e); return; }

    setSubmitting(true);
    setStep("checking");
    try {
      const dup = await checkDuplicate();
      if (dup && !dup.expired && !dup.redeemed_at) {
        const data = { code: dup.code, expires_at: dup.expires_at, name: form.name.trim(), modules: dup.unlock_modules || PROMO_FREE_MODULES };
        setClaimed(data);
        save("promo_code", dup.code);
        save("promo_expires", dup.expires_at);
        save("promo_email", email);
        supaRest("lead_capture_events", "POST", { code: dup.code, event_type: "duplicate_attempt", metadata: { source: form.source } });
        setStep("already");
        setSubmitting(false);
        return;
      }

      const code = genLeadCode();
      const now = new Date();
      const expires = new Date(now.getTime() + PROMO_EXPIRY_DAYS * 86400000);
      const custId = "cust_lead_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

      supaRest("customers", "POST", {
        id: custId, name: form.name.trim(), tel: phone, email, source: "lead-promo-" + form.source,
      });

      const payload = {
        code, email, phone, name: form.name.trim(),
        line_id: form.lineId.trim() || null,
        source: form.source,
        source_other: form.source === "other" ? form.sourceOther.trim() : null,
        unlock_modules: PROMO_FREE_MODULES,
        created_at: now.toISOString(),
        expires_at: expires.toISOString(),
        idempotency_key: genIdempotencyKey(email, phone),
        customer_id: custId,
        email_sent_status: "pending",
      };
      const created = await supaRest("lead_promo_codes", "POST", payload);

      if (!Array.isArray(created) || !created.length) {
        // race condition — re-fetch
        const dup2 = await checkDuplicate();
        if (dup2 && !dup2.expired && !dup2.redeemed_at) {
          setClaimed({ code: dup2.code, expires_at: dup2.expires_at, name: form.name.trim(), modules: dup2.unlock_modules || PROMO_FREE_MODULES });
          save("promo_code", dup2.code);
          save("promo_expires", dup2.expires_at);
          save("promo_email", email);
          setStep("already");
          setSubmitting(false);
          return;
        }
        throw new Error("สร้างโค้ดไม่สำเร็จ");
      }

      const row = created[0];
      const data = { code: row.code, expires_at: row.expires_at, name: form.name.trim(), modules: row.unlock_modules || PROMO_FREE_MODULES };
      setClaimed(data);
      save("promo_code", row.code);
      save("promo_expires", row.expires_at);
      save("promo_email", email);

      supaRest("lead_capture_events", "POST", {
        code: row.code, event_type: "claimed",
        metadata: { source: form.source, source_other: form.source === "other" ? form.sourceOther.trim() : null, has_line_id: !!form.lineId.trim(), ua: (navigator.userAgent || "").slice(0, 200) },
      });

      const userData = { name: form.name.trim(), phone, email };
      setUser(userData); save("user", userData);

      setStep("reveal");
    } catch (ex) {
      console.error(ex);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setStep("form");
    }
    setSubmitting(false);
  };

  const redeem = async () => {
    setRedeemErr("");
    const code = (redeemCode || "").trim().toUpperCase();
    if (!/^LEAD-[A-Z0-9]{6}$/.test(code)) { setRedeemErr("รหัสไม่ถูกต้อง (รูปแบบ: LEAD-XXXXXX)"); return; }
    setValidating(true);
    try {
      const res = await supaRest("lead_promo_codes", "GET", null, `?code=eq.${encodeURIComponent(code)}&select=code,expires_at,redeemed_at,name,unlock_modules&limit=1`);
      if (!Array.isArray(res) || !res.length) { setRedeemErr("ไม่พบรหัสนี้ในระบบ"); setValidating(false); return; }
      const row = res[0];
      if (new Date(row.expires_at) < new Date()) {
        setRedeemErr(`รหัสนี้หมดอายุแล้ว (หมดอายุ ${new Date(row.expires_at).toLocaleDateString("th-TH")})`);
        supaRest("lead_capture_events", "POST", { code, event_type: "expired_attempt" });
        setValidating(false); return;
      }
      if (row.redeemed_at) {
        setRedeemErr(`รหัสนี้ถูกใช้ไปแล้วเมื่อ ${new Date(row.redeemed_at).toLocaleDateString("th-TH")}`);
        setValidating(false); return;
      }

      const u = load("user", null);
      const patchRes = await supaRest("lead_promo_codes", "PATCH",
        { redeemed_at: new Date().toISOString(), redeemed_phone: u?.phone || null },
        `?code=eq.${encodeURIComponent(code)}&redeemed_at=is.null`
      );
      if (!Array.isArray(patchRes) || !patchRes.length) {
        setRedeemErr("รหัสถูกใช้พร้อมกันจากเครื่องอื่น กรุณาขอรหัสใหม่");
        setValidating(false); return;
      }

      const unlock = row.unlock_modules && row.unlock_modules.length ? row.unlock_modules : PROMO_FREE_MODULES;
      save("promo_unlocked", unlock);
      save("promo_code", code);
      save("promo_redeemed", true);
      save("enrolled", true);

      supaRest("lead_capture_events", "POST", { code, event_type: "redeemed", metadata: { modules: unlock } });

      setClaimed({ code, modules: unlock, expires_at: row.expires_at, name: u?.name || row.name });
      setStep("redeemed");
    } catch (ex) {
      console.error(ex);
      setRedeemErr("เกิดข้อผิดพลาด: กรุณาลองใหม่");
    }
    setValidating(false);
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const modulesText = (ids) => ids.map(id => COURSE.modules.find(m => m.id === id)?.short).filter(Boolean).join(" • ");

  const inp = (key, label, ph, type = "text", required = true) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}{required ? " *" : ""}</label>
      <input type={type} placeholder={ph} value={form[key]} onChange={e => F(key, e.target.value)}
        style={{ width: "100%", padding: "12px 14px", border: `2px solid ${err[key] ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
      {err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}
    </div>
  );

  // ===== Step: form =====
  if (step === "form") return (
    <div style={css.page}>
      <div style={css.header(B.red)}><button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>รับโค้ดเรียนฟรี</div></div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        <div style={{ background: `linear-gradient(135deg, ${B.gold} 0%, #E08800 100%)`, color: B.white, borderRadius: 16, padding: 18, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .9, letterSpacing: 1, textTransform: "uppercase" }}>ส่วนลด 100%</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>เรียนฟรี 3 บทหลัก</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: .95 }}>{modulesText(PROMO_FREE_MODULES)}</div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: .85 }}>มูลค่า ฿{PRICING.bundle3} — รับฟรีเมื่อกรอกข้อมูล</div>
        </div>

        <div style={css.card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>กรอกข้อมูลเพื่อรับโค้ด</h3>
          <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 18 }}>โค้ดจะแสดงทันที + ส่งสำเนาทางอีเมล</p>

          {inp("name", "ชื่อ-นามสกุล", "เช่น สมชาย ใจดี")}
          {inp("phone", "เบอร์โทรศัพท์", "เช่น 081-234-5678", "tel")}
          {inp("email", "อีเมล", "เช่น name@email.com", "email")}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>รู้จัก JIA จากช่องทางไหน? *</label>
            <select value={form.source} onChange={e => F("source", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: `2px solid ${err.source ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", background: B.white }}>
              <option value="">— เลือก —</option>
              {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {err.source && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.source}</div>}
          </div>

          {form.source === "other" && inp("sourceOther", "โปรดระบุช่องทาง", "เช่น Twitter, Pantip")}

          {inp("lineId", "LINE ID (ไม่บังคับ)", "เช่น jiacpr", "text", false)}

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr({ ...err, pdpa: undefined }); }} style={{ marginTop: 3, width: 18, height: 18 }}/>
              <span style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บข้อมูล (ชื่อ, เบอร์, อีเมล, LINE ID) เพื่อจัดการหลักสูตรออนไลน์, ออกใบประกาศนียบัตร และแจ้งข้อมูลหลักสูตร/โปรโมชั่นในอนาคต ข้อมูลจะไม่เปิดเผยต่อบุคคลภายนอก</span>
            </label>
            {err.pdpa && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.pdpa}</div>}
          </div>
        </div>

        <button onClick={submitForm} disabled={submitting} style={{ ...css.btn(B.red, B.white, true), marginTop: 18, opacity: submitting ? .6 : 1 }}>รับโค้ดเลย →</button>

        <button onClick={() => setStep("redeem")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 10, border: `1px solid ${B.ltGray}`, fontSize: 13 }}>มีโค้ดอยู่แล้ว? กดใช้รหัส →</button>
      </div>
    </div>
  );

  // ===== Step: checking =====
  if (step === "checking") return (
    <div style={css.page}>
      <div style={{ ...css.wrap, paddingTop: 80, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, border: `4px solid ${B.ltGray}`, borderTopColor: B.red, borderRadius: "50%", margin: "0 auto 20px", animation: "spin 1s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 16, fontWeight: 600 }}>กำลังสร้างโค้ดของคุณ...</div>
        <div style={{ fontSize: 13, color: B.dkGray, marginTop: 6 }}>กรุณารอสักครู่</div>
      </div>
    </div>
  );

  // ===== Step: reveal / already =====
  if ((step === "reveal" || step === "already") && claimed) {
    const days = daysUntil(claimed.expires_at);
    const isAlready = step === "already";
    return (
      <div style={css.page}>
        <div style={css.header(B.red)}><div style={{ fontSize: 16, fontWeight: 700, flex: 1, textAlign: "center" }}>{isAlready ? "พบโค้ดในระบบแล้ว" : "ได้รับโค้ดสำเร็จ!"}</div></div>
        <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
          {!isAlready && (
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><I name="check" size={32} color={B.green}/></div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>ยินดีด้วย {claimed.name}!</h2>
              <p style={{ fontSize: 13, color: B.dkGray, margin: 0 }}>โค้ดของคุณพร้อมใช้แล้ว</p>
            </div>
          )}
          {isAlready && (
            <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: B.dkGray, textAlign: "center" }}>
              คุณเคยรับโค้ดด้วยอีเมล/เบอร์นี้แล้ว นี่คือโค้ดเดิมของคุณ
            </div>
          )}

          <div style={{ background: B.white, borderRadius: 16, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,.08)", border: `2px dashed ${B.red}40`, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>รหัสส่วนลด 100%</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{claimed.code}</div>
            <button onClick={() => copyCode(claimed.code)} style={{ ...css.btn(copied ? B.green : B.black, B.white), padding: "10px 24px", fontSize: 13 }}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกโค้ด"}</button>
            <div style={{ marginTop: 14, padding: "10px 14px", background: `${B.gold}12`, borderRadius: 10, fontSize: 12, color: B.dkGray }}>
              ⏳ หมดอายุใน <strong style={{ color: B.gold }}>{days} วัน</strong> ({new Date(claimed.expires_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })})
            </div>
          </div>

          <div style={{ ...css.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ปลดล็อกเมื่อใช้โค้ด:</div>
            {(claimed.modules || PROMO_FREE_MODULES).map(id => {
              const m = COURSE.modules.find(x => x.id === id);
              if (!m) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${B.gray}` }}>
                  <I name="check" size={16} color={B.green}/>
                  <div style={{ fontSize: 13 }}><strong>{m.short}</strong><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{m.desc}</div></div>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setRedeemCode(claimed.code); setStep("redeem"); }} style={{ ...css.btn(B.red, B.white, true), marginBottom: 12, fontSize: 15 }}>ใช้โค้ดและเข้าเรียนเลย →</button>

          <div style={{ ...css.card, textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>เพิ่ม LINE @jiacpr</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>รับสิทธิพิเศษและสอบถามได้ทันที</div>
            <img src={LINE_QR_URL} alt="LINE QR @jiacpr" style={{ width: 180, height: 180, borderRadius: 12, border: `1px solid ${B.ltGray}` }}/>
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, background: "#06C755", borderRadius: 12, padding: "12px 20px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={20} color={B.white}/> เปิด LINE เพิ่มเพื่อน</a>
          </div>

          <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: 12, fontSize: 12, color: B.dkGray, textAlign: "center", marginBottom: 12 }}>
            📧 เราจะส่งสำเนาโค้ดให้ทาง <strong>{load("promo_email", "อีเมล")}</strong><br/>หากไม่ได้รับ ตรวจในกล่อง Spam หรือใช้โค้ดด้านบนได้เลย
          </div>

          <button onClick={() => go("landing")} style={{ ...css.btn(B.white, B.dkGray, true), border: `1px solid ${B.ltGray}`, fontSize: 13 }}>← กลับหน้าแรก</button>
        </div>
      </div>
    );
  }

  // ===== Step: redeem =====
  if (step === "redeem") return (
    <div style={css.page}>
      <div style={css.header(B.red)}><button onClick={() => setStep(claimed ? "reveal" : "form")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ใช้รหัสส่วนลด</div></div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <div style={css.card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>กรอกรหัสส่วนลด</h3>
          <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 16 }}>รหัสรูปแบบ LEAD-XXXXXX (6 ตัวอักษร)</p>
          <input type="text" value={redeemCode} onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemErr(""); }} placeholder="LEAD-XXXXXX" autoCapitalize="characters"
            style={{ width: "100%", padding: "14px 16px", border: `2px solid ${redeemErr ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 18, outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 2, textAlign: "center", textTransform: "uppercase" }}/>
          {redeemErr && <div style={{ color: B.red, fontSize: 13, marginTop: 8 }}>{redeemErr}</div>}
        </div>
        <button onClick={redeem} disabled={validating || !redeemCode} style={{ ...css.btn(B.red, B.white, true), marginTop: 16, opacity: (validating || !redeemCode) ? .5 : 1 }}>{validating ? "กำลังตรวจสอบ..." : "ปลดล็อกบทเรียน →"}</button>
        {!claimed && <button onClick={() => setStep("form")} style={{ ...css.btn(B.white, B.dkGray, true), border: `1px solid ${B.ltGray}`, marginTop: 10, fontSize: 13 }}>ยังไม่มีโค้ด? รับฟรีที่นี่ →</button>}
      </div>
    </div>
  );

  // ===== Step: redeemed =====
  if (step === "redeemed" && claimed) return (
    <div style={css.page}>
      <div style={{ ...css.wrap, paddingTop: 60, textAlign: "center", paddingBottom: 40 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><I name="check" size={40} color={B.green}/></div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>ปลดล็อกสำเร็จ!</h2>
        <p style={{ fontSize: 14, color: B.dkGray, marginBottom: 24 }}>โค้ด {claimed.code} ใช้แล้ว</p>

        <div style={{ ...css.card, textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>บทเรียนที่ปลดล็อก ({(claimed.modules || PROMO_FREE_MODULES).length} บท):</div>
          {(claimed.modules || PROMO_FREE_MODULES).map(id => {
            const m = COURSE.modules.find(x => x.id === id);
            return m ? (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${B.gray}` }}>
                <I name="check" size={16} color={B.green}/>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.short}</div>
              </div>
            ) : null;
          })}
        </div>

        <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white, true), fontSize: 16, padding: "16px 32px" }}>เข้าเรียนเลย →</button>
      </div>
    </div>
  );

  // fallback
  return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <p style={{ color: B.dkGray }}>เกิดข้อผิดพลาด</p>
      <button onClick={() => { setStep("form"); setClaimed(null); }} style={{ ...css.btn(B.red, B.white), marginTop: 16 }}>เริ่มใหม่</button>
    </div></div>
  );
}

// ==================== PAYMENT ====================
function Payment({ go, user }) {
  const [uploading, setUploading] = useState(false);
  const [slipDone, setSlipDone] = useState(false);

  const handleSlip = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const u = user || load("user", null);
        const fileName = (u?.name || "student") + "_online_" + Date.now() + ".jpg";
        const byteChars = atob(reader.result.split(",").pop());
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: "image/jpeg" });
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
          body: blob
        });
        if (uploadRes.ok) {
          const data = { url: `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}` };
          supaRest("online_purchases", "POST", { phone: u?.phone || "", modules: "online_fee", amount: 100, slip_url: data.url, payment_status: "แจ้งชำระแล้ว" });
          setSlipDone(true);
          save("enrolled", true);
        } else {
          alert("อัพโหลดไม่สำเร็จ กรุณาส่งสลิปทาง LINE แทน");
        }
      } catch(err) {
        alert("เกิดข้อผิดพลาด กรุณาส่งสลิปทาง LINE");
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (slipDone) return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>ชำระเงินสำเร็จ!</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>ได้รับสลิปแล้ว เข้าเรียนได้เลย</p>
      <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 20, padding: "14px 40px", fontSize: 16 }}>เข้าเรียนเลย →</button>
    </div></div>
  );

  return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("register")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ชำระเงิน ฿100</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ ...css.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>คอร์ส CPR & AED ออนไลน์</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: B.red, margin: "8px 0" }}>฿100</div>
        <div style={{ fontSize: 13, color: B.dkGray }}>เอา ฿100 เป็นส่วนลดตอนมาเรียน On-site</div>
      </div>

      <div style={{ ...css.card, marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>โอนเงินเข้าบัญชี</div>
        <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: B.dkGray }}>ธนาคารกสิกรไทย</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, margin: "6px 0" }}>134-3-11564-0</div>
          <div style={{ fontSize: 13, color: B.dkGray }}>บริษัท โรจน์รุ่งธุรกิจ จำกัด</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText("1343115640"); alert("คัดลอกเลขบัญชีแล้ว!"); }} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>คัดลอกเลขบัญชี</button>
      </div>

      <div style={{ ...css.card, marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>อัพโหลดสลิป</div>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 14 }}>โอนแล้วอัพโหลดสลิปที่นี่เลย</div>
        <label style={{ ...css.btn(B.red, B.white), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          <I name="save" size={18} color={B.white}/> {uploading ? "กำลังอัพโหลด..." : "เลือกรูปสลิป"}
          <input type="file" accept="image/*" capture="environment" onChange={handleSlip} disabled={uploading} style={{ display: "none" }}/>
        </label>
      </div>

      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> หรือส่งสลิปทาง LINE @jiacpr</a>
    </div></div>
  );
}

const ENCOURAGE = ["","เยี่ยมมาก! รู้เรื่อง CPR ผู้ใหญ่แล้ว ไปบทต่อไปเลย","ดีมาก! รู้ทั้ง CPR และ AED แล้ว","เก่งมาก! CPR เด็กก็ไม่ยากเลย","สุดยอด! เรียนมาครึ่งทางแล้ว","ใกล้จบแล้ว! อีกบทเดียว","ผ่านครบทุกบทแล้ว! พร้อมสอบข้อสอบสุดท้ายได้เลย"];

// ==================== COURSE ====================
function Course({ go, progress, setProgress, user, openBlog }) {
  const [active, setActive] = useState(null); const [quiz, setQuiz] = useState(false); const [ans, setAns] = useState({}); const [result, setResult] = useState(null); const [watched, setWatched] = useState(false); const [reviewMode, setReviewMode] = useState(false); const [timer, setTimer] = useState(0); const [canWatch, setCanWatch] = useState(false); const [mustRewatch, setMustRewatch] = useState(false);
  const timerRef = useRef(null);
  const purchased = getPurchased();
  const hasMod = (id) => isModuleAccessible(id, purchased);
  const signedUp = isSignedUp();
  const gateOn = AUTH_GATE_ENABLED && getGateVariant() !== "soft"; // ด่านบังคับสมัครหลังจบบท 1
  const unlocked = id => {
    if (!hasMod(id)) return false;
    if (id === 1) return true;                                     // บทที่ 1 เรียนฟรีเสมอ
    if (!(progress.done.includes(id - 1) || FREE_LAUNCH)) return false;
    if (gateOn && !signedUp) return false;                         // บท 2+ ต้องสมัครก่อน
    return true;
  };
  const done = id => progress.done.includes(id);

  // Timer for video watching (70% of duration)
  useEffect(() => { if (active && !reviewMode && !done(active)) { const mod = COURSE.modules.find(m => m.id === active); if (mod && mod.dur) { const target = Math.floor(mod.dur * 0.9); setTimer(target); setCanWatch(false); timerRef.current = setInterval(() => { setTimer(prev => { if (prev <= 1) { clearInterval(timerRef.current); setCanWatch(true); return 0; } return prev - 1; }); }, 1000); } } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [active, reviewMode, mustRewatch]);

  const submitQuiz = () => {
    const mod = COURSE.modules.find(m => m.id === active); let correct = 0; mod.quiz.forEach((q, i) => { if (ans[i] === q.a) correct++; }); const score = Math.round((correct / mod.quiz.length) * 100); const passed = score >= 80; setResult({ score, correct, total: mod.quiz.length, passed });
    if (passed && !progress.done.includes(active)) { const np = { ...progress, done: [...progress.done, active], scores: { ...progress.scores, [active]: score } }; setProgress(np); save("progress", np); syncProgressRemote(np);
      if (!mod.vid && mod.id === COURSE.modules[COURSE.modules.length - 1].id) { 
        const u = user || load("user", null);
        const coupon = genCoupon(); save("coupon", coupon); 
        if (u) {
          const renew = new Date(); renew.setMonth(renew.getMonth() + 6);
          supaRest("online_students", "PATCH", { status: "จบคอร์ส ✅", completed_at: new Date().toISOString(), final_score: score, coupon_code: coupon, renew_date: renew.toISOString().split("T")[0] }, `?phone=ilike.*${u.phone.replace(/\D/g,"").slice(-9)}&name=eq.${encodeURIComponent(u.name)}`);
          supaRest("sales_tracking", "POST", { name: u.name, phone: u.phone.replace(/\D/g,""), completed_date: new Date().toISOString(), score, coupon_code: coupon, follow_status: "ยังไม่ติดต่อ" });
          if (coupon) supaRest("promo_codes", "POST", { code: coupon, type: "online", discount: 100, staff_name: "system" });
        }
      }
    }
  };
  const resetLesson = () => { setActive(null); setQuiz(false); setAns({}); setResult(null); setWatched(false); setReviewMode(false); setMustRewatch(false); setCanWatch(false); setTimer(0); if (timerRef.current) clearInterval(timerRef.current); };
  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (active) {
    const mod = COURSE.modules.find(m => m.id === active); const isFinal = !mod.vid; const alreadyDone = done(mod.id);
    return (<div style={css.page}><div style={css.header(B.black)}><button onClick={resetLesson} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: B.white }}>{mod.title}</div></div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        {(!quiz && !isFinal) || reviewMode || mustRewatch ? (<>
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16 }}><iframe width="100%" style={{ aspectRatio: "16/9", border: "none", display: "block" }} src={"https://www.youtube.com/embed/" + mod.vid + "?rel=0"} title={mod.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>
          <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6, marginBottom: 16 }}>{mod.desc}</p>

          {mustRewatch ? (<>
            <div style={{ background: `${B.red}08`, borderRadius: 12, padding: 16, marginBottom: 12, textAlign: "center", border: `1px solid ${B.red}20` }}>
              <I name="warn" size={24} color={B.red}/><div style={{ color: B.red, fontSize: 14, fontWeight: 600, marginTop: 8 }}>สอบไม่ผ่าน — กรุณาดูวิดีโอใหม่ก่อนสอบอีกครั้ง</div>
            </div>
            {!canWatch ? (<div style={{ textAlign: "center", color: B.dkGray, fontSize: 13 }}>รอดูวิดีโอ... เหลือ {formatTime(timer)}</div>) : (<button onClick={() => { setMustRewatch(false); setWatched(true); setQuiz(true); setAns({}); setResult(null); }} style={css.btn(B.red, B.white, true)}>ดูจบแล้ว → ทำแบบทดสอบอีกครั้ง</button>)}
          </>) : reviewMode ? (<button onClick={resetLesson} style={css.btn(B.black, B.white, true)}>← กลับหน้าบทเรียน</button>
          ) : alreadyDone ? (<><div style={{ background: `${B.green}15`, borderRadius: 12, padding: 16, marginBottom: 12, textAlign: "center" }}><div style={{ color: B.green, fontSize: 14, fontWeight: 600 }}>✓ ผ่านบทนี้แล้ว ({progress.scores[mod.id]}%)</div></div><button onClick={resetLesson} style={css.btn(B.black, B.white, true)}>← กลับ</button></>
          ) : !canWatch ? (<div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, textAlign: "center" }}><div style={{ fontSize: 13, color: B.dkGray }}>กรุณาดูวิดีโอก่อน</div><div style={{ fontSize: 20, fontWeight: 700, color: B.gold, marginTop: 4 }}>{formatTime(timer)}</div></div>
          ) : !watched ? (<button onClick={() => setWatched(true)} style={css.btn(B.green, B.white, true)}>ดูวิดีโอจบแล้ว ✓</button>
          ) : (<button onClick={() => setQuiz(true)} style={css.btn(B.red, B.white, true)}>ทำแบบทดสอบ →</button>)}
        </>) : (
          <div style={css.card}><h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>{isFinal ? "แบบทดสอบสุดท้าย" : "แบบทดสอบท้ายบท"}</h3><p style={{ fontSize: 12, color: B.dkGray, margin: "0 0 20px" }}>ต้องได้ 80% ขึ้นไป ({Math.ceil(mod.quiz.length * 0.8)}/{mod.quiz.length} ข้อ)</p>
            {mod.quiz.map((q, qi) => (<div key={qi} style={{ marginBottom: 22 }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.q}</div>{q.c.map((c, ci) => { let bg = B.gray, border = "transparent"; if (result) { if (ci === q.a) { bg = `${B.green}18`; border = B.green; } else if (ans[qi] === ci) { bg = `${B.red}12`; border = B.red; } } else if (ans[qi] === ci) { bg = `${B.red}10`; border = B.red; } return <button key={ci} onClick={() => !result && setAns({...ans, [qi]: ci})} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", marginBottom: 5, background: bg, border: `2px solid ${border}`, borderRadius: 8, fontSize: 13, cursor: result ? "default" : "pointer" }}>{c}</button>; })}</div>))}
            {!result ? <button onClick={submitQuiz} disabled={Object.keys(ans).length < mod.quiz.length} style={css.btn(Object.keys(ans).length >= mod.quiz.length ? B.red : B.ltGray, Object.keys(ans).length >= mod.quiz.length ? B.white : B.dkGray, true)}>ส่งคำตอบ</button>
            : <div style={{ textAlign: "center" }}><div style={{ background: result.passed ? `${B.green}12` : `${B.red}08`, borderRadius: 12, padding: 20, marginBottom: 16 }}><div style={{ fontSize: 40, fontWeight: 800, color: result.passed ? B.green : B.red }}>{result.score}%</div><div style={{ fontSize: 14, fontWeight: 600, color: result.passed ? B.green : B.red }}>{result.passed ? "ผ่าน!" : "ไม่ผ่าน"}</div><div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ตอบถูก {result.correct}/{result.total} ข้อ</div></div>
              {result.passed && !isFinal && <div style={{ background: `${B.green}08`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, border: `1px solid ${B.green}20` }}><div style={{ fontSize: 14, fontWeight: 600, color: B.green, textAlign: "center" }}>{ENCOURAGE[mod.id] || "เยี่ยมมาก! ไปต่อได้เลย"}</div></div>}
              {!result.passed && <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 12, textAlign: "center" }}>ไม่เป็นไร ทบทวนวิดีโออีกครั้ง แล้วสอบใหม่ได้เลย</div>}
              {result.passed ? (<button onClick={() => { const gate = gateOn && mod.id === 1 && !isFinal && !signedUp; resetLesson(); if (isFinal) go("register"); else if (gate) go("signupgate"); }} style={css.btn(B.green, B.white)}>{isFinal ? "ลงทะเบียนรับใบประกาศนียบัตร →" : (gateOn && mod.id === 1 && !signedUp ? "สมัครเพื่อรับใบผ่าน + เรียนต่อ →" : "กลับหน้าบทเรียน →")}</button>)
              : mod.vid ? (<button onClick={() => { setQuiz(false); setResult(null); setAns({}); setWatched(false); setMustRewatch(true); setCanWatch(false); setTimer(Math.floor(mod.dur * 0.9)); }} style={css.btn(B.red, B.white)}>← กลับดูวิดีโอใหม่แล้วสอบอีกครั้ง</button>)
              : (<button onClick={() => { setAns({}); setResult(null); }} style={css.btn(B.red, B.white)}>ทำใหม่</button>)}
            </div>}
          </div>
        )}
      </div></div>);
  }

  const pct = Math.round((progress.done.length / COURSE.modules.length) * 100);
  return (<div style={css.page}>
    <div style={{ background: `linear-gradient(135deg, ${B.black} 0%, #2a2a2a 100%)`, color: B.white, padding: "24px 24px 30px" }}><div style={{ maxWidth: 480, margin: "0 auto" }}><div style={{ fontSize: 11, letterSpacing: 2, opacity: .5, textTransform: "uppercase" }}>JIA TRAINER CENTER</div><h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 14px" }}>CPR & AED ออนไลน์</h2><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.12)" }}><div style={{ height: "100%", borderRadius: 3, background: B.green, width: `${pct}%`, transition: "width .5s" }}/></div><span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span></div><div style={{ fontSize: 11, opacity: .5, marginTop: 4 }}>{progress.done.length}/{COURSE.modules.length} บทเรียน</div></div></div>
    {!load("line_added", false) && (() => {
      const lc = getLinkCode();
      const dl = lineLinkDeepLink(lc);
      return (
        <div style={{ ...css.wrap, paddingTop: 16 }}>
          <a href={dl} target="_blank" rel="noopener noreferrer"
             onClick={() => safeTrack("line_oa_clicked", { variant: "course-banner", has_link_code: true })}
             style={{ display: "flex", alignItems: "center", gap: 12, background: "#06C75512", border: "1px solid #06C75540", borderRadius: 12, padding: "12px 14px", textDecoration: "none", color: B.black }}>
            <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: "#06C755", display: "flex", alignItems: "center", justifyContent: "center" }}><I name="line" size={22} color={B.white}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>เพิ่ม LINE @jiacpr + ผูกบัญชี</div>
              <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>รับเตือนทบทวน + โปรต่ออายุ + คูปองพิเศษ อัตโนมัติ</div>
            </div>
            <button onClick={(e) => { e.preventDefault(); markLineAdded(user); window.open(dl, "_blank"); }} style={{ background: "#06C755", color: B.white, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>เพิ่ม →</button>
          </a>
        </div>
      );
    })()}
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
      {progress.done.length > 0 && progress.done.length < COURSE.modules.length && <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, border: `1px solid ${B.gold}30`, textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600, color: "#B45309" }}>{progress.done.length < 3 ? "เรียนมาได้ดีมาก ไปต่อได้เลย!" : progress.done.length < 6 ? "เลยครึ่งทางแล้ว อีกนิดเดียว!" : "เกือบถึงแล้ว ลุยต่อได้เลย!"}</div></div>}
      {COURSE.modules.map(m => { const owns = hasMod(m.id); const ok = unlocked(m.id); const dn = done(m.id); const fin = !m.vid; const needBuy = !owns && !FREE_LAUNCH && m.id <= 6; const gateLock = gateOn && !signedUp && m.id >= 2 && (progress.done.includes(m.id - 1) || FREE_LAUNCH); return (<button key={m.id} onClick={() => { if (needBuy) { go("store"); return; } if (!ok) { if (gateLock) go("signupgate"); return; } setActive(m.id); if (fin) setQuiz(true); else if (dn) setReviewMode(true); }} style={{ display: "flex", width: "100%", gap: 12, alignItems: "center", padding: 14, marginBottom: 8, background: needBuy ? `${B.gold}06` : B.white, border: dn ? `2px solid ${B.green}` : needBuy ? `1px dashed ${B.gold}` : "2px solid transparent", borderRadius: 14, cursor: (ok || needBuy || gateLock) ? "pointer" : "not-allowed", opacity: (ok || needBuy || gateLock) ? 1 : .5, textAlign: "left" }}><div style={{ minWidth: 42, height: 42, borderRadius: 11, background: dn ? B.green : needBuy ? `${B.gold}18` : fin ? `${B.gold}18` : `${B.red}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>{dn ? <I name="check" size={18} color={B.white}/> : needBuy ? <I name="lock" size={16} color={B.gold}/> : !ok ? <I name="lock" size={16} color={gateLock ? "#06C755" : B.dkGray}/> : fin ? <I name="cert" size={18} color={B.gold}/> : <I name="play" size={16} color={B.red}/>}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div><div style={{ fontSize: 12, color: needBuy ? B.gold : gateLock ? "#06994A" : B.dkGray, marginTop: 2 }}>{dn ? (fin ? `✓ ผ่านแล้ว (${progress.scores[m.id]}%)` : `✓ ผ่านแล้ว • กดเพื่อดูวิดีโอซ้ำ`) : needBuy ? `฿${PRICING.single} — กดเพื่อซื้อ` : gateLock ? "🔓 สมัครฟรีเพื่อปลดล็อก" : m.vid ? `วิดีโอ + ${m.quiz.length} คำถาม` : `${m.quiz.length} คำถาม • ต้องได้ 80%`}</div></div>{needBuy ? <span style={{ fontSize: 14, fontWeight: 700, color: B.gold }}>฿{PRICING.single}</span> : ok && !dn ? <I name="arrow" size={14} color={B.dkGray}/> : ok && dn && m.vid ? <I name="replay" size={14} color={B.green}/> : null}</button>); })}
      {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_redeemed", false) && purchased.filter(x => x <= 6).length < 3 && <button onClick={() => go("claim")} style={{ width: "100%", marginTop: 8, padding: "14px 16px", background: `${B.gold}12`, border: `1px dashed ${B.gold}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
        <I name="star" size={20} color={B.gold}/>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: B.black }}>ปลดล็อก {PROMO_FREE_MODULES.length} บทฟรีด้วยโค้ดส่วนลด <span style={{ fontWeight: 400, color: B.dkGray }}>— ใช้เวลา 30 วิ</span></div>
        <I name="arrow" size={14} color={B.gold}/>
      </button>}
      {!FREE_LAUNCH && purchased.filter(x => x <= 6).length < 6 && <button onClick={() => go("store")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 8, fontSize: 14 }}>ซื้อเพิ่ม / Full Course ฿{PRICING.full} →</button>}
      {pct === 100 && <button onClick={() => go(load("enrolled", false) ? "certificate" : "register")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 16 }}>{load("enrolled", false) ? "ดูใบประกาศนียบัตร & คูปอง →" : "ลงทะเบียนรับใบประกาศนียบัตร →"}</button>}
      {/* Mini cert per module */}
      {progress.done.filter(id => id <= 6).length > 0 && progress.done.filter(id => id <= 6).length < 7 && <button onClick={() => go("minicert")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 8, border: `1px solid ${B.ltGray}`, fontSize: 13 }}>ดูใบ Mini Certificate →</button>}
      <div style={{ marginTop: 20 }}><MorrooAdBanner/></div>
      <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?\n\nข้อมูลการเรียนจะถูกล้าง")) { ["jia_user","jia_enrolled","jia_progress","jia_coupon"].forEach(k => localStorage.removeItem(k)); window.location.reload(); }}} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 12, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
    </div>
    {progress.done.length >= 4 && <NewsSection openBlog={openBlog} goAll={() => go("blog")} title="บทความ CPR เพิ่มเติม" subtitle={pct === 100 ? "ทักษะ CPR เสื่อมใน 3-6 เดือน — แวะอ่านทบทวนได้ตลอด" : "เก่งมาก! ใกล้จบแล้ว — มีบทความทบทวนให้อ่านเพิ่ม"} cprOnly={true} max={5}/>}
  </div>);
}

// ==================== CERTIFICATE ====================
function Certificate({ user, go }) {
  const d = new Date(); const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  const coupon = load("coupon", null) || (() => { const c = genCoupon(); save("coupon", c); return c; })();
  const certRef = useRef(null);
  const [gen, setGen] = useState(null); // null | "img" | "pdf"
  const fileBase = `JIA_Certificate_${sanitizeFileName(user?.name)}`;
  // ===== Strong-soft LINE gate =====
  const lc = getLinkCode();
  const [lineLinked, setLineLinked] = useState(() => load("line_linked", false));
  const [skipGate, setSkipGate] = useState(() => load("line_linked", false));
  const [linkWaiting, setLinkWaiting] = useState(false);
  const pollRef = useRef(null);
  // fallback สุดท้าย ถ้าสร้างไฟล์ไม่สำเร็จ — บอกผู้ใช้ screenshot เอง
  const saveCertFallback = () => { alert("บันทึกอัตโนมัติไม่สำเร็จ กรุณา screenshot หน้าจอเพื่อบันทึกใบประกาศนียบัตร\n\niPhone: กดปุ่ม Power + Volume Up\nAndroid: กดปุ่ม Power + Volume Down\n\nรหัสคูปอง: " + coupon); };
  const downloadImage = async () => {
    if (gen) return; setGen("img");
    try {
      const dataUrl = await captureNodeToPng(certRef.current);
      await deliverBlob(await dataUrlToBlob(dataUrl), `${fileBase}.png`, "image/png");
      safeTrack("cert_download", { format: "png" });
    } catch (e) { safeTrack("cert_download_error", { format: "png" }); saveCertFallback(); }
    finally { setGen(null); }
  };
  const downloadPDF = async () => {
    if (gen) return; setGen("pdf");
    try {
      const dataUrl = await captureNodeToPng(certRef.current);
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const pr = Math.max(2, window.devicePixelRatio || 1);
      const wMm = (img.width / pr) * 25.4 / 96, hMm = (img.height / pr) * 25.4 / 96;
      const pdf = new jsPDF({ orientation: wMm >= hMm ? "landscape" : "portrait", unit: "mm", format: [wMm, hMm] });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm, undefined, "FAST");
      await deliverBlob(pdf.output("blob"), `${fileBase}.pdf`, "application/pdf");
      safeTrack("cert_download", { format: "pdf" });
    } catch (e) { safeTrack("cert_download_error", { format: "pdf" }); saveCertFallback(); }
    finally { setGen(null); }
  };
  const CERT_W = 900, CERT_H = 636;
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / CERT_W));
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  // เปิด LINE พร้อมโค้ด แล้ว poll หา line_user_id ที่ webhook เขียนกลับมา = ยืนยันการผูกจริง
  const startLineLink = () => {
    safeTrack("line_oa_clicked", { variant: "certificate", has_link_code: true });
    const u = user || load("user", null);
    const tail = u?.phone ? u.phone.replace(/\D/g, "").slice(-9) : null;
    // ผูกโค้ดนี้กับเรคคอร์ดลูกค้า เพื่อให้ webhook จับคู่ได้แน่นอน
    if (tail) supaRest("customers", "PATCH", { line_link_code: lc }, `?tel=ilike.*${tail}`);
    setLinkWaiting(true);
    if (pollRef.current) clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      if (tail) {
        const rows = await supaRest("customers", "GET", null, `?tel=ilike.*${tail}&select=line_user_id&limit=1`);
        if (Array.isArray(rows) && rows[0]?.line_user_id) {
          clearInterval(pollRef.current); pollRef.current = null;
          save("line_linked", true); save("line_added", true);
          setLineLinked(true); setLinkWaiting(false);
          safeTrack("line_oa_linked", { variant: "certificate" });
          return;
        }
      }
      if (tries >= 40) { clearInterval(pollRef.current); pollRef.current = null; setLinkWaiting(false); }
    }, 3000);
  };
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><I name="star" size={38} color={B.gold}/></div><h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>ยินดีด้วย!</h2><p style={{ fontSize: 14, color: B.dkGray }}>คุณผ่านคอร์ส CPR & AED ออนไลน์แล้ว</p></div>
    <div ref={wrapRef} style={{ width: "100%", height: CERT_H * scale, overflow: "hidden", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.12)" }}>
      <div style={{ width: CERT_W, height: CERT_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div ref={certRef} style={{ position: "relative", width: CERT_W, height: CERT_H, boxSizing: "border-box", background: "#FFFDF7", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: CERT_DECO }}/>
          <div style={{ position: "absolute", top: 22, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Logo size={240}/></div>
          <div style={{ position: "absolute", top: 210, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 40, fontWeight: 600, lineHeight: 1, color: "#0E1E3C" }}>ใบประกาศนียบัตร</div>
          <div style={{ position: "absolute", top: 260, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 13, fontWeight: 700, letterSpacing: 4, color: "#B8862F" }}>CERTIFICATE OF COMPLETION</div>
          <div style={{ position: "absolute", top: 292, left: 0, right: 0, textAlign: "center", fontSize: 15, lineHeight: 1, color: B.dkGray }}>ขอมอบใบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</div>
          <div style={{ position: "absolute", top: 322, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 42, fontWeight: 600, lineHeight: 1, color: "#0E1E3C" }}>{user?.name || "ชื่อผู้เรียน"}</div>
          <div style={{ position: "absolute", top: 392, left: 70, right: 70, textAlign: "center", fontSize: 14, color: B.dkGray }}>ได้ผ่านการอบรม <strong style={{ color: "#0E1E3C" }}>ภาคทฤษฎี (ออนไลน์)</strong></div>
          <div style={{ position: "absolute", top: 412, left: 70, right: 70, textAlign: "center", fontSize: 14, fontWeight: 700, color: B.black }}>หลักสูตรการช่วยชีวิตขั้นพื้นฐาน CPR &amp; AED · มาตรฐาน 2025</div>
          <div style={{ position: "absolute", top: 436, left: 0, right: 0, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: B.red }}>ขอเชิญฝึกภาคปฏิบัติกับผู้สอนตัวจริง เพื่อช่วยชีวิตได้อย่างมั่นใจ</div>
          <div style={{ position: "absolute", top: 484, left: 0, right: 0, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#FFF9E8" }}>ส่วนลด ฿100 คอร์ส On-site</div>
          <div style={{ position: "absolute", top: 506, left: 0, right: 0, textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: 1, color: "#F3DB8E", fontFamily: "monospace" }}>• {coupon} •</div>
          <div style={{ position: "absolute", top: 548, left: 50, width: 220, textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: B.black }}>{ds}</div>
            <div style={{ borderTop: `1.5px solid ${B.gold}`, marginTop: 6, paddingTop: 6, fontSize: 12, color: B.dkGray }}>วันที่ออกใบประกาศ</div>
          </div>
          <div style={{ position: "absolute", top: 548, right: 50, width: 220, textAlign: "center" }}>
            <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: "#0E1E3C" }}>JIA TRAINER CENTER</div>
            <div style={{ borderTop: `1.5px solid ${B.gold}`, marginTop: 6, paddingTop: 6, fontSize: 12, color: B.dkGray }}>ศูนย์ฝึกอบรม CPR &amp; AED</div>
          </div>
          <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 11, color: B.dkGray }}>088-558-8078 | jiacpr.com | LINE: @jiacpr</div>
        </div>
      </div>
    </div>
    {/* ===== Strong-soft LINE gate: เลือก "ผูก LINE" หรือ "ข้าม" ก่อนถึงดาวน์โหลด ===== */}
    {lineLinked ? (
      <div style={{ background: `${B.green}14`, border: `1px solid ${B.green}66`, borderRadius: 12, padding: "12px 14px", marginTop: 16, textAlign: "center", fontSize: 14, fontWeight: 700, color: B.black }}>
        ✓ ผูก LINE @jiacpr เรียบร้อย — จะได้รับใบเซอร์ เตือนทบทวน และโปรทาง LINE
      </div>
    ) : !skipGate ? (
      <div style={{ background: "#06C75510", border: "2px solid #06C75540", borderRadius: 16, padding: 18, marginTop: 16, textAlign: "center" }}>
        <I name="line" size={32} color="#06C755"/>
        <div style={{ fontSize: 16, fontWeight: 800, color: B.black, margin: "8px 0 4px" }}>ผูก LINE @jiacpr เพื่อรับใบเซอร์ + คูปอง</div>
        <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12, lineHeight: 1.6 }}>แอดแล้วผูกบัญชี รับ: ใบประกาศทาง LINE · คูปองส่วนลด on-site ฿100 · เตือนทบทวน CPR ทุก 3 เดือน</div>
        <a href={lineLinkDeepLink(lc)} onClick={startLineLink} target="_blank" rel="noopener noreferrer"
           style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
          <I name="line" size={22} color={B.white}/> ผูก LINE รับใบเซอร์ + คูปอง
        </a>
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 8, lineHeight: 1.5 }}>
          (LINE จะเด้งข้อความ <strong style={{ fontFamily: "monospace", color: B.red }}>JIA-LINK-{lc}</strong> ขึ้นมา → <strong>กดส่ง</strong> ในแชต @jiacpr = ผูกบัญชีอัตโนมัติ)
        </div>
        {linkWaiting && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#06A047" }}>⏳ กำลังรอการยืนยัน... กดส่งข้อความในแอป LINE แล้วรอสักครู่</div>
        )}
        <button onClick={() => { setSkipGate(true); safeTrack("line_oa_skipped", { variant: "certificate" }); }}
          style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: "10px 12px", marginTop: 8, cursor: "pointer", textDecoration: "underline" }}>
          ข้าม รับแค่ใบเซอร์ (ไม่รับคูปอง/การแจ้งเตือน)
        </button>
      </div>
    ) : null}

    {/* ดาวน์โหลด + คูปอง: ปลดล็อกเมื่อผูก LINE แล้ว หรือกดข้าม */}
    {(lineLinked || skipGate) && (<>
      <button onClick={downloadImage} disabled={!!gen} style={{ ...css.btn(B.black, B.white, true), marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: gen ? .6 : 1, cursor: gen ? "default" : "pointer" }}><I name="save" size={18} color={B.white}/> {gen === "img" ? "กำลังสร้างรูป..." : "บันทึกเป็นรูปภาพ"}</button>
      <button onClick={downloadPDF} disabled={!!gen} style={{ ...css.btn(B.white, B.black, true), marginTop: 10, border: `1px solid ${B.ltGray}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: gen ? .6 : 1, cursor: gen ? "default" : "pointer" }}><I name="cert" size={18} color={B.black}/> {gen === "pdf" ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button>
      <div style={{ background: `${B.red}08`, borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: B.red, marginBottom: 4 }}>คูปองส่วนลด ฿100 สำหรับคอร์ส On-site!</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{coupon}</div>
        <button onClick={() => go("booking")} style={{ ...css.btn(B.red, B.white, true), display: "block", width: "100%", textAlign: "center", cursor: "pointer" }}>จองคอร์ส On-site ใช้คูปองส่วนลด →</button>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={() => safeTrack("line_oa_clicked", { variant: "certificate-inquire" })} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, background: "#06C755", borderRadius: 12, padding: "12px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={22} color={B.white}/> สอบถามทาง LINE @jiacpr</a>
      </div>
    </>)}
    <button onClick={() => { const txt = "ฉันผ่านคอร์ส CPR & AED ออนไลน์แล้ว! เรียนฟรีที่ jiacpr.com/online"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://jiacpr.com/online" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://jiacpr.com/online") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn("#06C755", B.white, true), marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>แชร์ให้เพื่อนเรียนด้วย</button>
    <div style={{ marginTop: 20 }}><MorrooAdBanner/></div>
    <button onClick={() => go("course")} style={{ ...css.btn(B.white, B.black, true), marginTop: 10, border: `1px solid ${B.ltGray}` }}>← กลับหน้าบทเรียน</button>
    <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?")) { ["jia_user","jia_enrolled","jia_progress","jia_coupon"].forEach(k => localStorage.removeItem(k)); window.location.reload(); }}} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 8, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
  </div></div>);
}

// ==================== MINI CERTIFICATE ====================
function MiniCert({ user, go }) {
  const progress = load("progress", { done: [], scores: {} });
  const d = new Date(); const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  const completed = COURSE.modules.filter(m => m.id <= 6 && progress.done.includes(m.id));
  const refs = useRef({});
  const [genId, setGenId] = useState(null);
  const saveMiniImage = async (m) => {
    if (genId) return; setGenId(m.id);
    try {
      const dataUrl = await captureNodeToPng(refs.current[m.id]);
      await deliverBlob(await dataUrlToBlob(dataUrl), `JIA_${sanitizeFileName(m.short)}_${sanitizeFileName(user?.name)}.png`, "image/png");
      safeTrack("minicert_download", { module: m.id });
    } catch (e) { safeTrack("minicert_download_error", { module: m.id }); alert("บันทึกอัตโนมัติไม่สำเร็จ กรุณา screenshot หน้าจอเพื่อบันทึกใบประกาศ"); }
    finally { setGenId(null); }
  };
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: B.dkGray, fontSize: 14, marginBottom: 16 }}><I name="back" size={18} color={B.dkGray}/> กลับ</button>
    <h2 style={{ fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 20 }}>Mini Certificate</h2>
    {completed.map(m => (
      <div key={m.id} style={{ marginBottom: 20 }}>
        <div style={{ background: B.white, borderRadius: 16, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
          <div ref={el => { refs.current[m.id] = el; }} style={{ position: "relative", border: `2px solid ${B.gold}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", background: "linear-gradient(180deg, #FFFEF7 0%, #FFFFFF 100%)" }}>
            <div style={{ marginBottom: 8 }}><Logo size={64}/></div>
            <div style={{ fontSize: 14, fontWeight: 300, color: B.dkGray }}>Mini Certificate</div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "6px 0", color: B.black }}>{m.short}</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>มอบให้แก่</div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, lineHeight: 1.5, color: B.black, marginBottom: 8 }}>{user?.name || "ชื่อผู้เรียน"}</div>
            <div style={{ fontSize: 11, color: B.dkGray }}>คะแนน: {progress.scores[m.id]}% • วันที่ {ds}</div>
          </div>
        </div>
        <button onClick={() => saveMiniImage(m)} disabled={!!genId} style={{ ...css.btn(B.white, B.black, true), marginTop: 8, fontSize: 13, border: `1px solid ${B.ltGray}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: genId ? .6 : 1, cursor: genId ? "default" : "pointer" }}><I name="save" size={16} color={B.black}/> {genId === m.id ? "กำลังสร้างรูป..." : "บันทึกเป็นรูปภาพ"}</button>
      </div>
    ))}
    {completed.length === 0 && <div style={{ textAlign: "center", color: B.dkGray, padding: 20 }}>ยังไม่มีหัวข้อที่ผ่าน</div>}
  </div></div>);
}

// ==================== BOOKING ====================

function Booking({ go }) {
  const coupon = load("coupon", null);
  const user = load("user", null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("");
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", people: "1", note: coupon ? `คูปองออนไลน์ ${coupon}` : "" });
  const [step, setStep] = useState("form"); // form → payment → done
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState(null); // เก็บ booking id สำหรับ upload slip
  const [uploading, setUploading] = useState(false);
  const [slipSent, setSlipSent] = useState(false);
  const F = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${B.ltGray}`, fontSize: 15, boxSizing: "border-box", outline: "none" };
  const lbl = { fontSize: 13, fontWeight: 600, color: B.black, marginBottom: 6, display: "block" };
  const price = coupon ? 400 : 500;

  useEffect(() => {
    supaRest("classes", "GET", null, "?status=in.(ready,waiting_instructor)&order=date.asc")
      .then(data => {
        const now = new Date().toISOString().slice(0, 10);
        const open = (data || []).filter(c => c.date >= now);
        setClasses(open);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fmtDate = (d) => { const dt = new Date(d + "T00:00:00"); const days = ["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."]; const months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`; };
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const today = () => new Date().toISOString().slice(0, 10);

  // Step 1: จอง → สร้าง booking ใน JIA Course (paymentStatus: รอชำระ)
  const submit = async () => {
    if (!form.name || !form.phone || !selectedClass) { alert("กรุณากรอกข้อมูลและเลือกคลาสให้ครบ"); return; }
    setSubmitting(true);
    const cls = classes.find(c => c.id === selectedClass);
    try {
      const custId = uid();
      const phone = form.phone.replace(/\D/g, "");
      await supaRest("customers", "POST", { id: custId, name: form.name, tel: phone, email: "", created_at: today(), source: "online-course" });

      const bkId = uid();
      const booking = await supaRest("bookings", "POST", { id: bkId, customer_id: custId, name: form.name, tel: phone, course_type: cls.courseKey || cls.course_key || "", course_name: cls.courseName || cls.course_name || "", class_id: cls.id, channel: "online-course", total_people: parseInt(form.people) || 1, final_price: price, discount_code: coupon || "", discount_amount: coupon ? 100 : 0, payment_mode: "โอน", payment_status: "รอชำระ", start_date: cls.date, time_slot: cls.timeSlot || cls.time_slot || "", total_days: 1, note: form.note || "", pdpa_consent: true, pdpa_consent_date: today(), created_at: new Date().toISOString() });
      console.log("📢 Booking notification:", booking);

      setBookingRef(bkId);
      setStep("payment");
    } catch (e) {
      console.log("Booking error:", e);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่หรือจองผ่าน LINE");
    }
    setSubmitting(false);
  };

  // Step 2: อัพโหลดสลิป
  const handleSlip = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        // Upload to Supabase Storage
        const fileName = (form.name || "student") + "_slip_" + Date.now() + ".jpg";
        const byteChars = atob(reader.result.split(",").pop());
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: "image/jpeg" });
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
          body: blob
        });
        if (uploadRes.ok) {
          const data = { url: `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}` };
          await supaRest("bookings", "PATCH", { payment_slip: data.url, payment_status: "แจ้งชำระแล้ว" }, `?id=eq.${encodeURIComponent(bookingRef)}`);
          console.log("📢 Payment notification:", { bookingId: bookingRef, name: form.name, slipUrl: data.url });
          setSlipSent(true);
        } else {
          alert("อัพโหลดไม่สำเร็จ กรุณาลองใหม่หรือส่งสลิปทาง LINE");
        }
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.log("Slip upload error:", err);
      alert("เกิดข้อผิดพลาด กรุณาส่งสลิปทาง LINE แทน");
      setUploading(false);
    }
  };

  const cls = classes.find(c => c.id === selectedClass);

  // ===== Step 3: Done =====
  if (step === "done" || (step === "payment" && slipSent)) return (
    <div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>จองสำเร็จ!</h2>
      <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6 }}>ได้รับข้อมูลจองและหลักฐานการโอนแล้ว<br/>ทีมงาน JIA จะยืนยันภายใน 24 ชม.</p>
      {cls && <div style={{ background: B.gray, borderRadius: 12, padding: 14, marginTop: 16, fontSize: 14 }}><strong>{fmtDate(cls.date)}</strong> • {cls.timeSlot || cls.time_slot}<br/><span style={{ color: B.dkGray, fontSize: 13 }}>{cls.courseName || cls.course_name}</span></div>}
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 16, background: "#06C755", borderRadius: 12, padding: "14px 28px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> LINE @jiacpr</a>
      <div><button onClick={() => go("course")} style={{ ...css.btn(B.white, B.black, true), marginTop: 14, border: `1px solid ${B.ltGray}` }}>← กลับหน้าบทเรียน</button></div>
    </div></div>
  );

  // ===== Step 2: Payment =====
  if (step === "payment") return (
    <div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.gold}15`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I name="star" size={32} color={B.gold}/></div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>ชำระเงิน</h2>
        <p style={{ fontSize: 14, color: B.dkGray }}>โอนเงินแล้วอัพโหลดสลิปด้านล่าง</p>
      </div>

      {/* สรุปการจอง */}
      {cls && <div style={{ background: B.white, borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 6 }}>สรุปการจอง</div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtDate(cls.date)} • {cls.timeSlot || cls.time_slot}</div>
        <div style={{ fontSize: 13, color: B.dkGray }}>{cls.courseName || cls.course_name} • {form.people} คน</div>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${B.ltGray}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: B.dkGray }}>ยอดชำระ</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: B.red }}>฿{price}</span>
        </div>
        {coupon && <div style={{ fontSize: 12, color: B.green, marginTop: 4 }}>ใช้คูปอง {coupon} ลด ฿100 แล้ว</div>}
      </div>}

      {/* ข้อมูลบัญชี */}
      <div style={{ background: B.white, borderRadius: 14, padding: 20, marginBottom: 16, boxShadow: "0 1px 6px rgba(0,0,0,.05)", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: B.black }}>โอนเงินเข้าบัญชี</div>
        <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: B.dkGray }}>ธนาคารกสิกรไทย</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, margin: "6px 0", color: B.black }}>134-3-11564-0</div>
          <div style={{ fontSize: 13, color: B.dkGray }}>บริษัท โรจน์รุ่งธุรกิจ จำกัด</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText("1343115640"); alert("คัดลอกเลขบัญชีแล้ว!"); }} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>คัดลอกเลขบัญชี</button>
      </div>

      {/* อัพโหลดสลิป */}
      <div style={{ background: B.white, borderRadius: 14, padding: 20, boxShadow: "0 1px 6px rgba(0,0,0,.05)", textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: B.black }}>อัพโหลดสลิปโอนเงิน</div>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 14 }}>ถ่ายรูปสลิปหรือ screenshot แล้วอัพโหลด</div>
        <label style={{ ...css.btn(B.red, B.white), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          <I name="save" size={18} color={B.white}/> {uploading ? "กำลังอัพโหลด..." : "เลือกรูปสลิป"}
          <input type="file" accept="image/*" capture="environment" onChange={handleSlip} disabled={uploading} style={{ display: "none" }}/>
        </label>
      </div>

      {/* ส่งสลิปทาง LINE แทน */}
      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: B.dkGray }}>หรือส่งสลิปทาง LINE แทน</div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> ส่งสลิปทาง LINE @jiacpr</a>
      <button onClick={() => setStep("done")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 10, border: `1px solid ${B.ltGray}`, width: "100%", fontSize: 13 }}>ข้ามขั้นตอนนี้ (ส่งสลิปทีหลัง)</button>
    </div></div>
  );

  return (
    <div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
      <button onClick={() => go(load("enrolled", false) ? "certificate" : "landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: B.dkGray, fontSize: 14, marginBottom: 16 }}><I name="back" size={18} color={B.dkGray}/> กลับ</button>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I name="cert" size={32} color={B.red}/></div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>จองคอร์ส On-site</h2>
        <p style={{ fontSize: 14, color: B.dkGray }}>CPR & AED มาตรฐาน 2025 | ฝึกปฏิบัติจริง</p>
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "clock", t: "2 ชั่วโมง", s: "ต่อรอบ" },
          { icon: "star", t: coupon ? "฿400" : "฿500", s: coupon ? "ลดแล้ว ฿100" : "ต่อท่าน" },
          { icon: "book", t: "ใบรับรอง", s: "มาตรฐาน 2025" },
          { icon: "heart", t: "ฝึกจริง", s: "หุ่น CPR + AED" },
        ].map((c, i) => (
          <div key={i} style={{ background: B.white, borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <I name={c.icon} size={20} color={B.red}/><div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{c.t}</div><div style={{ fontSize: 11, color: B.dkGray }}>{c.s}</div>
          </div>
        ))}
      </div>

      {coupon && <div style={{ background: `${B.green}10`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${B.green}30` }}>
        <I name="check" size={20} color={B.green}/><div><div style={{ fontSize: 13, fontWeight: 700, color: B.green }}>คูปองส่วนลด ฿100 ถูกใช้แล้ว!</div><div style={{ fontSize: 12, color: B.dkGray }}>รหัส: {coupon} • ราคาจาก ฿500 เหลือ ฿400</div></div>
      </div>}

      {/* Form */}
      <div style={{ background: B.white, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ marginBottom: 14 }}><label style={lbl}>ชื่อ-นามสกุล *</label><input value={form.name} onChange={e => F("name", e.target.value)} placeholder="ชื่อจริง นามสกุล" style={inp}/></div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>เบอร์โทร *</label><input value={form.phone} onChange={e => F("phone", e.target.value)} placeholder="08X-XXX-XXXX" type="tel" style={inp}/></div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>เลือกวัน-เวลาเรียน *</label>
          {loading ? <div style={{ padding: 14, textAlign: "center", color: B.dkGray, fontSize: 13 }}>กำลังโหลดตารางคลาส...</div> :
           classes.length === 0 ? <div style={{ padding: 14, textAlign: "center", color: B.dkGray, fontSize: 13, background: B.gray, borderRadius: 10 }}>ยังไม่มีคลาสเปิดในขณะนี้ — ติดต่อ LINE เพื่อนัดวัน</div> :
           <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {classes.map(c => (
              <button key={c.id} onClick={() => setSelectedClass(c.id)} style={{
                padding: "12px 14px", borderRadius: 10, textAlign: "left", cursor: "pointer",
                border: selectedClass === c.id ? `2px solid ${B.red}` : `1px solid ${B.ltGray}`,
                background: selectedClass === c.id ? `${B.red}08` : B.white,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: selectedClass === c.id ? B.red : B.black }}>{fmtDate(c.date)} • {c.timeSlot || c.time_slot}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>{c.courseName || c.course_name}{c.place ? ` • ${c.place}` : ""}</div>
              </button>
            ))}
           </div>}
        </div>

        <div style={{ marginBottom: 14 }}><label style={lbl}>จำนวนคน</label><select value={form.people} onChange={e => F("people", e.target.value)} style={inp}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select></div>
        <div style={{ marginBottom: 18 }}><label style={lbl}>หมายเหตุ</label><textarea value={form.note} onChange={e => F("note", e.target.value)} placeholder="ข้อมูลเพิ่มเติม" rows={2} style={{ ...inp, resize: "vertical" }}/></div>
        <button onClick={submit} disabled={submitting} style={{ ...css.btn(B.red, B.white), width: "100%", padding: "14px", fontSize: 16, opacity: submitting ? 0.6 : 1 }}>{submitting ? "กำลังจอง..." : "จองคอร์ส →"}</button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: B.dkGray }}>หรือจองผ่าน LINE ได้เลย</div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> จองผ่าน LINE @jiacpr</a>
    </div></div>
  );
}

// ==================== ADMIN ====================
const ADMIN_PASSWORD = "JiaAdmin2026";
const ADMIN_SESSION_KEY = "jia_admin_auth";

const TABS = [
  { key: "pipeline",        label: "Pipeline (jiaroo)", custom: true },
  { key: "dashboard",       label: "Dashboard",         custom: true },
  { key: "team",            label: "ทีมเซลล์",         custom: true },
  { key: "online_students", label: "นักเรียนออนไลน์", cols: ["name","phone","email","status","final_score","coupon_code","registered_at"] },
  { key: "customers",       label: "ลูกค้าทั้งหมด",   cols: ["name","tel","email","source","created_at"] },
  { key: "bookings",        label: "การจอง On-site", cols: ["name","tel","course_name","start_date","time_slot","total_people","final_price","payment_status","created_at"] },
  { key: "sales_tracking",  label: "ติดตามขาย",      cols: ["name","phone","score","coupon_code","follow_status","completed_date"] },
  { key: "online_purchases",label: "การซื้อออนไลน์", cols: ["phone","modules","amount","payment_status","slip_url"] },
  { key: "lead_promo_codes",label: "โค้ดส่วนลด Lead", cols: ["code","name","phone","email","line_id","source","created_at","expires_at","redeemed_at","email_sent_status"] },
];

// ==================== JIAROO CRM ====================
const JIAROO_TENANT = "jiaroo";
const STAGES = [
  { key: "new",       label: "ใหม่",         color: "#94A3B8" },
  { key: "called",    label: "โทรแล้ว",     color: "#3B82F6" },
  { key: "scheduled", label: "นัดคุย",       color: "#8B5CF6" },
  { key: "quoted",    label: "เสนอราคา",    color: "#F59E0B" },
  { key: "deciding",  label: "รอตัดสินใจ",  color: "#EAB308" },
  { key: "won",       label: "ปิดดีล",       color: "#22C55E" },
  { key: "lost",      label: "ไม่สนใจ",     color: "#94A3B8" },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(s => [s.key, s]));
const fmtDT = (v) => v ? new Date(v).toLocaleString("th-TH", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—";

function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState(() => load("pipeline_filter", "mine"));
  const [stuckOnly, setStuckOnly] = useState(false);
  const [filterTag, setFilterTag] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [meId, setMeId] = useState(() => load("pipeline_me", ""));
  const [toast, setToast] = useState(null);

  const showToast = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    const [l, t] = await Promise.all([
      supaRest("jiaroo_leads", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=updated_at.desc&limit=2000`),
      supaRest("jiaroo_team",  "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&active=eq.true&order=name.asc`),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setTeam(Array.isArray(t) ? t : []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh every 30s to catch newly claimed leads / new leads
  useEffect(() => {
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => { save("pipeline_filter", filterAssignee); }, [filterAssignee]);
  useEffect(() => { save("pipeline_me", meId); }, [meId]);

  const me = team.find(t => t.id === meId);

  const hoursSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : 0;
  const isStuck = (l) => l.stage !== "won" && l.stage !== "lost" && hoursSince(l.updated_at) >= 24;
  const parseTags = (s) => (s || "").split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
  const tagColor = (t) => {
    let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    const palette = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#84CC16"];
    return palette[Math.abs(h) % palette.length];
  };
  const allTags = Array.from(new Set(leads.flatMap(l => parseTags(l.tags)))).sort();

  const filtered = leads.filter(l => {
    if (filterAssignee === "mine") {
      if (!meId || l.assignee_id !== meId) return false;
    } else if (filterAssignee === "unassigned") {
      if (l.assignee_id) return false;
    } else if (filterAssignee !== "all") {
      if (l.assignee_id !== filterAssignee) return false;
    }
    if (stuckOnly && !isStuck(l)) return false;
    if (filterTag !== "all") {
      const tags = parseTags(l.tags);
      if (!tags.includes(filterTag)) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const hay = [l.name, l.display_name, l.phone, l.email, l.notes, l.tags].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const byStage = STAGES.reduce((acc, s) => { acc[s.key] = filtered.filter(l => l.stage === s.key); return acc; }, {});
  const teamById = Object.fromEntries(team.map(t => [t.id, t]));

  const moveStage = async (lead, newStage) => {
    if (lead.stage === newStage) return;
    const prev = lead.stage;
    setLeads(rs => rs.map(r => r.id === lead.id ? { ...r, stage: newStage } : r));
    await supaRest("jiaroo_leads", "PATCH", { stage: newStage }, `?id=eq.${lead.id}`);
    await supaRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "stage_change", data: { from: prev, to: newStage }, created_by: me?.name || "admin" });
  };

  // Optimistic claim — only succeeds if lead is still unassigned
  const claim = async (e, lead) => {
    e.stopPropagation();
    if (!meId) { showToast("เลือก \"ฉันคือ\" ก่อน", "warn"); return; }
    if (lead.assignee_id) { showToast("มีคนรับไปแล้ว", "warn"); return; }
    const result = await supaRest("jiaroo_leads", "PATCH", { assignee_id: meId }, `?id=eq.${lead.id}&assignee_id=is.null`);
    if (Array.isArray(result) && result.length > 0) {
      setLeads(rs => rs.map(r => r.id === lead.id ? { ...r, assignee_id: meId } : r));
      await supaRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "claim", data: { by: meId, name: me?.name }, created_by: me?.name || "admin" });
      showToast(`✓ รับ ${lead.name || lead.display_name || "lead"} แล้ว`, "ok");
    } else {
      showToast("ช้าไป! คนอื่นรับไปก่อนแล้ว", "warn");
      reload();
    }
  };

  const newCount = leads.filter(l => !l.assignee_id && l.stage === "new").length;

  const exportCSV = () => {
    const cols = ["display_name","name","phone","email","stage","assignee","tags","product_interest","deal_value","source","last_message_preview","created_at","updated_at"];
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = filtered.map(l => cols.map(c => {
      if (c === "assignee") return esc(teamById[l.assignee_id]?.name);
      if (c === "stage") return esc(STAGE_BY_KEY[l.stage]?.label || l.stage);
      return esc(l[c]);
    }).join(","));
    const csv = "﻿" + cols.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jiaroo_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* "Me" selector — each sales picks themselves once */}
      <div style={{ background: meId ? `${B.green}10` : `${B.gold}10`, border: `1px solid ${meId ? B.green : B.gold}40`, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: meId ? B.green : B.gold }}>{meId ? "👤 ฉันคือ" : "⚠ เลือกชื่อตัวเองก่อนเริ่มรับลูกค้า"}</div>
        <select value={meId} onChange={e => setMeId(e.target.value)} style={{ padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white, fontWeight: 600 }}>
          <option value="">— เลือก —</option>
          {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {me?.picture_url && <img src={me.picture_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}/>}
        {newCount > 0 && <div style={{ marginLeft: "auto", background: B.red, color: B.white, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>🔔 {newCount} lead รอรับ</div>}
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อ / เบอร์ / โน้ต / แท็ก" style={{ flex: "1 1 220px", padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
          <option value="mine">ของฉัน</option>
          <option value="unassigned">ยังไม่มีคนรับ</option>
          <option value="all">ทั้งหมด</option>
          <optgroup label="— ตามคน —">
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        </select>
        <button onClick={() => setStuckOnly(s => !s)} style={{ background: stuckOnly ? B.red : B.white, color: stuckOnly ? B.white : B.red, border: `1px solid ${B.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔥 ค้างเกิน 24 ชม</button>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
            <option value="all">ทุกแท็ก</option>
            {allTags.map(t => <option key={t} value={t}>🏷 {t}</option>)}
          </select>
        )}
        <button onClick={exportCSV} disabled={!filtered.length} style={{ background: B.white, color: B.green, border: `1px solid ${B.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5 }}>⬇ CSV</button>
        <button onClick={() => setShowNew(true)} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ เพิ่ม Lead</button>
        <button onClick={reload} style={{ background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>↻</button>
        <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{filtered.length} / {leads.length} leads</div>
      </div>

      {loading ? (
        <div style={{ background: B.white, padding: 40, borderRadius: 12, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12 }}>
          {STAGES.map(s => (
            <div key={s.key}
              onDragOver={e => { e.preventDefault(); if (dragOverStage !== s.key) setDragOverStage(s.key); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find(l => l.id === id);
                if (lead) moveStage(lead, s.key);
                setDragOverStage(null);
              }}
              style={{ minWidth: 260, flex: "0 0 260px", background: dragOverStage === s.key ? `${s.color}22` : B.gray, borderRadius: 12, padding: 10, transition: "background .15s", outline: dragOverStage === s.key ? `2px dashed ${s.color}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}/>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{byStage[s.key].length}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
                {byStage[s.key].length === 0 ? (
                  <div style={{ fontSize: 12, color: B.dkGray, padding: 12, textAlign: "center" }}>—</div>
                ) : byStage[s.key].map(l => {
                  const a = l.assignee_id ? teamById[l.assignee_id] : null;
                  const isMine = l.assignee_id === meId;
                  const unclaimed = !l.assignee_id;
                  const h = hoursSince(l.updated_at);
                  const closed = l.stage === "won" || l.stage === "lost";
                  const ageColor = closed ? null : h >= 72 ? B.red : h >= 24 ? B.gold : null;
                  const ageLabel = h < 1 ? "เพิ่ง" : h < 24 ? `${Math.floor(h)} ชม` : `${Math.floor(h / 24)} วัน`;
                  return (
                    <div key={l.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => setSelected(l)}
                      style={{ background: B.white, borderRadius: 10, padding: 10, cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,.05)", borderLeft: `3px solid ${s.color}`, position: "relative", outline: isMine ? `2px solid ${B.green}` : "none" }}>
                      {ageColor && <div title={`อัปเดตล่าสุด ${ageLabel}ที่แล้ว`} style={{ position: "absolute", top: 8, right: 8, background: ageColor, color: B.white, padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{h >= 72 ? "🔥" : "⚠"} {ageLabel}</div>}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: ageColor ? 60 : 0 }}>
                        {l.picture_url && <img src={l.picture_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}/>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name || l.display_name || "(ไม่มีชื่อ)"}</div>
                          {l.phone && <div style={{ fontSize: 11, color: B.dkGray }}>{l.phone}</div>}
                        </div>
                      </div>
                      {l.last_message_preview && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {l.last_message_preview}</div>}
                      {parseTags(l.tags).length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {parseTags(l.tags).slice(0, 4).map(t => (
                            <span key={t} style={{ background: `${tagColor(t)}20`, color: tagColor(t), padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 6 }}>
                        {unclaimed ? (
                          <button onClick={e => claim(e, l)} disabled={!meId} style={{ background: meId ? B.red : B.ltGray, color: B.white, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: meId ? "pointer" : "not-allowed", flex: 1 }}>🤚 รับ Lead</button>
                        ) : (
                          <span style={{ fontSize: 11, color: isMine ? B.green : B.dkGray, fontWeight: isMine ? 700 : 400 }}>{isMine ? "✓ ของฉัน" : `👤 ${a?.name || "—"}`}</span>
                        )}
                        <span style={{ fontSize: 10, color: B.dkGray }}>{fmtDT(l.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.kind === "warn" ? B.gold : B.green, color: B.white, padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 2000 }}>{toast.msg}</div>
      )}

      {selected && <LeadDetail lead={selected} team={team} onClose={() => setSelected(null)} onChange={reload} onStage={moveStage}/>}
      {showNew && <LeadNew team={team} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); }}/>}
    </div>
  );
}

function LeadDetail({ lead, team, onClose, onChange, onStage }) {
  const [form, setForm] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    notes: lead.notes || "",
    tags: lead.tags || "",
    product_interest: lead.product_interest || "",
    deal_value: lead.deal_value || "",
    assignee_id: lead.assignee_id || "",
    stage: lead.stage,
  });
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState("chat");
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const reloadEvents = useCallback(() => {
    supaRest("jiaroo_lead_events", "GET", null, `?lead_id=eq.${lead.id}&order=created_at.desc&limit=100`).then(r => setEvents(Array.isArray(r) ? r : []));
  }, [lead.id]);

  useEffect(() => {
    reloadEvents();
    supaRest("jiaroo_messages", "GET", null, `?lead_id=eq.${lead.id}&order=created_at.asc&limit=500`).then(r => setMessages(Array.isArray(r) ? r : []));
  }, [lead.id, reloadEvents]);

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setNoteSaving(true);
    await supaRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "note", data: { text: txt }, created_by: "admin" });
    setNoteText("");
    setNoteSaving(false);
    reloadEvents();
  };

  const save = async () => {
    setSaving(true);
    const patch = {
      name: form.name || null, phone: form.phone || null, email: form.email || null,
      notes: form.notes || null, tags: form.tags || null,
      product_interest: form.product_interest || null,
      deal_value: form.deal_value === "" ? null : Number(form.deal_value),
      assignee_id: form.assignee_id || null,
      stage: form.stage,
    };
    await supaRest("jiaroo_leads", "PATCH", patch, `?id=eq.${lead.id}`);
    if (form.stage !== lead.stage) {
      await supaRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "stage_change", data: { from: lead.stage, to: form.stage }, created_by: "admin" });
    }
    if (form.assignee_id !== (lead.assignee_id || "")) {
      await supaRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "assign", data: { from: lead.assignee_id, to: form.assignee_id || null }, created_by: "admin" });
    }
    setSaving(false);
    onChange();
    onClose();
  };

  const del = async () => {
    if (!confirm("ลบ lead นี้?")) return;
    await supaRest("jiaroo_leads", "DELETE", null, `?id=eq.${lead.id}`);
    onChange();
    onClose();
  };

  const convertToTeam = async () => {
    if (!confirm(`แปลง "${lead.display_name || lead.name}" เป็นสมาชิกทีมเซลล์?\n\nLead นี้จะถูกลบ และเมื่อคนนี้ทักเข้ามาอีก ระบบจะไม่สร้าง lead ใหม่`)) return;
    await supaRest("jiaroo_team", "POST", {
      tenant_slug: JIAROO_TENANT,
      name: lead.display_name || lead.name || "(ไม่มีชื่อ)",
      picture_url: lead.picture_url || null,
      line_user_id: lead.line_user_id || null,
      phone: lead.phone || null,
      email: lead.email || null,
      role: "sales",
      active: true,
    });
    await supaRest("jiaroo_leads", "DELETE", null, `?id=eq.${lead.id}`);
    onChange();
    onClose();
  };

  const Fld = (k, label, type = "text") => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{label}</label>
      {type === "textarea" ? (
        <textarea value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} rows={3} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}/>
      ) : (
        <input type={type} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, width: "100%", maxWidth: 480, height: "100%", overflowY: "auto", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{lead.display_name || lead.name || "Lead"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: B.dkGray }}>×</button>
        </div>
        {lead.line_user_id && <div style={{ fontSize: 11, color: B.dkGray, marginBottom: 10 }}>LINE: {lead.line_user_id}</div>}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>Stage</label>
          <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>มอบหมาย</label>
          <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="">— ยังไม่มอบหมาย —</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {Fld("name", "ชื่อ")}
        {Fld("phone", "เบอร์")}
        {Fld("email", "อีเมล")}
        {Fld("product_interest", "สนใจสินค้า/คอร์ส")}
        {Fld("deal_value", "มูลค่าดีล (บาท)", "number")}
        {Fld("tags", "แท็ก (คั่นด้วย ,)")}
        {Fld("notes", "โน้ต", "textarea")}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          <button onClick={del} style={{ background: B.white, color: B.red, border: `1px solid ${B.red}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, cursor: "pointer" }}>ลบ</button>
        </div>

        {lead.line_user_id && (
          <button onClick={convertToTeam} style={{ width: "100%", background: B.white, color: B.dkGray, border: `1px dashed ${B.ltGray}`, borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", marginTop: 8 }}>
            👤 ทำให้เป็นทีมเซลล์ (ไม่ใช่ลูกค้า)
          </button>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${B.ltGray}`, marginBottom: 12 }}>
            {[
              { k: "chat", l: `💬 แชท (${messages.length})` },
              { k: "notes", l: `📝 โน้ต (${events.filter(e => e.type === "note").length})` },
              { k: "timeline", l: `📋 Timeline (${events.length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{ background: "transparent", border: "none", padding: "8px 14px", fontSize: 13, fontWeight: tab === t.k ? 700 : 400, color: tab === t.k ? B.red : B.dkGray, borderBottom: `2px solid ${tab === t.k ? B.red : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>{t.l}</button>
            ))}
          </div>

          {tab === "chat" && (
            messages.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีข้อความ</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", background: `${B.gray}80`, borderRadius: 10, padding: 12 }}>
                {(() => {
                  let lastDate = "";
                  return messages.map(m => {
                    const dateStr = new Date(m.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
                    const showDate = dateStr !== lastDate;
                    lastDate = dateStr;
                    const inbound = m.direction === "in";
                    return (
                      <div key={m.id}>
                        {showDate && <div style={{ textAlign: "center", fontSize: 10, color: B.dkGray, padding: "8px 0 4px" }}>— {dateStr} —</div>}
                        <div style={{ display: "flex", justifyContent: inbound ? "flex-start" : "flex-end" }}>
                          <div style={{ maxWidth: "78%", background: inbound ? B.white : `${B.green}20`, color: B.black, borderRadius: 12, padding: "8px 12px", fontSize: 13, wordBreak: "break-word", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                            <div style={{ whiteSpace: "pre-wrap" }}>{m.text || `[${m.message_type}]`}</div>
                            <div style={{ fontSize: 9, color: B.dkGray, marginTop: 4, textAlign: "right" }}>{new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )
          )}

          {tab === "notes" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="เขียนโน้ตเกี่ยวกับลูกค้า เช่น คุยอะไรไปแล้ว สิ่งที่ต้องตามต่อ..." rows={2} style={{ flex: 1, padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}/>
                <button onClick={addNote} disabled={!noteText.trim() || noteSaving} style={{ background: B.red, color: B.white, border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: noteText.trim() ? "pointer" : "not-allowed", opacity: noteText.trim() && !noteSaving ? 1 : 0.5, alignSelf: "stretch" }}>{noteSaving ? "..." : "เพิ่ม"}</button>
              </div>
              {events.filter(e => e.type === "note").length === 0 ? (
                <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีโน้ต — เริ่มจดบันทึกได้เลย</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.filter(e => e.type === "note").map(ev => (
                    <div key={ev.id} style={{ padding: 10, background: `${B.gold}10`, border: `1px solid ${B.gold}40`, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{ev.data?.text || ""}</div>
                      <div style={{ color: B.dkGray, fontSize: 11, marginTop: 6 }}>{fmtDT(ev.created_at)} {ev.created_by ? `• ${ev.created_by}` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "timeline" && (
            events.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีกิจกรรม</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {events.map(ev => {
                  const d = ev.data || {};
                  let label = ev.type;
                  if (ev.type === "stage_change") label = `เปลี่ยน stage: ${STAGE_BY_KEY[d.from]?.label || d.from} → ${STAGE_BY_KEY[d.to]?.label || d.to}`;
                  else if (ev.type === "assign") label = "เปลี่ยนผู้รับผิดชอบ";
                  else if (ev.type === "claim") label = `${d.name || "ใครบางคน"} กดรับ lead`;
                  else if (ev.type === "created") label = `สร้าง lead (${d.source || ""})`;
                  else if (ev.type === "follow") label = "เพิ่มเพื่อน LINE";
                  else if (ev.type === "unfollow") label = "บล็อก / ลบเพื่อน";
                  else if (ev.type === "note") label = `📝 โน้ต: ${(d.text || "").slice(0, 80)}${(d.text || "").length > 80 ? "..." : ""}`;
                  return (
                    <div key={ev.id} style={{ padding: 8, background: B.gray, borderRadius: 8, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div style={{ color: B.dkGray, fontSize: 11 }}>{fmtDT(ev.created_at)} {ev.created_by ? `• ${ev.created_by}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function LeadNew({ team, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "manual", assignee_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name && !form.phone) { alert("กรอกชื่อหรือเบอร์อย่างน้อย 1"); return; }
    setSaving(true);
    const res = await supaRest("jiaroo_leads", "POST", {
      tenant_slug: JIAROO_TENANT,
      name: form.name || null,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      assignee_id: form.assignee_id || null,
      notes: form.notes || null,
      stage: "new",
    });
    const id = Array.isArray(res) && res[0]?.id;
    if (id) await supaRest("jiaroo_lead_events", "POST", { lead_id: id, type: "created", data: { source: form.source }, created_by: "admin" });
    setSaving(false);
    onCreated();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, borderRadius: 12, padding: 20, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>เพิ่ม Lead ใหม่</div>
        {["name","phone","email"].map(k => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{k === "name" ? "ชื่อ" : k === "phone" ? "เบอร์" : "อีเมล"}</label>
            <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
          </div>
        ))}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>แหล่งที่มา</label>
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="manual">เพิ่มเอง</option>
            <option value="line">LINE OA</option>
            <option value="facebook">Facebook</option>
            <option value="phone">โทรเข้า</option>
            <option value="referral">แนะนำ</option>
            <option value="website">เว็บไซต์</option>
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>มอบหมาย</label>
          <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="">— ยังไม่มอบหมาย —</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>โน้ต</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}/>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "เพิ่ม"}</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(30);

  const reload = useCallback(async () => {
    setLoading(true);
    const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
    const [l, t, e] = await Promise.all([
      supaRest("jiaroo_leads", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&limit=5000`),
      supaRest("jiaroo_team",  "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=name.asc`),
      supaRest("jiaroo_lead_events", "GET", null, `?created_at=gte.${sinceISO}&order=created_at.desc&limit=200`),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setTeam(Array.isArray(t) ? t : []);
    setEvents(Array.isArray(e) ? e : []);
    setLoading(false);
  }, [range]);
  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ background: B.white, padding: 40, borderRadius: 12, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>;

  const sinceMs = Date.now() - range * 86400000;
  const inRange = leads.filter(l => new Date(l.created_at).getTime() >= sinceMs);
  const won = leads.filter(l => l.stage === "won");
  const lost = leads.filter(l => l.stage === "lost");
  const closed = won.length + lost.length;
  const conv = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
  const totalValue = won.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
  const teamById = Object.fromEntries(team.map(t => [t.id, t]));

  const byStage = STAGES.map(s => ({ ...s, count: leads.filter(l => l.stage === s.key).length }));
  const maxStage = Math.max(1, ...byStage.map(b => b.count));

  const bySource = leads.reduce((acc, l) => { const k = l.source || "—"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]);

  const byAssignee = team.map(t => {
    const my = leads.filter(l => l.assignee_id === t.id);
    return { name: t.name, total: my.length, won: my.filter(l => l.stage === "won").length, lost: my.filter(l => l.stage === "lost").length };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const unassigned = leads.filter(l => !l.assignee_id).length;
  const stuckCount = leads.filter(l => l.stage !== "won" && l.stage !== "lost" && (Date.now() - new Date(l.updated_at).getTime()) / 3600000 >= 24).length;

  const stat = (label, val, color) => (
    <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
      <div style={{ fontSize: 11, color: B.dkGray }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: B.dkGray }}>ภาพรวม jiaroo CRM</div>
        <select value={range} onChange={e => setRange(Number(e.target.value))} style={{ padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
          <option value={7}>7 วันล่าสุด</option>
          <option value={30}>30 วันล่าสุด</option>
          <option value={90}>90 วันล่าสุด</option>
          <option value={365}>1 ปีล่าสุด</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {stat("Leads ทั้งหมด", leads.length, B.black)}
        {stat(`Leads ใหม่ (${range}d)`, inRange.length, B.red)}
        {stat("ปิดดีลได้", won.length, B.green)}
        {stat("Conversion", `${conv}%`, B.gold)}
        {stat("มูลค่ารวม", "฿" + totalValue.toLocaleString(), B.green)}
        {stat("ยังไม่มอบหมาย", unassigned, unassigned > 0 ? B.red : B.dkGray)}
        {stat("ค้างเกิน 24 ชม", stuckCount, stuckCount > 0 ? B.red : B.dkGray)}
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Leads ตาม Stage</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {byStage.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 100, fontSize: 12 }}>{s.label}</div>
              <div style={{ flex: 1, background: B.gray, borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                <div style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color, height: "100%", borderRadius: 6, transition: "width .3s" }}/>
              </div>
              <div style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>แหล่งที่มา</div>
          {sourceRows.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>—</div> : sourceRows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.gray}`, fontSize: 13 }}>
              <span>{k}</span>
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>ผลงานทีม</div>
          {byAssignee.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>ยังไม่มีการมอบหมาย</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: B.dkGray, fontSize: 11 }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>ชื่อ</th>
                <th style={{ textAlign: "right", padding: "4px 0" }}>ทั้งหมด</th>
                <th style={{ textAlign: "right", padding: "4px 0", color: B.green }}>ปิดได้</th>
                <th style={{ textAlign: "right", padding: "4px 0", color: B.dkGray }}>เสีย</th>
              </tr></thead>
              <tbody>
                {byAssignee.map(r => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${B.gray}` }}>
                    <td style={{ padding: "6px 0", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ textAlign: "right" }}>{r.total}</td>
                    <td style={{ textAlign: "right", color: B.green, fontWeight: 600 }}>{r.won}</td>
                    <td style={{ textAlign: "right", color: B.dkGray }}>{r.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>กิจกรรมล่าสุด ({events.length})</div>
        {events.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>ยังไม่มีกิจกรรมในช่วงเวลานี้</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {events.slice(0, 50).map(ev => {
              const lead = leads.find(l => l.id === ev.lead_id);
              const data = ev.data || {};
              let desc = ev.type;
              if (ev.type === "stage_change") desc = `${STAGE_BY_KEY[data.from]?.label || data.from} → ${STAGE_BY_KEY[data.to]?.label || data.to}`;
              else if (ev.type === "assign") desc = `มอบหมายให้ ${teamById[data.to]?.name || "ใครก็ตาม"}`;
              else if (ev.type === "created") desc = `สร้าง (${data.source || ""})`;
              else if (ev.type === "claim") desc = `${data.name || "ใครบางคน"} กดรับ`;
              else if (ev.type === "note") desc = `📝 ${(data.text || "").slice(0, 60)}${(data.text || "").length > 60 ? "..." : ""}`;
              else if (ev.type === "follow") desc = "เพิ่มเพื่อน LINE";
              else if (ev.type === "unfollow") desc = "บล็อก / ลบเพื่อน";
              return (
                <div key={ev.id} style={{ display: "flex", gap: 8, padding: 8, background: B.gray, borderRadius: 6, fontSize: 12 }}>
                  <div style={{ minWidth: 90, color: B.dkGray, fontSize: 11 }}>{fmtDT(ev.created_at)}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{lead ? (lead.name || lead.display_name || "—") : "(ลบแล้ว)"}</span>
                    <span style={{ color: B.dkGray, marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamManager() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await supaRest("jiaroo_team", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=active.desc,name.asc`);
    setTeam(Array.isArray(r) ? r : []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const toggleActive = async (m) => {
    await supaRest("jiaroo_team", "PATCH", { active: !m.active }, `?id=eq.${m.id}`);
    reload();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: B.dkGray }}>{team.filter(t => t.active).length} active / {team.length} ทั้งหมด</div>
        <button onClick={() => setShowNew(true)} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ เพิ่มสมาชิก</button>
      </div>
      <div style={{ background: B.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div> :
         team.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>ยังไม่มีสมาชิก — กด "+ เพิ่มสมาชิก"</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: B.gray }}>
              {["ชื่อ","อีเมล","เบอร์","บทบาท","สถานะ",""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: B.dkGray, fontSize: 12, borderBottom: `1px solid ${B.ltGray}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${B.ltGray}`, opacity: m.active ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: "10px 12px" }}>{m.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{m.phone || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{m.role}</td>
                  <td style={{ padding: "10px 12px" }}>{m.active ? "✓ active" : "ปิดอยู่"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(m)} style={{ background: "transparent", color: B.red, border: "none", cursor: "pointer", fontSize: 12, marginRight: 8 }}>แก้ไข</button>
                    <button onClick={() => toggleActive(m)} style={{ background: "transparent", color: B.dkGray, border: "none", cursor: "pointer", fontSize: 12 }}>{m.active ? "ปิด" : "เปิด"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && <TeamForm member={editing} onClose={() => { setShowNew(false); setEditing(null); }} onSaved={() => { setShowNew(false); setEditing(null); reload(); }}/>}
    </div>
  );
}

function TeamForm({ member, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone || "",
    role: member?.role || "sales",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name) { alert("กรอกชื่อ"); return; }
    setSaving(true);
    if (member) {
      await supaRest("jiaroo_team", "PATCH", { name: form.name, email: form.email || null, phone: form.phone || null, role: form.role }, `?id=eq.${member.id}`);
    } else {
      await supaRest("jiaroo_team", "POST", { tenant_slug: JIAROO_TENANT, name: form.name, email: form.email || null, phone: form.phone || null, role: form.role, active: true });
    }
    setSaving(false);
    onSaved();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, borderRadius: 12, padding: 20, width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{member ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</div>
        {[["name","ชื่อ"],["email","อีเมล"],["phone","เบอร์"]].map(([k, l]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{l}</label>
            <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>บทบาท</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="sales">sales</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onAuth }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onAuth();
    } else {
      setErr("รหัสผ่านไม่ถูกต้อง");
    }
  };
  return (
    <div style={{ ...css.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...css.card, maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.red}15`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <I name="lock" size={28} color={B.red}/>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>JIA Admin</h2>
          <p style={{ fontSize: 13, color: B.dkGray, marginTop: 6 }}>กรอกรหัสผ่านเพื่อเข้าระบบ</p>
        </div>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="รหัสผ่าน"
          autoFocus
          style={{ width: "100%", padding: "14px 16px", border: `1px solid ${B.ltGray}`, borderRadius: 10, fontSize: 15, marginBottom: 10, boxSizing: "border-box" }}
        />
        {err && <div style={{ color: B.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button onClick={submit} style={{ ...css.btn(B.red, B.white, true) }}>เข้าระบบ →</button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: B.dkGray }}>← กลับหน้าหลัก</a>
        </div>
      </div>
    </div>
  );
}

function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  const [tab, setTab] = useState("pipeline");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, finished: 0, in_progress: 0, customers: 0, line_linked: 0, bookings: 0, new_24h: 0, new_7d: 0 });
  // "เห็นแล้วล่าสุด" — ใช้ไฮไลต์นักเรียนที่สมัครหลังจากครั้งที่เปิดดูรอบก่อน
  const [studentsSeenAt, setStudentsSeenAt] = useState(() => load("admin_students_seen_at", null));

  const currentTab = TABS.find(t => t.key === tab);
  const isCustomTab = !!currentTab?.custom;

  const fetchTab = useCallback(async (key) => {
    const t = TABS.find(x => x.key === key);
    if (t?.custom) { setRows([]); return; }
    setLoading(true);
    const orderCol = key === "online_students" ? "registered_at"
      : key === "bookings" || key === "customers" || key === "lead_promo_codes" ? "created_at"
      : key === "sales_tracking" ? "completed_date"
      : "id";
    const data = await supaRest(key, "GET", null, `?order=${orderCol}.desc.nullslast&limit=1000`);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const [students, customers, bookings] = await Promise.all([
      supaRest("online_students", "GET", null, "?select=status,registered_at&limit=10000"),
      supaRest("customers", "GET", null, "?select=id,line_user_id&limit=10000"),
      supaRest("bookings", "GET", null, "?select=id&limit=10000"),
    ]);
    const s = Array.isArray(students) ? students : [];
    const cust = Array.isArray(customers) ? customers : [];
    const now = Date.now();
    const since = (ms) => s.filter(x => x.registered_at && (now - new Date(x.registered_at).getTime()) <= ms).length;
    setStats({
      total: s.length,
      finished: s.filter(x => (x.status || "").startsWith("จบคอร์ส")).length,
      in_progress: s.filter(x => x.status === "กำลังเรียน").length,
      customers: cust.length,
      line_linked: cust.filter(x => x.line_user_id).length,
      bookings: Array.isArray(bookings) ? bookings.length : 0,
      new_24h: since(24 * 60 * 60 * 1000),
      new_7d: since(7 * 24 * 60 * 60 * 1000),
    });
  }, []);

  useEffect(() => { if (authed) { fetchTab(tab); } }, [authed, tab, fetchTab]);
  useEffect(() => { if (authed) { fetchStats(); } }, [authed, fetchStats]);

  if (!authed) return <AdminLogin onAuth={() => setAuthed(true)}/>;

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthed(false);
  };

  const filtered = rows.filter(r => {
    if (q) {
      const s = q.toLowerCase();
      const hay = [r.name, r.phone, r.tel, r.email, r.coupon_code, r.code, r.line_id, r.source].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (statusFilter !== "all") {
      const st = r.status || r.payment_status || r.follow_status || "";
      if (statusFilter === "finished" && !st.startsWith("จบคอร์ส")) return false;
      if (statusFilter === "in_progress" && st !== "กำลังเรียน") return false;
      if (statusFilter === "pending_pay" && st !== "รอชำระ" && st !== "แจ้งชำระแล้ว") return false;
      if (statusFilter === "paid" && st !== "ชำระแล้ว") return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!filtered.length) return;
    const cols = currentTab.cols;
    const header = cols.join(",");
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const body = filtered.map(r => cols.map(c => escape(r[c])).join(",")).join("\n");
    const csv = "﻿" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jia_${tab}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (v) => {
    if (v == null || v === "") return "—";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16).replace("T", " ");
    if (typeof v === "string" && v.startsWith("http")) return <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: B.red, textDecoration: "underline" }}>ดูสลิป</a>;
    return String(v);
  };

  // นักเรียนใหม่ = แถวที่สมัครหลังจาก timestamp ที่เปิดดูครั้งก่อน (เก็บใน localStorage)
  const seenMs = studentsSeenAt ? new Date(studentsSeenAt).getTime() : null;
  const isNewStudent = (r) => tab === "online_students" && seenMs != null && r.registered_at && new Date(r.registered_at).getTime() > seenMs;
  const newSinceSeen = tab === "online_students" ? rows.filter(isNewStudent).length : 0;
  const markStudentsSeen = () => {
    const ts = new Date().toISOString();
    save("admin_students_seen_at", ts);
    setStudentsSeenAt(ts);
  };

  return (
    <div style={{ minHeight: "100vh", background: B.gray }}>
      <div style={{ background: B.black, color: B.white, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <I name="lock" size={20} color={B.white}/>
          <div style={{ fontWeight: 700, fontSize: 16 }}>JIA Admin</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { fetchTab(tab); fetchStats(); }} style={{ background: "transparent", color: B.white, border: `1px solid ${B.white}40`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>↻ รีเฟรช</button>
          <button onClick={logout} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          {[
            { label: "นักเรียนทั้งหมด", value: stats.total, color: B.red },
            { label: "🆕 ใหม่ 24 ชม.", value: stats.new_24h, color: B.gold },
            { label: "🆕 ใหม่ 7 วัน", value: stats.new_7d, color: B.gold },
            { label: "จบคอร์สแล้ว", value: stats.finished, color: B.green },
            { label: "กำลังเรียน", value: stats.in_progress, color: B.gold },
            { label: "ลูกค้าทั้งหมด", value: stats.customers, color: B.black },
            { label: "🟢 ผูก LINE แล้ว", value: stats.line_linked, color: "#06C755" },
            { label: "การจอง On-site", value: stats.bookings, color: B.dkGray },
          ].map(c => (
            <div key={c.label} style={{ background: B.white, borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize: 11, color: B.dkGray }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? B.red : B.white, color: tab === t.key ? B.white : B.dkGray, border: `1px solid ${tab === t.key ? B.red : B.ltGray}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t.label}</button>
          ))}
        </div>

        {/* Custom tabs (Pipeline / Dashboard / Team) */}
        {tab === "pipeline" && <Pipeline/>}
        {tab === "dashboard" && <Dashboard/>}
        {tab === "team" && <TeamManager/>}

        {/* Search & filter (for table tabs only) */}
        {!isCustomTab && (
        <>
        <div style={{ background: B.white, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / เบอร์ / อีเมล / คูปอง" style={{ flex: "1 1 220px", padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
          {tab === "online_students" && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
              <option value="all">ทุกสถานะ</option>
              <option value="finished">จบคอร์สแล้ว</option>
              <option value="in_progress">กำลังเรียน</option>
            </select>
          )}
          {(tab === "bookings" || tab === "online_purchases") && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
              <option value="all">ทุกสถานะการชำระ</option>
              <option value="pending_pay">รอชำระ / แจ้งชำระ</option>
              <option value="paid">ชำระแล้ว</option>
            </select>
          )}
          <button onClick={exportCSV} disabled={!filtered.length} style={{ background: B.green, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5 }}>⬇ Export CSV</button>
          <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{filtered.length} / {rows.length} แถว</div>
        </div>

        {/* แบนเนอร์นักเรียนใหม่ตั้งแต่ครั้งก่อน */}
        {tab === "online_students" && newSinceSeen > 0 && (
          <div style={{ background: `${B.green}12`, border: `1px solid ${B.green}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: B.black }}>🆕 มีนักเรียนใหม่ {newSinceSeen} คน ตั้งแต่ครั้งก่อน</span>
            <button onClick={markStudentsSeen} style={{ marginLeft: "auto", background: B.green, color: B.white, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>ทำเครื่องหมายว่าดูแล้ว</button>
          </div>
        )}

        {/* Table */}
        <div style={{ background: B.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>ไม่พบข้อมูล</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: B.gray }}>
                    {currentTab.cols.map(c => (
                      <th key={c} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: B.dkGray, fontSize: 12, borderBottom: `1px solid ${B.ltGray}`, whiteSpace: "nowrap" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const isNew = isNewStudent(r);
                    return (
                    <tr key={r.id || i} style={{ borderBottom: `1px solid ${B.ltGray}`, background: isNew ? `${B.green}10` : "transparent" }}>
                      {currentTab.cols.map((c, ci) => (
                        <td key={c} style={{ padding: "10px 12px", verticalAlign: "top" }}>
                          {ci === 0 && isNew && <span style={{ display: "inline-block", background: B.green, color: B.white, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>ใหม่</span>}
                          {fmt(r[c])}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: B.dkGray }}>
          JIA Admin • แสดงสูงสุด 1000 แถวล่าสุดต่อตาราง
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ==================== APP ====================
export default function App() {
  // เข้าหน้า admin ได้ทั้ง path /admin (เช่น cpr.morroo.com/admin) และ ?admin=1 (เดิม)
  const isAdmin = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    /\/admin\/?$/.test(window.location.pathname)
  );
  const promoParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("promo") : null;
  const [page, setPage] = useState(() => {
    if (promoParam) return "claim";
    if (isSignedUp() || load("progress", { done: [] }).done.length > 0) return "course";
    // front gate (before-course): เปิดเว็บครั้งแรก → ควิซเกริ่นนำ → ถ้าทำควิซแล้วแต่ยังไม่สมัคร → ด่านสมัคร
    if (AUTH_GATE_ENABLED && getGateVariant() === "before-course") return load("teaser_done", false) ? "signupgate" : "teaserquiz";
    return "landing";
  });
  const [initialClaimCode] = useState(promoParam || "");
  const [user, setUser] = useState(() => load("user", null));
  const [progress, setProgress] = useState(() => load("progress", { done: [], scores: {} }));
  const [blogSlug, setBlogSlug] = useState(null);
  const go = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);
  // เข้าคอร์ส: ขึ้นกับตัวแปรด่าน (A/B) — before-course เด้งสมัครก่อน, soft = แอด LINE แบบข้ามได้, after-lesson-1 = เข้าเลย (ด่านไปโผล่หลังจบบท 1)
  const enterCourse = useCallback(() => {
    const v = getGateVariant();
    if (AUTH_GATE_ENABLED && v === "before-course" && !isSignedUp()) { go(load("teaser_done", false) ? "signupgate" : "teaserquiz"); return; }
    if ((!AUTH_GATE_ENABLED || v === "soft") && !load("line_added", false) && !load("line_skipped_at", null)) { go("lineprompt"); return; }
    go("course");
  }, [go]);
  const openBlog = useCallback(slug => { setBlogSlug(slug); setPage("blog-detail"); window.scrollTo(0, 0); }, []);
  const backFromBlog = useCallback(() => { setPage(load("progress", { done: [] }).done.length > 0 ? "course" : "landing"); window.scrollTo(0, 0); }, []);

  // Handle Stripe success redirect + clean ?promo from URL after consuming
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success") {
      const mods = params.get("modules");
      if (mods) {
        const newMods = mods.split(",").map(Number).filter(Boolean);
        const current = getPurchased();
        const merged = [...new Set([...current, ...newMods])];
        savePurchased(merged);
        supaRest("online_purchases", "PATCH", { payment_status: "ชำระแล้ว" }, `?phone=eq.${encodeURIComponent(load("user",{})?.phone||"")}&payment_status=eq.รอชำระ`);
      }
      window.history.replaceState({}, "", window.location.pathname);
      setPage("course");
    }
    if (params.get("promo")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // UTM + A/B variant + จบ flow ล็อกอิน (LINE LIFF redirect / Google OAuth return)
  useEffect(() => {
    captureUTM();
    getPosthog().then(ph => { if (ph) { try { ph.onFeatureFlags(() => { const v = ph.getFeatureFlag("gate_placement"); if (typeof v === "string" && ["before-course","after-lesson-1","soft"].includes(v)) save("gate_variant", v); }); } catch (e) {} } });
    if (load("line_login_pending", false)) {
      finishLineSignup().then(r => { if (r) { setUser(r.user); if (r.progress) setProgress(r.progress); setPage("lineprompt"); window.scrollTo(0, 0); } });
    } else if (load("oauth_pending", false) || /[?#].*(code=|access_token=)/.test(window.location.href)) {
      finalizeOAuthSignup("google").then(r => { if (r) { setUser(r.user); if (r.progress) setProgress(r.progress); window.history.replaceState({}, "", window.location.pathname); setPage("lineprompt"); window.scrollTo(0, 0); } });
    }
  }, []);

  if (isAdmin) return (
    <>
      <Admin/>
      <Analytics />
    </>
  );

  return (
    <>
      {(() => {
        switch (page) {
          case "landing": return <Landing go={go} enterCourse={enterCourse} openBlog={openBlog}/>;
          case "register": return <Register go={go} setUser={u => { setUser(u); save("user", u); }}/>;
          case "lineprompt": return <LineAddPrompt go={go} user={user} variant={isSignedUp() ? "post-register" : "pre-course"}/>;
          case "teaserquiz": return <TeaserQuiz go={go}/>;
          case "signupgate": return <SignupGate go={go} setUser={u => { setUser(u); save("user", u); }} setProgress={p => { setProgress(p); save("progress", p); }}/>;
          case "payment": return <Payment go={go} user={user}/>;
          case "store": return <Store go={go}/>;
          case "course": return <Course go={go} progress={progress} setProgress={p => { setProgress(p); save("progress", p); }} user={user} openBlog={openBlog}/>;
          case "certificate": return <Certificate user={user} go={go}/>;
          case "minicert": return <MiniCert user={user} go={go}/>;
          case "booking": return <Booking go={go}/>;
          case "blog": return <BlogList goBack={backFromBlog} openBlog={openBlog}/>;
          case "blog-detail": return <BlogDetail slug={blogSlug} goBack={() => go("blog")} openBlog={openBlog}/>;
          case "claim": return <Claim go={go} setUser={u => { setUser(u); save("user", u); }} initialStep={initialClaimCode ? "redeem" : "form"} initialCode={initialClaimCode}/>;
          default: return <Landing go={go} enterCourse={enterCourse} openBlog={openBlog}/>;
        }
      })()}
      <Analytics />
    </>
  );
}
