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

// Initialize audio context on first user interaction
export function initAudio() {
  getAudioContext();
}
