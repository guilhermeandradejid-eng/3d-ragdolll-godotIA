// Jogador: controlador de personagem cinemático (Rapier KCC) com "game feel" de plataforma 3D.
//
// Técnicas (referências):
//  - Pulo definido por altura e tempo até o ápice — Kyle Pittman, "Building a Better Jump" (GDC 2016)
//  - Coyote time e buffer de pulo — Maddy Thorson, "Celeste & Forgiveness"
//  - Gravidade maior na queda / pulo variável — Super Mario Bros. / Celeste
//  - Bolha de reviver na co-op — New Super Mario Bros. Wii
import * as THREE from 'three';
import { buildCharacter } from './characters.js';
import { CHARACTER_QUERY, GROUP } from '../world/Physics.js';
import { clamp, damp, dampAngle, wrapAngle, lerp } from '../core/math.js';

const JUMP_APEX_TIME = 0.37;
const FALL_MULT = 1.65;
const CUT_MULT = 2.6;
const TERMINAL = 28;
const COYOTE = 0.11;
const BUFFER = 0.14;
const AIR_ACCEL = 34;
const AIR_DECEL = 8;
const SPIN_TIME = 0.42;
const POUND_HANG = 0.2;
const POUND_SPEED = 32;
const ROLL_TIME = 0.38;
const ROLL_SPEED = 13.5;
const HALF_HEIGHT = 0.3;
const RADIUS = 0.38;
export const PLAYER_CENTER = HALF_HEIGHT + RADIUS; // altura do centro da cápsula acima dos pés

