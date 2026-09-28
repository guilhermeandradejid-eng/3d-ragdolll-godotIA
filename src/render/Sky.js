// Céu procedural em HDR: gradiente, sol/lua com halo, nuvens FBM iluminadas,
// estrelas cintilantes, aurora boreal em camadas e eclipse com coroa solar.
import * as THREE from 'three';
import { WU, glslFog } from './WorldShading.js';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  vec4 p = projectionMatrix * viewMatrix * wp;
  gl_Position = p.xyww;
}
`;

const skyFrag = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uCloudLit;
uniform vec3 uCloudShadow;
uniform vec3 uCoronaColor;
uniform float uSunSize;
uniform float uSunIntensity;
uniform float uHaloIntensity;
uniform float uHorizonGlow;
uniform float uGradientExp;
uniform float uCloudCover;
uniform float uCloudSpeed;
uniform float uCloudScale;
uniform float uTime;
uniform float uStars;
uniform float uAurora;
uniform float uAuroraOffset;
uniform float uEclipse;
uniform float uFlash;
uniform float uMoon;
varying vec3 vDir;

float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = r * p * 2.02 + 3.1; a *= 0.5; }
  return s;
}

vec3 aurora(vec3 d) {
  vec3 acc = vec3(0.0);
  if (d.y < 0.01) return acc;
  for (int i = 0; i < 16; i++) {
    float t = float(i) / 16.0;
    float alt = 1.0 + t * 1.2;
    vec2 p = d.xz * (alt / d.y) * 0.22;
    float curve = sin(p.x * 0.55 + uTime * 0.05) * 1.6 + sin(p.x * 1.7 - uTime * 0.04) * 0.45
                + (vnoise(vec2(p.x * 0.9, uTime * 0.05)) - 0.5) * 1.6;
    float dist = abs(p.y + uAuroraOffset - curve);
    float band = exp(-dist * dist * 2.2);
    band *= 0.55 + 0.45 * vnoise(vec2(p.x * 9.0 + uTime * 0.3, t * 2.0));
    vec3 c = mix(vec3(0.15, 1.0, 0.6), vec3(0.75, 0.3, 1.0), smoothstep(0.1, 0.9, t));
    acc += c * band * (1.0 - t) * 0.16;
  }
  return acc * smoothstep(0.02, 0.25, d.y);
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float cosT = dot(d, uSunDir);
  float ang = acos(clamp(cosT, -1.0, 1.0));

  float t = pow(clamp(h, 0.0, 1.0), uGradientExp);
  vec3 col = mix(uHorizon, uZenith, t);
  float sunSide = pow(max(cosT, 0.0), 3.0);
  col += uSunColor * uHorizonGlow * sunSide * pow(1.0 - clamp(h, 0.0, 1.0), 6.0) * 0.35;
  col = mix(col, uGround, smoothstep(0.0, -0.35, h));

  // estrelas
  if (uStars > 0.001 && h > -0.05) {
    vec3 sd = d * 300.0;
    vec3 cell = floor(sd);
    float r = h31(cell);
    vec3 f = fract(sd) - 0.5;
    float star = step(0.975, r) * smoothstep(0.32, 0.0, length(f));
    float tw = 0.55 + 0.45 * sin(uTime * (2.0 + r * 5.0) + r * 60.0);
    vec3 sc = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.85, 0.7), fract(r * 13.0));
    col += sc * star * tw * uStars * 3.0 * smoothstep(-0.05, 0.25, h);
    // via láctea sutil
    float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.2, 1.0))) * 3.0, 2.0));
    col += vec3(0.35, 0.3, 0.55) * band * fbm(d.xy * 6.0 + d.z * 3.0) * 0.25 * uStars;
  }

  // aurora boreal
  if (uAurora > 0.001) col += aurora(d) * uAurora;

  // sol (ou lua) com halo
  float disk = smoothstep(uSunSize, uSunSize * 0.8, ang);
  float halo = exp(-ang * 9.0) * 0.8 + exp(-ang * 2.5) * 0.18;
  vec3 sun = uSunColor * (disk * uSunIntensity + halo * uHaloIntensity);
  if (uMoon > 0.5) {
    // lua: disco com crateras suaves
    float cr = fbm(d.xy * 90.0);
    sun = uSunColor * (disk * uSunIntensity * (0.75 + 0.35 * cr) + halo * uHaloIntensity);
  }
  if (uEclipse > 0.001) {
    float moon = smoothstep(uSunSize * 1.02, uSunSize * 0.94, ang);
    float rim = max(ang - uSunSize * 0.96, 0.0);
    float rays = 0.7 + 0.3 * sin(atan(d.y - uSunDir.y, d.x - uSunDir.x) * 14.0 + uTime * 0.4);
    float corona = exp(-rim * 38.0) * 5.0 * rays + exp(-rim * 9.0) * 0.9;
    sun = mix(sun, vec3(0.0), uEclipse * moon) + uCoronaColor * corona * uEclipse * (1.0 - moon);
  }
  col += sun * smoothstep(-0.04, 0.02, h);

  // nuvens
  if (uCloudCover > 0.001 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.18) * uCloudScale + uTime * uCloudSpeed * vec2(1.0, 0.35);
    float n = fbm(uv);
    float cover = smoothstep(1.0 - uCloudCover, 1.0 - uCloudCover + 0.32, n);
    float n2 = fbm(uv + uSunDir.xz * 0.12);
    float lit = clamp(0.55 + (n - n2) * 5.0, 0.0, 1.0);
    vec3 cc = mix(uCloudShadow, uCloudLit, lit);
    cc += uSunColor * pow(max(cosT, 0.0), 5.0) * (1.0 - cover * 0.7) * 1.2;
    float fade = smoothstep(0.0, 0.22, h);
    col = mix(col, cc, cover * fade * 0.96);
  }

  col += uFlash * vec3(0.55, 0.6, 1.0) * (0.5 + 0.5 * smoothstep(-0.1, 0.5, h));
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export class Sky {
  constructor() {
    this.uniforms = {
      uSunDir: WU.uSunDir,
      uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
      uZenith: { value: new THREE.Color('#3a78d6') },
      uHorizon: { value: new THREE.Color('#ffd2b0') },
      uGround: { value: new THREE.Color('#f0d8c8') },
      uCloudLit: { value: new THREE.Color('#fff6ea') },
      uCloudShadow: { value: new THREE.Color('#b99ab8') },
      uCoronaColor: { value: new THREE.Color('#ffc07a') },
      uSunSize: { value: 0.035 },
      uSunIntensity: { value: 30 },
      uHaloIntensity: { value: 1.5 },
      uHorizonGlow: { value: 1 },
      uGradientExp: { value: 0.55 },
      uCloudCover: { value: 0.45 },
      uCloudSpeed: { value: 0.01 },
      uCloudScale: { value: 0.9 },
      uTime: WU.uTime,
      uStars: { value: 0 },
      uAurora: { value: 0 },
      uAuroraOffset: { value: 3.5 },
      uEclipse: { value: 0 },
      uFlash: { value: 0 },
      uMoon: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      this.mesh.position.copy(camera.position);
      this.mesh.updateMatrixWorld();
    };
  }

  apply(cfg) {
    const u = this.uniforms;
    const set = (k, v) => {
      if (v === undefined) return;
      if (u[k].value.isColor) u[k].value.set(v);
      else u[k].value = v;
    };
    set('uSunColor', cfg.sunColor);
    set('uZenith', cfg.zenith);
    set('uHorizon', cfg.horizon);
    set('uGround', cfg.ground);
    set('uCloudLit', cfg.cloudLit);
    set('uCloudShadow', cfg.cloudShadow);
    set('uCoronaColor', cfg.corona);
    set('uSunSize', cfg.sunSize);
    set('uSunIntensity', cfg.sunIntensity);
    set('uHaloIntensity', cfg.halo);
    set('uHorizonGlow', cfg.horizonGlow);
    set('uGradientExp', cfg.gradientExp);
    set('uCloudCover', cfg.cloudCover);
    set('uCloudSpeed', cfg.cloudSpeed);
    set('uCloudScale', cfg.cloudScale);
    set('uStars', cfg.stars ?? 0);
    set('uAurora', cfg.aurora ?? 0);
    set('uAuroraOffset', cfg.auroraOffset);
    set('uEclipse', cfg.eclipse ?? 0);
    set('uMoon', cfg.moon ? 1 : 0);
  }

  // Gera o mapa de ambiente (IBL) a partir do próprio céu, sem o disco do sol
  // (a luz direcional já cuida do brilho especular do sol).
  buildEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const scene = new THREE.Scene();
    const saved = { sun: this.uniforms.uSunIntensity.value, halo: this.uniforms.uHaloIntensity.value, stars: this.uniforms.uStars.value };
    this.uniforms.uSunIntensity.value = 0;
    this.uniforms.uHaloIntensity.value = saved.halo * 0.35;
    this.uniforms.uStars.value = 0;
    const mesh = new THREE.Mesh(this.mesh.geometry, this.material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const prevAuto = renderer.autoClear;
    renderer.autoClear = true;
    const rt = pmrem.fromScene(scene, 0.04, 0.1, 2000);
    renderer.autoClear = prevAuto;
    this.uniforms.uSunIntensity.value = saved.sun;
    this.uniforms.uHaloIntensity.value = saved.halo;
    this.uniforms.uStars.value = saved.stars;
    pmrem.dispose();
    return rt;
  }
}

// ---------------------------------------------------------------------------
// Mar de nuvens: plano gigante abaixo das ilhas, com FBM "fofo" e iluminação falsa.
// ---------------------------------------------------------------------------
const seaVert = /* glsl */ `
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const seaFrag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uShadow;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uGlow;
varying vec3 vWP;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
float billow(vec2 p) {
  float s = 0.0, a = 0.55;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    float n = vnoise(p);
    s += a * (1.0 - abs(n * 2.0 - 1.0));
    p = r * p * 2.1 + 1.7;
    a *= 0.5;
  }
  return s;
}
__FOG__
void main() {
  vec2 p = vWP.xz * 0.018 + vec2(uTime * 0.006, uTime * 0.003);
  float n = billow(p);
  float e = 0.04;
  float nx = billow(p + vec2(e, 0.0));
  float nz = billow(p + vec2(0.0, e));
  vec3 N = normalize(vec3((n - nx) * 6.0, 1.0, (n - nz) * 6.0));
  float diff = clamp(dot(N, uSunDir) * 0.6 + 0.4, 0.0, 1.0);
  float puff = smoothstep(0.25, 0.95, n);
  vec3 col = mix(uShadow, uTop, diff * (0.55 + 0.45 * puff));
  vec3 V = normalize(vWP - cameraPosition);
  col += uSunColor * pow(max(dot(V, uSunDir), 0.0), 10.0) * 0.5 * uGlow;
  col += uSunColor * pow(1.0 - clamp(N.y, 0.0, 1.0), 2.0) * 0.4 * uGlow;
  col = lumApplyFog(col, vWP);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class CloudSea {
  constructor(y = -32) {
    this.uniforms = {
      uTop: { value: new THREE.Color('#fff4ea') },
      uShadow: { value: new THREE.Color('#b99cc0') },
      uSunColor: WU.uSunColor,
      uTime: WU.uTime,
      uGlow: { value: 1 },
      uFogColor: WU.uFogColor,
      uFogSunColor: WU.uFogSunColor,
      uSunDir: WU.uSunDir,
      uFogDensity: WU.uFogDensity,
      uFogHeightFalloff: WU.uFogHeightFalloff,
      uFogBase: WU.uFogBase,
      uFogDistDensity: WU.uFogDistDensity,
      uFogMax: WU.uFogMax,
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: seaVert,
      fragmentShader: seaFrag.replace('__FOG__', glslFog),
      uniforms: this.uniforms,
    });
    const geo = new THREE.PlaneGeometry(4000, 4000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.position.y = y;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
  apply(cfg) {
    if (cfg.top) this.uniforms.uTop.value.set(cfg.top);
    if (cfg.shadow) this.uniforms.uShadow.value.set(cfg.shadow);
    if (cfg.glow !== undefined) this.uniforms.uGlow.value = cfg.glow;
    if (cfg.y !== undefined) this.mesh.position.y = cfg.y;
  }
}
