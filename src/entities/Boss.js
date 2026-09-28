// Chefe final: Nox, a Mariposa do Eclipse.
// Máquina de estados com telegrafia clara (ref.: design de chefes de Super Mario / Astro Bot):
// paira e dispara orbes → marca o alvo no chão → mergulha → onda de choque → fica atordoado com
// o núcleo exposto (pule nele ou dê uma patada) → 3 fases, cada uma mais rápida.
import * as THREE from 'three';
import { shade, WU, glslNoise } from '../render/WorldShading.js';
import { clamp, damp, dampAngle, distXZ, lerp } from '../core/math.js';
import { PLAYER_CENTER } from './Player.js';
import { SHAPE } from '../render/Particles.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function wingMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: WU.uTime, uGlow: { value: 1 }, uHurt: { value: 0 }, uRedeem: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uGlow; uniform float uHurt; uniform float uRedeem;
      varying vec2 vUv;
      ${glslNoise}
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p * vec2(1.0, 1.25));
        float edgeN = lumNoise(vec3(atan(p.y, p.x) * 3.0, uTime * 0.3, 0.0));
        if (r > 0.95 - edgeN * 0.12) discard;
        float veins = smoothstep(0.035, 0.0, abs(sin(atan(p.y, p.x + 1.05) * 11.0)) * length(p + vec2(1.05, 0.0)) * 0.05);
        vec2 e1 = p - vec2(0.25, 0.1);
        float eye = smoothstep(0.24, 0.18, length(e1));
        float eyeRing = smoothstep(0.05, 0.0, abs(length(e1) - 0.31));
        float eyeRing2 = smoothstep(0.04, 0.0, abs(length(e1) - 0.44));
        float pupil = smoothstep(0.09, 0.05, length(e1));
        float dust = lumFbm(vec3(p * 5.0, uTime * 0.2));
        float edge = smoothstep(0.6, 0.93, r);
        vec3 dark = mix(vec3(0.06, 0.02, 0.12), vec3(0.2, 0.08, 0.35), dust);
        vec3 glowC = mix(vec3(1.0, 0.3, 0.85), vec3(1.0, 0.85, 0.5), uRedeem);
        vec3 col = dark + veins * vec3(0.35, 0.15, 0.6);
        col += glowC * (eye * 2.2 + eyeRing * 1.6 + eyeRing2 * 0.9 + edge * 1.1) * uGlow;
        col += vec3(3.0) * pupil * uGlow;
        col = mix(col, vec3(2.5), uHurt);
        col = mix(col, vec3(0.85, 0.75, 1.0) * (0.6 + dust * 0.5) + glowC * eye, uRedeem * 0.85);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.DoubleSide,
  });
}

export class NoxBoss {
  constructor(world, center) {
    this.world = world;
    this.center = center.clone();
    this.pos = new THREE.Vector3(0, -30, -26).add(center);
    this.vel = new THREE.Vector3();
    this.hp = 3;
    this.maxHp = 3;
    this.phase = 1;
    this.state = 'dormant';
    this.t = 0;
    this.stateT = 0;
    this.angle = Math.PI * 1.5;
    this.facing = 0;
    this.orbs = [];
    this.rings = [];
    this.target = null;
    this.targetPos = new THREE.Vector3();
    this.shotT = 0;
    this.flap = 0;
    this.hurtFlash = 0;
    this.defeatT = 0;
    this.buildModel();
    this.buildTelegraph();
  }

