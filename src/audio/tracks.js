// Trilha sonora composta como dados para o sequenciador procedural.
// Acordes: semitons relativos à tônica (o primeiro elemento é a fundamental do acorde).
// Melodia: por compasso, lista de [passo (0-15), grau em semitons, duração em passos].

const TITLE_MELODY = [
  [[0, 4, 4], [4, 7, 4], [8, 12, 6], [14, 11, 2]],
  [[0, 9, 6], [6, 7, 2], [8, 4, 8]],
  [[0, 5, 4], [4, 9, 4], [8, 12, 4], [12, 9, 4]],
  [[0, 7, 6], [6, 11, 2], [8, 14, 8]],
  [[0, 16, 4], [4, 14, 4], [8, 12, 4], [12, 7, 4]],
  [[0, 9, 4], [4, 12, 4], [8, 4, 8]],
  [[0, 5, 4], [4, 4, 4], [8, 2, 4], [12, 0, 4]],
  [[0, 2, 8], [8, 7, 8]],
];

export const TRACKS = {
  // Tema principal: gentil, esperançoso (Fá maior)
  titulo: {
    bpm: 84, root: 53, reverb: 0.5,
    chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    pad: { wave: 'sawtooth', oct: 0, attack: 0.9, gain: 0.03, cutoff: 1000 },
    bass: { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], oct: -1, wave: 'sine', gain: 0.14, len: 6 },
    arp: { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], order: [0, 1, 2, 3, 2, 1], oct: 1, inst: 'bell', gain: 0.03 },
    melody: TITLE_MELODY,
    lead: { inst: 'bell', oct: 1, gain: 0.075, ratio: 2, index: 1.2 },
  },

  // Capítulo 1: saltitante, marimba e assobio (Ré maior)
  prados: {
    bpm: 116, root: 62, swing: 0.08, reverb: 0.3,
    chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
    pad: { wave: 'triangle', oct: -1, attack: 0.3, gain: 0.035, cutoff: 1400 },
    bass: { pattern: [1, 0, 0, 0, 2, 0, 1, 0, 1, 0, 0, 0, 2, 0, 1, 0], oct: -2, wave: 'triangle', gain: 0.17, len: 1.6 },
    arp: { pattern: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0], order: [0, 1, 2, 3, 2, 1], oct: 0, inst: 'pluck', wave: 'marimba', gain: 0.07, len: 2.5 },
    melody: [
      [[0, 7, 2], [2, 9, 2], [4, 12, 4], [8, 11, 2], [10, 9, 2], [12, 7, 4]],
      [[0, 4, 4], [4, 7, 4], [8, 9, 2], [10, 7, 2], [12, 4, 4]],
      [[0, 2, 2], [2, 4, 2], [4, 7, 4], [8, 9, 4], [12, 11, 4]],
      [[0, 12, 6], [6, 11, 2], [8, 9, 4], [12, 7, 4]],
      [[0, 16, 4], [4, 14, 2], [6, 12, 2], [8, 14, 4], [12, 12, 4]],
      [[0, 11, 4], [4, 9, 4], [8, 7, 4], [12, 4, 4]],
      [[0, 2, 4], [4, 4, 4], [8, 7, 4], [12, 9, 2], [14, 11, 2]],
      [[0, 12, 8]],
    ],
    lead: { inst: 'whistle', oct: 1, gain: 0.06 },
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
      kickGain: 0.26, snareGain: 0.08, hatGain: 0.035,
    },
  },

  // Capítulo 2: sonhador, sinos e pads sob a aurora (Mi menor)
  desfiladeiro: {
    bpm: 84, root: 64, reverb: 0.6,
    chords: [[0, 3, 7], [-4, 0, 3, 7], [3, 7, 10], [-2, 2, 5]],
    pad: { wave: 'sawtooth', oct: -1, attack: 1.4, gain: 0.032, cutoff: 850 },
    bass: { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0], oct: -2, wave: 'sine', gain: 0.16, len: 7 },
    arp: { pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0], order: [0, 1, 2, 3, 1, 2], oct: 1, inst: 'bell', gain: 0.04 },
    melody: [
      [[0, 7, 6], [6, 10, 2], [8, 12, 8]],
      [[0, 15, 4], [4, 12, 4], [8, 7, 8]],
      [[0, 10, 4], [4, 7, 4], [8, 3, 4], [12, 5, 4]],
      [[0, 2, 8], [8, 5, 4], [12, 7, 4]],
      [[0, 12, 4], [4, 14, 4], [8, 15, 8]],
      [[0, 14, 4], [4, 12, 4], [8, 10, 4], [12, 7, 4]],
      [[0, 3, 4], [4, 7, 4], [8, 10, 8]],
      [[0, 7, 12]],
    ],
    lead: { inst: 'bell', oct: 1, gain: 0.07, ratio: 3.01, index: 1.6 },
    drums: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      hat: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      kickGain: 0.2, hatGain: 0.02,
    },
  },

  // Capítulo 3: engrenagens, tensão e tique-taque (Dó menor)
  cidadela: {
    bpm: 124, root: 60, reverb: 0.35,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    pad: { wave: 'sawtooth', oct: 0, attack: 0.5, gain: 0.025, cutoff: 1100 },
    bass: { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 2, 0], oct: -2, wave: 'sawtooth', gain: 0.1, len: 1.2 },
    arp: { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: [0, 1, 2, 1], oct: 1, inst: 'pluck', wave: 'square', gain: 0.03, len: 1.2 },
    melody: [
      [[0, 7, 4], [4, 8, 2], [6, 7, 2], [8, 3, 4], [12, 0, 4]],
      [[0, 3, 4], [4, 5, 2], [6, 3, 2], [8, 0, 4], [12, 3, 4]],
      [[0, 7, 4], [4, 10, 4], [8, 12, 6], [14, 10, 2]],
      [[0, 14, 4], [4, 12, 4], [8, 10, 4], [12, 7, 4]],
      [[0, 12, 2], [2, 10, 2], [4, 12, 4], [8, 15, 4], [12, 12, 4]],
      [[0, 8, 4], [4, 12, 4], [8, 15, 4], [12, 12, 4]],
      [[0, 10, 4], [4, 7, 4], [8, 3, 4], [12, 7, 4]],
      [[0, 2, 8], [8, 5, 4], [12, 7, 4]],
    ],
    lead: { inst: 'square', oct: 1, gain: 0.03, cutoff: 1800 },
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      tick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      kickGain: 0.3, snareGain: 0.1, tickGain: 0.025,
    },
  },

  // Chefe: Nox, a Mariposa do Eclipse (Ré menor)
  chefe: {
    bpm: 148, root: 62, reverb: 0.3,
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]],
    pad: { wave: 'sawtooth', oct: -1, attack: 0.2, gain: 0.03, cutoff: 1300 },
    bass: { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2], oct: -2, wave: 'sawtooth', gain: 0.09, len: 0.9 },
    arp: { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: [0, 1, 2, 3], oct: 1, inst: 'bell', gain: 0.03 },
    melody: [
      [[0, 12, 3], [3, 10, 3], [6, 7, 2], [8, 15, 4], [12, 14, 4]],
      [[0, 12, 6], [6, 10, 2], [8, 8, 4], [12, 7, 4]],
      [[0, 10, 3], [3, 12, 3], [6, 14, 2], [8, 15, 4], [12, 17, 4]],
      [[0, 13, 8], [8, 16, 4], [12, 13, 4]],
    ],
    lead: { inst: 'square', oct: 1, gain: 0.035, cutoff: 2600 },
    drums: {
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      tom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
      kickGain: 0.34, snareGain: 0.12, hatGain: 0.025,
    },
  },

  // Final: reprise lenta e calorosa do tema principal
  final: {
    bpm: 72, root: 53, reverb: 0.6,
    chords: [[0, 4, 7, 11], [4, 7, 11, 14], [5, 9, 12, 16], [7, 11, 14]],
    pad: { wave: 'sawtooth', oct: -1, attack: 1.5, gain: 0.03, cutoff: 900 },
    bass: { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], oct: -1, wave: 'sine', gain: 0.15, len: 12 },
    arp: { pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], order: [0, 1, 2, 3], oct: 1, inst: 'bell', gain: 0.03 },
    melody: TITLE_MELODY,
    lead: { inst: 'bell', oct: 1, gain: 0.08, ratio: 2, index: 1.1 },
  },

  // Tela de resultados: curta e alegre
  vitoria: {
    bpm: 120, root: 60, reverb: 0.4,
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    pad: { wave: 'triangle', oct: 0, attack: 0.1, gain: 0.03, cutoff: 1800 },
    bass: { pattern: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0], oct: -2, wave: 'triangle', gain: 0.15, len: 2 },
    arp: { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], order: [0, 1, 2, 3, 2, 1], oct: 1, inst: 'pluck', wave: 'marimba', gain: 0.05 },
    drums: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      kickGain: 0.2, hatGain: 0.03,
    },
  },
};
