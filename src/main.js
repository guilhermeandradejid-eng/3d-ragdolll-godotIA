// Ponto de entrada: inicializa a física (WASM), fontes, estilos e o jogo.
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import './ui/styles.css';
import { initPhysics } from './world/Physics.js';
import { Game } from './core/Game.js';

async function boot() {
  const bar = document.querySelector('.boot-bar i');
  if (bar) bar.style.width = '35%';
  await initPhysics();
  if (bar) bar.style.width = '70%';
  const game = new Game(document.getElementById('gl'), document.getElementById('ui'));
  window.__game = game;
  await game.start();
  if (bar) bar.style.width = '100%';
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    bootEl.classList.add('done');
    setTimeout(() => bootEl.remove(), 900);
  }
}

boot().catch((err) => {
  console.error(err);
  const el = document.getElementById('boot');
  if (el) {
    el.innerHTML = `<div class="boot-error"><h2>Ops! Não foi possível iniciar.</h2><p>${String(err?.message || err)}</p>
    <p>Este jogo precisa de um navegador com WebGL 2 (Chrome, Edge, Firefox ou Safari recentes).</p></div>`;
  }
});
