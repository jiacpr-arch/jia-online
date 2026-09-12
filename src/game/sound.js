// Web Audio API — no mp3 files needed
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Play a beep tone
export function playBeep(frequency = 880, duration = 0.15, volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available
  }
}

// Cycle complete alert — double beep
export function playCycleAlert() {
  playBeep(880, 0.15, 0.4);
  setTimeout(() => playBeep(1100, 0.2, 0.4), 200);
}

// Drug due alert — triple beep
export function playDrugAlert() {
  playBeep(660, 0.1, 0.3);
  setTimeout(() => playBeep(660, 0.1, 0.3), 150);
  setTimeout(() => playBeep(880, 0.15, 0.3), 300);
}

// Shock delivered — short deep tone
export function playShockSound() {
  playBeep(440, 0.3, 0.5);
}

// ROSC celebration — ascending tones
export function playROSCSound() {
  playBeep(523, 0.15, 0.3);
  setTimeout(() => playBeep(659, 0.15, 0.3), 150);
  setTimeout(() => playBeep(784, 0.2, 0.3), 300);
}

// Metronome click
export function playMetronomeClick() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1000;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.03);
  } catch (e) {
    // Audio not available
  }
}

// Compressor rotation alert — ascending triple beep
export function playCompressorRotateAlert() {
  playBeep(440, 0.15, 0.4);
  setTimeout(() => playBeep(554, 0.15, 0.4), 180);
  setTimeout(() => playBeep(659, 0.2, 0.4), 360);
}

// Warning beep (10 sec before cycle ends)
export function playWarningBeep() {
  playBeep(660, 0.1, 0.2);
}

// ---- เสียง UI / จังหวะเกม (CPR HERO) ----

// แตะกล่องบทพูดเพื่อไปต่อ/ข้าม — คลิกสั้นเบาๆ
export function playTapSound() {
  playBeep(1200, 0.04, 0.08);
}

// บลิปตอนข้อความกำลังพิมพ์ทีละตัว (สไตล์ visual novel) — เบามากกันรำคาญ
export function playTypeBlip() {
  playBeep(1600, 0.02, 0.04);
}

// มีคำถามให้ตัดสินใจ — โน้ตขึ้นสองตัว เรียกสมาธิ
export function playChoiceAppear() {
  playBeep(587, 0.08, 0.16);
  setTimeout(() => playBeep(880, 0.1, 0.16), 90);
}

// นาฬิกาตัดสินใจใกล้หมด — ติ๊กเตือนรายวินาที (urgent = โทนสูง/ดังขึ้น)
export function playTickSound(urgent = false) {
  playBeep(urgent ? 1150 : 850, 0.04, urgent ? 0.22 : 0.12);
}

// ตอบถูก — คู่โน้ตขึ้น ให้รางวัลหูทันที
export function playCorrectSound() {
  playBeep(660, 0.08, 0.2);
  setTimeout(() => playBeep(990, 0.12, 0.2), 90);
}

// สตรีคขาด — ไล่โน้ตลง (ใช้แทนเสียงผิดปกติเมื่อคอมโบยาวพอ)
export function playComboBreakSound() {
  playBeep(440, 0.09, 0.28);
  setTimeout(() => playBeep(330, 0.09, 0.28), 90);
  setTimeout(() => playBeep(196, 0.22, 0.3), 180);
}

// ชนะเคส — แตรสั้นโน้ตขึ้น 4 ตัว
export function playWinJingle() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    setTimeout(() => playBeep(f, i === notes.length - 1 ? 0.4 : 0.14, 0.28), i * 120);
  });
}

// แพ้เคส — โน้ตลงช้าๆ
export function playLoseSound() {
  playBeep(392, 0.28, 0.22);
  setTimeout(() => playBeep(330, 0.28, 0.22), 300);
  setTimeout(() => playBeep(262, 0.5, 0.22), 600);
}

// ช็อตสำคัญ (ป้าย interstitial เด้ง) — เสียงตุบจาก white noise ผ่าน lowpass
export function playImpactSound() {
  try {
    const ctx = getAudioContext();
    const len = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 650;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch {
    // Audio not available
  }
}

// จังหวะ "ตุบ" เดี่ยวของเสียงหัวใจ — sine กวาดลงต่ำ ให้ได้ยินบนลำโพงมือถือ
function heartThump(ctx, at, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(55, at + 0.1);
  gain.gain.setValueAtTime(vol, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.14);
  osc.start(at);
  osc.stop(at + 0.15);
}

// หัวใจเต้นหนึ่งรอบ "ตุบ-ตุบ" (lub-dub) — เลเยอร์ความกดดันพื้นหลังของเกม
export function playHeartbeatThump(volume = 0.12) {
  try {
    const ctx = getAudioContext();
    heartThump(ctx, ctx.currentTime, volume);
    heartThump(ctx, ctx.currentTime + 0.16, volume * 0.6);
  } catch {
    // Audio not available
  }
}

// Initialize audio context on first user interaction
export function initAudio() {
  getAudioContext();
}
