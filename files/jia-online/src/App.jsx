import { useState, useEffect, useCallback, useRef } from "react";

// ==================== BRAND ====================
const B = { red: "#C8102E", dkRed: "#9B0020", black: "#1A1A1A", white: "#FFFFFF", cream: "#FFF8F0", gray: "#F5F5F5", ltGray: "#E8E8E8", dkGray: "#666", green: "#22C55E", gold: "#F59E0B" };

// ========== CONFIG ==========
const FREE_LAUNCH = true;
const LAUNCH_END = "30 เมษายน 2569";
const LINE_URL = "https://line.me/R/ti/p/@jiacpr";
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxSNte5rBWi7SmHxaDBaU9h_-URJo7wymLzKR2CRgBON9ed3GxOx72kXNcypQy-X9aNuw/exec";

const sendToSheet = (data) => { if (!SHEET_URL) return; try { const url = SHEET_URL + "?data=" + encodeURIComponent(JSON.stringify(data)); fetch(url, { mode: "no-cors" }); console.log("Sheet sent:", data.action, data.name); } catch (e) { console.log("Sheet:", e); } };
const genCoupon = () => { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let r = "JIA-"; for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]; return r; };
const save = (k, v) => { try { localStorage.setItem(`jia_${k}`, JSON.stringify(v)); } catch(e){} };
const load = (k, d) => { try { const v = localStorage.getItem(`jia_${k}`); return v ? JSON.parse(v) : d; } catch(e){ return d; } };

