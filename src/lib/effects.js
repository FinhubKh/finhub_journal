/**
 * nXuu — effects.js
 * WebAudio checklist ticks/fanfare + confetti burst. Ported 1:1 from app.js.
 */

const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let audioUnlocked = false;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtxClass();
  return audioCtx;
}

function withAudio(fn) {
  try {
    const c = getAudioCtx();
    c.state === 'suspended' ? c.resume().then(fn).catch(() => {}) : fn();
  } catch (e) { /* ignore */ }
}

export function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    const c = getAudioCtx();
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
    if (c.state === 'suspended') c.resume();
  } catch (e) { /* ignore */ }
}

export function playTick() {
  withAudio(() => {
    try {
      const c = getAudioCtx(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = 600;
      g.gain.setValueAtTime(0.18, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
      o.start(); o.stop(c.currentTime + 0.12);
    } catch (e) { /* ignore */ }
  });
}

export function playUncheck() {
  withAudio(() => {
    try {
      const c = getAudioCtx(), o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = 350;
      g.gain.setValueAtTime(0.1, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1);
      o.start(); o.stop(c.currentTime + 0.1);
    } catch (e) { /* ignore */ }
  });
}

export function playFanfare() {
  withAudio(() => {
    try {
      const c = getAudioCtx();
      [523, 659, 784, 1047].forEach((f, i) => {
        const o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.type = 'sine'; o.frequency.value = f;
        const s = c.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.22, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.3);
        o.start(s); o.stop(s + 0.3);
      });
    } catch (e) { /* ignore */ }
  });
}

const CC = ['#6b7a52', '#8a9a6a', '#c8d4b0', '#a08040', '#c8a84b', '#4a6a8a', '#6a4a8a', '#f2ede4', '#1e1c18'];

export function fireConfetti(containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    const sz = Math.random() * 8 + 5;
    const rect = Math.random() > 0.5;
    p.style.cssText = `left:${Math.random() * 100}vw;width:${sz}px;height:${rect ? sz * 2.5 : sz}px;background:${CC[Math.floor(Math.random() * CC.length)]};border-radius:${rect ? '2px' : '50%'};animation-delay:${Math.random() * 0.6}s;animation-duration:${Math.random() * 1.5 + 1.8}s;--drift:${Math.random() * 140 - 70}px;--rotate:${Math.random() * 720 - 360}deg;`;
    containerEl.appendChild(p);
  }
  setTimeout(() => { containerEl.innerHTML = ''; }, 5000);
}
