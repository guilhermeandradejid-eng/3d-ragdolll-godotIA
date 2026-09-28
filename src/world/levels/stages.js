// Cenário da seleção de personagens: ilhota com quatro pedestais ao amanhecer.
import * as THREE from 'three';
import { M } from '../../render/WorldShading.js';

// posições X dos pedestais: alinhadas às colunas dos cartões da interface
export const LOBBY_X = [-5.9, -1.97, 1.97, 5.9];

export const LOBBY_STAGE = {
  id: 'lobby',
  name: 'Seleção',
  subtitle: '',
  env: 'dawn',
  seed: 5,
  killY: -100,
  grassDensity: 12,
  backdrop: { center: [0, 0, -40], minDist: 120, spread: 120, count: 14, y: 0 },
  build(b) {
    b.island(0, 0, -1, { radius: 12, depth: 11, seed: 8, flowers: 60, sx: 1.1, sz: 0.8 });
    const colors = ['#ff8a2a', '#6ab7ff', '#63c24a', '#ff4fa3'];
    const xs = LOBBY_X;
    xs.forEach((x, i) => {
      b.addMesh(new THREE.CylinderGeometry(0.95, 1.1, 0.7, 24), b.mats.stone, x, 0.27, 0.5);
      const ringMat = M.basic(new THREE.Color(colors[i]).multiplyScalar(2.2), {}, { fog: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 8, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 0.62, 0.5);
      b.group.add(ring);
    });
    b.tree(-8, 0, -4, 1.2, { collide: false });
    b.tree(7.5, 0, -5, 1.0, { collide: false });
    b.tree(-3, 0, -8, 1.3, { collide: false });
    b.tree(3.5, 0, -9, 1.1, { collide: false });
    b.windmill(10, 0, -9, -0.5);
    b.cloudDeco(-16, 4, -22, 5);
    b.cloudDeco(18, 7, -28, 6);
    b.spawn(0, 0.5, 4);
    b.setRoute([[0, 0, 10], [0, 0, -10]]);
  },
};
