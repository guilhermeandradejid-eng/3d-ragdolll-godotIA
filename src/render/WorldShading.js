// Injeção de shaders nos materiais PBR do three.js (onBeforeCompile):
//  - neblina de altura com dispersão do sol (Inigo Quilez, "Better Fog")
//  - rim light estilizado (personagens e colecionáveis)
//  - vento procedural na vegetação
//  - terreno procedural (grama no topo, rocha estratificada nas laterais)
import * as THREE from 'three';

// Uniforms globais compartilhados por referência entre todos os materiais.
export const WU = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.6, -0.7).normalize() },
  uSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
  uFogColor: { value: new THREE.Color(0.8, 0.85, 0.95) },
  uFogSunColor: { value: new THREE.Color(1, 0.9, 0.7) },
  uFogDensity: { value: 0.01 },
  uFogHeightFalloff: { value: 0.05 },
  uFogBase: { value: 0 },
  uFogDistDensity: { value: 0.001 },
  uFogMax: { value: 0.95 },
  uWind: { value: new THREE.Vector3(0.8, 0.4, 0.5) },
  uPlayers: { value: [new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0), new THREE.Vector4(0, -999, 0, 0)] },
  uTerrainGrass: { value: new THREE.Color('#7cc25a') },
  uTerrainGrassDark: { value: new THREE.Color('#3d8a3c') },
  uTerrainRock: { value: new THREE.Color('#b09a8a') },
  uTerrainRockDark: { value: new THREE.Color('#6f5a52') },
  uTerrainDirt: { value: new THREE.Color('#8a5c3c') },
};

export const glslNoise = /* glsl */ `
float lumHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float lumNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(lumHash(i), lumHash(i + vec3(1, 0, 0)), f.x),
                 mix(lumHash(i + vec3(0, 1, 0)), lumHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(lumHash(i + vec3(0, 0, 1)), lumHash(i + vec3(1, 0, 1)), f.x),
                 mix(lumHash(i + vec3(0, 1, 1)), lumHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float lumFbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * lumNoise(p); p = p * 2.03 + 0.17; a *= 0.5; }
  return s;
}
`;

export const glslFog = /* glsl */ `
uniform vec3 uFogColor;
uniform vec3 uFogSunColor;
uniform vec3 uSunDir;
uniform float uFogDensity;
uniform float uFogHeightFalloff;
uniform float uFogBase;
uniform float uFogDistDensity;
uniform float uFogMax;
float lumFogAmount(vec3 wp) {
  vec3 ray = wp - cameraPosition;
  float dist = length(ray);
  vec3 rd = ray / max(dist, 1e-4);
  float b = max(uFogHeightFalloff, 1e-4);
  float h0 = cameraPosition.y - uFogBase;
  float rdy = rd.y;
  if (abs(rdy) < 1e-3) rdy = rdy < 0.0 ? -1e-3 : 1e-3;
  float fh = uFogDensity * exp(-h0 * b) * (1.0 - exp(-dist * rdy * b)) / (rdy * b);
  float fd = dist * uFogDistDensity;
  return min(1.0 - exp(-max(fh + fd, 0.0)), uFogMax);
}
vec3 lumFogColor(vec3 wp) {
  vec3 rd = normalize(wp - cameraPosition);
  float s = pow(max(dot(rd, uSunDir), 0.0), 8.0);
  return mix(uFogColor, uFogSunColor, s);
}
vec3 lumApplyFog(vec3 col, vec3 wp) {
  return mix(col, lumFogColor(wp), lumFogAmount(wp));
}
`;

const vertPars = /* glsl */ `
varying vec3 vLumWorldPos;
#ifdef LUM_TERRAIN
varying vec3 vLumWorldNormal;
#endif
#ifdef LUM_WIND
uniform float uTime;
uniform vec3 uWind;
uniform float uWindAmount;
#endif
`;

