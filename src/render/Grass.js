// Grama estilizada instanciada: milhares de lâminas com vento, translucidez contra o sol
// e interação com os jogadores (a grama se afasta de quem passa).
// Ref.: Eric Wohllaib, "Procedural Grass in Ghost of Tsushima" (GDC 2021) — versão simplificada.
import * as THREE from 'three';
import { WU, shade } from './WorldShading.js';

function bladeGeometry() {
  // 3 segmentos: 7 vértices
  const w = 0.5;
  const ys = [0, 0.35, 0.72];
  const pos = [];
  for (const y of ys) {
    const k = 1 - y * 0.75;
    pos.push(-w * k, y, 0, w * k, y, 0);
  }
  pos.push(0, 1, 0);
  const idx = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  return g;
}

const grassVertPars = /* glsl */ `
attribute vec3 iOffset;
attribute vec4 iParams;
uniform vec4 uPlayers[4];
uniform float uGrassTime;
uniform vec3 uGrassWind;
uniform float uFadeDist;
varying float vGrassH;
varying float vGrassVar;
`;

const grassBegin = /* glsl */ `
vec3 transformed;
{
  vec3 bl = position;
  float h = bl.y;
  float yaw = iParams.x;
  float height = iParams.y;
  float width = iParams.z;
  // encolhe à distância (LOD contínuo)
  float camD = distance(cameraPosition, iOffset);
  float lod = 1.0 - smoothstep(uFadeDist * 0.7, uFadeDist, camD);
  height *= lod;
  bl.x *= width;
  vec2 wdir = uGrassWind.xy;
  float ph = uGrassTime * 2.1 + dot(iOffset.xz, vec2(0.31, 0.19));
  float gust = sin(ph) * 0.55 + sin(ph * 0.43 + iOffset.x * 0.07) * 0.45;
  vec2 bend = wdir * (0.18 + 0.28 * gust + uGrassWind.z * 0.25);
  for (int i = 0; i < 4; i++) {
    vec3 d = iOffset - uPlayers[i].xyz;
    float r = uPlayers[i].w;
    float dist = length(d.xz);
    float f = (1.0 - smoothstep(r * 0.25, r, dist)) * (1.0 - smoothstep(0.8, 2.0, abs(d.y)));
    bend += (d.xz / max(dist, 1e-3)) * f * 1.5;
  }
  float c = cos(yaw), s = sin(yaw);
  vec3 p = vec3(c * bl.x, h * height, -s * bl.x);
  float k = h * h;
  float bl2 = min(length(bend), 1.3);
  p.xz += bend * k * height;
  p.y -= bl2 * bl2 * k * height * 0.3;
  transformed = iOffset + p;
  vGrassH = h;
  vGrassVar = iParams.w;
}
`;

const grassFragPars = /* glsl */ `
uniform vec3 uGrassBase;
uniform vec3 uGrassTip;
uniform vec3 uGrassSunColor;
varying float vGrassH;
varying float vGrassVar;
`;

const grassColor = /* glsl */ `
#include <color_fragment>
{
  vec3 gc = mix(uGrassBase, uGrassTip, smoothstep(0.0, 1.0, vGrassH));
  gc *= 0.85 + vGrassVar * 0.3;
  gc = mix(gc, gc * vec3(1.12, 1.06, 0.75), step(0.9, vGrassVar) * vGrassH);
  diffuseColor.rgb = gc;
}
`;

const grassTranslucency = /* glsl */ `
{
  vec3 vdir = normalize(vLumWorldPos - cameraPosition);
  float back = pow(max(dot(vdir, uSunDir), 0.0), 3.0);
  outgoingLight += uGrassSunColor * back * vGrassH * vGrassH * 0.55;
  outgoingLight *= 0.75 + 0.25 * vGrassH;
}
#include <opaque_fragment>
`;

export class GrassField {
  /**
   * points: [{x,y,z}], palette: { base, tip }
   */
  constructor(points, palette, opts = {}) {
    const count = points.length;
    const geo = new THREE.InstancedBufferGeometry();
    const blade = bladeGeometry();
    geo.index = blade.index;
    geo.setAttribute('position', blade.getAttribute('position'));
    geo.setAttribute('normal', blade.getAttribute('normal'));
    const off = new Float32Array(count * 3);
    const par = new Float32Array(count * 4);
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const p = points[i];
      off[i * 3] = p.x;
      off[i * 3 + 1] = p.y - 0.05;
      off[i * 3 + 2] = p.z;
      par[i * 4] = Math.random() * Math.PI * 2;
      par[i * 4 + 1] = (opts.height ?? 0.5) * (0.5 + Math.random() * 0.75);
      par[i * 4 + 2] = (opts.width ?? 0.085) * (0.7 + Math.random() * 0.6);
      par[i * 4 + 3] = Math.random();
      box.expandByPoint(v.set(p.x, p.y, p.z));
    }
    box.expandByScalar(1.2);
    geo.setAttribute('iOffset', new THREE.InstancedBufferAttribute(off, 3));
    geo.setAttribute('iParams', new THREE.InstancedBufferAttribute(par, 4));
    geo.instanceCount = count;
    geo.boundingBox = box;
    geo.boundingSphere = box.getBoundingSphere(new THREE.Sphere());

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
    const uniforms = {
      uPlayers: WU.uPlayers,
      uGrassTime: WU.uTime,
      uGrassWind: WU.uWind,
      uFadeDist: { value: opts.fadeDist ?? 70 },
      uGrassBase: { value: new THREE.Color(palette.base) },
      uGrassTip: { value: new THREE.Color(palette.tip) },
      uGrassSunColor: WU.uSunColor,
    };
    shade(mat, {
      patch: (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\n' + grassVertPars)
          .replace('#include <begin_vertex>', grassBegin);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + grassFragPars)
          .replace('#include <color_fragment>', grassColor)
          .replace('#include <opaque_fragment>', grassTranslucency);
      },
      key: 'grass',
    });
    this.uniforms = uniforms;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.count = count;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
