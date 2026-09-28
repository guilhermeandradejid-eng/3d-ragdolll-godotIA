// Configurações e progresso salvos no navegador (localStorage).

export const QUALITY_PRESETS = {
  baixa: {
    label: 'Baixa', renderScale: 0.7, maxDpr: 1, msaa: 0, shadowSize: 1024, shadowRadius: 2,
    ao: false, aoSamples: 0, godrays: false, dof: false, lensFlare: false, bloomMips: 4,
    grassDensity: 0.35, particleScale: 0.5, playerLights: false,
  },
  media: {
    label: 'Média', renderScale: 0.85, maxDpr: 1.25, msaa: 2, shadowSize: 2048, shadowRadius: 3,
    ao: false, aoSamples: 0, godrays: true, dof: false, lensFlare: false, bloomMips: 5,
    grassDensity: 0.65, particleScale: 0.75, playerLights: true,
  },
  alta: {
    label: 'Alta', renderScale: 1, maxDpr: 1.5, msaa: 4, shadowSize: 2048, shadowRadius: 3,
    ao: true, aoSamples: 10, godrays: true, dof: true, lensFlare: true, bloomMips: 6,
    grassDensity: 1, particleScale: 1, playerLights: true,
  },
  ultra: {
    label: 'Ultra', renderScale: 1, maxDpr: 2, msaa: 4, shadowSize: 4096, shadowRadius: 3,
    ao: true, aoSamples: 16, godrays: true, dof: true, lensFlare: true, bloomMips: 6,
    grassDensity: 1.4, particleScale: 1, playerLights: true,
  },
};

const SETTINGS_KEY = 'vagalumes.settings.v1';
const SAVE_KEY = 'vagalumes.save.v1';

const DEFAULT_SETTINGS = {
  quality: 'alta',
  dynamicRes: true,
  splitScreen: false,
  musicVolume: 0.6,
  sfxVolume: 0.85,
  screenShake: true,
  chromatic: true,
  filmGrain: true,
  showFps: false,
  rumble: true,
};

const DEFAULT_SAVE = {
  unlocked: 1,
  seeds: {},
  bestSparks: {},
  finished: false,
  seenPrologue: false,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    return structuredClone(fallback);
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* modo privado ou armazenamento bloqueado: o jogo continua sem salvar */
  }
}

export class Settings {
  constructor() {
    Object.assign(this, read(SETTINGS_KEY, DEFAULT_SETTINGS));
    if (!QUALITY_PRESETS[this.quality]) this.quality = 'alta';
    this.listeners = new Set();
  }
  get preset() {
    return QUALITY_PRESETS[this.quality];
  }
  set(key, value) {
    this[key] = value;
    this.save();
    for (const l of this.listeners) l(key, value);
  }
  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  save() {
    const out = {};
    for (const k of Object.keys(DEFAULT_SETTINGS)) out[k] = this[k];
    write(SETTINGS_KEY, out);
  }
}

export class SaveData {
  constructor() {
    this.data = read(SAVE_KEY, DEFAULT_SAVE);
  }
  save() {
    write(SAVE_KEY, this.data);
  }
  seedsFor(levelId) {
    return this.data.seeds[levelId] || [false, false, false];
  }
  collectSeed(levelId, index) {
    const s = this.seedsFor(levelId).slice();
    s[index] = true;
    this.data.seeds[levelId] = s;
    this.save();
  }
  completeLevel(levelIndex, sparks, levelId) {
    this.data.unlocked = Math.max(this.data.unlocked, levelIndex + 2);
    this.data.bestSparks[levelId] = Math.max(this.data.bestSparks[levelId] || 0, sparks);
    this.save();
  }
  totalSeeds() {
    let n = 0;
    for (const k of Object.keys(this.data.seeds)) n += this.data.seeds[k].filter(Boolean).length;
    return n;
  }
  reset() {
    this.data = structuredClone(DEFAULT_SAVE);
    this.save();
  }
}
