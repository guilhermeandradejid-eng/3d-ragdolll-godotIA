// Inimigos criados da poeira de sombra de Nox:
//  - Sombrinha: bolinha saltitante que patrulha e persegue; derrote pulando na cabeça ou girando.
//  - Espinhela: ouriço rolante com espinhos; atordoe com a patada no chão e depois derrote.
//  - Mariposombra: mariposa de sombra que voa em círculos e dá rasantes.
import * as THREE from 'three';
import { shade } from '../render/WorldShading.js';
import { clamp, damp, dampAngle, distXZ } from '../core/math.js';
import { PLAYER_CENTER } from './Player.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const DOWN = { x: 0, y: -1, z: 0 };

function shadowMat(extra = {}) {
  return shade(
    new THREE.MeshPhysicalMaterial({
      color: '#2a1d45', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2, emissive: '#3b1470', emissiveIntensity: 0.35, ...extra,
    }),
    { rim: { color: '#b07aff', power: 2.4, strength: 0.9 } },
  );
}
const eyeMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd84a').multiplyScalar(4) });

class Enemy {
  constructor(world, pos, opts = {}) {
    this.world = world;
    this.pos = pos.clone();
    this.home = pos.clone();
    this.opts = opts;
    this.alive = true;
    this.radius = 0.6;
    this.height = 1;
    this.facing = opts.yaw ?? 0;
    this.t = Math.random() * 10;
    this.stompable = true;
    this.spinnable = true;
    this.stunned = 0;
    this.dying = 0;
    this.object = new THREE.Group();
    world.scene.add(this.object);
  }

  groundAt(x, z, fromY) {
    const hit = this.world.physics.raycast(_v2.set(x, fromY + 1.5, z), DOWN, 6);
    return hit ? hit.point.y : null;
  }

  // Interação com jogadores (pisão, giro, contato)
  interact() {
    if (!this.alive || this.dying) return;
    const w = this.world;
    for (const p of w.players) {
      if (!p.alive || p.celebrate) continue;
      const hd = distXZ(p.position, this.pos);
      const feetAbove = p.position.y - (this.pos.y + this.height * 0.45);
      // pisão na cabeça
      if (p.velocity.y < 0.5 && feetAbove > -0.05 && feetAbove < 1.1 && hd < this.radius + 0.5 && p.headBounceCooldown <= 0) {
        p.headBounceCooldown = 0.15;
        if (this.stompable || this.stunned > 0) {
          if (p.action === 'poundFall') p.setAction('normal');
          p.bounce(13.5);
          p.stats_.stomps++;
          this.defeat(p, 'stomp');
        } else {
          p.bounce(11);
          p.hurt(this.pos);
        }
        continue;
      }
      _v.set(p.position.x, p.position.y + PLAYER_CENTER, p.position.z);
      const cy = this.pos.y + this.height * 0.5;
      const d = Math.hypot(_v.x - this.pos.x, (_v.y - cy) * 0.8, _v.z - this.pos.z);
      if (p.action === 'spin' && d < this.radius + 1.3 && (this.spinnable || this.stunned > 0)) {
        this.defeat(p, 'spin');
        continue;
      }
      if (p.action === 'roll' && d < this.radius + 0.8 && (this.spinnable || this.stunned > 0)) {
        this.defeat(p, 'roll');
        continue;
      }
      if (d < this.radius + 0.42 && this.stunned <= 0) p.hurt(this.pos);
    }
  }

  onShockwave(pos, radius, player) {
    if (!this.alive || this.dying) return;
    if (distXZ(pos, this.pos) < radius && Math.abs(pos.y - this.pos.y) < 2.2) {
      if (this.stompable) this.defeat(player, 'pound');
      else this.stun(3.5);
    }
  }

  stun(t) {
    this.stunned = t;
    this.world.onEvent('enemyStun', this.pos);
  }

  defeat(player, how) {
    if (this.dying) return;
    this.dying = 0.001;
    this.killer = player;
    this.how = how;
    if (how === 'spin' || how === 'roll') {
      _v.copy(this.pos).sub(player.position).setY(0).normalize();
      this.knock = _v.clone().multiplyScalar(14);
      this.knock.y = 9;
    }
    this.world.onEnemyDefeated(this, player, how);
  }

