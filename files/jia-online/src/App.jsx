import { useState, useEffect, useCallback } from "react";

// ==================== BRAND & CONFIG ====================
const B = {
  red: "#C8102E", dkRed: "#9B0020", black: "#1A1A1A", white: "#FFFFFF",
  cream: "#FFF8F0", gray: "#F5F5F5", ltGray: "#E8E8E8", dkGray: "#666",
  green: "#22C55E", gold: "#F59E0B",
};

// ========== LAUNCH MODE ==========
// เปลี่ยนเป็น false เมื่อหมดช่วง Launch ฟรี
const FREE_LAUNCH = true;
const LAUNCH_BADGE = "เรียนฟรี! เดือนแรกเท่านั้น";
const LAUNCH_END = "30 เมษายน 2569"; // วันสิ้นสุด Launch

// ========== GOOGLE SHEETS ==========
// ใส่ URL จาก Google Apps Script Deploy (ดูคู่มือ JIA_Google_Sheets_Setup_Guide.md)
const SHEET_URL = "https://script.google.com/macros/s/AKfycbxSNte5rBWi7SmHxaDBaU9h_-URJo7wymLzKR2CRgBON9ed3GxOx72kXNcypQy-X9aNuw/exec";

// ฟังก์ชันส่งข้อมูลไป Google Sheets
const sendToSheet = async (data) => {
  if (!SHEET_URL) return; // ยังไม่ได้ตั้งค่า ข้ามไปก่อน
  try {
    await fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    console.log("Sheet sync:", e);
  }
};

