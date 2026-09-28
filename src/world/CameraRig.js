// Câmeras:
//  - SharedCamera: enquadra todos os jogadores (estilo Super Mario 3D World), orientada por
//    uma "rota de câmera" autoral do nível, com antecipação e travamento vertical suave.
//  - FollowCamera: câmera de terceira pessoa por jogador na tela dividida (estilo It Takes Two).
// Tremor de tela por "trauma" — Squirrel Eiserloh, "Juicing Your Cameras With Math" (GDC 2016).
import * as THREE from 'three';
import { clamp, damp, dampAngle, dampVec3, lerp, sharedNoise, wrapAngle } from '../core/math.js';
import { WORLD_QUERY } from './Physics.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _h = new THREE.Vector3();

class ShakeMixin {
  static apply(cam, trauma, t, strength = 1) {
    if (trauma <= 0.001) return;
    const s = trauma * trauma * strength;
    const n = sharedNoise.noise2;
    cam.position.x += n(t * 25, 1.3) * 0.45 * s;
    cam.position.y += n(t * 25, 7.1) * 0.45 * s;
    cam.position.z += n(t * 25, 3.7) * 0.45 * s;
    cam.rotation.z += n(t * 20, 9.9) * 0.05 * s;
  }
}

// Rota de câmera: polilinha com direção de avanço + ajustes opcionais de pitch/distância.
export class CameraRoute {
  constructor(points) {
    this.points = points.map((p) => ({
      p: new THREE.Vector3(p[0], p[1], p[2]),
      pitch: p[3]?.pitch,
      dist: p[3]?.dist,
      yawOffset: p[3]?.yaw ?? 0,
    }));
  }

  // Retorna { heading (vetor unitário XZ), pitch, dist, yawOffset } no ponto mais próximo.
  sample(pos, out) {
    const pts = this.points;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i].p, b = pts[i + 1].p;
      const abx = b.x - a.x, abz = b.z - a.z, aby = b.y - a.y;
      const len2 = abx * abx + abz * abz + aby * aby;
      let t = len2 > 0 ? ((pos.x - a.x) * abx + (pos.z - a.z) * abz + (pos.y - a.y) * aby) / len2 : 0;
      t = clamp(t, 0, 1);
      const dx = a.x + abx * t - pos.x, dz = a.z + abz * t - pos.z, dy = (a.y + aby * t - pos.y) * 0.5;
      const d = dx * dx + dz * dz + dy * dy;
      if (d < best) {
        best = d;
        bi = i;
        bt = t;
      }
    }
    const seg = (i) => {
      const a = pts[clamp(i, 0, pts.length - 2)].p, b = pts[clamp(i, 0, pts.length - 2) + 1].p;
      return _h.set(b.x - a.x, 0, b.z - a.z).normalize().clone();
    };
    const h0 = seg(bi);
    // mistura suave com o segmento vizinho perto das junções
    let heading = h0;
    if (bt > 0.7 && bi < pts.length - 2) heading = h0.lerp(seg(bi + 1), (bt - 0.7) / 0.6).normalize();
    else if (bt < 0.3 && bi > 0) heading = h0.lerp(seg(bi - 1), (0.3 - bt) / 0.6).normalize();
    const A = pts[bi], B = pts[bi + 1] || A;
    out.heading.copy(heading);
    out.pitch = lerp(A.pitch ?? NaN, B.pitch ?? NaN, bt);
    if (Number.isNaN(out.pitch)) out.pitch = A.pitch ?? B.pitch ?? null;
    out.dist = lerp(A.dist ?? NaN, B.dist ?? NaN, bt);
    if (Number.isNaN(out.dist)) out.dist = A.dist ?? B.dist ?? null;
    out.yawOffset = lerp(A.yawOffset, B.yawOffset, bt);
    out.progress = (bi + bt) / Math.max(1, pts.length - 1);
    return out;
  }
}