  updateDying(dt) {
    this.dying += dt;
    if (this.knock) {
      this.knock.y -= 30 * dt;
      this.pos.addScaledVector(this.knock, dt);
      this.object.rotation.x += dt * 14;
      this.object.rotation.z += dt * 9;
    } else {
      const k = clamp(this.dying / 0.25, 0, 1);
      this.object.scale.set(1 + k * 0.6, Math.max(0.05, 1 - k), 1 + k * 0.6);
    }
    this.object.position.copy(this.pos);
    if (this.dying > (this.knock ? 0.55 : 0.25)) {
      this.alive = false;
      this.object.visible = false;
      this.world.onEnemyPoof(this);
    }
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// ---------------------------------------------------------------------------
export class Sombrinha extends Enemy {
  constructor(world, pos, opts) {
    super(world, pos, opts);
    this.radius = 0.62;
    this.height = 1.0;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 20), shadowMat());
    body.scale.set(1, 0.86, 1);
    body.position.y = 0.53;
    body.castShadow = true;
    const hornMat = shadowMat({ color: '#1a1030' });
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 10), hornMat);
      horn.position.set(sx * 0.3, 1.02, -0.02);
      horn.rotation.z = -sx * 0.45;
      horn.castShadow = true;
      body.add(horn);
      horn.position.set(sx * 0.3, 0.55, -0.02);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), eyeMat());
      eye.scale.set(1, 1.3, 0.5);
      eye.position.set(sx * 0.2, 0.12, 0.55);
      eye.rotation.z = sx * 0.4;
      body.add(eye);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), hornMat);
      brow.position.set(sx * 0.2, 0.3, 0.56);
      brow.rotation.z = -sx * 0.45;
      body.add(brow);
    }
    // "fumaça" de sombra ao redor
    this.wisps = [];
    for (let i = 0; i < 4; i++) {
      const w = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), shadowMat({ transparent: true, opacity: 0.7 }));
      this.object.add(w);
      this.wisps.push(w);
    }
    this.body = body;
    this.object.add(body);
    this.patrol = (opts.patrol || [pos, pos.clone().add(new THREE.Vector3(3, 0, 0))]).map((p) => p.clone());
    this.pi = 1;
    this.state = 'patrol';
    this.hopT = 0;
    this.hopDur = 0.45;
    this.stateT = 0;
    this.groundY = pos.y;
    this.target = null;
    this.hopping = false;
    this.hopFrom = new THREE.Vector3();
    this.hopTo = new THREE.Vector3();
  }

  update(dt) {
    if (!this.alive) return;
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    this.stateT += dt;
    const w = this.world;
    // escolhe alvo
    let near = null, nd = 1e9;
    for (const p of w.players) {
      if (!p.alive) continue;
      const d = distXZ(p.position, this.pos);
      if (d < nd && Math.abs(p.position.y - this.pos.y) < 3) {
        nd = d;
        near = p;
      }
    }
    if (this.state === 'patrol' && near && nd < 6.5) {
      this.state = 'alert';
      this.stateT = 0;
      this.target = near;
      w.onEvent('enemyAlert', this.pos, this);
    }
    if (this.state === 'alert' && this.stateT > 0.45) {
      this.state = 'chase';
      this.stateT = 0;
    }
    if (this.state === 'chase' && (!this.target || !this.target.alive || distXZ(this.target.position, this.pos) > 12 || this.stateT > 7)) {
      this.state = 'return';
      this.stateT = 0;
    }
    if (this.state === 'return' && distXZ(this.pos, this.home) < 1) this.state = 'patrol';
    if (this.state === 'return' && near && nd < 4.5 && this.stateT > 1.5) {
      this.state = 'alert';
      this.stateT = 0;
      this.target = near;
    }

    // saltos
    if (!this.hopping && this.state !== 'alert') {
      let goal;
      if (this.state === 'patrol') {
        goal = this.patrol[this.pi];
        if (distXZ(goal, this.pos) < 0.6) {
          this.pi = (this.pi + 1) % this.patrol.length;
          goal = this.patrol[this.pi];
        }
      } else if (this.state === 'chase') goal = this.target.position;
      else goal = this.home;
      _v.copy(goal).sub(this.pos).setY(0);
      const len = _v.length();
      if (len > 0.05) {
        const step = Math.min(len, this.state === 'chase' ? 1.7 : 1.1);
        _v.multiplyScalar(step / len);
        const nx = this.pos.x + _v.x, nz = this.pos.z + _v.z;
        const gy = this.groundAt(nx, nz, this.pos.y);
        if (gy !== null && Math.abs(gy - this.groundY) < 1.2) {
          this.hopFrom.copy(this.pos);
          this.hopTo.set(nx, gy, nz);
          this.hopping = true;
          this.hopT = 0;
          this.hopDur = this.state === 'chase' ? 0.34 : 0.48;
          this.facing = Math.atan2(_v.x, _v.z);
        } else if (this.state === 'patrol') {
          this.pi = (this.pi + 1) % this.patrol.length;
        } else if (this.state === 'chase') {
          this.state = 'return';
        }
      }
    }
    let hopH = 0;
    if (this.hopping) {
      this.hopT += dt;
      const k = clamp(this.hopT / this.hopDur, 0, 1);
      this.pos.lerpVectors(this.hopFrom, this.hopTo, k);
      hopH = Math.sin(k * Math.PI) * (this.state === 'chase' ? 0.6 : 0.4);
      this.groundY = this.pos.y;
      if (k >= 1) {
        this.hopping = false;
        this.squash = 1;
      }
    }
    if (this.state === 'alert') hopH = Math.sin(clamp(this.stateT / 0.45, 0, 1) * Math.PI) * 0.7;
    this.squash = Math.max(0, (this.squash || 0) - dt * 5);
    const sq = Math.sin(this.squash * Math.PI) * 0.25;
    this.body.scale.set(1 + sq, 0.86 - sq * 0.8 + (this.hopping ? 0.08 : 0), 1 + sq);
    this.object.position.set(this.pos.x, this.pos.y + hopH, this.pos.z);
    this.object.rotation.y = dampAngle(this.object.rotation.y, this.facing, 10, dt);
    for (let i = 0; i < this.wisps.length; i++) {
      const a = this.t * 1.5 + i * 1.57;
      this.wisps[i].position.set(Math.cos(a) * 0.6, 0.25 + Math.sin(this.t * 3 + i) * 0.15, Math.sin(a) * 0.6);
      this.wisps[i].scale.setScalar(0.6 + Math.sin(this.t * 4 + i * 2) * 0.3);
    }
    this.interact();
  }
}