const COURSE = {
  title: "CPR & AED ออนไลน์",
  price: FREE_LAUNCH ? 0 : 100,
  modules: [
    {
      id: 1,
      title: "บทที่ 1: CPR ผู้ใหญ่",
      short: "CPR ผู้ใหญ่",
      desc: "เทคนิคกดหน้าอก เปิดทางเดินหายใจ ช่วยหายใจสำหรับผู้ใหญ่",
      dur: null, // ใส่ความยาวจริงตอน deploy เช่น "8:32"
      quiz: [
        { q: "ตำแหน่งวางมือกดหน้าอกผู้ใหญ่คือที่ไหน?", c: ["กลางหน้าอก บนกระดูกหน้าอก", "ด้านซ้ายของหน้าอก", "ใต้ลิ้นปี่", "บนท้อง"], a: 0 },
        { q: "ความลึกในการกดหน้าอกผู้ใหญ่คือเท่าไร?", c: ["อย่างน้อย 3 ซม.", "อย่างน้อย 5 ซม.", "อย่างน้อย 7 ซม.", "อย่างน้อย 10 ซม."], a: 1 },
        { q: "อัตราการกดหน้าอกที่ถูกต้องคือกี่ครั้ง/นาที?", c: ["80-100", "100-120", "120-140", "60-80"], a: 1 },
        { q: "อัตราส่วนกดหน้าอก:ช่วยหายใจ ในผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "30:1"], a: 1 },
        { q: "ท่า Head-tilt Chin-lift ทำอย่างไร?", c: ["กดหน้าผากลง ยกคาง", "เอียงศีรษะไปด้านข้าง", "ดันขากรรไกรขึ้น", "ก้มหน้าลง"], a: 0 },
      ],
    },
    {
      id: 2,
      title: "บทที่ 2: CPR ทารก",
      short: "CPR ทารก",
      desc: "เทคนิค CPR สำหรับทารก ความแตกต่างจากผู้ใหญ่",
      dur: null,
      quiz: [
        { q: "CPR ทารก ใช้อะไรกดหน้าอก?", c: ["ฝ่ามือ 2 ข้าง", "นิ้ว 2 นิ้ว", "กำปั้น", "ฝ่ามือ 1 ข้าง"], a: 3 },
        { q: "ความลึกในการกดหน้าอกทารกคือเท่าไร?", c: ["อย่างน้อย 2 ซม.", "อย่างน้อย 4 ซม. (ประมาณ 1.5 นิ้ว)", "อย่างน้อย 5 ซม.", "อย่างน้อย 1 ซม."], a: 1 },
        { q: "ตำแหน่งกดหน้าอกทารกอยู่ที่ไหน?", c: ["กลางหน้าอก ใต้แนวหัวนมเล็กน้อย", "ด้านซ้ายหน้าอก", "บนท้อง", "ที่คอ"], a: 0 },
        { q: "สาเหตุหัวใจหยุดเต้นในทารกที่พบบ่อยที่สุด?", c: ["หัวใจวาย", "ปัญหาทางเดินหายใจ", "ไฟฟ้าช็อก", "อุบัติเหตุทางรถ"], a: 1 },
        { q: "การช่วยหายใจทารก ต้องเป่าลมแบบไหน?", c: ["เป่าเต็มปอด", "เป่าเบาๆ พอเห็นหน้าอกยกขึ้น", "เป่าแรงและเร็ว", "ไม่ต้องช่วยหายใจ"], a: 1 },
      ],
    },
    {
      id: 3,
      title: "บทที่ 3: สิ่งอุดกั้นทางเดินหายใจ ผู้ใหญ่",
      short: "Choking ผู้ใหญ่",
      desc: "วิธีช่วยเหลือผู้ใหญ่ที่มีสิ่งอุดกั้นทางเดินหายใจ (Heimlich Maneuver)",
      dur: null,
      quiz: [
        { q: "อาการสำลักขั้นรุนแรง (Severe Choking) สังเกตอย่างไร?", c: ["ไอได้เสียงดัง", "พูดไม่ออก ไอไม่มีเสียง หายใจไม่ได้", "หน้าแดง แต่ยังพูดได้", "เจ็บคอเล็กน้อย"], a: 1 },
        { q: "Heimlich Maneuver ทำอย่างไร?", c: ["ตบหลัง 5 ครั้ง แล้วกดท้อง 5 ครั้ง", "กดหน้าอกอย่างเดียว", "เป่าปาก", "ให้ดื่มน้ำ"], a: 0 },
        { q: "ตำแหน่งกดท้อง (Abdominal Thrust) อยู่ที่ไหน?", c: ["ใต้ลิ้นปี่ เหนือสะดือ", "กลางหน้าอก", "ที่สะดือพอดี", "ใต้สะดือ"], a: 0 },
        { q: "ถ้าผู้ป่วยสำลักจนหมดสติ ต้องทำอย่างไร?", c: ["ทำ Heimlich ต่อ", "วางนอน เริ่มทำ CPR", "ให้ดื่มน้ำ", "นั่งรอรถพยาบาล"], a: 1 },
      ],
    },
    {
      id: 4,
      title: "บทที่ 4: สิ่งอุดกั้นทางเดินหายใจ ทารก",
      short: "Choking ทารก",
      desc: "วิธีช่วยเหลือทารกที่มีสิ่งอุดกั้นทางเดินหายใจ",
      dur: null,
      quiz: [
        { q: "ท่าช่วยทารกสำลัก ต้องจับทารกอย่างไร?", c: ["อุ้มตั้งขึ้น", "คว่ำหน้าวางบนแขน ศีรษะต่ำกว่าลำตัว", "วางนอนหงายบนพื้น", "จับตั้งศีรษะขึ้น"], a: 1 },
        { q: "ตบหลังทารกที่สำลัก ตบตรงไหน?", c: ["ตบกลางหลัง ระหว่างสะบักทั้ง 2 ข้าง", "ตบที่ศีรษะ", "ตบที่ก้น", "ตบที่ท้อง"], a: 0 },
        { q: "ตบหลัง 5 ครั้งแล้วยังไม่ออก ทำอะไรต่อ?", c: ["ตบหลังต่อ", "พลิกหงาย กดหน้าอก 5 ครั้ง", "ใช้นิ้วล้วงคอ", "เป่าปาก"], a: 1 },
        { q: "ห้ามใช้ Heimlich Maneuver (กดท้อง) กับทารก เพราะอะไร?", c: ["ทารกตัวเล็กเกินไป", "อาจทำให้อวัยวะภายในบาดเจ็บ", "ไม่ได้ผล", "ทารกจะร้องไห้"], a: 1 },
      ],
    },
    {
      id: 5,
      title: "บทที่ 5: Megacode — CPR & AED ผู้ใหญ่",
      short: "CPR & AED ผู้ใหญ่ (Megacode)",
      desc: "ฝึกปฏิบัติ CPR ร่วมกับเครื่อง AED แบบครบขั้นตอนสำหรับผู้ใหญ่",
      dur: null,
      quiz: [
        { q: "เมื่อเครื่อง AED มาถึง สิ่งแรกที่ต้องทำคืออะไร?", c: ["หยุด CPR ทันที", "เปิดเครื่อง AED แล้วทำตามคำสั่งเสียง", "ถอดเสื้อผู้ป่วยก่อน", "รอหมอมา"], a: 1 },
        { q: "ก่อนติดแผ่น AED ต้องทำอะไรกับหน้าอก?", c: ["ทาแอลกอฮอล์", "เช็ดให้แห้ง เปิดเสื้อออก", "ไม่ต้องทำอะไร", "ทาเจลนำไฟฟ้า"], a: 1 },
        { q: "ขณะ AED วิเคราะห์จังหวะหัวใจ ต้องทำอย่างไร?", c: ["กด CPR ต่อ", "หยุดสัมผัสผู้ป่วย — ห้ามแตะ", "ถอดแผ่น Pad", "เขย่าตัวผู้ป่วย"], a: 1 },
        { q: "หลัง AED ช็อกไฟฟ้าแล้ว ทำอะไรทันที?", c: ["รอดูอาการ 2 นาที", "เริ่มกด CPR ต่อทันที", "ถอดแผ่น Pad ออก", "ปิดเครื่อง AED"], a: 1 },
        { q: "ตำแหน่งติดแผ่น AED ผู้ใหญ่ที่ถูกต้อง?", c: ["แผ่นขวาใต้กระดูกไหปลาร้า + แผ่นซ้ายใต้รักแร้", "ทั้ง 2 แผ่นบนหน้าอก", "แผ่นบนหน้าผาก + แผ่นบนหน้าอก", "แผ่นบนท้อง 2 แผ่น"], a: 0 },
      ],
    },
    {
      id: 6,
      title: "บทที่ 6: Megacode — CPR & AED ทารก",
      short: "CPR & AED ทารก (Megacode)",
      desc: "ฝึกปฏิบัติ CPR ร่วมกับเครื่อง AED แบบครบขั้นตอนสำหรับทารก",
      dur: null,
      quiz: [
        { q: "แผ่น AED สำหรับทารกต้องใช้แบบไหน?", c: ["แบบผู้ใหญ่ได้เลย", "แบบเด็ก (Pediatric Pad) ถ้ามี", "ไม่ควรใช้ AED กับทารก", "ใช้แผ่นเล็กแบบไหนก็ได้"], a: 1 },
        { q: "ถ้ามีแต่แผ่น AED ผู้ใหญ่ ใช้กับทารกได้ไหม?", c: ["ได้ แต่ต้องวางไม่ให้แผ่นทับกัน", "ไม่ได้เด็ดขาด", "ได้ แต่ต้องตัดแผ่นให้เล็กลง", "ได้ วางซ้อนกันได้"], a: 0 },
        { q: "ตำแหน่งแผ่น AED ทารก ถ้าแผ่นใหญ่เกินไป?", c: ["วางหน้า-หลัง (แผ่นหนึ่งหน้าอก แผ่นหนึ่งหลัง)", "วางซ้อนกันบนหน้าอก", "วางบนท้อง 2 แผ่น", "ห้ามใช้"], a: 0 },
        { q: "ในการทำ Megacode ทารก ลำดับที่ถูกต้องคือ?", c: ["AED ก่อน แล้วค่อย CPR", "CPR 2 นาที → เปิด AED → ทำตามคำสั่ง", "โทร 1669 แล้วรอ", "ช่วยหายใจอย่างเดียว"], a: 1 },
      ],
    },
    {
      id: 7,
      title: "แบบทดสอบสุดท้าย",
      short: "Final Exam",
      desc: "ทดสอบความรู้ทั้งหมด 6 บท ต้องได้ 80% ขึ้นไปจึงผ่าน",
      dur: null,
      quiz: [
        { q: "อัตราส่วนกดหน้าอก:ช่วยหายใจ ในผู้ใหญ่?", c: ["15:2", "30:2", "15:1", "5:1"], a: 1 },
        { q: "ความเร็วการกดหน้าอกที่ถูกต้อง?", c: ["60-80 ครั้ง/นาที", "80-100 ครั้ง/นาที", "100-120 ครั้ง/นาที", "120-150 ครั้ง/นาที"], a: 2 },
        { q: "CPR ทารก ใช้อะไรกดหน้าอก?", c: ["นิ้ว 2 นิ้ว", "ฝ่ามือ 2 ข้าง", "กำปั้น", "ฝ่ามือ 1 ข้าง"], a: 3 },
        { q: "ผู้ใหญ่สำลักขั้นรุนแรง ต้องทำอะไรก่อน?", c: ["ให้ดื่มน้ำ", "ตบหลัง 5 ครั้ง", "กดท้อง Heimlich ทันที", "เป่าปาก"], a: 1 },
        { q: "ห้ามกดท้อง (Heimlich) กับใคร?", c: ["ผู้ใหญ่", "ทารก", "วัยรุ่น", "ผู้สูงอายุ"], a: 1 },
        { q: "AED ย่อมาจากอะไร?", c: ["Automated External Defibrillator", "Automatic Electric Defibrillator", "Advanced Emergency Device", "Auto External Device"], a: 0 },
        { q: "หลัง AED ช็อกไฟฟ้า ทำอะไรทันที?", c: ["รอดูอาการ", "กด CPR ต่อทันที", "ถอดแผ่น Pad", "ปิดเครื่อง"], a: 1 },
        { q: "แผ่น AED ทารก ถ้าแผ่นใหญ่เกินหน้าอก วางแบบไหน?", c: ["วางหน้า-หลัง", "วางซ้อนกัน", "ตัดแผ่นให้เล็กลง", "ห้ามใช้"], a: 0 },
        { q: "ทารกสำลัก จับท่าไหน?", c: ["อุ้มตั้งขึ้น", "คว่ำหน้าบนแขน ศีรษะต่ำกว่าลำตัว", "วางนอนหงาย", "จับยืน"], a: 1 },
        { q: "ทุก 1 นาทีที่ไม่ได้ทำ CPR โอกาสรอดลดลงกี่ %?", c: ["5%", "7%", "10%", "15%"], a: 2 },
      ],
    },
  ],
};

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
  qr: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="4" height="4" rx=".5"/><rect x="20" y="14" width="2" height="2"/><rect x="14" y="20" width="2" height="2"/><rect x="20" y="20" width="2" height="2"/></svg>,
  line: (s, c) => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2C6.48 2 2 5.82 2 10.5c0 2.93 1.95 5.5 4.86 7.15-.19.67-.68 2.42-.78 2.79-.12.46.17.45.36.33.15-.1 2.38-1.62 3.35-2.28.7.1 1.43.16 2.21.16 5.52 0 10-3.82 10-8.5S17.52 2 12 2z"/></svg>,
};