  buildModel() {
    const g = new THREE.Group();
    const bodyMat = shade(new THREE.MeshPhysicalMaterial({ color: '#241638', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#7a4ac0'), emissive: '#2a0f50', emissiveIntensity: 0.4 }), {
      rim: { color: '#c07aff', power: 2.2, strength: 1.2 },
    });
    this.bodyMat = bodyMat;
    const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 2.6, 6, 16), bodyMat);
    abdomen.rotation.x = Math.PI / 2 - 0.3;
    abdomen.position.set(0, -0.3, -1.6);
    const thorax = new THREE.Mesh(new THREE.IcosahedronGeometry(1.35, 3), bodyMat);
    thorax.scale.set(1, 0.95, 1.1);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 3), bodyMat);
    head.position.set(0, 0.35, 1.45);
    // pelagem (tufos)
    for (let i = 0; i < 14; i++) {
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), bodyMat);
      const a = (i / 14) * Math.PI * 2;
      tuft.position.set(Math.cos(a) * 1.15, Math.sin(a) * 0.9 + 0.2, 0.6);
      thorax.add(tuft);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6f6').multiplyScalar(5) });
    this.eyeMat = eyeMat;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), eyeMat);
      eye.scale.set(1, 1.2, 0.7);
      eye.position.set(sx * 0.45, 0.2, 0.72);
      head.add(eye);
      // antenas plumosas
      const pts = [new THREE.Vector3(sx * 0.3, 0.6, 0.4), new THREE.Vector3(sx * 1.0, 1.8, 0.9), new THREE.Vector3(sx * 1.9, 2.6, 0.4)];
      const ant = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05, 6), bodyMat);
      head.add(ant);
      for (let k = 1; k < 8; k++) {
        const p = new THREE.CatmullRomCurve3(pts).getPoint(k / 8);
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 5), bodyMat);
        f.position.copy(p);
        f.rotation.z = sx * 1.2;
        head.add(f);
      }
    }
    // núcleo: a Chama Primordial roubada
    this.coreMat = new THREE.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffcf5a', emissiveIntensity: 3 });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), this.coreMat);
    this.core.position.set(0, 0.1, 1.0);
    thorax.add(this.core);
    this.coreLight = new THREE.PointLight('#ffcf5a', 6, 14, 2);
    this.core.add(this.coreLight);
    // asas
    this.wingMat = wingMaterial();
    const wingG = new THREE.PlaneGeometry(7, 5, 8, 6);
    wingG.translate(3.5, 0, 0);
    wingG.rotateX(-Math.PI / 2);
    const hindG = new THREE.PlaneGeometry(4.6, 3.6, 6, 4);
    hindG.translate(2.3, 0, 0);
    hindG.rotateX(-Math.PI / 2);
    this.wings = [];
    for (const sx of [-1, 1]) {
      const front = new THREE.Group();
      const fw = new THREE.Mesh(wingG, this.wingMat);
      fw.scale.x = sx;
      fw.rotation.y = sx * 0.25;
      front.add(fw);
      front.position.set(sx * 0.6, 0.5, 0.3);
      const hind = new THREE.Group();
      const hw = new THREE.Mesh(hindG, this.wingMat);
      hw.scale.x = sx;
      hw.rotation.y = -sx * 0.45;
      hind.add(hw);
      hind.position.set(sx * 0.5, 0.2, -0.9);
      g.add(front, hind);
      this.wings.push({ front, hind, sx });
    }
    g.add(abdomen, thorax, head);
    g.traverse((o) => {
      if (o.isMesh && o.material !== this.wingMat) o.castShadow = true;
    });
    g.scale.setScalar(1.25);
    this.model = g;
    this.head = head;
    this.world.scene.add(g);
    g.visible = false;
  }

  buildTelegraph() {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff3fa0').multiplyScalar(2.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.0, 48), mat);
    ring.rotation.x = -Math.PI / 2;
    this.telegraph = ring;
    this.world.scene.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(2.4, 48), new THREE.MeshBasicMaterial({ color: '#2a0030', transparent: true, opacity: 0, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2;
    this.telegraphFill = fill;
    this.world.scene.add(fill);
    // onda de choque
    this.shockMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c07aff').multiplyScalar(3), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const shock = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 64, 1, true), this.shockMat);
    this.shock = shock;
    shock.visible = false;
    this.world.scene.add(shock);
    this.shockR = 0;
  }

  get alivePlayers() {
    return this.world.players.filter((p) => p.alive);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  awaken() {
    if (this.state !== 'dormant') return;
    this.model.visible = true;
    this.setState('intro');
    this.world.game.audio?.music('chefe');
    setTimeout(() => this.world.audio('bossRoar'), 900);
  }

  // ---------------------------------------------------------------- loop
  update(dt) {
    this.t += dt;
    this.stateT += dt;
    const w = this.world;
    const c = this.center;
    const speedK = 1 + (this.phase - 1) * 0.25;
    let flapRate = 5;
    let wingSpread = 1;

    switch (this.state) {
      case 'dormant':
        return;
      case 'intro': {
        const k = clamp(this.stateT / 3.2, 0, 1);
        _v.set(c.x, c.y + lerp(-30, 9, 1 - Math.pow(1 - k, 3)), c.z - 18);
        this.pos.lerp(_v, 1 - Math.exp(-5 * dt));
        this.facing = 0;
        flapRate = 7;
        if (this.stateT > 3.6) this.setState('hover');
        break;
      }
      case 'hover': {
        this.angle += dt * 0.45 * speedK;
        _v.set(c.x + Math.cos(this.angle) * 12, c.y + 8 + Math.sin(this.t * 1.7) * 0.8, c.z + Math.sin(this.angle) * 12);
        this.pos.lerp(_v, 1 - Math.exp(-2.5 * dt));
        this.faceTowards(c, dt);
        this.shotT -= dt;
        if (this.shotT <= 0) {
          this.shotT = (2.3 - this.phase * 0.35) + Math.random() * 0.6;
          this.shoot();
        }
        const hoverTime = 5.5 - this.phase * 0.8;
        if (this.stateT > hoverTime) {
          const r = Math.random();
          if (this.phase >= 2 && r < 0.3) this.setState('gust');
          else if (this.phase >= 2 && r < 0.55 && w.level.enemies.filter((e) => e.alive).length < 3) this.setState('summon');
          else this.startWindup();
        }
        break;
      }
      case 'gust': {
        _v.set(c.x, c.y + 6, c.z - 13);
        this.pos.lerp(_v, 1 - Math.exp(-3 * dt));
        this.faceTowards(c, dt);
        flapRate = 12;
        wingSpread = 1.2;
        if (this.stateT > 0.6 && this.stateT < 3.2) {
          for (const p of this.alivePlayers) {
            _v2.copy(p.position).sub(this.pos).setY(0).normalize();
            p.velocity.addScaledVector(_v2, 14 * dt);
          }
          if (Math.random() < dt * 40) {
            const a = (Math.random() - 0.5) * 2;
            w.effects.norm.emit({
              x: this.pos.x + a * 6, y: c.y + 0.5 + Math.random() * 3, z: this.pos.z + 2,
              vx: a * 3, vy: 0, vz: 16, life: 1.2, size: 0.3, color: [0.8, 0.7, 1], alpha: 0.6, alpha1: 0, shape: SHAPE.STREAK, stretch: 0.25,
            });
          }
          if (this.stateT - dt < 0.6 || Math.floor(this.stateT * 1.5) !== Math.floor((this.stateT - dt) * 1.5)) w.audio('bossWing');
        }
        if (this.stateT > 3.4) this.startWindup();
        break;
      }
      case 'summon': {
        this.pos.lerp(_v.set(c.x, c.y + 11, c.z - 6), 1 - Math.exp(-3 * dt));
        this.faceTowards(c, dt);
        flapRate = 9;
        if (this.stateT > 0.8 && !this.summoned) {
          this.summoned = true;
          for (const sx of [-1, 1]) {
            const pos = c.clone().add(_v.set(sx * 5, 0, -2));
            w.level.enemy('sombrinha', pos.x, pos.y, pos.z, { patrol: [[pos.x, pos.y, pos.z], [pos.x, pos.y, pos.z + 5]] });
            w.effects.burst(_v.copy(pos).add(_v2.set(0, 1, 0)), '#b07aff', 30, 6, 0.5, 3);
          }
          w.audio('poof');
        }
        if (this.stateT > 2) {
          this.summoned = false;
          this.startWindup();
        }
        break;
      }
      case 'windup': {
        const tp = this.target && this.target.alive ? this.target.position : this.targetPos;
        this.targetPos.x = damp(this.targetPos.x, tp.x, 3, dt);
        this.targetPos.z = damp(this.targetPos.z, tp.z, 3, dt);
        this.targetPos.y = c.y;
        _v.copy(this.targetPos).add(_v2.set(0, 12, 0));
        this.pos.lerp(_v, 1 - Math.exp(-3.5 * dt));
        this.faceTowards(this.targetPos, dt);
        flapRate = 10;
        const k = clamp(this.stateT / 1.3, 0, 1);
        this.telegraph.position.copy(this.targetPos).add(_v2.set(0, 0.07, 0));
        this.telegraph.material.opacity = 0.4 + 0.6 * Math.abs(Math.sin(this.t * 12));
        this.telegraph.scale.setScalar(1.6 - k * 0.6);
        this.telegraphFill.position.copy(this.telegraph.position);
        this.telegraphFill.material.opacity = 0.35 * k;
        this.telegraphFill.scale.setScalar(1.6 - k * 0.6);
        if (this.stateT > 1.3 / speedK + 0.3) {
          this.setState('dive');
          this.diveFrom = this.pos.clone();
          w.audio('swoop', this.pos);
        }
        break;
      }
      case 'dive': {
        const k = clamp(this.stateT / 0.42, 0, 1);
        this.pos.lerpVectors(this.diveFrom, _v.copy(this.targetPos).add(_v2.set(0, 1.4, 0)), k * k);
        wingSpread = 0.3;
        flapRate = 0;
        if (k >= 1) this.slam();
        break;
      }
      case 'stunned': {
        wingSpread = 0.15 + Math.sin(this.t * 3) * 0.05;
        flapRate = 1.5;
        this.pos.y = damp(this.pos.y, c.y + 1.4, 6, dt);
        this.coreMat.emissiveIntensity = 6 + Math.sin(this.t * 10) * 3;
        this.core.scale.setScalar(1.7 + Math.sin(this.t * 10) * 0.15);
        if (Math.random() < dt * 10) {
          const a = this.t * 4;
          w.effects.add.emit({ x: this.pos.x + Math.cos(a) * 2, y: this.pos.y + 3.4, z: this.pos.z + Math.sin(a) * 2, life: 0.5, size: 0.5, size1: 0.1, color: [4, 3.5, 1], alpha: 1, alpha1: 0, shape: SHAPE.SPARKLE });
        }
        this.checkStomp();
        if (this.stateT > 3.8 - this.phase * 0.4) {
          this.setState('recover');
          this.coreMat.emissiveIntensity = 3;
          this.core.scale.setScalar(1);
        }
        break;
      }
      case 'recover': {
        this.pos.lerp(_v.set(this.pos.x, c.y + 8, this.pos.z), 1 - Math.exp(-2 * dt));
        flapRate = 9;
        if (this.stateT > 1.2) this.setState('hover');
        break;
      }
      case 'hurt': {
        this.hurtFlash = Math.max(0, 1 - this.stateT * 1.5);
        this.pos.lerp(_v.set(this.pos.x * 0.8, c.y + 9, this.pos.z * 0.8), 1 - Math.exp(-2.5 * dt));
        flapRate = 14;
        this.model.rotation.z = Math.sin(this.t * 30) * 0.2 * this.hurtFlash;
        if (this.stateT > 1.6) {
          this.model.rotation.z = 0;
          if (this.hp <= 0) this.startDefeat();
          else this.setState('hover');
        }
        break;
      }
      case 'defeated':
        this.updateDefeat(dt);
        flapRate = 3;
        break;
    }

    // animação das asas
    this.flap += dt * flapRate;
    const f = Math.sin(this.flap * Math.PI) * 0.7 * (flapRate > 0 ? 1 : 0);
    for (const wg of this.wings) {
      wg.front.rotation.z = wg.sx * (f + (1 - wingSpread) * 1.1);
      wg.hind.rotation.z = wg.sx * (f * 0.7 + (1 - wingSpread) * 0.9);
    }
    this.wingMat.uniforms.uHurt.value = this.hurtFlash;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.facing;
    this.model.rotation.x = this.state === 'dive' ? 0.6 : this.state === 'stunned' ? 0.35 : damp(this.model.rotation.x, 0, 4, dt);
    if (this.state !== 'windup') {
      this.telegraph.material.opacity = damp(this.telegraph.material.opacity, 0, 8, dt);
      this.telegraphFill.material.opacity = damp(this.telegraphFill.material.opacity, 0, 8, dt);
    }

    // contato corporal
    if (this.state !== 'stunned' && this.state !== 'defeated' && this.state !== 'intro' && this.state !== 'hurt') {
      for (const p of this.alivePlayers) {
        _v.set(p.position.x, p.position.y + PLAYER_CENTER, p.position.z);
        if (_v.distanceTo(this.pos) < 2.6) p.hurt(this.pos);
      }
    }
    this.updateOrbs(dt);
    this.updateShock(dt);
  }

  faceTowards(p, dt) {
    const a = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    this.facing = dampAngle(this.facing, a, 4, dt);
  }

  startWindup() {
    const list = this.alivePlayers;
    this.target = list.length ? list[Math.floor(Math.random() * list.length)] : null;
    if (this.target) this.targetPos.copy(this.target.position);
    else this.targetPos.copy(this.center);
    this.targetPos.y = this.center.y;
    // mantém o alvo dentro da arena
    _v.copy(this.targetPos).sub(this.center).setY(0);
    if (_v.length() > 12) this.targetPos.copy(this.center).add(_v.setLength(12));
    this.setState('windup');
    this.world.audio('bossRoar', null, { volume: 0.5 });
  }

  slam() {
    const w = this.world;
    this.setState('stunned');
    this.shockR = 0.5;
    this.shock.visible = true;
    this.shock.position.copy(this.targetPos).add(_v.set(0, 0.45, 0));
    this.shockHit = new Set();
    w.audio('bossSlam');
    w.shake(0.75);
    for (const p of w.players) w.rumble(p, 1, 0.8, 350);
    w.effects.dust(this.targetPos, 30, '#c9b8e0', 8, 1.2);
    w.effects.groundRing(this.targetPos, '#c07aff', 6, 0.6, 3);
    w.game.ui?.toast('Nox está atordoado! Pulem no núcleo brilhante!', 'good');
  }

  updateShock(dt) {
    if (!this.shock.visible) return;
    this.shockR += dt * 13;
    const k = this.shockR / 16;
    this.shock.scale.set(this.shockR, 1, this.shockR);
    this.shockMat.opacity = Math.max(0, 1 - k);
    for (const p of this.alivePlayers) {
      if (this.shockHit.has(p)) continue;
      const d = distXZ(p.position, this.shock.position);
      const low = p.position.y - this.center.y < 0.9;
      if (Math.abs(d - this.shockR) < 0.8 && low) {
        this.shockHit.add(p);
        p.hurt(this.shock.position);
      }
    }
    if (k >= 1) this.shock.visible = false;
  }

  shoot() {
    const w = this.world;
    const list = this.alivePlayers;
    if (!list.length) return;
    const n = this.phase >= 3 ? 3 : this.phase >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const target = list[(Math.floor(Math.random() * list.length) + i) % list.length];
      const m = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.42, 2),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5ac8').multiplyScalar(4) }),
      );
      const start = this.pos.clone().add(_v.set((i - (n - 1) / 2) * 1.5, -0.5, 0));
      m.position.copy(start);
      w.scene.add(m);
      const vel = target.position.clone().add(_v2.set(0, 0.8, 0)).sub(start).normalize().multiplyScalar(5 + this.phase);
      this.orbs.push({ m, vel, target, life: 6 });
    }
    w.audio('bossOrb', this.pos);
  }

  updateOrbs(dt) {
    const w = this.world;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      if (o.target && o.target.alive) {
        _v.copy(o.target.position).add(_v2.set(0, PLAYER_CENTER, 0)).sub(o.m.position).normalize().multiplyScalar(5.5 + this.phase);
        o.vel.lerp(_v, 1 - Math.exp(-0.9 * dt));
      }
      o.m.position.addScaledVector(o.vel, dt);
      o.m.rotation.x += dt * 5;
      if (Math.random() < dt * 30) w.effects.trail(o.m.position, '#ff5ac8', 0.35, 2.5);
      let dead = o.life <= 0 || o.m.position.y < this.center.y + 0.2;
      for (const p of this.alivePlayers) {
        _v.set(p.position.x, p.position.y + PLAYER_CENTER, p.position.z);
        const d = _v.distanceTo(o.m.position);
        if (p.action === 'spin' && d < 1.9) {
          dead = true;
          w.effects.sparkle(o.m.position, '#ffe38a', 14, 5, 0.35, 4);
          w.audio('enemyHit', o.m.position);
          break;
        }
        if (d < 0.95) {
          p.hurt(o.m.position);
          dead = true;
          break;
        }
      }
      if (dead) {
        w.effects.sparkle(o.m.position, '#ff5ac8', 10, 4, 0.3, 3);
        w.scene.remove(o.m);
        o.m.geometry.dispose();
        o.m.material.dispose();
        this.orbs.splice(i, 1);
      }
    }
  }

  checkStomp() {
    for (const p of this.alivePlayers) {
      const hd = distXZ(p.position, this.pos);
      if (p.velocity.y < 0 && hd < 3.2 && p.position.y > this.pos.y + 0.6 && p.position.y < this.pos.y + 4) {
        p.bounce(17);
        this.takeHit(p);
        return;
      }
    }
  }

  onShockwave(pos, r, player) {
    if (this.state === 'stunned' && distXZ(pos, this.pos) < r + 3) this.takeHit(player);
  }

  takeHit(player) {
    if (this.state !== 'stunned') return;
    const w = this.world;
    this.hp--;
    this.phase = Math.min(3, this.maxHp - this.hp + 1);
    this.setState('hurt');
    this.hurtFlash = 1;
    this.coreMat.emissiveIntensity = 3;
    this.core.scale.setScalar(1);
    w.audio('bossHit');
    w.shake(0.6);
    w.hitStop = 0.12;
    w.flash = 0.5;
    w.effects.burst(this.pos, '#ffe38a', 60, 12, 0.7, 6);
    player.stats_.stomps += 5;
    w.level.heart(this.center.x + (Math.random() - 0.5) * 8, this.center.y + 1.2, this.center.z + 4 + Math.random() * 3);
    w.game.ui?.banner(this.hp > 0 ? `Nox: ${this.hp} de ${this.maxHp}` : 'A Chama está livre!', this.hp > 0 ? 'Continuem assim!' : '', '#ffd27a');
    if (this.hp > 0) setTimeout(() => w.audio('bossRoar'), 500);
  }

  // ---------------------------------------------------------------- derrota e redenção
  startDefeat() {
    const w = this.world;
    this.setState('defeated');
    this.defeatT = 0;
    for (const o of this.orbs) w.scene.remove(o.m);
    this.orbs.length = 0;
    for (const e of w.level.enemies) if (e.alive && !e.dying) e.defeat(w.players[0] || { position: e.pos, stats_: { stomps: 0 } }, 'pound');
    w.audio('bossDefeat');
    w.shake(0.8);
    w.shared.setCinematic({ target: this.center.clone().add(_v.set(0, 5, 0)), yaw: w.shared.yaw, pitch: 0.2, dist: 28, yawSpeed: 0.12, fov: 50 });
    for (const p of w.players) {
      p.frozen = true;
      if (p.action === 'bubble') p.popBubble(p);
    }
    this.flameFrom = new THREE.Vector3();
    this.core.getWorldPosition(this.flameFrom);
    this.flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff1b0').multiplyScalar(8) }));
    this.flame.position.copy(this.flameFrom);
    w.scene.add(this.flame);
    this.core.visible = false;
  }

  updateDefeat(dt) {
    const w = this.world;
    this.defeatT += dt;
    const t = this.defeatT;
    // Nox encolhe e vira uma mariposinha
    const s = lerp(1.25, 0.18, clamp((t - 0.6) / 2.4, 0, 1));
    this.model.scale.setScalar(s);
    this.wingMat.uniforms.uRedeem.value = clamp((t - 0.5) / 2, 0, 1);
    this.bodyMat.color.lerp(new THREE.Color('#d9c4ff'), dt * 0.8);
    this.eyeMat.color.lerp(new THREE.Color('#6a3aa8'), dt);
    this.pos.lerp(_v.set(this.center.x + 3, this.center.y + 2.2 + Math.sin(t * 3) * 0.3, this.center.z + 3), 1 - Math.exp(-1.5 * dt));
    // a Chama volta ao braseiro central
    if (this.flame) {
      const k = clamp((t - 0.8) / 2.2, 0, 1);
      const target = this.world.brazierPos || this.center.clone().add(_v2.set(0, 3, 0));
      _v.lerpVectors(this.flameFrom, target, k);
      _v.y += Math.sin(k * Math.PI) * 6;
      this.flame.position.copy(_v);
      this.flame.scale.setScalar(1 + k * 1.5);
      if (Math.random() < dt * 40) w.effects.flame(this.flame.position, '#ffcf5a', 0.8);
      if (k >= 1 && !this.relit) {
        this.relit = true;
        w.scene.remove(this.flame);
        w.onFlameReturned?.();
      }
    }
    if (t > 9 && !this.finished) {
      this.finished = true;
      w.onBossDefeated?.();
    }
  }

  dispose() {
    const w = this.world;
    w.scene.remove(this.model, this.telegraph, this.telegraphFill, this.shock);
    for (const o of this.orbs) w.scene.remove(o.m);
    if (this.flame) w.scene.remove(this.flame);
  }
}