// ========== COURSE DATA ==========
const COURSE = { title: "CPR & AED ออนไลน์", price: FREE_LAUNCH ? 0 : 100, modules: [
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

// ==================== LANDING ====================
function Landing({ go }) {
  const [a, setA] = useState(false); useEffect(() => { setTimeout(() => setA(true), 100); }, []);
  return (<div style={css.page}>
    <div style={{ background: `linear-gradient(135deg, ${B.red} 0%, ${B.dkRed} 100%)`, color: B.white, padding: "52px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.06)" }}/>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", opacity: a ? 1 : 0, transform: a ? "translateY(0)" : "translateY(20px)", transition: "all .6s ease" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: .85, marginBottom: 8, fontWeight: 600 }}>JIA TRAINER CENTER</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>คอร์ส CPR & AED</h1>
        <h2 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 16px", opacity: .95 }}>ออนไลน์</h2>
        {FREE_LAUNCH && <div style={{ display: "inline-block", background: B.gold, color: B.black, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>เรียนฟรี! เดือนแรกเท่านั้น</div>}
        <p style={{ fontSize: 14, opacity: .9, lineHeight: 1.7, marginBottom: 28 }}>เรียนรู้การช่วยชีวิตขั้นพื้นฐาน มาตรฐาน 2025<br/>ดูวิดีโอ • ทำแบบทดสอบ • รับใบประกาศนียบัตร</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.15)", borderRadius: 16, padding: "14px 28px", marginBottom: 28 }}>
          {FREE_LAUNCH ? (<><span style={{ fontSize: 44, fontWeight: 800 }}>ฟรี!</span><div style={{ textAlign: "left", fontSize: 12 }}><div style={{ textDecoration: "line-through", opacity: .7 }}>ปกติ ฿100</div><div style={{ opacity: .85 }}>+ คูปองส่วนลด ฿100</div></div></>) : (<><span style={{ fontSize: 44, fontWeight: 800 }}>฿100</span></>)}
        </div>
        <div><button onClick={() => go("register")} style={{ ...css.btn(B.white, B.red), padding: "16px 52px", fontSize: 16 }}>{FREE_LAUNCH ? "ลงทะเบียนเรียนฟรี →" : "สมัครเรียนเลย →"}</button></div>
      </div>
    </div>
    <div style={{ ...css.wrap, paddingTop: 36, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เรียนอะไรบ้าง?</h3>
      {COURSE.modules.slice(0, 6).map((m, i) => (<div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12, background: B.white, borderRadius: 14, padding: "14px 16px" }}><div style={{ minWidth: 38, height: 38, borderRadius: 10, background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", color: B.red, fontWeight: 800, fontSize: 15 }}>{String(i + 1).padStart(2, "0")}</div><div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.short}</div><div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>{m.desc}</div></div></div>))}
      <div style={{ background: `${B.gold}18`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 4 }}><I name="cert" size={26} color={B.gold}/><div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>+ แบบทดสอบสุดท้าย & ใบประกาศนียบัตร</div></div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 24 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 24, border: `1px solid ${B.red}12` }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}><h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>ทำไมต้องเรียน CPR?</h3><p style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ข้อมูลจากงานวิจัย</p></div>
        {[{ n: "10%", c: B.red, t: "ทุก 1 นาทีที่ไม่ได้ทำ CPR\nโอกาสรอดชีวิตลดลง 10%" }, { n: "3-6 เดือน", c: B.gold, t: "ทักษะ CPR เสื่อมลง\nภายใน 3-6 เดือนหลังอบรม" }, { n: "58%", c: B.green, t: "ผู้ทบทวนทุกเดือนทำได้ \"ดีเยี่ยม\"\nเทียบกับ 15% ที่ทบทวนปีละครั้ง" }].map((r, i) => (<div key={i} style={{ background: `${r.c}08`, borderRadius: 12, padding: 14, marginBottom: 14, borderLeft: `4px solid ${r.c}` }}><div style={{ fontSize: 28, fontWeight: 800, color: r.c }}>{r.n}</div><div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.t}</div></div>))}
      </div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 100 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{[{ icon: "play", l: "6 วิดีโอ", s: "เรียนได้ทุกที่" },{ icon: "book", l: "Quiz ทุกบท", s: "ทดสอบความเข้าใจ" },{ icon: "cert", l: "ใบประกาศฯ", s: "มาตรฐาน 2025" },{ icon: "heart", l: "คูปอง ฿100", s: "ใช้ตอนเรียน on-site" }].map((f, i) => (<div key={i} style={{ background: B.white, borderRadius: 14, padding: 16, textAlign: "center" }}><I name={f.icon} size={22} color={B.red}/><div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{f.l}</div><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{f.s}</div></div>))}</div></div>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.08)", zIndex: 100 }}><div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, color: B.dkGray }}>{FREE_LAUNCH ? "ช่วง Launch พิเศษ" : "ราคา"}</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{FREE_LAUNCH ? "ฟรี!" : "฿100"}</div></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => { const txt = "เรียน CPR & AED ออนไลน์ฟรี! ได้ใบ Certificate + คูปองส่วนลด"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://jiacpr.com/online" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://jiacpr.com/online") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn(B.white, B.red), padding: "10px 14px", border: `1px solid ${B.red}30`, fontSize: 13 }}>แชร์</button><button onClick={() => go("register")} style={css.btn(B.red, B.white)}>{FREE_LAUNCH ? "เรียนฟรี" : "สมัครเรียน"}</button></div></div></div>
  </div>);
}

// ==================== REGISTER (+ PDPA) ====================
function Register({ go, setUser }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" }); const [err, setErr] = useState({}); const [pdpa, setPdpa] = useState(false);
  const submit = () => {
    const e = {}; if (!f.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล"; if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง"; if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนลงทะเบียน"; if (Object.keys(e).length) return setErr(e);
    const cleanPhone = f.phone.replace(/\D/g, "");
    const userData = { name: f.name.trim(), phone: cleanPhone, email: f.email };
    setUser(userData); save("user", userData); sendToSheet({ action: "register", name: userData.name, phone: cleanPhone, email: f.email });
    if (FREE_LAUNCH) { save("enrolled", true); go("course"); } else go("payment");
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
        const res = await fetch(JIA_COURSE_API + "?action=uploadSlip", {
          method: "POST", headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ base64: reader.result, fileName: (u?.name || "student") + "_online.jpg", bookingId: "online_" + Date.now() })
        });
        const data = await res.json();
        if (data.success) {
          // แจ้งทีม
          sendToSheet({ action: "payment", name: u?.name || "", phone: u?.phone || "", amount: 100, slipUrl: data.url });
          setSlipDone(true);
          // ให้เข้าเรียนได้เลย (ทีมตรวจทีหลัง)
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
  const unlocked = id => id === 1 || progress.done.includes(id - 1); const done = id => progress.done.includes(id);

  // Timer for video watching (70% of duration)
  useEffect(() => { if (active && !reviewMode && !done(active)) { const mod = COURSE.modules.find(m => m.id === active); if (mod && mod.dur) { const target = Math.floor(mod.dur * 0.9); setTimer(target); setCanWatch(false); timerRef.current = setInterval(() => { setTimer(prev => { if (prev <= 1) { clearInterval(timerRef.current); setCanWatch(true); return 0; } return prev - 1; }); }, 1000); } } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [active, reviewMode, mustRewatch]);

  const submitQuiz = () => {
    const mod = COURSE.modules.find(m => m.id === active); let correct = 0; mod.quiz.forEach((q, i) => { if (ans[i] === q.a) correct++; }); const score = Math.round((correct / mod.quiz.length) * 100); const passed = score >= 80; setResult({ score, correct, total: mod.quiz.length, passed });
    if (passed && !progress.done.includes(active)) { const np = { ...progress, done: [...progress.done, active], scores: { ...progress.scores, [active]: score } }; setProgress(np); save("progress", np);
      if (!mod.vid && mod.id === COURSE.modules[COURSE.modules.length - 1].id) { 
        const u = user || load("user", null);
        const coupon = genCoupon(); save("coupon", coupon); 
        if (u) sendToSheet({ action: "complete", name: u.name, phone: u.phone.replace(/\D/g, ""), coupon, score }); 
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
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>{COURSE.modules.map(m => { const ok = unlocked(m.id), dn = done(m.id), fin = !m.vid; return (<button key={m.id} onClick={() => { if (!ok) return; setActive(m.id); if (fin) setQuiz(true); else if (dn) setReviewMode(true); }} style={{ display: "flex", width: "100%", gap: 12, alignItems: "center", padding: 14, marginBottom: 8, background: B.white, border: dn ? `2px solid ${B.green}` : "2px solid transparent", borderRadius: 14, cursor: ok ? "pointer" : "not-allowed", opacity: ok ? 1 : .5, textAlign: "left" }}><div style={{ minWidth: 42, height: 42, borderRadius: 11, background: dn ? B.green : fin ? `${B.gold}18` : `${B.red}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>{dn ? <I name="check" size={18} color={B.white}/> : !ok ? <I name="lock" size={16} color={B.dkGray}/> : fin ? <I name="cert" size={18} color={B.gold}/> : <I name="play" size={16} color={B.red}/>}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div><div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>{dn ? (fin ? `✓ ผ่านแล้ว (${progress.scores[m.id]}%)` : `✓ ผ่านแล้ว • กดเพื่อดูวิดีโอซ้ำ`) : m.vid ? `วิดีโอ + ${m.quiz.length} คำถาม` : `${m.quiz.length} คำถาม • ต้องได้ 80%`}</div></div>{ok && !dn && <I name="arrow" size={14} color={B.dkGray}/>}{ok && dn && m.vid && <I name="replay" size={14} color={B.green}/>}</button>); })}
      {pct === 100 && <button onClick={() => go("certificate")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 16 }}>ดูใบประกาศนียบัตร & คูปอง →</button>}
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
    <div style={{ background: `${B.red}08`, borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: B.red, marginBottom: 4 }}>คูปองส่วนลด ฿100 สำหรับคอร์ส On-site!</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{coupon}</div>
      <button onClick={() => go("booking")} style={{ ...css.btn(B.red, B.white, true), display: "block", width: "100%", textAlign: "center", cursor: "pointer" }}>จองคอร์ส On-site ใช้คูปองส่วนลด →</button>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, background: "#06C755", borderRadius: 12, padding: "12px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={22} color={B.white}/> สอบถามทาง LINE @jiacpr</a>
    </div>
    <button onClick={() => { const txt = "ฉันผ่านคอร์ส CPR & AED ออนไลน์แล้ว! เรียนฟรีที่ jiacpr.com/online"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://jiacpr.com/online" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://jiacpr.com/online") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn("#06C755", B.white, true), marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>แชร์ให้เพื่อนเรียนด้วย</button>
    <button onClick={() => go("course")} style={{ ...css.btn(B.white, B.black, true), marginTop: 10, border: `1px solid ${B.ltGray}` }}>← กลับหน้าบทเรียน</button>
    <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?")) { ["jia_user","jia_enrolled","jia_progress","jia_coupon"].forEach(k => localStorage.removeItem(k)); window.location.reload(); }}} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 8, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
  </div></div>);
}

// ==================== BOOKING ====================
const JIA_COURSE_API = "https://script.google.com/macros/s/AKfycbyAbzjf6EyBdgv_h3k72CyesYG72voz_-ss3GpiniwI8YU8JKTBi2i8bVKhpQTXamt-YA/exec";

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
    fetch(JIA_COURSE_API + "?action=getData&sheet=classes")
      .then(r => r.json())
      .then(data => {
        const now = new Date().toISOString().slice(0, 10);
        const open = (data || [])
          .filter(c => c.status === "ready" && c.date >= now)
          .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot));
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
      const customer = { id: custId, name: form.name, tel: form.phone.replace(/\D/g, ""), email: "", createdAt: today(), source: "online-course" };
      await fetch(JIA_COURSE_API + "?action=saveRow&sheet=customers", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(customer) });

      const bkId = uid();
      const booking = {
        id: bkId, customerId: custId, name: form.name, tel: form.phone.replace(/\D/g, ""),
        courseType: cls.courseKey, courseName: cls.courseName, classId: cls.id,
        channel: "online-course", package: "", totalPeople: form.people,
        finalPrice: price, discountCode: coupon || "", discountAmount: coupon ? 100 : 0,
        paymentMode: "โอน", paymentSlip: "", paymentStatus: "รอชำระ",
        startDate: cls.date, timeSlot: cls.timeSlot, totalDays: "1", additionalDates: "",
        salesStaff: "", instructor: "", note: form.note,
        pdpaConsent: true, pdpaConsentDate: today(), createdAt: today()
      };
      await fetch(JIA_COURSE_API + "?action=saveRow&sheet=bookings", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(booking) });
      fetch(JIA_COURSE_API + "?action=notifyBooking", { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(booking) }).catch(() => {});
      sendToSheet({ action: "booking", name: form.name, phone: form.phone.replace(/\D/g, ""), date: cls.date + " " + cls.timeSlot, people: form.people, note: form.note, coupon: coupon || "" });

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
        const base64 = reader.result;
        // อัพโหลดสลิปไป Google Drive ผ่าน JIA Course API
        const res = await fetch(JIA_COURSE_API + "?action=uploadSlip", {
          method: "POST", headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ base64, fileName: form.name + "_slip.jpg", bookingId: bookingRef })
        });
        const data = await res.json();
        if (data.success && data.url) {
          // อัพเดท booking ใส่ slip URL + เปลี่ยนสถานะ
          await fetch(JIA_COURSE_API + "?action=saveRow&sheet=bookings", {
            method: "POST", headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ id: bookingRef, paymentSlip: data.url, paymentStatus: "แจ้งชำระแล้ว" })
          });
          // แจ้งเตือนชำระเงิน
          fetch(JIA_COURSE_API + "?action=notifyPayment", {
            method: "POST", headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ bookingId: bookingRef, name: form.name, slipUrl: data.url })
          }).catch(() => {});
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
      {cls && <div style={{ background: B.gray, borderRadius: 12, padding: 14, marginTop: 16, fontSize: 14 }}><strong>{fmtDate(cls.date)}</strong> • {cls.timeSlot}<br/><span style={{ color: B.dkGray, fontSize: 13 }}>{cls.courseName}</span></div>}
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
        <div style={{ fontWeight: 700, fontSize: 15 }}>{fmtDate(cls.date)} • {cls.timeSlot}</div>
        <div style={{ fontSize: 13, color: B.dkGray }}>{cls.courseName} • {form.people} คน</div>
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
                <div style={{ fontWeight: 600, fontSize: 14, color: selectedClass === c.id ? B.red : B.black }}>{fmtDate(c.date)} • {c.timeSlot}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>{c.courseName}{c.place ? ` • ${c.place}` : ""}</div>
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

// ==================== APP ====================
export default function App() {
  const [page, setPage] = useState(() => load("enrolled", false) ? "course" : "landing");
  const [user, setUser] = useState(() => load("user", null));
  const [progress, setProgress] = useState(() => load("progress", { done: [], scores: {} }));
  const go = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);
  switch (page) {
    case "landing": return <Landing go={go}/>;
    case "register": return <Register go={go} setUser={u => { setUser(u); save("user", u); }}/>;
    case "payment": return <Payment go={go} user={user}/>;
    case "course": return <Course go={go} progress={progress} setProgress={p => { setProgress(p); save("progress", p); }} user={user}/>;
    case "certificate": return <Certificate user={user} go={go}/>;
    case "booking": return <Booking go={go}/>;
    default: return <Landing go={go}/>;
  }
}
