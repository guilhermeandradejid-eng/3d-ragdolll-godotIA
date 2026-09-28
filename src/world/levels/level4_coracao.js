// Final — O Coração do Eclipse
// Arena no topo do Grande Farol, sob o sol eclipsado. Luta contra Nox.
import * as THREE from 'three';
import { M } from '../../render/WorldShading.js';

export default {
  id: 'coracao',
  index: 3,
  name: 'O Coração do Eclipse',
  subtitle: 'Final',
  env: 'eclipse',
  music: 'chefe',
  introMusic: 'none',
  seed: 97,
  killY: -14,
  final: true,
  grassDensity: 0,
  backdrop: { center: [0, 0, 0], minDist: 150, spread: 140, count: 16, y: -10, bare: true },
  camera: { minDist: 22, maxDist: 36, defaultPitch: 0.4 },
  build(b, V) {
    const m = b.mats;
    // arena (topo do Grande Farol)
    b.addMesh(new THREE.CylinderGeometry(16.5, 16, 1.6, 64), m.darkStone, 0, -0.8, 0);
    b.world.physics.cylinder(0.8, 16.5, V(0, -0.8, 0), null, null, { type: 'ground', surface: 'stone' });
    // anel de mosaico no piso
    const inlay = M.physical('#d8a444', { metalness: 0.9, roughness: 0.3, emissive: '#6a4a10', emissiveIntensity: 0.4 });
    for (const r of [5, 10, 14.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 6, 96), inlay);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      ring.receiveShadow = true;
      b.group.add(ring);
    }
    // mureta quebrada
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      if (i % 7 === 3 || i % 7 === 4) continue;
      const h = 0.6 + ((i * 37) % 10) / 12;
      b.block(Math.cos(a) * 16.1, h, Math.sin(a) * 16.1, { w: 1.2, h: h + 0.1, d: 3.2, mat: 'stone', yaw: -a, collide: true });
    }
    // torre do Grande Farol descendo até as nuvens
    const white = M.standard('#efe7da', { roughness: 0.6 }, { variation: { amount: 0.15, scale: 1 } });
    const red = M.standard('#c23a36', { roughness: 0.55 }, { variation: { amount: 0.15, scale: 1 } });
    for (let i = 0; i < 7; i++) {
      const y0 = -1.6 - i * 9;
      const g = new THREE.CylinderGeometry(15.4 - i * 0.2, 15.6 - i * 0.2, 9, 48);
      b.addMesh(g, i % 2 ? red : white, 0, y0 - 4.5, 0, { cast: false });
    }
    // braseiro central (apagado até a Chama voltar)
    const bowlPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      bowlPts.push(new THREE.Vector2(0.6 + Math.sin(t * Math.PI * 0.5) * 2.1, t * 1.2));
    }
    b.addMesh(new THREE.LatheGeometry(bowlPts, 32), m.brass, 0, 1.2, 0);
    b.addMesh(new THREE.CylinderGeometry(0.9, 1.5, 1.2, 24), m.darkStone, 0, 0.6, 0);
    b.world.physics.cylinder(1.2, 2.5, V(0, 1.2, 0), null, null, { type: 'ground', surface: 'metal' });
    b.world.brazierPos = new THREE.Vector3(0, 2.8, 0);
    // pilares com lanternas nos quatro cantos
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 13, z = Math.sin(a) * 13;
      b.block(x, 3.5, z, { w: 1.4, h: 3.5, d: 1.4, mat: 'darkStone' });
      const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), m.crystalPink);
      lamp.position.set(x, 4.1, z);
      b.group.add(lamp);
    }
    // destroços e engrenagens flutuando ao redor
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const d = 24 + (i % 3) * 7;
      b.rock(Math.cos(a) * d, -4 + (i % 4) * 5, Math.sin(a) * d, 1.5 + (i % 3), { mat: 'darkStone' });
    }
    b.gearDeco(-22, 6, -18, 5, 'z', 0.2, 'brass', { cast: false });
    b.gearDeco(24, 2, -12, 4, 'z', -0.25, 'copper', { cast: false });
    b.gearDeco(0, 14, -34, 7, 'z', 0.12, 'brass', { cast: false });

    b.spawn(-2.5, 0.4, 10, Math.PI);
    b.spawn(2.5, 0.4, 10, Math.PI);
    b.spawn(-5, 0.4, 11.5, Math.PI);
    b.spawn(5, 0.4, 11.5, Math.PI);
    b.heart(-9, 1.2, 6);
    b.heart(9, 1.2, 6);
    b.sparksCircle([0, 0.9, 0], 7.5, 16);
    b.sparksCircle([0, 0.9, 0], 12, 22);
    b.checkpoint(0, 0, 13.5, Math.PI);

    b.boss(0, 0, 0);
    b.setRoute([[0, 0, 22, { dist: 24, pitch: 0.4 }], [0, 0, -22, { dist: 24, pitch: 0.4 }]]);
  },
};
