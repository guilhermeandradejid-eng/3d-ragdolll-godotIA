// Personagens jogáveis — modelados proceduralmente a partir de primitivas e animados
// por código (ciclo de corrida, squash & stretch, cambalhotas, piscadas, movimento secundário).
//
// Direção de arte: brinquedos de vinil/plástico com clearcoat (ref.: Astro Bot, Sackboy),
// silhuetas bem distintas (ref.: guia de silhuetas de Team Fortress 2 / Overwatch).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shade } from '../render/WorldShading.js';
import { Spring, clamp, lerp, createNoise, damp } from '../core/math.js';

export const CHARACTERS = [
  {
    id: 'lampi',
    name: 'Lampi',
    title: 'O Lampião Corajoso',
    color: '#ff8a2a',
    glow: '#ffb35c',
    ability: 'Equilibrado. Cambalhota de fogo no pulo duplo.',
    quote: 'Bora brilhar!',
    stats: { speed: 7.6, accel: 62, decel: 58, jumpHeight: 2.75, doubleJump: 2.0, weight: 1, traction: 1, float: false, poundRadius: 2.4 },
  },
  {
    id: 'nuvi',
    name: 'Nuvi',
    title: 'A Nuvem Sonhadora',
    color: '#6ab7ff',
    glow: '#a9d6ff',
    ability: 'Segure o pulo no ar para planar com o guarda-chuva.',
    quote: 'Eu estava sonhando com estrelas…',
    stats: { speed: 7.1, accel: 55, decel: 52, jumpHeight: 2.7, doubleJump: 1.9, weight: 0.8, traction: 1, float: true, poundRadius: 2.2 },
  },
  {
    id: 'musgo',
    name: 'Musgo',
    title: 'O Gigante Gentil',
    color: '#63c24a',
    glow: '#b6ff8a',
    ability: 'Pesado: patada no chão com onda de choque maior.',
    quote: 'Hm. Juntos.',
    stats: { speed: 7.0, accel: 48, decel: 60, jumpHeight: 2.55, doubleJump: 1.8, weight: 1.6, traction: 1, float: false, poundRadius: 3.4 },
  },
  {
    id: 'zuca',
    name: 'Zuca',
    title: 'A Inventora de Corda',
    color: '#ff4fa3',
    glow: '#ff9ad0',
    ability: 'A mais rápida — mas escorrega nas curvas.',
    quote: 'Calculando… 97% de chance de dar certo!',
    stats: { speed: 8.6, accel: 58, decel: 26, jumpHeight: 2.7, doubleJump: 1.95, weight: 0.9, traction: 0.55, float: false, poundRadius: 2.2 },
  },
];

export const charById = (id) => CHARACTERS.find((c) => c.id === id);

// ------------------------------------------------------------------
// Materiais e helpers de geometria
// ------------------------------------------------------------------
const noise = createNoise(77);

function toy(color, extra = {}, opts = {}) {
  return shade(
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.18,
      ...extra,
    }),
    { rim: { color: extra.rimColor ?? 0xffffff, power: 3.2, strength: 0.28 }, ...opts },
  );
}

function matte(color, extra = {}) {
  return shade(new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }), {
    rim: { color: 0xffffff, power: 3, strength: 0.18 },
  });
}

function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function capsule(r, len, mat, seg = 10) {
  const g = new THREE.CapsuleGeometry(r, len, 4, seg);
  g.translate(0, -len / 2 - r * 0.2, 0);
  return mesh(g, mat);
}

function sphere(r, mat, ws = 24, hs = 18) {
  return mesh(new THREE.SphereGeometry(r, ws, hs), mat);
}

const eyeWhite = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.08 });
const eyeDark = () => new THREE.MeshStandardMaterial({ color: 0x160f24, roughness: 0.2, metalness: 0 });
const eyeGlint = () => new THREE.MeshBasicMaterial({ color: 0xffffff });

function makeEye(size, irisColor) {
  const g = new THREE.Group();
  const white = mesh(new THREE.SphereGeometry(size, 20, 16), eyeWhite(), false);
  white.scale.set(1, 1.28, 0.45);
  const irisMat = new THREE.MeshStandardMaterial({ color: irisColor, roughness: 0.3, emissive: irisColor, emissiveIntensity: 0.15 });
  const iris = mesh(new THREE.SphereGeometry(size * 0.66, 18, 14), irisMat, false);
  iris.scale.set(1, 1.22, 0.35);
  iris.position.set(0, -size * 0.06, size * 0.3);
  const pupil = mesh(new THREE.SphereGeometry(size * 0.4, 14, 10), eyeDark(), false);
  pupil.scale.set(1, 1.2, 0.35);
  pupil.position.set(0, -size * 0.08, size * 0.4);
  const glint = mesh(new THREE.SphereGeometry(size * 0.19, 10, 8), eyeGlint(), false);
  glint.position.set(size * 0.28, size * 0.32, size * 0.5);
  const glint2 = mesh(new THREE.SphereGeometry(size * 0.08, 8, 6), eyeGlint(), false);
  glint2.position.set(-size * 0.22, -size * 0.3, size * 0.5);
  const look = new THREE.Group();
  look.add(iris, pupil, glint, glint2);
  g.add(white, look);
  g.userData.look = look;
  g.userData.size = size;
  return g;
}

