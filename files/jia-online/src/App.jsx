import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { useState, useEffect, useCallback, useRef } from "react";

// ==================== BRAND ====================
const B = { red: "#C8102E", dkRed: "#9B0020", black: "#1A1A1A", white: "#FFFFFF", cream: "#FFF8F0", gray: "#F5F5F5", ltGray: "#E8E8E8", dkGray: "#666", green: "#22C55E", gold: "#F59E0B" };

// ========== CONFIG ==========
const FREE_LAUNCH = true; // เปลี่ยนเป็น false เดือน ส.ค. 2569 เพื่อเริ่มคิดเงิน
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

// ========== PRICING ==========
const PRICING = {
  single: 35,       // ฿35 ต่อหัวข้อ
  bundle3: 100,     // ฿100 ต่อ 3 หัวข้อ
  full: 149,        // ฿149 Full Course + Final Exam
  freeModule: 1,    // บทที่ 1 ฟรี (CPR ผู้ใหญ่)
};

const supaRest = async (table, method = "GET", body = null, filters = "") => {
  const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
  const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
  if (method === "POST" || method === "PATCH") h.Prefer = "return=representation";
  const opts = { method, headers: h };
  if (body && method !== "GET" && method !== "DELETE") opts.body = JSON.stringify(body);
  try { const res = await fetch(url, opts); return res.ok ? (await res.text().then(t => t ? JSON.parse(t) : [])) : []; } catch(e) { console.error("Supabase:", e); return []; }
};
const genCoupon = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = "JIA-"; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
const save = (k, v) => { try { localStorage.setItem(`jia_${k}`, JSON.stringify(v)); } catch(e){} };
const load = (k, d) => { try { const v = localStorage.getItem(`jia_${k}`); return v ? JSON.parse(v) : d; } catch(e){ return d; } };

// ========== PURCHASE HELPERS ==========
const getPurchased = () => load("purchased", FREE_LAUNCH ? [1,2,3,4,5,6,7] : [PRICING.freeModule]);
const savePurchased = (ids) => { save("purchased", ids); };
const isModuleAccessible = (id, purchased) => purchased.includes(id) || (id === 7 && purchased.filter(x => x <= 6).length === 6);
const calcPrice = (count) => {
  if (count >= 6) return PRICING.full;
  if (count >= 3) return Math.floor(count / 3) * PRICING.bundle3 + (count % 3) * PRICING.single;
  return count * PRICING.single;
};

// ========== COURSE DATA ==========
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

