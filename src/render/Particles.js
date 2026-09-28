// Sistema de partículas instanciado: simulação na CPU, billboards desenhados na GPU
// numa única draw call por modo de blending. Formas geradas no shader (sem texturas).
import * as THREE from 'three';
import { WU, glslFog } from './WorldShading.js';

export const SHAPE = { GLOW: 0, SPARKLE: 1, RING: 2, PUFF: 3, CONFETTI: 4, STREAK: 5, LEAF: 6, HEART: 7 };

const vert = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iColor;
attribute vec4 iParams; // size, rotation, shape, stretch
attribute vec3 iVel;
varying vec4 vColor;
varying vec2 vUv;
varying float vShape;
varying float vFog;
varying vec3 vWP;
__FOG__
void main() {
  float size = iParams.x;
  float rot = iParams.y;
  float stretch = iParams.w;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 corner = position.xy;
  float c = cos(rot), s = sin(rot);
  vec2 q = vec2(c * corner.x - s * corner.y, s * corner.x + c * corner.y);
  if (stretch > 0.0) {
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    float l = length(vv.xy);
    vec2 dir = l > 1e-4 ? vv.xy / l : vec2(0.0, 1.0);
    vec2 perp = vec2(-dir.y, dir.x);
    q = dir * corner.y * (1.0 + l * stretch) + perp * corner.x;
  }
  mv.xy += q * size;
  gl_Position = projectionMatrix * mv;
  vUv = corner * 2.0;
  vColor = iColor;
  vShape = iParams.z;
  vWP = iPos;
  vFog = lumFogAmount(iPos);
}
`;

const frag = /* glsl */ `
varying vec4 vColor;
varying vec2 vUv;
varying float vShape;
varying float vFog;
varying vec3 vWP;
__FOG__
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vUv;
  float r = length(p);
  float a = 0.0;
  int shape = int(vShape + 0.5);
  if (shape == 0) {
    a = exp(-r * r * 4.5) - 0.011;
  } else if (shape == 1) {
    float core = exp(-r * r * 10.0);
    float rays = exp(-abs(p.x) * 16.0) * exp(-abs(p.y) * 2.2) + exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.2);
    a = core + rays * 0.9;
  } else if (shape == 2) {
    a = smoothstep(0.12, 0.0, abs(r - 0.78)) * 1.2;
  } else if (shape == 3) {
    float n = vnoise(p * 2.5 + vColor.a * 3.0 + vWP.xz);
    a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.5);
  } else if (shape == 4) {
    a = step(abs(p.x), 0.8) * step(abs(p.y), 0.45);
  } else if (shape == 5) {
    a = exp(-p.x * p.x * 12.0) * smoothstep(1.0, 0.3, abs(p.y));
  } else if (shape == 6) {
    a = smoothstep(1.0, 0.9, length(p * vec2(1.0, 2.1)));
  } else {
    vec2 q = p * 0.62 + vec2(0.0, 0.52);
    q.x = abs(q.x);
    float d;
    if (q.y + q.x > 1.0) d = length(q - vec2(0.25, 0.75)) - 0.35355;
    else d = sqrt(min(dot(q - vec2(0.0, 1.0), q - vec2(0.0, 1.0)), dot(q - 0.5 * max(q.x + q.y, 0.0), q - 0.5 * max(q.x + q.y, 0.0)))) * sign(q.x - q.y);
    a = smoothstep(0.03, -0.03, d);
  }
  a = clamp(a, 0.0, 1.0);
#ifdef ADDITIVE
  vec3 col = vColor.rgb * a * vColor.a * (1.0 - vFog);
  gl_FragColor = vec4(col, 1.0);
#else
  if (a * vColor.a < 0.01) discard;
  vec3 col = mix(vColor.rgb, lumFogColor(vWP), vFog);
  gl_FragColor = vec4(col, a * vColor.a);
