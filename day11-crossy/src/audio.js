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

  // 건널목 종 "땡" — 금속을 때린 소리라 배음이 살짝 어긋난 두 개를 겹친다.
  bell() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [f, peak] of [[1180, 0.14], [1770, 0.07]]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.42);
    }
  }

  // 기차가 지나갈 때 "슈우우웅" — 지나가며 음이 내려가는 도플러를 흉내낸다.
  // 넓은 대역 노이즈를 밴드패스로 훑고, 아래에 낮은 울림을 깐다.
  whoosh(dur = 1.5) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(420, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + dur * 0.42);
    bp.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + dur * 0.3);
    g.gain.setValueAtTime(0.26, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t);
    // 바닥에 깔리는 저음 울림
    this._tone('sawtooth', 92, 62, dur * 0.9, 0.09);
  }

  // 자동차 경적 — 두 음을 겹친 짧은 "빵".
  honk() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const f of [420, 530]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.075, t + 0.02);
      g.gain.setValueAtTime(0.075, t + 0.16);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.28);
    }
  }

  // 독수리 울음 — 높은 데서 떨며 내려오는 새된 소리.
  screech() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1650, t);
    o.frequency.exponentialRampToValueAtTime(2100, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.62);
    // 떨림(비브라토)을 얹어야 새 울음처럼 들린다.
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.setValueAtTime(24, t);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(150, t);
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 700;
    o.connect(hp);
    this._env(hp, t, 0.62, 0.17);
    o.start(t); o.stop(t + 0.68);
    lfo.start(t); lfo.stop(t + 0.68);
    this._noise(0.4, 0.09, 2600, 1.6);
  }

  // 새 캐릭터를 뽑았을 때 — 올라가는 세 음.
  fanfare() {
    [0, 90, 180].forEach((ms, i) => {
      setTimeout(() => this._tone('square', 520 + i * 180, 530 + i * 180, 0.16, 0.15), ms);
    });
    setTimeout(() => this._tone('square', 1180, 1190, 0.3, 0.13), 280);
  }

  die(cause) {
    if (cause === 'water') { this._noise(0.42, 0.30, 900, 0.7); this._tone('sine', 420, 90, 0.35, 0.12); }
    else if (cause === 'train') { this._tone('sawtooth', 180, 120, 0.55, 0.22); this._noise(0.5, 0.22, 500, 0.6); }
    else if (cause === 'eagle') { this.screech(); }
    else { this._noise(0.22, 0.32, 320, 0.5); this._tone('square', 200, 70, 0.22, 0.2); }
  }
}
