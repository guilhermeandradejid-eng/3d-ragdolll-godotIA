// Plataformas dinâmicas: móveis (caminho), giratórias (engrenagens), que desmoronam,
// e cogumelos/flor de impulso. Todas são corpos cinemáticos no Rapier e informam o
// "delta" de transformação para carregar quem está em cima.
import * as THREE from 'three';
import { GROUP } from '../world/Physics.js';
import { clamp, easeInOutCubic } from '../core/math.js';

const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _e = new THREE.Euler();

export class MovingPlatform {
  /**
   * opts: { object, colliders: [{shape:'box', half:Vector3, offset?}|{shape:'cylinder', r, hh}|{shape:'hull', points}],
   *         path: [Vector3], speed, wait, loop, rotateSpeed, phase, bobAmp, bobFreq, surface, orbit:{center, radius, speed} }
   */
  constructor(world, opts) {
    this.world = world;
    this.opts = opts;
    this.object = opts.object;
    this.path = (opts.path || [opts.object.position.clone()]).map((p) => p.clone());
    this.speed = opts.speed ?? 3;
    this.wait = opts.wait ?? 0.6;
    this.loop = !!opts.loop;
    this.rotateSpeed = opts.rotateSpeed ?? 0;
    this.baseYaw = opts.yaw ?? 0;
    this.t = opts.phase ?? 0;
    this.bobAmp = opts.bobAmp ?? 0;
    this.bobFreq = opts.bobFreq ?? 1;
    this.orbit = opts.orbit || null;
    this.velocity = new THREE.Vector3();
    this.delta = new THREE.Matrix4();
    this.deltaYaw = 0;
    this.matrix = new THREE.Matrix4();
    this.pos = this.path[0].clone();
    this.yaw = this.baseYaw;
    this.active = opts.active ?? true;

    // tempos de cada segmento
    this.segments = [];
    const pts = this.loop ? [...this.path, this.path[0]] : this.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const len = pts[i].distanceTo(pts[i + 1]);
      this.segments.push({ a: pts[i], b: pts[i + 1], time: Math.max(0.2, len / this.speed) });
    }
    this.cycle = this.segments.reduce((s, g) => s + g.time + this.wait, 0);
    if (!this.loop) this.cycle *= 2;

    const phys = world.physics;
    this.body = phys.addKinematicBody(this.pos, _q.setFromEuler(_e.set(0, this.yaw, 0)));
    this.info = { type: 'platform', platform: this, moving: true, surface: opts.surface || 'stone' };
    for (const c of opts.colliders || []) {
      let col;
      if (c.shape === 'box') col = phys.box(c.half, c.offset, c.quat, this.body, this.info, GROUP.PLATFORM, { round: c.round });
      else if (c.shape === 'cylinder') col = phys.cylinder(c.hh, c.r, c.offset, c.quat, this.body, this.info, GROUP.PLATFORM);
      else if (c.shape === 'hull') col = phys.convexHull(c.points, this.body, this.info, GROUP.PLATFORM);
      else if (c.shape === 'trimesh') col = phys.trimeshFromGeometry(c.geometry, c.matrix, this.body, this.info, GROUP.PLATFORM);
    }
    this.object.position.copy(this.pos);
    this.object.rotation.set(0, this.yaw, 0);
    this.matrix.compose(this.pos, _q.setFromEuler(_e.set(0, this.yaw, 0)), new THREE.Vector3(1, 1, 1));
    this._scale = new THREE.Vector3(1, 1, 1);
  }

  evalPath(t) {
    if (this.path.length < 2) return this.path[0];
    let tt = t % this.cycle;
    const forward = this.loop ? true : tt < this.cycle / 2;
    if (!this.loop && !forward) tt -= this.cycle / 2;
    const segs = this.loop || forward ? this.segments : [...this.segments].reverse();
    for (const s of segs) {
      if (tt < this.wait) return this.loop || forward ? s.a : s.b;
      tt -= this.wait;
      if (tt < s.time) {
        const k = easeInOutCubic(tt / s.time);
        return this.loop || forward ? this._tmp.lerpVectors(s.a, s.b, k) : this._tmp.lerpVectors(s.b, s.a, k);
      }
      tt -= s.time;
    }
    return this.loop ? this.path[0] : forward ? this.path[this.path.length - 1] : this.path[0];
  }

  update(dt) {
    if (!this._tmp) this._tmp = new THREE.Vector3();
    if (this.active) this.t += dt;
    const prevPos = this._prev || (this._prev = new THREE.Vector3());
    prevPos.copy(this.pos);
    const prevYaw = this.yaw;
    if (this.orbit) {
      const o = this.orbit;
      const a = this.t * o.speed + (o.phase || 0);
      this.pos.set(o.center.x + Math.cos(a) * o.radius, o.center.y, o.center.z + Math.sin(a) * o.radius);
    } else {
      this.pos.copy(this.evalPath(this.t));
    }
    if (this.bobAmp) this.pos.y += Math.sin(this.t * this.bobFreq * Math.PI * 2) * this.bobAmp;
    this.yaw = this.baseYaw + this.rotateSpeed * this.t;
    this.velocity.copy(this.pos).sub(prevPos).divideScalar(Math.max(dt, 1e-4));
    this.deltaYaw = this.yaw - prevYaw;

    _q.setFromEuler(_e.set(0, this.yaw, 0));
    _inv.copy(this.matrix).invert();
    this.matrix.compose(this.pos, _q, this._scale);
    this.delta.multiplyMatrices(this.matrix, _inv);

    this.body.setNextKinematicTranslation(this.pos);
    this.body.setNextKinematicRotation(_q);
    this.object.position.copy(this.pos);
    this.object.quaternion.copy(_q);
  }

  dispose() {
    this.world.physics.removeBody(this.body);
  }
}

