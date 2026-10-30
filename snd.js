// 音のエンジン（素材なし・WebAudio）。曲は祭り囃子ふう、効果音は鉄板まわり
'use strict'
const Snd = {
  ctx: null, muted: false, next: 0, step: 0, track: null, want: null, switchAt: 0, played: {}, amb: null,
  TEMPO: { title: 104, play: 132, good: 120, sad: 70 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.master.connect(this.an); this.an.connect(this.ctx.destination)
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.0001; this.bgm.connect(this.master)
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, len)
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      if (this.want) { const w = this.want; this.want = null; this.setTrack(w) }
    } catch (e) { this.ctx = null }
  },
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7 },
  tone(f, t0, dur, type = 'square', vol = 0.2, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  noise(t0, dur, vol, freq, type = 'highpass', dest, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02)
  },
  level() { if (!this.an) return 0; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  mark(n) { this.played[n] = (this.played[n] || 0) + 1 },
  setTrack(name) {
    if (this.want === name) return
    this.want = name; if (!this.ctx) return
    const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.25)
    this.switchAt = now + 0.27
  },
  tick() {
    if (!this.ctx) return; const c = this.ctx
    if (this.switchAt && c.currentTime >= this.switchAt) {
      this.track = this.want; this.step = 0; this.next = c.currentTime + 0.05; this.switchAt = 0
      const g = this.bgm.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0.0001, c.currentTime); g.linearRampToValueAtTime(0.24, c.currentTime + 0.35)
      if (this.track) this.mark('bgm:' + this.track)
    }
    if (!this.track || this.switchAt) return
    const spb = 60 / this.TEMPO[this.track] / 4
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05
    while (this.next < c.currentTime + 0.25) { this['p_' + this.track](this.step, this.next); this.next += spb; this.step++ }
  },
  // 楽器
  taiko(t, v = 0.7) { this.tone(110, t, 0.28, 'sine', v, this.bgm, 48); this.noise(t, 0.05, v * 0.15, 900, 'lowpass', this.bgm) },
  kane(t, v = 0.05) { this.tone(2100, t, 0.08, 'square', v, this.bgm); this.tone(3150, t, 0.06, 'square', v * 0.5, this.bgm) },
  shami(n, t, vol = 0.07) { this.tone(this.mtof(n), t, 0.22, 'sawtooth', vol, this.bgm, this.mtof(n) * 0.995); this.tone(this.mtof(n + 12), t, 0.08, 'triangle', vol * 0.5, this.bgm) },
  fue(n, t, dur, vol = 0.06) { this.tone(this.mtof(n), t, dur, 'sine', vol, this.bgm); this.tone(this.mtof(n) * 2.01, t, dur * 0.7, 'sine', vol * 0.15, this.bgm) },
  bass(n, t, dur = 0.2, vol = 0.35) { this.tone(this.mtof(n), t, dur, 'triangle', vol, this.bgm) },
  // タイトル: のんびり縁日（ド・レ・ミ・ソ・ラ）
  p_title(i, t) {
    const s = i % 16, bar = Math.floor(i / 16) % 4
    if (s === 0 || s === 10) this.taiko(t, 0.45); if (s === 4 || s === 12) this.kane(t, 0.03)
    const root = [48, 45, 50, 43][bar]; if (s === 0 || s === 8) this.bass(root, t, 0.35, 0.28)
    const mel = [[72, -1, 74, 76, -1, 79, 76, -1], [74, -1, 72, 69, -1, 72, -1, -1], [76, -1, 79, 81, -1, 79, 76, 74], [72, -1, 74, 72, -1, -1, -1, -1]][bar]
    if (s % 2 === 0) { const n = mel[s / 2]; if (n > 0) this.fue(n, t, 0.32, 0.05) }
  },
  // プレイ: せわしない祭り囃子
  p_play(i, t) {
    const s = i % 16, bar = Math.floor(i / 16) % 4
    if (s === 0 || s === 3 || s === 8 || s === 11) this.taiko(t, s === 0 ? 0.75 : 0.5); if (s % 4 === 2) this.kane(t, 0.035)
    const root = [45, 48, 50, 43][bar]; if (s % 4 === 0) this.bass(root + (s === 8 ? 7 : 0), t, 0.16, 0.3)
    const pat = [[69, 72, 74, 76], [72, 74, 76, 79], [74, 76, 79, 81], [76, 74, 72, 69]][bar]
    if (s % 2 === 1) this.shami(pat[(s >> 1) % 4] - 12, t, 0.045)
    const mel = [[81, -1, 79, 76, 79, -1, 76, 74], [76, -1, 74, 72, 74, 76, -1, -1], [79, 81, -1, 84, 81, -1, 79, 76], [74, -1, 76, 74, 72, -1, -1, -1]][bar]
    if (Math.floor(i / 64) % 2 === 1 && s % 2 === 0) { const n = mel[s / 2]; if (n > 0) this.fue(n, t, 0.2, 0.045) }
  },
  // 結果（いい時）: 景気のいい手締め
  p_good(i, t) {
    const s = i % 16, bar = Math.floor(i / 16) % 2
    if (s % 4 === 0) this.taiko(t, 0.6); if (s % 4 === 2) this.kane(t, 0.04)
    const mel = [[72, 76, 79, 84, -1, 79, 84, -1], [81, 79, 76, 79, 72, -1, -1, -1]][bar]
    if (s % 2 === 0) { const n = mel[s / 2]; if (n > 0) this.fue(n, t, 0.24, 0.06) }
    if (s === 0) this.bass(bar ? 41 : 48, t, 0.6, 0.3)
  },
  // 結果（残念）: しょんぼり
  p_sad(i, t) {
    const s = i % 12, bar = Math.floor(i / 12) % 4
    if (s === 0) this.bass([45, 41, 40, 45][bar], t, 0.8, 0.26)
    const mel = [[76, 74, 72], [74, 72, 69], [71, 69, 68], [69, -1, -1]][bar]
    if (s % 4 === 0) { const n = mel[s / 4]; if (n > 0) this.fue(n - 12, t, 0.5, 0.06) }
  },
  // 鉄板のジュージュー（鳴りっぱなし。焼いている穴の数で大きさが変わる）
  ambient(on) {
    if (!this.ctx) return
    if (on && !this.amb) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
      s.buffer = this.noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = 3800; g.gain.value = 0.0001
      s.connect(f); f.connect(g); g.connect(this.master); s.start(); this.amb = { s, g }
    } else if (!on && this.amb) { try { this.amb.s.stop() } catch (e) {} this.amb = null }
  },
  sizzle(v) { if (!this.amb) return; this.amb.g.gain.setTargetAtTime(0.0001 + v * 0.06, this.ctx.currentTime, 0.1); if (v > 0) this.mark('sizzle') },
  crackle(v) { if (!this.ctx || !this.amb) return; const t = this.ctx.currentTime; if (Math.random() < 0.3 * v) this.noise(t + Math.random() * 0.05, 0.01, 0.03 + Math.random() * 0.06, 5500, 'highpass') },
  // お客さんの声（母音っぽいフィルタの付いたノコギリ波）
  voice(pitch, kind) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime; this.mark('voice:' + kind)
    const plans = { talk: [[1, 1.15, 0.09], [1.1, 0.95, 0.08], [0.95, 1.1, 0.1], [1.05, 0.9, 0.12]], wow: [[1.1, 1.9, 0.45]], ok: [[1, 1.2, 0.16], [1.15, 0.95, 0.2]], mad: [[0.95, 0.6, 0.16], [1.15, 0.7, 0.32]], cry: [[1.3, 1.0, 0.3], [1.25, 0.8, 0.5]] }[kind] || [[1, 1, 0.1]]
    let s = t
    for (const [a, b, d] of plans) {
      const o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), base = 170 * pitch
      o.type = 'sawtooth'; o.frequency.setValueAtTime(base * a, s); o.frequency.exponentialRampToValueAtTime(base * b, s + d)
      f.type = 'bandpass'; f.frequency.value = kind === 'mad' ? 850 : 1300; f.Q.value = 3
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(kind === 'mad' ? 0.5 : 0.34, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + d)
      o.connect(f); f.connect(g); g.connect(this.master); o.start(s); o.stop(s + d + 0.02); s += d * 0.9
    }
  },
  sfx(name, v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime; this.mark(name)
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'triangle', 0.12 * v); break
      case 'pour': for (let k = 0; k < 4; k++) this.tone(260 + k * 40, t + k * 0.05, 0.07, 'sine', 0.22, null, 140); this.noise(t + 0.18, 0.4, 0.1, 4200, 'highpass'); break
      case 'spin': this.tone(420, t, 0.16, 'triangle', 0.14, null, 1100); this.noise(t + 0.1, 0.18, 0.07, 3500, 'highpass'); break
      case 'perfect': this.tone(1320, t + 0.05, 0.12, 'sine', 0.14); this.tone(1760, t + 0.11, 0.22, 'sine', 0.12); break
      case 'round': this.tone(988, t + 0.05, 0.1, 'square', 0.06); this.tone(1319, t + 0.12, 0.1, 'square', 0.06); this.tone(1976, t + 0.19, 0.3, 'triangle', 0.1); break
      case 'splat': this.noise(t, 0.22, 0.45 * v, 650, 'lowpass'); this.tone(150, t, 0.18, 'sine', 0.35, null, 50); this.tone(520, t + 0.02, 0.2, 'triangle', 0.08, null, 180); break
      case 'burn': this.noise(t, 0.6, 0.18, 900, 'lowpass'); this.tone(90, t, 0.35, 'sine', 0.3, null, 50); break
      case 'scrape': for (let k = 0; k < 5; k++) this.noise(t + k * 0.06, 0.05, 0.12, 2400, 'bandpass', null, 4); break
      case 'box': this.tone(660, t, 0.06, 'triangle', 0.12); this.tone(520, t + 0.06, 0.08, 'sine', 0.1); break
      case 'nope': this.tone(240, t, 0.09, 'square', 0.06); this.tone(200, t + 0.1, 0.12, 'square', 0.06); break
      case 'serve': this.tone(784, t, 0.1, 'square', 0.07); this.tone(1046, t + 0.1, 0.1, 'square', 0.07); this.tone(1318, t + 0.2, 0.25, 'square', 0.07); this.noise(t + 0.3, 0.6, 0.06, 4000, 'highpass'); break
      case 'sauce': this.tone(180, t, 0.3, 'sine', 0.2, null, 90); this.noise(t, 0.3, 0.08, 500, 'lowpass'); break
      case 'sprinkle': for (let k = 0; k < 10; k++) this.noise(t + k * 0.03, 0.02, 0.07, 6000, 'highpass'); break
      case 'leave': this.tone(400, t, 0.4, 'triangle', 0.1, null, 160); break
      case 'go': this.taiko(t, 0.9); this.tone(660, t, 0.08, 'square', 0.08); this.tone(990, t + 0.08, 0.25, 'square', 0.08); break
      case 'tick': this.tone(1500, t, 0.03, 'square', 0.04); break
      case 'whistle': this.tone(2200, t, 0.5, 'sine', 0.12, null, 2000); this.tone(2600, t, 0.5, 'sine', 0.05); break
      case 'roll': for (let k = 0; k < 30; k++) this.noise(t + k * 0.04, 0.05, 0.05 + k * 0.004, 1800, 'bandpass'); break
      case 'ding': { const f = 440 * Math.pow(2, (v - 5) / 8); this.tone(f, t, 0.4, 'triangle', 0.25); this.tone(f * 2, t + 0.05, 0.3, 'sine', 0.12); break }
      case 'slam': this.tone(90, t, 0.5, 'sine', 0.8, null, 40); this.noise(t, 0.3, 0.3, 2000, 'lowpass'); break
      case 'cheer': this.noise(t, 1.6, 0.14, 1200, 'bandpass', null, 0.6); for (let k = 0; k < 4; k++) this.tone(1800, t + k * 0.3, 0.3, 'sine', 0.05, null, 2600); break
      case 'boo': for (let k = 0; k < 8; k++) { const f = 105 + Math.random() * 40; this.tone(f, t + Math.random() * 0.2, 1.3, 'sawtooth', 0.04, null, f * 0.7) } break
      case 'crow': this.tone(700, t, 0.25, 'sawtooth', 0.08, null, 450); this.tone(650, t + 0.35, 0.3, 'sawtooth', 0.08, null, 420); break
    }
  },
}
