// Colecionáveis: Centelhas (instanciadas, centenas por nível), Sementes de Luz (3 por nível)
// e corações.
import * as THREE from 'three';
import { sparkGeometry, heartGeometry } from '../world/geometry.js';
import { shade } from '../render/WorldShading.js';
import { PLAYER_CENTER } from './Player.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

export class SparkField {
  constructor(world, positions, dynamicSlots = 48) {
    this.world = world;
    const n = positions.length + dynamicSlots;
    this.n = n;
    this.total = positions.length;
    this.pos = positions.map((p) => p.clone());
    for (let i = 0; i < dynamicSlots; i++) this.pos.push(new THREE.Vector3());
    this.state = new Uint8Array(n); // 0 ativo, 1 voando p/ jogador, 2 coletado
    this.dynamic = new Uint8Array(n);
    for (let i = positions.length; i < n; i++) {
      this.state[i] = 2;
      this.dynamic[i] = 1;
    }
    this.fly = new Float32Array(n);
    this.target = new Array(n).fill(null);
    this.phase = this.pos.map((_, i) => i * 0.37);
    const mat = shade(
      new THREE.MeshStandardMaterial({
        color: '#ffd76a', emissive: '#ffb22e', emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.25,
      }),
      { rim: { color: '#fff3c0', power: 2, strength: 1.2 } },
    );
    this.mesh = new THREE.InstancedMesh(sparkGeometry(0.34), mat, Math.max(1, n));
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.scene.add(this.mesh);
    this.t = 0;
    this.update(0);
  }

  update(dt) {
    this.t += dt;
    const w = this.world;
    const players = w.players;
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st === 2) {
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      const p = this.pos[i];
      if (st === 0) {
        // ímã: atrai quando um jogador chega perto
        for (const pl of players) {
          if (!pl.alive) continue;
          const dx = pl.position.x - p.x, dy = pl.position.y + PLAYER_CENTER - p.y, dz = pl.position.z - p.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 1.15 * 1.15) {
            this.collect(i, pl);
            break;
          }
          if (d2 < 2.4 * 2.4) {
            this.state[i] = 1;
            this.target[i] = pl;
            this.fly[i] = 0;
            break;
          }
        }
      } else if (st === 1) {
        const pl = this.target[i];
        this.fly[i] += dt;
        _p.set(pl.position.x, pl.position.y + PLAYER_CENTER, pl.position.z);
        const k = Math.min(1, dt * (8 + this.fly[i] * 30));
        p.lerp(_p, k);
        if (p.distanceTo(_p) < 0.5 || this.fly[i] > 0.6) this.collect(i, pl);
      }
      if (this.state[i] === 2) continue;
      const bob = st === 0 ? Math.sin(this.t * 2.5 + this.phase[i]) * 0.12 : 0;
      const sc = st === 1 ? Math.max(0.3, 1 - this.fly[i] * 1.2) : 1;
      _q.setFromEuler(_e.set(0, this.t * 2.2 + this.phase[i] * 0.3, 0));
      _s.setScalar(sc);
      _p.set(p.x, p.y + bob, p.z);
      _m.compose(_p, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  collect(i, player) {
    this.state[i] = 2;
    this.world.onCollectSpark(player, this.pos[i]);
  }

  // Centelhas soltas (de inimigos/caixas): adiciona dinamicamente reaproveitando slots coletados
  spawnAt(pos, count = 3) {
    let spawned = 0;
    for (let i = 0; i < this.n && spawned < count; i++) {
      if (this.state[i] !== 2 || !this.dynamic[i]) continue;
      this.state[i] = 0;
      this.pos[i].copy(pos).add(_p.set((Math.random() - 0.5) * 1.6, 0.8 + Math.random(), (Math.random() - 0.5) * 1.6));
      spawned++;
    }
    return spawned;
  }

  dispose() {
    this.world.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}

// Semente de Luz — o grande colecionável de cada nível
export class LightSeed {
  constructor(world, pos, index, alreadyHave) {
    this.world = world;
    this.index = index;
    this.pos = pos.clone();
    this.taken = false;
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 3),
      new THREE.MeshStandardMaterial({ color: '#fff7d6', emissive: alreadyHave ? '#8fb7ff' : '#ffe38a', emissiveIntensity: alreadyHave ? 2 : 5, roughness: 0.2 }),
    );
    const shellMat = shade(new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0, clearcoat: 1, depthWrite: false,
    }), { rim: { color: alreadyHave ? '#b8d0ff' : '#fff0b0', power: 2, strength: 2.5 } });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 3), shellMat);
    const leafMat = shade(new THREE.MeshStandardMaterial({ color: '#7be07a', emissive: '#3fae3a', emissiveIntensity: 0.6, side: THREE.DoubleSide }));
    const leafG = new THREE.SphereGeometry(0.22, 12, 8);
    leafG.scale(1.6, 0.2, 0.8);
    const l1 = new THREE.Mesh(leafG, leafMat);
    l1.position.set(0.25, 0.62, 0);
    l1.rotation.z = 0.6;
    const l2 = new THREE.Mesh(leafG, leafMat);
    l2.position.set(-0.25, 0.66, 0);
    l2.rotation.z = -0.6;
    g.add(core, shell, l1, l2);
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.03, 8, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(alreadyHave ? '#9ab8ff' : '#ffe38a').multiplyScalar(3) }),
    );
    g.add(this.ring);
    g.position.copy(pos);
    this.object = g;
    this.light = new THREE.PointLight(alreadyHave ? '#9ab8ff' : '#ffd36a', 6, 8, 2);
    g.add(this.light);
    world.scene.add(g);
    this.t = Math.random() * 5;
  }

  update(dt) {
    if (this.taken) return;
    this.t += dt;
    const o = this.object;
    o.position.y = this.pos.y + Math.sin(this.t * 2) * 0.2;
    o.rotation.y += dt * 1.2;
    this.ring.rotation.x = Math.PI / 2 + Math.sin(this.t * 1.3) * 0.5;
    this.ring.rotation.y = this.t * 0.8;
    if (Math.random() < dt * 8) this.world.effects.trail(_p.copy(o.position).add(_s.set((Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6)), '#ffe38a', 0.18, 3);
    for (const pl of this.world.players) {
      if (!pl.alive) continue;
      if (pl.center.distanceTo(o.position) < 1.35) {
        this.taken = true;
        o.visible = false;
        this.world.onCollectSeed(pl, this);
        break;
      }
    }
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}

export class HeartPickup {
  constructor(world, pos) {
    this.world = world;
    this.pos = pos.clone();
    this.taken = false;
    const mat = shade(new THREE.MeshPhysicalMaterial({ color: '#ff3f6c', emissive: '#ff1f4f', emissiveIntensity: 0.8, roughness: 0.2, clearcoat: 1 }), {
      rim: { color: '#ffc0d0', power: 2.5, strength: 0.9 },
    });
    this.object = new THREE.Mesh(heartGeometry(0.45), mat);
    this.object.castShadow = true;
    this.object.position.copy(pos);
    world.scene.add(this.object);
    this.t = Math.random() * 3;
  }

  update(dt) {
    if (this.taken) return;
    this.t += dt;
    this.object.rotation.y += dt * 2;
    this.object.position.y = this.pos.y + Math.sin(this.t * 3) * 0.12;
    for (const pl of this.world.players) {
      if (!pl.alive) continue;
      if (pl.center.distanceTo(this.object.position) < 1.2) {
        this.taken = true;
        this.object.visible = false;
        this.world.onCollectHeart(pl, this);
        break;
      }
    }
  }

  dispose() {
    this.world.scene.remove(this.object);
  }
}
