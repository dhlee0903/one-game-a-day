// WebAudio 효과음. 파일 없이 오실레이터·노이즈로만 만든다.

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.noise = null;
  }

  enable(v) { this.on = v; }

  resume() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _env(node, t, dur, peak) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(this.master);
    return g;
  }

  _tone(type, f0, f1, dur, peak) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(o, t, dur, peak);
    o.start(t); o.stop(t + dur + 0.03);
  }

  _noise(dur, peak, freq, q) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    src.connect(bp);
    this._env(bp, t, dur, peak);
    src.start(t);
  }

  hop() { this._tone('square', 300, 620, 0.07, 0.16); }
  step() { this._tone('sine', 210, 130, 0.08, 0.12); }
  bump() { this._tone('square', 150, 90, 0.09, 0.14); }
  coin() {
    this._tone('square', 880, 900, 0.06, 0.16);
    setTimeout(() => this._tone('square', 1320, 1330, 0.09, 0.14), 60);
  }

  die(cause) {
    if (cause === 'water') { this._noise(0.42, 0.30, 900, 0.7); this._tone('sine', 420, 90, 0.35, 0.12); }
    else if (cause === 'train') { this._tone('sawtooth', 180, 120, 0.55, 0.22); this._noise(0.5, 0.22, 500, 0.6); }
    else if (cause === 'eagle') { this._tone('sawtooth', 1200, 380, 0.45, 0.16); this._noise(0.3, 0.14, 2200, 1.2); }
    else { this._noise(0.22, 0.32, 320, 0.5); this._tone('square', 200, 70, 0.22, 0.2); }
  }
}