export class SharedCamera {
  constructor(fov = 48) {
    this.camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.3, 1500);
    this.baseFov = fov;
    this.focus = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.5;
    this.dist = 13;
    this.userYaw = 0;
    this.trauma = 0;
    this.t = 0;
    this.groundRef = 0;
    this.cine = null;
    this.fovKick = 0;
    this.sample = { heading: new THREE.Vector3(0, 0, -1), pitch: null, dist: null, yawOffset: 0, progress: 0 };
    this.lookAhead = new THREE.Vector3();
    this.initialized = false;
    this.minDist = 11;
    this.maxDist = 30;
    this.defaultPitch = 0.46;
  }

  addTrauma(v) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  // Posiciona instantaneamente (ao carregar um nível ou reaparecer).
  snap(players, route) {
    this.initialized = false;
    this.update(0.5, players, route, null, true);
  }

  setCinematic(c) {
    // c: { target: Vector3, yaw, pitch, dist, yawSpeed, duration, fov }
    this.cine = c ? { t: 0, yawSpeed: 0, ...c } : null;
  }

  update(dt, players, route, inputs, instant = false) {
    this.t += dt;
    const cam = this.camera;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);

    if (this.cine) {
      const c = this.cine;
      c.t += dt;
      const yaw = c.yaw + c.yawSpeed * c.t;
      const k = instant ? 1 : 1 - Math.exp(-3 * dt);
      _v.set(Math.sin(yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist).add(c.target);
      cam.position.lerp(_v, c.snap ? 1 : k);
      this.lookTarget.lerp(c.target, c.snap ? 1 : k);
      c.snap = false;
      cam.lookAt(this.lookTarget);
      if (c.fov) cam.fov = damp(cam.fov, c.fov, 3, dt);
      cam.updateProjectionMatrix();
      ShakeMixin.apply(cam, this.trauma, this.t);
      return;
    }

    const alive = players.filter((p) => p.alive);
    const list = alive.length ? alive : players;
    if (!list.length) return;

    // centro e espalhamento
    const center = _v.set(0, 0, 0);
    let groundedY = 0, nGrounded = 0;
    const avgVel = _v2.set(0, 0, 0);
    for (const p of list) {
      center.add(p.position);
      avgVel.add(p.velocity);
      if (p.grounded) {
        groundedY += p.position.y;
        nGrounded++;
      }
    }
    center.multiplyScalar(1 / list.length);
    avgVel.multiplyScalar(1 / list.length);
    let spread = 0;
    for (const p of list) spread = Math.max(spread, p.position.distanceTo(center));
    // alvos extras (ex.: o chefe) puxam o enquadramento de leve
    if (this.extraTargets) {
      for (const t of this.extraTargets) {
        _h.set(t.x, Math.min(t.y, center.y + 4), t.z);
        center.lerp(_h, 0.3);
        spread = Math.max(spread, _h.distanceTo(center) * 0.8);
      }
    }

    // referência vertical (não acompanha cada pulo)
    if (!this.initialized) this.groundRef = center.y;
    if (nGrounded) this.groundRef = damp(this.groundRef, groundedY / nGrounded, instant ? 50 : 3.5, dt);
    const dyP = center.y - this.groundRef;
    let focusY = this.groundRef + dyP * 0.3;
    if (dyP > 3) focusY += dyP - 3;
    if (dyP < -1.5) focusY += (dyP + 1.5) * 0.9;

    // direção da rota
    if (route) route.sample(center, this.sample);
    const head = this.sample.heading;
    const fwdVel = avgVel.x * head.x + avgVel.z * head.z;
    const sideVel = avgVel.x * -head.z + avgVel.z * head.x;
    _h.set(head.x * clamp(fwdVel * 0.28, -1.5, 3.2) + -head.z * clamp(sideVel * 0.15, -1.5, 1.5), 0, head.z * clamp(fwdVel * 0.28, -1.5, 3.2) + head.x * clamp(sideVel * 0.15, -1.5, 1.5));
    dampVec3(this.lookAhead, _h, instant ? 50 : 2.2, dt);

    const target = _h.set(center.x, focusY + 1.1, center.z).add(this.lookAhead);
    if (!this.initialized || instant) this.focus.copy(target);
    else {
      this.focus.x = damp(this.focus.x, target.x, 5, dt);
      this.focus.z = damp(this.focus.z, target.z, 5, dt);
      this.focus.y = damp(this.focus.y, target.y, 4, dt);
    }

    // controle do usuário (girar câmera)
    if (inputs) {
      let camX = 0;
      for (const d of inputs) camX += d.cam.x;
      this.userYaw = clamp(this.userYaw + clamp(camX, -1, 1) * dt * 1.6, -1.1, 1.1);
      if (Math.abs(camX) < 0.01) this.userYaw = damp(this.userYaw, 0, 0.4, dt);
    }

    const baseYaw = Math.atan2(-head.x, -head.z) + (this.sample.yawOffset || 0) + this.userYaw;
    if (!this.initialized || instant) this.yaw = baseYaw;
    else this.yaw = dampAngle(this.yaw, baseYaw, 2.2, dt);

    const wantPitch = (this.sample.pitch ?? this.defaultPitch) + clamp(spread * 0.012, 0, 0.18);
    const fovHalf = THREE.MathUtils.degToRad(cam.fov * 0.5);
    const need = spread / Math.tan(fovHalf) * 0.95 + 4;
    const wantDist = clamp(Math.max(this.sample.dist ?? this.minDist, need), this.minDist, this.maxDist);
    if (!this.initialized || instant) {
      this.pitch = wantPitch;
      this.dist = wantDist;
    } else {
      this.pitch = damp(this.pitch, wantPitch, 2, dt);
      this.dist = damp(this.dist, wantDist, wantDist > this.dist ? 3 : 1.2, dt);
    }

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    cam.position.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.dist,
      this.focus.y + sp * this.dist,
      this.focus.z + Math.cos(this.yaw) * cp * this.dist,
    );
    this.lookTarget.copy(this.focus);
    cam.lookAt(this.lookTarget);
    this.fovKick = damp(this.fovKick, 0, 4, dt);
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    ShakeMixin.apply(cam, this.trauma, this.t);
    this.initialized = true;
  }
}

