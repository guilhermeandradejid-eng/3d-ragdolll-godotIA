// Capítulo 3 — Cidadela do Eclipse
// Crepúsculo eterno sob o sol eclipsado: engrenagens giratórias, pêndulos com espinhos,
// pistões que sobem e descem, tábuas que desmoronam e o maior Véu de Sombra.
import * as THREE from 'three';

function structures(b, x, y, z, rad, r) {
  // torres distantes da cidadela no horizonte
  if (r() < 0.6) {
    const h = 20 + r() * 30;
    b.addMesh(new THREE.CylinderGeometry(rad * 0.18, rad * 0.24, h, 10), b.mats.darkStone, x, y + h / 2, z, { cast: false });
    b.addMesh(new THREE.ConeGeometry(rad * 0.3, rad * 0.4, 10), b.mats.brick, x, y + h + rad * 0.2, z, { cast: false });
  }
}

export default {
  id: 'cidadela',
  index: 2,
  name: 'Cidadela do Eclipse',
  subtitle: 'Capítulo 3',
  env: 'eclipse',
  music: 'cidadela',
  seed: 31,
  killY: -18,
  grassDensity: 6,
  grassHeight: 0.4,
  backdrop: { center: [0, 10, -80], minDist: 140, spread: 150, count: 16, y: 0, bare: true, structures },
  build(b) {
    // ---------------------------------------------------------- A: praça de entrada
    b.island(0, 0, 0, { radius: 11, depth: 12, seed: 61, flowers: 12, rocks: 2 });
    b.spawn(-1.6, 0.4, 5, Math.PI);
    b.spawn(1.6, 0.4, 5, Math.PI);
    b.spawn(-3.2, 0.4, 6.6, Math.PI);
    b.spawn(3.2, 0.4, 6.6, Math.PI);
    b.arch(0, 0, -7.5, 0, 6, 6, 'darkStone');
    b.banner(-4.5, 0, -6, 0, '#7a2a8a');
    b.banner(4.5, 0, -6, 0, '#7a2a8a');
    b.gearDeco(-9, 6, -3, 3, 'z', 0.4, 'brass', { yaw: 0.6 });
    b.gearDeco(9.5, 7, 2, 2.4, 'z', -0.6, 'copper', { yaw: -0.5 });
    b.sign(2.8, 0, -1, -0.3, 'Engrenagens giram — e levam você junto! Pule de uma para outra no ritmo certo.');
    b.sparksLine([0, 1, 2], [0, 1, -9], 5);

    // ---------------------------------------------------------- B: engrenagens giratórias
    b.moving({ shape: 'gear', radius: 4.2, pos: [0, 0.3, -17], path: [[0, 0.3, -17]], rotateSpeed: 0.5 });
    b.moving({ shape: 'gear', radius: 3.6, pos: [6.5, 1.3, -26.5], path: [[6.5, 1.3, -26.5]], rotateSpeed: -0.7 });
    b.moving({ shape: 'gear', radius: 4.2, pos: [0.5, 2.3, -36.5], path: [[0.5, 2.3, -36.5]], rotateSpeed: 0.6 });
    b.sparksCircle([0, 1.4, -17], 3, 8);
    b.sparksCircle([6.5, 2.4, -26.5], 2.5, 6);
    b.sparksCircle([0.5, 3.4, -36.5], 3, 8);
    b.gearDeco(-8, -2, -24, 5, 'z', 0.25, 'brass', { cast: false });

    // ---------------------------------------------------------- C: praça do relógio + pêndulos
    b.island(0, 3, -51, { radius: 10.5, depth: 11, seed: 63, flowers: 10 });
    b.checkpoint(-3.5, 3, -43.5, 0.3);
    b.tower(-8, 17, -55, { r: 2, h: 14 });
    b.tower(8.5, 13, -48, { r: 1.6, h: 10 });
    b.enemy('sombrinha', 2, 3, -50, { patrol: [[2, 3, -50], [-4, 3, -54]] });
    b.enemy('sombrinha', -2, 3, -46, { patrol: [[-2, 3, -46], [4, 3, -45]] });
    b.sign(3, 3, -44, -0.3, 'Pêndulos à frente! Observe o ritmo e passe quando a lâmina estiver longe.');
    b.block(0, 3, -69, { w: 4, h: 1.6, d: 18, mat: 'darkStone' });
    b.pendulum(0, 11, -63, { length: 6.4, amp: 1.05, speed: 1.6, phase: 0, yaw: 0 });
    b.pendulum(0, 11, -69, { length: 6.4, amp: 1.05, speed: 1.6, phase: 1.3, yaw: 0 });
    b.pendulum(0, 11, -75, { length: 6.4, amp: 1.05, speed: 1.6, phase: 2.6, yaw: 0 });
    for (const zz of [-63, -69, -75]) {
      b.block(-6.6, 11.6, zz, { w: 0.8, h: 11, d: 0.8, mat: 'darkStone' });
      b.block(6.6, 11.6, zz, { w: 0.8, h: 11, d: 0.8, mat: 'darkStone' });
      b.block(0, 11.8, zz, { w: 14, h: 0.6, d: 0.9, mat: 'darkStone', collide: false });
    }
    b.sparksLine([0, 3.8, -61], [0, 3.8, -77], 8);
    // Semente 2: saliência lateral atrás dos pêndulos
    b.block(6.5, 3.8, -72, { w: 2.5, h: 1, d: 2.5, mat: 'darkStone' });
    b.seed(6.5, 5.2, -72, 1);

    // ---------------------------------------------------------- D: pistões
    b.block(0, 3, -81, { w: 5, h: 1.6, d: 4, mat: 'darkStone' });
    b.moving({ shape: 'stone', size: [3, 0.8, 3], path: [[0, 3, -85.5], [0, 6.5, -85.5]], speed: 2.2, wait: 1.1 });
    b.moving({ shape: 'stone', size: [3, 0.8, 3], path: [[3.8, 7.5, -90], [3.8, 4.5, -90]], speed: 2.2, wait: 1.1 });
    b.moving({ shape: 'stone', size: [3, 0.8, 3], path: [[0, 6.5, -94.5], [0, 10, -94.5]], speed: 2.2, wait: 1.1, phase: 0.8 });
    b.enemy('mariposa', 2, 11, -90, { radius: 3, speed: 1.2 });
    // Semente 1: topo de uma torre alcançada pelo último pistão
    b.tower(-5.5, 13.5, -96, { r: 1.6, h: 16, roof: false });
    b.seed(-5.5, 15, -96, 0);
    b.sparksLine([0, 4.5, -85.5], [0, 11, -94.5], 6);

    // ---------------------------------------------------------- E: praça do Véu
    b.island(0, 11, -109, { radius: 11, depth: 12, seed: 67, flowers: 10 });
    b.checkpoint(3.5, 11, -100.5, -0.3);
    b.tower(-8.5, 23, -112, { r: 1.8, h: 12 });
    b.tower(8.5, 23, -114, { r: 1.8, h: 12 });
    b.enemy('espinhela', -5, 11, -107, { path: [[-5, 11, -107], [5, 11, -108]], speed: 3 });
    b.enemy('mariposa', 0, 14.5, -112, { radius: 3.5, speed: -1 });
    b.block(0, 11, -124, { w: 6, h: 1.6, d: 6, mat: 'darkStone' });
    b.veil(0, 11, -120.7, 0, 7, 6);
    b.sparksCircle([0, 11.8, -109], 4, 10);

    // ---------------------------------------------------------- F: tábuas e engrenagem final
    b.crumble(0, 11.5, -130.5);
    b.crumble(-2.8, 12, -135.5);
    b.moving({ shape: 'gear', radius: 3.8, pos: [0, 12.2, -143], path: [[0, 12.2, -143]], rotateSpeed: 0.8 });
    b.crumble(2.6, 12.8, -150);
    b.sparksLine([0, 12.5, -130.5], [2.6, 13.8, -150], 7);
    // Semente 3: engrenagem alta alcançada por cogumelo na praça
    b.pad(-6, 11, -104.5, { power: 25, pink: true });
    b.moving({ shape: 'gear', radius: 2.4, pos: [-10, 19, -110], path: [[-10, 19, -110]], rotateSpeed: -0.9 });
    b.seed(-10, 20.6, -110, 2);

    // ---------------------------------------------------------- G: Torre do Relógio (farol)
    b.island(0, 13, -165, { radius: 12, depth: 13, seed: 71, flowers: 12 });
    b.goal(0, 13, -171, 0, { stripe: '#6a3a8a' });
    b.banner(-5, 13, -158, 0, '#ffb347');
    b.banner(5, 13, -158, 0, '#ffb347');
    b.gearDeco(-11, 22, -170, 4, 'z', 0.3, 'brass');
    b.enemy('sombrinha', -3, 13, -160, { patrol: [[-3, 13, -160], [4, 13, -162]] });

    b.setRoute([
      [0, 0, 10], [0, 0, -10], [0, 0.3, -17], [6.5, 1.3, -26.5], [0.5, 2.3, -36.5],
      [0, 3, -50], [0, 3, -80], [0, 7, -94], [0, 11, -108], [0, 11, -124],
      [0, 12.5, -143], [0, 13, -160], [0, 13, -178],
    ]);
  },
};
