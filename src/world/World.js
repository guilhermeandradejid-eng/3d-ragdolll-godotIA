// Mundo de jogo: cena, física, ambiente, nível, jogadores, câmeras e regras da co-op.
import * as THREE from 'three';
import { Physics } from './Physics.js';
import { Level } from './Level.js';
import { SharedCamera, FollowCamera } from './CameraRig.js';
import { Sky, CloudSea } from '../render/Sky.js';
import { Lighting } from '../render/Lighting.js';
import { Effects, SHAPE } from '../render/Particles.js';
import { WU, setPlayerUniform } from '../render/WorldShading.js';
import { defaultGrade } from '../render/PostFX.js';
import { ENVIRONMENTS, lerpEnv } from './environments.js';
import { Player, PLAYER_CENTER } from '../entities/Player.js';
import { Debris, beamMaterial } from '../entities/Props.js';
import { clamp, damp, distXZ } from '../core/math.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

const bubbleMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: { uTime: WU.uTime, uTint: { value: new THREE.Color('#ffffff') } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vP = position;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main() {
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float f = pow(1.0 - ndv, 2.2);
        // película fina iridescente
        float w = sin(vP.y * 6.0 + uTime * 1.5) * 0.15 + sin(vP.x * 5.0 - uTime) * 0.1;
        vec3 film = 0.55 + 0.45 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + f * 1.3 + w + uTime * 0.05));
        vec3 col = film * (0.25 + f * 1.8) * uTint;
        float spec = pow(max(dot(reflect(-normalize(vV), normalize(vN)), normalize(vec3(0.4, 0.8, 0.3))), 0.0), 60.0);
        col += vec3(3.0) * spec;
        gl_FragColor = vec4(col, 0.12 + f * 0.75 + spec);
      }
    `,
    transparent: true,
    depthWrite: false,
  });

export class World {
  constructor(game, levelDef, opts = {}) {
    this.game = game;
    this.def = levelDef;
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.quality = game.settings.preset;
    this.time = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.state = 'play';
    this.stateT = 0;
    this.players = [];
    this.transition = null;
    this.results = null;
    this.hintText = null;
    this.lightningT = 6;
    this.flash = 0;
    this.farTimers = new Map();

    const envKey = levelDef.env || 'dawn';
    this.env = { ...ENVIRONMENTS[envKey], id: envKey };
    this.sky = new Sky();
    this.scene.add(this.sky.mesh);
    this.cloudSea = new CloudSea();
    this.scene.add(this.cloudSea.mesh);
    this.lighting = new Lighting(this.scene, this.quality);
    this.effects = new Effects(this.scene, this.quality.particleScale);
    this.grade = defaultGrade();
    this.applyEnvironment(this.env);

    this.shared = new SharedCamera(46);
    this.followCams = [];

    this.level = new Level(this, levelDef);
    this.level.build();
    if (levelDef.killY !== undefined) this.level.killY = levelDef.killY;
    this.checkpoint = null;

    // jogadores
    for (const info of opts.players || []) this.addPlayer(info, false);
    this.placeAtStart();
    this.shared.snap(this.players, this.level.route);
    if (levelDef.camera) Object.assign(this.shared, levelDef.camera);

    this.blobGeo = null;
    this.boss = this.level.bossObj || null;
    this.onReady?.();
  }

  // ------------------------------------------------------------------ ambiente
  applyEnvironment(env) {
    this.applyEnvUniforms(env);
    this.rebuildEnvMap(env);
  }

  rebuildEnvMap(env) {
    this._envRT?.dispose();
    this._envRT = this.sky.buildEnvironment(this.game.renderer.renderer);
    this.scene.environment = this._envRT.texture;
    this.scene.environmentIntensity = env.envIntensity;
  }

  applyEnvUniforms(env) {
    WU.uSunDir.value.copy(env.sunDir);
    WU.uSunColor.value.set(env.light.sunColor);
    WU.uFogColor.value.set(env.fog.color);
    WU.uFogSunColor.value.set(env.fog.sunColor);
    WU.uFogDensity.value = env.fog.density;
    WU.uFogHeightFalloff.value = env.fog.heightFalloff;
    WU.uFogBase.value = env.fog.base;
    WU.uFogDistDensity.value = env.fog.dist;
    WU.uFogMax.value = env.fog.max;
    WU.uTerrainGrass.value.set(env.terrain.grass);
    WU.uTerrainGrassDark.value.set(env.terrain.grassDark);
    WU.uTerrainRock.value.set(env.terrain.rock);
    WU.uTerrainRockDark.value.set(env.terrain.rockDark);
    WU.uTerrainDirt.value.set(env.terrain.dirt);
    WU.uWind.value.set(env.wind[0], env.wind[1], env.wind[2]);
    this.sky.apply(env.sky);
    this.cloudSea.apply(env.sea);
    this.lighting.apply(env.light);
    const g = this.grade;
    const gg = env.grade;
    for (const k of Object.keys(gg)) {
      if (k === 'tint') g.tint.set(...gg.tint);
      else if (k === 'sunColor') g.sunColor.set(gg.sunColor);
      else g[k] = gg[k];
    }
    this.scene.environmentIntensity = env.envIntensity;
  }

  // Transição suave de atmosfera (ex.: eclipse -> nascer do sol no final)
  transitionEnv(toKey, dur = 5) {
    this.envTransition = { from: this.env, to: { ...ENVIRONMENTS[toKey], id: toKey }, t: 0, dur };
  }

  updateEnvTransition(dt) {
    const tr = this.envTransition;
    if (!tr) return;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    const e = lerpEnv(tr.from, tr.to, k * k * (3 - 2 * k));
    e.sky.eclipse = (tr.from.sky.eclipse ?? 0) * (1 - k);
    e.sky.stars = (tr.from.sky.stars ?? 0) * (1 - k);
    this.applyEnvUniforms(e);
    if (k >= 1) {
      this.env = tr.to;
      this.envTransition = null;
      this.rebuildEnvMap(this.env);
    }
  }

  // ------------------------------------------------------------------ chefe
  onPlayStart() {
    if (this.boss) {
      this.boss.awaken();
      this.game.ui?.banner('Nox, a Mariposa do Eclipse', 'Faça-a mergulhar e acerte o núcleo!', '#c07aff');
    }
  }

  onFlameReturned() {
    const p = this.brazierPos || new THREE.Vector3(0, 3, 0);
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(8) });
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 2), flameMat);
    flame.position.copy(p);
    this.scene.add(flame);
    this.brazierFlame = flame;
    const light = new THREE.PointLight('#ffd89a', 30, 50, 1.6);
    light.position.copy(p).add(_v.set(0, 1, 0));
    this.scene.add(light);
    const beams = new THREE.Group();
    beams.position.copy(p);
    const beamG = new THREE.CylinderGeometry(0.8, 7, 60, 24, 1, true);
    beamG.translate(0, 30, 0);
    beamG.rotateZ(-Math.PI / 2 + 0.12);
    const bm = beamMaterial('#ffe7b0', 0.7);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(beamG, bm);
      b.rotation.y = (i / 3) * Math.PI * 2;
      b.renderOrder = 30;
      beams.add(b);
    }
    const up = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 6, 80, 24, 1, true), bm);
    up.position.y = 40;
    beams.add(up);
    this.scene.add(beams);
    this.brazierBeams = beams;
    this.effects.burst(p, '#ffe7b0', 120, 16, 1, 6);
    this.effects.confetti(p, 120);
    this.flash = 0.7;
    this.shake(0.5);
    this.audio('goal');
    this.audio('lightBeam');
    this.transitionEnv('sunrise', 5);
    for (const pl of this.players) pl.celebrate = true;
    this.game.ui?.banner('O Grande Farol reacendeu!', 'O sol vai nascer outra vez.', '#ffd27a');
  }

  onBossDefeated() {
    this.state = 'goal';
    this.stateT = 0;
    this.results = this.collectResults();
    this.game.onLevelComplete(this.results);
  }

  // ------------------------------------------------------------------ jogadores
  addPlayer(info, dropIn = true) {
    const p = new Player(this, info.slot, info.deviceId, info.charId);
    this.players.push(p);
    this.players.sort((a, b) => a.slot - b.slot);
    if (dropIn) {
      const anchor = this.nearestAlive(this.shared.focus, p) || this.players.find((o) => o !== p);
      const pos = anchor ? anchor.position.clone().add(_v.set(0, 3, 0)) : this.spawnPos(p.slot);
      p.spawn(pos, anchor ? anchor.facing : 0);
      if (anchor) p.enterBubble(anchor);
      this.effects.burst(pos, p.def.glow, 30);
    }
    this.rebuildCameras();
    return p;
  }

  removePlayer(p) {
    const i = this.players.indexOf(p);
    if (i < 0) return;
    this.showBubble(p, false);
    p.dispose();
    this.players.splice(i, 1);
    this.rebuildCameras();
  }

  rebuildCameras() {
    this.followCams = this.players.map((p) => {
      const old = this.followCams?.find((f) => f.player === p);
      if (old) return old;
      const f = new FollowCamera(p);
      f.snap();
      return f;
    });
  }

  get split() {
    return this.game.settings.splitScreen && this.players.length > 1;
  }

  cameraFor(player) {
    if (this.split) {
      const f = this.followCams.find((c) => c.player === player);
      if (f) return f.camera;
    }
    return this.shared.camera;
  }

  spawnPos(i) {
    const s = this.level.spawns[i % Math.max(1, this.level.spawns.length)];
    return s ? s.pos.clone() : new THREE.Vector3(i * 1.5, 2, 0);
  }

  placeAtStart() {
    this.players.forEach((p, i) => {
      const s = this.level.spawns[i % this.level.spawns.length] || { pos: new THREE.Vector3(i * 1.5, 2, 0), yaw: Math.PI };
      p.spawn(s.pos.clone(), s.yaw);
    });
    for (const f of this.followCams) f.snap();
  }

  nearestAlive(pos, except) {
    let best = null, bd = Infinity;
    for (const p of this.players) {
      if (p === except || !p.alive) continue;
      const d = p.position.distanceTo(pos);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  makeBlobShadow() {
    if (!this.blobGeo) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 64, 64);
      this.blobTex = new THREE.CanvasTexture(c);
      this.blobGeo = new THREE.PlaneGeometry(1.2, 1.2);
      this.blobGeo.rotateX(-Math.PI / 2);
    }
    const m = new THREE.Mesh(this.blobGeo, new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, opacity: 0.45, color: 0x000000 }));
    m.renderOrder = 3;
    m.material.polygonOffset = true;
    m.material.polygonOffsetFactor = -2;
    return m;
  }

  showBubble(p, on) {
    if (on) {
      if (!p.bubbleMesh) {
        p.bubbleMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 24), bubbleMaterial());
        p.bubbleMesh.position.y = 0.72;
        p.bubbleMesh.renderOrder = 25;
        p.bubbleMesh.material.uniforms.uTint.value.set(p.def.glow);
      }
      p.object.add(p.bubbleMesh);
      p.bubbleMesh.visible = true;
    } else if (p.bubbleMesh) {
      p.object.remove(p.bubbleMesh);
      if (this.state !== 'disposed') {
        this.effects.burst(_v.copy(p.position).add(_v2.set(0, 0.8, 0)), p.def.glow, 18, 5, 0.4, 3);
        this.audio('bubblePop', p);
      }
    }
  }

  // ------------------------------------------------------------------ eventos
  audio(name, p, opts = {}) {
    const a = this.game.audio;
    if (!a) return;
    let pan = 0;
    if (p && p.position) {
      const cam = this.split ? this.cameraFor(p) : this.shared.camera;
      _v.copy(p.position || p).project(cam);
      pan = clamp(_v.x, -1, 1) * 0.7;
    }
    a.sfx(name, { pan, ...opts });
  }

  shake(amount, player) {
    if (!this.game.settings.screenShake) return;
    if (this.split) {
      for (const f of this.followCams) if (!player || f.player === player || amount > 0.5) f.addTrauma(amount);
    } else this.shared.addTrauma(amount);
  }

  rumble(p, s, w, d) {
    if (this.game.settings.rumble && p) this.game.input.rumble(p.deviceId, s, w, d);
  }

  onPlayerEvent(p, type, k = 1) {
    const e = this.effects;
    const feet = p.position;
    switch (type) {
      case 'jump':
        e.dust(feet, 5, this.dustColor(p), 1.5, 0.35);
        this.audio('jump', p, { pitch: 1 + (p.slot * 0.03) });
        break;
      case 'doubleJump':
        e.sparkle(_v.copy(feet).add(_v2.set(0, 0.5, 0)), p.rig.fxColor, 14, 4, 0.35, 4);
        this.audio('doubleJump', p);
        if (p.charId === 'lampi') for (let i = 0; i < 10; i++) e.flame(_v.copy(feet).add(_v2.set((Math.random() - 0.5) * 0.8, 0.3, (Math.random() - 0.5) * 0.8)), '#ffb347', 0.4);
        if (p.charId === 'nuvi') e.dust(feet, 8, '#eaf4ff', 2.5, 0.6);
        if (p.charId === 'musgo') e.sparkle(feet, '#b6ff8a', 10, 3, 0.3, 3);
        if (p.charId === 'zuca') e.sparkle(feet, '#ff9ad0', 12, 5, 0.25, 5);
        break;
      case 'longJump':
        e.dust(feet, 8, this.dustColor(p), 3, 0.45);
        this.audio('longJump', p);
        break;
      case 'land':
        e.dust(feet, Math.round(4 + k * 8), this.dustColor(p), 1.5 + k * 2, 0.4);
        this.audio('land', p, { volume: 0.4 + k * 0.6 });
        break;
      case 'spin':
        this.audio('spin', p);
        e.sparkle(_v.copy(feet).add(_v2.set(0, 0.7, 0)), p.rig.fxColor, 6, 3, 0.25, 3);
        break;
      case 'roll':
        e.dust(feet, 6, this.dustColor(p), 2.5, 0.4);
        this.audio('roll', p);
        break;
      case 'poundStart':
        this.audio('poundStart', p);
        break;
      case 'step':
        if (Math.random() < 0.5) e.dust(feet, 1, this.dustColor(p), 0.8, 0.25);
        this.audio('step', p, { surface: p.groundInfo?.surface, volume: 0.35 });
        break;
      case 'bubblePop':
        break;
    }
  }

  dustColor(p) {
    const s = p.groundInfo?.surface;
    if (s === 'grass') return this.env.id === 'night' ? '#6fb8b0' : '#cfe6a8';
    if (s === 'cloud') return '#ffffff';
    if (s === 'wood') return '#d8b890';
    if (s === 'crystal') return '#bff4ff';
    if (s === 'metal') return '#d8c0a0';
    return '#e3d2c0';
  }

  onPlayerPound(p) {
    const r = p.stats.poundRadius;
    const pos = p.position.clone();
    this.effects.groundRing(pos, p.rig.fxColor, r * 1.1, 0.4, 3);
    this.effects.dust(pos, 16, this.dustColor(p), 5, 0.6);
    this.effects.sparkle(_v.copy(pos).add(_v2.set(0, 0.4, 0)), '#ffffff', 10, 6, 0.3, 3);
    this.shake(0.3 + p.stats.weight * 0.1, p);
    this.rumble(p, 0.8, 0.4, 150);
    this.audio('pound', p, { heavy: p.stats.weight > 1.2 });
    for (const e of this.level.enemies) e.onShockwave(pos, r, p);
    for (const c of this.level.crates) c.onShockwave(pos, r, p);
    this.boss?.onShockwave?.(pos, r, p);
    // outros jogadores dão um pulinho
    for (const o of this.players) {
      if (o !== p && o.alive && o.grounded && o.position.distanceTo(pos) < r) o.bounce(7);
    }
  }

  onPlayerHurt(p) {
    this.audio('hurt', p);
    this.shake(0.35, p);
    this.rumble(p, 0.9, 0.9, 220);
    this.effects.hearts(_v.copy(p.position).add(_v2.set(0, 1.2, 0)), 3);
    this.hitFlash = 1;
    if (p.hearts <= 0) this.knockOut(p, false);
    this.game.ui?.hudPulse(p.slot, 'hurt');
  }

  onPlayerFell(p) {
    if (p.action === 'bubble' || this.state === 'goal') return;
    p.stats_.falls++;
    p.hearts = Math.max(0, p.hearts - 1);
    this.audio('fall', p);
    this.effects.dust(_v.set(p.position.x, this.cloudSea.mesh.position.y + 1, p.position.z), 10, '#ffffff', 4, 1.2);
    this.game.ui?.hudPulse(p.slot, 'hurt');
    this.knockOut(p, true);
  }

  // Jogador fora de ação: bolha (co-op), reaparecer no último ponto seguro (solo) ou checkpoint.
  knockOut(p, fell) {
    const others = this.players.filter((o) => o !== p && o.alive);
    if (others.length) {
      const anchor = this.nearestAlive(p.lastSafe, p);
      const start = fell ? _v.copy(anchor.position).add(_v2.set(0, 6, 0)).lerp(p.lastSafe, 0.3) : p.position.clone();
      p.position.copy(start);
      p.enterBubble(anchor);
      return;
    }
    if (fell && p.hearts > 0) {
      this.startTransition(p, () => {
        p.spawn(p.lastSafe.clone().add(_v2.set(0, 0.5, 0)), p.facing);
        this.snapCameras();
      });
      return;
    }
    // todos fora: volta ao último lampião
    this.startTransition(p, () => this.respawnAll(), 0.9);
  }

  respawnAll() {
    const cp = this.checkpoint;
    this.players.forEach((p, i) => {
      if (p.action === 'bubble') this.showBubble(p, false);
      p.hearts = p.maxHearts;
      const pos = cp ? cp.spawnPoint(i) : this.spawnPos(i);
      p.spawn(pos, cp ? cp.yaw + Math.PI : this.level.spawns[0]?.yaw ?? 0);
    });
    this.snapCameras();
    this.game.ui?.toast('De volta ao lampião!', 'info');
  }

  snapCameras() {
    this.shared.snap(this.players, this.level.route);
    for (const f of this.followCams) f.snap();
  }

  startTransition(p, onMid, dur = 0.7) {
    if (this.transition) return;
    this.transition = { t: 0, dur, onMid, done: false, player: p };
  }

  onCollectSpark(p, pos) {
    p.stats_.sparks++;
    this.game.session.sparks++;
    this.effects.sparkle(pos, '#ffd76a', 6, 3, 0.25, 4);
    const now = this.time;
    if (now - (this._lastSparkT ?? -10) < 0.7) this._sparkChain = Math.min(12, (this._sparkChain ?? 0) + 1);
    else this._sparkChain = 0;
    this._lastSparkT = now;
    this.audio('spark', p, { chain: this._sparkChain });
    // 50 centelhas = coração extra (até o máximo) para quem coletou
    if (p.stats_.sparks % 50 === 0) {
      if (p.hearts < p.maxHearts) {
        p.hearts++;
        this.game.ui?.toast(`${p.def.name} ganhou um coração!`, 'good');
        this.audio('heart', p);
      }
    }
  }

  onCollectSeed(p, seed) {
    p.stats_.seeds++;
    this.game.save.collectSeed(this.level.id, seed.index);
    this.game.session.seeds[seed.index] = true;
    this.effects.burst(seed.object.position, '#ffe38a', 50, 9, 0.6, 6);
    this.effects.confetti(seed.object.position, 40);
    this.slowmo = 0.9;
    this.shake(0.25);
    this.flash = 0.6;
    this.audio('seed', p);
    this.rumble(p, 0.5, 0.8, 300);
    const n = this.game.session.seeds.filter(Boolean).length;
    this.game.ui?.banner(`Semente de Luz ${n}/3`, `${p.def.name} encontrou uma Semente de Luz!`, p.def.color);
  }

  onCollectHeart(p) {
    if (p.hearts < p.maxHearts) p.hearts++;
    else {
      p.stats_.sparks += 5;
      this.game.session.sparks += 5;
    }
    this.effects.hearts(_v.copy(p.position).add(_v2.set(0, 1.2, 0)), 8);
    this.audio('heart', p);
  }

  onEnemyDefeated(e, p, how) {
    this.audio(how === 'stomp' ? 'stomp' : 'enemyHit', e.pos);
    this.shake(0.12, p);
    this.rumble(p, 0.3, 0.5, 90);
    this.effects.sparkle(_v.copy(e.pos).add(_v2.set(0, 0.6, 0)), '#c89aff', 12, 5, 0.35, 3);
    if (how === 'stomp') this.effects.groundRing(e.pos, '#b07aff', 1.6, 0.3, 2);
    this.hitStop = 0.05;
  }

  onEnemyPoof(e) {
    const pos = _v.copy(e.pos).add(_v2.set(0, 0.5, 0));
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      this.effects.norm.emit({
        x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * 3, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 3,
        life: 0.7, size: 0.5, size1: 1.3, color: [0.22, 0.12, 0.35], alpha: 0.85, alpha1: 0, drag: 3, shape: SHAPE.PUFF,
      });
    }
    this.level.sparks.spawnAt(pos, 3);
    this.audio('poof', e.pos);
  }

  onCrateBroken(c, p) {
    const pos = c.object.position.clone();
    this.level.debris.push(new Debris(this, pos, c.mats.wood, 8, 0.36, 5));
    this.effects.dust(pos, 10, '#d8b890', 3, 0.5);
    this.audio('crate', pos);
    this.shake(0.1, p);
    if (c.contents === 'heart') this.level.heart(pos.x, pos.y + 0.3, pos.z);
    else this.level.sparks.spawnAt(pos, 5);
  }

  onCheckpoint(cp, p) {
    this.checkpoint = cp;
    this.effects.burst(_v.copy(cp.pos).add(_v2.set(0, 2, 0)), '#ffb347', 30, 6, 0.4, 4);
    this.audio('checkpoint', cp.pos);
    this.game.ui?.toast(`${p.def.name} acendeu um lampião!`, 'good');
    // revive quem estiver na bolha
    for (const o of this.players) if (o.action === 'bubble') o.popBubble(p);
  }

  onVeilCleared(v, n) {
    this.effects.burst(_v.copy(v.pos).add(_v2.set(0, 2.5, 0)), '#ffd27a', 70, 10, 0.6, 5);
    this.effects.confetti(_v.copy(v.pos).add(_v2.set(0, 2, 0)), 30);
    this.audio('veil', v.pos);
    this.shake(0.3);
    this.game.ui?.toast(n > 1 ? `Juntos, brilhamos mais! (${n} vaga-lumes)` : 'O véu de sombra se desfez!', 'good');
  }

  onSign(sign, near) {
    this.game.ui?.hint(near ? sign.text : null);
  }

  onEvent(type, pos, extra) {
    switch (type) {
      case 'bounce':
        this.audio('bounce', pos);
        this.effects.sparkle(_v.copy(pos).add(_v2.set(0, 1.4, 0)), '#ffffff', 8, 4, 0.3, 3);
        break;
      case 'crumbleStart':
        this.audio('crumble', pos);
        break;
      case 'enemyAlert':
        this.audio('alert', pos);
        this.effects.add.emit({ x: pos.x, y: pos.y + 1.8, z: pos.z, vy: 1.2, life: 0.5, size: 0.7, size1: 0.9, color: [4, 3.2, 0.8], alpha: 1, alpha1: 0, shape: SHAPE.SPARKLE });
        break;
      case 'enemyStun':
        this.audio('stun', pos);
        break;
      case 'mothSwoop':
        this.audio('swoop', pos);
        break;
      case 'bridgeOn':
        this.audio('bridge', pos, { volume: 0.3 });
        break;
    }
  }

  onGoal(lighthouse, p) {
    if (this.state !== 'play') return;
    this.state = 'goal';
    this.stateT = 0;
    this.goalBy = p;
    for (const o of this.players) {
      if (o.action === 'bubble') o.popBubble(p);
      o.celebrate = true;
      o.frozen = true;
    }
    lighthouse.light_up();
    const lamp = lighthouse.lampWorld;
    this.effects.burst(lamp, '#ffe7b0', 80, 12, 0.8, 6);
    this.effects.confetti(lamp, 80);
    this.shared.setCinematic({
      target: lighthouse.pos.clone().add(_v.set(0, 5, 0)), yaw: this.shared.yaw, pitch: 0.18, dist: 24, yawSpeed: 0.18, fov: 50,
    });
    this.game.audio?.music(null);
    this.audio('goal', lighthouse.pos);
    this.game.ui?.banner('Farol aceso!', `${p.def.name} reacendeu o farol!`, p.def.color);
    this.shake(0.3);
  }

  // ------------------------------------------------------------------ loop
  update(rawDt) {
    let dt = Math.min(rawDt, 1 / 20);
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.1;
    }
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      dt *= 0.35;
    }
    dt *= this.timeScale;
    this.time += dt;
    this.stateT += dt;
    WU.uTime.value = this.time;

    const steps = Math.max(1, Math.min(4, Math.ceil(dt / (1 / 60) - 1e-3)));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      this.level.updatePlatforms(sdt);
      this.physics.step(sdt);
      for (const p of this.players) p.update(sdt);
      this.playerInteractions(sdt);
    }
    this.level.update(dt);
    this.boss?.update?.(dt);
    this.updateEnvTransition(rawDt);
    if (this.brazierBeams) {
      this.brazierBeams.rotation.y += dt * 0.5;
      this.brazierFlame.scale.setScalar(1 + Math.sin(this.time * 9) * 0.08);
      if (Math.random() < dt * 30) this.effects.flame(this.brazierFlame.position, '#ffcf5a', 1.2);
    }
    this.effects.update(dt);
    this.updateCoopRules(dt);
    this.updateAmbient(dt);
    this.updateCameras(rawDt);
    this.updateTransition(rawDt);

    // uniforms dos jogadores (grama)
    for (let i = 0; i < 4; i++) {
      const p = this.players[i];
      if (p && p.alive) setPlayerUniform(i, p.position.x, p.position.y, p.position.z, 1.4);
      else setPlayerUniform(i, 0, -9999, 0, 0);
    }

    // grading dinâmico
    const g = this.grade;
    this.hitFlash = damp(this.hitFlash || 0, 0, 5, rawDt);
    g.hit = this.hitFlash;
    this.flash = Math.max(0, this.flash - rawDt * 1.5);
    g.fadeColor.set(1, 0.97, 0.9);
    if (!this.transition) g.fade = this.flash * 0.5;

    if (this.env.lightning) this.updateLightning(rawDt);
    const dbg = this.game.debug;
    if (dbg?.grade) for (const [k, v] of Object.entries(dbg.grade)) g[k] = v;

    if (this.state === 'goal' && this.stateT > 5.5 && !this.results) {
      this.results = this.collectResults();
      this.game.onLevelComplete(this.results);
    }
  }

  playerInteractions() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      if (!a.alive) continue;
      for (let j = 0; j < ps.length; j++) {
        if (i === j) continue;
        const b = ps[j];
        if (!b.alive) continue;
        const d = distXZ(a.position, b.position);
        const dy = a.position.y - b.position.y;
        // pulo na cabeça do amigo
        if (a.velocity.y < 0 && dy > 0.95 && dy < 1.75 && d < 0.8 && a.headBounceCooldown <= 0) {
          a.headBounceCooldown = 0.25;
          a.bounce(12.5);
          b.rig.impulse(-7);
          this.audio('headBounce', a);
          this.effects.sparkle(_v.copy(b.position).add(_v2.set(0, 1.4, 0)), a.rig.fxColor, 8, 3, 0.3, 3);
          continue;
        }
        // separação suave
        if (Math.abs(dy) < 1.1 && d < 0.85 && d > 1e-4) {
          const push = (0.85 - d) * 10;
          a.velocity.x += ((a.position.x - b.position.x) / d) * push * 0.016 * 60 * 0.05;
          a.velocity.z += ((a.position.z - b.position.z) / d) * push * 0.016 * 60 * 0.05;
        }
      }
    }
  }

  updateCoopRules(dt) {
    // câmera compartilhada: quem ficar muito longe do grupo vira bolha (estilo Super Mario 3D World)
    if (this.split || this.state !== 'play') return;
    const alive = this.players.filter((p) => p.alive);
    if (alive.length < 2) return;
    for (const p of alive) {
      const others = alive.filter((o) => o !== p);
      const c = _v.set(0, 0, 0);
      for (const o of others) c.add(o.position);
      c.multiplyScalar(1 / others.length);
      const far = p.position.distanceTo(c) > 26;
      const t = far ? (this.farTimers.get(p) || 0) + dt : 0;
      this.farTimers.set(p, t);
      if (t > 1.6) {
        this.farTimers.set(p, 0);
        const anchor = this.nearestAlive(c, p);
        p.enterBubble(anchor);
        this.game.ui?.toast(`${p.def.name} se afastou demais — carona na bolha!`, 'info');
      }
    }
  }

  updateAmbient(dt) {
    const e = this.effects;
    const f = this.split ? this.players[0]?.position || this.shared.focus : this.shared.focus;
    const kind = this.env.ambient;
    const rate = { pollen: 14, fireflies: 12, embers: 22 }[kind] || 0;
    const n = Math.random() < (rate * dt) % 1 ? Math.floor(rate * dt) + 1 : Math.floor(rate * dt);
    for (let i = 0; i < n * this.quality.particleScale + (Math.random() < 0.5 ? 1 : 0) * 0; i++) {
      const x = f.x + (Math.random() - 0.5) * 50, z = f.z + (Math.random() - 0.5) * 50, y = f.y + (Math.random() - 0.3) * 14;
      if (kind === 'pollen')
        e.add.emit({ x, y, z, vx: 0.4, vy: 0.15, vz: 0.1, life: 6, size: 0.09, color: [2.2, 1.9, 1.2], alpha: 0.9, alpha1: 0, flutter: 1.2, shape: SHAPE.GLOW });
      else if (kind === 'fireflies')
        e.add.emit({ x, y: y - 3, z, vx: 0, vy: 0.2, vz: 0, life: 5, size: 0.16, size1: 0.05, color: [2.5, 4, 1.2], alpha: 1, alpha1: 0, flutter: 2.5, shape: SHAPE.GLOW });
      else if (kind === 'embers')
        e.add.emit({ x, y: y - 6, z, vx: 0.8, vy: 1.4, vz: 0.2, life: 4.5, size: 0.08, color: [5, 1.8, 0.6], color1: [2, 0.4, 0.2], alpha: 1, alpha1: 0, flutter: 2, shape: SHAPE.GLOW });
    }
  }

  updateLightning(dt) {
    this.lightningT -= dt;
    if (this.lightningT <= 0) {
      this.lightningT = 7 + Math.random() * 9;
      this.flashL = 1;
      setTimeout(() => this.game.audio?.sfx('thunder', { volume: 0.7 }), 400 + Math.random() * 600);
    }
    if (this.flashL > 0) {
      this.flashL = Math.max(0, this.flashL - dt * 3.5);
      const f = this.flashL * (0.6 + 0.4 * Math.sin(this.time * 60));
      this.sky.uniforms.uFlash.value = f * 0.8;
      this.lighting.hemi.intensity = this.env.light.hemiIntensity + f * 1.5;
    }
  }

  updateCameras(dt) {
    const b = this.boss;
    this.shared.extraTargets = b && b.state !== 'dormant' && b.state !== 'defeated' ? [b.pos] : null;
    const dbg = this.game.debug;
    if (dbg?.dist) this.shared.minDist = this.shared.maxDist = dbg.dist;
    if (dbg?.pitch !== undefined) this.shared.defaultPitch = dbg.pitch;
    if (dbg?.yaw !== undefined) this.shared.userYaw = dbg.yaw;
    const inputs = this.players.filter((p) => p.alive).map((p) => p.input).filter(Boolean);
    this.shared.update(dt, this.players, this.level.route, this.state === 'play' ? inputs : null);
    if (dbg?.cam) {
      const c = this.shared.camera;
      c.position.set(...dbg.cam);
      if (dbg.look) c.lookAt(...dbg.look);
      this.shared.focus.set(...(dbg.look || dbg.cam));
    }
    if (this.split) {
      this.sample = this.sample || { heading: new THREE.Vector3(), pitch: 0, dist: 0 };
      for (const f of this.followCams) f.update(dt, this.physics, this.level.route, this.sample);
    }
  }

  updateTransition(dt) {
    const tr = this.transition;
    const g = this.grade;
    if (!tr) {
      g.iris = damp(g.iris, 2, 6, dt);
      return;
    }
    tr.t += dt;
    const half = tr.dur / 2;
    // centro da íris no jogador
    if (tr.player) {
      const cam = this.cameraFor(tr.player);
      _v.copy(tr.player.position).add(_v2.set(0, 0.7, 0)).project(cam);
      if (!this.split) g.irisCenter.set(clamp(_v.x * 0.5 + 0.5, 0.1, 0.9), clamp(_v.y * 0.5 + 0.5, 0.1, 0.9));
    }
    if (tr.t < half) g.iris = 1.2 * (1 - tr.t / half) + 0.0;
    else {
      if (!tr.done) {
        tr.done = true;
        tr.onMid?.();
        g.irisCenter.set(0.5, 0.5);
      }
      g.iris = 1.4 * ((tr.t - half) / half);
    }
    if (tr.t >= tr.dur + 0.15) {
      this.transition = null;
    }
  }

  collectResults() {
    return {
      levelId: this.level.id,
      players: this.players.map((p) => ({ slot: p.slot, charId: p.charId, name: p.def.name, color: p.def.color, ...p.stats_ })),
      totalSparks: this.level.sparks.total,
      seeds: this.game.session.seeds.slice(),
      time: this.time,
    };
  }

  // Views para o renderer (tela compartilhada ou dividida)
  views() {
    const beforeRender = (i, cam) => {
      const focus = this.split && this.followCams[i] ? this.followCams[i].focus : this.shared.cine ? this.shared.lookTarget : this.shared.focus;
      const ext = this.split ? 26 : clamp(this.shared.dist * 1.25, 22, 44);
      this.lighting.follow(focus, ext);
    };
    if (this.split) {
      return this.followCams.map((f) => ({ scene: this.scene, camera: f.camera, grade: this.grade, sunDir: WU.uSunDir.value, beforeRender }));
    }
    return [{ scene: this.scene, camera: this.shared.camera, grade: this.grade, sunDir: WU.uSunDir.value, beforeRender }];
  }

  dispose() {
    this.state = 'disposed';
    for (const p of this.players) p.dispose();
    this.level.dispose();
    this.effects.clear();
    this.physics.dispose();
    this._envRT?.dispose();
    this.scene.traverse((o) => {
      if (o.isMesh) {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
      }
    });
  }
}

export { PLAYER_CENTER };