// Posiciona um objeto na superfície de uma esfera (centro c, raio r) na direção dir.
function onSphere(obj, c, r, dir, push = 0) {
  const d = dir.clone().normalize();
  obj.position.copy(c).addScaledVector(d, r + push);
  obj.lookAt(obj.position.clone().add(d));
  return obj;
}

function blush(r, color = 0xff7a9a) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  m.renderOrder = 2;
  return m;
}

// Geometria de lanterna de papel com gomos
function lanternGeometry(radius, height, ribs = 14) {
  const pts = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 + t * Math.PI;
    const r = Math.cos(a) * radius;
    pts.push(new THREE.Vector2(Math.max(0.001, r * (0.82 + 0.18 * Math.cos(a))), Math.sin(a) * height * 0.5));
  }
  const g = new THREE.LatheGeometry(pts, 56);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ang = Math.atan2(v.z, v.x);
    const k = 1 + 0.045 * Math.pow(Math.abs(Math.cos(ang * ribs * 0.5)), 0.6) - 0.03;
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

function puffCloud(radius, puffs, seed = 3) {
  const geos = [new THREE.SphereGeometry(radius, 28, 20)];
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * Math.PI * 2 + seed;
    const y = (i % 2 === 0 ? 0.25 : -0.12) * radius;
    const r = radius * (0.48 + ((i * 37) % 10) / 45);
    const g = new THREE.SphereGeometry(r, 20, 14);
    g.translate(Math.cos(a) * radius * 0.78, y, Math.sin(a) * radius * 0.72);
    geos.push(g);
  }
  const top = new THREE.SphereGeometry(radius * 0.55, 20, 14);
  top.translate(radius * 0.1, radius * 0.72, -radius * 0.05);
  geos.push(top);
  const merged = mergeGeometries(geos.map((g) => g.toNonIndexed()));
  // normais "fofas": apontam para fora a partir do centro (visual de nuvem macia)
  const p = merged.getAttribute('position');
  const nrm = merged.getAttribute('normal');
  const v = new THREE.Vector3();
  const n0 = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    n0.fromBufferAttribute(nrm, i);
    n0.lerp(v, 0.55).normalize();
    nrm.setXYZ(i, n0.x, n0.y, n0.z);
  }
  return merged;
}

function rockGeometry(radius, detail, amp, seed, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = noise.noise3(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2);
    v.multiplyScalar(1 + n * amp);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

function flameGeometry() {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const r = Math.sin(t * Math.PI) * (1 - t * 0.55) * 0.5;
    pts.push(new THREE.Vector2(Math.max(0.001, r), t * 1.6 - 0.4));
  }
  return new THREE.LatheGeometry(pts, 16);
}

// ------------------------------------------------------------------
// Rig base
// ------------------------------------------------------------------
export class CharacterRig {
  constructor(def) {
    this.def = def;
    this.root = new THREE.Group();
    this.visual = new THREE.Group(); // squash/stretch/cambalhotas (pivô no centro do corpo)
    this.pivot = new THREE.Group();
    this.hips = new THREE.Group();
    this.body = new THREE.Group();
    this.head = new THREE.Group();
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.root.add(this.visual);
    this.visual.add(this.pivot);
    this.pivot.add(this.hips);
    this.hips.add(this.body, this.legL, this.legR);
    this.body.add(this.head, this.armL, this.armR);
    this.eyes = [];
    this.materials = [];
    this.center = 0.7; // altura do centro de massa (pivô das cambalhotas)
    this.phase = 0;
    this.t = Math.random() * 10;
    this.squash = new Spring(1, 260, 14);
    this.blinkT = 2 + Math.random() * 3;
    this.blink = 0;
    this.secondary = [];
    this.flip = 0; // ângulo de cambalhota
    this.spinAngle = 0;
    this.curl = 0;
    this.runW = 0;
    this.airW = 0;
    this.lean = 0;
    this.bank = 0;
    this.flash = 0;
    this.emotion = 'normal';
    this.lookX = 0;
  }

  setCenter(c) {
    this.center = c;
    this.visual.position.y = c;
    this.pivot.position.y = -c;
  }

