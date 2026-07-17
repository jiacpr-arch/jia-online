// Story engine — ส่วน logic ล้วนของเกมตัดสินใจ (ไม่มี DOM/React)
//
// โจทย์ (story) เป็น array ของ node:
//   { say: { who, pose, text, fx? }, t? }   — บทพูด (text เป็น HTML จำกัดแค่ <span class="cbs-em">)
//   { inter: 'ข้อความ!!', drama?, green?, fx?, t? } — จังหวะตะโกนเต็มจอ
//   { skip: 'คำบรรยาย', t }                — time-skip (เช่น CPR 2 นาที)
//   { choice: { q, options: [{ tgt, label, ok, why?, worsen?, then?[] }] } }
//   { end: true }
// ตอบถูก → node ใน then ของตัวเลือกถูก run ก่อนแล้วไปข้อถัดไป
// ตอบผิด → หัก stability, เล่นจุดตัดสินใจเดิมซ้ำ (สภาพแย่ลงแล้ว)

// ระดับความยาก — คุมเวลาตัดสินใจ, จำนวน HP, การใบ้/เฉลย, และความเข้มของ grade
export const DIFFICULTY = {
  easy:   { id: 'easy',   label: 'ง่าย',  decisionTime: 30, hp: 7, hints: true,  showWhyOnWrong: true,  gradeStrict: false },
  normal: { id: 'normal', label: 'ปกติ',  decisionTime: 20, hp: 5, hints: false, showWhyOnWrong: true,  gradeStrict: false },
  hard:   { id: 'hard',   label: 'ยาก',   decisionTime: 12, hp: 3, hints: false, showWhyOnWrong: false, gradeStrict: true },
};
export const DEFAULT_DIFFICULTY = 'normal';

// โบนัสความไว: ตอบถูกเร็ว (เหลือเวลามาก) ได้แต้มเพิ่ม สูงสุด +SPEED_BONUS_MAX
// เมื่อเฉลี่ยแล้วตอบทุกจุดในจังหวะแรกๆ — ความแม่นยำยังมาก่อน (base 100), ไวเป็นของแถม
export const SPEED_BONUS_MAX = 25;
// ตอบถูกภายในครึ่งแรกของเวลา = "ไว" (ใช้เป็นเกณฑ์เหรียญสายฟ้า)
export const FAST_FRACTION = 0.5;

// คอมโบ: ตอบถูกติดกันไม่พลาด → ตัวคูณคะแนนรวมสูงขึ้น (สูงสุด ×1.5 ที่สตรีค 10)
// ตัดสินใจผิด 1 ครั้ง คอมโบขาด (รีเซ็ตเป็น 0) — ให้รางวัลความสม่ำเสมอทั้งเคส
export const COMBO_CAP = 10;
export const COMBO_STEP = 0.05;

export function getDifficulty(id) {
  return DIFFICULTY[id] || DIFFICULTY[DEFAULT_DIFFICULTY];
}

// ค่า default อ้างอิงโหมดปกติ (คงไว้เพื่อ backward-compat กับผู้เรียกเดิม)
export const DECISION_TIME = DIFFICULTY.normal.decisionTime;
export const MAX_HP = DIFFICULTY.normal.hp;

export function createInitialState(difficultyId = DEFAULT_DIFFICULTY) {
  const diff = getDifficulty(difficultyId);
  return {
    difficulty: diff.id,
    ptr: 0,
    queue: [],
    simTime: 0,
    hp: diff.hp,
    maxHp: diff.hp,
    rhythm: 'flat',
    cpr: false,
    alarm: false,
    shocks: 0,
    epis: 0,
    wrong: 0,
    firstCPRAt: -1,
    firstShockAt: -1,
    rosc: false,
    timeline: [],
    etco2Trace: [], // ค่าสะท้อนคุณภาพ CPR ตามเวลา สำหรับกราฟใน debrief
    speedSum: 0,    // ผลรวม fraction เวลาที่เหลือของทุกจุดที่ตอบถูก (0..1 ต่อจุด)
    speedCount: 0,  // จำนวนจุดตัดสินใจที่ตอบถูก (ใช้หารเป็นค่าเฉลี่ย)
    combo: 0,       // สตรีคปัจจุบัน — ตอบถูกติดกันกี่ครั้ง (รีเซ็ตเมื่อผิด)
    maxCombo: 0,    // สตรีคยาวสุดในเคส (ใช้คิดตัวคูณคะแนน + โชว์ debrief)
  };
}

// EtCO2 (mmHg) สะท้อนคุณภาพ CPR: 0 ก่อนเริ่มกด, ~15 ระหว่าง CPR (ตกเมื่อพลาด),
// พุ่ง ~40 เมื่อ ROSC — ใช้ทำ sparkline สอนผู้เรียน
export function currentEtco2(state) {
  if (state.rosc) return 40;
  if (!state.cpr) return 0;
  return Math.max(6, 16 - state.wrong * 2);
}

export function pushEtco2(state) {
  state.etco2Trace.push({ t: state.simTime, v: currentEtco2(state) });
}