const I = ({ name, size = 20, color = B.black }) => icons[name]?.(size, color) || null;

// ==================== STYLES ====================
const css = {
  btn: (bg, color, full) => ({
    background: bg, color, border: "none", borderRadius: 12, padding: "14px 32px",
    fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all .2s",
    ...(full ? { width: "100%", display: "block" } : {}),
  }),
  card: { background: B.white, borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,.06)" },
  header: (bg) => ({ background: bg, color: B.white, padding: "20px 24px", display: "flex", alignItems: "center", gap: 12 }),
  page: { minHeight: "100vh", background: B.cream },
  wrap: { maxWidth: 480, margin: "0 auto", padding: "0 20px" },
};

// ==================== SAVE/LOAD ====================
const save = (k, v) => { try { localStorage.setItem(`jia_${k}`, JSON.stringify(v)); } catch(e){} };
const load = (k, d) => { try { const v = localStorage.getItem(`jia_${k}`); return v ? JSON.parse(v) : d; } catch(e){ return d; } };

// ==================== STEP INDICATOR ====================
function Steps({ current }) {
  const steps = FREE_LAUNCH ? ["ลงทะเบียน", "เข้าเรียน"] : ["ลงทะเบียน", "ชำระเงิน", "เข้าเรียน"];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 28, justifyContent: "center", flexWrap: "wrap" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700,
            background: i < current ? B.green : i === current ? B.red : B.ltGray,
            color: i <= current ? B.white : B.dkGray,
          }}>
            {i < current ? <I name="check" size={13} color={B.white}/> : i + 1}
          </div>
          <span style={{ fontSize: 11, fontWeight: i === current ? 600 : 400, color: i <= current ? B.black : B.dkGray }}>{s}</span>
          {i < steps.length - 1 && <div style={{ width: 16, height: 1, background: B.ltGray }}/>}
        </div>
      ))}
    </div>
  );
}

