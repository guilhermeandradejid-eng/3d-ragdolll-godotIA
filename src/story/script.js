// Roteiro — "Vaga-lumes: O Último Farol"
// Falas curtas (estilo diálogos de jogos de plataforma da Nintendo) para não travar o ritmo.

export const SPEAKERS = {
  narrador: { name: 'Narrador', color: '#ffe7b0', portrait: 'narrador' },
  candeia: { name: 'Vó Candeia', color: '#ffcf7a', portrait: 'candeia' },
  lampi: { name: 'Lampi', color: '#ff8a2a', portrait: 'lampi' },
  nuvi: { name: 'Nuvi', color: '#6ab7ff', portrait: 'nuvi' },
  musgo: { name: 'Musgo', color: '#63c24a', portrait: 'musgo' },
  zuca: { name: 'Zuca', color: '#ff4fa3', portrait: 'zuca' },
  nox: { name: 'Nox', color: '#c07aff', portrait: 'nox' },
  noxPequena: { name: 'Nox', color: '#d9c4ff', portrait: 'noxPequena' },
};

export const SCRIPT = {
  prologo: [
    { s: 'narrador', t: 'Muito acima das nuvens, onde o céu vira oceano, flutua o Arquipélago de Aurora.' },
    { s: 'narrador', t: 'No centro dele, o Grande Farol guarda a Chama Primordial: a luz que mantém as ilhas no ar e acorda o sol a cada manhã.' },
    { s: 'narrador', t: 'Mas toda luz projeta uma sombra... e, nesta noite, a sombra acordou com fome.' },
    { s: 'nox', t: 'Tanta luz... e nem uma migalha para mim? Então ela será TODA minha!' },
    { s: 'narrador', t: 'Nox, a Mariposa do Eclipse, engoliu a Chama Primordial e a partiu em milhares de centelhas. O sol não nasceu. As ilhas começaram a afundar.' },
    { s: 'candeia', t: 'Acordem, pequenos! Lampi, Nuvi, Musgo, Zuca... o céu precisa de vocês!' },
    { s: 'candeia', t: 'Cada ilha tem um farol. Reacendam-nos, juntem as Sementes de Luz e sigam a trilha até a Cidadela do Eclipse.' },
    { s: 'lampi', t: 'Bora brilhar! Ninguém apaga a gente!' },
    { s: 'nuvi', t: 'Eu estava sonhando com estrelas... mas tudo bem. Vamos buscá-las de volta.' },
    { s: 'musgo', t: 'Hm. Juntos.' },
    { s: 'zuca', t: 'Calculando... 97% de chance de sucesso! Os outros 3% são pura aventura!' },
    { s: 'candeia', t: 'Lembrem-se: um vaga-lume sozinho ilumina um caminho. Juntos, iluminam o céu inteiro.' },
  ],

  prados_intro: [
    { s: 'candeia', t: 'Os Prados da Aurora ficam sempre no amanhecer. O primeiro farol está além dos moinhos.' },
    { s: 'zuca', t: 'Detectei Sombrinhas no caminho. Probabilidade de elas gostarem de pisão na cabeça: 0%.' },
    { s: 'lampi', t: 'Perfeito. Vai ser 100% divertido pra gente!' },
  ],
  prados_fim: [
    { s: 'candeia', t: 'Vejam! O Farol dos Prados voltou a brilhar. As ilhas pararam de afundar!' },
    { s: 'nuvi', t: 'A luz faz cócegas nas nuvens lá embaixo...' },
    { s: 'zuca', t: 'Próxima parada: Desfiladeiro Estelar. Levem casacos. E curiosidade.' },
  ],

  desfiladeiro_intro: [
    { s: 'candeia', t: 'No Desfiladeiro Estelar a noite nunca termina. Os cristais guardam memórias de luz antiga.' },
    { s: 'candeia', t: 'Nox espalhou Véus de Sombra por lá. Fiquem juntos: a luz de vocês, somada, desfaz qualquer véu.' },
    { s: 'nuvi', t: 'Olhem a aurora dançando... parece que o céu está respirando.' },
    { s: 'musgo', t: 'Bonito. Cuidado com os espinhos.' },
  ],
  desfiladeiro_fim: [
    { s: 'nuvi', t: 'O Farol de Cristal acendeu! As estrelas estão cantando?' },
    { s: 'zuca', t: 'Tecnicamente é o vento nos cristais. Mas vou anotar como "canto".' },
    { s: 'candeia', t: 'A Cidadela do Eclipse está logo adiante. Nox está esperando por vocês lá.' },
  ],

  cidadela_intro: [
    { s: 'candeia', t: 'A Cidadela foi construída pelos antigos relojoeiros do céu. Suas engrenagens giram o dia e a noite.' },
    { s: 'candeia', t: 'Nox travou tudo num crepúsculo eterno. Subam até o topo — a Chama está perto.' },
    { s: 'zuca', t: 'Engrenagens! Pêndulos! Mecanismos! Isso é o meu parque de diversões!' },
    { s: 'lampi', t: 'Só não vai desmontar o castelo antes da gente passar, tá?' },
  ],
  cidadela_fim: [
    { s: 'lampi', t: 'Estou sentindo o calor da Chama! Está lá em cima, no Coração do Eclipse!' },
    { s: 'musgo', t: 'Hm. Pronto.' },
    { s: 'nuvi', t: 'Se a gente for juntinho, nenhuma sombra é grande demais.' },
  ],

  chefe_intro: [
    { s: 'nox', t: 'Pequenas luzes... vieram me apagar?' },
    { s: 'nox', t: 'Todos sempre olham para a luz. Ninguém olha para a sombra! Agora a luz é MINHA!' },
    { s: 'candeia', t: 'Crianças! Quando Nox mergulhar e bater no chão, o núcleo de luz dele fica exposto. Pulem nele — ou deem uma patada!' },
    { s: 'lampi', t: 'Entendido! Vamos devolver a Chama pro farol!' },
  ],

  final: [
    { s: 'narrador', t: 'A Chama Primordial saltou do peito de Nox e voltou ao Grande Farol, que acendeu como um segundo sol.' },
    { s: 'noxPequena', t: '...Está quentinho aqui. Eu nunca tinha chegado tão perto da luz sem me queimar.' },
    { s: 'lampi', t: 'Você pode ficar com a gente! Todo farol precisa de uma sombra para lembrar o quanto brilha.' },
    { s: 'musgo', t: 'Hm. Amigos.' },
    { s: 'nuvi', t: 'Você pode ver as estrelas comigo. Eu conheço todas pelo nome... quase todas.' },
    { s: 'zuca', t: 'Recalculando... 100% de chance de um final feliz!' },
    { s: 'candeia', t: 'O sol vai nascer. E dessa vez há lugar para todos na luz — até para as sombras.' },
    { s: 'narrador', t: 'E assim o Arquipélago de Aurora voltou a flutuar. Dizem que, nas noites mais escuras, uma pequena mariposa dança ao redor do Grande Farol...' },
    { s: 'narrador', t: '...não para apagá-lo, mas para fazer companhia a ele.' },
  ],
};

export const CREDITS = [
  ['Vaga-lumes: O Último Farol', ''],
  ['Um jogo de plataforma 3D cooperativo', 'feito com three.js, Rapier e shaders próprios'],
  ['Roteiro, personagens e direção de arte', 'escritos e desenhados para este projeto'],
  ['Renderização', 'pipeline HDR com bloom, SSAO, god rays, DoF, lens flare e tonemapping próprios'],
  ['Música e efeitos', 'sintetizados em tempo real com WebAudio'],
  ['Física', 'Rapier (dimforge) — controlador cinemático de personagem'],
  ['Referências e inspirações', 'Astro Bot, Super Mario 3D World, It Takes Two, Ori, Studio Ghibli — veja docs/REFERENCIAS.md'],
  ['Obrigado por jogar!', 'Juntos, brilhamos mais.'],
];