  collectMaterials() {
    this.root.traverse((o) => {
      if (o.isMesh && o.material && !this.materials.includes(o.material) && o.material.emissive) {
        o.material.userData.baseEmissive = o.material.emissive.clone();
        o.material.userData.baseEmissiveIntensity = o.material.emissiveIntensity;
        this.materials.push(o.material);
      }
    });
  }

  addSecondary(obj, axis = 'x', stiffness = 120, damping = 7, amount = 1) {
    const s = { obj, axis, spring: new Spring(0, stiffness, damping), amount, base: obj.rotation[axis] };
    this.secondary.push(s);
    return s;
  }

  impulse(v) {
    this.squash.impulse(v);
  }

  /**
   * s: { speed, maxSpeed, grounded, vy, action, actionT, dt, turn, celebrate }
   */
  update(dt, s) {
    this.t += dt;
    const t = this.t;
    const grounded = s.grounded;
    const speedN = clamp(s.speed / Math.max(1, s.maxSpeed), 0, 1.3);
    this.runW = damp(this.runW, grounded ? speedN : 0, 12, dt);
    this.airW = damp(this.airW, grounded ? 0 : 1, 14, dt);
    this.phase += dt * (4 + s.speed * 1.55);

    // squash & stretch
    const sq = this.squash.update(dt);
    let stretchY = sq;
    if (!grounded) stretchY *= 1 + clamp(Math.abs(s.vy) * 0.012, 0, 0.12);
    const xz = 1 / Math.sqrt(Math.max(0.4, stretchY));
    this.visual.scale.set(xz, stretchY, xz);

    // piscar
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.14;
      this.blinkT = 1.8 + Math.random() * 3.5;
    }
    if (this.blink > 0) this.blink -= dt;
    const eyeOpen = s.action === 'hurt' ? 0.25 : this.blink > 0 ? 0.12 : s.action === 'bubble' ? 0.35 : 1;
    for (const e of this.eyes) e.scale.y = damp(e.scale.y, eyeOpen, 30, dt);

    const act = s.action;
    const sw = Math.sin(this.phase);
    const cw = Math.cos(this.phase);
    const run = this.runW;
    const air = this.airW;

    // curl (encolhe em bola na patada/rolamento/bolha)
    const curlTarget = act === 'poundStart' || act === 'poundFall' || act === 'roll' || act === 'bubble' ? 1 : 0;
    this.curl = damp(this.curl, curlTarget, 18, dt);
    const curl = this.curl;

    // pernas
    const rising = s.vy > 0;
    const legAir = rising ? -0.55 : 0.35 + Math.sin(t * 18) * 0.15;
    this.legL.rotation.x = lerp(sw * 0.95 * run + legAir * air * 0.8, -1.3, curl);
    this.legR.rotation.x = lerp(-sw * 0.95 * run + (rising ? 0.35 : -0.2) * air, -1.3, curl);
    this.legL.rotation.z = 0.05 + air * 0.12;
    this.legR.rotation.z = -0.05 - air * 0.12;

    // braços
    const idleSway = Math.sin(t * 2.2) * 0.06 * (1 - run);
    let armX = -sw * 0.9 * run;
    let armZ = 0.18 + idleSway + air * (rising ? 1.9 : 1.1 + Math.sin(t * 22) * 0.25);
    if (act === 'spin') armZ = 1.45;
    if (s.celebrate) {
      armZ = 2.3 + Math.sin(t * 12) * 0.35;
      armX = 0;
    }
    this.armL.rotation.x = lerp(armX, -1.9, curl);
    this.armR.rotation.x = lerp(-armX, -1.9, curl);
    this.armL.rotation.z = lerp(armZ, 0.5, curl);
    this.armR.rotation.z = lerp(-armZ, -0.5, curl);

    // corpo: balanço, inclinação e bank nas curvas
    const bob = Math.abs(cw) * 0.07 * run + Math.sin(t * 2.4) * 0.012 * (1 - run);
    this.hips.position.y = this.hipBase + bob - curl * 0.12;
    this.lean = damp(this.lean, 0.2 * run + (act === 'roll' ? 0.4 : 0) - (act === 'hurt' ? 0.5 : 0), 10, dt);
    this.body.rotation.x = this.lean;
    this.body.rotation.y = sw * 0.12 * run;
    this.bank = damp(this.bank, clamp(-s.turn * 0.12, -0.35, 0.35) * run, 8, dt);
    this.pivot.rotation.z = this.bank;
    this.head.rotation.x = -this.lean * 0.5 + Math.sin(t * 2.4 + 1) * 0.02;
    this.head.rotation.z = Math.sin(t * 1.3) * 0.03 * (1 - run);

