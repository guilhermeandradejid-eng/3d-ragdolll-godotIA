// Luz do sol com sombra que acompanha a ação (com "texel snapping" para não tremer)
// + luz hemisférica de preenchimento.
import * as THREE from 'three';
import { WU } from './WorldShading.js';

const _m = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Lighting {
  constructor(scene, preset) {
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.intensity = 1;
    this.extent = 30;
    this.distance = 120;
    this.configureShadow(preset);
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0xe8b58f, 0.6);
    scene.add(this.hemi);
  }

  configureShadow(preset) {
    const s = this.sun.shadow;
    const size = preset.shadowSize;
    if (s.mapSize.x !== size) {
      s.mapSize.set(size, size);
      if (s.map) {
        s.map.dispose();
        s.map = null;
      }
    }
    s.radius = preset.shadowRadius;
    this.setExtent(this.extent);
  }

  setExtent(e) {
    this.extent = e;
    const c = this.sun.shadow.camera;
    c.left = -e;
    c.right = e;
    c.top = e;
    c.bottom = -e;
    c.near = 1;
    c.far = this.distance * 2 + 60;
    c.updateProjectionMatrix();
  }

  apply(cfg) {
    this.sun.color.set(cfg.sunColor);
    this.sun.intensity = cfg.sunIntensity;
    this.hemi.color.set(cfg.hemiSky);
    this.hemi.groundColor.set(cfg.hemiGround);
    this.hemi.intensity = cfg.hemiIntensity;
    this.sun.shadow.intensity = cfg.shadowIntensity ?? 1;
  }

  // Centraliza a sombra no ponto de interesse, alinhado à grade de texels.
  follow(focus, extent) {
    if (Math.abs(extent - this.extent) > 1.5) this.setExtent(extent);
    const dir = WU.uSunDir.value;
    _m.lookAt(_zero, _p.copy(dir).negate(), THREE.Object3D.DEFAULT_UP);
    _right.setFromMatrixColumn(_m, 0);
    _up.setFromMatrixColumn(_m, 1);
    _fwd.setFromMatrixColumn(_m, 2);
    const texel = (this.extent * 2) / this.sun.shadow.mapSize.x;
    let x = focus.dot(_right), y = focus.dot(_up);
    const z = focus.dot(_fwd);
    x = Math.round(x / texel) * texel;
    y = Math.round(y / texel) * texel;
    _p.set(0, 0, 0).addScaledVector(_right, x).addScaledVector(_up, y).addScaledVector(_fwd, z);
    this.sun.target.position.copy(_p);
    this.sun.position.copy(_p).addScaledVector(dir, this.distance);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();
  }
}
