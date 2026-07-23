import { useCallback, useEffect, useRef, useState } from 'react';
import { scenarios, LEVEL_META } from './scenarios';
import { getCharacter, COACH_ID, registerCustomImages } from './characters';
import CharacterSprite from './CharacterSprite';
import EcgStrip from './EcgStrip';
import {
  createInitialState, applyFx, nextNode, recordCorrect, recordWrong,
  gradeFor, fmtTime, shuffled, getDifficulty, pushEtco2, wasArrest, correctCount,
  scoreFor, speedBonus, avgSpeed, FAST_FRACTION, comboMultiplier,
  DIFFICULTY, DEFAULT_DIFFICULTY,
} from './storyEngine';
import {
  initAudio, playShockSound, playROSCSound, playWarningBeep,
  playMetronomeClick, playBeep, playTapSound, playTypeBlip,
  playChoiceAppear, playTickSound, playCorrectSound, playComboBreakSound,
  playWinJingle, playLoseSound, playImpactSound, playHeartbeatThump,
} from './sound';
import './game.css';

// CPR HERO — เกมตัดสินใจสไตล์ Code Blue Sim (จาก acls/bls.morroo.com) ฉบับประชาชน
// เคสส่วนใหญ่เล่นฟรี ไม่ล็อก ยกเว้นเคสที่ requiresFinalExam (ล็อกจนสอบ Final Exam ผ่าน)
// props: onExit() กลับหน้าเว็บ, onTrack(name, props) ส่ง event, finalExamPassed ปลดล็อกเคสโบนัส
//   earnVoucher() -> คืนรหัสคูปองส่วนลด ฿100 (หรือ null) เมื่อชนะเคส — ออก/บันทึกฝั่ง App
//   onGoBooking() ไปหน้าจองคอร์ส on-site (ใช้คูปองที่เพิ่งได้)
const GAME_NAME = 'CPR HERO';
const GAME_EYEBROW = 'ภารกิจพลเมืองดี';

const HISCORE_PREFIX = 'cprhero_hiscore';
const MUTE_KEY = 'cprhero_muted';
const DIFF_KEY = 'cprhero_difficulty';
const CLEARED_KEY = 'cprhero_cleared'; // เก็บ id เคสที่เคยผ่าน
const hiscoreKey = (diff) => `${HISCORE_PREFIX}_${diff}`;

// สำเนาสถานะ engine สำหรับ render (render ห้ามอ่าน ref ตรงๆ)
function snapshot(st) {
  return { ...st, timeline: [...st.timeline], etco2Trace: [...st.etco2Trace] };
}

// ป้ายบนจอ monitor — ภาษาชาวบ้าน (AED เป็นคนวิเคราะห์ ไม่ใช่ผู้เล่นอ่านคลื่นเอง)
const RHYTHM_NAMES = {
  flat: 'หัวใจหยุดเต้น',
  vf: 'AED: ต้องช็อก ⚠',
  nsr: 'หัวใจกลับมาเต้น',
  brady: 'ชีพจรช้า ⚠',
  pacing: 'ชีพจรช้า ⚠',
  tachy: 'ชีพจรเร็ว ⚠',
};

const readCleared = () => {
  try { return new Set(JSON.parse(localStorage.getItem(CLEARED_KEY)) || []); }
  catch { return new Set(); }
};

// ป้ายอ้างอิงบทเรียน — เคสที่ไม่ผูกกับบทใดบทหนึ่ง (bonus) ใช้ c.tag แทน "บทที่ N"
const lessonTag = (c) => (c.lesson ? `บทที่ ${c.lesson}` : (c.tag || 'โบนัส'));

// สุ่มเคสที่ยังไม่ถูกล็อก — สำหรับเข้าจากแบนเนอร์/ลิงก์ ?game=random เสิร์ฟโจทย์ให้นักเรียนทันที
// เลี่ยงเคสที่เคยผ่านมาก่อน (ให้เจอของใหม่) — ถ้าผ่านครบแล้วค่อยสุ่มจากทั้งหมด
const randomUnlockedScenario = (finalExamPassed) => {
  const cleared = readCleared();
  const unlocked = scenarios.filter((c) => !(c.requiresFinalExam && !finalExamPassed));
  const fresh = unlocked.filter((c) => !cleared.has(c.id));
  const pool = fresh.length ? fresh : unlocked;
  return pool[Math.floor(Math.random() * pool.length)] || scenarios[0];
};