    // cambalhota / giro
    if (act === 'doubleJump' || act === 'poundStart') {
      const dur = act === 'poundStart' ? 0.2 : 0.42;
      this.flip = -Math.PI * 2 * clamp(s.actionT / dur, 0, 1);
    } else if (act === 'roll') {
      this.flip -= dt * s.speed * 2.2;
    } else {
      this.flip = damp(this.flip, Math.round(this.flip / (Math.PI * 2)) * Math.PI * 2, 20, dt);
    }
    this.visual.rotation.x = this.flip;
    if (act === 'spin') this.spinAngle += dt * 26;
    else this.spinAngle = damp(this.spinAngle, Math.round(this.spinAngle / (Math.PI * 2)) * Math.PI * 2, 18, dt);
    this.visual.rotation.y = this.spinAngle;
    if (act === 'bubble') this.visual.rotation.z = Math.sin(t * 1.5) * 0.4;
    else this.visual.rotation.z = damp(this.visual.rotation.z, 0, 10, dt);

    // olhar
    for (const e of this.eyes) {
      const look = e.userData.look;
      look.position.x = damp(look.position.x, clamp(-s.turn * 0.02, -0.02, 0.02), 8, dt);
    }

    // movimento secundário (molas)
    const accelKick = (s.vy - (this._lastVy ?? s.vy)) * 0.01 + (s.speed - (this._lastSpeed ?? s.speed)) * 0.02;
    this._lastVy = s.vy;
    this._lastSpeed = s.speed;
    for (const sc of this.secondary) {
      sc.spring.impulse(-accelKick * 6 * sc.amount);
      sc.spring.target = -run * 0.25 * sc.amount;
      sc.obj.rotation[sc.axis] = sc.base + sc.spring.update(dt);
    }

    // flash de dano
    if (this.flash > 0) {
      this.flash -= dt;
      const k = Math.max(0, this.flash) * 6;
      for (const m of this.materials) {
        m.emissive.copy(m.userData.baseEmissive).lerp(new THREE.Color(1, 1, 1), Math.min(1, k));
        m.emissiveIntensity = m.userData.baseEmissiveIntensity + k * 1.5;
      }
      if (this.flash <= 0) this.resetFlash();
    }

    this.onUpdate?.(dt, s);
  }

  hurtFlash() {
    this.flash = 0.18;
  }

  resetFlash() {
    for (const m of this.materials) {
      m.emissive.copy(m.userData.baseEmissive);
      m.emissiveIntensity = m.userData.baseEmissiveIntensity;
    }
  }
}

