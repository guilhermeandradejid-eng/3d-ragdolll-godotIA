// Invólucro fino sobre o Rapier (WASM): mundo, colisores estáticos/cinemáticos,
// consultas (raycast) e o mapeamento colisor -> dados de jogo.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export const GROUP = {
  STATIC: 1 << 0,
  PLATFORM: 1 << 1,
  PLAYER: 1 << 2,
  ENEMY: 1 << 3,
  PROP: 1 << 4,
  DEBRIS: 1 << 5,
  SENSOR: 1 << 6,
};

export const groups = (member, filter) => ((member & 0xffff) << 16) | (filter & 0xffff);

// Grupo usado pelas consultas dos personagens: colide com cenário, plataformas e objetos físicos.
export const CHARACTER_QUERY = groups(GROUP.PLAYER, GROUP.STATIC | GROUP.PLATFORM | GROUP.PROP);
export const WORLD_QUERY = groups(0xffff, GROUP.STATIC | GROUP.PLATFORM);

let ready = null;
export function initPhysics() {
  if (!ready) ready = RAPIER.init();
  return ready;
}

const ZERO = new THREE.Vector3();
const IDENTITY = new THREE.Quaternion();
const _ray = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: -1, z: 0 } };

export class Physics {
  constructor() {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -24, z: 0 });
    this.world.timestep = 1 / 60;
    this.info = new Map(); // collider.handle -> dados de jogo
    this.rayObj = new RAPIER.Ray(_ray.origin, _ray.dir);
  }

  tag(collider, data) {
    this.info.set(collider.handle, data);
    return collider;
  }

  infoOf(collider) {
    return collider ? this.info.get(collider.handle) : undefined;
  }

  addFixedBody(pos, quat) {
    pos = pos || ZERO;
    quat = quat || IDENTITY;
    return this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z).setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
  }

  addKinematicBody(pos, quat) {
    pos = pos || ZERO;
    quat = quat || IDENTITY;
    return this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }),
    );
  }

  addDynamicBody(pos, quat, opts = {}) {
    quat = quat || IDENTITY;
    const d = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(opts.linearDamping ?? 0.2)
      .setAngularDamping(opts.angularDamping ?? 0.4);
    if (opts.ccd) d.setCcdEnabled(true);
    return this.world.createRigidBody(d);
  }

  _finish(desc, body, data, group, opts = {}) {
    desc.setCollisionGroups(groups(group, opts.filter ?? 0xffff));
    desc.setFriction(opts.friction ?? 0.8);
    desc.setRestitution(opts.restitution ?? 0.0);
    if (opts.density !== undefined) desc.setDensity(opts.density);
    if (opts.sensor) desc.setSensor(true);
    const c = this.world.createCollider(desc, body);
    if (data) this.tag(c, data);
    return c;
  }

  // Trimesh a partir de uma BufferGeometry (já em espaço de mundo, ou relativo ao corpo).
  trimeshFromGeometry(geometry, matrix, body, data, group = GROUP.STATIC) {
    const g = geometry.index ? geometry : geometry;
    const pos = g.getAttribute('position');
    const verts = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (matrix) v.applyMatrix4(matrix);
      verts[i * 3] = v.x;
      verts[i * 3 + 1] = v.y;
      verts[i * 3 + 2] = v.z;
    }
    let idx;
    if (g.index) idx = new Uint32Array(g.index.array);
    else {
      idx = new Uint32Array(pos.count);
      for (let i = 0; i < pos.count; i++) idx[i] = i;
    }
    const desc = RAPIER.ColliderDesc.trimesh(verts, idx);
    return this._finish(desc, body ?? this.addFixedBody(), data, group);
  }

  box(halfExtents, pos, quat, body, data, group = GROUP.STATIC, opts = {}) {
    const desc = opts.round
      ? RAPIER.ColliderDesc.roundCuboid(halfExtents.x - opts.round, halfExtents.y - opts.round, halfExtents.z - opts.round, opts.round)
      : RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z);
    if (body) {
      if (pos) desc.setTranslation(pos.x, pos.y, pos.z);
      if (quat) desc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
      return this._finish(desc, body, data, group, opts);
    }
    return this._finish(desc, this.addFixedBody(pos, quat), data, group, opts);
  }

  cylinder(halfHeight, radius, pos, quat, body, data, group = GROUP.STATIC, opts = {}) {
    const desc = RAPIER.ColliderDesc.cylinder(halfHeight, radius);
    if (body) {
      if (pos) desc.setTranslation(pos.x, pos.y, pos.z);
      if (quat) desc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
      return this._finish(desc, body, data, group, opts);
    }
    return this._finish(desc, this.addFixedBody(pos, quat), data, group, opts);
  }

  ball(radius, pos, body, data, group = GROUP.STATIC, opts = {}) {
    const desc = RAPIER.ColliderDesc.ball(radius);
    if (body) {
      if (pos) desc.setTranslation(pos.x, pos.y, pos.z);
      return this._finish(desc, body, data, group, opts);
    }
    return this._finish(desc, this.addFixedBody(pos), data, group, opts);
  }

  convexHull(points, body, data, group = GROUP.STATIC, opts = {}) {
    const desc = RAPIER.ColliderDesc.convexHull(points);
    if (!desc) return null;
    return this._finish(desc, body ?? this.addFixedBody(), data, group, opts);
  }

  // Colisor "sem corpo" controlado diretamente (personagens).
  capsuleCharacter(halfHeight, radius, pos) {
    const desc = RAPIER.ColliderDesc.capsule(halfHeight, radius)
      .setTranslation(pos.x, pos.y, pos.z)
      .setCollisionGroups(groups(GROUP.PLAYER, GROUP.PROP | GROUP.DEBRIS));
    return this.world.createCollider(desc);
  }

  createController(offset = 0.02) {
    return this.world.createCharacterController(offset);
  }

  /** Raycast. Retorna { toi, point, normal, collider, info } ou null. */
  raycast(origin, dir, maxDist, filterGroups = WORLD_QUERY, excludeCollider, predicate) {
    const r = this.rayObj;
    r.origin.x = origin.x; r.origin.y = origin.y; r.origin.z = origin.z;
    r.dir.x = dir.x; r.dir.y = dir.y; r.dir.z = dir.z;
    const hit = this.world.castRayAndGetNormal(r, maxDist, true, undefined, filterGroups, excludeCollider, undefined, predicate);
    if (!hit) return null;
    return {
      toi: hit.timeOfImpact,
      point: new THREE.Vector3(origin.x + dir.x * hit.timeOfImpact, origin.y + dir.y * hit.timeOfImpact, origin.z + dir.z * hit.timeOfImpact),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider,
      info: this.infoOf(hit.collider),
    };
  }

  step(dt) {
    this.world.timestep = dt;
    this.world.step();
  }

  remove(collider) {
    if (!collider) return;
    this.info.delete(collider.handle);
    this.world.removeCollider(collider, true);
  }

  removeBody(body) {
    if (!body) return;
    for (let i = 0; i < body.numColliders(); i++) this.info.delete(body.collider(i).handle);
    this.world.removeRigidBody(body);
  }

  dispose() {
    this.world.free();
    this.info.clear();
  }
}
