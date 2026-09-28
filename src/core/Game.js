// Orquestra o jogo: estados (título, seleção, história, jogo, pausa, resultados),
// loop principal, sessão da co-op e integração entre renderer, entrada, áudio e UI.
import * as THREE from 'three';
import { Settings, SaveData } from './Storage.js';
import { Input } from './Input.js';
import { Renderer } from '../render/Renderer.js';
import { World } from '../world/World.js';
import { LEVELS } from '../world/levels/index.js';
import { CHARACTERS } from '../entities/characters.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.settings = new Settings();
    this.save = new SaveData();
    this.renderer = new Renderer(canvas, this.settings);
    this.input = new Input();
    this.audio = null;
    this.ui = null;
    this.world = null;
    this.state = 'boot';
    this.time = 0;
    this.last = performance.now();
    this.session = { sparks: 0, seeds: [false, false, false] };
    this.roster = []; // [{slot, deviceId, charId}]
    this.fps = 60;
  }

  async start() {
    const params = new URLSearchParams(location.search);
    if (params.get('quality')) this.settings.quality = params.get('quality');
    if (params.get('dynres') === '0') this.settings.dynamicRes = false;
    // parâmetros de depuração: ?grade=exposure:1.2,bloomIntensity:0&dist=6&pitch=0.3
    this.debug = {};
    if (params.get('grade')) {
      this.debug.grade = Object.fromEntries(params.get('grade').split(',').map((kv) => {
        const [k, v] = kv.split(':');
        return [k, Number(v)];
      }));
    }
    if (params.get('dist')) this.debug.dist = Number(params.get('dist'));
    if (params.get('pitch')) this.debug.pitch = Number(params.get('pitch'));
    if (params.get('yaw')) this.debug.yaw = Number(params.get('yaw'));
    if (params.get('cam')) this.debug.cam = params.get('cam').split(',').map(Number);
    if (params.get('look')) this.debug.look = params.get('look').split(',').map(Number);
    this.renderer.applyQuality();
    const lvl = params.get('level');
    if (lvl !== null) {
      const n = Math.max(1, Math.min(4, Number(params.get('players') || 1)));
      const chars = (params.get('chars') || 'lampi,nuvi,musgo,zuca').split(',');
      const devices = ['kb1', 'kb2', 'pad0', 'pad1'];
      this.roster = Array.from({ length: n }, (_, i) => ({ slot: i, deviceId: devices[i], charId: chars[i] || CHARACTERS[i].id }));
      if (params.get('split') === '1') this.settings.splitScreen = true;
      this.startLevel(Number(lvl));
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  startLevel(index) {
    const def = LEVELS[index];
    if (this.world) this.world.dispose();
    this.levelIndex = index;
    this.session = { sparks: 0, seeds: [false, false, false] };
    this.world = new World(this, def, { players: this.roster });
    this.state = 'play';
  }

  onLevelComplete(results) {
    this.save.completeLevel(this.levelIndex, results.players.reduce((s, p) => s + p.sparks, 0), results.levelId);
    this.state = 'results';
    this.lastResults = results;
  }

  frame(t) {
    this.frameCount = (this.frameCount || 0) + 1;
    const t0 = performance.now();
    const dt = Math.max(0, Math.min(0.1, (t - this.last) / 1000));
    this.last = t;
    this.time += dt;
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05;
    this.input.poll(dt);
    this.renderer.updateDynamicResolution(dt);
    if (this.world) {
      if (this.state === 'play' || this.state === 'results') this.world.update(dt);
      this.renderer.render(this.world.views(), this.time);
    }
    this.frameMs = performance.now() - t0;
    requestAnimationFrame((tt) => this.frame(tt));
  }
}
