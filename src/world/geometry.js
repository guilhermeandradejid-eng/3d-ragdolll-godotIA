// Geradores de geometria procedural para o cenário.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createNoise, rng, TAU } from '../core/math.js';

const N = createNoise(4242);

/**
 * Ilha flutuante: topo quase plano (caminhável) com ondulações suaves, borda arredondada
 * e base rochosa em forma de cone irregular com "estalactites".
 */
export function islandGeometry({
  radius = 8, depth = 7, seed = 1, rimNoise = 0.16, bump = 0.22, segments = 72, rings = 28,
  sx = 1, sz = 1, lip = 0.7, spikes = 5,
} = {}) {
  const topRings = 9;
  const positions = [];
  const idx = [];
  const R = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return radius * (1 + rimNoise * N.fbm2(c * 1.3 + seed * 7.1, s * 1.3 + seed * 3.3, 3) * 1.6);
  };
  const topH = (x, z) => bump * N.fbm2(x * 0.09 + seed, z * 0.09 - seed, 3) * 2 - 0.08 * ((x * x) / (radius * radius) + (z * z) / (radius * radius));
  // vértice central do topo
  positions.push(0, topH(0, 0), 0);
  const ringStart = [];
  const totalRings = topRings + rings;
  const r2 = rng(seed * 991 + 7);
  const spikeAngles = Array.from({ length: spikes }, () => r2() * TAU);
  for (let ri = 1; ri <= totalRings; ri++) {
    ringStart.push(positions.length / 3);
    for (let si = 0; si < segments; si++) {
      const a = (si / segments) * TAU;
      const rr = R(a);
      const c = Math.cos(a), s = Math.sin(a);
      let x, y, z;
      if (ri <= topRings) {
        const t = ri / topRings;
        const r = rr * Math.pow(t, 0.9);
        x = c * r * sx;
        z = s * r * sz;
        y = topH(x, z);
        if (ri === topRings) y -= 0.02;
      } else {
        const u = (ri - topRings) / rings; // 0..1 descendo pela base
        // borda arredondada
        let rad, yy;
        if (u < 0.12) {
          const k = u / 0.12;
          rad = rr * (1 + 0.04 * Math.sin(k * Math.PI));
          yy = -lip * (1 - Math.cos(k * Math.PI * 0.5));
        } else {
          const k = (u - 0.12) / 0.88;
          rad = rr * Math.pow(1 - k, 0.85) * (1 + 0.04);
          yy = -lip - (depth - lip) * Math.pow(k, 1.1);
          // protuberâncias rochosas
          const n = N.noise3(c * 2.2 + seed, yy * 0.35, s * 2.2 - seed);
          rad *= 1 + 0.22 * n * Math.sin(k * Math.PI);
          yy += N.noise3(c * 3 - seed, k * 4, s * 3) * 0.6 * k;
          // "estalactites" pontudas
          for (const sa of spikeAngles) {
            let da = Math.abs(a - sa);
            da = Math.min(da, TAU - da);
            if (da < 0.35) yy -= (1 - da / 0.35) * k * k * depth * 0.45;
          }
        }
        x = c * rad * sx;
        z = s * rad * sz;
        y = yy + topH(c * rr * sx, s * rr * sz) * (u < 0.12 ? 1 : 0.3);
      }
      positions.push(x, y, z);
    }
  }
  // ponta inferior
  const tipIndex = positions.length / 3;
  positions.push(N.noise2(seed, 1) * 0.5, -depth * 1.05, N.noise2(1, seed) * 0.5);
  // topo: leque central
  const first = ringStart[0];
  for (let si = 0; si < segments; si++) idx.push(0, first + ((si + 1) % segments), first + si);
  for (let ri = 0; ri < totalRings - 1; ri++) {
    const a0 = ringStart[ri], b0 = ringStart[ri + 1];
    for (let si = 0; si < segments; si++) {
      const s1 = (si + 1) % segments;
      idx.push(a0 + si, a0 + s1, b0 + si);
      idx.push(a0 + s1, b0 + s1, b0 + si);
    }
  }
  const last = ringStart[totalRings - 1];
  for (let si = 0; si < segments; si++) idx.push(last + si, last + ((si + 1) % segments), tipIndex);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