// ------------------------------------------------------------------
// LAMPI — lanterna de papel viva, com tampa de latão e chaminha
// ------------------------------------------------------------------
function buildLampi(def) {
  const rig = new CharacterRig(def);
  rig.hipBase = 0.3;
  rig.setCenter(0.72);
  const orange = toy('#ff8a2a', { emissive: '#ff5a00', emissiveIntensity: 0.22, roughness: 0.5, clearcoat: 0.4, sheen: 0.6, sheenColor: new THREE.Color('#ffd0a0') });
  const brass = toy('#d9a441', { metalness: 0.85, roughness: 0.3, clearcoat: 0.6 });
  const brown = toy('#6a3b22', { roughness: 0.6, clearcoat: 0.3 });
  const red = toy('#e0412f', { roughness: 0.55 });

  const bodyY = 0.43;
  const bodyG = lanternGeometry(0.5, 0.92, 14);
  const bodyM = mesh(bodyG, orange);
  bodyM.position.y = bodyY;
  rig.body.add(bodyM);
  // faixa luminosa na barriga (a "luz" do vaga-lume)
  const bellyMat = new THREE.MeshStandardMaterial({ color: '#ffe3a0', emissive: '#ffb347', emissiveIntensity: 1.6, roughness: 0.6 });
  const belly = mesh(new THREE.SphereGeometry(0.22, 20, 16), bellyMat, false);
  belly.scale.set(1, 0.85, 0.35);
  onSphere(belly, new THREE.Vector3(0, bodyY - 0.08, 0), 0.43, new THREE.Vector3(0, -0.25, 1), -0.02);
  rig.body.add(belly);
  rig.belly = bellyMat;

  const capTop = mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.12, 28), brass);
  capTop.position.y = bodyY + 0.49;
  const capRim = mesh(new THREE.TorusGeometry(0.29, 0.035, 10, 32), brass);
  capRim.rotation.x = Math.PI / 2;
  capRim.position.y = bodyY + 0.43;
  const capBot = mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.1, 28), brass);
  capBot.position.y = bodyY - 0.47;
  rig.body.add(capTop, capRim, capBot);

  // alça + chama (cabeça = parte de cima da lanterna)
  rig.head.position.y = bodyY + 0.55;
  const handle = mesh(new THREE.TorusGeometry(0.15, 0.03, 10, 24, Math.PI * 1.25), brass);
  handle.rotation.z = -Math.PI * 0.125;
  handle.position.y = 0.06;
  rig.head.add(handle);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc861').multiplyScalar(5) });
  const flame = new THREE.Mesh(flameGeometry(), flameMat);
  flame.scale.setScalar(0.16);
  flame.position.y = 0.3;
  const flameCore = new THREE.Mesh(flameGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff4c8').multiplyScalar(8) }));
  flameCore.scale.setScalar(0.09);
  flameCore.position.y = 0.29;
  rig.head.add(flame, flameCore);
  rig.flame = flame;
  rig.flameCore = flameCore;

  // rosto
  const faceC = new THREE.Vector3(0, bodyY + 0.02, 0);
  for (const sx of [-1, 1]) {
    const eye = makeEye(0.1, '#5a2a10');
    onSphere(eye, faceC, 0.43, new THREE.Vector3(sx * 0.33, 0.28, 1), 0.0);
    rig.body.add(eye);
    rig.eyes.push(eye);
    const b = blush(0.065);
    onSphere(b, faceC, 0.455, new THREE.Vector3(sx * 0.62, 0.02, 1), 0.012);
    rig.body.add(b);
  }
  // cachecol
  const scarf = mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 28), red);
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = bodyY - 0.3;
  scarf.scale.set(1, 1, 0.8);
  rig.body.add(scarf);
  const tail = capsule(0.055, 0.22, red);
  tail.position.set(0.18, bodyY - 0.3, -0.26);
  tail.rotation.set(0.9, 0, 0.4);
  rig.body.add(tail);
  rig.addSecondary(tail, 'x', 90, 6, 1.4);

  // braços e pernas
  for (const [arm, sx] of [[rig.armL, 1], [rig.armR, -1]]) {
    arm.position.set(sx * 0.42, bodyY + 0.02, 0);
    const a = capsule(0.07, 0.2, brown);
    const hand = sphere(0.1, orange);
    hand.position.y = -0.36;
    arm.add(a, hand);
  }
  for (const [leg, sx] of [[rig.legL, 1], [rig.legR, -1]]) {
    leg.position.set(sx * 0.17, 0.02, 0);
    const l = capsule(0.075, 0.1, brown);
    const boot = mesh(new RoundedBoxGeometry(0.2, 0.14, 0.28, 3, 0.06), brown);
    boot.position.set(0, -0.26, 0.04);
    leg.add(l, boot);
  }
  rig.body.position.y = 0;

  rig.onUpdate = (dt, s) => {
    const f = 1 + Math.sin(rig.t * 23) * 0.08 + Math.sin(rig.t * 37) * 0.05;
    flame.scale.set(0.16 * (2 - f), 0.16 * f * (s.action === 'doubleJump' ? 1.6 : 1), 0.16 * (2 - f));
    flameCore.scale.set(0.09, 0.09 * f, 0.09);
    flame.rotation.z = Math.sin(rig.t * 3) * 0.1 - rig.lean * 0.5;
    bellyMat.emissiveIntensity = 1.4 + Math.sin(rig.t * 4) * 0.25;
  };
  rig.fxColor = '#ffb347';
  return rig;
}

