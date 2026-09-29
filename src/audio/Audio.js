// Áudio 100% procedural (WebAudio): efeitos sintetizados e trilha sonora sequenciada.
// Agendamento com "lookahead" — Chris Wilson, "A Tale of Two Clocks" (2013).
import { TRACKS } from './tracks.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.current = null;
    this.pendingTrack = null;
    this.stepCount = 0;
    settings.onChange((k) => {
      if (k === 'musicVolume' || k === 'sfxVolume') this.applyVolumes();
    });
  }

  // O navegador só libera áudio após um gesto do usuário.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC({ latencyHint: 'interactive' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.knee.value = 12;
      this.comp.ratio.value = 4;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.2;
      this.master.connect(this.comp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      // reverb com resposta ao impulso gerada (ruído com decaimento exponencial)
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.6, 3.2);
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.32;
      this.reverb.connect(this.reverbGain).connect(this.master);
      this.noiseBuf = this.makeNoise(2);
      this.applyVolumes();
      this.scheduler = setInterval(() => this.schedule(), 25);
      if (this.pendingTrack !== null) {
        const t = this.pendingTrack;
        this.pendingTrack = null;
        this.music(t);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  // abaixa a música (pausa, diálogos importantes)
  duck(on) {
    this.ducked = on;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.settings.musicVolume * 0.55 * (this.ducked ? 0.35 : 1), t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.settings.sfxVolume * 0.9, t, 0.05);
  }

  impulse(seconds, decay) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ------------------------------------------------------------------ blocos
  out(bus, pan = 0, reverb = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      node = p;
    }
    node.connect(bus);
    if (reverb > 0) {
      const s = ctx.createGain();
      s.gain.value = reverb;
      g.connect(s).connect(this.reverb);
    }
    return g;
  }

  tone(o) {
    const ctx = this.ctx;
    const t = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.glide ?? o.dur));
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibRate || 6;
      lg.gain.value = o.vib;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + o.dur + 0.1);
    }
    const env = ctx.createGain();
    const a = o.a ?? 0.005, peak = o.g ?? 0.3;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type || 'lowpass';
      f.frequency.setValueAtTime(o.filter.f, t);
      if (o.filter.f2) f.frequency.exponentialRampToValueAtTime(o.filter.f2, t + o.dur);
      f.Q.value = o.filter.q ?? 0.7;
      osc.connect(f);
      node = f;
    }
    node.connect(env).connect(o.dest || this.out(this.sfxBus, o.pan, o.rev ?? 0.1));
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  noise(o) {
    const ctx = this.ctx;
    const t = o.t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f || 2000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.sweep ?? o.dur));
    f.Q.value = o.q ?? 0.8;
    const env = ctx.createGain();
    const a = o.a ?? 0.004;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(o.g ?? 0.3, t + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(env).connect(o.dest || this.out(this.sfxBus, o.pan, o.rev ?? 0.08));
    src.start(t, Math.random() * 1.5);
    src.stop(t + o.dur + 0.05);
  }

  bell(o) {
    // FM: portadora + moduladora com índice decrescente (sino/celesta)
    const ctx = this.ctx;
    const t = o.t ?? ctx.currentTime;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    car.frequency.value = o.f;
    mod.frequency.value = o.f * (o.ratio ?? 3.5);
    mg.gain.setValueAtTime(o.f * (o.index ?? 2.2), t);
    mg.gain.exponentialRampToValueAtTime(1, t + o.dur * 0.8);
    mod.connect(mg).connect(car.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(o.g ?? 0.2, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    car.connect(env).connect(o.dest || this.out(this.sfxBus, o.pan, o.rev ?? 0.25));
    car.start(t);
    mod.start(t);
    car.stop(t + o.dur + 0.05);
    mod.stop(t + o.dur + 0.05);
  }

  // ------------------------------------------------------------------ efeitos
  sfx(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const pan = o.pan || 0;
    const v = o.volume ?? 1;
    const t = this.ctx.currentTime;
    const P = o.pitch ?? 1;
    switch (name) {
      case 'jump':
        this.tone({ type: 'square', f: 330 * P, f2: 720 * P, dur: 0.14, g: 0.09 * v, pan, filter: { f: 2400 } });
        this.tone({ type: 'sine', f: 660 * P, f2: 1200 * P, dur: 0.1, g: 0.08 * v, pan });
        break;
      case 'doubleJump':
        this.tone({ type: 'triangle', f: 700 * P, f2: 1400 * P, dur: 0.16, g: 0.12 * v, pan });
        this.bell({ f: 1568, dur: 0.4, g: 0.06, pan, t: t + 0.04 });
        this.bell({ f: 2093, dur: 0.4, g: 0.05, pan, t: t + 0.09 });
        break;
      case 'longJump':
        this.noise({ f: 500, f2: 2600, ft: 'bandpass', q: 2, dur: 0.35, g: 0.18 * v, pan });
        this.tone({ type: 'triangle', f: 260, f2: 520, dur: 0.2, g: 0.1, pan });
        break;
      case 'land':
        this.tone({ type: 'sine', f: 140, f2: 55, dur: 0.14, g: 0.28 * v, pan, rev: 0.02 });
        this.noise({ f: 900, dur: 0.1, g: 0.12 * v, pan });
        break;
      case 'step': {
        const s = o.surface;
        const vol = (o.volume ?? 0.35) * (0.8 + Math.random() * 0.4);
        if (s === 'wood') this.tone({ type: 'triangle', f: 190 + Math.random() * 30, f2: 120, dur: 0.07, g: 0.12 * vol, pan, rev: 0.02 });
        else if (s === 'metal') this.tone({ type: 'square', f: 1800 + Math.random() * 300, dur: 0.05, g: 0.03 * vol, pan, filter: { f: 3000, type: 'bandpass', q: 6 } });
        else if (s === 'crystal') this.bell({ f: 2400 + Math.random() * 600, dur: 0.15, g: 0.03 * vol, pan });
        else if (s === 'cloud') this.noise({ f: 700, dur: 0.08, g: 0.05 * vol, pan });
        else if (s === 'grass') this.noise({ f: 5000, ft: 'highpass', dur: 0.06, g: 0.08 * vol, pan });
        else this.noise({ f: 1100, ft: 'bandpass', q: 1.5, dur: 0.06, g: 0.16 * vol, pan });
        break;
      }
      case 'spin':
        this.noise({ f: 600, f2: 3200, ft: 'bandpass', q: 3, dur: 0.32, sweep: 0.2, g: 0.2 * v, pan });
        this.tone({ type: 'triangle', f: 500, f2: 900, dur: 0.2, g: 0.05, pan });
        break;
      case 'roll':
        this.noise({ f: 400, f2: 180, dur: 0.3, g: 0.2 * v, pan });
        break;
      case 'poundStart':
        this.tone({ type: 'triangle', f: 300, f2: 1100, dur: 0.18, g: 0.12 * v, pan });
        break;
      case 'pound':
        this.tone({ type: 'sine', f: 110, f2: 35, dur: 0.4, g: 0.5 * v, pan, rev: 0.05 });
        this.noise({ f: 1400, f2: 200, dur: 0.35, g: 0.35 * v, pan });
        if (o.heavy) this.tone({ type: 'sine', f: 60, f2: 28, dur: 0.6, g: 0.4, pan });
        break;
      case 'hurt':
        this.tone({ type: 'square', f: 520, f2: 180, dur: 0.28, g: 0.12 * v, pan, filter: { f: 1800 } });
        this.noise({ f: 2000, dur: 0.15, g: 0.12, pan });
        break;
      case 'fall':
        this.tone({ type: 'sine', f: 900, f2: 140, dur: 0.9, g: 0.14 * v, pan, vib: 12, vibRate: 7 });
        break;
      case 'spark': {
        const c = Math.min(PENTA.length - 1, o.chain || 0);
        const f = mtof(76 + PENTA[c]);
        this.bell({ f, dur: 0.35, g: 0.08 * v, pan, ratio: 2, index: 1.2, rev: 0.2 });
        this.tone({ type: 'sine', f: f * 2, dur: 0.12, g: 0.04, pan });
        break;
      }
      case 'seed': {
        const notes = [72, 76, 79, 84, 88, 91, 96];
        notes.forEach((n, i) => this.bell({ f: mtof(n), dur: 1.2, g: 0.12, t: t + i * 0.07, rev: 0.5 }));
        this.tone({ type: 'sawtooth', f: mtof(60), dur: 1.6, g: 0.05, a: 0.1, filter: { f: 1200 }, rev: 0.4 });
        this.tone({ type: 'sawtooth', f: mtof(67), dur: 1.6, g: 0.04, a: 0.1, filter: { f: 1200 }, rev: 0.4 });
        break;
      }
      case 'heart':
        this.bell({ f: mtof(81), dur: 0.5, g: 0.12, pan });
        this.bell({ f: mtof(88), dur: 0.6, g: 0.1, pan, t: t + 0.09 });
        break;
      case 'stomp':
        this.tone({ type: 'triangle', f: 420, f2: 160, dur: 0.18, g: 0.2 * v, pan, vib: 30, vibRate: 30 });
        this.noise({ f: 900, dur: 0.1, g: 0.15, pan });
        break;
      case 'headBounce':
        this.tone({ type: 'sine', f: 500, f2: 1000, dur: 0.16, g: 0.16 * v, pan, vib: 20, vibRate: 25 });
        break;
      case 'enemyHit':
        this.noise({ f: 2500, f2: 400, dur: 0.18, g: 0.25 * v, pan });
        this.tone({ type: 'square', f: 300, f2: 90, dur: 0.18, g: 0.1, pan, filter: { f: 1500 } });
        break;
      case 'poof':
        this.noise({ f: 1200, f2: 300, dur: 0.3, g: 0.14 * v, pan, rev: 0.2 });
        break;
      case 'crate':
        this.noise({ f: 1400, ft: 'bandpass', q: 1.5, dur: 0.12, g: 0.3 * v, pan });
        this.noise({ f: 500, ft: 'bandpass', q: 1, dur: 0.25, g: 0.2 * v, pan, t: t + 0.03 });
        this.tone({ type: 'triangle', f: 180, f2: 90, dur: 0.15, g: 0.12, pan });
        break;
      case 'checkpoint':
        [72, 76, 79, 84].forEach((n, i) => this.bell({ f: mtof(n), dur: 1.4, g: 0.1, t: t + i * 0.06, rev: 0.6, pan }));
        this.noise({ f: 3000, ft: 'highpass', dur: 0.6, g: 0.05, a: 0.1, pan });
        break;
      case 'veil':
        [60, 64, 67, 71, 74, 76, 79, 83].forEach((n, i) => this.bell({ f: mtof(n + 12), dur: 1.6, g: 0.09, t: t + i * 0.05, rev: 0.6 }));
        this.noise({ f: 300, f2: 6000, ft: 'bandpass', q: 2, dur: 1.2, g: 0.12, a: 0.3 });
        break;
      case 'bounce':
        this.tone({ type: 'sine', f: 180, f2: 620, dur: 0.3, g: 0.25 * v, pan, vib: 25, vibRate: 18 });
        break;
      case 'crumble':
        for (let i = 0; i < 4; i++) this.noise({ f: 800 + Math.random() * 1500, ft: 'bandpass', q: 3, dur: 0.06, g: 0.12, pan, t: t + i * 0.08 });
        break;
      case 'alert':
        this.tone({ type: 'square', f: 880, dur: 0.07, g: 0.06, pan, filter: { f: 3000 } });
        this.tone({ type: 'square', f: 1320, dur: 0.1, g: 0.06, pan, filter: { f: 3000 }, t: t + 0.08 });
        break;
      case 'stun':
        this.tone({ type: 'triangle', f: 600, f2: 300, dur: 0.5, g: 0.1, pan, vib: 40, vibRate: 12 });
        break;
      case 'swoop':
        this.noise({ f: 300, f2: 1800, ft: 'bandpass', q: 4, dur: 0.6, g: 0.12, pan });
        break;
      case 'bridge':
        this.bell({ f: mtof(84 + Math.floor(Math.random() * 3) * 4), dur: 0.5, g: 0.04 * v, pan });
        break;
      case 'bubblePop':
        this.tone({ type: 'sine', f: 1100, f2: 250, dur: 0.12, g: 0.2, pan });
        this.noise({ f: 4000, ft: 'highpass', dur: 0.05, g: 0.12, pan });
        break;
      case 'goal': {
        const mel = [[67, 0], [72, 0.15], [76, 0.3], [79, 0.45], [84, 0.7], [79, 0.95], [84, 1.1], [88, 1.3]];
        mel.forEach(([n, d]) => {
          this.bell({ f: mtof(n), dur: 1.0, g: 0.12, t: t + d, rev: 0.5 });
          this.tone({ type: 'sawtooth', f: mtof(n - 12), dur: 0.35, g: 0.05, t: t + d, filter: { f: 1800 }, rev: 0.3 });
        });
        [48, 55, 64].forEach((n) => this.tone({ type: 'sawtooth', f: mtof(n), dur: 2.6, g: 0.05, a: 0.2, t: t + 1.3, filter: { f: 1400 }, rev: 0.5 }));
        this.noise({ f: 8000, ft: 'highpass', dur: 2.0, g: 0.04, a: 0.5, t: t + 1.2 });
        break;
      }
      case 'thunder':
        this.noise({ f: 400, f2: 60, dur: 2.5, g: 0.5 * v, a: 0.02, rev: 0.3 });
        this.noise({ f: 1800, ft: 'bandpass', dur: 0.2, g: 0.2 * v });
        break;
      case 'uiMove':
        this.tone({ type: 'triangle', f: 1200, dur: 0.05, g: 0.05, rev: 0.02 });
        break;
      case 'uiConfirm':
        this.tone({ type: 'triangle', f: 880, dur: 0.08, g: 0.08 });
        this.tone({ type: 'triangle', f: 1320, dur: 0.12, g: 0.08, t: t + 0.07 });
        break;
      case 'uiBack':
        this.tone({ type: 'triangle', f: 700, dur: 0.08, g: 0.07 });
        this.tone({ type: 'triangle', f: 460, dur: 0.12, g: 0.07, t: t + 0.07 });
        break;
      case 'join':
        [76, 81, 88].forEach((n, i) => this.bell({ f: mtof(n), dur: 0.7, g: 0.1, t: t + i * 0.06, pan }));
        break;
      case 'ready':
        this.bell({ f: mtof(84), dur: 0.5, g: 0.1, pan });
        this.bell({ f: mtof(91), dur: 0.7, g: 0.1, pan, t: t + 0.1 });
        break;
      case 'start':
        [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.bell({ f: mtof(n), dur: 1.0, g: 0.08, t: t + i * 0.045, rev: 0.4 }));
        break;
      case 'typewriter':
        this.tone({ type: 'square', f: 500 + Math.random() * 200, dur: 0.03, g: 0.025, filter: { f: 2500 }, rev: 0 });
        break;
      case 'bossRoar':
        [36, 37, 43].forEach((n) => this.tone({ type: 'sawtooth', f: mtof(n), f2: mtof(n - 5), dur: 1.6, g: 0.14, a: 0.1, filter: { f: 700, f2: 300, q: 4 }, rev: 0.4 }));
        this.noise({ f: 600, ft: 'bandpass', q: 1.5, dur: 1.5, g: 0.25, a: 0.1, rev: 0.4 });
        break;
      case 'bossHit':
        this.tone({ type: 'sine', f: 90, f2: 30, dur: 0.7, g: 0.6, rev: 0.3 });
        this.noise({ f: 3000, f2: 200, dur: 0.6, g: 0.4, rev: 0.4 });
        [79, 83, 86].forEach((n, i) => this.bell({ f: mtof(n), dur: 0.8, g: 0.08, t: t + i * 0.05 }));
        break;
      case 'bossSlam':
        this.tone({ type: 'sine', f: 70, f2: 25, dur: 0.9, g: 0.7, rev: 0.3 });
        this.noise({ f: 900, f2: 100, dur: 0.8, g: 0.45, rev: 0.3 });
        break;
      case 'bossWing':
        this.noise({ f: 200, f2: 900, ft: 'bandpass', q: 1.2, dur: 0.9, g: 0.25, a: 0.2, pan });
        break;
      case 'bossOrb':
        this.tone({ type: 'sine', f: 400, f2: 900, dur: 0.3, g: 0.08, pan, vib: 50, vibRate: 20 });
        break;
      case 'bossDefeat':
        this.tone({ type: 'sine', f: 60, f2: 20, dur: 2.5, g: 0.6, rev: 0.6 });
        this.noise({ f: 5000, f2: 100, dur: 2.5, g: 0.4, rev: 0.6 });
        [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => this.bell({ f: mtof(n), dur: 2.5, g: 0.1, t: t + 0.8 + i * 0.1, rev: 0.7 }));
        break;
      case 'lightBeam':
        this.tone({ type: 'sawtooth', f: mtof(72), dur: 1.2, g: 0.06, a: 0.05, filter: { f: 800, f2: 5000 }, rev: 0.5 });
        this.bell({ f: mtof(96), dur: 1, g: 0.06 });
        break;
      default:
        break;
    }
  }

  // ------------------------------------------------------------------ música
  music(name) {
    if (!this.ctx) {
      this.pendingTrack = name;
      return;
    }
    if (this.current && this.current.name === name) return;
    const ctx = this.ctx;
    if (this.current) {
      const old = this.current;
      old.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.35);
      setTimeout(() => old.bus.disconnect(), 2000);
    }
    this.current = null;
    if (!name || !TRACKS[name]) return;
    const tr = TRACKS[name];
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.2);
    bus.connect(this.musicBus);
    const rv = ctx.createGain();
    rv.gain.value = tr.reverb ?? 0.35;
    bus.connect(rv).connect(this.reverb);
    this.current = { name, tr, bus, step: 0, next: ctx.currentTime + 0.12 };
  }

  schedule() {
    const c = this.current;
    if (!c || !this.ctx) return;
    const ctx = this.ctx;
    const tr = c.tr;
    const stepDur = 60 / tr.bpm / 4;
    // aba oculta / travada: pula os passos atrasados em vez de tocá-los todos de uma vez
    if (c.next < ctx.currentTime - 0.25) {
      const skip = Math.ceil((ctx.currentTime - c.next) / stepDur);
      c.step += skip;
      c.next += skip * stepDur;
    }
    while (c.next < ctx.currentTime + 0.15) {
      this.playStep(c, c.step, c.next, stepDur);
      c.step++;
      c.next += stepDur * (c.step % 2 === 1 ? 1 + (tr.swing ?? 0) : 1 - (tr.swing ?? 0));
    }
  }

  playStep(c, step, t, sd) {
    const tr = c.tr;
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const chord = tr.chords[bar % tr.chords.length];
    const root = tr.root;
    const dest = c.bus;
    // pad (início de cada compasso)
    if (s === 0 && tr.pad) {
      for (const n of chord) {
        this.tone({
          type: tr.pad.wave || 'sawtooth', f: mtof(root + n + (tr.pad.oct ?? 0) * 12), dur: sd * 16 * 1.05, a: tr.pad.attack ?? 0.4,
          g: tr.pad.gain ?? 0.03, t, detune: (Math.random() - 0.5) * 14, filter: { f: tr.pad.cutoff ?? 1200, q: 0.5 }, dest,
        });
      }
    }
    // baixo
    if (tr.bass && tr.bass.pattern[s]) {
      const n = chord[0] + (tr.bass.pattern[s] === 2 ? 7 : 0) + (tr.bass.oct ?? -2) * 12;
      this.tone({ type: tr.bass.wave || 'triangle', f: mtof(root + n), dur: sd * (tr.bass.len ?? 1.8), g: tr.bass.gain ?? 0.16, t, filter: { f: 900 }, dest });
    }
    // arpejo
    if (tr.arp && tr.arp.pattern[s]) {
      const idx = tr.arp.order[(Math.floor(step / (tr.arp.rate ?? 1))) % tr.arp.order.length];
      const n = chord[idx % chord.length] + 12 * Math.floor(idx / chord.length) + (tr.arp.oct ?? 1) * 12;
      if (tr.arp.inst === 'bell') this.bell({ f: mtof(root + n), dur: sd * 3.5, g: tr.arp.gain ?? 0.05, t, ratio: 3.5, index: 1.5, dest });
      else this.pluck(mtof(root + n), t, sd * (tr.arp.len ?? 2.5), tr.arp.gain ?? 0.06, dest, tr.arp.wave);
    }
    // melodia
    if (tr.melody) {
      const phraseLen = tr.melody.length;
      const m = tr.melody[bar % phraseLen];
      for (const [st, deg, len] of m) {
        if (st !== s || deg === null) continue;
        const f = mtof(root + deg + (tr.lead?.oct ?? 1) * 12);
        const L = tr.lead || {};
        if (L.inst === 'bell') this.bell({ f, dur: sd * len * 1.3, g: L.gain ?? 0.07, t, ratio: L.ratio ?? 2, index: L.index ?? 1.4, dest });
        else if (L.inst === 'whistle') this.tone({ type: 'sine', f, dur: sd * len, a: 0.03, g: L.gain ?? 0.07, t, vib: 5, vibRate: 5.5, dest });
        else this.tone({ type: L.wave || 'square', f, dur: sd * len, a: 0.01, g: L.gain ?? 0.04, t, filter: { f: L.cutoff ?? 2200 }, vib: 3, vibRate: 5, dest });
      }
    }
    // bateria
    const d = tr.drums;
    if (d) {
      if (d.kick?.[s]) {
        this.tone({ type: 'sine', f: 150, f2: 42, glide: 0.11, dur: 0.22, g: d.kickGain ?? 0.32, t, dest });
      }
      if (d.snare?.[s]) {
        this.noise({ f: 1800, ft: 'highpass', dur: 0.14, g: d.snareGain ?? 0.12, t, dest });
        this.tone({ type: 'triangle', f: 190, f2: 140, dur: 0.08, g: 0.07, t, dest });
      }
      if (d.hat?.[s]) this.noise({ f: 8000, ft: 'highpass', dur: d.hat[s] === 2 ? 0.12 : 0.035, g: d.hatGain ?? 0.04, t, dest });
      if (d.tick?.[s]) this.tone({ type: 'sine', f: s % 8 === 0 ? 2400 : 1800, dur: 0.03, g: d.tickGain ?? 0.03, t, dest });
      if (d.tom?.[s]) this.tone({ type: 'sine', f: 120, f2: 70, dur: 0.25, g: 0.18, t, dest });
    }
  }

  pluck(f, t, dur, g, dest, wave = 'marimba') {
    if (wave === 'marimba') {
      this.tone({ type: 'sine', f, dur, g, t, dest, a: 0.002 });
      this.tone({ type: 'sine', f: f * 4, dur: dur * 0.3, g: g * 0.25, t, dest, a: 0.002 });
    } else {
      this.tone({ type: wave, f, dur, g: g * 0.6, t, dest, a: 0.002, filter: { f: 3000, f2: 500 } });
    }
  }
}