export function rockGeometry(radius = 1, detail = 1, amp = 0.25, seed = 1, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = N.noise3(v.x * 1.7 / radius + seed, v.y * 1.7 / radius, v.z * 1.7 / radius - seed);
    v.multiplyScalar(1 + n * amp);
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return g;
}

// Pilar de pedra com topo plano (degraus/"stepping stones")
export function pillarGeometry(radius = 1.2, height = 6, seed = 1, sides = 9) {
  const g = new THREE.CylinderGeometry(radius, radius * 0.72, height, sides, 6, false);
  g.translate(0, -height / 2, 0);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    if (v.y < -0.05) {
      const a = Math.atan2(v.z, v.x);
      const n = N.noise3(Math.cos(a) * 2 + seed, v.y * 0.4, Math.sin(a) * 2);
      const k = 1 + n * 0.18;
      v.x *= k;
      v.z *= k;
      if (v.y < -height + 0.01) v.y -= Math.abs(N.noise2(seed, i)) * 1.5;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Nuvem "fofa": várias esferas com normais suavizadas para fora.
export function cloudGeometry(size = 2, seed = 1, flat = 0.55) {
  const r = rng(seed * 17 + 3);
  const geos = [];
  const n = 7 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = r() * size * 0.8;
    const rad = size * (0.35 + r() * 0.4) * (1 - d / (size * 1.6));
    const g = new THREE.IcosahedronGeometry(rad, 2);
    g.translate(Math.cos(a) * d, (r() - 0.3) * size * 0.25, Math.sin(a) * d * 0.8);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  merged.scale(1, flat, 1);
  const p = merged.getAttribute('position');
  const nrm = merged.getAttribute('normal');
  const v = new THREE.Vector3();
  const nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.y *= 1.6;
    v.normalize();
    nn.fromBufferAttribute(nrm, i).lerp(v, 0.6).normalize();
    nrm.setXYZ(i, nn.x, nn.y, nn.z);
  }
  return merged;
}

// Árvore estilizada: tronco curvado + copa de "bolhas" com normais esféricas (visual Ghibli)
export function treeGeometry(seed = 1, height = 4, canopy = 2.2) {
  const r = rng(seed * 31 + 5);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.3, 0),
    new THREE.Vector3((r() - 0.5) * 0.5, height * 0.4, (r() - 0.5) * 0.5),
    new THREE.Vector3((r() - 0.5) * 0.9, height * 0.8, (r() - 0.5) * 0.9),
    new THREE.Vector3((r() - 0.5) * 0.8, height, (r() - 0.5) * 0.8),
  ]);
  const trunk = new THREE.TubeGeometry(curve, 10, 0.28, 8, false);
  // afina o tronco para cima
  const tp = trunk.getAttribute('position');
  const v = new THREE.Vector3();
  const pts = curve.getSpacedPoints(10);
  for (let i = 0; i < tp.count; i++) {
    v.fromBufferAttribute(tp, i);
    const seg = Math.floor(i / 9);
    const c = pts[Math.min(seg, pts.length - 1)];
    const k = 1 - (seg / 10) * 0.55;
    v.sub(c).multiplyScalar(k).add(c);
    tp.setXYZ(i, v.x, v.y, v.z);
  }
  trunk.computeVertexNormals();
  trunk.deleteAttribute('uv');
  const top = pts[pts.length - 1];
  const blobs = [];
  const n = 4 + Math.floor(r() * 3);
  const cc = new THREE.Vector3(top.x, top.y + canopy * 0.35, top.z);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r();
    const d = canopy * (0.35 + r() * 0.3);
    const rad = canopy * (0.55 + r() * 0.3);
    const g = new THREE.IcosahedronGeometry(rad, 2);
    g.translate(cc.x + Math.cos(a) * d, cc.y + (r() - 0.4) * canopy * 0.5, cc.z + Math.sin(a) * d);
    blobs.push(g);
  }
  const topBlob = new THREE.IcosahedronGeometry(canopy * 0.8, 2);
  topBlob.translate(cc.x, cc.y + canopy * 0.55, cc.z);
  blobs.push(topBlob);
  const crown = mergeGeometries(blobs);
  crown.deleteAttribute('uv');
  const p = crown.getAttribute('position');
  const nrm = crown.getAttribute('normal');
  const col = new Float32Array(p.count * 3);
  const nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // ruído na superfície (copa irregular)
    const dn = v.clone().sub(cc).normalize();
    const nz = N.noise3(v.x * 0.9 + seed, v.y * 0.9, v.z * 0.9);
    v.addScaledVector(dn, nz * 0.25);
    p.setXYZ(i, v.x, v.y, v.z);
    nn.fromBufferAttribute(nrm, i).lerp(dn, 0.7).normalize();
    nrm.setXYZ(i, nn.x, nn.y, nn.z);
    const h = (v.y - (cc.y - canopy)) / (canopy * 2.2);
    const shadeK = 0.55 + Math.min(1, Math.max(0, h)) * 0.6;
    col[i * 3] = shadeK;
    col[i * 3 + 1] = shadeK;
    col[i * 3 + 2] = shadeK;
  }
  crown.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { trunk, crown, top: cc };
}