// ------------------------------------------------------------------
// NUVI — nuvem fofa com guarda-chuva e galochas amarelas
// ------------------------------------------------------------------
function buildNuvi(def) {
  const rig = new CharacterRig(def);
  rig.hipBase = 0.28;
  rig.setCenter(0.72);
  const cloud = toy('#f4f9ff', {
    roughness: 0.85, clearcoat: 0.05, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#a8d4ff'),
    emissive: '#cfe6ff', emissiveIntensity: 0.12,
  });
  const blue = toy('#6ab7ff', { roughness: 0.3 });
  const yellow = toy('#ffcf3a', { roughness: 0.35 });
  const lav = toy('#b48cff', { roughness: 0.45, side: THREE.DoubleSide });
  const dark = toy('#3a2f5a', { roughness: 0.4 });

  const bodyY = 0.44;
  const body = mesh(puffCloud(0.42, 7, 1.3), cloud);
  body.position.y = bodyY;
  rig.body.add(body);
  // gotinha de chuva no topo
  const dropG = new THREE.SphereGeometry(0.1, 18, 14);
  const dp = dropG.getAttribute('position');
  for (let i = 0; i < dp.count; i++) {
    const y = dp.getY(i);
    if (y > 0) {
      const k = 1 - y / 0.1;
      dp.setX(i, dp.getX(i) * k);
      dp.setZ(i, dp.getZ(i) * k);
      dp.setY(i, y * 2.4);
    }
  }
  dropG.computeVertexNormals();
  const drop = mesh(dropG, blue);
  drop.position.set(-0.05, bodyY + 0.62, 0.02);
  rig.head.position.y = 0;
  rig.head.add(drop);
  rig.addSecondary(drop, 'z', 100, 5, 1.2);

  const faceC = new THREE.Vector3(0, bodyY, 0);
  for (const sx of [-1, 1]) {
    const eye = makeEye(0.095, '#2b5fb8');
    onSphere(eye, faceC, 0.43, new THREE.Vector3(sx * 0.32, 0.22, 1), 0.02);
    rig.body.add(eye);
    rig.eyes.push(eye);
    // pálpebra sonolenta
    const lid = mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), cloud, false);
    lid.scale.set(1.05, 1.25, 0.55);
    eye.add(lid);
    const b = blush(0.06, 0xff8fb8);
    onSphere(b, faceC, 0.47, new THREE.Vector3(sx * 0.6, -0.02, 1), 0.02);
    rig.body.add(b);
  }

  // guarda-chuva (braço direito)
  const umbrella = new THREE.Group();
  const shaft = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.95, 8), dark);
  shaft.position.y = 0.45;
  const canopyG = new THREE.ConeGeometry(0.62, 0.32, 8, 1, true);
  const cp = canopyG.getAttribute('position');
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i), y = cp.getY(i);
    const a = Math.atan2(z, x);
    if (y < 0) cp.setY(i, y + Math.abs(Math.sin(a * 4)) * 0.06);
  }
  canopyG.computeVertexNormals();
  const canopy = mesh(canopyG, lav);
  canopy.position.y = 0.95;
  const tip = sphere(0.035, yellow);
  tip.position.y = 1.13;
  const hook = mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16, Math.PI), dark);
  hook.position.set(0.06, 0, 0);
  hook.rotation.z = Math.PI;
  umbrella.add(shaft, canopy, tip, hook);
  rig.umbrella = umbrella;
  rig.umbrellaOpen = 0;

  for (const [arm, sx] of [[rig.armL, 1], [rig.armR, -1]]) {
    arm.position.set(sx * 0.4, bodyY + 0.02, 0);
    const a = capsule(0.07, 0.18, cloud);
    const hand = sphere(0.085, cloud);
    hand.position.y = -0.32;
    arm.add(a, hand);
  }
  umbrella.position.set(0, -0.34, 0.02);
  umbrella.scale.setScalar(0.55);
  umbrella.rotation.x = 0.15;
  rig.armR.add(umbrella);

  for (const [leg, sx] of [[rig.legL, 1], [rig.legR, -1]]) {
    leg.position.set(sx * 0.16, 0.04, 0);
    const l = capsule(0.07, 0.08, cloud);
    const boot = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 16), yellow);
    boot.position.set(0, -0.22, 0.01);
    const toe = sphere(0.1, yellow);
    toe.scale.set(1, 0.6, 1.3);
    toe.position.set(0, -0.3, 0.06);
    leg.add(l, boot, toe);
  }

  rig.onUpdate = (dt, s) => {
    const open = s.floating ? 1 : 0;
    rig.umbrellaOpen = damp(rig.umbrellaOpen, open, 12, dt);
    const u = rig.umbrellaOpen;
    umbrella.scale.setScalar(0.55 + u * 0.55);
    canopy.scale.set(0.35 + u * 0.65, 1, 0.35 + u * 0.65);
    // ergue o guarda-chuva acima da cabeça ao planar
    if (u > 0.01) {
      rig.armR.rotation.z = lerp(rig.armR.rotation.z, -2.8, u);
      rig.armR.rotation.x = lerp(rig.armR.rotation.x, 0, u);
    }
  };
  rig.fxColor = '#a9d6ff';
  return rig;
}

