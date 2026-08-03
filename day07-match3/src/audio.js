// Procedural sound via the Web Audio API — no audio files, zero dependencies.
// Tones and a noise burst are synthesised on the fly. The context is created
// lazily and resumed on the first user gesture (browser autoplay policy).

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  _ac() {
    if (!this.ctx) {
      const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      try { this.ctx = new AC(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  resume() { this._ac(); }

  setMuted(m) { this.muted = m; }

  _tone(freq, dur, { type = 'sine', gain = 0.2, slideTo = null, delay = 0 } = {}) {
    const ac = this._ac();
    if (!ac || this.muted) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  _noise(dur, { gain = 0.2, lp = 1200, delay = 0 } = {}) {
    const ac = this._ac();
    if (!ac || this.muted) return;
    const t = ac.currentTime + delay;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(lp, t);
    f.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  // ---- game sounds ----

  swap() { this._tone(420, 0.06, { type: 'triangle', gain: 0.1, slideTo: 520 }); }

  invalid() { this._tone(190, 0.15, { type: 'sawtooth', gain: 0.1, slideTo: 110 }); }

  clear(combo = 0) {
    const base = 440 + Math.min(combo, 8) * 70;
    this._tone(base, 0.09, { type: 'triangle', gain: 0.14, slideTo: base * 1.3 });
    this._tone(base * 1.5, 0.07, { type: 'sine', gain: 0.06, delay: 0.02 });
  }

  special() {
    this._tone(700, 0.12, { type: 'sine', gain: 0.12, slideTo: 1250 });
    this._tone(1000, 0.1, { type: 'sine', gain: 0.07, delay: 0.05 });
  }

  boom() {
    this._noise(0.3, { gain: 0.22, lp: 900 });
    this._tone(120, 0.32, { type: 'sine', gain: 0.16, slideTo: 45 });
  }

  combo(n) {
    const f = 500 + n * 80;
    this._tone(f, 0.14, { type: 'square', gain: 0.08, slideTo: f * 1.4 });
  }

  win() { [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.2, { type: 'triangle', gain: 0.16, delay: i * 0.11 })); }

  lose() { [392, 330, 262].forEach((f, i) => this._tone(f, 0.26, { type: 'sawtooth', gain: 0.12, delay: i * 0.14 })); }
}