// Pinheiro estilizado (cones empilhados)
export function pineGeometry(seed = 1, height = 5) {
  const r = rng(seed * 13 + 1);
  const trunk = new THREE.CylinderGeometry(0.15, 0.25, height * 0.35, 7);
  trunk.translate(0, height * 0.175 - 0.2, 0);
  trunk.deleteAttribute('uv');
  const cones = [];
  const layers = 3 + Math.floor(r() * 2);
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const rad = (1 - t * 0.7) * height * 0.28;
    const c = new THREE.ConeGeometry(rad, height * 0.38, 9, 1);
    c.translate(0, height * 0.3 + t * height * 0.55, 0);
    c.rotateY(r() * TAU);
    cones.push(c);
  }
  const crown = mergeGeometries(cones);
  crown.deleteAttribute('uv');
  return { trunk, crown };
}

// Cristal hexagonal com ponta
export function crystalGeometry(height = 2, radius = 0.4, sides = 6, tip = 0.6) {
  const pts = [
    new THREE.Vector2(0.001, -0.2),
    new THREE.Vector2(radius, 0),
    new THREE.Vector2(radius * 0.92, height),
    new THREE.Vector2(0.001, height + radius * tip * 2.2),
  ];
  const g = new THREE.LatheGeometry(pts, sides);
  g.deleteAttribute('uv');
  return g.toNonIndexed();
}

export function crystalCluster(seed = 1, scale = 1) {
  const r = rng(seed * 7 + 11);
  const geos = [];
  const n = 3 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const h = (0.8 + r() * 1.8) * scale;
    const g = crystalGeometry(h, (0.18 + r() * 0.18) * scale);
    g.rotateZ((r() - 0.5) * 0.9);
    g.rotateX((r() - 0.5) * 0.9);
    g.translate((r() - 0.5) * 0.8 * scale, 0, (r() - 0.5) * 0.8 * scale);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  merged.computeVertexNormals();
  return merged;
}

export function mushroomGeometry(capR = 1, stemH = 1.2, stemR = 0.25) {
  const stem = new THREE.CylinderGeometry(stemR * 0.8, stemR, stemH, 12, 3);
  stem.translate(0, stemH / 2, 0);
  stem.deleteAttribute('uv');
  const capPts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const a = t * Math.PI * 0.5;
    capPts.push(new THREE.Vector2(Math.max(0.001, Math.cos(a) * capR), Math.sin(a) * capR * 0.62));
  }
  capPts.unshift(new THREE.Vector2(capR * 0.3, -capR * 0.08));
  capPts.unshift(new THREE.Vector2(0.001, -capR * 0.06));
  const cap = new THREE.LatheGeometry(capPts.reverse(), 24);
  cap.translate(0, stemH, 0);
  cap.deleteAttribute('uv');
  return { stem, cap };
}