// ==================== LANDING PAGE ====================
function Landing({ go }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => { setTimeout(() => setAnimate(true), 100); }, []);

  return (
    <div style={css.page}>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${B.red} 0%, ${B.dkRed} 100%)`,
        color: B.white, padding: "52px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.06)" }}/>
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.04)" }}/>
        <div style={{
          position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto",
          opacity: animate ? 1 : 0, transform: animate ? "translateY(0)" : "translateY(20px)",
          transition: "all .6s ease",
        }}>
          <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: .85, marginBottom: 8, fontWeight: 600 }}>
            JIA TRAINER CENTER
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>คอร์ส CPR & AED</h1>
          <h2 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 16px", opacity: .95 }}>ออนไลน์</h2>

          {FREE_LAUNCH && (
            <div style={{
              display: "inline-block", background: B.gold, color: B.black,
              borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800,
              marginBottom: 12, letterSpacing: 0.5,
              animation: "pulse 2s infinite",
            }}>
              เรียนฟรี! เดือนแรกเท่านั้น
            </div>
          )}

          <p style={{ fontSize: 14, opacity: .9, lineHeight: 1.7, marginBottom: 28 }}>
            เรียนรู้การช่วยชีวิตขั้นพื้นฐาน มาตรฐานสากล<br/>
            ดูวิดีโอ • ทำแบบทดสอบ • รับใบประกาศนียบัตร
          </p>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 14,
            background: "rgba(255,255,255,.15)", borderRadius: 16, padding: "14px 28px",
            backdropFilter: "blur(10px)", marginBottom: 28,
          }}>
            {FREE_LAUNCH ? (
              <>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>ฟรี!</span>
                <div style={{ textAlign: "left", fontSize: 12, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600, textDecoration: "line-through", opacity: .7 }}>ปกติ ฿100</div>
                  <div style={{ opacity: .85 }}>+ คูปองส่วนลด ฿100 ตอนมาเรียน on-site</div>
                </div>
              </>
            ) : (
              <>
                <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>฿100</span>
                <div style={{ textAlign: "left", fontSize: 12, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600 }}>เท่านั้น!</div>
                  <div style={{ opacity: .85 }}>เอาเป็นส่วนลดตอนมาเรียน on-site</div>
                </div>
              </>
            )}
          </div>
          <div>
            <button onClick={() => go("register")} style={{
              ...css.btn(B.white, B.red), padding: "16px 52px", fontSize: 16,
              boxShadow: "0 4px 24px rgba(0,0,0,.2)",
            }}>
              {FREE_LAUNCH ? "ลงทะเบียนเรียนฟรี →" : "สมัครเรียนเลย →"}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ ...css.wrap, paddingTop: 36, paddingBottom: 24 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เรียนอะไรบ้าง?</h3>
        {COURSE.modules.slice(0, 6).map((m, i) => (
          <div key={i} style={{
            display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12,
            background: B.white, borderRadius: 14, padding: "14px 16px",
            boxShadow: "0 1px 6px rgba(0,0,0,.04)",
          }}>
            <div style={{
              minWidth: 38, height: 38, borderRadius: 10, background: `${B.red}12`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: B.red, fontWeight: 800, fontSize: 15,
            }}>{String(i + 1).padStart(2, "0")}</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.short}</div>
              <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>{m.desc}</div>
            </div>
          </div>
        ))}
        <div style={{
          background: `${B.gold}18`, borderRadius: 14, padding: 16, textAlign: "center",
          border: `1px solid ${B.gold}35`, marginTop: 4,
        }}>
          <I name="cert" size={26} color={B.gold}/>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>+ แบบทดสอบสุดท้าย & ใบประกาศนียบัตร</div>
          <div style={{ fontSize: 12, color: B.dkGray, marginTop: 3 }}>ผ่าน 80% ขึ้นไป ได้รับใบรับรองมาตรฐานสากล</div>
        </div>
      </div>

      {/* Research section */}
      <div style={{ ...css.wrap, paddingBottom: 24 }}>
        <div style={{
          background: B.white, borderRadius: 16, padding: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,.06)",
          border: `1px solid ${B.red}12`,
        }}>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 44, height: 44, borderRadius: 12, background: `${B.red}10`, marginBottom: 8,
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={B.red} strokeWidth="2">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
              </svg>
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: B.black }}>
              ทำไมต้องเรียน CPR?
            </h3>
            <p style={{ fontSize: 12, color: B.dkGray, marginTop: 4, marginBottom: 0 }}>
              ข้อมูลจากงานวิจัย
            </p>
          </div>

          <div style={{
            background: `${B.red}06`, borderRadius: 12, padding: 14, marginBottom: 14,
            borderLeft: `4px solid ${B.red}`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: B.red, lineHeight: 1 }}>10%</div>
            <div style={{ fontSize: 13, color: B.black, marginTop: 4, lineHeight: 1.5 }}>
              ทุก 1 นาทีที่ไม่ได้ทำ CPR<br/>โอกาสรอดชีวิตลดลง 10%
            </div>
          </div>

          <div style={{
            background: `${B.gold}10`, borderRadius: 12, padding: 14, marginBottom: 14,
            borderLeft: `4px solid ${B.gold}`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: B.gold, lineHeight: 1 }}>3-6 เดือน</div>
            <div style={{ fontSize: 13, color: B.black, marginTop: 4, lineHeight: 1.5 }}>
              งานวิจัยพบว่าทักษะ CPR เสื่อมลง<br/>ภายใน 3-6 เดือนหลังอบรม
            </div>
          </div>

          <div style={{
            background: `${B.green}10`, borderRadius: 12, padding: 14, marginBottom: 14,
            borderLeft: `4px solid ${B.green}`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: B.green, lineHeight: 1 }}>58%</div>
            <div style={{ fontSize: 13, color: B.black, marginTop: 4, lineHeight: 1.5 }}>
              ผู้ที่ทบทวนทุกเดือน ทำ CPR ได้ระดับ "ดีเยี่ยม"<br/>
              เทียบกับ 15% ที่ทบทวนปีละครั้ง
            </div>
          </div>

          <div style={{
            background: B.cream, borderRadius: 10, padding: 12, textAlign: "center",
            fontSize: 13, color: B.black, lineHeight: 1.6, fontWeight: 500,
          }}>
            คอร์สออนไลน์นี้ช่วยให้คุณทบทวนความรู้ CPR<br/>
            ได้ทุกเมื่อ <strong style={{ color: B.red }}>ไม่ต้องรอปีละครั้ง</strong>
          </div>
        </div>
      </div>

      {/* Features grid */}
      <div style={{ ...css.wrap, paddingBottom: 100 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "play", l: "6 วิดีโอ", s: "เรียนได้ทุกที่ทุกเวลา" },
            { icon: "book", l: "Quiz ทุกบท", s: "ทดสอบความเข้าใจ" },
            { icon: "cert", l: "ใบประกาศฯ", s: "มาตรฐานสากล" },
            { icon: "heart", l: FREE_LAUNCH ? "คูปอง ฿100" : "ส่วนลด ฿100", s: "ใช้ตอนเรียน on-site" },
          ].map((f, i) => (
            <div key={i} style={{
              background: B.white, borderRadius: 14, padding: 16, textAlign: "center",
              boxShadow: "0 1px 6px rgba(0,0,0,.04)",
            }}>
              <I name={f.icon} size={22} color={B.red}/>
              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{f.l}</div>
              <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{f.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.08)",
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 11, color: B.dkGray }}>{FREE_LAUNCH ? "ช่วง Launch พิเศษ" : "ราคาคอร์สออนไลน์"}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{FREE_LAUNCH ? "ฟรี!" : "฿100"}</div>
          </div>
          <button onClick={() => go("register")} style={css.btn(B.red, B.white)}>
            {FREE_LAUNCH ? "เรียนฟรี" : "สมัครเรียน"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== REGISTER ====================
function Register({ go, setUser }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [err, setErr] = useState({});

  const submit = () => {
    const e = {};
    if (!f.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง";
    if (Object.keys(e).length) return setErr(e);
    setUser(f);
    save("user", f);
    // ส่งข้อมูลลงทะเบียนไป Google Sheets
    sendToSheet({ action: "register", name: f.name, phone: f.phone, email: f.email });
    if (FREE_LAUNCH) {
      save("enrolled", true);
      go("course");
    } else {
      go("payment");
    }
  };

  const field = (key, label, ph, type = "text") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>
      <input type={type} placeholder={ph} value={f[key]}
        onChange={e => { setF({...f, [key]: e.target.value}); setErr({...err, [key]: undefined}); }}
        style={{
          width: "100%", padding: "12px 16px", border: `2px solid ${err[key] ? B.red : B.ltGray}`,
          borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box",
          transition: "border-color .2s",
        }}
        onFocus={e => { if (!err[key]) e.target.style.borderColor = B.red; }}
        onBlur={e => { if (!err[key]) e.target.style.borderColor = B.ltGray; }}
      />
      {err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}
    </div>
  );

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <I name="back" size={24} color={B.white}/>
        </button>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>สมัครเรียน</div></div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <Steps current={0}/>
        <div style={css.card}>
          <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 18 }}>ข้อมูลผู้เรียน</h3>
          {field("name", "ชื่อ-นามสกุล *", "เช่น สมชาย ใจดี")}
          {field("phone", "เบอร์โทรศัพท์ *", "เช่น 081-234-5678", "tel")}
          {field("email", "อีเมล (ไม่บังคับ)", "เช่น name@email.com", "email")}
        </div>

        <div style={{ ...css.card, marginTop: 14, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>คอร์ส CPR & AED ออนไลน์</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: FREE_LAUNCH ? B.green : B.red }}>
              {FREE_LAUNCH ? "ฟรี!" : "฿100"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: B.dkGray, marginTop: 6, lineHeight: 1.5 }}>
            6 บทเรียน + Final Exam • ใบประกาศนียบัตร • คูปองส่วนลด ฿100 เมื่อมาเรียน on-site
          </div>
        </div>

        <button onClick={submit} style={{ ...css.btn(B.red, B.white, true), marginTop: 20, boxShadow: `0 4px 16px ${B.red}40` }}>
          {FREE_LAUNCH ? "ลงทะเบียน → เข้าเรียนเลย" : "ถัดไป → ชำระเงิน"}
        </button>
      </div>
    </div>
  );
}

// ==================== PAYMENT ====================
function Payment({ go, user }) {
  const [slipSent, setSlipSent] = useState(false);
  const [approved, setApproved] = useState(false);

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={() => go("register")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
          <I name="back" size={24} color={B.white}/>
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>ชำระเงิน</div>
          <div style={{ fontSize: 12, opacity: .8 }}>โอนเงินแล้วส่งสลิป</div>
        </div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <Steps current={1}/>

        {!approved ? (
          <>
            <div style={{ ...css.card, textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>สแกน QR Code เพื่อโอนเงิน</div>

              {/* QR Placeholder */}
              <div style={{
                width: 200, height: 200, background: B.gray, borderRadius: 14,
                margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px dashed ${B.ltGray}`,
              }}>
                <div style={{ textAlign: "center" }}>
                  <I name="qr" size={48} color={B.dkGray}/>
                  <div style={{ fontSize: 11, color: B.dkGray, marginTop: 8 }}>QR PromptPay</div>
                  <div style={{ fontSize: 10, color: B.dkGray }}>(ใส่ QR จริงตอน deploy)</div>
                </div>
              </div>

              <div style={{
                background: `${B.red}08`, borderRadius: 12, padding: 14, marginBottom: 16,
              }}>
                <div style={{ fontSize: 12, color: B.dkGray }}>ยอดชำระ</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: B.red }}>฿100.00</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ชื่อบัญชี: JIA TRAINER CENTER</div>
              </div>

              <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.7, textAlign: "left" }}>
                <strong>วิธีชำระเงิน:</strong><br/>
                1. สแกน QR Code ด้านบน หรือโอนผ่าน PromptPay<br/>
                2. โอนยอด ฿100 ตรงเป๊ะ<br/>
                3. ส่งสลิปทาง LINE @jiacpr<br/>
                4. แอดมินตรวจสอบ แล้วเปิดคอร์สให้ภายใน 24 ชม.
              </div>
            </div>

            {/* LINE CTA */}
            <a href="https://lin.ee/jiacpr" target="_blank" rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 16, marginTop: 14,
                background: "#06C755", borderRadius: 16, padding: "16px 20px", color: B.white,
                textDecoration: "none",
              }}>
              <I name="line" size={36} color={B.white}/>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>ส่งสลิปทาง LINE OA</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>@jiacpr</div>
              </div>
            </a>

            <button onClick={() => setSlipSent(true)}
              style={{ ...css.btn(slipSent ? B.green : B.red, B.white, true), marginTop: 18 }}>
              {slipSent ? "✓ บันทึกแล้ว — รอแอดมินตรวจสอบ" : "ส่งสลิปแล้ว ✓"}
            </button>

            {slipSent && (
              <div style={{
                background: `${B.green}12`, borderRadius: 14, padding: 18, marginTop: 14,
                textAlign: "center", border: `1px solid ${B.green}30`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: B.green }}>รอแอดมินตรวจสอบสลิป</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>จะเปิดให้เข้าเรียนภายใน 24 ชม.</div>
                <button onClick={() => { setApproved(true); save("enrolled", true); }}
                  style={{
                    ...css.btn(B.green, B.white), marginTop: 12, padding: "10px 20px", fontSize: 13,
                  }}>
                  (Demo) จำลองแอดมินอนุมัติ →
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", background: `${B.green}18`,
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
            }}>
              <I name="check" size={40} color={B.green}/>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>ชำระเงินสำเร็จ!</h3>
            <p style={{ fontSize: 14, color: B.dkGray, marginBottom: 28 }}>คอร์สของคุณพร้อมเรียนแล้ว</p>
            <button onClick={() => go("course")}
              style={{ ...css.btn(B.red, B.white), fontSize: 16, padding: "16px 48px", boxShadow: `0 4px 16px ${B.red}40` }}>
              เข้าเรียนเลย →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== COURSE ====================