// fetchCustomImages: callback จาก App คืน rows ของตาราง game_character_images
// (รูปตัวละครที่แอดมินอัปโหลดเอง) — โหลดไม่ได้/ว่าง = ใช้รูป default ตามปกติ
export default function GamePage({ onExit, onTrack, fetchCustomImages, finalExamPassed = false, earnVoucher, onGoBooking, autoRandom = false }) {
  const [reducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  const [difficulty, setDifficulty] = useState(
    () => localStorage.getItem(DIFF_KEY) || DEFAULT_DIFFICULTY,
  );
  const [muted, setMuted] = useState(() => localStorage.getItem(MUTE_KEY) === '1');
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const track = useCallback((name, props) => { try { onTrack && onTrack(name, props); } catch (e) {} }, [onTrack]);

  // เข้าจากแบนเนอร์/ลิงก์สุ่มโจทย์ — เก็บสถิติว่าเสิร์ฟเคสไหนให้ (funnel: banner → random case → win → voucher)
  const autoRandomTracked = useRef(false);
  useEffect(() => {
    if (autoRandom && !autoRandomTracked.current) {
      autoRandomTracked.current = true;
      track('game_random_served', { scenario_id: sc.id, lesson: sc.lesson });
    }
    // ครั้งเดียวตอน mount — sc ตอนนี้คือเคสสุ่มที่ล็อกไว้ใน useState initializer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // โหลดรูปตัวละคร override จากแอดมิน (best-effort — พังก็ใช้รูป default)
  const [imgV, setImgV] = useState(0);
  useEffect(() => {
    if (!fetchCustomImages) return undefined;
    let alive = true;
    Promise.resolve(fetchCustomImages()).then((rows) => {
      if (!alive || !Array.isArray(rows) || !rows.length) return;
      const map = {};
      rows.forEach((r) => { if (r?.char_id && r?.pose && r?.url) map[`${r.char_id}/${r.pose}`] = r.url; });
      registerCustomImages(map);
      setImgV((v) => v + 1);
    }).catch(() => {});
    return () => { alive = false; };
    // fetchCustomImages เป็น arrow ใหม่ทุก render ของ App — โหลดครั้งเดียวตอน mount พอ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- engine state: mutable ใน ref (logic) + snapshot state (render) ----
  const S = useRef(createInitialState(DEFAULT_DIFFICULTY));
  const [view, setView] = useState(() => snapshot(createInitialState(DEFAULT_DIFFICULTY)));

  // เข้าจากแบนเนอร์/ลิงก์ ?game=random → เริ่มที่เคสสุ่มบนหน้า title ทันที (ไม่ผ่านหน้าเลือกเคส)
  const [sc, setSc] = useState(() => (autoRandom ? randomUnlockedScenario(finalExamPassed) : scenarios[0]));
  const [cleared, setCleared] = useState(readCleared);
  const [screen, setScreen] = useState(autoRandom ? 'title' : 'select'); // select | title | game | debrief
  const [quitMenu, setQuitMenu] = useState(false);

  const [speaker, setSpeaker] = useState(null); // { who, pose, popN }
  const [plate, setPlate] = useState(null); // { name } override (time-skip)
  const [dlgHtml, setDlgHtml] = useState('');
  const [typing, setTyping] = useState(false);
  const [choice, setChoice] = useState(null); // { q, options, hintTgt }
  const [decisionLeft, setDecisionLeft] = useState(getDifficulty(difficulty).decisionTime);
  const [drama, setDrama] = useState(null); // null | 'red' | 'white'
  const [inter, setInter] = useState(null); // { text, green }
  const [flashN, setFlashN] = useState(0);
  const [redN, setRedN] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [comboBreak, setComboBreak] = useState(null); // { n, k }
  const [result, setResult] = useState(null); // { won, grade, score, isHiscore }
  const [voucher, setVoucher] = useState(null); // รหัสคูปองส่วนลด ฿100 ที่ได้จากการชนะเกม (null = ยังไม่ได้/ไม่มีสิทธิ์)
  const [hiscore, setHiscore] = useState(() => Number(localStorage.getItem(hiscoreKey(difficulty)) || 0));

  const timers = useRef({ type: null, dec: null, misc: [], metronome: null });
  const busyRef = useRef(false);
  const [awaitTap, setAwaitTap] = useState(false);
  const currentChoiceRef = useRef(null);
  const retryChoiceRef = useRef(null);
  const decisionLeftRef = useRef(0);
  const comboBreakN = useRef(0);
  const hintUsedRef = useRef(false);
  const typeDoneRef = useRef(null);
  const fullHtmlRef = useRef('');
  const popCounter = useRef(0);

  const stopMetronome = useCallback(() => {
    if (timers.current.metronome) {
      clearInterval(timers.current.metronome);
      timers.current.metronome = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    const t = timers.current;
    if (t.type) clearTimeout(t.type);
    if (t.dec) clearInterval(t.dec);
    if (t.metronome) clearInterval(t.metronome);
    t.misc.forEach(clearTimeout);
    t.type = null; t.dec = null; t.metronome = null; t.misc = [];
  }, []);
  useEffect(() => clearAllTimers, [clearAllTimers]);

  // เลเยอร์ความกดดัน: เสียงหัวใจเต้น "ตุบ-ตุบ" พื้นหลังระหว่างเล่น
  // คำนวณ "ความตึงเครียด" ใหม่ทุกจังหวะเต้น จาก HP + ภาวะผู้ป่วย + นาทีบีบคั้นตอนตัดสินใจ
  // ยิ่งแย่/ยิ่งลุ้น ยิ่งเต้นเร็วและดังขึ้นพร้อมกัน (~55→130 ครั้ง/นาที)
  // — ระหว่าง CPR เว้นจังหวะให้ metronome นำแทน (110/นาทีคือสาระของบทเรียน)
  useEffect(() => {
    if (screen !== 'game' || muted) return undefined;
    let t = null;
    const tick = () => {
      const st = S.current;
      let period = 800; // ช่วงที่งดตุบ (CPR/หมด HP) — เช็คซ้ำถี่พอให้กลับมาทันเมื่อสถานะเปลี่ยน
      if (st.hp > 0 && !(st.cpr && !st.rosc)) {
        if (st.rosc) {
          // ฟื้นแล้ว — จังหวะสงบ เบาๆ ให้รู้สึกโล่ง
          if (!mutedRef.current) playHeartbeatThump(0.09);
          period = Math.round(60000 / 64);
        } else {
          const maxHp = st.maxHp || getDifficulty(st.difficulty).hp;
          const frac = Math.max(0, Math.min(1, st.hp / maxHp));
          let tension = (1 - frac) * 0.7; // ฐาน: อาการผู้ป่วยยิ่งแย่ยิ่งเครียด
          if (st.alarm) tension += 0.15; // หมดสติ/ไม่หายใจ
          if (currentChoiceRef.current) { // กำลังลุ้นตัดสินใจ = ช่วงตื่นเต้นสุด
            tension += 0.15;
            const dt = getDifficulty(st.difficulty).decisionTime;
            const leftFrac = dt > 0 ? Math.max(0, decisionLeftRef.current / dt) : 1;
            tension += (1 - leftFrac) * 0.3; // เวลายิ่งงวด ยิ่งระทึก
          }
          tension = Math.min(1, tension);
          // ดัง (0.10→0.36) และเร็ว (55→130 bpm) ไปด้วยกันตามระดับความตึงเครียด
          if (!mutedRef.current) playHeartbeatThump(0.1 + tension * 0.26);
          period = Math.round(60000 / (55 + tension * 75));
        }
      }
      t = setTimeout(tick, period);
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [screen, muted]);

  // ---- flow ทั้งหมดเป็น plain functions: แตะเฉพาะ ref + state setter (stable) ----

  function syncView() {
    setView(snapshot(S.current));
  }

  function later(fn, ms) {
    timers.current.misc.push(setTimeout(fn, ms));
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function sfx(fn) {
    if (!mutedRef.current) fn();
  }

  // metronome ~110/นาที ระหว่าง CPR (หยุดเมื่อ shock/ฟื้น/ผิด/จบเคส)
  function startMetronome() {
    stopMetronome();
    if (mutedRef.current) return;
    timers.current.metronome = setInterval(() => {
      if (!mutedRef.current) playMetronomeClick();
    }, 545);
  }

  function soundForFx(fx) {
    if (!fx) return;
    if (fx.shock) { sfx(playShockSound); stopMetronome(); }
    if (fx.rosc) { sfx(playROSCSound); stopMetronome(); }
    if (fx.alarm) sfx(playWarningBeep);
    if (fx.cpr && !S.current.cpr) startMetronome();
  }

  function finishTyping() {
    if (timers.current.type) clearTimeout(timers.current.type);
    timers.current.type = null;
    setDlgHtml(fullHtmlRef.current);
    setTyping(false);
    const done = typeDoneRef.current;
    typeDoneRef.current = null;
    if (done) done();
  }

  function typeText(html, onDone) {
    if (timers.current.type) clearTimeout(timers.current.type);
    fullHtmlRef.current = html;
    typeDoneRef.current = onDone || null;
    setTyping(true);
    setDlgHtml('');
    let i = 0;
    let out = '';
    let blipN = 0;
    const step = () => {
      if (i >= html.length) { finishTyping(); return; }
      const ch = html[i];
      if (ch === '<') {
        const close = html.indexOf('>', i);
        out += html.slice(i, close + 1);
        i = close + 1;
      } else {
        out += ch;
        i += 1;
        // เสียงพิมพ์ทีละตัว (สไตล์ visual novel) — เว้นทุก 3 ตัวอักษรกันถี่เกิน
        if (!reducedMotion && ch !== ' ' && blipN++ % 3 === 0) sfx(playTypeBlip);
      }
      setDlgHtml(out);
      timers.current.type = setTimeout(step, reducedMotion ? 0 : 16);
    };
    step();
  }

  function doShake() {
    setShaking(true);
    later(() => setShaking(false), 450);
  }

  function doBigMoment() {
    vibrate([90, 50, 160]);
    if (!reducedMotion) {
      setFlashN((n) => n + 1);
      doShake();
    }
  }

  function endCase(won) {
    clearAllTimers();
    const st = S.current;
    const grade = gradeFor(st, won);
    const score = scoreFor(st, won);
    const bonus = speedBonus(st, won);
    const speed = avgSpeed(st);
    const key = hiscoreKey(st.difficulty);
    let isHiscore = false;
    if (score > Number(localStorage.getItem(key) || 0)) {
      localStorage.setItem(key, String(score));
      setHiscore(score);
      isHiscore = score > 0;
    }
    // ชนะเคสใดก็ได้ → ปลดคูปองส่วนลด ฿100 คอร์ส on-site (เกม = funnel ดึงคนมาเรียนจริง)
    // earnVoucher() ฝั่ง App เป็นคนออก/บันทึกโค้ด (รียูสของเดิมถ้ามี, ยกเว้นนักเรียน pre-course → คืน null)
    let earnedVoucher = null;
    if (won) {
      const nextCleared = new Set(cleared);
      nextCleared.add(sc.id);
      setCleared(nextCleared);
      localStorage.setItem(CLEARED_KEY, JSON.stringify([...nextCleared]));
      const alreadyHad = !!voucher;
      try { earnedVoucher = earnVoucher ? earnVoucher() : null; } catch (e) { earnedVoucher = null; }
      setVoucher(earnedVoucher);
      if (earnedVoucher && !alreadyHad) {
        track('game_voucher_earned', { scenario_id: sc.id, difficulty: st.difficulty, grade });
      }
    }
    track('game_completed', {
      scenario_id: sc.id, lesson: sc.lesson, difficulty: st.difficulty,
      won, grade, wrong: st.wrong, duration: Math.round(st.simTime),
      voucher: !!earnedVoucher,
    });
    syncView();
    setResult({ won, grade, score, isHiscore, bonus, speed });
    setChoice(null);
    setInter(null);
    setScreen('debrief');
    window.scrollTo(0, 0);
    // เสียงปิดเคส: ชนะ = แตรสั้น, แพ้ = โน้ตลง
    sfx(won ? playWinJingle : playLoseSound);
  }

  function showChoice(c) {
    currentChoiceRef.current = c;
    setDrama('white');
    const diff = getDifficulty(S.current.difficulty);
    // โหมดง่าย: หลังพลาดจุดนี้ไปแล้วครั้งนึง ใบ้หมวดที่ถูก + dim ตัวที่ผิด
    const hintTgt = diff.hints && hintUsedRef.current
      ? (c.options.find((o) => o.ok)?.tgt || null)
      : null;
    setChoice({ q: c.q, options: shuffled(c.options), hintTgt });
    sfx(playChoiceAppear); // มีคำถามเด้งขึ้น — เรียกสมาธิ
    setDecisionLeft(diff.decisionTime);
    decisionLeftRef.current = diff.decisionTime;
    if (timers.current.dec) clearInterval(timers.current.dec);
    let left = diff.decisionTime;
    timers.current.dec = setInterval(() => {
      left -= 0.25;
      decisionLeftRef.current = left;
      setDecisionLeft(left);
      // 5 วิสุดท้ายติ๊กเตือนรายวินาที (2 วิสุดท้ายโทนสูงขึ้น) — เร่งจังหวะหัวใจ
      if (left > 0 && left <= 5 && Number.isInteger(left)) {
        sfx(() => playTickSound(left <= 2));
      }
      if (left <= 0) {
        clearInterval(timers.current.dec);
        timers.current.dec = null;
        pick({
          ok: false,
          timeout: true,
          why: 'หมดเวลา — ในเหตุฉุกเฉิน ความลังเลก็คือการตัดสินใจแบบหนึ่ง',
          worsen: true,
        });
      }
    }, 250);
  }

  function runNode(node) {
    const st = S.current;
    if (node.t) st.simTime += node.t;
    syncView();

    if (node.say) {
      const { who, pose, text, fx } = node.say;
      soundForFx(fx);
      applyFx(st, fx);
      pushEtco2(st);
      setDrama(pose === 'panic' ? 'red' : null);
      popCounter.current += 1;
      setSpeaker({ who, pose, popN: popCounter.current });
      setPlate(null);
      setAwaitTap(true);
      typeText(text);
      syncView();
      return;
    }

    if (node.inter) {
      busyRef.current = true;
      soundForFx(node.fx);
      applyFx(st, node.fx);
      pushEtco2(st);
      if (node.drama) setDrama(node.drama);
      syncView();
      doBigMoment();
      // ป้ายเด้ง: เหตุดี = โน้ตชื่นชม, เหตุวิกฤต = เสียงตุบกระแทก
      sfx(node.green ? playCorrectSound : playImpactSound);
      setInter({ text: node.inter, green: !!node.green });
      later(() => {
        setInter(null);
        busyRef.current = false;
        advance();
      }, reducedMotion ? 350 : 1050);
      return;
    }

    if (node.skip) {
      busyRef.current = true;
      setDrama(null);
      popCounter.current += 1;
      setSpeaker({ who: COACH_ID, pose: 'idle', popN: popCounter.current });
      setPlate({ name: '— เวลาเดินต่อ —' });
      setAwaitTap(false);
      typeText(`⏩ ${node.skip}…`, () => {
        later(() => {
          busyRef.current = false;
          advance();
        }, reducedMotion ? 200 : 700);
      });
      return;
    }

    if (node.choice) {
      showChoice(node.choice);
      return;
    }

    if (node.end) {
      endCase(true);
      return;
    }

    advance();
  }

  function advance() {
    const node = nextNode(S.current, sc.story);
    if (!node) { endCase(true); return; }
    runNode(node);
  }

  function pick(option) {
    if (timers.current.dec) { clearInterval(timers.current.dec); timers.current.dec = null; }
    setChoice(null);
    const st = S.current;

    if (option.ok) {
      const dt = getDifficulty(st.difficulty).decisionTime;
      const speedFrac = dt > 0 ? decisionLeftRef.current / dt : 0;
      recordCorrect(st, option, speedFrac);
      currentChoiceRef.current = null;
      hintUsedRef.current = false;
      // เสียงตอบถูก — คอมโบยิ่งยาวโทนยิ่งสูงขึ้น (juice), ตอบถูกธรรมดาก็มีเสียงชม
      if (st.combo >= 2) sfx(() => playBeep(360 + Math.min(st.combo, 8) * 70, 0.1, 0.22));
      else sfx(playCorrectSound);
      syncView();
      advance();
      return;
    }

    // คอมโบขาด — ถ้าสตรีคเคยยาวพอ โชว์ "BREAK"
    const broke = st.combo >= 3;
    if (broke) {
      setComboBreak({ n: st.combo, k: comboBreakN.current++ });
      later(() => setComboBreak(null), reducedMotion ? 300 : 900);
    }
    recordWrong(st, option);
    pushEtco2(st);
    hintUsedRef.current = true;
    vibrate([60, 40, 60]);
    // เสียงผิดต่ำ / ถ้าสตรีคขาดใช้เสียงไล่โน้ตลงแทน ให้เจ็บกว่า
    sfx(broke ? playComboBreakSound : () => playBeep(160, 0.28, 0.35));
    if (!reducedMotion) {
      setRedN((n) => n + 1);
      doShake();
    }
    stopMetronome();
    syncView();

    popCounter.current += 1;
    setSpeaker({ who: COACH_ID, pose: 'stern', popN: popCounter.current });
    setPlate(null);
    setDrama('red');

    const showWhy = getDifficulty(st.difficulty).showWhyOnWrong;
    const whyText = showWhy ? ` ${option.why}` : '';

    if (st.hp <= 0) {
      setAwaitTap(false);
      typeText(`<span class="cbs-em">ช่วยไม่ทันแล้ว…</span>${whyText}`, () => {
        later(() => endCase(false), reducedMotion ? 400 : 1400);
      });
      return;
    }

    // เตือนแล้วให้ตัดสินใจข้อเดิมซ้ำ (สภาพแย่ลงแล้ว)
    retryChoiceRef.current = currentChoiceRef.current;
    setAwaitTap(true);
    typeText(
      `<span class="cbs-em">ช้าก่อน!</span>${whyText}${option.worsen ? ' — ผู้ป่วยแย่ลง สีหน้าคล้ำขึ้น!' : ''}`,
    );
  }

  function onDialogTap() {
    if (busyRef.current) return;
    if (timers.current.type) { sfx(playTapSound); finishTyping(); return; }
    if (!awaitTap) return;
    sfx(playTapSound);
    setAwaitTap(false);
    if (retryChoiceRef.current) {
      const c = retryChoiceRef.current;
      retryChoiceRef.current = null;
      showChoice(c);
      return;
    }
    advance();
  }

  function startGame() {
    clearAllTimers();
    setQuitMenu(false);
    if (!mutedRef.current) initAudio(); // ปลดล็อก AudioContext ตอนผู้ใช้แตะปุ่ม
    S.current = createInitialState(difficulty);
    syncView();
    busyRef.current = false;
    setAwaitTap(false);
    currentChoiceRef.current = null;
    retryChoiceRef.current = null;
    hintUsedRef.current = false;
    setResult(null);
    setComboBreak(null);
    setChoice(null);
    setInter(null);
    setDrama(null);
    setSpeaker(null);
    setPlate(null);
    setDlgHtml('');
    setScreen('game');
    track('game_started', { scenario_id: sc.id, lesson: sc.lesson, difficulty });
    later(() => advance(), reducedMotion ? 100 : 400);
  }

  // เคสที่ requiresFinalExam ต้องสอบ Final Exam ผ่านก่อน (ตรวจจาก prop finalExamPassed)
  const isLocked = (c) => !!c.requiresFinalExam && !finalExamPassed;

  function pickScenario(chosen) {
    if (isLocked(chosen)) return;
    setSc(chosen);
    setScreen('title');
    window.scrollTo(0, 0);
  }

  function backToSelect() {
    clearAllTimers();
    stopMetronome();
    setQuitMenu(false);
    setScreen('select');
    window.scrollTo(0, 0);
  }

  function chooseDifficulty(id) {
    setDifficulty(id);
    localStorage.setItem(DIFF_KEY, id);
    setHiscore(Number(localStorage.getItem(hiscoreKey(id)) || 0));
  }

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      // เก็บสถิติว่าคนเปิด/ปิดเสียงจากหน้าไหน — ใช้ตัดสินใจเรื่อง backing track/จูนความดัง
      track('game_mute_toggle', { muted: next, screen });
      mutedRef.current = next; // อัพเดตทันที ไม่รอ effect — ให้ startMetronome ด้านล่างไม่โดนเบรก
      if (next) {
        stopMetronome();
      } else {
        initAudio();
        // เปิดเสียงกลางเคสที่กำลังปั๊มหัวใจอยู่ — จังหวะ metronome ต้องกลับมาเอง
        if (S.current.cpr && !S.current.rosc) startMetronome();
      }
      return next;
    });
  }

  // ============ CASE SELECT ============
  if (screen === 'select') {
    // เคสแนะนำถัดไป = เคสแรกที่ยังไม่ผ่านและไม่ถูกล็อก
    const nextCase = scenarios.find((c) => !cleared.has(c.id) && !isLocked(c));
    return (
      <div className="cbs-app">
        <section className="cbs-select">
          <div className="cbs-eyebrow">{GAME_EYEBROW} · เลือกภารกิจ</div>
          <h1 className="cbs-select-title"><span className="cbs-gold-text">{GAME_NAME}</span> ภารกิจพลเมืองดี</h1>
          <p className="cbs-select-sub">
            คุณคือคนแรกที่เจอเหตุ — ตัดสินใจถูก คนตรงหน้ารอด ตัดสินใจพลาด เขาแย่ลงจริง
            ทุกเคสอิงเนื้อหาบทเรียนของคอร์สนี้ เล่นฟรีทุกเคส (เคสโบนัสปลดล็อกเมื่อสอบผ่าน Final Exam)
          </p>
          {nextCase && (
            <div className="cbs-quick-row">
              <button type="button" className="cbs-next" onClick={() => pickScenario(nextCase)}>
                <span className="cbs-next-eyebrow">▶ ภารกิจแนะนำถัดไป</span>
                <span className="cbs-next-name">{nextCase.title}</span>
                <span className="cbs-next-meta">อิง{lessonTag(nextCase)} · {LEVEL_META[nextCase.level]?.label}</span>
              </button>
            </div>
          )}
          <div className="cbs-case-list">
            {scenarios.map((c) => {
              const locked = isLocked(c);
              return (
                <button key={c.id} type="button" className={`cbs-case${locked ? ' cbs-case-locked' : ''}`} disabled={locked} onClick={() => pickScenario(c)}>
                  <div className="cbs-case-top">
                    <span className={`cbs-case-level cbs-lvl-${c.level}`}>{lessonTag(c)} · {LEVEL_META[c.level]?.label}</span>
                    {locked ? <span className="cbs-case-lock">🔒 ปลดล็อกเมื่อสอบผ่าน Final Exam</span> : cleared.has(c.id) && <span className="cbs-case-done">✓ ผ่านแล้ว</span>}
                  </div>
                  <div className="cbs-case-name">{c.title}</div>
                  <div className="cbs-case-desc">{c.subtitle}</div>
                </button>
              );
            })}
          </div>
          <button type="button" className="cbs-btn-ghost" onClick={onExit}>
            ← กลับหน้าคอร์ส
          </button>
        </section>
      </div>
    );
  }

  // ============ TITLE ============
  if (screen === 'title') {
    return (
      <div className="cbs-app">
        <section className="cbs-title">
          <div className="cbs-eyebrow">{GAME_EYEBROW} · อิง{lessonTag(sc)}</div>
          <h1><span className="cbs-gold-text">{sc.title}</span></h1>
          <p className="cbs-title-sub">
            {sc.subtitle}<br />
            คุณคือ <b>พลเมืองดีคนแรกที่ถึงตัวผู้ป่วย</b> — ทุกคนรอบข้างรอการตัดสินใจของคุณ<br />
            ตัดสินใจผิด ผู้ป่วยแย่ลงจริง เวลาไม่เคยรอใคร
          </p>
          <div className="cbs-diff-group" role="group" aria-label="เลือกระดับความยาก">
            <span className="cbs-diff-label">ระดับความยาก</span>
            <div className="cbs-diff-btns">
              {Object.values(DIFFICULTY).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`cbs-diff-btn ${difficulty === d.id ? 'cbs-diff-on' : ''}`}
                  onClick={() => chooseDifficulty(d.id)}
                  aria-pressed={difficulty === d.id}
                >
                  <span className="cbs-diff-name">{d.label}</span>
                  <span className="cbs-diff-meta">{d.decisionTime}s · ♥{d.hp}</span>
                </button>
              ))}
            </div>
            <div className="cbs-diff-hint">⚡ ตอบถูกเร็ว = ได้โบนัสคะแนน</div>
          </div>
          <div className="cbs-title-row">
            {hiscore > 0 && <div className="cbs-hiscore-chip">HI-SCORE {hiscore}</div>}
            <button
              type="button"
              className="cbs-icon-btn"
              onClick={toggleMute}
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
          <button type="button" className="cbs-btn-main" onClick={startGame}>
            🚨 รับภารกิจ
          </button>
          <button type="button" className="cbs-btn-ghost" onClick={backToSelect}>
            ← เลือกภารกิจอื่น
          </button>
          <div className="cbs-note">CPR HERO · CPR.MORROO.COM</div>
        </section>
      </div>
    );
  }

  // ============ DEBRIEF ============
  if (screen === 'debrief' && result) {
    const st = view;
    const arrest = wasArrest(st);
    const winStamp = result.won ? (sc.outcome?.stamp || (arrest ? 'รอดแล้ว!' : 'พ้นวิกฤต!')) : 'ช่วยไม่ทัน';
    const winSub = result.won
      ? (sc.outcome?.win || (arrest
        ? 'ผู้ป่วยกลับมาหายใจ — เคสนี้เป็นของคุณ'
        : 'ผู้ป่วยพ้นวิกฤต — อ่านสรุปด้านล่างเพื่อฝึกให้แม่นขึ้น'))
      : 'ครั้งนี้ช่วยไม่ทัน… อ่านสรุปด้านล่าง แล้วกลับมาแก้มือ — ของจริงไม่มีปุ่มเริ่มใหม่ แต่เกมมี';
    return (
      <div className="cbs-app">
        <section className={`cbs-debrief ${result.won ? 'cbs-winbg' : 'cbs-losebg'}`}>
          <div className={`cbs-stamp ${result.won ? 'cbs-win' : 'cbs-lose'}`}>
            {winStamp}
          </div>
          <div className="cbs-diff-badge">โหมด {getDifficulty(st.difficulty).label}</div>
          <p className="cbs-verdict-sub">
            {winSub}
            {result.won && result.bonus > 0 && (
              <><br />⚡ โบนัสความไว +{result.bonus} คะแนน (ตอบถูกเร็ว)</>
            )}
            {result.won && comboMultiplier(st) > 1 && (
              <><br />🔥 สตรีคสูงสุด ×{st.maxCombo} — ตัวคูณคะแนน ×{comboMultiplier(st).toFixed(2)}</>
            )}
            {result.isHiscore && <><br />🏆 New Hi-Score: {result.score}</>}
          </p>
          <div className="cbs-grade-row">
            <div className="cbs-grade-box">
              <span className={`cbs-grade cbs-g-${result.grade.toLowerCase()}`}>{result.grade}</span>
              <span className="cbs-grade-label">GRADE</span>
            </div>
            <div className="cbs-metric-grid">
              <Metric label="ตัดสินใจถูก" value={String(correctCount(st))} tone="good" />
              <Metric label="ตัดสินใจพลาด" value={String(st.wrong)}
                tone={st.wrong === 0 ? 'good' : st.wrong <= 2 ? 'warn' : 'badv'} />
              {result.won && st.speedCount > 0 && (
                <Metric label="ความไวเฉลี่ย" value={`${Math.round(result.speed * 100)}%`}
                  tone={result.speed >= FAST_FRACTION ? 'good' : 'warn'} />
              )}
              {st.firstCPRAt >= 0 && (
                <Metric label="เริ่มปั๊มภายใน" value={fmtTime(st.firstCPRAt)}
                  tone={st.firstCPRAt <= 90 ? 'good' : 'warn'} />
              )}
              {st.firstShockAt >= 0 && (
                <Metric label="ช็อกแรกภายใน" value={fmtTime(st.firstShockAt)}
                  tone={st.firstShockAt <= 300 ? 'good' : 'warn'} />
              )}
              <Metric label="เวลาทั้งเคส" value={fmtTime(st.simTime)} tone="" />
            </div>
          </div>
          {result.won && voucher && (
            <div className="cbs-voucher">
              <div className="cbs-voucher-eyebrow">🎁 รางวัลพลเมืองดี — ปลดล็อกแล้ว</div>
              <div className="cbs-voucher-title">คูปองส่วนลด ฿100 คอร์ส On-site</div>
              <div className="cbs-voucher-code">{voucher}</div>
              <div className="cbs-voucher-note">
                เก็บรหัสนี้ไว้ใช้ลดราคาคอร์สภาคปฏิบัติ (ฝึกจริงกับหุ่น + ครูผู้สอน) —
                แจ้งตอนจอง หรือกรอกตอนชำระเงิน
              </div>
              {onGoBooking && (
                <button
                  type="button"
                  className="cbs-btn-main cbs-voucher-cta"
                  onClick={() => { track('game_voucher_cta', { scenario_id: sc.id }); onGoBooking(); }}
                >
                  จองคอร์ส On-site ใช้ส่วนลดนี้ →
                </button>
              )}
            </div>
          )}
          <div className="cbs-tl-title">TIMELINE การตัดสินใจของคุณ</div>
          <div className="cbs-timeline">
            {st.timeline.map((it, i) => (
              <div key={i} className={`cbs-tl-item ${it.ok ? 'cbs-ok' : 'cbs-err'}`}>
                <span className="cbs-tl-time">{fmtTime(it.t)}</span>
                <span className="cbs-tl-dot" />
                <span>
                  {it.text}
                  {it.note && <span className="cbs-tl-note">{it.note}</span>}
                </span>
              </div>
            ))}
          </div>
          <div className="cbs-cert-note">
            {sc.lesson
              ? <>📚 เคสนี้อิงเนื้อหา <b>บทที่ {sc.lesson}</b> ของคอร์ส — พลาดตรงไหน กลับไปดูวิดีโอบทนั้นซ้ำได้เลย</>
              : <>📚 {sc.debriefNote || 'เคสเสริมตามแนวทาง AHA 2025 — ทบทวนได้จากทุกบทของคอร์ส'}</>}
          </div>
          <div className="cbs-debrief-actions">
            <button type="button" className="cbs-btn-main" onClick={startGame}>
              ⟳ เล่นเคสนี้อีกครั้ง
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={backToSelect}>
              ← เลือกภารกิจอื่น
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={onExit}>
              กลับหน้าคอร์ส
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ============ GAME ============
  const st = view;
  const char = speaker ? getCharacter(speaker.who) : null;
  const plateName = plate?.name || char?.name || ' ';
  const plateColors = plate ? null : char?.plate || null;
  const gameDiff = getDifficulty(st.difficulty);
  const maxHp = st.maxHp || gameDiff.hp;
  const timerPct = Math.max(0, (decisionLeft / gameDiff.decisionTime) * 100);
  const rhythmBad = st.rhythm === 'vf' || st.rhythm === 'flat';

  return (
    <div className={`cbs-app ${shaking ? 'cbs-shake' : ''}`}>
      <section className="cbs-game">
        <div className={`cbs-stage ${drama === 'red' ? 'cbs-drama-red' : drama === 'white' ? 'cbs-drama' : ''}`}>
          <div className="cbs-hud">
            <div className="cbs-hud-monitor">
              <span className={`cbs-rhythm-name ${rhythmBad ? 'cbs-bad' : ''}`}>
                {st.alarm || st.rhythm !== 'flat' ? RHYTHM_NAMES[st.rhythm] : 'ชีพจร — รอประเมิน'}
              </span>
              <EcgStrip rhythm={st.rhythm} cpr={st.cpr} />
            </div>
            <div className="cbs-hud-right">
              <div className="cbs-gauge">
                <span className="cbs-gauge-label">ผู้ป่วย</span>
                <div className="cbs-gauge-cells">
                  {Array.from({ length: maxHp }).map((_, i) => (
                    <span
                      key={i}
                      className={`cbs-cell ${i >= st.hp ? 'cbs-off' : (st.hp === 1 && i === 0 ? 'cbs-last' : '')}`}
                    />
                  ))}
                </div>
              </div>
              <div className="cbs-timechip">{fmtTime(st.simTime)}</div>
            </div>
          </div>

          {st.combo >= 2 && (
            <div className={`cbs-combo cbs-combo-t${Math.min(st.combo, 6)}`} key={`combo-${st.combo}`}>
              <span className="cbs-combo-label">COMBO</span>
              <span className="cbs-combo-n">×{st.combo}</span>
            </div>
          )}
          {comboBreak && (
            <div className="cbs-combo-break" key={`brk-${comboBreak.k}`}>
              COMBO ×{comboBreak.n} BREAK!
            </div>
          )}

          {!choice && (
            <button
              type="button"
              className="cbs-menu-btn"
              onClick={() => setQuitMenu(true)}
              aria-label="เมนู"
            >
              ☰
            </button>
          )}

          {speaker && (
            <div className={`cbs-sprite ${reducedMotion ? '' : 'cbs-pop'}`} key={`sp-${speaker.popN}`}>
              <CharacterSprite charId={speaker.who} pose={speaker.pose} talking={typing} imgV={imgV} />
            </div>
          )}

          {choice && (
            <div className="cbs-choices">
              <div className="cbs-qbanner">⚖ {choice.q}</div>
              {choice.hintTgt && (
                <div className="cbs-hint">💡 ลองมองหมวด <b>{choice.hintTgt}</b> ดูสิ</div>
              )}
              {choice.options.map((o, i) => {
                const dim = choice.hintTgt && o.tgt !== choice.hintTgt;
                const glow = choice.hintTgt && o.tgt === choice.hintTgt;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`cbs-choice ${dim ? 'cbs-choice-dim' : ''} ${glow ? 'cbs-choice-hint' : ''}`}
                    onClick={() => pick(o)}
                  >
                    <span className="cbs-choice-tgt">▸ {o.tgt}</span>
                    {o.label}
                  </button>
                );
              })}
              <div className="cbs-choice-timer">
                <div
                  className={`cbs-choice-timer-fill ${timerPct < 30 ? 'cbs-low' : ''}`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="cbs-dlg-area">
          {/* กล่องบทพูดแบบ visual novel: แตะเพื่อข้าม/ไปต่อ */}
          <div
            className="cbs-dlg"
            onClick={onDialogTap}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDialogTap(); }
            }}
          >
            <div
              className="cbs-nameplate"
              style={plateColors ? { background: `linear-gradient(180deg, ${plateColors[0]}, ${plateColors[1]})` } : undefined}
            >
              {plateName}
            </div>
            {/* บทพูดมาจาก scenario data ในโค้ดเรา (จำกัด <span class="cbs-em"> เท่านั้น) */}
            <div className="cbs-dlg-text" dangerouslySetInnerHTML={{ __html: dlgHtml }} />
            {!typing && awaitTap && <div className="cbs-adv">▼</div>}
          </div>
        </div>
      </section>

      {quitMenu && (
        <div className="cbs-quit" role="dialog" aria-label="เมนูระหว่างเล่น">
          <div className="cbs-quit-card">
            <div className="cbs-quit-title">หยุดพักภารกิจนี้</div>
            <button type="button" className="cbs-btn-main cbs-quit-resume" onClick={() => setQuitMenu(false)}>
              เล่นต่อ
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={startGame}>
              ⟳ เริ่มเคสนี้ใหม่
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={toggleMute}>
              {muted ? '🔊 เปิดเสียง' : '🔇 ปิดเสียง'}
            </button>
            <button type="button" className="cbs-btn-ghost" onClick={backToSelect}>
              ออกไปเลือกภารกิจอื่น
            </button>
          </div>
        </div>
      )}

      {inter && (
        <div className="cbs-inter">
          <div className="cbs-inter-burst" />
          <div className={`cbs-inter-bubble ${inter.green ? 'cbs-green-bubble' : ''}`}>
            <span className="cbs-inter-text">{inter.text}</span>
          </div>
        </div>
      )}
      {flashN > 0 && <div key={`fl-${flashN}`} className="cbs-flash cbs-go" />}
      {redN > 0 && <div key={`rf-${redN}`} className="cbs-redflash cbs-go" />}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="cbs-metric">
      <span className="cbs-metric-label">{label}</span>
      <span className={`cbs-metric-val ${tone ? `cbs-${tone}` : ''}`}>{value}</span>
    </div>
  );
}