// Engrenagem extrudada (plataformas da Cidadela)
export function gearGeometry(outer = 3, inner = 2.6, teeth = 14, thickness = 0.6, hole = 0.6) {
  const shape = new THREE.Shape();
  const steps = teeth * 4;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * TAU;
    const phase = i % 4;
    const r = phase === 0 || phase === 3 ? inner : outer;
    const aa = a + (phase === 1 ? -0.03 : phase === 2 ? 0.03 : 0);
    const x = Math.cos(aa) * r, y = Math.sin(aa) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  if (hole > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, TAU, true);
    shape.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -thickness / 2, 0);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// Contorno de estrela de 4 pontas (centelhas) extrudado
export function sparkGeometry(size = 0.36) {
  const s = new THREE.Shape();
  const pts = 8;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * TAU + Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.34;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: size * 0.25, bevelEnabled: true, bevelThickness: size * 0.12, bevelSize: size * 0.08, bevelSegments: 2 });
  g.center();
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

export function heartGeometry(size = 0.45) {
  const s = new THREE.Shape();
  const x = 0, y = 0;
  s.moveTo(x, y + size * 0.35);
  s.bezierCurveTo(x, y + size * 0.35, x - size * 0.1, y + size * 0.85, x - size * 0.55, y + size * 0.85);
  s.bezierCurveTo(x - size * 1.15, y + size * 0.85, x - size * 1.1, y + size * 0.15, x - size * 1.1, y + size * 0.15);
  s.bezierCurveTo(x - size * 1.1, y - size * 0.25, x - size * 0.6, y - size * 0.7, x, y - size * 1.05);
  s.bezierCurveTo(x + size * 0.6, y - size * 0.7, x + size * 1.1, y - size * 0.25, x + size * 1.1, y + size * 0.15);
  s.bezierCurveTo(x + size * 1.1, y + size * 0.15, x + size * 1.15, y + size * 0.85, x + size * 0.55, y + size * 0.85);
  s.bezierCurveTo(x + size * 0.1, y + size * 0.85, x, y + size * 0.35, x, y + size * 0.35);
  const g = new THREE.ExtrudeGeometry(s, { depth: size * 0.35, bevelEnabled: true, bevelThickness: size * 0.18, bevelSize: size * 0.15, bevelSegments: 3 });
  g.center();
  g.scale(0.5, 0.5, 0.5);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

// Tábua de madeira com leve irregularidade
export function plankGeometry(w, h, d, seed) {
  const g = new THREE.BoxGeometry(w, h, d, 2, 1, 1);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    p.setY(i, p.getY(i) + N.noise2(p.getX(i) * 2 + seed, p.getZ(i) * 2) * 0.03);
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return g;
}

export function flowerGeometry(petalColorIndex = 0) {
  const stem = new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5);
  stem.translate(0, 0.2, 0);
  const head = new THREE.IcosahedronGeometry(0.08, 0);
  head.scale(1.3, 0.5, 1.3);
  head.translate(0, 0.42, 0);
  const center = new THREE.IcosahedronGeometry(0.035, 0);
  center.translate(0, 0.45, 0);
  for (const g of [stem, head, center]) g.deleteAttribute('uv');
  const colors = [];
  const add = (g, c) => {
    const n = g.getAttribute('position').count;
    for (let i = 0; i < n; i++) colors.push(c[0], c[1], c[2]);
  };
  const petal = [[1, 0.55, 0.75], [1, 0.9, 0.4], [0.75, 0.6, 1], [1, 1, 1], [1, 0.5, 0.35]][petalColorIndex % 5];
  add(stem, [0.3, 0.6, 0.25]);
  add(head, petal);
  add(center, [1, 0.85, 0.3]);
  const ni = (g) => (g.index ? g.toNonIndexed() : g);
  const m = mergeGeometries([ni(stem), ni(head), ni(center)]);
  m.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  m.computeVertexNormals();
  return m;
}

// Linha de corda (catenária) entre dois pontos
export function ropeGeometry(a, b, sag = 0.6, radius = 0.05) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= Math.sin(t * Math.PI) * sag;
    pts.push(p);
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, radius, 5, false);
  g.deleteAttribute('uv');
  return g;
}

export { mergeGeometries };
