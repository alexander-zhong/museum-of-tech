// Tiny synthesized SFX — no audio assets, everything from one AudioContext.
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function env(gainNode: GainNode, t0: number, peak: number, decay: number) {
  gainNode.gain.setValueAtTime(0.0001, t0);
  gainNode.gain.exponentialRampToValueAtTime(peak, t0 + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function noiseBuffer(a: AudioContext, seconds: number): AudioBuffer {
  const buf = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function sfxShoot() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  // noise crack
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 0.15);
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(3200, t);
  f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
  const g = a.createGain();
  env(g, t, 0.5, 0.14);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  // low thump
  const o = a.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
  const g2 = a.createGain();
  env(g2, t, 0.45, 0.12);
  o.connect(g2).connect(a.destination);
  o.start(t);
  o.stop(t + 0.15);
}

export function sfxHit() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(880, t);
  o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
  const g = a.createGain();
  env(g, t, 0.18, 0.12);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.14);
}

export function sfxDing() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  [660, 880, 1100].forEach((freq, i) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = a.createGain();
    env(g, t + i * 0.09, 0.15, 0.35);
    o.connect(g).connect(a.destination);
    o.start(t + i * 0.09);
    o.stop(t + i * 0.09 + 0.4);
  });
}

let ambientStarted = false;
export function startAmbient() {
  if (ambientStarted) return;
  const a = ac();
  if (!a) return;
  ambientStarted = true;
  // museum-at-night drone: two detuned low sines + filtered noise bed
  const master = a.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(0.028, a.currentTime + 4);
  master.connect(a.destination);
  [55, 55.7].forEach((freq) => {
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = 0.5;
    o.connect(g).connect(master);
    o.start();
  });
  const noise = a.createBufferSource();
  noise.buffer = noiseBuffer(a, 2);
  noise.loop = true;
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 220;
  const ng = a.createGain();
  ng.gain.value = 0.18;
  noise.connect(f).connect(ng).connect(master);
  noise.start();
}

export function sfxFootstep() {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, 0.05);
  const f = a.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 380 + Math.random() * 120;
  const g = a.createGain();
  env(g, t, 0.07, 0.07);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}