function makeMarker(slot, color) {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 72;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.strokeStyle = 'rgba(20,10,40,0.85)';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(6, 4, 84, 44, 16);
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(36, 46);
  g.lineTo(48, 66);
  g.lineTo(60, 46);
  g.closePath();
  g.fill();
  g.fillStyle = '#1a1030';
  g.font = 'bold 30px Fredoka, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('J' + (slot + 1), 48, 27);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 0.9 });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(0.62, 0.465, 1);
  sp.renderOrder = 40;
  return sp;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _hv = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _desired = { x: 0, y: 0, z: 0 };
const _mv = new THREE.Vector3();

export class Player {
  constructor(world, slot, deviceId, charId) {
    this.world = world;
    this.slot = slot;
    this.deviceId = deviceId;
    this.charId = charId;
    this.rig = buildCharacter(charId);
    this.def = this.rig.def;
    this.stats = this.def.stats;
    this.color = new THREE.Color(this.def.color);
    this.object = this.rig.root;
    world.scene.add(this.object);

    const g = 2 * this.stats.jumpHeight / (JUMP_APEX_TIME * JUMP_APEX_TIME);
    this.gravity = g;
    this.jumpV = g * JUMP_APEX_TIME;
    this.doubleJumpV = Math.sqrt(2 * g * this.stats.doubleJump);

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.facing = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.groundInfo = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.airJumps = 1;
    this.airSpin = true;
    this.floatTime = 0;
    this.action = 'normal';
    this.actionT = 0;
    this.hurtT = 0;
    this.invuln = 0;
    this.hearts = 3;
    this.maxHearts = 3;
    this.lastSafe = new THREE.Vector3();
    this.safeTimer = 0;
    this.fallStartY = 0;
    this.turnRate = 0;
    this.lastLandSpeed = 0;
    this.stats_ = { sparks: 0, stomps: 0, falls: 0, seeds: 0, revives: 0 };
    this.bubbleAnchor = null;
    this.bubbleT = 0;
    this.frozen = false;
    this.celebrate = false;
    this.glow = 0;
    this.stepT = 0;
    this.headBounceCooldown = 0;

    // física
    const phys = world.physics;
    this.collider = phys.capsuleCharacter(HALF_HEIGHT, RADIUS, { x: 0, y: 5, z: 0 });
    phys.tag(this.collider, { type: 'player', player: this });
    const kcc = phys.createController(0.02);
    kcc.setUp({ x: 0, y: 1, z: 0 });
    kcc.setMaxSlopeClimbAngle((52 * Math.PI) / 180);
    kcc.setMinSlopeSlideAngle((48 * Math.PI) / 180);
    kcc.enableAutostep(0.32, 0.12, false);
    kcc.enableSnapToGround(0.28);
    kcc.setApplyImpulsesToDynamicBodies(true);
    kcc.setCharacterMass(2.5 * this.stats.weight);
    kcc.setSlideEnabled(true);
    this.kcc = kcc;

    // luz própria (vaga-lume!)
    this.light = new THREE.PointLight(this.rig.def.glow, 0, 9, 1.6);
    this.light.position.y = 1.0;
    this.object.add(this.light);

    // sombra "blob" (ajuda a leitura de profundidade, como em Mario 64/Odyssey)
    this.blob = world.makeBlobShadow();
    world.scene.add(this.blob);

    // marcador "J1..J4" acima da cabeça (visível através do cenário)
    this.marker = makeMarker(slot, this.def.color);
    this.marker.position.y = 2.25;
    this.object.add(this.marker);
  }

  get input() {
    return this.world.game.input.device(this.deviceId);
  }

  get alive() {
    return this.action !== 'bubble' && this.action !== 'gone';
  }

  get feet() {
    return this.position;
  }

  get center() {
    return _v2.set(this.position.x, this.position.y + PLAYER_CENTER, this.position.z);
  }

  spawn(pos, facing = 0) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.facing = facing;
    this.lastSafe.copy(pos);
    this.action = 'normal';
    this.actionT = 0;
    this.grounded = false;
    this.groundInfo = null;
    this.collider.setEnabled(true);
    this.collider.setTranslation({ x: pos.x, y: pos.y + PLAYER_CENTER, z: pos.z });
    this.object.visible = true;
    this.object.position.copy(pos);
    this.object.rotation.y = facing;
    this.rig.visual.rotation.set(0, 0, 0);
    this.invuln = 1.0;
  }

  // Direção de movimento relativa à câmera deste jogador.
  wishDir(out) {
    const inp = this.input;
    if (!inp) return out.set(0, 0, 0);
    const cam = this.world.cameraFor(this);
    const fwd = _v.set(0, 0, -1).applyQuaternion(cam.quaternion);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const rx = -fwd.z, rz = fwd.x;
    out.set(rx * inp.move.x + fwd.x * inp.move.y, 0, rz * inp.move.x + fwd.z * inp.move.y);
    const m = Math.min(1, out.length());
    if (m > 1e-3) out.multiplyScalar(m / out.length());
    return out;
  }

  setAction(a) {
    this.action = a;
    this.actionT = 0;
  }

  update(dt) {
    const inp = this.input;
    const w = this.world;
    this.actionT += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.headBounceCooldown = Math.max(0, this.headBounceCooldown - dt);

    if (this.action === 'bubble') {
      this.updateBubble(dt);
      this.updateVisual(dt);
      return;
    }
    if (this.action === 'gone') return;

    const controllable = !this.frozen && inp && this.action !== 'hurt' && !this.celebrate;
    this.wishDir(_wish);
    if (!controllable) _wish.set(0, 0, 0);
    const wishLen = _wish.length();

    // ---- timers de pulo
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    if (controllable && inp.pressed.jump) this.jumpBuffer = BUFFER;
    if (this.grounded) this.coyote = COYOTE;
    const jumpHeld = controllable && inp.jump;

    // ---- ações iniciadas pelo jogador
    if (controllable) {
      if (inp.pressed.spin && (this.action === 'normal' || this.action === 'doubleJump' || this.action === 'longJump' || this.action === 'bounce')) {
        this.startSpin();
      }
      if (inp.pressed.pound) {
        if (!this.grounded && (this.action === 'normal' || this.action === 'doubleJump' || this.action === 'spin' || this.action === 'longJump')) this.startPound();
        else if (this.grounded && this.action === 'normal') this.startRoll();
      }
    }

    // ---- aceleração horizontal
    const hv = _hv.set(this.velocity.x, 0, this.velocity.z);
    let maxSpeed = this.stats.speed;
    let target = _tgt.copy(_wish).multiplyScalar(maxSpeed);
    if (this.action === 'roll') {
      const f = Math.sin(this.facing), c = Math.cos(this.facing);
      target.set(f, 0, c).multiplyScalar(ROLL_SPEED * (1 - this.actionT / ROLL_TIME * 0.35));
      if (wishLen > 0.2) {
        // leve direção durante o rolamento
        const ang = Math.atan2(_wish.x, _wish.z);
        this.facing = dampAngle(this.facing, ang, 4, dt);
      }
    }
    if (this.action === 'poundStart' || this.action === 'poundFall') target.set(0, 0, 0);
    let accel;
    if (this.grounded) {
      if (wishLen > 0.05) {
        accel = this.stats.accel;
        // viradas rápidas (derrapagem controlada)
        if (hv.dot(target) < 0) accel *= 1.6 * this.stats.traction + 0.4;
      } else accel = this.stats.decel;
      if (this.action === 'roll') accel = 80;
    } else {
      accel = wishLen > 0.05 ? AIR_ACCEL : AIR_DECEL;
      if (this.action === 'longJump') accel *= 0.35;
    }
    if (this.action === 'poundStart' || this.action === 'poundFall') accel = 200;
    const dx = target.x - hv.x, dz = target.z - hv.z;
    const dl = Math.hypot(dx, dz);
    const step = accel * dt;
    if (dl <= step) {
      hv.x = target.x;
      hv.z = target.z;
    } else {
      hv.x += (dx / dl) * step;
      hv.z += (dz / dl) * step;
    }
    // limita velocidade horizontal (exceto pulo longo)
    const hs = Math.hypot(hv.x, hv.z);
    const cap = this.action === 'longJump' || this.action === 'roll' ? ROLL_SPEED * 1.05 : maxSpeed * 1.25;
    if (hs > cap) {
      hv.x *= cap / hs;
      hv.z *= cap / hs;
    }

    // ---- orientação
    const prevFacing = this.facing;
    if (wishLen > 0.1 && this.action !== 'roll' && this.action !== 'poundStart' && this.action !== 'poundFall') {
      const ang = Math.atan2(_wish.x, _wish.z);
      this.facing = dampAngle(this.facing, ang, this.grounded ? 16 : 9, dt);
    }
    this.turnRate = damp(this.turnRate, wrapAngle(this.facing - prevFacing) / Math.max(dt, 1e-4), 10, dt);

    // ---- vertical
    let vy = this.velocity.y;
    let g = this.gravity;
    let floating = false;
    if (this.action === 'poundStart') {
      vy = 0;
      g = 0;
      if (this.actionT >= POUND_HANG) {
        this.setAction('poundFall');
        vy = -POUND_SPEED;
      }
    } else if (this.action === 'poundFall') {
      vy = -POUND_SPEED;
      g = 0;
    } else {
      if (vy < 0) g *= FALL_MULT;
      else if (!jumpHeld && this.jumpHeld && this.action !== 'bounce') g *= CUT_MULT;
      if (this.action === 'spin' && !this.grounded) g *= 0.45;
      // Nuvi: planar com o guarda-chuva
      if (this.stats.float && !this.grounded && jumpHeld && vy < 0 && this.floatTime < 1.6) {
        floating = true;
        this.floatTime += dt;
        g = this.gravity * 0.25;
        vy = Math.max(vy, -2.4);
      }
    }
    this.floating = floating;
    const vy0 = vy;
    vy -= g * dt;
    vy = Math.max(vy, -TERMINAL);

    // ---- pulos
    if (controllable && this.jumpBuffer > 0 && this.action !== 'poundStart' && this.action !== 'poundFall') {
      if (this.grounded || this.coyote > 0) {
        this.doJump(this.action === 'roll');
        vy = this.velocity.y;
        if (this.action === 'longJump') {
          const f = Math.sin(this.facing), c = Math.cos(this.facing);
          const sp = Math.max(ROLL_SPEED, hs);
          hv.x = f * sp;
          hv.z = c * sp;
        }
      } else if (this.airJumps > 0 && inp.pressed.jump) {
        this.airJumps--;
        this.jumpBuffer = 0;
        vy = this.doubleJumpV;
        this.setAction('doubleJump');
        this.floatTime = 0;
        w.onPlayerEvent(this, 'doubleJump');
        this.rig.impulse(3.5);
      }
    }
    this.jumpHeld = jumpHeld;

    // ---- plataformas móveis: carrega o jogador junto
    this.applyPlatformCarry(dt);

    // ---- movimento via KCC
    const dy = (vy0 + vy) * 0.5 * dt; // integração pelo ponto médio (altura de pulo independe do fps)
    _desired.x = hv.x * dt;
    _desired.y = dy;
    _desired.z = hv.z * dt;
    const kcc = this.kcc;
    kcc.computeColliderMovement(this.collider, _desired, undefined, CHARACTER_QUERY, (c) => {
      const info = w.physics.infoOf(c);
      return !info || info.solid !== false;
    });
    const mv = kcc.computedMovement();
    _mv.set(mv.x, mv.y, mv.z);
    const cur = this.collider.translation();
    this.collider.setTranslation({ x: cur.x + mv.x, y: cur.y + mv.y, z: cur.z + mv.z });
    this.position.set(cur.x + mv.x, cur.y + mv.y - PLAYER_CENTER, cur.z + mv.z);

    // paredes: corrige velocidade horizontal
    const desH = Math.hypot(_desired.x, _desired.z);
    const actH = Math.hypot(_mv.x, _mv.z);
    if (desH > 1e-5 && actH < desH * 0.98) {
      hv.x = _mv.x / dt;
      hv.z = _mv.z / dt;
    }
    // teto
    if (_desired.y > 0 && _mv.y < _desired.y * 0.5) vy = Math.min(vy, 0);

    // ---- chão
    this.wasGrounded = this.grounded;
    this.grounded = kcc.computedGrounded() && vy <= 0.01;
    this.groundInfo = null;
    let groundCollider = null;
    for (let i = 0; i < kcc.numComputedCollisions(); i++) {
      const c = kcc.computedCollision(i);
      if (c && c.collider && c.normal1.y > 0.45) {
        groundCollider = c.collider;
        this.groundNormal.set(c.normal1.x, c.normal1.y, c.normal1.z);
      }
    }
    if (this.grounded && !groundCollider) {
      const hit = w.physics.raycast(_v2.set(this.position.x, this.position.y + 0.3, this.position.z), { x: 0, y: -1, z: 0 }, 0.7);
      if (hit) {
        groundCollider = hit.collider;
        this.groundNormal.copy(hit.normal);
      }
    }
    if (this.grounded && groundCollider) this.groundInfo = w.physics.infoOf(groundCollider) || null;

    if (this.grounded) {
      if (!this.wasGrounded) this.onLand(-vy0);
      vy = 0;
      this.airJumps = 1;
      this.airSpin = true;
      this.floatTime = 0;
      if (this.action === 'longJump' || this.action === 'doubleJump' || this.action === 'bounce') this.setAction('normal');
      // último ponto seguro (para reaparecer após queda)
      const gi = this.groundInfo;
      if (!gi || (!gi.moving && !gi.hazard && !gi.crumble)) {
        this.safeTimer += dt;
        if (this.safeTimer > 0.25) this.lastSafe.copy(this.position);
      } else this.safeTimer = 0;
    } else {
      this.safeTimer = 0;
      if (this.wasGrounded && vy <= 0) this.fallStartY = this.position.y;
    }

    this.velocity.set(hv.x, vy, hv.z);
    if (this.grounded && this.groundInfo && this.groundInfo.onStand) this.groundInfo.onStand(this, dt);

    // ---- fim de ações temporizadas
    if (this.action === 'spin' && this.actionT > SPIN_TIME) this.setAction('normal');
    if (this.action === 'doubleJump' && this.actionT > 0.45) this.setAction('normal');
    if (this.action === 'roll' && this.actionT > ROLL_TIME) this.setAction('normal');
    if (this.action === 'poundLand' && this.actionT > 0.22) this.setAction('normal');
    if (this.action === 'hurt' && this.actionT > 0.55) this.setAction('normal');
    if (this.action === 'roll' && !this.grounded && this.actionT > 0.08) this.setAction('normal');

    // passos
    if (this.grounded && hs > 1.5) {
      this.stepT -= dt * hs * 0.55;
      if (this.stepT <= 0) {
        this.stepT = 1;
        w.onPlayerEvent(this, 'step');
      }
    }

    // queda no vazio
    if (this.position.y < w.level.killY) w.onPlayerFell(this);

    this.updateVisual(dt);
  }

  // O controlador do Rapier já leva o personagem junto com a velocidade do corpo cinemático
  // (translação e rotação). Aqui só giramos a orientação junto com plataformas giratórias.
  applyPlatformCarry() {
    const gi = this.groundInfo;
    if (!this.grounded || !gi || !gi.platform) return;
    this.facing += gi.platform.deltaYaw || 0;
  }

  doJump(fromRoll) {
    const w = this.world;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.grounded = false;
    // herda um pouco o movimento da plataforma
    const gi = this.groundInfo;
    if (gi && gi.platform && gi.platform.velocity) {
      this.velocity.x += gi.platform.velocity.x * 0.8;
      this.velocity.z += gi.platform.velocity.z * 0.8;
    }
    if (fromRoll) {
      this.velocity.y = this.jumpV * 0.72;
      this.setAction('longJump');
      w.onPlayerEvent(this, 'longJump');
    } else {
      this.velocity.y = this.jumpV;
      if (this.action !== 'spin') this.setAction('normal');
      w.onPlayerEvent(this, 'jump');
    }
    this.rig.impulse(4.2);
  }

  startSpin() {
    if (!this.grounded) {
      if (!this.airSpin) return;
      this.airSpin = false;
      this.velocity.y = Math.max(this.velocity.y, 5.5);
    }
    this.setAction('spin');
    this.world.onPlayerEvent(this, 'spin');
  }

  startPound() {
    this.setAction('poundStart');
    this.velocity.set(0, 0, 0);
    this.world.onPlayerEvent(this, 'poundStart');
  }

  startRoll() {
    this.setAction('roll');
    this.world.onPlayerEvent(this, 'roll');
    this.rig.impulse(-2);
  }

  onLand(impact) {
    const w = this.world;
    this.lastLandSpeed = impact;
    if (this.action === 'poundFall') {
      this.setAction('poundLand');
      w.onPlayerPound(this);
      this.rig.impulse(-9);
      return;
    }
    const k = clamp(impact / 20, 0.15, 1);
    this.rig.impulse(-k * 7);
    if (impact > 6) w.onPlayerEvent(this, 'land', k);
  }

  // Quicar (cabeça de inimigo ou de outro jogador, cogumelos)
  bounce(v, keepAction = false) {
    const held = this.input?.jump;
    this.velocity.y = held ? v * 1.18 : v;
    this.grounded = false;
    this.coyote = 0;
    this.airJumps = 1;
    this.airSpin = true;
    this.floatTime = 0;
    this.jumpHeld = true;
    if (!keepAction) this.setAction('bounce');
    this.rig.impulse(4);
  }

  hurt(fromPos, amount = 1) {
    if (this.invuln > 0 || this.action === 'bubble' || this.celebrate) return false;
    this.hearts = Math.max(0, this.hearts - amount);
    this.invuln = 1.6;
    this.setAction('hurt');
    _v.copy(this.position).sub(fromPos);
    _v.y = 0;
    if (_v.lengthSq() < 1e-4) _v.set(Math.sin(this.facing), 0, Math.cos(this.facing)).negate();
    _v.normalize().multiplyScalar(7.5);
    this.velocity.set(_v.x, 8.5, _v.z);
    this.grounded = false;
    this.rig.hurtFlash();
    this.world.onPlayerHurt(this);
    return true;
  }

  // ---- bolha (co-op)
  enterBubble(anchor) {
    this.setAction('bubble');
    this.bubbleAnchor = anchor;
    this.bubbleT = 0;
    this.velocity.set(0, 0, 0);
    this.collider.setEnabled(false);
    this.world.showBubble(this, true);
  }

  updateBubble(dt) {
    this.bubbleT += dt;
    const w = this.world;
    let anchor = this.bubbleAnchor;
    if (!anchor || !anchor.alive) anchor = this.bubbleAnchor = w.nearestAlive(this.position, this);
    if (anchor) {
      _v.copy(anchor.position);
      _v.y += 2.3;
      _v.x += Math.sin(this.bubbleT * 1.3 + this.slot) * 1.2;
      _v.z += Math.cos(this.bubbleT * 1.1 + this.slot) * 1.2;
      const d = _v.distanceTo(this.position);
      const speed = clamp(d * 1.6, 2, 26);
      if (d > 0.01) this.position.addScaledVector(_v.sub(this.position).normalize(), Math.min(d, speed * dt));
      this.position.y += Math.sin(this.bubbleT * 3) * 0.004;
      // estoura ao encostar num amigo, ou sozinha depois de um tempo perto dele
      const near = this.position.distanceTo(anchor.position) < 3.4;
      if (this.bubbleT > 0.6) {
        for (const p of w.players) {
          if (p === this || !p.alive) continue;
          const c = p.position;
          const dist = Math.hypot(c.x - this.position.x, c.y + 0.7 - (this.position.y + 0.7), c.z - this.position.z);
          if (dist < 1.5) {
            this.popBubble(p);
            return;
          }
        }
      }
      if (near && anchor.grounded && this.bubbleT > 3.2) this.popBubble(anchor);
      if (this.input?.pressed.jump && near && this.bubbleT > 1.2 && anchor.grounded) this.popBubble(anchor);
    }
    this.object.position.copy(this.position);
  }

  popBubble(by) {
    const w = this.world;
    this.action = 'normal';
    this.actionT = 0;
    if (this.hearts <= 0) this.hearts = this.maxHearts;
    const pos = this.position.clone();
    // procura chão abaixo para não reaparecer no vazio
    const hit = w.physics.raycast(_v.set(pos.x, pos.y + 0.5, pos.z), { x: 0, y: -1, z: 0 }, 8);
    if (!hit && by) pos.copy(by.position).add(_v2.set(0, 1.5, 0));
    this.collider.setEnabled(true);
    this.collider.setTranslation({ x: pos.x, y: pos.y + PLAYER_CENTER, z: pos.z });
    this.velocity.set(0, 7, 0);
    this.invuln = 1.5;
    this.world.showBubble(this, false);
    if (by && by !== this) by.stats_.revives++;
    w.onPlayerEvent(this, 'bubblePop');
  }

  updateVisual(dt) {
    const o = this.object;
    o.position.copy(this.position);
    o.rotation.y = this.facing;
    const hs = Math.hypot(this.velocity.x, this.velocity.z);
    this.rig.update(dt, {
      speed: this.action === 'bubble' ? 0 : hs,
      maxSpeed: this.stats.speed,
      grounded: this.grounded || this.action === 'bubble',
      vy: this.velocity.y,
      action: this.action,
      actionT: this.actionT,
      turn: this.turnRate,
      floating: this.floating,
      celebrate: this.celebrate,
    });
    // piscar durante invulnerabilidade
    if (this.invuln > 0 && this.action !== 'bubble') o.visible = Math.floor(this.invuln * 14) % 2 === 0;
    else o.visible = true;
    // marcador acompanha a cambalhota/escala sem girar junto
    this.marker.position.y = this.action === 'bubble' ? 2.6 : 2.25 + Math.sin(this.rig.t * 3) * 0.05;
    this.marker.visible = this.world.players.length > 1;

    // luz própria
    const night = this.world.env.playerLight ?? 0.4;
    const target = (this.world.game.settings.preset.playerLights ? night : 0) * (1 + this.glow);
    this.light.intensity = damp(this.light.intensity, target * 3, 6, dt);

    // sombra blob
    const b = this.blob;
    if (this.action === 'bubble') {
      b.visible = false;
    } else {
      const hit = this.world.physics.raycast(_v.set(this.position.x, this.position.y + 0.4, this.position.z), { x: 0, y: -1, z: 0 }, 30);
      if (hit) {
        b.visible = true;
        b.position.copy(hit.point);
        b.position.y += 0.03;
        const h = this.position.y - hit.point.y;
        const s = clamp(1.1 - h * 0.04, 0.35, 1.1);
        b.scale.setScalar(s * 0.95);
        b.material.opacity = clamp(0.5 - h * 0.02, 0.12, 0.5);
        _v2.copy(hit.normal);
        b.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, _v2);
      } else b.visible = false;
    }
  }

  dispose() {
    const w = this.world;
    w.scene.remove(this.object);
    w.scene.remove(this.blob);
    w.physics.remove(this.collider);
    w.physics.world.removeCharacterController(this.kcc);
    this.object.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.marker.material.map.dispose();
    this.marker.material.dispose();
  }
}