// ผลของ node ต่อสถานะผู้ป่วย/เคส (mutate state ที่ถือใน ref ของหน้าเกม)
// fx.rhythm รับค่า: 'flat' (asystole/PEA) · 'vf' (VF/pulseless VT — shockable) ·
//   'nsr' (sinus/stable) · 'brady' (unstable bradycardia/Mobitz มีชีพจร) ·
//   'pacing' (transcutaneous pacing capture) · 'tachy' (unstable tachycardia มีชีพจร เช่น SVT/pulse VT)
// UI (RHYTHM_NAMES ใน CodeBlueSim.jsx + EcgStrip.jsx) ต้องรู้จักทุกค่าที่ใช้
export function applyFx(state, fx) {
  if (!fx) return;
  if (fx.alarm) state.alarm = true;
  if (fx.cpr) state.cpr = true;
  if (fx.rhythm) state.rhythm = fx.rhythm;
  if (fx.firstCPR && state.firstCPRAt < 0) state.firstCPRAt = state.simTime;
  if (fx.epi) state.epis += 1;
  if (fx.shock) {
    state.shocks += 1;
    state.cpr = false;
    if (state.firstShockAt < 0) state.firstShockAt = state.simTime;
  }
  if (fx.rosc) {
    state.rosc = true;
    state.rhythm = 'nsr';
    state.cpr = false;
    state.alarm = false;
  }
}

// ดึง node ถัดไป — queue (จาก then ของตัวเลือก) มาก่อน story หลัก
export function nextNode(state, story) {
  if (state.queue.length) return state.queue.shift();
  if (state.ptr < story.length) return story[state.ptr++];
  return null;
}

// speedFrac = สัดส่วนเวลาที่ยังเหลือตอนตอบถูก (0 = ตอบตอนหมดเวลาพอดี, 1 = ตอบทันที)
// ตอบเร็ว → speedFrac สูง → โบนัสความไวมากขึ้น
export function recordCorrect(state, option, speedFrac) {
  state.timeline.push({ t: state.simTime, ok: true, text: option.label });
  state.simTime += 8;
  if (Number.isFinite(speedFrac)) {
    state.speedSum += Math.max(0, Math.min(1, speedFrac));
    state.speedCount += 1;
  }
  state.combo += 1;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;
  state.queue.push(...(option.then || []));
}

// ความไวเฉลี่ยตลอดเคส (0..1) — สัดส่วนเวลาที่เหลือโดยเฉลี่ยเวลาตอบถูก
export function avgSpeed(state) {
  return state.speedCount ? state.speedSum / state.speedCount : 0;
}

// โบนัสความไว (แต้ม) — ให้เฉพาะตอนชนะ
export function speedBonus(state, won) {
  return won ? Math.round(avgSpeed(state) * SPEED_BONUS_MAX) : 0;
}

// ตัวคูณคอมโบ: สตรีคยาวสุดในเคส → ×1.0 ถึง ×1.5 (สตรีค 10 ขึ้นไป)
export function comboMultiplier(state) {
  return 1 + Math.min(state.maxCombo, COMBO_CAP) * COMBO_STEP;
}

// คะแนนรวม = (ความแม่นยำ 100 − ผิด×15 ขั้นต่ำ 10 + โบนัสความไว) × ตัวคูณคอมโบ
export function scoreFor(state, won) {
  if (!won) return 0;
  const base = Math.max(10, 100 - state.wrong * 15) + speedBonus(state, won);
  return Math.round(base * comboMultiplier(state));
}

export function recordWrong(state, option) {
  state.wrong += 1;
  state.combo = 0; // คอมโบขาดทันทีที่ตัดสินใจผิด
  state.hp = Math.max(0, state.hp - 1);
  state.simTime += 20; // ความผิดพลาดกินเวลาเสมอ
  state.timeline.push({
    t: state.simTime,
    ok: false,
    text: option.timeout ? '(หมดเวลา — ไม่มีคำสั่ง)' : 'สั่งผิดจังหวะ',
    note: option.why,
  });
}

export function gradeFor(state, won) {
  if (!won) return 'C';
  const strict = getDifficulty(state.difficulty).gradeStrict;
  if (strict) {
    // โหมดยาก: เกณฑ์เข้มขึ้น (ผิดแม้ครั้งเดียวก็ตกจาก S)
    if (state.wrong === 0) return 'S';
    if (state.wrong === 1) return 'B';
    return 'C';
  }
  if (state.wrong === 0) return 'S';
  if (state.wrong === 1) return 'A';
  if (state.wrong <= 3) return 'B';
  return 'C';
}

export function fmtTime(s) {
  if (s < 0) return '--:--';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

// เคสนี้เป็น cardiac arrest จริงไหม (เคยเริ่ม CPR) — ใช้ปรับ debrief ให้เข้ากับเคส
// ที่ผู้ป่วยไม่ได้ arrest (bradycardia/tachycardia/ACS) ไม่ให้ขึ้น ROSC/CPR/shock ที่ไม่เกี่ยวข้อง
export function wasArrest(state) {
  return state.firstCPRAt >= 0;
}

// จำนวนการตัดสินใจที่ถูก (จาก timeline) — เมตริกที่มีความหมายกับทุกเคส ไม่ใช่แค่ arrest
export function correctCount(state) {
  return state.timeline.filter((it) => it.ok).length;
}

export function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
