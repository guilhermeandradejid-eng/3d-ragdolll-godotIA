// Objetos de nível: lampiões (checkpoints), farol (objetivo), véus de sombra (mecânica
// cooperativa), caixas quebráveis, placas, perigos, pontes de luz e cachoeiras.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GROUP } from '../world/Physics.js';
import { shade, WU, glslNoise } from '../render/WorldShading.js';
import { clamp, damp, distXZ } from '../core/math.js';
import { PLAYER_CENTER } from './Player.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ---------------------------------------------------------------------------
// Lampião (checkpoint)
// ---------------------------------------------------------------------------
export class Checkpoint {
  constructor(world, pos, yaw = 0, mats) {
    this.world = world;
    this.pos = pos.clone();
    this.yaw = yaw;
    this.active = false;
    const g = new THREE.Group();
    const wood = mats.darkWood;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 10), wood);
    post.position.y = 1.2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), wood);
    arm.position.set(0.3, 2.3, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.25, 12), mats.stone);
    base.position.y = 0.12;
    const lantern = new THREE.Group();
    lantern.position.set(0.6, 1.9, 0);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 6), mats.brass);
    cap.position.y = 0.36;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.08, 6), mats.brass);
    bottom.position.y = -0.2;
    this.glassMat = new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#6a5a40', emissiveIntensity: 0.3, transparent: true, opacity: 0.55, roughness: 0.1 });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.42, 6), this.glassMat);
    glass.position.y = 0.05;
    this.flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#554433') });
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), this.flameMat);
    flame.scale.y = 1.6;
    flame.position.y = 0.05;
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), mats.brass);
    hook.position.y = 0.5;
    lantern.add(cap, bottom, glass, flame, hook);
    this.flame = flame;
    this.lantern = lantern;
    for (const m of [post, arm, base, cap, bottom]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.add(post, arm, base, lantern);
    g.position.copy(pos);
    g.rotation.y = yaw;
    this.light = new THREE.PointLight('#ffb35c', 0, 9, 2);
    this.light.position.set(0.6, 1.9, 0);
    g.add(this.light);
    world.scene.add(g);
    this.object = g;
    world.physics.cylinder(1.2, 0.14, _v.set(pos.x, pos.y + 1.2, pos.z), null, null, { type: 'prop' });
    this.t = 0;
    this.swing = 0;
  }

  update(dt) {
    this.t += dt;
    this.swing = damp(this.swing, 0, 2, dt);
    this.lantern.rotation.z = Math.sin(this.t * 3) * this.swing;
    if (this.active) {
      const f = 1 + Math.sin(this.t * 17) * 0.08 + Math.sin(this.t * 29) * 0.05;
      this.light.intensity = damp(this.light.intensity, 9 * f, 5, dt);
      this.flame.scale.set(1, 1.6 * f, 1);
      if (Math.random() < dt * 6) {
        this.lantern.getWorldPosition(_v);
        this.world.effects.flame(_v.add(new THREE.Vector3(0, 0.15, 0)), '#ffb347', 0.18);
      }
      return;
    }
    for (const p of this.world.players) {
      if (p.alive && distXZ(p.position, this.pos) < 2.4 && Math.abs(p.position.y - this.pos.y) < 3) {
        this.activate(p);
        break;
      }
    }
  }

  activate(player) {
    this.active = true;
    this.swing = 0.5;
    this.flameMat.color.set('#ffd27a').multiplyScalar(6);
    this.glassMat.emissive.set('#ffb35c');
    this.glassMat.emissiveIntensity = 1.8;
    this.world.onCheckpoint(this, player);
  }

  // pontos de reaparecimento ao redor do lampião
  spawnPoint(i) {
    const a = this.yaw + Math.PI + (i - 1.5) * 0.6;
    return new THREE.Vector3(this.pos.x + Math.sin(a) * 1.8, this.pos.y + 0.3, this.pos.z + Math.cos(a) * 1.8);
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// ---------------------------------------------------------------------------
// Feixe de luz volumétrico falso (cone aditivo com fresnel invertido)
// ---------------------------------------------------------------------------
export function beamMaterial(color = '#ffe2a0', intensity = 1.5) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: intensity }, uTime: WU.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uIntensity; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main() {
        float f = pow(abs(dot(normalize(vN), normalize(vV))), 2.2);
        float fade = smoothstep(0.0, 0.25, vY) * smoothstep(1.0, 0.85, vY);
        float dust = 0.85 + 0.15 * sin(vY * 40.0 - uTime * 3.0);
        gl_FragColor = vec4(uColor * f * fade * dust * uIntensity, 1.0);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------
// Farol (objetivo do nível)
// ---------------------------------------------------------------------------
export class Lighthouse {
  constructor(world, pos, yaw, mats, opts = {}) {
    this.world = world;
    this.pos = pos.clone();
    this.yaw = yaw;
    this.lit = false;
    this.t = 0;
    const g = new THREE.Group();
    const scale = opts.scale ?? 1;
    const white = shade(new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.6 }), { variation: { amount: 0.12, scale: 2 } });
    const red = shade(new THREE.MeshStandardMaterial({ color: opts.stripe ?? '#d9463b', roughness: 0.55 }), { variation: { amount: 0.12, scale: 2 } });
    const H = 10;
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const y0 = (i / bands) * H, y1 = ((i + 1) / bands) * H;
      const r0 = 2.1 - (y0 / H) * 0.75, r1 = 2.1 - (y1 / H) * 0.75;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 32, 1), i % 2 ? red : white);
      m.position.y = (y0 + y1) / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.8, 24), mats.stone);
    base.position.y = 0.2;
    base.receiveShadow = true;
    base.castShadow = true;
    g.add(base);
    // porta
    const door = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.8, 0.4, 3, 0.15), mats.darkWood);
    door.position.set(0, 1.5, 2.0);
    door.rotation.x = -0.08;
    g.add(door);
    // varanda
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.8, 0.35, 32), mats.darkMetal ?? mats.stone);
    balcony.position.y = H + 0.1;
    balcony.castShadow = true;
    g.add(balcony);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.05, 6, 40), mats.brass);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = H + 0.9;
    g.add(rail);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 5), mats.brass);
      b.position.set(Math.cos(a) * 2.0, H + 0.55, Math.sin(a) * 2.0);
      g.add(b);
    }
    // sala da lâmpada
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#dff4ff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.1, depthWrite: false });
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 1.8, 16, 1, true), glassMat);
    glass.position.y = H + 1.2;
    g.add(glass);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), mats.darkMetal ?? mats.brass);
      b.position.set(Math.cos(a) * 1.15, H + 1.2, Math.sin(a) * 1.15);
      g.add(b);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.4, 16), red);
    roof.position.y = H + 2.8;
    roof.castShadow = true;
    const spire = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), mats.brass);
    spire.position.y = H + 3.6;
    g.add(roof, spire);
    this.lampMat = new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#554a3a', emissiveIntensity: 0.5, roughness: 0.2 });
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 2), this.lampMat);
    lamp.position.y = H + 1.2;
    g.add(lamp);
    this.lampPos = new THREE.Vector3(0, H + 1.2, 0);
    // feixes giratórios (desligados até acender)
    this.beams = new THREE.Group();
    this.beams.position.y = H + 1.2;
    const beamG = new THREE.CylinderGeometry(0.4, 3.2, 26, 24, 1, true);
    beamG.translate(0, 13, 0);
    beamG.rotateZ(-Math.PI / 2);
    this.beamMat = beamMaterial('#ffe7b0', 0);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(beamG, this.beamMat);
      b.rotation.y = i * Math.PI;
      b.rotation.z = 0.08;
      b.renderOrder = 30;
      this.beams.add(b);
    }
    g.add(this.beams);
    this.light = new THREE.PointLight('#ffd89a', 0, 40, 1.5);
    this.light.position.copy(this.lampPos);
    g.add(this.light);
    g.position.copy(pos);
    g.rotation.y = yaw;
    g.scale.setScalar(scale);
    world.scene.add(g);
    this.object = g;
    // colisão: torre + base
    world.physics.cylinder(H / 2, 1.9 * scale, _v.set(pos.x, pos.y + (H / 2) * scale, pos.z), null, null, { type: 'prop', surface: 'stone' });
    world.physics.cylinder(0.4 * scale, 3.4 * scale, _v.set(pos.x, pos.y + 0.2 * scale, pos.z), null, null, { type: 'ground', surface: 'stone' });
    this.triggerR = 5.4 * scale;
  }

  update(dt) {
    this.t += dt;
    if (this.lit) {
      this.beams.rotation.y += dt * 0.9;
      this.beamMat.uniforms.uIntensity.value = damp(this.beamMat.uniforms.uIntensity.value, 1.3, 2, dt);
      this.lampMat.emissive.set('#ffd89a');
      this.lampMat.emissiveIntensity = damp(this.lampMat.emissiveIntensity, 14, 3, dt);
      this.light.intensity = damp(this.light.intensity, 60, 2, dt);
      return;
    }
    for (const p of this.world.players) {
      if (p.alive && distXZ(p.position, this.pos) < this.triggerR && p.position.y > this.pos.y - 1 && p.position.y < this.pos.y + 4) {
        this.world.onGoal(this, p);
        break;
      }
    }
  }

  light_up() {
    this.lit = true;
  }

  get lampWorld() {
    return this.object.localToWorld(this.lampPos.clone());
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// ---------------------------------------------------------------------------
// Véu de Sombra — dissolve mais rápido com mais vaga-lumes por perto
// ---------------------------------------------------------------------------
const veilVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vWP;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const veilFrag = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uCharge;
uniform vec3 uGlow;
varying vec2 vUv;
varying vec3 vWP;
${glslNoise}
void main() {
  vec2 p = vUv;
  float edgeFade = smoothstep(0.0, 0.08, p.x) * smoothstep(1.0, 0.92, p.x) * smoothstep(0.0, 0.05, p.y) * smoothstep(1.0, 0.8, p.y);
  float n = lumFbm(vec3(p * vec2(4.0, 6.0), uTime * 0.25));
  float swirl = lumFbm(vec3(p * vec2(7.0, 3.0) + n, uTime * 0.4));
  // dissolve do centro para as bordas
  float d = length((p - vec2(0.5, 0.4)) * vec2(1.0, 1.3));
  float cut = uProgress * 1.35 - d * 0.9 - (n - 0.5) * 0.5;
  if (cut > 0.0) discard;
  float edge = smoothstep(-0.12, 0.0, cut);
  vec3 col = mix(vec3(0.03, 0.01, 0.07), vec3(0.22, 0.06, 0.4), swirl);
  col += vec3(0.5, 0.2, 0.9) * pow(swirl, 3.0) * 1.5;
  col += uGlow * edge * 6.0;
  col += uGlow * uCharge * (0.4 + 0.6 * sin(uTime * 8.0 + p.y * 10.0)) * 0.25;
  float a = edgeFade * (0.82 + 0.18 * n);
  gl_FragColor = vec4(col, a);
}
`;

export class ShadowVeil {
  constructor(world, pos, yaw, width = 6, height = 5) {
    this.world = world;
    this.pos = pos.clone();
    this.progress = 0;
    this.done = false;
    this.radius = Math.max(4.5, width * 0.8);
    this.uniforms = {
      uTime: WU.uTime, uProgress: { value: 0 }, uCharge: { value: 0 }, uGlow: { value: new THREE.Color('#ffd27a') },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: veilVert, fragmentShader: veilFrag, uniforms: this.uniforms,
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
    });
    const geo = new THREE.PlaneGeometry(width, height, 1, 1);
    geo.translate(0, height / 2, 0);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = yaw;
    this.mesh.renderOrder = 5;
    world.scene.add(this.mesh);
    // círculo de luz no chão
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(1.5), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.radius - 0.15, this.radius, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos).add(new THREE.Vector3(0, 0.06, 0));
    world.scene.add(ring);
    this.ring = ring;
    this.ringMat = ringMat;
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.collider = world.physics.box(new THREE.Vector3(width / 2, height / 2, 0.4), _v.set(pos.x, pos.y + height / 2, pos.z), _q, null, { type: 'veil' });
    this.inside = 0;
  }

  update(dt) {
    if (this.done) {
      this.progress = Math.min(1.2, this.progress + dt * 0.8);
      this.uniforms.uProgress.value = this.progress;
      this.ringMat.opacity = damp(this.ringMat.opacity, 0, 3, dt);
      return;
    }
    let n = 0;
    for (const p of this.world.players) {
      if (!p.alive) continue;
      const inside = distXZ(p.position, this.pos) < this.radius && Math.abs(p.position.y - this.pos.y) < 3;
      p.glow = inside ? 1 : Math.max(0, p.glow - dt * 2);
      if (inside) n++;
    }
    this.inside = n;
    const rate = n === 0 ? -0.12 : 0.22 * n * (1 + 0.2 * (n - 1));
    this.progress = clamp(this.progress + rate * dt, 0, 1);
    this.uniforms.uProgress.value = this.progress * 0.25;
    this.uniforms.uCharge.value = damp(this.uniforms.uCharge.value, n > 0 ? 1 : 0, 4, dt);
    this.ringMat.opacity = 0.25 + 0.5 * this.uniforms.uCharge.value + Math.sin(performance.now() * 0.006) * 0.08;
    if (n > 0 && Math.random() < dt * 20 * n) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 2.5;
      this.world.effects.trail(_v.set(this.pos.x + Math.cos(a) * r, this.pos.y + 0.5 + Math.random() * 3, this.pos.z + Math.sin(a) * r), '#ffd27a', 0.3, 3);
    }
    if (this.progress >= 1) {
      this.done = true;
      this.world.physics.remove(this.collider);
      for (const p of this.world.players) p.glow = 0;
      this.world.onVeilCleared(this, n);
    }
  }

  dispose() {
    this.world.scene.remove(this.mesh, this.ring);
  }
}

// ---------------------------------------------------------------------------
// Caixa quebrável com destroços físicos
// ---------------------------------------------------------------------------
export class Crate {
  constructor(world, pos, mats, contents = 'sparks') {
    this.world = world;
    this.pos = pos.clone();
    this.broken = false;
    this.contents = contents;
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.1, 1.1, 2, 0.06), mats.wood);
    const frameG = new THREE.BoxGeometry(1.16, 0.14, 0.14);
    for (const [x, y, z, ry, rz] of [
      [0, 0.5, 0.5, 0, 0], [0, -0.5, 0.5, 0, 0], [0, 0.5, -0.5, 0, 0], [0, -0.5, -0.5, 0, 0],
      [0.5, 0.5, 0, Math.PI / 2, 0], [-0.5, 0.5, 0, Math.PI / 2, 0], [0.5, -0.5, 0, Math.PI / 2, 0], [-0.5, -0.5, 0, Math.PI / 2, 0],
      [0.5, 0, 0.5, 0, Math.PI / 2], [-0.5, 0, 0.5, 0, Math.PI / 2], [0.5, 0, -0.5, 0, Math.PI / 2], [-0.5, 0, -0.5, 0, Math.PI / 2],
    ]) {
      const f = new THREE.Mesh(frameG, mats.darkWood);
      f.position.set(x, y, z);
      f.rotation.set(0, ry, rz);
      g.add(f);
    }
    g.add(box);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.position.copy(pos).add(new THREE.Vector3(0, 0.55, 0));
    world.scene.add(g);
    this.object = g;
    this.info = { type: 'crate', crate: this, surface: 'wood' };
    this.collider = world.physics.box(new THREE.Vector3(0.55, 0.55, 0.55), _v.copy(pos).add(new THREE.Vector3(0, 0.55, 0)), null, null, this.info);
    this.mats = mats;
  }

  update() {
    if (this.broken) return;
    for (const p of this.world.players) {
      if (!p.alive) continue;
      const d = p.center.distanceTo(this.object.position);
      if ((p.action === 'spin' && d < 1.8) || (p.action === 'roll' && d < 1.4)) {
        this.break(p);
        return;
      }
    }
  }

  onShockwave(pos, radius, player) {
    if (!this.broken && pos.distanceTo(this.object.position) < radius + 0.6) this.break(player);
  }

  break(player) {
    this.broken = true;
    this.object.visible = false;
    this.world.physics.remove(this.collider);
    this.world.onCrateBroken(this, player);
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// Destroços com física real (Rapier) que somem depois de alguns segundos
export class Debris {
  constructor(world, pos, mat, count = 7, size = 0.35, impulse = 6) {
    this.world = world;
    this.pieces = [];
    this.t = 0;
    const geo = new THREE.BoxGeometry(size * 1.6, size * 0.35, size * 0.6);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      const p = _v.set(pos.x + (Math.random() - 0.5) * 0.6, pos.y + 0.4 + Math.random() * 0.6, pos.z + (Math.random() - 0.5) * 0.6);
      const body = world.physics.addDynamicBody(p, new THREE.Quaternion().random(), { linearDamping: 0.3, angularDamping: 0.3 });
      world.physics.box(new THREE.Vector3(size * 0.8, size * 0.17, size * 0.3), null, null, body, null, GROUP.DEBRIS, {
        filter: GROUP.STATIC | GROUP.PLATFORM | GROUP.DEBRIS | GROUP.PLAYER, density: 0.6, restitution: 0.3, friction: 0.6,
      });
      body.applyImpulse({ x: (Math.random() - 0.5) * impulse * 0.3, y: impulse * (0.15 + Math.random() * 0.15), z: (Math.random() - 0.5) * impulse * 0.3 }, true);
      body.applyTorqueImpulse({ x: (Math.random() - 0.5) * 0.3, y: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.3 }, true);
      world.scene.add(m);
      this.pieces.push({ m, body });
    }
    this.life = 3.2;
  }

  update(dt) {
    this.t += dt;
    for (const { m, body } of this.pieces) {
      const t = body.translation();
      const r = body.rotation();
      m.position.set(t.x, t.y, t.z);
      m.quaternion.set(r.x, r.y, r.z, r.w);
      if (this.t > this.life - 0.6) m.scale.setScalar(Math.max(0.01, (this.life - this.t) / 0.6));
    }
    return this.t < this.life;
  }

  dispose() {
    for (const { m, body } of this.pieces) {
      this.world.scene.remove(m);
      this.world.physics.removeBody(body);
    }
    this.pieces.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Placa com dica de tutorial
// ---------------------------------------------------------------------------
export class Sign {
  constructor(world, pos, yaw, text, mats) {
    this.world = world;
    this.pos = pos.clone();
    this.text = text;
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.3, 8), mats.darkWood);
    post.position.y = 0.65;
    const board = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.75, 0.1, 2, 0.04), mats.wood);
    board.position.y = 1.35;
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a').multiplyScalar(2) }));
    mark.position.set(0, 1.35, 0.07);
    g.add(post, board, mark);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    g.position.copy(pos);
    g.rotation.y = yaw;
    world.scene.add(g);
    this.object = g;
    this.shown = false;
  }

  update() {
    let near = false;
    for (const p of this.world.players) if (p.alive && p.position.distanceTo(this.pos) < 3.2) near = true;
    if (near !== this.shown) {
      this.shown = near;
      this.world.onSign(this, near);
    }
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// ---------------------------------------------------------------------------
// Pêndulo com bola de espinhos (perigo)
// ---------------------------------------------------------------------------
export class Pendulum {
  constructor(world, pivot, length = 5, amp = 1.1, speed = 1.4, phase = 0, yaw = 0, mats) {
    this.world = world;
    this.pivot = pivot.clone();
    this.length = length;
    this.amp = amp;
    this.speed = speed;
    this.t = phase;
    this.yaw = yaw;
    const g = new THREE.Group();
    g.position.copy(pivot);
    g.rotation.y = yaw;
    const arm = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, length, 8), mats.darkMetal);
    rod.position.y = -length / 2;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 2), mats.darkMetal);
    ball.position.y = -length;
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#2a2233', emissive: '#ff5a2a', emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.3 });
    const sg = new THREE.ConeGeometry(0.16, 0.5, 6);
    sg.translate(0, 0.25, 0);
    for (let i = 0; i < 14; i++) {
      const y = 1 - (i / 13) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.4;
      const dir = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
      const s = new THREE.Mesh(sg, spikeMat);
      s.position.copy(dir).multiplyScalar(0.7);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      ball.add(s);
    }
    ball.castShadow = true;
    rod.castShadow = true;
    arm.add(rod, ball);
    g.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 12), mats.brass);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    world.scene.add(g);
    this.object = g;
    this.arm = arm;
    this.ball = ball;
    this.ballPos = new THREE.Vector3();
  }

  update(dt) {
    this.t += dt;
    const a = Math.sin(this.t * this.speed) * this.amp;
    this.arm.rotation.z = a;
    this.ball.getWorldPosition(this.ballPos);
    for (const p of this.world.players) {
      if (!p.alive) continue;
      if (p.center.distanceTo(this.ballPos) < 1.35) p.hurt(this.ballPos);
    }
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

// ---------------------------------------------------------------------------
// Ponte de luz: painéis que se solidificam quando um vaga-lume se aproxima
// ---------------------------------------------------------------------------
export class LightBridge {
  constructor(world, from, to, width = 2.4, panels = 6) {
    this.world = world;
    this.panels = [];
    const dir = to.clone().sub(from);
    const len = dir.length();
    const yaw = Math.atan2(dir.x, dir.z);
    const pl = len / panels;
    const geo = new RoundedBoxGeometry(width, 0.22, pl * 0.9, 2, 0.08);
    for (let i = 0; i < panels; i++) {
      const c = from.clone().lerp(to, (i + 0.5) / panels);
      const mat = new THREE.MeshStandardMaterial({
        color: '#9ff2ff', emissive: '#41d9ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.15, roughness: 0.2, depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(c);
      m.rotation.y = yaw;
      world.scene.add(m);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const col = world.physics.box(new THREE.Vector3(width / 2, 0.11, (pl * 0.9) / 2), c, _q, null, { type: 'ground', surface: 'crystal' });
      col.setEnabled(false);
      this.panels.push({ m, mat, col, c, s: 0, on: false });
    }
  }

  update(dt) {
    for (const pn of this.panels) {
      let near = false;
      for (const p of this.world.players) {
        if (p.action === 'gone') continue;
        const d = p.position.distanceTo(pn.c);
        if (d < 5.5) near = true;
      }
      pn.s = damp(pn.s, near ? 1 : 0, near ? 8 : 1.6, dt);
      const on = pn.s > 0.45;
      if (on !== pn.on) {
        pn.on = on;
        pn.col.setEnabled(on);
        if (on) this.world.onEvent('bridgeOn', pn.c);
      }
      pn.mat.opacity = 0.12 + pn.s * 0.7;
      pn.mat.emissiveIntensity = 0.4 + pn.s * 1.8;
      pn.mat.depthWrite = pn.s > 0.8;
    }
  }

  dispose() {
    for (const pn of this.panels) this.world.scene.remove(pn.m);
  }
}

// ---------------------------------------------------------------------------
// Cachoeira (fita com shader de espuma rolando)
// ---------------------------------------------------------------------------
export function waterfallMaterial(color = '#bfe8ff') {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: WU.uTime, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWP = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uColor;
      varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
      ${glslNoise}
      void main() {
        float n = lumNoise(vec3(vUv.x * 12.0, vUv.y * 6.0 + uTime * 2.8, 0.0));
        float n2 = lumNoise(vec3(vUv.x * 30.0, vUv.y * 14.0 + uTime * 5.0, 3.0));
        float streak = smoothstep(0.45, 0.8, n * 0.7 + n2 * 0.5);
        float edge = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        float fade = smoothstep(1.0, 0.75, vUv.y) * smoothstep(0.0, 0.2, vUv.y);
        vec3 col = mix(uColor * 0.6, vec3(1.3), streak);
        gl_FragColor = vec4(col, (0.55 + streak * 0.45) * edge * fade);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