// Plataforma que treme e cai quando alguém fica em cima; reaparece depois.
export class CrumblePlatform {
  constructor(world, { object, half, pos, surface = 'wood' }) {
    this.world = world;
    this.object = object;
    this.home = pos.clone();
    this.pos = pos.clone();
    this.state = 'idle';
    this.t = 0;
    this.vy = 0;
    this.body = world.physics.addKinematicBody(pos);
    this.velocity = new THREE.Vector3();
    this.delta = new THREE.Matrix4();
    this.deltaYaw = 0;
    this.info = {
      type: 'platform', platform: this, moving: true, crumble: true, surface,
      onStand: () => {
        if (this.state === 'idle') {
          this.state = 'shaking';
          this.t = 0;
          world.onEvent('crumbleStart', this.pos);
        }
      },
    };
    this.collider = world.physics.box(half, null, null, this.body, this.info, GROUP.PLATFORM);
    object.position.copy(pos);
  }

  update(dt) {
    this.t += dt;
    const prev = this._prev || (this._prev = new THREE.Vector3());
    prev.copy(this.pos);
    let shake = 0;
    if (this.state === 'shaking') {
      shake = 0.06;
      if (this.t > 0.6) {
        this.state = 'falling';
        this.t = 0;
        this.vy = 0;
      }
    } else if (this.state === 'falling') {
      this.vy += 22 * dt;
      this.pos.y -= this.vy * dt;
      if (this.t > 0.5) this.collider.setEnabled(false);
      if (this.t > 2.2) {
        this.state = 'gone';
        this.t = 0;
        this.object.visible = false;
      }
    } else if (this.state === 'gone') {
      if (this.t > 2.5) {
        this.state = 'respawn';
        this.t = 0;
        this.pos.copy(this.home);
        this.object.visible = true;
        this.collider.setEnabled(true);
      }
    } else if (this.state === 'respawn') {
      const k = clamp(this.t / 0.4, 0, 1);
      this.object.scale.setScalar(0.2 + 0.8 * k);
      if (k >= 1) this.state = 'idle';
    }
    this.velocity.copy(this.pos).sub(prev).divideScalar(Math.max(dt, 1e-4));
    this.delta.makeTranslation(this.pos.x - prev.x, this.pos.y - prev.y, this.pos.z - prev.z);
    this.body.setNextKinematicTranslation(this.pos);
    this.object.position.set(
      this.pos.x + (Math.random() - 0.5) * shake,
      this.pos.y + (Math.random() - 0.5) * shake * 0.5,
      this.pos.z + (Math.random() - 0.5) * shake,
    );
  }

  dispose() {
    this.world.physics.removeBody(this.body);
  }
}

// Cogumelo/flor de impulso
export class BouncePad {
  constructor(world, { object, cap, pos, power = 21, radius = 1.2 }) {
    this.world = world;
    this.object = object;
    this.cap = cap;
    this.power = power;
    this.squash = 0;
    this.pos = pos.clone();
    this.info = {
      type: 'pad',
      surface: 'bouncy',
      onStand: (player) => {
        player.bounce(this.power, false);
        player.setAction('bounce');
        this.squash = 1;
        world.onEvent('bounce', this.pos, player);
      },
    };
    this.body = world.physics.addFixedBody(pos);
    world.physics.cylinder(0.35, radius, new THREE.Vector3(0, 1.0, 0), null, this.body, this.info, GROUP.STATIC);
  }

  update(dt) {
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 3);
    const k = Math.sin(this.squash * Math.PI * 3) * this.squash;
    if (this.cap) this.cap.scale.set(1 + k * 0.25, 1 - k * 0.35, 1 + k * 0.25);
  }

  dispose() {
    this.world.physics.removeBody(this.body);
  }
}