function Course({ go, progress, setProgress, user }) {
  const [active, setActive] = useState(null);
  const [quiz, setQuiz] = useState(false);
  const [ans, setAns] = useState({});
  const [result, setResult] = useState(null);
  const [watched, setWatched] = useState(false);

  const unlocked = id => id === 1 || progress.done.includes(id - 1);
  const done = id => progress.done.includes(id);

  const submitQuiz = () => {
    const mod = COURSE.modules.find(m => m.id === active);
    let correct = 0;
    mod.quiz.forEach((q, i) => { if (ans[i] === q.a) correct++; });
    const score = Math.round((correct / mod.quiz.length) * 100);
    const passed = score >= 80;
    setResult({ score, correct, total: mod.quiz.length, passed });
    if (passed && !progress.done.includes(active)) {
      const np = { ...progress, done: [...progress.done, active], scores: { ...progress.scores, [active]: score } };
      setProgress(np);
      save("progress", np);
      // ถ้าผ่าน Final Exam → ส่งข้อมูล "จบคอร์ส" ไป Google Sheets
      const isFinalExam = !mod.dur && mod.id === COURSE.modules[COURSE.modules.length - 1].id;
      if (isFinalExam && user) {
        sendToSheet({ action: "complete", name: user.name, phone: user.phone, score });
      }
    }
  };

  const resetLesson = () => {
    setActive(null); setQuiz(false); setAns({}); setResult(null); setWatched(false);
  };

  // Active module view
  if (active) {
    const mod = COURSE.modules.find(m => m.id === active);
    const isFinal = !mod.dur;

    return (
      <div style={css.page}>
        <div style={css.header(B.black)}>
          <button onClick={resetLesson} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <I name="back" size={24} color={B.white}/>
          </button>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: B.white }}>{mod.title}</div>
        </div>

        <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
          {!quiz && !isFinal ? (
            <>
              {/* Video */}
              <div onClick={() => setWatched(true)} style={{
                background: B.black, borderRadius: 16, aspectRatio: "16/9",
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 20, cursor: "pointer", position: "relative", overflow: "hidden",
              }}>
                {!watched ? (
                  <div style={{ textAlign: "center" }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.2)",
                      display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
                    }}>
                      <I name="play" size={32} color={B.white}/>
                    </div>
                    <div style={{ color: B.white, fontSize: 13, opacity: .8 }}>กดเพื่อเล่นวิดีโอ • {mod.dur}</div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: B.green, fontSize: 14, fontWeight: 600 }}>✓ ดูวิดีโอจบแล้ว</div>
                    <div style={{ color: "rgba(255,255,255,.5)", fontSize: 12, marginTop: 4 }}>{mod.dur}</div>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6, marginBottom: 24 }}>{mod.desc}</p>
              <button onClick={() => watched && setQuiz(true)} disabled={!watched}
                style={css.btn(watched ? B.red : B.ltGray, watched ? B.white : B.dkGray, true)}>
                {watched ? "ทำแบบทดสอบ →" : "ดูวิดีโอจบก่อนจึงทำแบบทดสอบได้"}
              </button>
            </>
          ) : (
            <div style={css.card}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>
                {isFinal ? "แบบทดสอบสุดท้าย" : "แบบทดสอบท้ายบท"}
              </h3>
              <p style={{ fontSize: 12, color: B.dkGray, margin: "0 0 20px" }}>
                ต้องได้ 80% ขึ้นไป ({Math.ceil(mod.quiz.length * 0.8)}/{mod.quiz.length} ข้อ)
              </p>

              {mod.quiz.map((q, qi) => (
                <div key={qi} style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.q}</div>
                  {q.c.map((c, ci) => {
                    let bg = B.gray, border = "transparent";
                    if (result) {
                      if (ci === q.a) { bg = `${B.green}18`; border = B.green; }
                      else if (ans[qi] === ci) { bg = `${B.red}12`; border = B.red; }
                    } else if (ans[qi] === ci) { bg = `${B.red}10`; border = B.red; }

                    return (
                      <button key={ci} onClick={() => !result && setAns({...ans, [qi]: ci})}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "10px 14px", marginBottom: 5, background: bg,
                          border: `2px solid ${border}`, borderRadius: 8, fontSize: 13,
                          cursor: result ? "default" : "pointer", transition: "all .15s",
                        }}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              ))}

              {!result ? (
                <button onClick={submitQuiz}
                  disabled={Object.keys(ans).length < mod.quiz.length}
                  style={css.btn(
                    Object.keys(ans).length >= mod.quiz.length ? B.red : B.ltGray,
                    Object.keys(ans).length >= mod.quiz.length ? B.white : B.dkGray, true
                  )}>
                  ส่งคำตอบ
                </button>
              ) : (
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    background: result.passed ? `${B.green}12` : `${B.red}08`,
                    borderRadius: 12, padding: 20, marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 40, fontWeight: 800, color: result.passed ? B.green : B.red }}>{result.score}%</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: result.passed ? B.green : B.red }}>
                      {result.passed ? "ผ่าน!" : "ไม่ผ่าน — ลองใหม่อีกครั้ง"}
                    </div>
                    <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ตอบถูก {result.correct}/{result.total} ข้อ</div>
                  </div>
                  {result.passed ? (
                    <button onClick={() => { resetLesson(); if (isFinal) go("certificate"); }}
                      style={css.btn(B.green, B.white)}>
                      {isFinal ? "รับใบประกาศนียบัตร →" : "กลับหน้าบทเรียน →"}
                    </button>
                  ) : (
                    <button onClick={() => { setAns({}); setResult(null); }}
                      style={css.btn(B.red, B.white)}>ทำใหม่อีกครั้ง</button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Module list
  const pct = Math.round((progress.done.length / COURSE.modules.length) * 100);

  return (
    <div style={css.page}>
      <div style={{
        background: `linear-gradient(135deg, ${B.black} 0%, #2a2a2a 100%)`,
        color: B.white, padding: "24px 24px 30px",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, opacity: .5, textTransform: "uppercase", marginBottom: 4 }}>JIA TRAINER CENTER</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 14px" }}>CPR & AED ออนไลน์</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.12)" }}>
              <div style={{ height: "100%", borderRadius: 3, background: B.green, width: `${pct}%`, transition: "width .5s" }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span>
          </div>
          <div style={{ fontSize: 11, opacity: .5, marginTop: 4 }}>{progress.done.length}/{COURSE.modules.length} บทเรียน</div>
        </div>
      </div>

      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        {COURSE.modules.map(m => {
          const ok = unlocked(m.id), dn = done(m.id), fin = !m.dur;
          return (
            <button key={m.id} onClick={() => ok && (setActive(m.id), fin && setQuiz(true))}
              style={{
                display: "flex", width: "100%", gap: 12, alignItems: "center",
                padding: 14, marginBottom: 8, background: B.white,
                border: dn ? `2px solid ${B.green}` : "2px solid transparent",
                borderRadius: 14, cursor: ok ? "pointer" : "not-allowed",
                opacity: ok ? 1 : .5, boxShadow: "0 1px 6px rgba(0,0,0,.04)",
                textAlign: "left", transition: "all .2s",
              }}>
              <div style={{
                minWidth: 42, height: 42, borderRadius: 11,
                background: dn ? B.green : fin ? `${B.gold}18` : `${B.red}10`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {dn ? <I name="check" size={18} color={B.white}/> :
                  !ok ? <I name="lock" size={16} color={B.dkGray}/> :
                  fin ? <I name="cert" size={18} color={B.gold}/> :
                  <I name="play" size={16} color={B.red}/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>
                  {dn ? `✓ ผ่านแล้ว ${progress.scores[m.id] ? `(${progress.scores[m.id]}%)` : ""}` :
                    m.dur ? `${m.dur} • ${m.quiz.length} คำถาม` : `${m.quiz.length} คำถาม • ต้องได้ 80%`}
                </div>
              </div>
              {ok && !dn && <I name="arrow" size={14} color={B.dkGray}/>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== CERTIFICATE ====================
function Certificate({ user, go }) {
  const d = new Date();
  const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;

  return (
    <div style={{ ...css.page, padding: 20 }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 76, height: 76, borderRadius: "50%", background: `${B.gold}18`,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <I name="star" size={38} color={B.gold}/>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>ยินดีด้วย!</h2>
          <p style={{ fontSize: 14, color: B.dkGray }}>คุณผ่านคอร์ส CPR & AED ออนไลน์แล้ว</p>
        </div>

        {/* Cert card */}
        <div style={{ background: B.white, borderRadius: 20, padding: 4, boxShadow: "0 8px 32px rgba(0,0,0,.1)" }}>
          <div style={{
            border: `3px solid ${B.gold}`, borderRadius: 16, padding: "32px 20px",
            textAlign: "center", position: "relative",
          }}>
            {[{top:8,left:8},{top:8,right:8},{bottom:8,left:8},{bottom:8,right:8}].map((p, i) => (
              <div key={i} style={{
                position: "absolute", ...p, width: 18, height: 18,
                borderTop: i < 2 ? `2px solid ${B.gold}` : "none",
                borderBottom: i >= 2 ? `2px solid ${B.gold}` : "none",
                borderLeft: i % 2 === 0 ? `2px solid ${B.gold}` : "none",
                borderRight: i % 2 === 1 ? `2px solid ${B.gold}` : "none",
              }}/>
            ))}
            <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: B.red, fontWeight: 700, marginBottom: 4 }}>
              JIA TRAINER CENTER
            </div>
            <div style={{ fontSize: 10, color: B.dkGray, marginBottom: 20 }}>ศูนย์ฝึกอบรม CPR & AED มาตรฐานสากล</div>
            <div style={{ fontSize: 18, fontWeight: 300, color: B.dkGray, marginBottom: 3, letterSpacing: 1 }}>ใบประกาศนียบัตร</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 20 }}>CERTIFICATE OF COMPLETION</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 8 }}>มอบให้แก่</div>
            <div style={{
              fontSize: 22, fontWeight: 700, marginBottom: 4,
              borderBottom: `2px solid ${B.gold}40`, paddingBottom: 8,
              display: "inline-block", minWidth: 180,
            }}>{user?.name || "ชื่อผู้เรียน"}</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginTop: 16, lineHeight: 1.6 }}>
              ผ่านหลักสูตร<br/>
              <strong>การช่วยชีวิตขั้นพื้นฐาน CPR & AED ออนไลน์</strong><br/>
              มาตรฐานสากล
            </div>
            <div style={{ marginTop: 16, fontSize: 12, color: B.dkGray }}>วันที่ {ds}</div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${B.ltGray}`, fontSize: 11, color: B.dkGray }}>
              088-558-8078 | jiacpr.com | LINE: @jiacpr
            </div>
          </div>
        </div>

        {/* Discount CTA */}
        <div style={{
          background: `${B.red}08`, borderRadius: 16, padding: 20, marginTop: 18,
          textAlign: "center", border: `1px solid ${B.red}18`,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: B.red, marginBottom: 4 }}>
            {FREE_LAUNCH ? "คูปองส่วนลด ฿100 สำหรับคอร์ส On-site!" : "ส่วนลด ฿100 สำหรับคอร์ส On-site!"}
          </div>
          <div style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.5, marginBottom: 12 }}>
            แสดงใบประกาศนียบัตรนี้ตอนมาเรียน on-site<br/>
            ลดทันที ฿100 (จาก ฿500 เหลือ ฿400)
          </div>
          <a href="https://lin.ee/jiacpr" target="_blank" rel="noopener noreferrer"
            style={{ ...css.btn(B.red, B.white), display: "inline-block", textDecoration: "none" }}>
            สมัครเรียน On-site →
          </a>
        </div>

        <button onClick={() => go("course")}
          style={{ ...css.btn(B.white, B.black, true), marginTop: 14, border: `1px solid ${B.ltGray}` }}>
          ← กลับหน้าบทเรียน
        </button>
      </div>
    </div>
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
    default: return <Landing go={go}/>;
  }
}
