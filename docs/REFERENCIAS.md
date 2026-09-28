# Referências

Tudo neste projeto foi criado do zero, mas **não do nada**: cada decisão de arte, design e tecnologia partiu de referências. Esta página lista as referências e o que foi aproveitado de cada uma.

## Arte e mundo

| Referência | O que aproveitamos |
|---|---|
| **Astro Bot** (Team Asobi, 2024) e **Astro's Playroom** (2020) | Personagens com cara de brinquedo (plástico com clearcoat), diorama cheio de detalhes, "juice" em cada ação. |
| **Super Mario 3D World** (Nintendo, 2013) | Quatro heróis com pequenas diferenças jogáveis, câmera compartilhada, coroa para quem vai melhor, entrar/sair a qualquer hora. |
| **Kirby e a Terra Esquecida** (HAL Laboratory, 2022) | Heróis redondos e expressivos, antagonista redimido no final, tom acolhedor. |
| **O Castelo no Céu / Laputa** (Studio Ghibli, 1986) | Ilhas flutuantes com raízes de rocha, mar de nuvens, céu como personagem. |
| **Ori and the Will of the Wisps** (Moon Studios, 2020) | Luz como tema e como mecânica, contraluz dramática, partículas de luz no ar. |
| **Journey** (thatgamecompany, 2012) | Emoção sem texto longo; a cooperação como parte da história. |
| **Color scripts da Pixar** (*The Art of Pixar: The Complete Color Scripts*, Amid Amidi, 2011) | Uma paleta dominante por capítulo, planejada como sequência emocional (amanhecer → noite → crepúsculo → nascer do sol). |
| **Guias de silhueta de Team Fortress 2 / Overwatch** | Cada herói precisa ser reconhecível só pela silhueta — ver o "teste de silhueta" nas fichas. |
| **Lanternas de papel, lamparinas (candeias) e robôs de corda de lata** | Objetos reais que viraram personagens: Lampi, Vó Candeia e Zuca. |

## Game design

| Referência | O que aproveitamos |
|---|---|
| **Kyle Pittman — "Math for Game Programmers: Building a Better Jump"** (GDC 2016) | Pulo definido por altura e tempo até o ápice; gravidade maior na queda; pulo variável. |
| **Maddy Thorson — mecânicas de "perdão" de Celeste e TowerFall** | Coyote time e buffer de pulo. |
| **New Super Mario Bros. Wii** (Nintendo, 2009) | Bolha para reviver o amigo na co-op. |
| **It Takes Two** (Hazelight, 2021) | Opção de tela dividida com câmera por jogador; mecânicas que pedem colaboração. |
| **Crash Bandicoot / Super Mario Odyssey** | Giro como ataque, rolamento + pulo = pulo longo, patada no chão. |
| **Jan Willem Nijman — "The Art of Screenshake"** (2013) | Hit stop, partículas, som e tremor em cada impacto. |
| **Squirrel Eiserloh — "Juicing Your Cameras With Math"** (GDC 2016) | Tremor de câmera por "trauma" (intensidade ao quadrado, ruído suave). |
| **Design de chefes da Nintendo** (telegrafar → atacar → janela de vulnerabilidade) | Estrutura das 3 fases de Nox. |

## Tecnologia gráfica

| Referência | Onde está no código |
|---|---|
| **Jorge Jimenez — "Next Generation Post Processing in Call of Duty: Advanced Warfare"** (SIGGRAPH 2014) — [iryoku.com](http://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare) | Bloom com downsample de 13 amostras, média de Karis e upsample em tenda (`src/render/shaders/post.js`); Interleaved Gradient Noise para dithering. |
| **McGuire, Mara, Luebke — "Scalable Ambient Obscurance"** (HPG 2012) | SSAO em meia resolução com amostras em espiral e blur bilateral. |
| **Kenny Mitchell — "Volumetric Light Scattering as a Post-Process"** (*GPU Gems 3*, cap. 13) — [NVIDIA](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process) | God rays: máscara do céu + blur radial em direção ao sol. |
| **John Chapman — "Pseudo Lens Flare"** (2013) — [blog](http://john-chapman-graphics.blogspot.com/2013/02/pseudo-lens-flare.html) | Fantasmas e halo do lens flare a partir de um mip do bloom. |
| **Inigo Quilez — "Better Fog"** — [iquilezles.org](https://iquilezles.org/articles/fog/) | Neblina de altura com integral analítica e cor puxada para o sol (`src/render/WorldShading.js`). |
| **Khronos PBR Neutral Tone Mapper** — [KhronosGroup/ToneMapping](https://github.com/KhronosGroup/ToneMapping) | Tonemapping padrão (preserva a saturação). |
| **Troy Sobotka — AgX** — [github.com/sobotka/AgX](https://github.com/sobotka/AgX) · implementação do Filament/three.js | Tonemapping alternativo. |
| **Stephen Hill — ACES fit** (via [MJP BakingLab](https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl)) | Tonemapping alternativo. |
| **AMD FidelityFX CAS** (ideia) | Nitidez adaptativa na composição para compensar a resolução dinâmica. |
| **Eric Wohllaib — "Procedural Grass in Ghost of Tsushima"** (GDC 2021) | Grama instanciada com vento, curvatura, LOD por distância e translucidez (versão simplificada em `src/render/Grass.js`). |
| **Stefan Gustavson — "Simplex noise demystified"** (2005) | Ruído simplex 2D/3D para gerar ilhas, rochas e árvores (`src/core/math.js`). |
| **Game Programming Gems 4 — "Critically Damped Ease-In/Ease-Out Smoothing"** e o amortecimento exponencial independente de FPS | Suavização de câmera e animação (`damp`, `smoothDamp`). |
| **Técnica de "texel snapping" para shadow maps estáveis** | Câmera de sombra que segue a ação sem tremer (`src/render/Lighting.js`). |
| **Vogel disk + IGN no PCF do three.js r186** | Sombras suaves com poucas amostras. |

## Áudio

| Referência | O que aproveitamos |
|---|---|
| **Chris Wilson — "A Tale of Two Clocks"** — [web.dev](https://web.dev/articles/audio-scheduling) | Agendamento de notas com *lookahead* para música estável no navegador. |
| **Síntese FM (Chowning) e percussão subtrativa clássica** | Sinos e celestas por FM; bumbo por queda de afinação; caixa e chimbal com ruído filtrado. |
| **Trilhas de Koji Kondo e Mahito Yokota** (Mario) | Uma identidade musical por mundo; o tema principal volta, lento, no final. |

## Bibliotecas

- **three.js** r186 — [threejs.org](https://threejs.org) — renderização WebGL 2.
- **Rapier** (dimforge) — [rapier.rs](https://rapier.rs) — física e controlador cinemático de personagem.
- **Vite** — servidor de desenvolvimento e build.
- **Fredoka** e **Nunito** (via Fontsource) — tipografia da interface.
