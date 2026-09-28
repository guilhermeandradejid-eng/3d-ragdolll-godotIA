// Gerencia o WebGLRenderer, o tamanho do canvas, resolução dinâmica e as "views"
// (uma para a câmera compartilhada, até quatro na tela dividida).
import * as THREE from 'three';
import { PostPipeline } from './PostFX.js';
import { clamp } from '../core/math.js';

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    const r = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: true,
      powerPreference: 'high-performance',
    });
    r.setPixelRatio(1);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.autoClear = false;
    r.info.autoReset = false;
    this.renderer = r;
    this.gl = r.getContext();

    this.pipelines = [];
    this.dynScale = 1;
    this._ftAvg = 1 / 60;
    this._dynTimer = 0;
    this.width = 1;
    this.height = 1;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    settings.onChange((key) => {
      if (key === 'quality') this.applyQuality();
      if (key === 'dynamicRes' && !settings.dynamicRes) this.dynScale = 1;
    });
  }

  get preset() {
    return this.settings.preset;
  }

  get dpr() {
    return Math.min(window.devicePixelRatio || 1, this.preset.maxDpr);
  }

  applyQuality() {
    const p = this.preset;
    for (const pipe of this.pipelines) pipe.setFlags(p);
    this.resize();
  }

  resize() {
    const dpr = this.dpr;
    const w = Math.max(2, Math.floor(window.innerWidth * dpr));
    const h = Math.max(2, Math.floor(window.innerHeight * dpr));
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  // Retângulos (pixels, origem inferior esquerda) para n views.
  layout(n) {
    const W = this.width, H = this.height;
    const hw = Math.floor(W / 2), hh = Math.floor(H / 2);
    const gap = Math.max(2, Math.round(3 * this.dpr));
    if (n <= 1) return [{ x: 0, y: 0, w: W, h: H }];
    if (n === 2) {
      return [
        { x: 0, y: 0, w: hw - gap / 2, h: H },
        { x: hw + gap / 2, y: 0, w: W - hw - gap / 2, h: H },
      ];
    }
    const cells = [
      { x: 0, y: hh + gap / 2, w: hw - gap / 2, h: H - hh - gap / 2 },
      { x: hw + gap / 2, y: hh + gap / 2, w: W - hw - gap / 2, h: H - hh - gap / 2 },
      { x: 0, y: 0, w: hw - gap / 2, h: hh - gap / 2 },
      { x: hw + gap / 2, y: 0, w: W - hw - gap / 2, h: hh - gap / 2 },
    ];
    return cells.slice(0, n);
  }

  pipeline(i) {
    while (this.pipelines.length <= i) this.pipelines.push(new PostPipeline(this.renderer, this.preset));
    return this.pipelines[i];
  }

  // Resolução dinâmica: mantém ~60 fps reduzindo a escala interna.
  updateDynamicResolution(frameDt) {
    if (!this.settings.dynamicRes) {
      this.dynScale = 1;
      return;
    }
    this._ftAvg += (Math.min(frameDt, 0.1) - this._ftAvg) * 0.05;
    this._dynTimer += frameDt;
    if (this._dynTimer < 0.75) return;
    this._dynTimer = 0;
    const ms = this._ftAvg * 1000;
    if (ms > 19.5) this.dynScale = clamp(this.dynScale - 0.08, 0.5, 1);
    else if (ms < 15.5) this.dynScale = clamp(this.dynScale + 0.04, 0.5, 1);
  }

  clearScreen(color = 0x07060f) {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setViewport(0, 0, this.width, this.height);
    r.setScissorTest(false);
    r.setClearColor(color, 1);
    r.clear(true, true, false);
  }

  /**
   * views: [{ scene, camera, grade, sunDir }]
   */
  render(views, time) {
    const r = this.renderer;
    r.info.reset();
    const rects = this.layout(views.length);
    if (views.length === 3) this.clearScreen();
    else if (views.length > 1) this.clearScreen(0x000000);
    const scale = this.preset.renderScale * this.dynScale;
    const sharpen = scale < 0.97 ? 0.35 + (1 - scale) * 0.6 : 0.12;
    for (let i = 0; i < views.length; i++) {
      const v = views[i];
      const vp = rects[i];
      const pipe = this.pipeline(i);
      pipe.setSize(vp.w * scale, vp.h * scale);
      const cam = v.camera;
      const aspect = vp.w / vp.h;
      if (Math.abs(cam.aspect - aspect) > 1e-4) {
        cam.aspect = aspect;
        cam.updateProjectionMatrix();
      }
      if (v.beforeRender) v.beforeRender(i, cam);
      pipe.render(v.scene, cam, v.grade, vp, time, {
        sunDir: v.sunDir,
        chromatic: this.settings.chromatic,
        grain: this.settings.filmGrain,
        sharpen,
      });
    }
    return rects;
  }

  get stats() {
    const i = this.renderer.info;
    return { calls: i.render.calls, tris: i.render.triangles, scale: this.preset.renderScale * this.dynScale };
  }
}
