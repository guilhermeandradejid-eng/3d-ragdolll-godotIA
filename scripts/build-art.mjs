// Gera as fichas de personagem (concept sheets) em docs/personagens/*.svg
// a partir dos mesmos retratos vetoriais usados dentro do jogo.
// Uso: node scripts/build-art.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORTRAITS, silhouette } from '../src/ui/portraits.js';
import { BIOS, BIO_ORDER } from '../src/story/bios.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'personagens');
mkdirSync(out, { recursive: true });

const FONT = "font-family=\"'Trebuchet MS', Verdana, 'DejaVu Sans', sans-serif\"";
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      lines.push(cur.trim());
      cur = w;
    } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

function textBlock(x, y, label, text, color, max = 58) {
  const lines = wrap(text, max);
  return `<text x="${x}" y="${y}" ${FONT} font-size="15" font-weight="bold" fill="${color}" letter-spacing="1.5">${esc(label.toUpperCase())}</text>
  <text x="${x}" y="${y + 24}" ${FONT} font-size="17" fill="#f3ecff">${lines.map((l, i) => `<tspan x="${x}" dy="${i ? 23 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
}

function embed(svgStr, x, y, size) {
  return svgStr.replace('<svg xmlns="http://www.w3.org/2000/svg"', `<svg x="${x}" y="${y}" width="${size}" height="${size}"`);
}

function sheet(id) {
  const b = BIOS[id];
  const accent = b.palette[0] === '#f4f9ff' ? b.palette[1] : b.palette[0];
  let y = 200;
  const blocks = [];
  for (const [label, text] of [['Personalidade', b.personality], ['Habilidade', b.ability], ['Design', b.design]]) {
    blocks.push(textBlock(560, y, label, text, accent));
    y += 30 + wrap(text, 58).length * 23 + 26;
  }
  let stats = '';
  if (b.stats) {
    const names = { velocidade: 'Velocidade', pulo: 'Pulo', peso: 'Peso', tracao: 'Tração' };
    stats = Object.entries(b.stats).map(([k, v], i) => {
      const sy = 560 + i * 26;
      const bars = [0, 1, 2].map((j) => `<rect x="${680 + j * 46}" y="${sy - 13}" width="40" height="14" rx="4" fill="${j < v ? accent : '#ffffff22'}"/>`).join('');
      return `<text x="560" y="${sy}" ${FONT} font-size="15" fill="#d9cfe8">${names[k]}</text>${bars}`;
    }).join('');
  }
  const swatches = b.palette.map((c, i) => `<g transform="translate(${900 + (i % 3) * 92} ${545 + Math.floor(i / 3) * 62})"><rect width="80" height="34" rx="8" fill="${c}" stroke="#ffffff33"/><text x="40" y="50" text-anchor="middle" ${FONT} font-size="12" fill="#d9cfe8">${c}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
  <defs>
    <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d1238"/><stop offset="1" stop-color="#0b0718"/></linearGradient>
    <radialGradient id="glow-${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="700" rx="28" fill="url(#bg-${id})"/>
  ${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 283) % 1200}" cy="${(i * 157) % 700}" r="${(i % 3) * 0.6 + 0.6}" fill="#fff" opacity="${0.15 + (i % 4) * 0.08}"/>`).join('')}
  <circle cx="270" cy="330" r="260" fill="url(#glow-${id})"/>
  ${embed(PORTRAITS[id], 40, 90, 460)}
  <rect x="40" y="572" width="96" height="96" rx="14" fill="#efe7f8"/>
  ${embed(silhouette(id), 48, 580, 80)}
  <text x="150" y="610" ${FONT} font-size="14" fill="#bfb3d6">Teste de silhueta:</text>
  <text x="150" y="630" ${FONT} font-size="14" fill="#bfb3d6">a forma precisa ser reconhecível</text>
  <text x="150" y="650" ${FONT} font-size="14" fill="#bfb3d6">mesmo toda preenchida de preto.</text>
  <text x="560" y="92" ${FONT} font-size="54" font-weight="bold" fill="#fff8ec">${esc(b.name)}</text>
  <text x="560" y="126" ${FONT} font-size="22" font-weight="bold" fill="${accent}">${esc(b.title)}</text>
  <text x="560" y="156" ${FONT} font-size="16" fill="#bfb3d6">${esc(b.role)} · “${esc(b.quote)}”</text>
  <line x1="560" y1="172" x2="1150" y2="172" stroke="#ffffff22"/>
  ${blocks.join('\n  ')}
  ${stats}
  <text x="900" y="530" ${FONT} font-size="15" font-weight="bold" fill="${accent}" letter-spacing="1.5">PALETA</text>
  ${swatches}
  <text x="40" y="52" ${FONT} font-size="16" fill="#8f82ad" letter-spacing="2">VAGA-LUMES: O ÚLTIMO FAROL · FICHA DE PERSONAGEM</text>
</svg>`;
}

for (const id of BIO_ORDER) {
  writeFileSync(join(out, `${id}.svg`), sheet(id));
  console.log('gerado', `docs/personagens/${id}.svg`);
}

// Lineup com a turma inteira + silhuetas
const heroes = ['lampi', 'nuvi', 'musgo', 'zuca'];
const lineup = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
  <defs><linearGradient id="lbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f7ed6"/><stop offset=".55" stop-color="#ffcfae"/><stop offset="1" stop-color="#f6dcca"/></linearGradient></defs>
  <rect width="1400" height="560" rx="28" fill="url(#lbg)"/>
  <ellipse cx="700" cy="560" rx="760" ry="130" fill="#8fd35e"/>
  <ellipse cx="700" cy="560" rx="700" ry="100" fill="#6fbf4a"/>
  ${embed(PORTRAITS.candeia, 40, 150, 250)}
  ${heroes.map((id, i) => embed(PORTRAITS[id], 270 + i * 205, 170, 250)).join('\n  ')}
  ${embed(PORTRAITS.nox.replace(/<rect width="200" height="200"[^>]*\/>/, ''), 1110, 60, 280)}
  ${heroes.map((id, i) => `<g opacity=".9">${embed(silhouette(id), 330 + i * 205, 440, 110)}</g>`).join('\n  ')}
  <text x="700" y="70" text-anchor="middle" ${FONT} font-size="48" font-weight="bold" fill="#fff8ec" stroke="#7a3a1a" stroke-width="1">Vaga-lumes: O Último Farol</text>
  <text x="700" y="108" text-anchor="middle" ${FONT} font-size="20" fill="#fff8ec">Lampi · Nuvi · Musgo · Zuca — com Vó Candeia e Nox</text>
</svg>`;
writeFileSync(join(out, 'elenco.svg'), lineup);
console.log('gerado docs/personagens/elenco.svg');