// ==================== LANDING ====================
function Landing({ go }) {
  const [a, setA] = useState(false); useEffect(() => { setTimeout(() => setA(true), 100); }, []);
  const enrolled = load("enrolled", false);
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
        <div><button onClick={() => enrolled ? go("course") : go("register")} style={{ ...css.btn(B.white, B.red), padding: "16px 52px", fontSize: 16 }}>{enrolled ? "เข้าเรียนต่อ →" : FREE_LAUNCH ? "ลงทะเบียนเรียนฟรี →" : "ลงทะเบียน — เรียนบทแรกฟรี →"}</button></div>
      </div>
    </div>

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
      <button onClick={() => enrolled ? go("store") : go("register")} style={{ ...css.btn(B.red, B.white, true), marginTop: 4 }}>{enrolled ? "เลือกซื้อหัวข้อ →" : "ลงทะเบียนก่อน →"}</button>
    </div>}

    <div style={{ ...css.wrap, paddingTop: FREE_LAUNCH ? 36 : 0, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เรียนอะไรบ้าง?</h3>
      {COURSE.modules.slice(0, 6).map((m, i) => (<div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12, background: B.white, borderRadius: 14, padding: "14px 16px" }}><div style={{ minWidth: 38, height: 38, borderRadius: 10, background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", color: B.red, fontWeight: 800, fontSize: 15 }}>{String(i + 1).padStart(2, "0")}</div><div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.short} {i === 0 && !FREE_LAUNCH ? <span style={{ background: B.green, color: B.white, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>ฟรี</span> : null}</div><div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>{m.desc}</div></div></div>))}
      <div style={{ background: `${B.gold}18`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 4 }}><I name="cert" size={26} color={B.gold}/><div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>+ แบบทดสอบสุดท้าย & ใบประกาศนียบัตร</div></div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 24 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 24, border: `1px solid ${B.red}12` }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}><h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>ทำไมต้องเรียน CPR?</h3><p style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ข้อมูลจากงานวิจัย</p></div>
        {[{ n: "10%", c: B.red, t: "ทุก 1 นาทีที่ไม่ได้ทำ CPR\nโอกาสรอดชีวิตลดลง 10%" }, { n: "3-6 เดือน", c: B.gold, t: "ทักษะ CPR เสื่อมลง\nภายใน 3-6 เดือนหลังอบรม" }, { n: "58%", c: B.green, t: "ผู้ทบทวนทุกเดือนทำได้ \"ดีเยี่ยม\"\nเทียบกับ 15% ที่ทบทวนปีละครั้ง" }].map((r, i) => (<div key={i} style={{ background: `${r.c}08`, borderRadius: 12, padding: 14, marginBottom: 14, borderLeft: `4px solid ${r.c}` }}><div style={{ fontSize: 28, fontWeight: 800, color: r.c }}>{r.n}</div><div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.t}</div></div>))}
      </div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 16 }}><MorrooAdBanner/></div>
    <div style={{ ...css.wrap, paddingBottom: 100 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{[{ icon: "play", l: "6 วิดีโอ", s: "เรียนได้ทุกที่" },{ icon: "book", l: "Quiz ทุกบท", s: "ทดสอบความเข้าใจ" },{ icon: "cert", l: "ใบประกาศฯ", s: "มาตรฐาน 2025" },{ icon: "heart", l: "คูปอง ฿100", s: "ใช้ตอนเรียน on-site" }].map((f, i) => (<div key={i} style={{ background: B.white, borderRadius: 14, padding: 16, textAlign: "center" }}><I name={f.icon} size={22} color={B.red}/><div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{f.l}</div><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{f.s}</div></div>))}</div></div>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.08)", zIndex: 100 }}><div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, color: B.dkGray }}>{FREE_LAUNCH ? "ช่วง Launch พิเศษ" : "เริ่มต้น"}</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{FREE_LAUNCH ? "ฟรี!" : "฿35/หัวข้อ"}</div></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => { const txt = "เรียน CPR & AED ออนไลน์! ได้ใบ Certificate + คูปองส่วนลด"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://jiacpr.com/online" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://jiacpr.com/online") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn(B.white, B.red), padding: "10px 14px", border: `1px solid ${B.red}30`, fontSize: 13 }}>แชร์</button><button onClick={() => enrolled ? go("course") : go("register")} style={css.btn(B.red, B.white)}>{enrolled ? "เข้าเรียน" : FREE_LAUNCH ? "เรียนฟรี" : "ลงทะเบียน"}</button></div></div></div>
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
  const onAdded = () => { markLineAdded(user); safeTrack("line_oa_confirm_added", { variant }); go("course"); };
  const onSkip = () => { safeTrack("line_oa_skipped", { variant }); save("line_skipped_at", new Date().toISOString()); go("course"); };
  const onClickLink = () => { safeTrack("line_oa_clicked", { variant, has_link_code: true }); };
  const title = variant === "post-register" ? "เกือบเสร็จแล้ว! เพิ่ม LINE เพื่อรับสิทธิ์เต็ม" : "อย่าลืมเพิ่ม LINE!";
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>เพิ่ม LINE @jiacpr</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <div style={{ ...css.card, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#06C75518", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <I name="line" size={36} color="#06C755"/>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
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

// ==================== REGISTER (+ PDPA) ====================
function Register({ go, setUser }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" }); const [err, setErr] = useState({}); const [pdpa, setPdpa] = useState(false);
  const submit = () => {
    const e = {}; if (!f.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล"; if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง"; if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนลงทะเบียน"; if (Object.keys(e).length) return setErr(e);
    const cleanPhone = f.phone.replace(/\D/g, "");
    const userData = { name: f.name.trim(), phone: cleanPhone, email: f.email };
    setUser(userData); save("user", userData);
    const custId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    const linkCode = genLinkCode(); save("line_link_code", linkCode);
    supaRest("customers", "POST", { id: custId, name: userData.name, tel: cleanPhone, email: f.email || "", source: "online-course", line_link_code: linkCode });
    supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, email: f.email || "", status: "กำลังเรียน" });
    save("enrolled", true);
    safeTrack("register_complete", { has_email: !!f.email });
    go("lineprompt");
  };
  const field = (key, label, ph, type = "text") => (<div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label><input type={type} placeholder={ph} value={f[key]} onChange={e => { setF({...f, [key]: e.target.value}); setErr({...err, [key]: undefined}); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${err[key] ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>{err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}</div>);
  return (<div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>สมัครเรียน</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={css.card}><h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 18 }}>ข้อมูลผู้เรียน</h3>{field("name", "ชื่อ-นามสกุล *", "เช่น สมชาย ใจดี")}{field("phone", "เบอร์โทรศัพท์ *", "เช่น 081-234-5678", "tel")}{field("email", "อีเมล (ไม่บังคับ)", "เช่น name@email.com", "email")}
        <div style={{ marginTop: 8 }}><label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr({...err, pdpa: undefined}); }} style={{ marginTop: 3, width: 18, height: 18 }}/><span style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บรวบรวมและใช้ข้อมูลส่วนบุคคล (ชื่อ, เบอร์โทร, อีเมล) เพื่อจัดการหลักสูตรออนไลน์ การออกใบประกาศนียบัตร และการแจ้งข้อมูลหลักสูตร ข้อมูลจะไม่ถูกเปิดเผยต่อบุคคลภายนอก</span></label>{err.pdpa && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.pdpa}</div>}</div>
      </div>
      <button onClick={submit} style={{ ...css.btn(B.red, B.white, true), marginTop: 20 }}>{FREE_LAUNCH ? "ลงทะเบียน → เข้าเรียนเลย" : "ถัดไป → ชำระเงิน"}</button>
    </div></div>);
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

// ==================== COURSE ====================
function Course({ go, progress, setProgress, user }) {
  const [active, setActive] = useState(null); const [quiz, setQuiz] = useState(false); const [ans, setAns] = useState({}); const [result, setResult] = useState(null); const [watched, setWatched] = useState(false); const [reviewMode, setReviewMode] = useState(false); const [timer, setTimer] = useState(0); const [canWatch, setCanWatch] = useState(false); const [mustRewatch, setMustRewatch] = useState(false);
  const timerRef = useRef(null);
  const purchased = getPurchased();
  const hasMod = (id) => isModuleAccessible(id, purchased);
  const unlocked = id => hasMod(id) && (id === 1 || progress.done.includes(id - 1) || FREE_LAUNCH);
  const done = id => progress.done.includes(id);

  // Timer for video watching (70% of duration)
  useEffect(() => { if (active && !reviewMode && !done(active)) { const mod = COURSE.modules.find(m => m.id === active); if (mod && mod.dur) { const target = Math.floor(mod.dur * 0.9); setTimer(target); setCanWatch(false); timerRef.current = setInterval(() => { setTimer(prev => { if (prev <= 1) { clearInterval(timerRef.current); setCanWatch(true); return 0; } return prev - 1; }); }, 1000); } } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [active, reviewMode, mustRewatch]);

  const submitQuiz = () => {
    const mod = COURSE.modules.find(m => m.id === active); let correct = 0; mod.quiz.forEach((q, i) => { if (ans[i] === q.a) correct++; }); const score = Math.round((correct / mod.quiz.length) * 100); const passed = score >= 80; setResult({ score, correct, total: mod.quiz.length, passed });
    if (passed && !progress.done.includes(active)) { const np = { ...progress, done: [...progress.done, active], scores: { ...progress.scores, [active]: score } }; setProgress(np); save("progress", np);
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
              {result.passed ? (<button onClick={() => { resetLesson(); if (isFinal) go("certificate"); }} style={css.btn(B.green, B.white)}>{isFinal ? "รับใบประกาศนียบัตร →" : "กลับหน้าบทเรียน →"}</button>)
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
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>{COURSE.modules.map(m => { const owns = hasMod(m.id); const ok = unlocked(m.id); const dn = done(m.id); const fin = !m.vid; const needBuy = !owns && !FREE_LAUNCH && m.id <= 6; return (<button key={m.id} onClick={() => { if (needBuy) { go("store"); return; } if (!ok) return; setActive(m.id); if (fin) setQuiz(true); else if (dn) setReviewMode(true); }} style={{ display: "flex", width: "100%", gap: 12, alignItems: "center", padding: 14, marginBottom: 8, background: needBuy ? `${B.gold}06` : B.white, border: dn ? `2px solid ${B.green}` : needBuy ? `1px dashed ${B.gold}` : "2px solid transparent", borderRadius: 14, cursor: (ok || needBuy) ? "pointer" : "not-allowed", opacity: (ok || needBuy) ? 1 : .5, textAlign: "left" }}><div style={{ minWidth: 42, height: 42, borderRadius: 11, background: dn ? B.green : needBuy ? `${B.gold}18` : fin ? `${B.gold}18` : `${B.red}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>{dn ? <I name="check" size={18} color={B.white}/> : needBuy ? <I name="lock" size={16} color={B.gold}/> : !ok ? <I name="lock" size={16} color={B.dkGray}/> : fin ? <I name="cert" size={18} color={B.gold}/> : <I name="play" size={16} color={B.red}/>}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div><div style={{ fontSize: 12, color: needBuy ? B.gold : B.dkGray, marginTop: 2 }}>{dn ? (fin ? `✓ ผ่านแล้ว (${progress.scores[m.id]}%)` : `✓ ผ่านแล้ว • กดเพื่อดูวิดีโอซ้ำ`) : needBuy ? `฿${PRICING.single} — กดเพื่อซื้อ` : m.vid ? `วิดีโอ + ${m.quiz.length} คำถาม` : `${m.quiz.length} คำถาม • ต้องได้ 80%`}</div></div>{needBuy ? <span style={{ fontSize: 14, fontWeight: 700, color: B.gold }}>฿{PRICING.single}</span> : ok && !dn ? <I name="arrow" size={14} color={B.dkGray}/> : ok && dn && m.vid ? <I name="replay" size={14} color={B.green}/> : null}</button>); })}
      {!FREE_LAUNCH && purchased.filter(x => x <= 6).length < 6 && <button onClick={() => go("store")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 8, fontSize: 14 }}>ซื้อเพิ่ม / Full Course ฿{PRICING.full} →</button>}
      {pct === 100 && <button onClick={() => go("certificate")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 16 }}>ดูใบประกาศนียบัตร & คูปอง →</button>}
      {/* Mini cert per module */}
      {progress.done.filter(id => id <= 6).length > 0 && progress.done.filter(id => id <= 6).length < 7 && <button onClick={() => go("minicert")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 8, border: `1px solid ${B.ltGray}`, fontSize: 13 }}>ดูใบ Mini Certificate →</button>}
      <div style={{ marginTop: 20 }}><MorrooAdBanner/></div>
      <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?\n\nข้อมูลการเรียนจะถูกล้าง")) { ["jia_user","jia_enrolled","jia_progress","jia_coupon"].forEach(k => localStorage.removeItem(k)); window.location.reload(); }}} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 12, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
    </div>
  </div>);
}

// ==================== CERTIFICATE ====================
function Certificate({ user, go }) {
  const d = new Date(); const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  const coupon = load("coupon", null) || (() => { const c = genCoupon(); save("coupon", c); return c; })();
  const saveCert = () => { alert("กด screenshot หน้าจอเพื่อบันทึกใบประกาศนียบัตร\n\niPhone: กดปุ่ม Power + Volume Up\nAndroid: กดปุ่ม Power + Volume Down\n\nรหัสคูปอง: " + coupon); };
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><I name="star" size={38} color={B.gold}/></div><h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>ยินดีด้วย!</h2><p style={{ fontSize: 14, color: B.dkGray }}>คุณผ่านคอร์ส CPR & AED ออนไลน์แล้ว</p></div>
    <div style={{ background: B.white, borderRadius: 20, padding: 4, boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}><div style={{ border: `3px solid ${B.gold}`, borderRadius: 16, padding: "32px 20px", textAlign: "center", background: "linear-gradient(180deg, #FFFEF7 0%, #FFFFFF 100%)" }}>
      {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((p, i) => (<div key={i} style={{ position: "absolute", ...p, width: 18, height: 18 }}/>))}
      <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: B.red, fontWeight: 700, marginBottom: 4 }}>JIA TRAINER CENTER</div>
      <div style={{ fontSize: 10, color: B.dkGray, marginBottom: 16 }}>ศูนย์ฝึกอบรม CPR & AED มาตรฐาน 2025</div>
      <div style={{ margin: "0 auto 12px", width: 48, height: 48, borderRadius: "50%", background: `${B.gold}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><I name="cert" size={28} color={B.gold}/></div>
      <div style={{ fontSize: 20, fontWeight: 300, color: B.dkGray, marginBottom: 3 }}>ใบประกาศนียบัตร</div>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 16 }}>CERTIFICATE OF COMPLETION</div>
      <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>มอบให้แก่</div>
      <div style={{ fontSize: 24, fontWeight: 700, borderBottom: `2px solid ${B.gold}40`, paddingBottom: 8, display: "inline-block", minWidth: 180, marginBottom: 12 }}>{user?.name || "ชื่อผู้เรียน"}</div>
      <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.6 }}>ผ่านหลักสูตร<br/><strong style={{ fontSize: 13 }}>การช่วยชีวิตขั้นพื้นฐาน CPR & AED ออนไลน์</strong><br/>มาตรฐาน 2025</div>
      <div style={{ marginTop: 14, fontSize: 12, color: B.dkGray }}>วันที่ {ds}</div>
      <div style={{ marginTop: 16, background: `${B.red}08`, borderRadius: 10, padding: "10px 16px", border: `1px dashed ${B.red}40` }}><div style={{ fontSize: 10, color: B.dkGray, marginBottom: 4 }}>รหัสคูปองส่วนลด ฿100</div><div style={{ fontSize: 20, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace" }}>{coupon}</div><div style={{ fontSize: 10, color: B.dkGray, marginTop: 4 }}>แจ้งรหัสนี้เมื่อมาเรียน on-site</div></div>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${B.ltGray}`, fontSize: 10, color: B.dkGray }}>088-558-8078 | jiacpr.com | LINE: @jiacpr</div>
    </div></div>
    <button onClick={saveCert} style={{ ...css.btn(B.black, B.white, true), marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><I name="save" size={18} color={B.white}/> บันทึกใบประกาศนียบัตร</button>
    {!load("line_added", false) && (() => {
      const lc = getLinkCode();
      return (
        <div style={{ background: "#06C75510", border: "2px solid #06C75540", borderRadius: 16, padding: 18, marginTop: 16, textAlign: "center" }}>
          <I name="line" size={32} color="#06C755"/>
          <div style={{ fontSize: 15, fontWeight: 700, color: B.black, margin: "8px 0 4px" }}>อย่าลืม! เพิ่ม LINE @jiacpr</div>
          <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>รับเตือนทบทวนทุก 3 เดือน + โปรต่ออายุ Cert</div>
          <a href={lineLinkDeepLink(lc)} target="_blank" rel="noopener noreferrer"
             onClick={() => { safeTrack("line_oa_clicked", { variant: "certificate", has_link_code: true }); markLineAdded(user); }}
             style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
            <I name="line" size={22} color={B.white}/> เพิ่มเพื่อน + ผูกบัญชีอัตโนมัติ
          </a>
          <div style={{ fontSize: 10, color: B.dkGray, marginTop: 8, lineHeight: 1.5 }}>
            (LINE จะเด้งข้อความ <strong style={{ fontFamily: "monospace", color: B.red }}>JIA-LINK-{lc}</strong> → กดส่งเพื่อผูกบัญชี)
          </div>
        </div>
      );
    })()}
    <div style={{ background: `${B.red}08`, borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: B.red, marginBottom: 4 }}>คูปองส่วนลด ฿100 สำหรับคอร์ส On-site!</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{coupon}</div>
      <button onClick={() => go("booking")} style={{ ...css.btn(B.red, B.white, true), display: "block", width: "100%", textAlign: "center", cursor: "pointer" }}>จองคอร์ส On-site ใช้คูปองส่วนลด →</button>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={() => safeTrack("line_oa_clicked", { variant: "certificate-inquire" })} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, background: "#06C755", borderRadius: 12, padding: "12px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={22} color={B.white}/> สอบถามทาง LINE @jiacpr</a>
    </div>
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
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: B.dkGray, fontSize: 14, marginBottom: 16 }}><I name="back" size={18} color={B.dkGray}/> กลับ</button>
    <h2 style={{ fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 20 }}>Mini Certificate</h2>
    {completed.map(m => (
      <div key={m.id} style={{ background: B.white, borderRadius: 16, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,.08)", marginBottom: 20 }}>
        <div style={{ border: `2px solid ${B.gold}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", background: "linear-gradient(180deg, #FFFEF7 0%, #FFFFFF 100%)" }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: B.red, fontWeight: 700, marginBottom: 4 }}>JIA TRAINER CENTER</div>
          <div style={{ margin: "0 auto 8px", width: 36, height: 36, borderRadius: "50%", background: `${B.gold}15`, display: "flex", alignItems: "center", justifyContent: "center" }}><I name="cert" size={20} color={B.gold}/></div>
          <div style={{ fontSize: 14, fontWeight: 300, color: B.dkGray }}>Mini Certificate</div>
          <div style={{ fontSize: 16, fontWeight: 700, margin: "6px 0", color: B.black }}>{m.short}</div>
          <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>มอบให้แก่</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{user?.name || "ชื่อผู้เรียน"}</div>
          <div style={{ fontSize: 11, color: B.dkGray }}>คะแนน: {progress.scores[m.id]}% • วันที่ {ds}</div>
        </div>
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
  const [stats, setStats] = useState({ total: 0, finished: 0, in_progress: 0, customers: 0, bookings: 0 });

  const currentTab = TABS.find(t => t.key === tab);
  const isCustomTab = !!currentTab?.custom;

  const fetchTab = useCallback(async (key) => {
    const t = TABS.find(x => x.key === key);
    if (t?.custom) { setRows([]); return; }
    setLoading(true);
    const orderCol = key === "online_students" ? "registered_at"
      : key === "bookings" || key === "customers" ? "created_at"
      : key === "sales_tracking" ? "completed_date"
      : "id";
    const data = await supaRest(key, "GET", null, `?order=${orderCol}.desc.nullslast&limit=1000`);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const [students, customers, bookings] = await Promise.all([
      supaRest("online_students", "GET", null, "?select=status"),
      supaRest("customers", "GET", null, "?select=id&limit=10000"),
      supaRest("bookings", "GET", null, "?select=id&limit=10000"),
    ]);
    const s = Array.isArray(students) ? students : [];
    setStats({
      total: s.length,
      finished: s.filter(x => (x.status || "").startsWith("จบคอร์ส")).length,
      in_progress: s.filter(x => x.status === "กำลังเรียน").length,
      customers: Array.isArray(customers) ? customers.length : 0,
      bookings: Array.isArray(bookings) ? bookings.length : 0,
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
      const hay = [r.name, r.phone, r.tel, r.email, r.coupon_code].filter(Boolean).join(" ").toLowerCase();
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
            { label: "จบคอร์สแล้ว", value: stats.finished, color: B.green },
            { label: "กำลังเรียน", value: stats.in_progress, color: B.gold },
            { label: "ลูกค้าทั้งหมด", value: stats.customers, color: B.black },
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
                  {filtered.map((r, i) => (
                    <tr key={r.id || i} style={{ borderBottom: `1px solid ${B.ltGray}` }}>
                      {currentTab.cols.map(c => (
                        <td key={c} style={{ padding: "10px 12px", verticalAlign: "top" }}>{fmt(r[c])}</td>
                      ))}
                    </tr>
                  ))}
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
  const isAdmin = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";
  const [page, setPage] = useState(() => load("enrolled", false) ? "course" : "landing");
  const [user, setUser] = useState(() => load("user", null));
  const [progress, setProgress] = useState(() => load("progress", { done: [], scores: {} }));
  const go = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);

  // Handle Stripe success redirect
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
          case "landing": return <Landing go={go}/>;
          case "register": return <Register go={go} setUser={u => { setUser(u); save("user", u); }}/>;
          case "lineprompt": return <LineAddPrompt go={go} user={user} variant="post-register"/>;
          case "payment": return <Payment go={go} user={user}/>;
          case "store": return <Store go={go}/>;
          case "course": return <Course go={go} progress={progress} setProgress={p => { setProgress(p); save("progress", p); }} user={user}/>;
          case "certificate": return <Certificate user={user} go={go}/>;
          case "minicert": return <MiniCert user={user} go={go}/>;
          case "booking": return <Booking go={go}/>;
          default: return <Landing go={go}/>;
        }
      })()}
      <Analytics />
    </>
  );
}
