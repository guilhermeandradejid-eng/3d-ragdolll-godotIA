// Presets de iluminação/atmosfera/grading por mundo.
// Paletas pensadas como "color scripts" (ref.: color scripts da Pixar; direção de arte de
// Ori and the Will of the Wisps e das ilhas flutuantes de Laputa / Studio Ghibli).
import * as THREE from 'three';

const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const ENVIRONMENTS = {
  // Capítulo 1 — Prados da Aurora: hora dourada, céu rosado, luz quente atravessando a névoa.
  dawn: {
    sunDir: dir(0.55, 0.3, -0.78),
    light: { sunColor: '#ffd9a8', sunIntensity: 3.4, hemiSky: '#bcd4ff', hemiGround: '#f0bf94', hemiIntensity: 0.7, shadowIntensity: 0.85 },
    envIntensity: 0.75,
    sky: {
      sunColor: '#ffd29a', zenith: '#3f7ed6', horizon: '#ffcfae', ground: '#f6dcca', cloudLit: '#fff3e6', cloudShadow: '#c7a0bd',
      sunSize: 0.045, sunIntensity: 24, halo: 1.7, horizonGlow: 1.6, gradientExp: 0.5, cloudCover: 0.32, cloudSpeed: 0.008, cloudScale: 0.9,
    },
    fog: { color: '#eecdbf', sunColor: '#ffd49c', density: 0.0035, heightFalloff: 0.06, base: -40, dist: 0.0011, max: 0.93 },
    terrain: { grass: '#8fd35e', grassDark: '#3f9440', rock: '#c9a893', rockDark: '#7e6356', dirt: '#95653f' },
    grass: { base: '#3b8a3a', tip: '#a6e46a' },
    sea: { top: '#fff0e4', shadow: '#a98cc0', y: -34, glow: 1 },
    grade: {
      exposure: 1.0, saturation: 1.05, contrast: 1.08, tint: [1.0, 1.0, 0.98], bloomIntensity: 0.8, bloomThreshold: 1.1,
      godStrength: 0.7, sunColor: '#ffcb8f', vignette: 0.3, flareIntensity: 0.1, aoStrength: 0.8,
    },
    wind: [0.9, 0.35, 0.45],
    ambient: 'pollen',
    playerLight: 0.15,
  },

  // Capítulo 2 — Desfiladeiro Estelar: noite azul, aurora boreal, cristais e cogumelos que brilham.
  night: {
    sunDir: dir(-0.35, 0.55, -0.75),
    light: { sunColor: '#a9bcff', sunIntensity: 1.25, hemiSky: '#4c5cb0', hemiGround: '#2c2150', hemiIntensity: 0.55, shadowIntensity: 0.75 },
    envIntensity: 0.55,
    sky: {
      sunColor: '#c9d6ff', zenith: '#070b26', horizon: '#2a2d6a', ground: '#1a1640', cloudLit: '#4e5596', cloudShadow: '#171736',
      sunSize: 0.03, sunIntensity: 7, halo: 0.8, horizonGlow: 0.5, gradientExp: 0.45, cloudCover: 0.22, cloudSpeed: 0.004, cloudScale: 0.8,
      stars: 1, aurora: 1.2, auroraOffset: 3.2, moon: true,
    },
    fog: { color: '#262a5c', sunColor: '#5d68b0', density: 0.004, heightFalloff: 0.06, base: -40, dist: 0.0014, max: 0.93 },
    terrain: { grass: '#3f8f8a', grassDark: '#1c4b58', rock: '#5c5a86', rockDark: '#2b2949', dirt: '#3e3460' },
    grass: { base: '#123a4a', tip: '#5fd6c0' },
    sea: { top: '#3c4285', shadow: '#12123a', y: -34, glow: 0.35 },
    grade: {
      exposure: 1.2, saturation: 1.12, contrast: 1.08, tint: [0.96, 1.0, 1.08], bloomIntensity: 1.35, bloomThreshold: 0.9,
      godStrength: 0.35, sunColor: '#9fb2ff', vignette: 0.38, flareIntensity: 0.12, aoStrength: 0.75,
    },
    wind: [0.5, 0.25, 0.2],
    ambient: 'fireflies',
    playerLight: 1,
  },

  // Capítulo 3 — Cidadela do Eclipse: crepúsculo eterno magenta, sol eclipsado com coroa.
  eclipse: {
    sunDir: dir(-0.15, 0.3, -0.94),
    light: { sunColor: '#ff9c78', sunIntensity: 2.0, hemiSky: '#8a4f9a', hemiGround: '#5a2a36', hemiIntensity: 0.6, shadowIntensity: 0.8 },
    envIntensity: 0.6,
    sky: {
      sunColor: '#ff9a70', zenith: '#1a0d33', horizon: '#c5476c', ground: '#3b1a36', cloudLit: '#e07896', cloudShadow: '#3a173d',
      sunSize: 0.075, sunIntensity: 0, halo: 1.3, horizonGlow: 1.6, gradientExp: 0.55, cloudCover: 0.55, cloudSpeed: 0.014, cloudScale: 1.1,
      eclipse: 1, corona: '#ffcf8f', stars: 0.35,
    },
    fog: { color: '#6a2f55', sunColor: '#ff8f6f', density: 0.004, heightFalloff: 0.06, base: -40, dist: 0.0013, max: 0.93 },
    terrain: { grass: '#7c9a5c', grassDark: '#3e5a3a', rock: '#8a7688', rockDark: '#43334a', dirt: '#6a4550' },
    grass: { base: '#3a3a3a', tip: '#a8a070' },
    sea: { top: '#8c4a70', shadow: '#2c1030', y: -34, glow: 0.8 },
    grade: {
      exposure: 1.12, saturation: 1.08, contrast: 1.1, tint: [1.05, 0.96, 1.0], bloomIntensity: 1.2, bloomThreshold: 0.95,
      godStrength: 1.0, sunColor: '#ffb07c', vignette: 0.4, flareIntensity: 0.14, aoStrength: 0.8,
    },
    wind: [1.2, 0.6, 0.9],
    ambient: 'embers',
    lightning: true,
    playerLight: 0.6,
  },

  // Final — o sol volta a nascer.
  sunrise: {
    sunDir: dir(-0.1, 0.35, -0.93),
    light: { sunColor: '#ffe2b0', sunIntensity: 3.8, hemiSky: '#c9dcff', hemiGround: '#f7c9a0', hemiIntensity: 0.8, shadowIntensity: 0.8 },
    envIntensity: 0.85,
    sky: {
      sunColor: '#ffdca0', zenith: '#4a8ae0', horizon: '#ffd7b5', ground: '#fbe3d0', cloudLit: '#fff7ee', cloudShadow: '#d7aec2',
      sunSize: 0.06, sunIntensity: 28, halo: 2.0, horizonGlow: 1.8, gradientExp: 0.5, cloudCover: 0.4, cloudSpeed: 0.01, cloudScale: 1.0,
      eclipse: 0, corona: '#ffcf8f',
    },
    fog: { color: '#f2d5c6', sunColor: '#ffdca0', density: 0.0035, heightFalloff: 0.06, base: -40, dist: 0.0011, max: 0.93 },
    terrain: { grass: '#8fd35e', grassDark: '#3f9440', rock: '#c9a893', rockDark: '#7e6356', dirt: '#95653f' },
    grass: { base: '#2f7a35', tip: '#b5e86a' },
    sea: { top: '#fff4ea', shadow: '#d5aec6', y: -34, glow: 1 },
    grade: {
      exposure: 1.05, saturation: 1.12, contrast: 1.05, tint: [1.03, 1.0, 0.97], bloomIntensity: 1.0, bloomThreshold: 1.05,
      godStrength: 0.9, sunColor: '#ffd79c', vignette: 0.28, flareIntensity: 0.14, aoStrength: 0.8,
    },
    wind: [0.9, 0.35, 0.4],
    ambient: 'pollen',
    playerLight: 0.15,
  },
};

// Interpola dois presets (usado na transição eclipse -> nascer do sol no final)
export function lerpEnv(a, b, t) {
  const lc = (x, y) => '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
  const ln = (x, y) => x + (y - x) * t;
  const mix = (A, B) => {
    const out = {};
    for (const k of Object.keys(A)) {
      const va = A[k], vb = B[k] ?? va;
      if (typeof va === 'string' && va.startsWith('#')) out[k] = lc(va, vb);
      else if (typeof va === 'number') out[k] = ln(va, typeof vb === 'number' ? vb : va);
      else if (Array.isArray(va)) out[k] = va.map((v, i) => ln(v, vb[i]));
      else if (va && va.isVector3) out[k] = va.clone().lerp(vb, t).normalize();
      else if (va && typeof va === 'object') out[k] = mix(va, vb);
      else out[k] = t < 0.5 ? va : vb;
    }
    return out;
  };
  return mix(a, b);
}