#endif
}
`;

export class ParticleSystem {
  constructor(max = 2048, additive = true) {
    this.max = max;
    this.count = 0;
    this.additive = additive;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aParams = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iColor', this.aColor);
    geo.setAttribute('iParams', this.aParams);
    geo.setAttribute('iVel', this.aVel);
    geo.instanceCount = 0;
    this.geometry = geo;

    const uniforms = {
      uFogColor: WU.uFogColor, uFogSunColor: WU.uFogSunColor, uSunDir: WU.uSunDir,
      uFogDensity: WU.uFogDensity, uFogHeightFalloff: WU.uFogHeightFalloff, uFogBase: WU.uFogBase,
      uFogDistDensity: WU.uFogDistDensity, uFogMax: WU.uFogMax,
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert.replace('__FOG__', glslFog),
      fragmentShader: frag.replace('__FOG__', glslFog),
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      defines: additive ? { ADDITIVE: '' } : {},
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 20 : 10;

    // estado por partícula (SoA)
    const f = (n) => new Float32Array(max * n);
    this.p = f(3); this.v = f(3);
    this.life = f(1); this.maxLife = f(1);
    this.size = f(2); this.c0 = f(4); this.c1 = f(4);
    this.rot = f(2); this.phys = f(3); // drag, gravity, spin damping
    this.shape = new Uint8Array(max);
    this.stretch = f(1);
  }

  emit(o) {
    if (this.count >= this.max) return -1;
    const i = this.count++;
    const i3 = i * 3, i4 = i * 4, i2 = i * 2;
    this.p[i3] = o.x; this.p[i3 + 1] = o.y; this.p[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.life[i] = 0;
    this.maxLife[i] = o.life || 1;
    this.size[i2] = o.size ?? 0.3;
    this.size[i2 + 1] = o.size1 ?? this.size[i2];
    const c = o.color || [1, 1, 1];
    const c1 = o.color1 || c;
    this.c0[i4] = c[0]; this.c0[i4 + 1] = c[1]; this.c0[i4 + 2] = c[2]; this.c0[i4 + 3] = o.alpha ?? 1;
    this.c1[i4] = c1[0]; this.c1[i4 + 1] = c1[1]; this.c1[i4 + 2] = c1[2]; this.c1[i4 + 3] = o.alpha1 ?? 0;
    this.rot[i2] = o.rot ?? Math.random() * 6.283;
    this.rot[i2 + 1] = o.spin ?? 0;
    this.phys[i3] = o.drag ?? 0;
    this.phys[i3 + 1] = o.gravity ?? 0;
    this.phys[i3 + 2] = o.flutter ?? 0;
    this.shape[i] = o.shape ?? 0;
    this.stretch[i] = o.stretch ?? 0;
    return i;
  }

  _kill(i) {
    const last = --this.count;
    if (i === last) return;
    const cp = (arr, n) => {
      for (let k = 0; k < n; k++) arr[i * n + k] = arr[last * n + k];
    };
    cp(this.p, 3); cp(this.v, 3); cp(this.life, 1); cp(this.maxLife, 1); cp(this.size, 2);
    cp(this.c0, 4); cp(this.c1, 4); cp(this.rot, 2); cp(this.phys, 3); cp(this.stretch, 1);
    this.shape[i] = this.shape[last];
  }

  update(dt, time) {
    let i = 0;
    while (i < this.count) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) {
        this._kill(i);
        continue;
      }
      const i3 = i * 3;
      const drag = this.phys[i3];
      const k = drag > 0 ? Math.exp(-drag * dt) : 1;
      this.v[i3] *= k;
      this.v[i3 + 1] = this.v[i3 + 1] * k - this.phys[i3 + 1] * dt;
      this.v[i3 + 2] *= k;
      const fl = this.phys[i3 + 2];
      if (fl > 0) {
        this.v[i3] += Math.sin(time * 3.1 + i * 1.7) * fl * dt;
        this.v[i3 + 2] += Math.cos(time * 2.7 + i * 1.3) * fl * dt;
      }
      this.p[i3] += this.v[i3] * dt;
      this.p[i3 + 1] += this.v[i3 + 1] * dt;
      this.p[i3 + 2] += this.v[i3 + 2] * dt;
      this.rot[i * 2] += this.rot[i * 2 + 1] * dt;
      i++;
    }
    // escreve os atributos
    const P = this.aPos.array, C = this.aColor.array, R = this.aParams.array, V = this.aVel.array;
    for (let j = 0; j < this.count; j++) {
      const j3 = j * 3, j4 = j * 4, j2 = j * 2;
      const t = this.life[j] / this.maxLife[j];
      P[j3] = this.p[j3]; P[j3 + 1] = this.p[j3 + 1]; P[j3 + 2] = this.p[j3 + 2];
      V[j3] = this.v[j3]; V[j3 + 1] = this.v[j3 + 1]; V[j3 + 2] = this.v[j3 + 2];
      // alpha com fade-in rápido
      const fadeIn = Math.min(1, t * 12);
      C[j4] = this.c0[j4] + (this.c1[j4] - this.c0[j4]) * t;
      C[j4 + 1] = this.c0[j4 + 1] + (this.c1[j4 + 1] - this.c0[j4 + 1]) * t;
      C[j4 + 2] = this.c0[j4 + 2] + (this.c1[j4 + 2] - this.c0[j4 + 2]) * t;
      C[j4 + 3] = (this.c0[j4 + 3] + (this.c1[j4 + 3] - this.c0[j4 + 3]) * t) * fadeIn;
      R[j4] = this.size[j2] + (this.size[j2 + 1] - this.size[j2]) * t;
      R[j4 + 1] = this.rot[j2];
      R[j4 + 2] = this.shape[j];
      R[j4 + 3] = this.stretch[j];
    }
    this.geometry.instanceCount = this.count;
    const n = Math.max(1, this.count);
    this.aPos.clearUpdateRanges(); this.aPos.addUpdateRange(0, n * 3); this.aPos.needsUpdate = true;
    this.aColor.clearUpdateRanges(); this.aColor.addUpdateRange(0, n * 4); this.aColor.needsUpdate = true;
    this.aParams.clearUpdateRanges(); this.aParams.addUpdateRange(0, n * 4); this.aParams.needsUpdate = true;
    this.aVel.clearUpdateRanges(); this.aVel.addUpdateRange(0, n * 3); this.aVel.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geometry.instanceCount = 0;
  }
}

// Conjunto de efeitos prontos (poeira, brilhos, confete, anéis, etc.).
const tmpC = new THREE.Color();
function rgb(hex, mul = 1) {
  tmpC.set(hex);
  return [tmpC.r * mul, tmpC.g * mul, tmpC.b * mul];
}

export class Effects {
  constructor(scene, scale = 1) {
    this.scale = scale;
    this.add = new ParticleSystem(Math.round(4096 * Math.max(0.5, scale)), true);
    this.norm = new ParticleSystem(Math.round(2048 * Math.max(0.5, scale)), false);
    scene.add(this.add.mesh, this.norm.mesh);
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48, 1);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.scene = scene;
    this.time = 0;
  }

  n(count) {
    return Math.max(1, Math.round(count * this.scale));
  }

  dust(pos, count = 8, color = '#e8d8c0', speed = 2.2, size = 0.45) {
    const c = rgb(color);
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.norm.emit({
        x: pos.x + Math.cos(a) * 0.2, y: pos.y + 0.1, z: pos.z + Math.sin(a) * 0.2,
        vx: Math.cos(a) * s, vy: 0.6 + Math.random() * 1.2, vz: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.4, size: size * 0.6, size1: size * 1.6,
        color: c, alpha: 0.55, alpha1: 0, drag: 4, gravity: -0.5, shape: SHAPE.PUFF,
      });
    }
  }

  sparkle(pos, color = '#ffe08a', count = 12, speed = 4, size = 0.35, mul = 4) {
    const c = rgb(color, mul);
    for (let i = 0; i < this.n(count); i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const s = speed * (0.4 + Math.random() * 0.6);
      this.add.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: r * Math.cos(th) * s, vy: u * s + 1, vz: r * Math.sin(th) * s,
        life: 0.4 + Math.random() * 0.5, size, size1: 0.02, color: c, alpha: 1, alpha1: 0.2,
        drag: 3, gravity: 3, shape: i % 3 === 0 ? SHAPE.SPARKLE : SHAPE.GLOW, spin: 4,
      });
    }
  }

  burst(pos, color, count = 20, speed = 7, size = 0.5, mul = 5) {
    this.sparkle(pos, color, count, speed, size, mul);
    const c = rgb(color, mul * 0.6);
    this.add.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.35, size: 0.4, size1: 3.2, color: c, alpha: 1, alpha1: 0, shape: SHAPE.RING });
    this.add.emit({ x: pos.x, y: pos.y, z: pos.z, life: 0.25, size: 2.5, size1: 0.5, color: c, alpha: 0.9, alpha1: 0, shape: SHAPE.GLOW });
  }

  confetti(pos, count = 60) {
    const palette = ['#ffcf3f', '#ff5f7a', '#5fd3ff', '#8dff6a', '#c47dff', '#ffffff'];
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      this.norm.emit({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s * 0.6, vy: 6 + Math.random() * 7, vz: Math.sin(a) * s * 0.6,
        life: 2.5 + Math.random() * 1.5, size: 0.28, color: rgb(palette[i % palette.length]), alpha: 1, alpha1: 0.8,
        drag: 1.6, gravity: 6, shape: SHAPE.CONFETTI, spin: (Math.random() - 0.5) * 16, flutter: 6,
      });
    }
  }

  groundRing(pos, color = '#ffe2a8', radius = 3, life = 0.45, intensity = 3) {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(pos);
    m.position.y += 0.08;
    m.renderOrder = 15;
    this.scene.add(m);
    this.rings.push({ m, t: 0, life, radius });
  }

  trail(pos, color, size = 0.25, mul = 3) {
    this.add.emit({
      x: pos.x + (Math.random() - 0.5) * 0.2, y: pos.y + (Math.random() - 0.5) * 0.2, z: pos.z + (Math.random() - 0.5) * 0.2,
      vy: 0.3, life: 0.35 + Math.random() * 0.2, size, size1: 0.02, color: rgb(color, mul), alpha: 0.9, alpha1: 0,
      drag: 2, shape: SHAPE.GLOW,
    });
  }

  flame(pos, color = '#ffb347', size = 0.35) {
    this.add.emit({
      x: pos.x + (Math.random() - 0.5) * 0.15, y: pos.y, z: pos.z + (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 0.4, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.4,
      life: 0.35 + Math.random() * 0.25, size, size1: 0.05, color: rgb(color, 4), color1: rgb('#ff5a1f', 2), alpha: 1, alpha1: 0,
      drag: 1.5, shape: SHAPE.GLOW,
    });
  }

  hearts(pos, count = 6) {
    for (let i = 0; i < this.n(count); i++) {
      const a = Math.random() * Math.PI * 2;
      this.add.emit({
        x: pos.x, y: pos.y, z: pos.z, vx: Math.cos(a) * 1.5, vy: 2.5 + Math.random() * 2, vz: Math.sin(a) * 1.5,
        life: 0.9, size: 0.4, size1: 0.1, color: rgb('#ff4f7a', 3), alpha: 1, alpha1: 0, drag: 2, gravity: 1, shape: SHAPE.HEART, rot: 0,
      });
    }
  }

  update(dt) {
    this.time += dt;
    this.add.update(dt, this.time);
    this.norm.update(dt, this.time);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.life;
      if (k >= 1) {
        this.scene.remove(r.m);
        r.m.material.dispose();
        this.rings.splice(i, 1);
        continue;
      }
      const s = r.radius * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3)));
      r.m.scale.setScalar(s);
      r.m.material.opacity = 1 - k;
    }
  }

  clear() {
    this.add.clear();
    this.norm.clear();
    for (const r of this.rings) {
      this.scene.remove(r.m);
      r.m.material.dispose();
    }
    this.rings.length = 0;
  }
}