const vertWind = /* glsl */ `
#include <begin_vertex>
#ifdef LUM_WIND
{
  vec4 lumBase = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    lumBase = instanceMatrix * lumBase;
  #endif
  lumBase = modelMatrix * lumBase;
  float lumH = max(position.y, 0.0);
  float lumPhase = uTime * 1.6 + dot(lumBase.xz, vec2(0.23, 0.17)) + position.y * 0.3;
  float lumSway = sin(lumPhase) * 0.6 + sin(lumPhase * 2.37 + 1.3) * 0.25 + uWind.z * 0.6;
  transformed.xz += uWind.xy * lumSway * lumH * lumH * uWindAmount;
  transformed.y -= abs(lumSway) * lumH * lumH * uWindAmount * 0.15;
}
#endif
`;

const vertOut = /* glsl */ `
#include <project_vertex>
{
  vec4 lumWP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    lumWP = batchingMatrix * lumWP;
  #endif
  #ifdef USE_INSTANCING
    lumWP = instanceMatrix * lumWP;
  #endif
  lumWP = modelMatrix * lumWP;
  vLumWorldPos = lumWP.xyz;
  #ifdef LUM_TERRAIN
    vec3 lumN = objectNormal;
    #ifdef USE_INSTANCING
      lumN = mat3(instanceMatrix) * lumN;
    #endif
    vLumWorldNormal = normalize(mat3(modelMatrix) * lumN);
  #endif
}
`;

const fragPars = /* glsl */ `
varying vec3 vLumWorldPos;
#ifdef LUM_TERRAIN
varying vec3 vLumWorldNormal;
uniform vec3 uTerrainGrass;
uniform vec3 uTerrainGrassDark;
uniform vec3 uTerrainRock;
uniform vec3 uTerrainRockDark;
uniform vec3 uTerrainDirt;
uniform float uTerrainScale;
uniform float uTerrainGrassAmount;
#endif
#ifdef LUM_RIM
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
#endif
#ifdef LUM_VARIATION
uniform float uVariation;
uniform float uVariationScale;
#endif
${glslNoise}
${glslFog}
`;

const fragTerrain = /* glsl */ `
#include <color_fragment>
#ifdef LUM_TERRAIN
{
  vec3 wn = normalize(vLumWorldNormal);
  vec3 wp = vLumWorldPos * uTerrainScale;
  float n1 = lumFbm(wp * 0.16);
  float n2 = lumNoise(wp * 1.4);
  float up = wn.y + (n1 - 0.5) * 0.4;
  float grassMask = smoothstep(0.62, 0.78, up) * uTerrainGrassAmount;
  vec3 grass = mix(uTerrainGrassDark, uTerrainGrass, smoothstep(0.3, 0.72, n1)) * (0.9 + 0.2 * n2);
  float strata = sin(wp.y * 2.4 + n1 * 6.0) * 0.5 + 0.5;
  vec3 rock = mix(uTerrainRockDark, uTerrainRock, clamp(strata * 0.55 + n2 * 0.45, 0.0, 1.0));
  float dirtMask = smoothstep(0.2, 0.62, up) * (1.0 - grassMask);
  vec3 side = mix(rock, uTerrainDirt, dirtMask * 0.85);
  diffuseColor.rgb *= mix(side, grass, grassMask);
}
#endif
#ifdef LUM_VARIATION
{
  float lumV = lumFbm(vLumWorldPos * uVariationScale);
  diffuseColor.rgb *= 1.0 + (lumV - 0.5) * uVariation;
}
#endif
`;

const fragRim = /* glsl */ `
#ifdef LUM_RIM
{
  vec3 lumV = normalize(vViewPosition);
  float lumNdV = clamp(dot(normal, lumV), 0.0, 1.0);
  outgoingLight += uRimColor * pow(1.0 - lumNdV, uRimPower) * uRimStrength;
}
#endif
#include <opaque_fragment>
`;

const fragFog = /* glsl */ `
#ifndef LUM_NO_FOG
  gl_FragColor.rgb = lumApplyFog(gl_FragColor.rgb, vLumWorldPos);
#endif
`;

