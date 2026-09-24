import { useEffect, useRef } from 'react';

// ECG แบบ sweep (เหมือนจอ monitor จริง): เส้นวาดทับของเก่า มีแถบดำกวาดนำหน้า
// rhythm: 'flat' | 'pea' | 'vf' | 'nsr' | 'afib' | 'brady' | 'pacing' | 'tachy' — cpr=true เพิ่ม compression artifact บน rhythm ที่ไม่ perfuse
// 'flat' = asystole เส้นเรียบไม่มีคลื่นไฟฟ้า · 'pea' = มีคลื่นไฟฟ้าเป็นจังหวะ (organized) แต่ไม่บีบเลือด/ไม่มีชีพจร
// 'afib' = atrial fibrillation มีชีพจร (perfuse ได้) — QRS แคบ ไม่มี P wave จังหวะ R-R ไม่สม่ำเสมอ
// เดินตามเวลาจริง (ไม่ผูกกับ frame rate): t หน่วยเป็นวินาที ทุก rhythm ระบุอัตราจริงไว้
const RHYTHM_COLOR = {
  nsr: '#37C871', afib: '#37C871', flat: '#E5484D', pea: '#E5484D', vf: '#E5484D', brady: '#F2C14E', pacing: '#F2C14E', tachy: '#F2C14E',
};

// จอกว้าง 1 จอ = กี่วินาทีของสัญญาณ — เทียบความเร็วกวาด 25 mm/s ของ monitor จริง
// (จอจริงเห็นคลื่นราว 4-6 วินาทีต่อหน้าจอ)
const SWEEP_SECONDS = 4;
const TAU = Math.PI * 2;

// on=false = ยังไม่ติดเครื่อง monitor — จอมืดว่าง ไม่มีสัญญาณ (ไม่ใช่เส้นเรียบ asystole)
export default function EcgStrip({ rhythm = 'flat', cpr = false, on = true, width = 240, height = 52 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ rhythm, cpr, on });
  useEffect(() => {
    stateRef.current = { rhythm, cpr, on };
  }, [rhythm, cpr, on]);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, cv.width, cv.height);

    let sweepX = 0;
    let lastY = null;
    let tSec = 0;
    let prevTs = null;
    let raf;

    const sample = (t) => {
      const { rhythm: r, cpr: c } = stateRef.current;
      if (r === 'vf') {
        // coarse VF — คลื่นยุ่งเหยิงช่วง ~3-8 Hz
        return Math.sin(TAU * 4.7 * t) * 0.45 + Math.sin(TAU * 3.1 * t + 1) * 0.3 + Math.sin(TAU * 7.7 * t) * 0.15;
      }
      if (r === 'nsr') {
        const b = (t * 1.2) % 1; // ~72 ครั้ง/นาที
        if (b < 0.05) return -0.1;
        if (b < 0.1) return 0.95;
        if (b < 0.15) return -0.3;
        if (b > 0.32 && b < 0.44) return 0.15;
        return 0;
      }
      if (r === 'afib') {
        // Atrial fibrillation (มีชีพจร) — QRS แคบ ไม่มี P wave, เฉลี่ย ~110 ครั้ง/นาที
        // warp เวลาเพื่อให้ช่องห่างบีตไม่เท่ากันแบบคงที่ (deterministic — ไม่ใช้ random ไม่กระตุกรายเฟรม)
        const warped = t * 1.8 + Math.sin(t * 1.4) * 0.35 + Math.sin(t * 3.4) * 0.18;
        const b = warped % 1;
        const fib = Math.sin(TAU * 6 * t) * 0.04 + Math.sin(TAU * 9.5 * t) * 0.03; // fibrillatory baseline แทน P wave
        if (b < 0.04) return -0.1 + fib;
        if (b < 0.09) return 0.9 + fib;
        if (b < 0.14) return -0.28 + fib;
        if (b > 0.3 && b < 0.42) return 0.13 + fib; // T wave
        return fib;
      }
      if (r === 'brady') {
        // sinus แต่ช้ากว่า nsr มาก (~unstable bradycardia) — ~40 ครั้ง/นาที
        const b = (t * 0.67) % 1;
        if (b < 0.04) return -0.1;
        if (b < 0.09) return 0.9;
        if (b < 0.14) return -0.25;
        if (b > 0.28 && b < 0.4) return 0.12;
        return 0;
      }
      if (r === 'pacing') {
        // pacer spike แหลมสูง ตามด้วย QRS กว้าง (captured paced rhythm) — ~70 ครั้ง/นาที
        const b = (t * 1.17) % 1;
        if (b < 0.035) return -1;
        if (b < 0.09) return 0.8;
        if (b < 0.18) return -0.3;
        return 0;
      }
      if (r === 'tachy') {
        // เร็วสม่ำเสมอ (unstable tachycardia มีชีพจร เช่น SVT/pulse VT) — ~170 ครั้ง/นาที
        const b = (t * 2.83) % 1;
        if (b < 0.06) return -0.15;
        if (b < 0.13) return 0.85;
        if (b < 0.2) return -0.35;
        return 0;
      }
      if (r === 'pea') {
        // PEA — มีคลื่นไฟฟ้าเป็นจังหวะ (organized complexes) แต่ไม่มีชีพจร/ไม่บีบเลือด
        // QRS กว้างเป็นจังหวะช้าๆ (idioventricular-like) ~35 ครั้ง/นาที ให้ต่างจาก asystole ชัดเจน
        const b = (t * 0.58) % 1;
        if (b < 0.05) return -0.12;
        if (b < 0.13) return 0.7;
        if (b < 0.22) return -0.4;
        if (b < 0.3) return 0.12;
        return 0;
      }
      let y = Math.sin(TAU * 8 * t) * 0.02;
      if (c) {
        const cc = (t * 1.83) % 1; // ~110 ครั้ง/นาที
        if (cc < 0.3) y += Math.sin((cc / 0.3) * Math.PI) * 0.5;
      }
      return y;
    };

    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (prevTs === null) {
        prevTs = ts;
        return;
      }
      const dt = Math.min((ts - prevTs) / 1000, 0.1); // กันกระโดดยาวตอน tab กลับมา active
      prevTs = ts;

      const W = cv.width, H = cv.height, mid = H * 0.55, amp = H * 0.4;
      const { rhythm: r, on: isOn } = stateRef.current;
      if (!isOn) {
        ctx.fillStyle = '#040812';
        ctx.fillRect(0, 0, W, H);
        sweepX = 0;
        lastY = null;
        return;
      }
      const col = RHYTHM_COLOR[r] || '#37C871';
      const pxPerSec = W / SWEEP_SECONDS;
      let advance = dt * pxPerSec;
      while (advance > 0) {
        // เดินทีละ ≤1px เพื่อไม่ข้าม spike แคบๆ (pacer spike กว้างแค่ ~2px ที่ความเร็วนี้)
        const step = Math.min(advance, 1);
        advance -= step;
        tSec += step / pxPerSec;
        const x = sweepX + step;
        const y = mid - sample(tSec) * amp;
        ctx.fillStyle = '#040812';
        ctx.fillRect(x, 0, 14, H);
        if (lastY !== null) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sweepX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        lastY = y;
        sweepX = x;
        if (sweepX >= W) { sweepX = 0; lastY = null; }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={width} height={height} className="cbs-ecg" />;
}
