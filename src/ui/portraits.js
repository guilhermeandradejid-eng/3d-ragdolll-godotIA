// Retratos vetoriais (SVG) dos personagens — usados nos diálogos, na seleção de
// personagens, no HUD e nas fichas de concept art em docs/personagens/.
// viewBox 0 0 200 200. IDs de gradiente prefixados por personagem.

const svg = (inner, defs, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" ${extra}><defs>${defs}</defs>${inner}</svg>`;

const eye = (cx, cy, rx, ry, iris, look = 2) => `
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"/>
  <ellipse cx="${cx + look}" cy="${cy + ry * 0.2}" rx="${rx * 0.68}" ry="${ry * 0.7}" fill="${iris}"/>
  <ellipse cx="${cx + look}" cy="${cy + ry * 0.25}" rx="${rx * 0.38}" ry="${ry * 0.42}" fill="#160f24"/>
  <circle cx="${cx + look + rx * 0.28}" cy="${cy - ry * 0.18}" r="${rx * 0.3}" fill="#fff"/>
  <circle cx="${cx + look - rx * 0.25}" cy="${cy + ry * 0.45}" r="${rx * 0.12}" fill="#fff"/>`;

export const PORTRAITS = {
  lampi: svg(
    `
    <circle class="aura" cx="100" cy="112" r="92" fill="url(#lp-aura)"/>
    <ellipse class="aura" cx="100" cy="186" rx="52" ry="8" fill="#000" opacity=".18"/>
    <rect x="70" y="160" width="22" height="22" rx="8" fill="#5a321c"/>
    <rect x="108" y="160" width="22" height="22" rx="8" fill="#5a321c"/>
    <path d="M52 118 Q34 128 36 148" stroke="#6a3b22" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="36" cy="150" r="10" fill="#ff9a45"/>
    <path d="M148 112 Q170 96 168 74" stroke="#6a3b22" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="168" cy="70" r="10" fill="#ff9a45"/>
    <ellipse cx="100" cy="114" rx="57" ry="53" fill="url(#lp-body)"/>
    <g stroke="#c9581b" stroke-width="2.2" fill="none" opacity=".55">
      <path d="M100 62 Q100 114 100 166"/><path d="M79 64 Q64 114 79 164"/><path d="M121 64 Q136 114 121 164"/>
      <path d="M60 76 Q42 114 60 152"/><path d="M140 76 Q158 114 140 152"/>
    </g>
    <ellipse cx="100" cy="138" rx="24" ry="18" fill="url(#lp-belly)"/>
    <path d="M56 142 Q100 160 144 142 L142 154 Q100 172 58 154 Z" fill="#e0412f"/>
    <path d="M120 152 L132 176 L120 172 L114 156 Z" fill="#c7362a"/>
    <rect x="70" y="56" width="60" height="12" rx="6" fill="url(#lp-brass)"/>
    <rect x="76" y="161" width="48" height="9" rx="4" fill="url(#lp-brass)"/>
    <path d="M84 58 Q84 30 100 30 Q116 30 116 58" stroke="url(#lp-brass)" stroke-width="7" fill="none"/>
    <path d="M100 2 Q114 20 110 32 Q106 42 100 42 Q93 42 90 32 Q87 18 100 2 Z" fill="url(#lp-flame)"/>
    <path d="M100 16 Q106 26 104 33 Q102 38 100 38 Q97 38 96 33 Q95 26 100 16 Z" fill="#fff6d0"/>
    ${eye(80, 102, 12, 15, '#5a2a10')}
    ${eye(120, 102, 12, 15, '#5a2a10')}
    <ellipse cx="64" cy="124" rx="9" ry="5.5" fill="#ff6f8f" opacity=".55"/>
    <ellipse cx="136" cy="124" rx="9" ry="5.5" fill="#ff6f8f" opacity=".55"/>
    <path d="M90 124 Q100 136 110 124 Q100 130 90 124 Z" fill="#5a2a10"/>
    <path d="M70 84 Q80 78 90 84" stroke="#8a3c10" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M110 84 Q120 78 130 84" stroke="#8a3c10" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    `<radialGradient id="lp-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffb35c" stop-opacity=".55"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/></radialGradient>
     <radialGradient id="lp-body" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffd8a8"/><stop offset=".5" stop-color="#ff8a2a"/><stop offset="1" stop-color="#b9471a"/></radialGradient>
     <radialGradient id="lp-belly" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fffbe0"/><stop offset=".6" stop-color="#ffd27a"/><stop offset="1" stop-color="#ffb347" stop-opacity=".2"/></radialGradient>
     <linearGradient id="lp-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe29a"/><stop offset=".5" stop-color="#d9a441"/><stop offset="1" stop-color="#8a5f1a"/></linearGradient>
     <radialGradient id="lp-flame" cx="50%" cy="70%" r="70%"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffb347"/><stop offset="1" stop-color="#ff5a1f"/></radialGradient>`,
  ),

  nuvi: svg(
    `
    <circle class="aura" cx="100" cy="112" r="92" fill="url(#nv-aura)"/>
    <ellipse class="aura" cx="100" cy="188" rx="48" ry="7" fill="#000" opacity=".15"/>
    <path d="M142 120 L141 30" stroke="#3a2f5a" stroke-width="4"/>
    <path d="M94 50 Q141 -2 188 50 Q181 43 174 50 Q167 43 160 50 Q153 43 146 50 Q139 43 132 50 Q125 43 118 50 Q111 43 104 50 Q99 45 94 50 Z" fill="url(#nv-umb)"/>
    <path d="M141 6 Q124 28 118 50 M141 6 Q158 28 164 50" stroke="#fff" stroke-width="1.5" opacity=".35" fill="none"/>
    <circle cx="141" cy="8" r="4.5" fill="#ffcf3a"/>
    <rect x="74" y="164" width="20" height="22" rx="6" fill="#ffcf3a"/>
    <rect x="106" y="164" width="20" height="22" rx="6" fill="#ffcf3a"/>
    <ellipse cx="82" cy="186" rx="14" ry="6" fill="#f0b820"/>
    <ellipse cx="118" cy="186" rx="14" ry="6" fill="#f0b820"/>
    <g fill="url(#nv-cloud)">
      <circle cx="100" cy="118" r="50"/><circle cx="58" cy="124" r="28"/><circle cx="142" cy="124" r="28"/>
      <circle cx="72" cy="88" r="28"/><circle cx="128" cy="86" r="30"/><circle cx="100" cy="74" r="30"/>
      <circle cx="70" cy="150" r="24"/><circle cx="130" cy="150" r="24"/>
    </g>
    <path d="M96 30 Q104 44 104 52 Q104 60 96 60 Q88 60 88 52 Q88 44 96 30 Z" fill="url(#nv-drop)"/>
    <circle cx="93" cy="50" r="3" fill="#fff" opacity=".8"/>
    <circle cx="146" cy="120" r="10" fill="#f4f9ff"/>
    ${eye(82, 110, 11, 13, '#2b5fb8')}
    ${eye(118, 110, 11, 13, '#2b5fb8')}
    <path d="M70 108 Q82 94 94 108 L94 100 Q82 88 70 100 Z" fill="#eef6ff"/>
    <path d="M106 108 Q118 94 130 108 L130 100 Q118 88 106 100 Z" fill="#eef6ff"/>
    <path d="M71 107 Q82 99 93 107" stroke="#7a9cc8" stroke-width="2" fill="none"/>
    <path d="M107 107 Q118 99 129 107" stroke="#7a9cc8" stroke-width="2" fill="none"/>
    <ellipse cx="66" cy="128" rx="8" ry="5" fill="#ff8fb8" opacity=".6"/>
    <ellipse cx="134" cy="128" rx="8" ry="5" fill="#ff8fb8" opacity=".6"/>
    <path d="M94 130 Q100 135 106 130" stroke="#3a4f7a" stroke-width="2.6" stroke-linecap="round" fill="none"/>
    <text x="150" y="80" font-family="sans-serif" font-size="14" fill="#6a8fd0" opacity=".8">z</text>
    <text x="160" y="66" font-family="sans-serif" font-size="10" fill="#6a8fd0" opacity=".6">z</text>`,
    `<radialGradient id="nv-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#a9d6ff" stop-opacity=".6"/><stop offset="1" stop-color="#a9d6ff" stop-opacity="0"/></radialGradient>
     <radialGradient id="nv-cloud" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e6f1ff"/><stop offset="1" stop-color="#b9d6f5"/></radialGradient>
     <linearGradient id="nv-umb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6bcff"/><stop offset="1" stop-color="#9a6af0"/></linearGradient>
     <radialGradient id="nv-drop" cx="40%" cy="60%" r="60%"><stop offset="0" stop-color="#b9e4ff"/><stop offset="1" stop-color="#3f93e8"/></radialGradient>`,
  ),

  musgo: svg(
    `
    <circle class="aura" cx="100" cy="112" r="92" fill="url(#mg-aura)"/>
    <ellipse class="aura" cx="100" cy="188" rx="60" ry="8" fill="#000" opacity=".18"/>
    <path d="M62 170 L58 186 L84 186 L82 170 Z" fill="#8f8a80"/>
    <path d="M118 170 L116 186 L142 186 L138 170 Z" fill="#8f8a80"/>
    <path d="M30 108 L14 128 L20 158 L44 162 L52 132 Z" fill="url(#mg-stone)"/>
    <path d="M170 108 L186 128 L180 158 L156 162 L148 132 Z" fill="url(#mg-stone)"/>
    <path d="M16 136 Q26 126 40 132 L36 142 Q24 140 18 146 Z" fill="#5fae45"/>
    <path d="M40 76 L78 58 L124 56 L162 76 L176 118 L160 164 L118 178 L80 178 L40 164 L24 118 Z" fill="url(#mg-stone)"/>
    <g fill="#ffffff" opacity=".12"><path d="M78 58 L124 56 L112 96 L84 98 Z"/><path d="M40 76 L78 58 L84 98 L44 112 Z"/></g>
    <g fill="#000" opacity=".12"><path d="M160 164 L118 178 L124 140 L168 130 Z"/><path d="M40 164 L80 178 L78 142 L32 132 Z"/></g>
    <path d="M36 84 Q44 50 100 48 Q156 50 166 84 Q150 76 140 88 Q128 74 114 86 Q100 72 86 86 Q72 74 60 88 Q50 76 36 84 Z" fill="url(#mg-moss)"/>
    <circle cx="62" cy="62" r="7" fill="#7fcd5a"/><circle cx="132" cy="58" r="6" fill="#7fcd5a"/><circle cx="100" cy="52" r="5" fill="#3f8f3a"/>
    <path d="M100 50 Q98 34 102 22" stroke="#4fae3a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M101 34 Q116 22 128 30 Q114 38 101 34 Z" fill="#7fdc4f"/>
    <path d="M100 38 Q84 24 72 32 Q86 42 100 38 Z" fill="#6ccb45"/>
    <g transform="translate(102 18)">
      <circle cx="0" cy="-8" r="6" fill="#ff7ab8"/><circle cx="8" cy="-2" r="6" fill="#ff7ab8"/><circle cx="5" cy="7" r="6" fill="#ff7ab8"/>
      <circle cx="-5" cy="7" r="6" fill="#ff7ab8"/><circle cx="-8" cy="-2" r="6" fill="#ff7ab8"/><circle cx="0" cy="0" r="4.5" fill="#ffe066"/>
    </g>
    ${eye(80, 112, 8.5, 10, '#1e5a2a', 1)}
    ${eye(120, 112, 8.5, 10, '#1e5a2a', 1)}
    <ellipse cx="64" cy="128" rx="8" ry="5" fill="#ff9a8a" opacity=".55"/>
    <ellipse cx="136" cy="128" rx="8" ry="5" fill="#ff9a8a" opacity=".55"/>
    <path d="M84 132 Q100 146 116 132" stroke="#3b3530" stroke-width="3.2" stroke-linecap="round" fill="none"/>
    <circle cx="100" cy="158" r="9" fill="none" stroke="#b6ff8a" stroke-width="3.5"/>
    <circle cx="100" cy="158" r="13" fill="#7dff5a" opacity=".25"/>`,
    `<radialGradient id="mg-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#b6ff8a" stop-opacity=".45"/><stop offset="1" stop-color="#b6ff8a" stop-opacity="0"/></radialGradient>
     <linearGradient id="mg-stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfc9bd"/><stop offset=".6" stop-color="#a39e93"/><stop offset="1" stop-color="#6f6a61"/></linearGradient>
     <linearGradient id="mg-moss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe06a"/><stop offset="1" stop-color="#3f8f3a"/></linearGradient>`,
  ),

  zuca: svg(
    `
    <circle class="aura" cx="100" cy="112" r="92" fill="url(#zc-aura)"/>
    <ellipse class="aura" cx="100" cy="188" rx="50" ry="7" fill="#000" opacity=".18"/>
    <rect x="70" y="166" width="24" height="18" rx="6" fill="url(#zc-pink)"/>
    <rect x="106" y="166" width="24" height="18" rx="6" fill="url(#zc-pink)"/>
    <path d="M52 128 Q34 136 34 156" stroke="url(#zc-pink)" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="34" cy="158" r="10" fill="#2fd0c4"/>
    <path d="M148 128 Q168 120 172 100" stroke="url(#zc-pink)" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="172" cy="96" r="10" fill="#2fd0c4"/>
    <circle cx="52" cy="126" r="8" fill="#d9814a"/><circle cx="148" cy="126" r="8" fill="#d9814a"/>
    <rect x="52" y="112" width="96" height="62" rx="18" fill="url(#zc-pink)"/>
    <rect x="74" y="130" width="52" height="28" rx="6" fill="#2fd0c4"/>
    <circle cx="90" cy="144" r="8" fill="#ffe45c"/><circle cx="112" cy="144" r="5" fill="#ff5a8a"/>
    <circle cx="60" cy="120" r="3" fill="#d9814a"/><circle cx="140" cy="120" r="3" fill="#d9814a"/>
    <circle cx="60" cy="166" r="3" fill="#d9814a"/><circle cx="140" cy="166" r="3" fill="#d9814a"/>
    <g stroke="#d9814a" stroke-width="5" fill="none"><circle cx="164" cy="146" r="9"/><path d="M148 146 L156 146"/></g>
    <rect x="46" y="46" width="108" height="72" rx="22" fill="url(#zc-teal)"/>
    <rect x="36" y="70" width="12" height="22" rx="4" fill="#d9814a"/><rect x="152" y="70" width="12" height="22" rx="4" fill="#d9814a"/>
    <rect x="58" y="60" width="84" height="46" rx="14" fill="#0d0a1c"/>
    <rect x="62" y="62" width="76" height="8" rx="4" fill="#fff" opacity=".08"/>
    <rect x="76" y="70" width="12" height="20" rx="5" fill="#6ff7ff"/>
    <rect x="112" y="70" width="12" height="20" rx="5" fill="#6ff7ff"/>
    <path d="M90 96 Q100 104 110 96" stroke="#6ff7ff" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M118 46 L124 22" stroke="#d9814a" stroke-width="4"/>
    <circle cx="125" cy="18" r="8" fill="url(#zc-bulb)"/>
    <circle cx="125" cy="18" r="16" fill="#ffe45c" opacity=".25"/>`,
    `<radialGradient id="zc-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ff9ad0" stop-opacity=".5"/><stop offset="1" stop-color="#ff9ad0" stop-opacity="0"/></radialGradient>
     <linearGradient id="zc-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8cc4"/><stop offset=".5" stop-color="#ff4fa3"/><stop offset="1" stop-color="#b8286e"/></linearGradient>
     <linearGradient id="zc-teal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ff2ea"/><stop offset=".5" stop-color="#2fd0c4"/><stop offset="1" stop-color="#15877f"/></linearGradient>
     <radialGradient id="zc-bulb" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffc21a"/></radialGradient>`,
  ),

  candeia: svg(
    `
    <circle class="aura" cx="100" cy="112" r="92" fill="url(#cd-aura)"/>
    <ellipse cx="62" cy="80" rx="30" ry="16" fill="#cfe8ff" opacity=".7" transform="rotate(-28 62 80)"/>
    <ellipse cx="138" cy="80" rx="30" ry="16" fill="#cfe8ff" opacity=".7" transform="rotate(28 138 80)"/>
    <path d="M100 176 Q48 176 44 136 Q44 100 100 96 Q156 100 156 136 Q152 176 100 176 Z" fill="url(#cd-shawl)"/>
    <path d="M60 118 Q100 150 140 118 L146 140 Q100 176 54 140 Z" fill="#b8574a" opacity=".85"/>
    <g fill="#e0b25a"><circle cx="72" cy="138" r="3"/><circle cx="100" cy="150" r="3"/><circle cx="128" cy="138" r="3"/></g>
    <circle cx="100" cy="78" r="38" fill="url(#cd-face)"/>
    <circle cx="100" cy="36" r="16" fill="#f4f1ec"/><circle cx="86" cy="44" r="12" fill="#f4f1ec"/><circle cx="114" cy="44" r="12" fill="#f4f1ec"/>
    <path d="M82 32 Q76 14 66 12" stroke="#5a3a2a" stroke-width="3" fill="none"/><circle cx="65" cy="11" r="5" fill="#ffd27a"/>
    <path d="M118 32 Q124 14 134 12" stroke="#5a3a2a" stroke-width="3" fill="none"/><circle cx="135" cy="11" r="5" fill="#ffd27a"/>
    <circle cx="84" cy="80" r="12" fill="none" stroke="#6b4a2a" stroke-width="3"/>
    <circle cx="116" cy="80" r="12" fill="none" stroke="#6b4a2a" stroke-width="3"/>
    <path d="M96 80 L104 80" stroke="#6b4a2a" stroke-width="3"/>
    <path d="M78 81 Q84 76 90 81" stroke="#3a2a20" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M110 81 Q116 76 122 81" stroke="#3a2a20" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="72" cy="94" rx="7" ry="4.5" fill="#ff8f8f" opacity=".5"/><ellipse cx="128" cy="94" rx="7" ry="4.5" fill="#ff8f8f" opacity=".5"/>
    <path d="M90 98 Q100 106 110 98" stroke="#3a2a20" stroke-width="3" stroke-linecap="round" fill="none"/>
    <g transform="translate(150 132)">
      <circle cx="0" cy="0" r="26" fill="#ffd27a" opacity=".3"/>
      <path d="M-16 6 Q0 18 16 6 L12 -2 L-12 -2 Z" fill="#b8804a"/>
      <path d="M12 0 Q24 -2 26 -10" stroke="#b8804a" stroke-width="4" fill="none"/>
      <path d="M0 -22 Q8 -12 5 -5 Q3 -1 0 -1 Q-3 -1 -5 -5 Q-8 -12 0 -22 Z" fill="#ffb347"/>
      <path d="M0 -14 Q3 -9 2 -6 Q1 -4 0 -4 Q-1 -4 -2 -6 Q-3 -9 0 -14 Z" fill="#fff3c0"/>
    </g>
    <circle cx="136" cy="140" r="10" fill="url(#cd-face)"/>`,
    `<radialGradient id="cd-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffd27a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
     <radialGradient id="cd-face" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe7c2"/><stop offset="1" stop-color="#e8a86a"/></radialGradient>
     <linearGradient id="cd-shawl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a8a"/><stop offset="1" stop-color="#4a2a5a"/></linearGradient>`,
  ),

  nox: svg(
    `
    <rect width="200" height="200" fill="url(#nx-bg)"/>
    <g opacity=".95">
      <path d="M100 96 Q40 20 6 40 Q-4 90 40 120 Q70 130 100 110 Z" fill="url(#nx-wing)"/>
      <path d="M100 96 Q160 20 194 40 Q204 90 160 120 Q130 130 100 110 Z" fill="url(#nx-wing)"/>
      <path d="M100 112 Q60 130 36 170 Q60 186 90 150 Z" fill="url(#nx-wing2)"/>
      <path d="M100 112 Q140 130 164 170 Q140 186 110 150 Z" fill="url(#nx-wing2)"/>
      <circle cx="46" cy="70" r="14" fill="#ff5ac8"/><circle cx="46" cy="70" r="7" fill="#fff"/>
      <circle cx="154" cy="70" r="14" fill="#ff5ac8"/><circle cx="154" cy="70" r="7" fill="#fff"/>
      <circle cx="46" cy="70" r="22" fill="none" stroke="#ff5ac8" stroke-width="2" opacity=".5"/>
      <circle cx="154" cy="70" r="22" fill="none" stroke="#ff5ac8" stroke-width="2" opacity=".5"/>
    </g>
    <path d="M92 60 Q70 20 50 14" stroke="#3b2a55" stroke-width="3" fill="none"/>
    <path d="M108 60 Q130 20 150 14" stroke="#3b2a55" stroke-width="3" fill="none"/>
    <g stroke="#3b2a55" stroke-width="2"><path d="M70 30 l-6 -8"/><path d="M62 24 l-6 -6"/><path d="M130 30 l6 -8"/><path d="M138 24 l6 -6"/></g>
    <ellipse cx="100" cy="128" rx="20" ry="46" fill="url(#nx-body)"/>
    <circle cx="100" cy="82" r="28" fill="url(#nx-body)"/>
    <g fill="#2a1d45"><circle cx="78" cy="70" r="8"/><circle cx="122" cy="70" r="8"/><circle cx="84" cy="100" r="7"/><circle cx="116" cy="100" r="7"/></g>
    <ellipse cx="88" cy="82" rx="10" ry="12" fill="url(#nx-eye)"/>
    <ellipse cx="112" cy="82" rx="10" ry="12" fill="url(#nx-eye)"/>
    <path d="M88 100 Q100 94 112 100 Q100 108 88 100 Z" fill="#ff5ac8" opacity=".85"/>
    <path d="M76 70 L96 76" stroke="#160f24" stroke-width="3" stroke-linecap="round"/>
    <path d="M124 70 L104 76" stroke="#160f24" stroke-width="3" stroke-linecap="round"/>`,
    `<radialGradient id="nx-bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#3a1860"/><stop offset="1" stop-color="#0d0618" stop-opacity="0"/></radialGradient>
     <linearGradient id="nx-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a2f8f"/><stop offset=".6" stop-color="#2a1545"/><stop offset="1" stop-color="#1a0d2a"/></linearGradient>
     <linearGradient id="nx-wing2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1f5a"/><stop offset="1" stop-color="#6a3aa8"/></linearGradient>
     <radialGradient id="nx-body" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#4a3470"/><stop offset="1" stop-color="#150d24"/></radialGradient>
     <radialGradient id="nx-eye" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#ffd0f4"/><stop offset="1" stop-color="#ff5ac8"/></radialGradient>`,
  ),

  noxPequena: svg(
    `
    <circle class="aura" cx="100" cy="110" r="90" fill="url(#np-aura)"/>
    <path d="M100 104 Q56 50 28 64 Q22 104 58 124 Q80 130 100 116 Z" fill="url(#np-wing)"/>
    <path d="M100 104 Q144 50 172 64 Q178 104 142 124 Q120 130 100 116 Z" fill="url(#np-wing)"/>
    <path d="M100 116 Q70 132 60 160 Q80 168 96 144 Z" fill="#c9a8ff"/>
    <path d="M100 116 Q130 132 140 160 Q120 168 104 144 Z" fill="#c9a8ff"/>
    <circle cx="60" cy="88" r="9" fill="#ffd27a"/><circle cx="140" cy="88" r="9" fill="#ffd27a"/>
    <path d="M94 76 Q84 50 70 44" stroke="#6a4a8a" stroke-width="3" fill="none"/>
    <path d="M106 76 Q116 50 130 44" stroke="#6a4a8a" stroke-width="3" fill="none"/>
    <circle cx="69" cy="43" r="4" fill="#ffd27a"/><circle cx="131" cy="43" r="4" fill="#ffd27a"/>
    <ellipse cx="100" cy="128" rx="16" ry="30" fill="url(#np-body)"/>
    <circle cx="100" cy="94" r="24" fill="url(#np-body)"/>
    ${eye(90, 94, 8, 10, '#6a3aa8', 1)}
    ${eye(110, 94, 8, 10, '#6a3aa8', 1)}
    <ellipse cx="80" cy="106" rx="6" ry="4" fill="#ff8fb8" opacity=".6"/><ellipse cx="120" cy="106" rx="6" ry="4" fill="#ff8fb8" opacity=".6"/>
    <path d="M95 108 Q100 112 105 108" stroke="#4a2a6a" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    `<radialGradient id="np-aura" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffe7a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7a0" stop-opacity="0"/></radialGradient>
     <linearGradient id="np-wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8d8ff"/><stop offset="1" stop-color="#a88ae0"/></linearGradient>
     <radialGradient id="np-body" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#f4ecff"/><stop offset="1" stop-color="#b9a0e8"/></radialGradient>`,
  ),

  narrador: svg(
    `
    <circle cx="100" cy="100" r="92" fill="url(#nr-aura)"/>
    <path d="M78 176 L86 70 L114 70 L122 176 Z" fill="#f4efe6"/>
    <path d="M81 140 L119 140 L121 160 L79 160 Z" fill="#d9463b"/>
    <path d="M83 104 L117 104 L118 122 L82 122 Z" fill="#d9463b"/>
    <rect x="80" y="62" width="40" height="10" rx="3" fill="#3e3748"/>
    <rect x="86" y="40" width="28" height="22" rx="4" fill="url(#nr-lamp)"/>
    <path d="M82 40 L100 22 L118 40 Z" fill="#d9463b"/>
    <path d="M100 51 L200 30 L200 72 Z" fill="#ffe7b0" opacity=".35"/>
    <path d="M100 51 L0 30 L0 72 Z" fill="#ffe7b0" opacity=".25"/>
    <rect x="94" y="150" width="12" height="26" rx="5" fill="#6e4529"/>`,
    `<radialGradient id="nr-aura" cx="50%" cy="30%" r="60%"><stop offset="0" stop-color="#ffe7b0" stop-opacity=".6"/><stop offset="1" stop-color="#6a4a9a" stop-opacity="0"/></radialGradient>
     <radialGradient id="nr-lamp" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffc24a"/></radialGradient>`,
  ),
};

// Silhueta: o mesmo desenho preenchido de preto (teste de leitura da forma)
export function silhouette(id) {
  return PORTRAITS[id]
    .replace(/<defs>[\s\S]*?<\/defs>/, '<defs></defs>')
    .replace(/<(circle|ellipse) class="aura"[^>]*\/>/g, '')
    .replace(/<text[\s\S]*?<\/text>/g, '')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="#1b1430"')
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="#1b1430"')
    .replace(/opacity="[^"]*"/g, '');
}
