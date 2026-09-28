// Pipeline de pós-processamento próprio, um por "view" (tela compartilhada ou cada metade
// da tela dividida). Cena em HDR (half float) com MSAA e textura de profundidade.
import * as THREE from 'three';
import * as S from './shaders/post.js';

const triGeo = new THREE.BufferGeometry();
triGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
triGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function makeRT(w, h, opts = {}) {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });
  rt.texture.generateMipmaps = false;
  return rt;
}

class Pass {
  constructor(frag, uniforms, defines = {}, extra = {}) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: S.fullscreenVert,
      fragmentShader: frag,
      uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      ...extra,
    });
    this.mesh = new THREE.Mesh(triGeo, this.material);
    this.mesh.frustumCulled = false;
  }
  get u() {
    return this.material.uniforms;
  }
  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.render(this.mesh, orthoCam);
  }
}

function solidTexture(r, g, b, a = 255) {
  const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
  t.needsUpdate = true;
  return t;
}
const WHITE = solidTexture(255, 255, 255);
const BLACK = solidTexture(0, 0, 0);

// Parâmetros de "grading" padrão — cada nível sobrescreve o que quiser.
export function defaultGrade() {
  return {
    exposure: 1.0,
    bloomIntensity: 0.9,
    bloomThreshold: 1.0,
    bloomKnee: 0.6,
    bloomRadius: 1.0,
    aoStrength: 0.85,
    aoRadius: 1.4,
    aoIntensity: 1.2,
    godStrength: 0.55,
    godDensity: 0.9,
    godDecay: 0.955,
    godWeight: 0.06,
    godSize: 0.08,
    sunColor: new THREE.Color(1.0, 0.85, 0.6),
    flareIntensity: 0.12,
    ca: 0.012,
    vignette: 0.32,
    grain: 0.025,
    saturation: 1.08,
    contrast: 1.05,
    lift: new THREE.Vector3(0, 0, 0),
    gamma: new THREE.Vector3(1, 1, 1),
    gain: new THREE.Vector3(1, 1, 1),
    tint: new THREE.Vector3(1, 1, 1),
    dofAmount: 0,
    dofMode: 1,
    dofFocus: 10,
    dofRange: 8,
    dofFarStart: 60,
    dofFarEnd: 180,
    dofMaxRadius: 9,
    fade: 0,
    fadeColor: new THREE.Color(0, 0, 0),
    iris: 2.0,
    irisCenter: new THREE.Vector2(0.5, 0.5),
    hit: 0,
    desaturate: 0,
    tonemap: 2,
  };
}

const _sun = new THREE.Vector3();
const _camDir = new THREE.Vector3();

