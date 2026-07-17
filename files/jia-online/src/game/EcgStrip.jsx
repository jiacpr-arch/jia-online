import { useEffect, useRef } from 'react';

// ECG แบบ sweep (เหมือนจอ monitor จริง): เส้นวาดทับของเก่า มีแถบดำกวาดนำหน้า
// rhythm: 'flat' | 'vf' | 'nsr' | 'brady' | 'pacing' | 'tachy' — cpr=true เพิ่ม compression artifact บน rhythm ที่ไม่ perfuse
const RHYTHM_COLOR = {
  nsr: '#37C871', flat: '#E5484D', vf: '#E5484D', brady: '#F2C14E', pacing: '#F2C14E', tachy: '#F2C14E',
};

export default function EcgStrip({ rhythm = 'flat', cpr = false, width = 240, height = 52 }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ rhythm, cpr });
  useEffect(() => {
    stateRef.current = { rhythm, cpr };
  }, [rhythm, cpr]);

  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#040812';
    ctx.fillRect(0, 0, cv.width, cv.height);

    let sweepX = 0;
    let lastY = null;
    let tPhase = 0;
    let raf;

    const sample = () => {
      tPhase += 0.05;
      const t = tPhase;
      const { rhythm: r, cpr: c } = stateRef.current;
      if (r === 'vf') {
        return Math.sin(t * 19) * 0.45 + Math.sin(t * 12.3 + 1) * 0.3 + Math.sin(t * 31) * 0.15;
      }
      if (r === 'nsr') {
        const b = (t * 1.1) % 1;
        if (b < 0.05) return -0.1;
        if (b < 0.1) return 0.95;
        if (b < 0.15) return -0.3;
        if (b > 0.32 && b < 0.44) return 0.15;
        return 0;
      }
      if (r === 'brady') {
        // sinus แต่ช้ากว่า nsr มาก (~unstable bradycardia) — คาบยาวขึ้น ~2.5x
        const b = (t * 0.4) % 1;
        if (b < 0.04) return -0.1;
        if (b < 0.09) return 0.9;
        if (b < 0.14) return -0.25;
        if (b > 0.28 && b < 0.4) return 0.12;
        return 0;
      }
      if (r === 'pacing') {
        // pacer spike แหลมสูง ตามด้วย QRS กว้าง (captured paced rhythm)
        const b = (t * 0.9) % 1;
        if (b < 0.035) return -1;
        if (b < 0.09) return 0.8;
        if (b < 0.18) return -0.3;
        return 0;
      }
      if (r === 'tachy') {
        // เร็วสม่ำเสมอ (unstable tachycardia มีชีพจร เช่น SVT/pulse VT) — เร็วกว่า nsr ~2x
        const b = (t * 2.4) % 1;
        if (b < 0.06) return -0.15;
        if (b < 0.13) return 0.85;
        if (b < 0.2) return -0.35;
        return 0;
      }
      let y = Math.sin(t * 40) * 0.02;
      if (c) {
        const cc = (t * 1.7) % 1; // ~110 ครั้ง/นาที
        if (cc < 0.3) y += Math.sin((cc / 0.3) * Math.PI) * 0.5;
      }
      return y;
    };

    const draw = () => {
      const W = cv.width, H = cv.height, mid = H * 0.55, amp = H * 0.4;
      const { rhythm: r } = stateRef.current;
      const col = RHYTHM_COLOR[r] || '#37C871';
      for (let i = 0; i < 2; i++) {
        const y = mid - sample() * amp;
        ctx.fillStyle = '#040812';
        ctx.fillRect(sweepX, 0, 14, H);
        if (lastY !== null && sweepX > 0) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sweepX - 2.4, lastY);
          ctx.lineTo(sweepX, y);
          ctx.stroke();
        }
        lastY = y;
        sweepX += 2.4;
        if (sweepX >= W) { sweepX = 0; lastY = null; }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={width} height={height} className="cbs-ecg" />;
}
