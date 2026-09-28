// Orquestra o jogo: estados (título, seleção, história, jogo, pausa, resultados, final),
// loop principal, sessão cooperativa (entrar/sair a qualquer momento) e integração entre
// renderer, entrada, áudio e UI.
import * as THREE from 'three';
import { Settings, SaveData } from './Storage.js';
import { Input } from './Input.js';
import { Renderer } from '../render/Renderer.js';
import { AudioEngine } from '../audio/Audio.js';
import { UI } from '../ui/UI.js';
import { World } from '../world/World.js';
import { LEVELS } from '../world/levels/index.js';
import { LOBBY_STAGE, LOBBY_X } from '../world/levels/stages.js';
import { CHARACTERS, buildCharacter } from '../entities/characters.js';
import { SCRIPT, CREDITS } from '../story/script.js';

const INTRO_KEYS = ['prados_intro', 'desfiladeiro_intro', 'cidadela_intro', 'chefe_intro'];
const OUTRO_KEYS = ['prados_fim', 'desfiladeiro_fim', 'cidadela_fim', null];

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.settings = new Settings();
    this.save = new SaveData();
    this.renderer = new Renderer(canvas, this.settings);
    this.input = new Input();
    this.audio = new AudioEngine(this.settings);
    this.ui = new UI(this, uiRoot);
    this.world = null;
    this.state = 'boot';
    this.time = 0;
    this.last = performance.now();
    this.session = { sparks: 0, seeds: [false, false, false] };
    this.roster = [];
    this.fps = 60;
    this.debug = {};
    this.lobby = null;
    this.levelIndex = 0;
    window.addEventListener('pointerdown', () => {
      this.audio.unlock();
      this.input.mouseClicked = true;
    });
    window.addEventListener('keydown', () => this.audio.unlock());
  }

  async start() {
    const params = new URLSearchParams(location.search);
    if (params.get('quality')) this.settings.quality = params.get('quality');
    if (params.get('dynres') === '0') this.settings.dynamicRes = false;
    this.parseDebug(params);
    this.renderer.applyQuality();
    const lvl = params.get('level');
    if (lvl !== null) {
      const n = Math.max(1, Math.min(4, Number(params.get('players') || 1)));
      const chars = (params.get('chars') || 'lampi,nuvi,musgo,zuca').split(',');
      const devices = ['kb1', 'kb2', 'pad0', 'pad1'];
      this.roster = Array.from({ length: n }, (_, i) => ({ slot: i, deviceId: devices[i], charId: chars[i] || CHARACTERS[i].id }));
      if (params.get('split') === '1') this.settings.splitScreen = true;
      this.startLevel(Number(lvl), params.get('intro') === '1');
    } else if (params.get('screen') === 'lobby') {
      this.goLobby();
    } else {
      this.goTitle();
      if (params.get('screen') === 'menu') this.goMenu();
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  parseDebug(params) {
    if (params.get('grade')) {
      this.debug.grade = Object.fromEntries(params.get('grade').split(',').map((kv) => {
        const [k, v] = kv.split(':');
        return [k, Number(v)];
      }));
    }
    for (const k of ['dist', 'pitch', 'yaw']) if (params.get(k)) this.debug[k] = Number(params.get(k));
    if (params.get('cam')) this.debug.cam = params.get('cam').split(',').map(Number);
    if (params.get('look')) this.debug.look = params.get('look').split(',').map(Number);
  }

  // ------------------------------------------------------------------ transições
  // Cortina escura enquanto o novo mundo é construído e seus shaders são pré-compilados.
  transitionTo(fn) {
    if (this.state === 'transition') return;
    this.state = 'transition';
    this.ui.curtain(true);
    setTimeout(async () => {
      try {
        fn();
        const w = this.world;
        const r = this.renderer.renderer;
        if (w) {
          if (r.extensions.has('KHR_parallel_shader_compile')) {
            await Promise.race([r.compileAsync(w.scene, w.shared.camera), new Promise((res) => setTimeout(res, 2500))]);
          } else r.compile(w.scene, w.shared.camera);
        }
      } catch (err) {
        console.error(err);
      }
      requestAnimationFrame(() => this.ui.curtain(false));
    }, 320);
  }

  // ------------------------------------------------------------------ mundos
  setWorld(def, opts) {
    if (this.world) this.world.dispose();
    this.world = null;
    this.world = new World(this, def, opts);
    return this.world;
  }

  // ------------------------------------------------------------------ título e menus
  goTitle() {
    this.state = 'title';
    this.clearLobbyRigs();
    const w = this.setWorld(LEVELS[0], { players: [] });
    w.shared.setCinematic({ target: new THREE.Vector3(0, 2, -75), yaw: 0.9, pitch: 0.24, dist: 95, yawSpeed: 0.02, fov: 40, snap: true });
    w.grade.dofAmount = 0.6;
    w.grade.dofMode = 1;
    w.grade.dofFarStart = 110;
    w.grade.dofFarEnd = 260;
    this.ui.hideHUD();
    this.ui.hideOverlay();
    this.ui.showTitle();
    this.audio.music('titulo');
  }

  goMenu() {
    this.state = 'menu';
    this.ui.showMainMenu([
      { label: this.save.data.unlocked > 1 ? 'Continuar aventura' : 'Nova aventura', action: () => this.transitionTo(() => this.goLobby()) },
      { label: 'Como jogar', action: () => this.ui.showHowTo(() => this.goMenu()) },
      { label: 'Opções', action: () => this.ui.showOptions(() => { this.ui.hideOverlay(); this.goMenu(); }) },
      { label: 'Créditos', action: () => this.ui.showCredits(CREDITS, () => this.goMenu()) },
    ]);
    this.ui.menu.onBack = () => this.goTitle();
  }

  // ------------------------------------------------------------------ lobby (seleção de personagens)
  goLobby() {
    this.state = 'lobby';
    const w = this.setWorld(LOBBY_STAGE, { players: [] });
    w.shared.setCinematic({ target: new THREE.Vector3(0, 1.1, 0), yaw: 0, pitch: 0.12, dist: 13, yawSpeed: 0, fov: 40, snap: true });
    w.grade.dofAmount = 0.9;
    w.grade.dofMode = 0;
    w.grade.dofFocus = 12.5;
    w.grade.dofRange = 9;
    this.lobby = { slots: [null, null, null, null], countdown: null, rigs: [null, null, null, null] };
    // quem já estava jogando volta direto para a seleção
    for (const r of this.roster) this.lobby.slots[r.slot] = { deviceId: r.deviceId, charId: r.charId, ready: false, joinedAt: this.time };
    this.ui.showLobby();
    this.ui.updateLobby(this.lobby);
    this.audio.music('titulo');
  }

  clearLobbyRigs() {
    if (!this.lobby) return;
    for (const r of this.lobby.rigs) if (r) r.root.parent?.remove(r.root);
    this.lobby = null;
  }

  takenChars(except) {
    return this.lobby.slots.filter((s) => s && s !== except).map((s) => s.charId);
  }

  nextChar(current, dir, slot) {
    const taken = this.takenChars(slot);
    let i = CHARACTERS.findIndex((c) => c.id === current);
    for (let k = 0; k < CHARACTERS.length; k++) {
      i = (i + dir + CHARACTERS.length) % CHARACTERS.length;
      if (!taken.includes(CHARACTERS[i].id)) return CHARACTERS[i].id;
    }
    return current;
  }

  updateLobby(dt) {
    const L = this.lobby;
    const inp = this.input;
    for (const d of inp.all) {
      const idx = L.slots.findIndex((s) => s && s.deviceId === d.id);
      const s = idx >= 0 ? L.slots[idx] : null;
      if (!s) {
        if (d.pressed.confirm || d.pressed.jump) {
          const free = L.slots.findIndex((x) => !x);
          if (free >= 0) {
            const charId = CHARACTERS.find((c) => !this.takenChars().includes(c.id)).id;
            L.slots[free] = { deviceId: d.id, charId, ready: false, joinedAt: this.time };
            this.audio.sfx('join', { pan: (free - 1.5) * 0.4 });
          }
        } else if (d.pressed.back && !L.slots.some(Boolean)) {
          this.clearLobbyRigs();
          this.transitionTo(() => {
            this.goTitle();
            this.goMenu();
          });
          return;
        }
        continue;
      }
      if (this.time - (s.joinedAt || 0) < 0.15) continue;
      if (!s.ready && (d.pressed.left || d.pressed.right)) {
        s.charId = this.nextChar(s.charId, d.pressed.left ? -1 : 1, s);
        this.audio.sfx('uiMove');
      } else if (!s.ready && (d.pressed.confirm || d.pressed.jump)) {
        s.ready = true;
        this.audio.sfx('ready', { pan: (idx - 1.5) * 0.4 });
        L.rigs[idx]?.impulse(5);
      } else if (d.pressed.back) {
        if (s.ready) s.ready = false;
        else L.slots[idx] = null;
        this.audio.sfx('uiBack');
      }
    }
    this.syncLobbyRigs(dt);
    const joined = L.slots.filter(Boolean);
    const allReady = joined.length > 0 && joined.every((s) => s.ready);
    if (allReady) {
      if (L.countdown === null) L.countdown = 1.6;
      L.countdown -= dt;
      if (L.countdown <= 0) return this.lobbyDone();
    } else L.countdown = null;
    this.ui.updateLobby(L);
  }

  syncLobbyRigs(dt) {
    const L = this.lobby;
    const w = this.world;
    const xs = LOBBY_X;
    L.slots.forEach((s, i) => {
      let rig = L.rigs[i];
      if (rig && (!s || rig.def.id !== s.charId)) {
        w.scene.remove(rig.root);
        rig = L.rigs[i] = null;
      }
      if (s && !rig) {
        rig = L.rigs[i] = buildCharacter(s.charId);
        rig.root.position.set(xs[i], 0.62, 0.5);
        rig.root.rotation.y = -xs[i] * 0.05;
        rig.root.scale.setScalar(1.35);
        rig.impulse(6);
        w.scene.add(rig.root);
        w.effects.burst(new THREE.Vector3(xs[i], 1.6, 0.5), rig.def.glow, 30, 5, 0.4, 4);
      }
      if (rig) {
        const hop = s.ready ? Math.max(0, Math.sin(this.time * 6 + i)) * 0.25 : 0;
        rig.root.position.y = 0.62 + hop;
        rig.update(dt, { speed: 0, maxSpeed: 7, grounded: hop < 0.02, vy: hop > 0.02 ? 2 : 0, action: 'normal', actionT: 0, turn: 0, celebrate: s.ready });
      }
    });
  }

  lobbyDone() {
    const L = this.lobby;
    this.roster = L.slots.map((s, i) => (s ? { slot: i, deviceId: s.deviceId, charId: s.charId } : null)).filter(Boolean);
    this.clearLobbyRigs();
    this.audio.sfx('start');
    if (this.save.data.unlocked > 1) this.transitionTo(() => this.goChapters());
    else this.transitionTo(() => this.startLevel(0, true));
  }

  goChapters() {
    this.state = 'chapters';
    const w = this.setWorld(LEVELS[0], { players: [] });
    w.shared.setCinematic({ target: new THREE.Vector3(0, 2, -60), yaw: 0.8, pitch: 0.3, dist: 70, yawSpeed: 0.02, fov: 42, snap: true });
    w.grade.dofAmount = 0.8;
    this.ui.showChapters(LEVELS, this.save, (i) => this.transitionTo(() => this.startLevel(i, true)), () => this.transitionTo(() => this.goLobby()));
  }

  // ------------------------------------------------------------------ capítulos
  startLevel(index, withIntro = false) {
    const def = LEVELS[index];
    this.levelIndex = index;
    this.session = { sparks: 0, seeds: [false, false, false] };
    this.ui.clearScreen();
    this.ui.hideOverlay();
    const w = this.setWorld(def, { players: this.roster });
    if (withIntro) {
      const lines = [];
      if (index === 0 && !this.save.data.seenPrologue) lines.push(...SCRIPT.prologo);
      lines.push(...(SCRIPT[INTRO_KEYS[index]] || []));
      this.state = 'intro';
      for (const p of w.players) p.frozen = true;
      const c = w.players.length ? w.players[0].position : new THREE.Vector3();
      w.shared.setCinematic({ target: c.clone().add(new THREE.Vector3(0, 1.5, 0)), yaw: Math.PI * 0.1, pitch: 0.3, dist: 16, yawSpeed: 0.06, fov: 46, snap: true });
      this.audio.music(def.introMusic ?? def.music);
      this.ui.hideHUD();
      this.ui.showDialog(lines, () => {
        if (index === 0) {
          this.save.data.seenPrologue = true;
          this.save.save();
        }
        this.beginPlay();
      });
    } else this.beginPlay();
  }

  beginPlay() {
    const w = this.world;
    this.state = 'play';
    for (const p of w.players) p.frozen = false;
    w.shared.setCinematic(null);
    w.shared.snap(w.players, w.level.route);
    w.onPlayStart?.();
    this.ui.showHUD(w);
    this.ui.levelCard(w.def);
    this.audio.music(w.def.music);
  }

  onLevelComplete(results) {
    const total = results.players.reduce((s, p) => s + p.sparks, 0);
    this.save.completeLevel(this.levelIndex, total, results.levelId);
    this.lastResults = results;
    if (this.world.def.final) return this.goEnding();
    this.state = 'results';
    this.ui.hideHUD();
    this.audio.music('vitoria');
    this.ui.showResults(results, () => this.afterResults());
  }

  afterResults() {
    const key = OUTRO_KEYS[this.levelIndex];
    const next = () => {
      if (this.levelIndex + 1 < LEVELS.length) this.transitionTo(() => this.startLevel(this.levelIndex + 1, true));
      else this.goEnding();
    };
    this.ui.clearScreen();
    if (key) {
      this.state = 'outro';
      this.ui.showDialog(SCRIPT[key], next);
    } else next();
  }

  goEnding() {
    this.state = 'ending';
    this.save.data.finished = true;
    this.save.save();
    this.ui.hideHUD();
    this.audio.music('final');
    const w = this.world;
    for (const p of w.players) {
      p.frozen = true;
      p.celebrate = true;
    }
    this.ui.showDialog(SCRIPT.final, () => {
      this.state = 'credits';
      this.ui.showCredits(CREDITS, () => {
        this.ui.clearScreen();
        this.transitionTo(() => this.goTitle());
      });
    });
  }

  // ------------------------------------------------------------------ pausa
  pause(byDevice) {
    this.state = 'paused';
    const w = this.world;
    w.grade.desaturate = 0.5;
    const items = [
      { label: 'Continuar', action: () => this.resume() },
      { label: 'Voltar ao último lampião', action: () => { this.resume(); w.startTransition(w.players[0], () => w.respawnAll(), 0.8); } },
      { label: 'Reiniciar capítulo', action: () => { this.ui.hideOverlay(); this.transitionTo(() => this.startLevel(this.levelIndex, false)); } },
      { label: 'Opções', action: () => this.ui.showOptions(() => this.pause(byDevice)) },
    ];
    const me = w.players.find((p) => p.deviceId === byDevice);
    if (me && w.players.length > 1) items.push({ label: `Sair da partida (${me.def.name})`, action: () => { this.dropPlayer(me); this.resume(); } });
    items.push({ label: 'Sair para o título', action: () => { this.ui.hideOverlay(); this.transitionTo(() => this.goTitle()); } });
    this.ui.showPause({ items, onBack: () => this.resume() });
  }

  resume() {
    this.state = 'play';
    this.world.grade.desaturate = 0;
    this.ui.hideOverlay();
  }

  dropPlayer(p) {
    this.roster = this.roster.filter((r) => r.deviceId !== p.deviceId);
    this.world.removePlayer(p);
    this.ui.toast(`${p.def.name} saiu da partida.`);
  }

  // Entrar no meio do jogo (drop-in), como em Super Mario 3D World
  checkDropIn() {
    const w = this.world;
    if (w.players.length >= 4 || w.state !== 'play') return;
    for (const d of this.input.all) {
      if (w.players.some((p) => p.deviceId === d.id)) continue;
      if (!(d.pressed.confirm || d.pressed.jump)) continue;
      const used = w.players.map((p) => p.charId);
      const ch = CHARACTERS.find((c) => !used.includes(c.id));
      const usedSlots = w.players.map((p) => p.slot);
      const slot = [0, 1, 2, 3].find((s) => !usedSlots.includes(s));
      const info = { slot, deviceId: d.id, charId: ch.id };
      this.roster.push(info);
      w.addPlayer(info, true);
      this.audio.sfx('join');
      this.ui.toast(`${ch.name} entrou na aventura! (J${slot + 1})`, 'good');
      break;
    }
  }

  // ------------------------------------------------------------------ loop
  frame(t) {
    this.frameCount = (this.frameCount || 0) + 1;
    const t0 = performance.now();
    const dt = Math.max(0, Math.min(0.1, (t - this.last) / 1000));
    this.last = t;
    this.time += dt;
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
    this.input.poll(dt);
    this.renderer.updateDynamicResolution(dt);
    try {
      this.update(dt);
      this.ui.update(dt);
    } catch (err) {
      console.error(err);
    }
    this.input.mouseClicked = false;
    if (this.world) this.renderer.render(this.world.views(), this.time);
    this.frameMs = performance.now() - t0;
    requestAnimationFrame((tt) => this.frame(tt));
  }

  update(dt) {
    const inp = this.input;
    const w = this.world;
    switch (this.state) {
      case 'title':
        if (inp.anyPressed('confirm') || inp.anyPressed('jump') || inp.anyPressed('pause') || inp.mouseClicked) {
          this.audio.unlock();
          this.audio.sfx('uiConfirm');
          this.goMenu();
        }
        w?.update(dt);
        break;
      case 'lobby':
        w?.update(dt);
        if (this.state === 'lobby') this.updateLobby(dt);
        break;
      case 'play': {
        const p = inp.anyPressed('pause');
        if (p && w.state === 'play') {
          this.audio.sfx('uiConfirm');
          this.pause(p.id);
          break;
        }
        this.checkDropIn();
        w.update(dt);
        break;
      }
      case 'paused':
      case 'transition':
        break;
      default:
        w?.update(dt);
    }
  }
}