export class PostPipeline {
  constructor(renderer, flags) {
    this.renderer = renderer;
    this.width = 0;
    this.height = 0;
    this.flags = { ...flags };
    this.time = 0;

    this.passes = {
      bloomPre: new Pass(S.bloomDownFrag, {
        tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uClampMax: { value: 64 },
      }, { PREFILTER: 1 }),
      bloomDown: new Pass(S.bloomDownFrag, {
        tSrc: { value: null }, uTexel: { value: new THREE.Vector2() },
        uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uClampMax: { value: 64 },
      }),
      bloomUp: new Pass(S.bloomUpFrag, {
        tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uWeight: { value: 1 },
      }, {}, {
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
      }),
      ao: new Pass(S.aoFrag, {
        tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() }, uProjScale: { value: 1 },
        uResolution: { value: new THREE.Vector2() }, uDepthTexel: { value: new THREE.Vector2() },
        uRadius: { value: 1.2 }, uIntensity: { value: 1 }, uBias: { value: 0.02 },
      }, { AO_SAMPLES: flags.aoSamples || 10 }),
      aoBlur: new Pass(S.aoBlurFrag, { tAO: { value: null }, uDir: { value: new THREE.Vector2() } }),
      godMask: new Pass(S.godMaskFrag, {
        tDepth: { value: null }, tColor: { value: null }, uSunUV: { value: new THREE.Vector2() },
        uAspect: { value: 1 }, uSunColor: { value: new THREE.Color() }, uSize: { value: 0.1 },
      }),
      godBlur: new Pass(S.godBlurFrag, {
        tMask: { value: null }, uSunUV: { value: new THREE.Vector2() }, uDensity: { value: 0.9 },
        uDecay: { value: 0.95 }, uWeight: { value: 0.06 }, uExposure: { value: 1 },
      }),
      dof: new Pass(S.dofFrag, {
        tColor: { value: null }, tDepth: { value: null }, uResolution: { value: new THREE.Vector2() },
        uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 10 }, uRange: { value: 8 },
        uFarStart: { value: 60 }, uFarEnd: { value: 160 }, uMode: { value: 1 }, uMaxRadius: { value: 8 },
      }),
      composite: new Pass(S.compositeFrag, {
        tHDR: { value: null }, tBloom: { value: BLACK }, tAO: { value: WHITE }, tGod: { value: BLACK },
        tDoF: { value: BLACK }, tFlare: { value: BLACK },
        uResolution: { value: new THREE.Vector2() }, uHdrTexel: { value: new THREE.Vector2() },
        uTime: { value: 0 }, uExposure: { value: 1 },
        uBloomIntensity: { value: 1 }, uAOStrength: { value: 1 }, uGodStrength: { value: 1 },
        uDoFAmount: { value: 0 }, uFlareIntensity: { value: 0 }, uCA: { value: 0 }, uVignette: { value: 0.3 },
        uGrain: { value: 0.03 }, uSaturation: { value: 1 }, uContrast: { value: 1 },
        uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) },
        uGain: { value: new THREE.Vector3(1, 1, 1) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
        uSharpen: { value: 0 }, uFadeColor: { value: new THREE.Color() }, uFade: { value: 0 },
        uIrisCenter: { value: new THREE.Vector2(0.5, 0.5) }, uIris: { value: 2 }, uHit: { value: 0 },
        uDesaturate: { value: 0 }, uTonemap: { value: 0 },
      }),
    };
    this.targets = null;
  }

  setFlags(flags) {
    const needRebuild = flags.msaa !== this.flags.msaa || flags.bloomMips !== this.flags.bloomMips;
    if (flags.aoSamples !== this.flags.aoSamples && flags.aoSamples) {
      this.passes.ao.material.defines.AO_SAMPLES = flags.aoSamples;
      this.passes.ao.material.needsUpdate = true;
    }
    this.flags = { ...flags };
    if (needRebuild) this._disposeTargets();
  }

  _disposeTargets() {
    if (!this.targets) return;
    const t = this.targets;
    t.scene.dispose();
    t.scene.depthTexture?.dispose();
    for (const m of t.mips) m.dispose();
    t.ao1.dispose(); t.ao2.dispose(); t.god1.dispose(); t.god2.dispose(); t.dof.dispose();
    this.targets = null;
    this.width = this.height = 0;
  }

  setSize(w, h) {
    w = Math.max(2, Math.floor(w));
    h = Math.max(2, Math.floor(h));
    if (this.targets && w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1);
    if (!this.targets) {
      const depthTexture = new THREE.DepthTexture(w, h);
      depthTexture.type = THREE.UnsignedIntType;
      const scene = makeRT(w, h, { depthBuffer: true, depthTexture, samples: this.flags.msaa || 0 });
      const mips = [];
      const n = this.flags.bloomMips || 6;
      for (let i = 0; i < n; i++) mips.push(makeRT(1, 1));
      this.targets = {
        scene, mips,
        ao1: makeRT(hw, hh), ao2: makeRT(hw, hh),
        god1: makeRT(hw, hh), god2: makeRT(hw, hh),
        dof: makeRT(hw, hh),
      };
    }
    const t = this.targets;
    t.scene.setSize(w, h);
    let mw = w, mh = h;
    for (const m of t.mips) {
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
      m.setSize(mw, mh);
    }
    t.ao1.setSize(hw, hh); t.ao2.setSize(hw, hh);
    t.god1.setSize(hw, hh); t.god2.setSize(hw, hh);
    t.dof.setSize(hw, hh);
  }

  /**
   * Renderiza a cena com pós-processamento dentro do retângulo `vp` (pixels do canvas, origem embaixo).
   */
  render(scene, camera, g, vp, time, opts = {}) {
    const r = this.renderer;
    const t = this.targets;
    const P = this.passes;
    const f = this.flags;
    const prevAutoClear = r.autoClear;
    r.autoClear = false;

    // 1) cena em HDR
    r.setRenderTarget(t.scene);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, false);
    r.render(scene, camera);

    const depthTex = t.scene.depthTexture;
    const hw = t.ao1.width, hh = t.ao1.height;

    // 2) AO
    let aoTex = WHITE;
    if (f.ao && g.aoStrength > 0.001) {
      const u = P.ao.u;
      u.tDepth.value = depthTex;
      u.uProjInv.value.copy(camera.projectionMatrixInverse);
      u.uProjScale.value = camera.projectionMatrix.elements[5] * 0.5 * hh;
      u.uResolution.value.set(hw, hh);
      u.uDepthTexel.value.set(1 / this.width, 1 / this.height);
      u.uRadius.value = g.aoRadius;
      u.uIntensity.value = g.aoIntensity;
      u.uBias.value = 0.03;
      P.ao.render(r, t.ao1);
      P.aoBlur.u.tAO.value = t.ao1.texture;
      P.aoBlur.u.uDir.value.set(1 / hw, 0);
      P.aoBlur.render(r, t.ao2);
      P.aoBlur.u.tAO.value = t.ao2.texture;
      P.aoBlur.u.uDir.value.set(0, 1 / hh);
      P.aoBlur.render(r, t.ao1);
      aoTex = t.ao1.texture;
    }

    // 3) bloom (cadeia de mips)
    let bloomTex = BLACK;
    let flareTex = BLACK;
    if (g.bloomIntensity > 0.001) {
      const mips = t.mips;
      const pre = P.bloomPre.u;
      pre.tSrc.value = t.scene.texture;
      pre.uTexel.value.set(1 / this.width, 1 / this.height);
      pre.uThreshold.value = g.bloomThreshold;
      pre.uKnee.value = g.bloomKnee;
      P.bloomPre.render(r, mips[0]);
      for (let i = 1; i < mips.length; i++) {
        P.bloomDown.u.tSrc.value = mips[i - 1].texture;
        P.bloomDown.u.uTexel.value.set(1 / mips[i - 1].width, 1 / mips[i - 1].height);
        P.bloomDown.render(r, mips[i]);
      }
      // lens flare usa um mip intermediário (antes do upsample acumular)
      if (f.lensFlare && g.flareIntensity > 0.001) flareTex = mips[Math.min(2, mips.length - 1)].texture;
      for (let i = mips.length - 1; i > 0; i--) {
        P.bloomUp.u.tSrc.value = mips[i].texture;
        P.bloomUp.u.uTexel.value.set(1 / mips[i].width, 1 / mips[i].height);
        P.bloomUp.u.uRadius.value = g.bloomRadius;
        P.bloomUp.u.uWeight.value = 1;
        P.bloomUp.render(r, mips[i - 1]);
      }
      bloomTex = mips[0].texture;
    }

    // 4) god rays
    let godTex = BLACK;
    let godStrength = 0;
    if (f.godrays && g.godStrength > 0.001 && opts.sunDir) {
      camera.getWorldDirection(_camDir);
      const facing = _camDir.dot(opts.sunDir);
      if (facing > 0.05) {
        _sun.copy(opts.sunDir).multiplyScalar(800).add(camera.position).project(camera);
        const sx = _sun.x * 0.5 + 0.5, sy = _sun.y * 0.5 + 0.5;
        const edge = Math.max(Math.abs(_sun.x), Math.abs(_sun.y));
        const vis = Math.min(1, (facing - 0.05) * 4) * (1 - Math.min(1, Math.max(0, (edge - 0.9) / 0.9)));
        if (vis > 0.001) {
          const m = P.godMask.u;
          m.tDepth.value = depthTex;
          m.tColor.value = t.scene.texture;
          m.uSunUV.value.set(sx, sy);
          m.uAspect.value = this.width / this.height;
          m.uSunColor.value.copy(g.sunColor);
          m.uSize.value = g.godSize;
          P.godMask.render(r, t.god1);
          const b = P.godBlur.u;
          b.tMask.value = t.god1.texture;
          b.uSunUV.value.set(sx, sy);
          b.uDensity.value = g.godDensity;
          b.uDecay.value = g.godDecay;
          b.uWeight.value = g.godWeight;
          b.uExposure.value = 1;
          P.godBlur.render(r, t.god2);
          godTex = t.god2.texture;
          godStrength = g.godStrength * vis;
        }
      }
    }

    // 5) profundidade de campo
    let dofTex = BLACK;
    let dofAmount = 0;
    if (f.dof && g.dofAmount > 0.001) {
      const d = P.dof.u;
      d.tColor.value = t.scene.texture;
      d.tDepth.value = depthTex;
      d.uResolution.value.set(hw, hh);
      d.uNear.value = camera.near;
      d.uFar.value = camera.far;
      d.uFocus.value = g.dofFocus;
      d.uRange.value = g.dofRange;
      d.uFarStart.value = g.dofFarStart;
      d.uFarEnd.value = g.dofFarEnd;
      d.uMode.value = g.dofMode;
      d.uMaxRadius.value = g.dofMaxRadius;
      P.dof.render(r, t.dof);
      dofTex = t.dof.texture;
      dofAmount = g.dofAmount;
    }

    // 6) composição final direto no canvas (dentro do viewport)
    const c = P.composite.u;
    c.tHDR.value = t.scene.texture;
    c.tBloom.value = bloomTex;
    c.tAO.value = aoTex;
    c.tGod.value = godTex;
    c.tDoF.value = dofTex;
    c.tFlare.value = flareTex;
    c.uResolution.value.set(vp.w, vp.h);
    c.uHdrTexel.value.set(1 / this.width, 1 / this.height);
    c.uTime.value = time;
    c.uExposure.value = g.exposure;
    c.uBloomIntensity.value = g.bloomIntensity / Math.max(1, t.mips.length * 0.5);
    c.uAOStrength.value = aoTex === WHITE ? 0 : g.aoStrength;
    c.uGodStrength.value = godStrength;
    c.uDoFAmount.value = dofAmount;
    c.uFlareIntensity.value = flareTex === BLACK ? 0 : g.flareIntensity;
    c.uCA.value = opts.chromatic === false ? 0 : g.ca;
    c.uVignette.value = g.vignette;
    c.uGrain.value = opts.grain === false ? 0.0 : g.grain;
    c.uSaturation.value = g.saturation;
    c.uContrast.value = g.contrast;
    c.uLift.value.copy(g.lift);
    c.uGamma.value.copy(g.gamma);
    c.uGain.value.copy(g.gain);
    c.uTint.value.copy(g.tint);
    c.uSharpen.value = opts.sharpen || 0;
    c.uFadeColor.value.copy(g.fadeColor);
    c.uFade.value = g.fade;
    c.uIrisCenter.value.copy(g.irisCenter);
    c.uIris.value = g.iris;
    c.uHit.value = g.hit;
    c.uDesaturate.value = g.desaturate;
    c.uTonemap.value = g.tonemap;

    r.setRenderTarget(null);
    r.setViewport(vp.x, vp.y, vp.w, vp.h);
    r.setScissor(vp.x, vp.y, vp.w, vp.h);
    r.setScissorTest(true);
    r.render(P.composite.mesh, orthoCam);
    r.setScissorTest(false);
    r.autoClear = prevAutoClear;
  }

  dispose() {
    this._disposeTargets();
    for (const p of Object.values(this.passes)) p.material.dispose();
  }
}
