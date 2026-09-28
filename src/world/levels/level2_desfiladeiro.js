// Capítulo 2 — Desfiladeiro Estelar
// Noite eterna sob a aurora: cristais luminosos, cogumelos-trampolim, pontes de luz
// que só existem perto dos vaga-lumes, espinhelas, mariposombras e dois Véus de Sombra.
export default {
  id: 'desfiladeiro',
  index: 1,
  name: 'Desfiladeiro Estelar',
  subtitle: 'Capítulo 2',
  env: 'night',
  music: 'desfiladeiro',
  seed: 23,
  killY: -20,
  grassDensity: 12,
  grassHeight: 0.45,
  backdrop: { center: [0, 0, -70], minDist: 140, spread: 160, count: 18, y: -4, bare: true },
  build(b) {
    // ---------------------------------------------------------- A: mesa inicial
    b.island(0, 0, 0, { radius: 11, depth: 11, seed: 41, flowers: 30, rocks: 3 });
    b.spawn(-1.6, 0.4, 5, Math.PI);
    b.spawn(1.6, 0.4, 5, Math.PI);
    b.spawn(-3.2, 0.4, 6.6, Math.PI);
    b.spawn(3.2, 0.4, 6.6, Math.PI);
    b.crystals(-7, 0, -1, 1.3, 'crystalCyan');
    b.crystals(7.5, 0, 2, 1.1, 'crystalPink');
    b.crystals(-5, 0, 6, 0.8, 'crystalCyan', false);
    b.pine(-8.5, 0, 4, 1.1);
    b.pine(8.5, 0, -5, 1.2);
    b.mushroom(6, 0, 6, 1.1, 'glow');
    b.mushroom(-8, 0, -6, 0.9, 'pink');
    b.sign(2.8, 0, -1, -0.3, 'Cogumelos brilhantes são trampolins! Segure o pulo ao quicar para ir ainda mais alto.');
    b.pad(0, 0, -7.5, { glow: true, power: 23 });
    b.sparksLine([0, 1.2, 2], [0, 1.2, -5], 4);
    b.sparksLine([0, 4, -7.5], [0, 9, -12], 5);

    // ---------------------------------------------------------- B: plataforma alta + Ponte de Luz
    b.block(0, 6.5, -15.5, { w: 5, h: 2.5, d: 5, mat: 'darkStone' });
    b.crystals(1.8, 6.5, -14, 0.7, 'crystalCyan', false);
    b.sign(-1.5, 6.5, -14.5, 0.2, 'Uma Ponte de Luz! Ela só se solidifica perto de um vaga-lume. Vão juntos para iluminar o caminho inteiro.');
    b.lightBridge([0, 6.4, -18.5], [0, 5.6, -33], 2.6, 7);
    b.sparksLine([0, 7.4, -20], [0, 6.8, -32], 6);

    // ---------------------------------------------------------- C: Ilha das Espinhelas
    b.island(0, 5, -43, { radius: 10.5, depth: 10, seed: 43, flowers: 20 });
    b.checkpoint(-3, 5, -35.5, 0.3);
    b.sign(3, 5, -36, -0.3, 'Espinhelas têm espinhos: nada de pisar! Uma PATADA NO CHÃO perto delas as atordoa — aí é só girar.');
    b.enemy('espinhela', -6, 5, -44, { path: [[-6, 5, -44], [6, 5, -44]], speed: 3.2 });
    b.enemy('espinhela', 5, 5, -49, { path: [[5, 5, -49], [-5, 5, -48]], speed: 2.4 });
    b.crystals(-8, 5, -48, 1.2, 'crystalPink');
    b.pine(8, 5, -40, 1);
    b.sparksCircle([0, 5.8, -43], 3.5, 8);
    // Semente 1: agulha de cristal (cogumelo lateral)
    b.pad(7.5, 5, -38.5, { glow: true, power: 25, scale: 0.9 });
    b.block(11.5, 12.5, -45.5, { w: 3, h: 3, d: 3, mat: 'darkStone' });
    b.crystals(11.5, 12.5, -46.5, 0.6, 'crystalGold', false);
    b.seed(11.5, 14, -45.5, 0);
    b.sparksLine([8, 9, -40], [11.3, 13.4, -45], 4);

    // ---------------------------------------------------------- D: carrossel de cristais
    b.pillar(0, 5.5, -60, { r: 2.2, h: 9, bare: true });
    b.crystals(0, 5.5, -60, 0.8, 'crystalCyan');
    b.moving({ shape: 'crystal', radius: 1.9, orbit: { center: [0, 5.3, -60], radius: 6.2, speed: 0.55, phase: 1.57 } });
    b.moving({ shape: 'crystal', radius: 1.9, orbit: { center: [0, 5.3, -60], radius: 6.2, speed: 0.55, phase: -1.57 } });
    b.sparksCircle([0, 6.5, -60], 6.2, 12);

    // ---------------------------------------------------------- E: Ilha do Véu
    b.island(0, 6, -79, { radius: 11, depth: 11, seed: 47, flowers: 26 });
    b.checkpoint(3.5, 6, -70.5, -0.3);
    b.enemy('mariposa', -3, 9, -80, { radius: 3, speed: 1 });
    b.enemy('mariposa', 4, 9.5, -84, { radius: 2.5, speed: -1.2 });
    b.crystals(-8, 6, -76, 1.1, 'crystalCyan');
    b.crystals(8, 6, -83, 1.3, 'crystalPink');
    b.pine(-7, 6, -85, 1.2);
    b.block(0, 6, -93.5, { w: 5, h: 1.5, d: 6, mat: 'darkStone' });
    b.veil(0, 6, -90.8, 0, 6.4, 5.5);
    // Semente 2: escondida entre cristais, guardada por uma espinhela
    b.enemy('espinhela', -6, 6, -73, { path: [[-6, 6, -73], [-9, 6, -79]], speed: 2 });
    b.seed(-9, 7.5, -73, 1);
    b.sparksLine([0, 6.8, -71], [0, 6.8, -88], 6);

    // ---------------------------------------------------------- F: degraus flutuantes
    b.pillar(2.5, 6.8, -100.5, { r: 1.6, h: 8, bare: true });
    b.pillar(-2, 7.6, -106, { r: 1.5, h: 8, bare: true });
    b.moving({ shape: 'crystal', radius: 1.7, path: [[2, 8.2, -110.5], [2, 8.2, -113]], speed: 1.4, wait: 0.9 });
    b.enemy('mariposa', 0, 11, -106, { radius: 3.5, speed: 1.1 });
    b.sparksArc([0, 7, -96], [2.5, 7.8, -100.5], 3, 1.5);
    b.sparksArc([2.5, 7.8, -100.5], [-2, 8.6, -106], 4, 2);
    b.sparksArc([-2, 8.6, -106], [2, 9.2, -112], 4, 2);

    // ---------------------------------------------------------- G: Farol de Cristal
    b.island(0, 9, -128, { radius: 12.5, depth: 12, seed: 53, flowers: 40, rocks: 2 });
    b.goal(0, 9, -134, 0, { stripe: '#27a8d8' });
    b.crystals(-8, 9, -124, 1.3, 'crystalCyan');
    b.crystals(8, 9, -130, 1.1, 'crystalPink');
    b.crystals(-6, 9, -137, 0.9, 'crystalGold');
    b.mushroom(7, 9, -122, 1.2, 'glow');
    b.enemy('sombrinha', 3, 9, -122, { patrol: [[3, 9, -122], [-4, 9, -124]] });
    // Semente 3: ponte de luz lateral até uma ilhota
    b.lightBridge([11, 9, -126], [22, 10, -126], 2.4, 6);
    b.island(26, 10, -126, { radius: 3.4, depth: 4, seed: 57, flowers: 8 });
    b.seed(26, 11.6, -126, 2);
    b.waterfall(-12.6, 8.8, -128, -Math.PI / 2, 2.6, 34);
    b.waterfall(10.6, 4.8, -43, Math.PI / 2, 2.2, 30);

    b.setRoute([
      [0, 0, 10], [0, 0, -8], [0, 6.5, -18], [0, 5, -40], [0, 5.5, -60],
      [0, 6, -76], [0, 6, -92], [0, 8, -106], [0, 9, -120], [0, 9, -140],
    ]);
  },
};