// ------------------------------------------------------------------
// MUSGO — pedra com musgo, broto com flor e mãos grandes
// ------------------------------------------------------------------
function buildMusgo(def) {
  const rig = new CharacterRig(def);
  rig.hipBase = 0.26;
  rig.setCenter(0.72);
  const stone = shade(
    new THREE.MeshStandardMaterial({ color: '#a39e93', roughness: 0.92, flatShading: true }),
    { rim: { color: 0xffffff, power: 3, strength: 0.2 }, variation: { amount: 0.35, scale: 3.0 } },
  );
  const moss = shade(new THREE.MeshStandardMaterial({ color: '#5fae45', roughness: 1, flatShading: true }), {
    rim: { color: '#d8ffb0', power: 2.5, strength: 0.35 }, variation: { amount: 0.4, scale: 6 },
  });
  const leafMat = toy('#7fdc4f', { roughness: 0.5, side: THREE.DoubleSide });
  const pink = toy('#ff7ab8', { emissive: '#ff4f9a', emissiveIntensity: 0.25 });
  const runeMat = new THREE.MeshStandardMaterial({ color: '#b6ff8a', emissive: '#7dff5a', emissiveIntensity: 1.4 });

  const bodyY = 0.44;
  const body = mesh(rockGeometry(0.5, 2, 0.12, 4.2, 1.18, 1.0, 1.02), stone);
  body.position.y = bodyY;
  rig.body.add(body);
  const cap = mesh(rockGeometry(0.44, 2, 0.18, 9.1, 1.28, 0.45, 1.15), moss);
  cap.position.y = bodyY + 0.32;
  rig.body.add(cap);
  for (let i = 0; i < 5; i++) {
    const tuft = mesh(rockGeometry(0.1 + (i % 2) * 0.03, 1, 0.2, i * 3.1), moss);
    const a = i * 1.3 + 0.4;
    tuft.position.set(Math.cos(a) * 0.36, bodyY + 0.3 - (i % 2) * 0.08, Math.sin(a) * 0.32);
    rig.body.add(tuft);
  }
  // runas brilhantes no peito
  const rune = mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), runeMat, false);
  rune.position.set(0, bodyY - 0.2, 0.49);
  rig.body.add(rune);

  // broto
  rig.head.position.y = bodyY + 0.46;
  const sprout = new THREE.Group();
  const stem = mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.3, 8), leafMat);
  stem.position.y = 0.15;
  const leafG = new THREE.SphereGeometry(0.1, 12, 8);
  leafG.scale(1.6, 0.18, 0.8);
  const leaf1 = mesh(leafG, leafMat);
  leaf1.position.set(0.13, 0.2, 0);
  leaf1.rotation.z = 0.5;
  const leaf2 = mesh(leafG, leafMat);
  leaf2.position.set(-0.13, 0.25, 0);
  leaf2.rotation.z = -0.5;
  const flower = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const pet = sphere(0.055, pink, 10, 8);
    const a = (i / 5) * Math.PI * 2;
    pet.position.set(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    pet.scale.set(1, 0.5, 1);
    flower.add(pet);
  }
  const center = sphere(0.04, toy('#ffe066'), 10, 8);
  flower.add(center);
  flower.position.y = 0.33;
  sprout.add(stem, leaf1, leaf2, flower);
  rig.head.add(sprout);
  rig.addSecondary(sprout, 'x', 70, 4, 2.2);
  rig.addSecondary(sprout, 'z', 60, 4, 1.2);

  const faceC = new THREE.Vector3(0, bodyY - 0.02, 0);
  for (const sx of [-1, 1]) {
    const eye = makeEye(0.075, '#1e5a2a');
    onSphere(eye, faceC, 0.47, new THREE.Vector3(sx * 0.3, 0.2, 1), 0.02);
    rig.body.add(eye);
    rig.eyes.push(eye);
    const b = blush(0.055, 0xff9a8a);
    onSphere(b, faceC, 0.52, new THREE.Vector3(sx * 0.55, -0.05, 1), 0.02);
    rig.body.add(b);
  }

  for (const [arm, sx] of [[rig.armL, 1], [rig.armR, -1]]) {
    arm.position.set(sx * 0.55, bodyY + 0.02, 0);
    const shoulder = mesh(rockGeometry(0.13, 1, 0.15, sx * 2), stone);
    const fore = mesh(rockGeometry(0.11, 1, 0.15, sx * 5, 1, 1.4, 1), stone);
    fore.position.y = -0.2;
    const hand = mesh(rockGeometry(0.16, 1, 0.15, sx * 7), stone);
    hand.position.y = -0.4;
    const handMoss = mesh(rockGeometry(0.1, 1, 0.2, sx * 8, 1.3, 0.5, 1.2), moss);
    handMoss.position.y = -0.3;
    arm.add(shoulder, fore, hand, handMoss);
  }
  for (const [leg, sx] of [[rig.legL, 1], [rig.legR, -1]]) {
    leg.position.set(sx * 0.22, 0.02, 0);
    const l = mesh(rockGeometry(0.12, 1, 0.12, sx * 11, 1, 1.2, 1), stone);
    l.position.y = -0.1;
    const foot = mesh(rockGeometry(0.14, 1, 0.12, sx * 13, 1.1, 0.6, 1.4), stone);
    foot.position.set(0, -0.22, 0.05);
    leg.add(l, foot);
  }
  rig.onUpdate = () => {
    runeMat.emissiveIntensity = 1.2 + Math.sin(rig.t * 2) * 0.4;
  };
  rig.fxColor = '#b6ff8a';
  return rig;
}