// ---------------------------------------------------------------------------
export class Espinhela extends Enemy {
  constructor(world, pos, opts) {
    super(world, pos, opts);
    this.radius = 0.85;
    this.height = 1.5;
    this.stompable = false;
    this.spinnable = false;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 3), shadowMat({ color: '#231538' }));
    core.castShadow = true;
    g.add(core);
    this.spikeMat = new THREE.MeshStandardMaterial({ color: '#3a1f5a', emissive: '#ff3fa0', emissiveIntensity: 1.6, roughness: 0.4 });
    const spikeG = new THREE.ConeGeometry(0.13, 0.55, 8);
    spikeG.translate(0, 0.27, 0);
    const n = 22;
    this.spikes = [];
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.39996;
      const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const s = new THREE.Mesh(spikeG, this.spikeMat);
      s.position.copy(dir).multiplyScalar(0.55);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      s.castShadow = true;
      g.add(s);
      this.spikes.push(s);
    }
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(3) }));
      eye.position.set(sx * 0.2, 0.15, 0.56);
      this.object.add(eye);
      eye.position.y += 0.75;
    }
    this.ball = g;
    g.position.y = 0.75;
    this.object.add(g);
    this.path = (opts.path || [pos, pos.clone().add(new THREE.Vector3(5, 0, 0))]).map((p) => p.clone());
    this.speed = opts.speed ?? 3;
    this.dir = 1;
    this.u = 0;
    this.segLen = this.path[0].distanceTo(this.path[1]);
  }

  update(dt) {
    if (!this.alive) return;
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    if (this.stunned > 0) {
      this.stunned -= dt;
      this.spikeMat.emissiveIntensity = 0.1;
      for (const s of this.spikes) s.scale.setScalar(damp(s.scale.x, 0.35, 10, dt));
      this.ball.rotation.z = Math.sin(this.t * 20) * 0.1 * Math.min(1, this.stunned);
    } else {
      this.spikeMat.emissiveIntensity = 1.4 + Math.sin(this.t * 5) * 0.4;
      for (const s of this.spikes) s.scale.setScalar(damp(s.scale.x, 1, 8, dt));
      this.u += (this.dir * this.speed * dt) / this.segLen;
      if (this.u > 1) { this.u = 1; this.dir = -1; }
      if (this.u < 0) { this.u = 0; this.dir = 1; }
      const a = this.path[0], b = this.path[1];
      this.pos.lerpVectors(a, b, this.u);
      const gy = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
      if (gy !== null) this.pos.y = gy;
      _v.copy(b).sub(a).normalize();
      this.facing = Math.atan2(_v.x * this.dir, _v.z * this.dir);
      this.ball.rotation.x += dt * this.speed / 0.8;
    }
    this.object.position.copy(this.pos);
    this.object.rotation.y = dampAngle(this.object.rotation.y, this.facing, 8, dt);
    this.interact();
  }
}

