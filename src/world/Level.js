// Nível: construtor (DSL usada pelos arquivos de fase) + runtime das entidades.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as G from './geometry.js';
import { GROUP } from './Physics.js';
import { M, shade } from '../render/WorldShading.js';
import { GrassField } from '../render/Grass.js';
import { CameraRoute } from './CameraRig.js';
import { MovingPlatform, CrumblePlatform, BouncePad } from '../entities/Platforms.js';
import { SparkField, LightSeed, HeartPickup } from '../entities/Collectibles.js';
import { ENEMY_TYPES } from '../entities/Enemies.js';
import { Checkpoint, Lighthouse, ShadowVeil, Crate, Sign, Pendulum, LightBridge, waterfallMaterial } from '../entities/Props.js';
import { rng, TAU } from '../core/math.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toV = (p) => (p.isVector3 ? p.clone() : V(p[0], p[1], p[2]));
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const UPV = new THREE.Vector3(0, 1, 0);

function createMaterials(env) {
  return {
    terrain: M.standard('#ffffff', { roughness: 0.93 }, { terrain: { scale: 1 } }),
    terrainBare: M.standard('#ffffff', { roughness: 0.93 }, { terrain: { scale: 1, grass: 0 } }),
    stone: M.standard('#bcb0a2', { roughness: 0.86 }, { variation: { amount: 0.35, scale: 0.9 } }),
    darkStone: M.standard('#6f6676', { roughness: 0.85 }, { variation: { amount: 0.35, scale: 0.9 } }),
    brick: M.standard('#a7727a', { roughness: 0.85 }, { variation: { amount: 0.4, scale: 1.6 } }),
    wood: M.standard('#b57e4c', { roughness: 0.78 }, { variation: { amount: 0.3, scale: 2.5 } }),
    darkWood: M.standard('#6e4529', { roughness: 0.8 }, { variation: { amount: 0.25, scale: 2 } }),
    brass: M.physical('#d8a444', { metalness: 0.9, roughness: 0.3, clearcoat: 0.5 }),
    copper: M.physical('#c8744a', { metalness: 0.9, roughness: 0.35, clearcoat: 0.3 }),
    darkMetal: M.physical('#3e3748', { metalness: 0.75, roughness: 0.38, clearcoat: 0.4 }),
    trunk: M.standard('#7b5334', { roughness: 0.9 }, { variation: { amount: 0.3, scale: 3 } }),
    leaf: M.standard('#6fc04b', { roughness: 0.85, vertexColors: true }, { wind: 0.0035, rim: { color: '#e8ffb0', power: 3, strength: 0.25 } }),
    pineLeaf: M.standard('#3f8f5a', { roughness: 0.85 }, { wind: 0.004 }),
    cloud: M.standard('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.1 }, { rim: { color: '#ffffff', power: 2, strength: 0.25 } }),
    flower: M.lambert('#ffffff', { vertexColors: true }, { wind: 0.25 }),
    rope: M.standard('#caa46c', { roughness: 0.9 }),
    crystalCyan: M.physical('#9ff5ff', { emissive: '#27c8ff', emissiveIntensity: 1.8, roughness: 0.12, clearcoat: 1, metalness: 0.1 }, { rim: { color: '#ffffff', power: 2, strength: 0.6 } }),
    crystalPink: M.physical('#ffb3f0', { emissive: '#ff3fc0', emissiveIntensity: 1.8, roughness: 0.12, clearcoat: 1 }, { rim: { color: '#ffffff', power: 2, strength: 0.6 } }),
    crystalGold: M.physical('#ffe7a0', { emissive: '#ffb020', emissiveIntensity: 1.6, roughness: 0.15, clearcoat: 1 }, { rim: { color: '#ffffff', power: 2, strength: 0.5 } }),
    mushStem: M.standard('#f1e6d6', { roughness: 0.7 }),
    mushCapRed: M.physical('#ff5a4f', { roughness: 0.35, clearcoat: 0.8 }, { rim: { color: '#ffd0c0', power: 3, strength: 0.4 } }),
    mushCapGlow: M.physical('#6fe7ff', { emissive: '#1fb8ff', emissiveIntensity: 1.4, roughness: 0.35, clearcoat: 0.8 }, { rim: { color: '#ffffff', power: 2, strength: 0.5 } }),
    mushCapPink: M.physical('#ff7ad9', { emissive: '#ff2fb0', emissiveIntensity: 1.2, roughness: 0.35, clearcoat: 0.8 }),
    spots: M.standard('#fff6ea', { roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.2 }),
    leafPad: M.physical('#62c24f', { roughness: 0.5, clearcoat: 0.6, side: THREE.DoubleSide }, { rim: { color: '#e0ffb0', power: 3, strength: 0.3 } }),
    glowOrange: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb347').multiplyScalar(4) }),
    banner: M.standard('#d9463b', { roughness: 0.8, side: THREE.DoubleSide }, { wind: 0.06 }),
  };
}

// Junta geometria estática por material e célula espacial (menos draw calls, culling ainda funciona).
class StaticBatcher {
  constructor() {
    this.groups = new Map();
  }
  add(geo, material, opts = {}) {
    let g = geo;
    if (opts.matrix) {
      g = geo.clone();
      g.applyMatrix4(opts.matrix);
    }
    const keep = new Set(['position', 'normal']);
    if (material.vertexColors) keep.add('color');
    for (const k of Object.keys(g.attributes)) if (!keep.has(k)) g.deleteAttribute(k);
    if (material.vertexColors && !g.getAttribute('color')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3));
    }
    if (!g.index) {
      const n = g.getAttribute('position').count;
      const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    g.morphAttributes = {};
    g.computeBoundingSphere();
    const c = g.boundingSphere.center;
    const cell = `${Math.floor(c.x / 70)}:${Math.floor(c.z / 70)}`;
    const key = `${material.uuid}|${opts.cast !== false}|${opts.receive !== false}|${cell}`;
    if (!this.groups.has(key)) this.groups.set(key, { material, list: [], cast: opts.cast !== false, receive: opts.receive !== false });
    this.groups.get(key).list.push(g);
  }
  build(parent) {
    const meshes = [];
    for (const { material, list, cast, receive } of this.groups.values()) {
      // índices precisam ser do mesmo tipo
      for (const g of list) if (g.index.array instanceof Uint16Array) g.setIndex(new THREE.BufferAttribute(new Uint32Array(g.index.array), 1));
      const merged = list.length === 1 ? list[0] : mergeGeometries(list);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = cast;
      mesh.receiveShadow = receive;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.groups.clear();
    return meshes;
  }
}

export class Level {
  constructor(world, def) {
    this.world = world;
    this.def = def;
    this.id = def.id;
    this.group = new THREE.Group();
    world.scene.add(this.group);
    this.mats = createMaterials(world.env);
    this.batch = new StaticBatcher();
    this.platforms = [];
    this.entities = [];
    this.enemies = [];
    this.crates = [];
    this.checkpoints = [];
    this.seeds = [];
    this.sparkPositions = [];
    this.spawns = [];
    this.spinners = [];
    this.grassPatches = [];
    this.flowerPatches = [];
    this.veils = [];
    this.debris = [];
    this.animated = [];
    this.goalObj = null;
    this.killY = -24;
    this.route = null;
    this.bossArena = null;
    this.rand = rng(def.seed ?? 7);
    this.meshes = [];
  }

  // ------------------------------------------------------------------ construção
  build() {
    this.def.build(this, V);
    this.finalize();
  }

  finalize() {
    this.meshes = this.batch.build(this.group);
    const w = this.world;
    // atualiza as estruturas de consulta do Rapier (raycasts da grama/decoração)
    w.physics.step(1 / 60);
    this.sparks = new SparkField(w, this.sparkPositions);
    this.entities.push(this.sparks);
    this.buildGrass();
    if (this.def.backdrop !== false) this.buildBackdrop(this.def.backdrop || {});
    if (!this.route) this.route = new CameraRoute([[0, 0, 10], [0, 0, -10]]);
  }

  addMesh(geo, mat, x = 0, y = 0, z = 0, opts = {}) {
    _m.compose(V(x, y, z), _q.setFromEuler(_e.set(opts.rx || 0, opts.yaw || 0, opts.rz || 0)), V(opts.sx ?? opts.s ?? 1, opts.sy ?? opts.s ?? 1, opts.sz ?? opts.s ?? 1));
    this.batch.add(geo, mat, { matrix: _m, cast: opts.cast, receive: opts.receive });
  }

  spawn(x, y, z, yaw = Math.PI) {
    this.spawns.push({ pos: V(x, y, z), yaw });
  }

  setRoute(points) {
    this.route = new CameraRoute(points);
  }

  island(x, y, z, o = {}) {
    const radius = o.radius ?? 8;
    const geo = G.islandGeometry({
      radius, depth: o.depth ?? radius * 0.9, seed: o.seed ?? this.rand() * 100, rimNoise: o.rimNoise ?? 0.14,
      bump: o.bump ?? 0.2, sx: o.sx ?? 1, sz: o.sz ?? 1, spikes: o.spikes ?? 5,
      segments: o.segments ?? 72, rings: o.rings ?? 26,
    });
    geo.translate(x, y, z);
    const mat = o.bare ? this.mats.terrainBare : this.mats.terrain;
    this.batch.add(geo, mat, {});
    if (!o.noCollide) this.world.physics.trimeshFromGeometry(geo, null, null, { type: 'ground', surface: o.bare ? 'stone' : 'grass', grass: !o.bare && o.grass !== false });
    if (!o.bare && o.grass !== false) this.grassPatches.push({ x, y, z, r: radius * 0.97, sx: o.sx ?? 1, sz: o.sz ?? 1, density: o.grassDensity ?? 1 });
    if (o.flowers) this.flowerPatches.push({ x, y, z, r: radius * 0.85, sx: o.sx ?? 1, sz: o.sz ?? 1, n: o.flowers });
    const r = rng(Math.floor((o.seed ?? 1) * 13) + 5);
    for (let i = 0; i < (o.rocks ?? 0); i++) {
      const a = r() * TAU, d = radius * (0.55 + r() * 0.35);
      this.rock(x + Math.cos(a) * d * (o.sx ?? 1), y, z + Math.sin(a) * d * (o.sz ?? 1), 0.4 + r() * 0.6, { collide: false });
    }
    return { x, y, z, radius };
  }

  block(x, y, z, o = {}) {
    const w = o.w ?? 3, h = o.h ?? 1, d = o.d ?? 3;
    const round = Math.min(o.round ?? 0.15, Math.min(w, h, d) * 0.45);
    const geo = new RoundedBoxGeometry(w, h, d, 3, round);
    const mat = typeof o.mat === 'string' ? this.mats[o.mat] : o.mat || this.mats.stone;
    const cy = y - h / 2;
    this.addMesh(geo, mat, x, cy, z, { yaw: o.yaw || 0, rx: o.rx || 0, rz: o.rz || 0 });
    _q.setFromEuler(_e.set(o.rx || 0, o.yaw || 0, o.rz || 0));
    if (o.collide !== false) this.world.physics.box(V(w / 2, h / 2, d / 2), V(x, cy, z), _q, null, { type: 'ground', surface: o.surface || 'stone', hazard: o.hazard });
    return { x, y, z };
  }

  pillar(x, y, z, o = {}) {
    const r = o.r ?? 1.3, h = o.h ?? 7;
    const geo = G.pillarGeometry(r, h, o.seed ?? this.rand() * 50);
    geo.translate(x, y, z);
    this.batch.add(geo, o.bare ? this.mats.terrainBare : this.mats.terrain, {});
    this.world.physics.cylinder(h / 2, r * 0.98, V(x, y - h / 2, z), null, null, { type: 'ground', surface: 'grass' });
    if (o.grass !== false && !o.bare) this.grassPatches.push({ x, y, z, r: r * 0.95, sx: 1, sz: 1, density: 1.2 });
  }

  bridge(a, b, o = {}) {
    a = toV(a);
    b = toV(b);
    const width = o.width ?? 2.2;
    const dir = b.clone().sub(a);
    const len = dir.length();
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = -Math.asin(dir.y / len);
    const n = Math.max(2, Math.floor(len / 0.55));
    const m = this.mats;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const p = a.clone().lerp(b, t);
      const sag = Math.sin(t * Math.PI) * (o.sag ?? 0.35);
      const plank = G.plankGeometry(width * (0.95 + this.rand() * 0.1), 0.12, 0.44, i);
      this.addMesh(plank, i % 3 === 1 ? m.darkWood : m.wood, p.x, p.y - 0.06 - sag, p.z, { yaw: yaw + (this.rand() - 0.5) * 0.06, rx: pitch });
    }
    // colisor: segmentos acompanhando a curvatura
    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const p0 = a.clone().lerp(b, t0);
      p0.y -= Math.sin(t0 * Math.PI) * (o.sag ?? 0.35);
      const p1 = a.clone().lerp(b, t1);
      p1.y -= Math.sin(t1 * Math.PI) * (o.sag ?? 0.35);
      const c = p0.clone().add(p1).multiplyScalar(0.5);
      const dd = p1.clone().sub(p0);
      const l = dd.length();
      const pp = -Math.asin(dd.y / l);
      _q.setFromEuler(_e.set(pp, yaw, 0, 'YXZ'));
      this.world.physics.box(V(width / 2, 0.08, l / 2 + 0.05), c.add(V(0, -0.1, 0)), _q, null, { type: 'ground', surface: 'wood' });
    }
    // postes e cordas
    const side = V(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(width / 2 + 0.1);
    for (const end of [a, b]) {
      for (const s of [1, -1]) {
        const pp = end.clone().addScaledVector(side, s);
        this.addMesh(new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), m.darkWood, pp.x, pp.y + 0.5, pp.z);
      }
    }
    for (const s of [1, -1]) {
      const r0 = a.clone().addScaledVector(side, s).add(V(0, 1.1, 0));
      const r1 = b.clone().addScaledVector(side, s).add(V(0, 1.1, 0));
      this.batch.add(G.ropeGeometry(r0, r1, (o.sag ?? 0.35) + 0.3, 0.04), m.rope, {});
    }
  }

  // Plataforma móvel. shape: stone | cloud | leaf | crystal | gear | wood
  moving(o) {
    const m = this.mats;
    const shape = o.shape ?? 'stone';
    const size = o.size ?? [3, 0.6, 3];
    const obj = new THREE.Group();
    const colliders = [];
    let surface = 'stone';
    if (shape === 'cloud') {
      const s = o.radius ?? 1.8;
      const mesh = new THREE.Mesh(G.cloudGeometry(s, o.seed ?? this.rand() * 99, 0.5), m.cloud);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obj.add(mesh);
      colliders.push({ shape: 'cylinder', r: s * 0.95, hh: 0.3, offset: V(0, -0.05, 0) });
      surface = 'cloud';
    } else if (shape === 'leaf') {
      const s = o.radius ?? 1.9;
      const g = new THREE.CylinderGeometry(s, s * 0.95, 0.18, 28, 1, false, 0.25, TAU - 0.5);
      const mesh = new THREE.Mesh(g, m.leafPad);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obj.add(mesh);
      colliders.push({ shape: 'cylinder', r: s * 0.95, hh: 0.09 });
      surface = 'grass';
    } else if (shape === 'gear') {
      const outer = o.radius ?? 3.2;
      const mesh = new THREE.Mesh(G.gearGeometry(outer, outer * 0.86, o.teeth ?? 16, 0.7, outer * 0.18), m.brass);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obj.add(mesh);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(outer * 0.25, outer * 0.25, 0.9, 16), m.darkMetal);
      obj.add(hub);
      colliders.push({ shape: 'cylinder', r: outer * 0.9, hh: 0.35 });
      surface = 'metal';
    } else if (shape === 'crystal') {
      const r = o.radius ?? 1.8;
      const g = new THREE.CylinderGeometry(r, r * 0.6, 0.6, 6);
      const mesh = new THREE.Mesh(g, m.crystalCyan);
      mesh.castShadow = true;
      obj.add(mesh);
      const under = new THREE.Mesh(G.crystalGeometry(1.4, r * 0.5, 6, 0.8), m.crystalCyan);
      under.rotation.x = Math.PI;
      under.position.y = -0.3;
      obj.add(under);
      colliders.push({ shape: 'cylinder', r: r * 0.95, hh: 0.3 });
      surface = 'crystal';
    } else {
      const [w, h, d] = size;
      const mat = shape === 'wood' ? m.wood : m.stone;
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.15), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      obj.add(mesh);
      if (shape !== 'wood') {
        const under = new THREE.Mesh(G.rockGeometry(Math.min(w, d) * 0.45, 1, 0.3, this.rand() * 9, 1, 0.9, 1), m.terrainBare);
        under.position.y = -h * 0.5 - Math.min(w, d) * 0.2;
        under.scale.set(1, 0.8, 1);
        obj.add(under);
      }
      colliders.push({ shape: 'box', half: V(w / 2, h / 2, d / 2) });
      surface = shape === 'wood' ? 'wood' : 'stone';
    }
    this.group.add(obj);
    const plat = new MovingPlatform(this.world, {
      object: obj, colliders, path: (o.path || [o.pos]).map(toV), speed: o.speed, wait: o.wait, loop: o.loop,
      rotateSpeed: o.rotateSpeed, yaw: o.yaw, phase: o.phase, bobAmp: o.bob ?? 0, bobFreq: o.bobFreq ?? 0.4, orbit: o.orbit && {
        center: toV(o.orbit.center), radius: o.orbit.radius, speed: o.orbit.speed, phase: o.orbit.phase,
      }, surface,
    });
    this.platforms.push(plat);
    return plat;
  }

  crumble(x, y, z, o = {}) {
    const w = o.w ?? 2.6, h = o.h ?? 0.45, d = o.d ?? 2.6;
    const obj = new THREE.Group();
    const top = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.08), this.mats.wood);
    top.castShadow = true;
    top.receiveShadow = true;
    const cracks = new THREE.Mesh(new RoundedBoxGeometry(w * 0.2, h * 1.05, d * 1.02, 1, 0.02), this.mats.darkWood);
    const cracks2 = cracks.clone();
    cracks.position.x = -w * 0.25;
    cracks2.position.x = w * 0.25;
    obj.add(top, cracks, cracks2);
    this.group.add(obj);
    const p = new CrumblePlatform(this.world, { object: obj, half: V(w / 2, h / 2, d / 2), pos: V(x, y - h / 2, z) });
    this.platforms.push(p);
    return p;
  }

  pad(x, y, z, o = {}) {
    const m = this.mats;
    const obj = new THREE.Group();
    const s = o.scale ?? 1;
    const { stem, cap } = G.mushroomGeometry(1.25 * s, 0.9 * s, 0.35 * s);
    const stemM = new THREE.Mesh(stem, m.mushStem);
    const capGroup = new THREE.Group();
    capGroup.position.y = 0.9 * s;
    cap.translate(0, -0.9 * s, 0);
    const capMat = o.glow ? m.mushCapGlow : o.pink ? m.mushCapPink : m.mushCapRed;
    const capM = new THREE.Mesh(cap, capMat);
    capGroup.add(capM);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), m.spots);
      spot.scale.set(1, 0.4, 1);
      spot.position.set(Math.cos(a) * 0.7 * s, 0.55 * s, Math.sin(a) * 0.7 * s);
      capGroup.add(spot);
    }
    for (const c of [stemM, capM]) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
    obj.add(stemM, capGroup);
    obj.position.set(x, y, z);
    this.group.add(obj);
    const pad = new BouncePad(this.world, { object: obj, cap: capGroup, pos: V(x, y, z), power: o.power ?? 21, radius: 1.2 * s });
    this.entities.push(pad);
    return pad;
  }

  // ------------------------------------------------------------------ colecionáveis
  spark(x, y, z) {
    this.sparkPositions.push(V(x, y, z));
  }
  sparksLine(a, b, n) {
    a = toV(a);
    b = toV(b);
    for (let i = 0; i < n; i++) this.sparkPositions.push(a.clone().lerp(b, n === 1 ? 0.5 : i / (n - 1)));
  }
  sparksArc(a, b, n, h = 2.5) {
    a = toV(a);
    b = toV(b);
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const p = a.clone().lerp(b, t);
      p.y += Math.sin(t * Math.PI) * h;
      this.sparkPositions.push(p);
    }
  }
  sparksCircle(c, r, n, y0 = 0) {
    c = toV(c);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      this.sparkPositions.push(V(c.x + Math.cos(a) * r, c.y + y0, c.z + Math.sin(a) * r));
    }
  }
  seed(x, y, z, index) {
    const have = this.world.game.save.seedsFor(this.id)[index];
    const s = new LightSeed(this.world, V(x, y, z), index, have);
    this.seeds.push(s);
    this.entities.push(s);
  }
  heart(x, y, z) {
    this.entities.push(new HeartPickup(this.world, V(x, y, z)));
  }

  // ------------------------------------------------------------------ entidades
  enemy(type, x, y, z, o = {}) {
    const Cls = ENEMY_TYPES[type];
    const opts = { ...o };
    if (o.patrol) opts.patrol = o.patrol.map(toV);
    if (o.path) opts.path = o.path.map(toV);
    const e = new Cls(this.world, V(x, y, z), opts);
    this.enemies.push(e);
    return e;
  }
  checkpoint(x, y, z, yaw = 0) {
    const c = new Checkpoint(this.world, V(x, y, z), yaw, this.mats);
    this.checkpoints.push(c);
    this.entities.push(c);
    return c;
  }
  goal(x, y, z, yaw = 0, opts = {}) {
    this.goalObj = new Lighthouse(this.world, V(x, y, z), yaw, this.mats, opts);
    this.entities.push(this.goalObj);
    return this.goalObj;
  }
  veil(x, y, z, yaw = 0, w = 6, h = 5) {
    const v = new ShadowVeil(this.world, V(x, y, z), yaw, w, h);
    this.veils.push(v);
    this.entities.push(v);
    return v;
  }
  crate(x, y, z, contents = 'sparks') {
    const c = new Crate(this.world, V(x, y, z), this.mats, contents);
    this.crates.push(c);
    this.entities.push(c);
    return c;
  }
  sign(x, y, z, yaw, text) {
    this.entities.push(new Sign(this.world, V(x, y, z), yaw, text, this.mats));
  }
  pendulum(x, y, z, o = {}) {
    const p = new Pendulum(this.world, V(x, y, z), o.length ?? 5, o.amp ?? 1.1, o.speed ?? 1.5, o.phase ?? 0, o.yaw ?? 0, this.mats);
    this.entities.push(p);
    return p;
  }
  lightBridge(a, b, width = 2.4, panels = 6) {
    const lb = new LightBridge(this.world, toV(a), toV(b), width, panels);
    this.entities.push(lb);
    return lb;
  }

  // ------------------------------------------------------------------ decoração
  tree(x, y, z, s = 1, o = {}) {
    const { trunk, crown } = G.treeGeometry(o.seed ?? this.rand() * 1000, 3.6 * s, 1.9 * s);
    const g = new THREE.Group();
    const tm = new THREE.Mesh(trunk, this.mats.trunk);
    const cm = new THREE.Mesh(crown, o.mat || this.mats.leaf);
    tm.castShadow = cm.castShadow = true;
    tm.receiveShadow = cm.receiveShadow = true;
    g.add(tm, cm);
    g.position.set(x, y, z);
    g.rotation.y = this.rand() * TAU;
    this.group.add(g);
    if (o.collide !== false) this.world.physics.cylinder(1.8 * s, 0.32 * s, V(x, y + 1.8 * s, z), null, null, { type: 'prop', surface: 'wood' });
  }
  pine(x, y, z, s = 1) {
    const { trunk, crown } = G.pineGeometry(this.rand() * 1000, 5 * s);
    const g = new THREE.Group();
    const tm = new THREE.Mesh(trunk, this.mats.trunk);
    const cm = new THREE.Mesh(crown, this.mats.pineLeaf);
    tm.castShadow = cm.castShadow = true;
    cm.receiveShadow = true;
    g.add(tm, cm);
    g.position.set(x, y, z);
    this.group.add(g);
    this.world.physics.cylinder(2 * s, 0.3 * s, V(x, y + 2 * s, z), null, null, { type: 'prop' });
  }
  rock(x, y, z, s = 1, o = {}) {
    const geo = G.rockGeometry(1, 1, 0.3, this.rand() * 99, 1, 0.75, 1);
    this.addMesh(geo, o.mat ? this.mats[o.mat] : this.mats.terrainBare, x, y + 0.2 * s, z, { s, yaw: this.rand() * TAU });
    if (o.collide) this.world.physics.ball(s * 0.85, V(x, y + 0.2 * s, z), null, { type: 'ground', surface: 'stone' });
  }
  crystals(x, y, z, s = 1, color = 'crystalCyan', light = true) {
    const geo = G.crystalCluster(this.rand() * 99, s);
    this.addMesh(geo, this.mats[color], x, y, z, { yaw: this.rand() * TAU });
    if (light && this.world.quality.playerLights) {
      const l = new THREE.PointLight(color === 'crystalPink' ? '#ff5ad0' : color === 'crystalGold' ? '#ffc04a' : '#4fdcff', 4 * s, 7 * s, 2);
      l.position.set(x, y + 1.2 * s, z);
      this.group.add(l);
    }
    this.world.physics.cylinder(0.9 * s, 0.45 * s, V(x, y + 0.9 * s, z), null, null, { type: 'prop', surface: 'crystal' });
  }
  mushroom(x, y, z, s = 1, kind = 'red') {
    const { stem, cap } = G.mushroomGeometry(0.8 * s, 1.1 * s, 0.22 * s);
    this.addMesh(stem, this.mats.mushStem, x, y, z);
    const mat = kind === 'glow' ? this.mats.mushCapGlow : kind === 'pink' ? this.mats.mushCapPink : this.mats.mushCapRed;
    this.addMesh(cap, mat, x, y, z);
  }
  cloudDeco(x, y, z, s = 3) {
    const geo = G.cloudGeometry(s, this.rand() * 99, 0.55);
    this.addMesh(geo, this.mats.cloud, x, y, z, { cast: false });
  }
  windmill(x, y, z, yaw = 0) {
    const m = this.mats;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.7, 6.5, 10), m.stone);
    body.position.y = 3.25;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.8, 10), m.brick);
    roof.position.y = 7.4;
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.4, 0.3, 2, 0.1), m.darkWood);
    door.position.set(0, 0.7, 1.55);
    const hub = new THREE.Group();
    hub.position.set(0, 5.8, 1.35);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 10), m.darkWood);
    axle.rotation.x = Math.PI / 2;
    hub.add(axle);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.2, 0.1), m.darkWood);
      arm.position.y = 2.1;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.0, 3.2, 0.04), m.banner);
      sail.position.set(0.55, 2.5, 0);
      blade.add(arm, sail);
      blade.rotation.z = (i / 4) * TAU;
      blade.position.z = 0.3;
      hub.add(blade);
    }
    for (const o of [body, roof, door]) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    hub.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    g.add(body, roof, door, hub);
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    this.group.add(g);
    this.spinners.push({ object: hub, axis: 'z', speed: 0.6 });
    this.world.physics.cylinder(3.25, 1.5, V(x, y + 3.25, z), null, null, { type: 'prop' });
  }
  waterfall(x, y, z, yaw = 0, width = 2.5, height = 30) {
    const geo = new THREE.PlaneGeometry(width, height, 1, 12);
    // curva para fora na parte de cima
    const p = geo.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i);
      const k = (height / 2 - yy) / height;
      p.setZ(i, Math.sqrt(Math.max(0, k)) * 2.2);
      p.setY(i, yy - height / 2);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, waterfallMaterial(this.world.env.id === 'night' ? '#7fb8ff' : '#bfe8ff'));
    mesh.position.set(x, y, z);
    mesh.rotation.y = yaw;
    mesh.renderOrder = 6;
    this.group.add(mesh);
    this.animated.push({ type: 'mist', pos: V(x, y, z), yaw });
  }
  gearDeco(x, y, z, r = 4, axis = 'y', speed = 0.3, mat = 'brass', o = {}) {
    const geo = G.gearGeometry(r, r * 0.84, Math.round(r * 5), o.thick ?? 0.6, r * 0.2);
    const mesh = new THREE.Mesh(geo, this.mats[mat]);
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    g.add(mesh);
    if (o.yaw) g.rotation.y = o.yaw;
    this.group.add(g);
    this.spinners.push({ object: mesh, axis: 'y', speed, local: true });
    return g;
  }
  tower(x, y, z, o = {}) {
    // torre de pedra (Cidadela)
    const r = o.r ?? 3, h = o.h ?? 20;
    const geo = new THREE.CylinderGeometry(r, r * 1.1, h, 16, 6);
    this.addMesh(geo, this.mats[o.mat ?? 'darkStone'], x, y - h / 2, z);
    const roof = new THREE.ConeGeometry(r * 1.3, r * 1.6, 16);
    if (o.roof !== false) this.addMesh(roof, this.mats.brick, x, y + r * 0.8, z);
    if (o.collide !== false) this.world.physics.cylinder(h / 2, r, V(x, y - h / 2, z), null, null, { type: 'ground', surface: 'stone' });
  }
  arch(x, y, z, yaw = 0, w = 5, h = 5, mat = 'stone') {
    const m = this.mats[mat];
    const pillarG = new THREE.BoxGeometry(0.8, h, 0.8);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const side of [-1, 1]) {
      const px = x + c * side * (w / 2), pz = z - s * side * (w / 2);
      this.addMesh(pillarG, m, px, y + h / 2, pz, { yaw });
      this.world.physics.box(V(0.4, h / 2, 0.4), V(px, y + h / 2, pz), _q.setFromEuler(_e.set(0, yaw, 0)), null, { type: 'prop' });
    }
    const top = new THREE.TorusGeometry(w / 2, 0.45, 8, 20, Math.PI);
    this.addMesh(top, m, x, y + h, z, { yaw });
  }
  banner(x, y, z, yaw = 0, color = '#d9463b') {
    const pole = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
    this.addMesh(pole, this.mats.darkWood, x, y + 1.5, z);
    const flagG = new THREE.PlaneGeometry(1.2, 0.8, 6, 2);
    flagG.translate(0.6, 0, 0);
    const mat = M.standard(color, { roughness: 0.8, side: THREE.DoubleSide }, { wind: 0.25 });
    const flag = new THREE.Mesh(flagG, mat);
    flag.position.set(x, y + 2.6, z);
    flag.rotation.y = yaw;
    flag.castShadow = true;
    this.group.add(flag);
  }

  // ------------------------------------------------------------------ grama e flores
  buildGrass() {
    const q = this.world.quality;
    const dens = (this.def.grassDensity ?? 9) * q.grassDensity;
    if (dens <= 0.01 || !this.grassPatches.length) return;
    const pts = [];
    const phys = this.world.physics;
    const r = rng(99);
    const down = { x: 0, y: -1, z: 0 };
    for (const gp of this.grassPatches) {
      const area = Math.PI * gp.r * gp.r * gp.sx * gp.sz;
      const n = Math.floor(area * dens * gp.density);
      for (let i = 0; i < n; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * gp.r;
        const x = gp.x + Math.cos(a) * d * gp.sx;
        const z = gp.z + Math.sin(a) * d * gp.sz;
        const hit = phys.raycast({ x, y: gp.y + 3, z }, down, 6);
        if (!hit || hit.normal.y < 0.8 || !hit.info || !hit.info.grass) continue;
        pts.push(hit.point);
      }
    }
    if (!pts.length) return;
    const pal = this.world.env.grass;
    // divide em blocos para culling
    const cells = new Map();
    for (const p of pts) {
      const k = `${Math.floor(p.x / 24)}:${Math.floor(p.z / 24)}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(p);
    }
    this.grass = [];
    for (const list of cells.values()) {
      const gf = new GrassField(list, pal, { height: this.def.grassHeight ?? 0.55 });
      this.group.add(gf.mesh);
      this.grass.push(gf);
    }
    // flores
    const fpts = [];
    for (const fp of this.flowerPatches) {
      for (let i = 0; i < fp.n; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * fp.r;
        const x = fp.x + Math.cos(a) * d * fp.sx, z = fp.z + Math.sin(a) * d * fp.sz;
        const hit = phys.raycast({ x, y: fp.y + 3, z }, down, 6);
        if (hit && hit.normal.y > 0.85 && hit.info?.grass) fpts.push(hit.point);
      }
    }
    if (fpts.length) {
      for (let c = 0; c < 5; c++) {
        const sub = fpts.filter((_, i) => i % 5 === c);
        if (!sub.length) continue;
        const im = new THREE.InstancedMesh(G.flowerGeometry(c), this.mats.flower, sub.length);
        const mm = new THREE.Matrix4();
        sub.forEach((p, i) => {
          mm.compose(p, _q.setFromEuler(_e.set(0, r() * TAU, 0)), V(1, 1, 1).multiplyScalar(0.8 + r() * 0.6));
          im.setMatrixAt(i, mm);
        });
        im.castShadow = false;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        this.group.add(im);
      }
    }
  }

  // ------------------------------------------------------------------ cenário distante
  buildBackdrop(o) {
    const r = rng(this.def.seed ?? 3);
    const center = o.center ? toV(o.center) : V(0, 0, -60);
    const count = o.count ?? 16;
    const bare = o.bare ?? false;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + r() * 0.3;
      const d = (o.minDist ?? 150) + r() * (o.spread ?? 160);
      const x = center.x + Math.cos(a) * d, z = center.z + Math.sin(a) * d;
      const y = (o.y ?? -5) + (r() - 0.5) * 40;
      const rad = 8 + r() * 22;
      const geo = G.islandGeometry({ radius: rad, depth: rad * (0.8 + r() * 0.6), seed: r() * 99, segments: 36, rings: 12, rimNoise: 0.2, spikes: 3 });
      geo.translate(x, y, z);
      this.batch.add(geo, bare ? this.mats.terrainBare : this.mats.terrain, { cast: false });
      // árvores distantes simples
      if (!bare && o.trees !== false) {
        const nt = Math.floor(rad / 4);
        for (let t = 0; t < nt; t++) {
          const ta = r() * TAU, td = r() * rad * 0.7;
          const s = 1.5 + r() * 2;
          const cone = new THREE.ConeGeometry(s * 0.9, s * 3, 7);
          this.addMesh(cone, this.mats.pineLeaf, x + Math.cos(ta) * td, y + s * 1.4, z + Math.sin(ta) * td, { cast: false });
        }
      }
      if (o.structures) o.structures(this, x, y, z, rad, r);
    }
    this.batch.build(this.group).forEach((m) => this.meshes.push(m));
  }

  // ------------------------------------------------------------------ runtime
  updatePlatforms(dt) {
    for (const p of this.platforms) p.update(dt);
  }

  update(dt) {
    for (const s of this.spinners) s.object.rotation[s.axis] += s.speed * dt;
    for (const e of this.entities) e.update(dt);
    for (const e of this.enemies) e.update(dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      if (!this.debris[i].update(dt)) {
        this.debris[i].dispose();
        this.debris.splice(i, 1);
      }
    }
    // névoa das cachoeiras
    for (const a of this.animated) {
      if (a.type === 'mist' && Math.random() < dt * 6) {
        this.world.effects.norm.emit({
          x: a.pos.x + (Math.random() - 0.5) * 2, y: a.pos.y - 0.3, z: a.pos.z + (Math.random() - 0.5) * 2,
          vx: Math.sin(a.yaw) * 1.5, vy: -0.5, vz: Math.cos(a.yaw) * 1.5, life: 1.4, size: 0.6, size1: 2.2,
          color: [1, 1, 1], alpha: 0.35, alpha1: 0, drag: 1, shape: 3,
        });
      }
    }
  }

  dispose() {
    for (const e of [...this.entities, ...this.enemies, ...this.platforms, ...this.debris]) e.dispose?.();
    this.world.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) o.geometry?.dispose();
    });
    for (const m of Object.values(this.mats)) m.dispose?.();
    for (const g of this.grass || []) g.dispose();
  }
}

export { shade };