export class FollowCamera {
  constructor(player, fov = 55) {
    this.player = player;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.3, 1500);
    this.yaw = player.facing + Math.PI;
    this.pitch = 0.38;
    this.dist = 8.5;
    this.curDist = 8.5;
    this.focus = new THREE.Vector3().copy(player.position);
    this.groundRef = player.position.y;
    this.trauma = 0;
    this.t = 0;
    this.idleT = 0;
  }

  addTrauma(v) {
    this.trauma = Math.min(1, this.trauma + v);
  }

  snap() {
    this.focus.copy(this.player.position);
    this.groundRef = this.player.position.y;
    this.yaw = this.player.facing + Math.PI;
    this.curDist = this.dist;
  }

  update(dt, physics, route, sample) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const p = this.player;
    const inp = p.input;
    const cam = this.camera;
    if (p.grounded || p.action === 'bubble') this.groundRef = damp(this.groundRef, p.position.y, 4, dt);
    const dy = p.position.y - this.groundRef;
    let fy = this.groundRef + dy * 0.35;
    if (dy > 2.5) fy += dy - 2.5;
    if (dy < -1.2) fy += dy + 1.2;
    this.focus.x = damp(this.focus.x, p.position.x, 9, dt);
    this.focus.z = damp(this.focus.z, p.position.z, 9, dt);
    this.focus.y = damp(this.focus.y, fy + 1.2, 6, dt);

    const camInput = inp ? inp.cam.x : 0;
    if (Math.abs(camInput) > 0.05) {
      this.yaw -= camInput * dt * 2.6;
      this.idleT = 0;
    } else {
      this.idleT += dt;
      // alinha gradualmente atrás do jogador (ou com a rota do nível)
      const hs = Math.hypot(p.velocity.x, p.velocity.z);
      if (route && sample) {
        route.sample(p.position, sample);
        const routeYaw = Math.atan2(-sample.heading.x, -sample.heading.z);
        this.yaw = dampAngle(this.yaw, routeYaw, this.idleT > 1 ? 0.8 : 0.2, dt);
      } else if (hs > 2) {
        const behind = p.facing + Math.PI;
        this.yaw = dampAngle(this.yaw, behind, 0.6, dt);
      }
    }
    if (inp) this.pitch = clamp(this.pitch - inp.cam.y * dt * 1.2, 0.12, 1.05);

    // colisão da câmera com o cenário
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = _v.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    let want = this.dist;
    const hit = physics.raycast(this.focus, dir, this.dist + 0.5, WORLD_QUERY);
    if (hit) want = Math.max(1.5, hit.toi - 0.6);
    this.curDist = want < this.curDist ? damp(this.curDist, want, 20, dt) : damp(this.curDist, want, 3, dt);
    cam.position.copy(this.focus).addScaledVector(dir, this.curDist);
    cam.lookAt(this.focus);
    ShakeMixin.apply(cam, this.trauma, this.t, 0.8);
  }
}

// Câmera de menu: órbita lenta cinematográfica.
export class OrbitCamera {
  constructor(fov = 40) {
    this.camera = new THREE.PerspectiveCamera(fov, 16 / 9, 0.3, 1500);
    this.target = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.25;
    this.dist = 20;
    this.speed = 0.05;
  }
  update(dt) {
    this.yaw += this.speed * dt;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * cp * this.dist, this.target.y + sp * this.dist, this.target.z + Math.cos(this.yaw) * cp * this.dist);
    this.camera.lookAt(this.target);
  }
}

export { wrapAngle };