// ---------------------------------------------------------------------------
function mothWingMaterial(color1, color2) {
  return new THREE.ShaderMaterial({
    uniforms: { uC1: { value: new THREE.Color(color1) }, uC2: { value: new THREE.Color(color2) }, uGlow: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uC1; uniform vec3 uC2; uniform float uGlow;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        // contorno da asa (elipse com recorte)
        float shape = 1.0 - smoothstep(0.85, 1.0, length(p * vec2(1.0, 1.35)));
        if (shape < 0.05) discard;
        float eye = smoothstep(0.26, 0.2, length(p - vec2(0.2, 0.05)));
        float eyeRing = smoothstep(0.05, 0.0, abs(length(p - vec2(0.2, 0.05)) - 0.3));
        float veins = smoothstep(0.03, 0.0, abs(sin(atan(p.y, p.x + 1.0) * 9.0)) * length(p + vec2(1.0, 0.0)) * 0.06);
        float edge = smoothstep(0.7, 0.95, length(p * vec2(1.0, 1.35)));
        vec3 col = uC1 * 0.25 + veins * uC1 * 0.3;
        col += uC2 * (eye * 2.5 + eyeRing * 1.8 + edge * 1.2) * uGlow;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export class Mariposombra extends Enemy {
  constructor(world, pos, opts) {
    super(world, pos, opts);
    this.radius = 0.7;
    this.height = 0.8;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.5, 4, 10), shadowMat());
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    this.object.add(body);
    const wingMat = mothWingMaterial('#6a3aa8', '#ff5ac8');
    const wingG = new THREE.PlaneGeometry(1.1, 0.8);
    wingG.translate(0.55, 0, 0);
    wingG.rotateX(-Math.PI / 2);
    this.wings = [];
    for (const sx of [-1, 1]) {
      const wgt = new THREE.Mesh(wingG, wingMat);
      wgt.scale.x = sx;
      wgt.position.set(sx * 0.08, 0.05, 0.05);
      this.object.add(wgt);
      this.wings.push(wgt);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat());
      eye.position.set(sx * 0.09, 0.08, 0.36);
      this.object.add(eye);
    }
    this.center = pos.clone();
    this.orbitR = opts.radius ?? 2.5;
    this.orbitSpeed = opts.speed ?? 1.2;
    this.phase = Math.random() * 6;
    this.state = 'orbit';
    this.stateT = 0;
    this.swoopTarget = new THREE.Vector3();
    this.cool = 2;
  }

  update(dt) {
    if (!this.alive) return;
    if (this.dying) return this.updateDying(dt);
    this.t += dt;
    this.stateT += dt;
    this.cool -= dt;
    const w = this.world;
    if (this.state === 'orbit') {
      const a = this.t * this.orbitSpeed + this.phase;
      _v.set(this.center.x + Math.cos(a) * this.orbitR, this.center.y + Math.sin(this.t * 2) * 0.4, this.center.z + Math.sin(a) * this.orbitR);
      this.pos.lerp(_v, 1 - Math.exp(-4 * dt));
      this.facing = a + Math.PI;
      if (this.cool <= 0) {
        for (const p of w.players) {
          if (!p.alive) continue;
          if (distXZ(p.position, this.center) < 7 && p.position.y < this.center.y + 1 && p.position.y > this.center.y - 6) {
            this.state = 'swoop';
            this.stateT = 0;
            this.swoopTarget.copy(p.position).add(_v2.set(0, 0.9, 0));
            w.onEvent('mothSwoop', this.pos, this);
            break;
          }
        }
      }
    } else if (this.state === 'swoop') {
      _v.copy(this.swoopTarget).sub(this.pos);
      const d = _v.length();
      if (d > 0.1) this.pos.addScaledVector(_v.normalize(), Math.min(d, 7.5 * dt));
      this.facing = Math.atan2(_v.x, _v.z);
      if (this.stateT > 1.1 || d < 0.3) {
        this.state = 'return';
        this.stateT = 0;
      }
    } else {
      _v.copy(this.center).sub(this.pos);
      const d = _v.length();
      if (d > 0.1) this.pos.addScaledVector(_v.normalize(), Math.min(d, 4 * dt));
      if (d < 0.8 || this.stateT > 3) {
        this.state = 'orbit';
        this.cool = 2.5 + Math.random() * 2;
      }
    }
    const flap = Math.sin(this.t * (this.state === 'swoop' ? 26 : 16)) * 0.9;
    this.wings[0].rotation.z = -flap;
    this.wings[1].rotation.z = flap;
    this.object.position.copy(this.pos);
    this.object.rotation.y = dampAngle(this.object.rotation.y, this.facing, 6, dt);
    this.interact();
  }
}

export const ENEMY_TYPES = { sombrinha: Sombrinha, espinhela: Espinhela, mariposa: Mariposombra };
