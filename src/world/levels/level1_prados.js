// Capítulo 1 — Prados da Aurora
// Tutorial disfarçado: pulo, pulo duplo, giro, patada, sombrinhas, nuvens móveis, primeiro
// Véu de Sombra (mecânica cooperativa) e o primeiro farol.
export default {
  id: 'prados',
  index: 0,
  name: 'Prados da Aurora',
  subtitle: 'Capítulo 1',
  env: 'dawn',
  music: 'prados',
  seed: 11,
  killY: -22,
  grassDensity: 16,
  backdrop: { center: [0, 0, -80], minDist: 150, spread: 170, count: 18, y: -6 },
  build(b, V) {
    // ---------------------------------------------------------- A: Ninho (início)
    b.island(0, 0, 0, { radius: 13, depth: 12, seed: 3, flowers: 90, rocks: 4 });
    b.spawn(-1.6, 0.4, 5, Math.PI);
    b.spawn(1.6, 0.4, 5, Math.PI);
    b.spawn(-3.2, 0.4, 6.8, Math.PI);
    b.spawn(3.2, 0.4, 6.8, Math.PI);
    b.tree(-8.5, 0, 3, 1.15);
    b.tree(8, 0, -4, 1.0);
    b.tree(-7, 0, -7.5, 0.9);
    b.tree(6, 0, 7, 0.8);
    b.windmill(9.5, 0, 4.5, -0.6);
    b.sign(2.8, 0, 0.5, -0.4, 'Mova-se com o analógico/WASD. Pule com A/Espaço — segure para ir mais alto e aperte de novo no ar para o PULO DUPLO!');
    b.sparksLine([0, 1, 1], [0, 1, -9], 6);
    b.crate(-4.2, 0, -3.5);
    b.crate(-5.5, 0, -4.8);
    b.crate(-4.8, 1.1, -4.1, 'heart');
    b.sign(-2.2, 0, -2.6, 0.5, 'Gire com X/F para quebrar caixas e afastar sombras. No ar, o giro dá uma flutuadinha!');
    b.rock(10, 0, -8, 1.3, { collide: true });

    // ---------------------------------------------------------- B: pedras-degrau
    b.pillar(0, 0.6, -17.5, { r: 1.7, h: 8 });
    b.pillar(2.2, 1.4, -22.8, { r: 1.5, h: 9 });
    b.pillar(3.8, 2.0, -27.6, { r: 1.5, h: 9 });
    b.sparksArc([0, 1.2, -13], [0, 1.8, -17.5], 4, 2.2);
    b.sparksArc([0, 1.8, -17.5], [2.2, 2.4, -22.8], 4, 2.2);
    b.sparksArc([2.2, 2.4, -22.8], [3.8, 3.0, -27.6], 4, 2.2);

    // ---------------------------------------------------------- C: Campo das Sombrinhas
    b.island(4, 1.5, -41, { radius: 11.5, sx: 1.15, depth: 11, seed: 7, flowers: 70, rocks: 3 });
    b.checkpoint(-2.5, 1.5, -34.5, 0.4);
    b.enemy('sombrinha', 0, 1.5, -39, { patrol: [[0, 1.5, -39], [7, 1.5, -38]] });
    b.enemy('sombrinha', 8, 1.5, -45, { patrol: [[8, 1.5, -45], [2, 1.5, -47]] });
    b.sign(1.5, 1.5, -33.5, -0.2, 'Sombrinhas! Pule na cabeça delas — ou gire. Elas odeiam luz!');
    b.tree(-5, 1.5, -46, 1.1);
    b.tree(12, 1.5, -48, 0.9);
    b.tree(-3, 1.5, -50, 0.85);
    b.sparksCircle([4, 2.3, -42], 3, 8);
    // Semente 1: no alto do pilar (degrau + pulo duplo)
    b.block(10.8, 3.0, -37.5, { w: 2.2, h: 1.6, d: 2.2, mat: 'stone' });
    b.pillar(13.6, 6.4, -40.2, { r: 1.4, h: 10 });
    b.seed(13.6, 7.8, -40.2, 0);
    b.sparksLine([10.8, 4, -37.5], [13.6, 7.2, -40.2], 3);
    // cogumelo -> ilhota alta com coração e semente 2
    b.pad(-6, 1.5, -40, { power: 23 });
    b.island(-12, 11, -47, { radius: 4.5, depth: 5, seed: 21, flowers: 16 });
    b.seed(-12, 12.6, -47, 1);
    b.heart(-10.5, 12, -45);
    b.sparksLine([-6, 4, -40], [-11, 12, -46], 5);
    b.waterfall(17.4, 1.2, -42, Math.PI / 2, 2.6, 34);

    // ---------------------------------------------------------- D: ponte de corda
    b.bridge([4, 1.5, -52.2], [3, 2.5, -66.5], { width: 2.4, sag: 0.4 });
    b.sparksLine([4, 2.4, -54], [3, 3.2, -65], 6);

    // ---------------------------------------------------------- E: Ilha dos Moinhos
    b.island(2, 2.5, -77, { radius: 10.5, depth: 10, seed: 13, flowers: 60 });
    b.windmill(-5.5, 2.5, -80, 0.8);
    b.tree(8, 2.5, -74, 1.1);
    b.tree(7.5, 2.5, -83, 0.9);
    b.sign(4, 2.5, -70, -0.3, 'No ar, aperte B/Shift para a PATADA NO CHÃO: quebra caixas e cria uma onda de choque. No chão, B/Shift rola — pule rolando para um PULO LONGO!');
    b.enemy('sombrinha', 1, 2.5, -78, { patrol: [[1, 2.5, -78], [5, 2.5, -82]] });
    b.enemy('sombrinha', -1, 2.5, -84, { patrol: [[-1, 2.5, -84], [4, 2.5, -85]] });
    b.crate(6.5, 2.5, -78.5);
    b.crate(6.5, 3.6, -78.5);
    b.crate(7.7, 2.5, -79.5);
    b.sparksCircle([2, 3.3, -77], 4.5, 10);

    // ---------------------------------------------------------- F: travessia das nuvens
    b.moving({ shape: 'cloud', radius: 2, path: [[-3.5, 2.6, -91.5], [4.5, 2.6, -91.5]], speed: 2.4, wait: 0.6 });
    b.moving({ shape: 'cloud', radius: 2, path: [[4.5, 3.1, -97.5], [-3.5, 3.1, -97.5]], speed: 2.4, wait: 0.6, phase: 1.2 });
    b.sparksArc([1, 3.4, -88], [0.5, 3.6, -91.5], 3, 1.5);
    b.sparksArc([0.5, 3.6, -91.5], [0.5, 4.1, -97.5], 4, 2);
    b.sparksArc([0.5, 4.1, -97.5], [0, 4.4, -102], 3, 1.5);
    b.cloudDeco(-18, -4, -95, 7);
    b.cloudDeco(20, -8, -86, 9);

    // ---------------------------------------------------------- G: Ilha do Véu
    b.island(0, 3.5, -112, { radius: 11, depth: 10, seed: 17, flowers: 40 });
    b.checkpoint(4.5, 3.5, -106, -0.3);
    b.tree(-7, 3.5, -110, 1.2);
    b.tree(7.5, 3.5, -115, 0.9);
    b.sign(-3, 3.5, -115, 0.3, 'Um Véu de Sombra bloqueia o caminho! Fiquem no círculo de luz: quanto mais vaga-lumes juntos, mais rápido ele se desfaz.');
    b.block(0, 3.5, -126.5, { w: 5, h: 1.4, d: 6, mat: 'stone' });
    b.veil(0, 3.5, -123.8, 0, 6.4, 5);
    b.enemy('sombrinha', -3, 3.5, -109, { patrol: [[-3, 3.5, -109], [3, 3.5, -111]] });
    b.sparksLine([0, 4.3, -104], [0, 4.3, -120], 6);

    // ---------------------------------------------------------- H: tábuas que desmoronam
    b.crumble(0, 4.0, -133);
    b.crumble(2.8, 4.6, -138);
    b.crumble(0.2, 5.2, -143);
    b.sparksLine([0, 5, -133], [0.2, 6.2, -143], 6);

    // ---------------------------------------------------------- I: o Farol dos Prados
    b.island(0, 5, -158, { radius: 12.5, depth: 12, seed: 29, flowers: 110, rocks: 3 });
    b.goal(0, 5, -163, 0);
    b.tree(-8, 5, -154, 1.1);
    b.tree(8.5, 5, -158, 1.0);
    b.tree(-6, 5, -166, 0.9);
    b.sparksLine([0, 5.8, -148], [0, 5.8, -156], 5);
    // Semente 3: ilhota lateral atrás do farol (pulo duplo)
    b.island(16.5, 7, -151, { radius: 3.3, depth: 4, seed: 33, flowers: 10 });
    b.seed(16.5, 8.6, -151, 2);
    b.sparksArc([11, 6, -153], [16.5, 8, -151], 4, 2.5);
    b.waterfall(-12.2, 4.8, -160, -Math.PI / 2, 2.8, 36);

    b.setRoute([
      [0, 0, 10], [0, 0, -12], [2.5, 1.5, -28], [4, 1.5, -46],
      [3, 2.5, -66], [2, 2.5, -84], [0.5, 3.5, -100], [0, 3.5, -122],
      [0, 5, -146], [0, 5, -170],
    ]);
  },
};