function patchVertex(src) {
  src = src.replace('#include <common>', '#include <common>\n' + vertPars);
  src = src.replace('#include <begin_vertex>', vertWind);
  src = src.replace('#include <project_vertex>', vertOut);
  return src;
}

function patchFragment(src) {
  src = src.replace('#include <common>', '#include <common>\n' + fragPars);
  src = src.replace('#include <color_fragment>', fragTerrain);
  src = src.replace('#include <opaque_fragment>', fragRim);
  src = src.replace('#include <fog_fragment>', fragFog);
  return src;
}

/**
 * Aplica os patches num material do three (Standard/Physical/Lambert/Phong/Basic).
 * opts: { rim: {color, power, strength}, wind: amount, terrain: {scale, grass}, variation: {amount, scale},
 *         fog: bool, patch: (shader) => void, key: string }
 */
export function shade(material, opts = {}) {
  const defines = {};
  const uniforms = {
    uFogColor: WU.uFogColor,
    uFogSunColor: WU.uFogSunColor,
    uSunDir: WU.uSunDir,
    uFogDensity: WU.uFogDensity,
    uFogHeightFalloff: WU.uFogHeightFalloff,
    uFogBase: WU.uFogBase,
    uFogDistDensity: WU.uFogDistDensity,
    uFogMax: WU.uFogMax,
  };
  if (opts.fog === false) defines.LUM_NO_FOG = '';
  if (opts.rim) {
    defines.LUM_RIM = '';
    uniforms.uRimColor = { value: new THREE.Color(opts.rim.color ?? 0xffffff) };
    uniforms.uRimPower = { value: opts.rim.power ?? 3 };
    uniforms.uRimStrength = { value: opts.rim.strength ?? 0.5 };
  }
  if (opts.wind) {
    defines.LUM_WIND = '';
    uniforms.uTime = WU.uTime;
    uniforms.uWind = WU.uWind;
    uniforms.uWindAmount = { value: opts.wind };
  }
  if (opts.terrain) {
    defines.LUM_TERRAIN = '';
    uniforms.uTerrainGrass = WU.uTerrainGrass;
    uniforms.uTerrainGrassDark = WU.uTerrainGrassDark;
    uniforms.uTerrainRock = WU.uTerrainRock;
    uniforms.uTerrainRockDark = WU.uTerrainRockDark;
    uniforms.uTerrainDirt = WU.uTerrainDirt;
    uniforms.uTerrainScale = { value: opts.terrain.scale ?? 1 };
    uniforms.uTerrainGrassAmount = { value: opts.terrain.grass ?? 1 };
  }
  if (opts.variation) {
    defines.LUM_VARIATION = '';
    uniforms.uVariation = { value: opts.variation.amount ?? 0.3 };
    uniforms.uVariationScale = { value: opts.variation.scale ?? 0.5 };
  }
  const key = 'lum:' + Object.keys(defines).sort().join(',') + (opts.key ? ':' + opts.key : '');
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.defines = shader.defines || {};
    Object.assign(shader.defines, defines);
    shader.vertexShader = patchVertex(shader.vertexShader);
    shader.fragmentShader = patchFragment(shader.fragmentShader);
    if (opts.patch) opts.patch(shader);
  };
  material.customProgramCacheKey = () => key;
  material.userData.lum = uniforms;
  return material;
}

// Fábricas de materiais comuns
export const M = {
  standard(color, params = {}, opts = {}) {
    return shade(new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...params }), opts);
  },
  physical(color, params = {}, opts = {}) {
    return shade(new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, metalness: 0, ...params }), opts);
  },
  lambert(color, params = {}, opts = {}) {
    return shade(new THREE.MeshLambertMaterial({ color, ...params }), opts);
  },
  basic(color, params = {}, opts = {}) {
    return shade(new THREE.MeshBasicMaterial({ color, ...params }), opts);
  },
};

export function setPlayerUniform(i, x, y, z, r) {
  WU.uPlayers.value[i].set(x, y, z, r);
}