// ------------------------------------------------------------------
// ZUCA — robô de corda de lata com visor, antena e chave nas costas
// ------------------------------------------------------------------
function buildZuca(def) {
  const rig = new CharacterRig(def);
  rig.hipBase = 0.3;
  rig.setCenter(0.72);
  const pinkMetal = toy('#ff4fa3', { metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const teal = toy('#2fd0c4', { metalness: 0.5, roughness: 0.3, clearcoat: 1 });
  const copper = toy('#d9814a', { metalness: 0.9, roughness: 0.32 });
  const screen = new THREE.MeshPhysicalMaterial({ color: '#0d0a1c', roughness: 0.1, clearcoat: 1, metalness: 0.2 });
  const eyeGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6ff7ff').multiplyScalar(3.5) });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe45c').multiplyScalar(5) });

  const bodyY = 0.42;
  const body = mesh(new RoundedBoxGeometry(0.66, 0.5, 0.5, 4, 0.14), pinkMetal);
  body.position.y = bodyY;
  rig.body.add(body);
  // painel no peito com medidor
  const panel = mesh(new RoundedBoxGeometry(0.3, 0.2, 0.05, 2, 0.02), teal);
  panel.position.set(0, bodyY - 0.02, 0.25);
  const gauge = mesh(new THREE.CircleGeometry(0.055, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe45c').multiplyScalar(2) }), false);
  gauge.position.set(-0.06, bodyY - 0.02, 0.28);
  const gauge2 = mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5a8a').multiplyScalar(2) }), false);
  gauge2.position.set(0.07, bodyY - 0.02, 0.28);
  rig.body.add(panel, gauge, gauge2);
  // rebites
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const rv = sphere(0.025, copper, 8, 6);
    rv.position.set(sx * 0.28, bodyY + sy * 0.17, 0.25);
    rig.body.add(rv);
  }

  // cabeça
  rig.head.position.y = bodyY + 0.47;
  const headM = mesh(new RoundedBoxGeometry(0.6, 0.46, 0.5, 4, 0.16), teal);
  rig.head.add(headM);
  const visor = mesh(new RoundedBoxGeometry(0.48, 0.28, 0.06, 3, 0.05), screen);
  visor.position.set(0, 0.0, 0.23);
  rig.head.add(visor);
  const eyeG = new RoundedBoxGeometry(0.075, 0.13, 0.02, 2, 0.03);
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    const em = new THREE.Mesh(eyeG, eyeGlow);
    e.add(em);
    e.position.set(sx * 0.11, 0.01, 0.27);
    e.userData.look = new THREE.Group();
    rig.head.add(e);
    rig.eyes.push(e);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16, Math.PI), eyeGlow);
  mouth.position.set(0, -0.08, 0.27);
  mouth.rotation.z = Math.PI;
  rig.head.add(mouth);
  // antena com lâmpada
  const antenna = new THREE.Group();
  const rod = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8), copper);
  rod.position.y = 0.12;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), bulbMat);
  bulb.position.y = 0.28;
  antenna.add(rod, bulb);
  antenna.position.set(0.12, 0.23, 0);
  rig.head.add(antenna);
  rig.addSecondary(antenna, 'x', 140, 5, 2.5);
  rig.addSecondary(antenna, 'z', 120, 5, 1.2);
  // orelhas-parafuso
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), copper);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(sx * 0.31, 0, 0);
    rig.head.add(ear);
  }
  // chave de corda
  const key = new THREE.Group();
  const shaftK = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8), copper);
  shaftK.rotation.x = Math.PI / 2;
  shaftK.position.z = -0.09;
  const loop1 = mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 20), copper);
  loop1.position.set(0.1, 0, -0.2);
  loop1.rotation.y = Math.PI / 2;
  const loop2 = loop1.clone();
  loop2.position.x = -0.1;
  key.add(shaftK, loop1, loop2);
  key.position.set(0, bodyY + 0.03, -0.25);
  rig.body.add(key);
  rig.key = key;

  for (const [arm, sx] of [[rig.armL, 1], [rig.armR, -1]]) {
    arm.position.set(sx * 0.38, bodyY + 0.08, 0);
    const j = sphere(0.07, copper);
    const a = capsule(0.055, 0.2, pinkMetal);
    const hand = sphere(0.085, teal);
    hand.position.y = -0.34;
    arm.add(j, a, hand);
  }
  for (const [leg, sx] of [[rig.legL, 1], [rig.legR, -1]]) {
    leg.position.set(sx * 0.17, 0.05, 0);
    const l = capsule(0.06, 0.12, copper);
    const boot = mesh(new RoundedBoxGeometry(0.2, 0.13, 0.28, 3, 0.05), pinkMetal);
    boot.position.set(0, -0.27, 0.04);
    leg.add(l, boot);
  }
  rig.onUpdate = (dt, s) => {
    key.rotation.z += dt * (2 + s.speed * 1.5);
    bulbMat.color.setRGB(1, 0.9, 0.35).multiplyScalar(4 + Math.sin(rig.t * 6) * 1.5);
  };
  rig.fxColor = '#ff9ad0';
  return rig;
}

const BUILDERS = { lampi: buildLampi, nuvi: buildNuvi, musgo: buildMusgo, zuca: buildZuca };

export function buildCharacter(id) {
  const def = charById(id);
  const rig = BUILDERS[id](def);
  rig.collectMaterials();
  return rig;
}
