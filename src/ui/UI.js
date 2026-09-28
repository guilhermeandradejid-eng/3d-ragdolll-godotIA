// Interface em HTML/CSS sobre o canvas: menus navegáveis por qualquer controle,
// seleção de personagens, diálogos com retrato, HUD por jogador, pausa, opções e resultados.
import { PORTRAITS } from './portraits.js';
import { SPEAKERS } from '../story/script.js';
import { CHARACTERS, charById } from '../entities/characters.js';
import { QUALITY_PRESETS } from '../core/Storage.js';
import { CONTROL_HINTS, Input } from '../core/Input.js';

const h = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

const heartSvg = (full) =>
  `<svg viewBox="0 0 24 22" class="heart ${full ? 'full' : 'empty'}"><path d="M12 21 C5 15 1 11.5 1 7 C1 3.5 3.7 1 7 1 C9.2 1 11 2.2 12 4 C13 2.2 14.8 1 17 1 C20.3 1 23 3.5 23 7 C23 11.5 19 15 12 21 Z"/></svg>`;
const sparkSvg = `<svg viewBox="0 0 24 24" class="spark-ico"><path d="M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z"/></svg>`;
const seedSvg = (on) => `<svg viewBox="0 0 24 24" class="seed-ico ${on ? 'on' : ''}"><circle cx="12" cy="13" r="8"/><path d="M12 5 Q17 1 20 4 Q16 7 12 5 Z M12 5 Q7 1 4 4 Q8 7 12 5 Z"/></svg>`;
const crownSvg = `<svg viewBox="0 0 32 24" class="crown"><path d="M2 20 L4 6 L11 13 L16 2 L21 13 L28 6 L30 20 Z"/><rect x="2" y="20" width="28" height="3" rx="1"/></svg>`;

export class UI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.layers = {};
    for (const name of ['screen', 'hud', 'dialog', 'banner', 'toasts', 'hint', 'overlay', 'fps']) {
      const l = h('div', `layer layer-${name}`);
      root.appendChild(l);
      this.layers[name] = l;
    }
    this.menu = null;
    this.dialogState = null;
    this.hudCache = [];
    this.toastQueue = [];
  }

  sfx(n) {
    this.game.audio?.sfx(n);
  }

  clearScreen() {
    this.layers.screen.innerHTML = '';
    this.layers.screen.className = 'layer layer-screen';
    this.menu = null;
  }

  // ------------------------------------------------------------------ menus
  // items: [{label, sub?, action, disabled?, value?: () => string, left?, right?}]
  buildMenu(container, items, opts = {}) {
    const list = h('div', 'menu ' + (opts.cls || ''));
    const els = items.map((it, i) => {
      const b = h('button', 'menu-item' + (it.disabled ? ' disabled' : ''));
      b.innerHTML = `<span class="mi-label">${it.label}</span>${it.value ? `<span class="mi-value"></span>` : ''}${it.sub ? `<span class="mi-sub">${it.sub}</span>` : ''}`;
      b.addEventListener('mouseenter', () => this.focusMenu(i));
      b.addEventListener('click', () => {
        this.focusMenu(i);
        this.activate(0);
      });
      list.appendChild(b);
      return b;
    });
    container.appendChild(list);
    // cooldown: a mesma tecla que abriu o menu (ex.: Esc = pausa e voltar) não o fecha no mesmo quadro
    this.menu = { items, els, index: Math.max(0, items.findIndex((it) => !it.disabled)), onBack: opts.onBack, cooldown: 0.2 };
    this.refreshMenu();
    return list;
  }

  refreshMenu() {
    const m = this.menu;
    if (!m) return;
    m.els.forEach((el, i) => {
      el.classList.toggle('focus', i === m.index);
      const it = m.items[i];
      if (it.value) el.querySelector('.mi-value').textContent = it.value();
    });
  }

  focusMenu(i) {
    const m = this.menu;
    if (!m || m.items[i]?.disabled || m.index === i) return;
    m.index = i;
    this.sfx('uiMove');
    this.refreshMenu();
  }

  activate(dir) {
    const m = this.menu;
    if (!m) return;
    const it = m.items[m.index];
    if (!it || it.disabled) return;
    if (dir !== 0 && (it.left || it.right)) {
      (dir < 0 ? it.left : it.right)?.();
      this.sfx('uiMove');
      this.refreshMenu();
      return;
    }
    if (dir === 0 && it.action) {
      this.game.audio?.unlock();
      this.sfx('uiConfirm');
      it.action();
      this.refreshMenu();
    } else if (dir === 0 && it.right) {
      it.right();
      this.sfx('uiMove');
      this.refreshMenu();
    }
  }

  updateMenu(dt = 0) {
    const m = this.menu;
    if (!m) return;
    if (m.cooldown > 0) {
      m.cooldown -= dt;
      return;
    }
    const inp = this.game.input;
    const step = (d) => {
      let i = m.index;
      for (let k = 0; k < m.items.length; k++) {
        i = (i + d + m.items.length) % m.items.length;
        if (!m.items[i].disabled) break;
      }
      this.focusMenu(i);
    };
    if (inp.anyPressed('up')) step(-1);
    if (inp.anyPressed('down')) step(1);
    if (inp.anyPressed('left')) this.activate(-1);
    if (inp.anyPressed('right')) this.activate(1);
    if (inp.anyPressed('confirm')) this.activate(0);
    else if (inp.anyPressed('back') && m.onBack) {
      this.sfx('uiBack');
      m.onBack();
    }
  }

  // ------------------------------------------------------------------ título
  showTitle() {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('title-screen');
    s.innerHTML = `
      <div class="logo">
        <div class="logo-fireflies"><i></i><i></i><i></i><i></i><i></i></div>
        <h1 class="logo-title">Vaga-lumes</h1>
        <div class="logo-sub">O Último Farol</div>
      </div>
      <div class="press-start">Pressione <b>A</b> · <b>Espaço</b> · <b>Enter</b> para começar</div>
      <div class="title-foot">Plataforma 3D cooperativo local · 1 a 4 jogadores · conecte até 4 controles</div>`;
  }

  showMainMenu(actions) {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('main-menu');
    s.innerHTML = `<div class="logo small"><h1 class="logo-title">Vaga-lumes</h1><div class="logo-sub">O Último Farol</div></div>`;
    const panel = h('div', 'panel menu-panel');
    s.appendChild(panel);
    this.buildMenu(panel, actions);
  }

  // ------------------------------------------------------------------ lobby
  showLobby() {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('lobby');
    s.innerHTML = `
      <div class="lobby-head"><h2>Escolham seus vaga-lumes</h2>
      <p>Cada controle (ou metade do teclado) aperta <b>A</b> / <b>Espaço</b> / <b>Enter</b> para entrar. <b>◀ ▶</b> troca de personagem, confirme para ficar pronto.</p></div>
      <div class="lobby-slots"></div>
      <div class="lobby-foot"></div>`;
    this.lobbyEls = [];
    const slots = s.querySelector('.lobby-slots');
    for (let i = 0; i < 4; i++) {
      const el = h('div', 'slot empty');
      slots.appendChild(el);
      this.lobbyEls.push(el);
    }
    this.lobbyKey = '';
  }

  updateLobby(lobby) {
    const key = JSON.stringify(lobby.slots.map((sl) => sl && [sl.deviceId, sl.charId, sl.ready])) + lobby.countdown?.toFixed(0);
    if (key === this.lobbyKey) return;
    this.lobbyKey = key;
    lobby.slots.forEach((sl, i) => {
      const el = this.lobbyEls[i];
      if (!sl) {
        el.className = 'slot empty';
        el.innerHTML = `<div class="slot-p">J${i + 1}</div><div class="slot-join">Aperte para entrar</div><div class="slot-keys">A · Espaço · Enter</div>`;
        return;
      }
      const c = charById(sl.charId);
      el.className = 'slot joined' + (sl.ready ? ' ready' : '');
      el.style.setProperty('--pc', c.color);
      el.innerHTML = `
        <div class="slot-p">J${i + 1} · ${Input.label(sl.deviceId)}</div>
        <div class="slot-name"><span class="arrow">◀</span>${c.name}<span class="arrow">▶</span></div>
        <div class="slot-title">${c.title}</div>
        <div class="slot-ability">${c.ability}</div>
        <div class="slot-state">${sl.ready ? '✔ Pronto!' : 'Confirme para ficar pronto'}</div>`;
    });
    const foot = this.layers.screen.querySelector('.lobby-foot');
    const joined = lobby.slots.filter(Boolean);
    if (lobby.countdown !== null && lobby.countdown !== undefined) foot.innerHTML = `<div class="countdown">Começando em ${Math.ceil(lobby.countdown)}…</div>`;
    else if (!joined.length) foot.innerHTML = `<span>Voltar: <b>B</b> / <b>Esc</b></span>`;
    else foot.innerHTML = `<span>${joined.filter((s) => s.ready).length}/${joined.length} prontos</span> · <span>Sair do espaço: <b>B</b> / <b>Esc</b> / <b>Backspace</b></span>`;
  }

  // ------------------------------------------------------------------ capítulos
  showChapters(levels, save, onPick, onBack) {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('chapters');
    s.innerHTML = `<h2 class="screen-title">Capítulos</h2>`;
    const panel = h('div', 'panel chapter-panel');
    s.appendChild(panel);
    const items = levels.map((L, i) => {
      const locked = i + 1 > save.data.unlocked;
      const seeds = save.seedsFor(L.id);
      return {
        label: `${L.subtitle} · ${L.name}`,
        sub: locked ? '🔒 Bloqueado' : `${seeds.map((x) => seedSvg(x)).join('')}${save.data.bestSparks[L.id] ? `<span class="best">${sparkSvg} ${save.data.bestSparks[L.id]}</span>` : ''}`,
        disabled: locked,
        action: () => onPick(i),
      };
    });
    this.buildMenu(panel, items, { onBack, cls: 'chapter-menu' });
  }

  // ------------------------------------------------------------------ diálogo
  showDialog(lines, onDone) {
    const l = this.layers.dialog;
    l.innerHTML = '';
    const box = h('div', 'dialog');
    box.innerHTML = `<div class="d-portrait"></div><div class="d-body"><div class="d-name"></div><div class="d-text"></div><div class="d-next">▼</div></div><div class="d-skip">Pular: Start / Esc</div>`;
    l.appendChild(box);
    l.classList.add('show');
    this.dialogState = { lines, i: -1, onDone, box, chars: 0, full: false, t: 0, cooldown: 0.25 };
    this.nextLine();
  }

  nextLine() {
    const d = this.dialogState;
    d.i++;
    if (d.i >= d.lines.length) return this.endDialog();
    const line = d.lines[d.i];
    const sp = SPEAKERS[line.s];
    d.box.style.setProperty('--sc', sp.color);
    d.box.querySelector('.d-portrait').innerHTML = PORTRAITS[sp.portrait];
    d.box.querySelector('.d-name').textContent = sp.name;
    d.box.classList.remove('pop');
    void d.box.offsetWidth;
    d.box.classList.add('pop');
    d.chars = 0;
    d.full = false;
    d.text = line.t;
    d.box.querySelector('.d-text').textContent = '';
    d.box.querySelector('.d-next').style.opacity = 0;
    this.game.onDialogLine?.(line);
  }

  endDialog() {
    const d = this.dialogState;
    this.dialogState = null;
    this.layers.dialog.classList.remove('show');
    setTimeout(() => {
      if (!this.dialogState) this.layers.dialog.innerHTML = '';
    }, 400);
    d?.onDone?.();
  }

  updateDialog(dt) {
    const d = this.dialogState;
    if (!d) return false;
    const inp = this.game.input;
    if (d.cooldown > 0) d.cooldown -= dt;
    if (!d.full) {
      const before = Math.floor(d.chars);
      d.chars += dt * 52;
      const n = Math.min(d.text.length, Math.floor(d.chars));
      if (n !== before && n % 3 === 0) this.sfx('typewriter');
      d.box.querySelector('.d-text').textContent = d.text.slice(0, n);
      if (n >= d.text.length) {
        d.full = true;
        d.box.querySelector('.d-next').style.opacity = 1;
      }
    }
    if (d.cooldown > 0) return true;
    if (inp.anyPressed('pause') || inp.anyPressed('back')) {
      this.endDialog();
      return true;
    }
    if (inp.anyPressed('confirm') || inp.anyPressed('jump') || inp.mouseClicked) {
      if (!d.full) {
        d.chars = d.text.length;
      } else this.nextLine();
    }
    return true;
  }

  // ------------------------------------------------------------------ HUD
  showHUD(world) {
    const l = this.layers.hud;
    l.innerHTML = `<div class="hud-top"><div class="hud-level"></div><div class="hud-seeds"></div></div><div class="hud-players"></div><div class="hud-join"></div>`;
    l.classList.add('show');
    this.hudCache = [];
    this.hudWorld = world;
    this.layers.hud.querySelector('.hud-level').innerHTML = `<b>${world.def.subtitle}</b> ${world.def.name}`;
    this.hudSeedsKey = '';
    this.hudPlayersKey = '';
  }

  hideHUD() {
    this.layers.hud.classList.remove('show');
    this.hint(null);
  }

  updateHUD() {
    const w = this.hudWorld;
    if (!w || !this.layers.hud.classList.contains('show')) return;
    const game = this.game;
    const seeds = game.session.seeds;
    const sk = seeds.join();
    if (sk !== this.hudSeedsKey) {
      this.hudSeedsKey = sk;
      this.layers.hud.querySelector('.hud-seeds').innerHTML = seeds.map((x) => seedSvg(x)).join('');
    }
    const pk = w.players.map((p) => p.slot + p.charId).join() + (w.split ? 's' : '');
    const cont = this.layers.hud.querySelector('.hud-players');
    if (pk !== this.hudPlayersKey) {
      this.hudPlayersKey = pk;
      cont.className = 'hud-players' + (w.split ? ` split split-${w.players.length}` : '');
      cont.innerHTML = '';
      this.hudEls = w.players.map((p) => {
        const e = h('div', `pcard pcard-${p.slot}`);
        e.style.setProperty('--pc', p.def.color);
        e.innerHTML = `<div class="pc-portrait">${PORTRAITS[p.charId]}</div><div class="pc-info"><div class="pc-name">J${p.slot + 1} · ${p.def.name}</div><div class="pc-hearts"></div><div class="pc-sparks">${sparkSvg}<span>0</span></div></div>`;
        cont.appendChild(e);
        return { e, hearts: -1, sparks: -1, bubble: null };
      });
    }
    w.players.forEach((p, i) => {
      const c = this.hudEls[i];
      if (!c) return;
      if (c.hearts !== p.hearts) {
        c.hearts = p.hearts;
        c.e.querySelector('.pc-hearts').innerHTML = Array.from({ length: p.maxHearts }, (_, k) => heartSvg(k < p.hearts)).join('');
      }
      if (c.sparks !== p.stats_.sparks) {
        c.sparks = p.stats_.sparks;
        const sp = c.e.querySelector('.pc-sparks span');
        sp.textContent = p.stats_.sparks;
        sp.classList.remove('bump');
        void sp.offsetWidth;
        sp.classList.add('bump');
      }
      const b = p.action === 'bubble';
      if (c.bubble !== b) {
        c.bubble = b;
        c.e.classList.toggle('bubble', b);
      }
    });
    const join = this.layers.hud.querySelector('.hud-join');
    const canJoin = w.players.length < 4 && game.state === 'play';
    const jt = canJoin ? 'Mais alguém? Aperte <b>A</b>/<b>Espaço</b>/<b>Enter</b> para entrar' : '';
    if (join.innerHTML !== jt) join.innerHTML = jt;
  }

  hudPulse(slot, kind) {
    const e = this.hudEls?.find((x) => x.e.classList.contains(`pcard-${slot}`))?.e;
    if (!e) return;
    e.classList.remove(kind);
    void e.offsetWidth;
    e.classList.add(kind);
  }

  // ------------------------------------------------------------------ mensagens
  toast(text, kind = 'info') {
    const t = h('div', `toast ${kind}`, text);
    this.layers.toasts.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3100);
    while (this.layers.toasts.children.length > 4) this.layers.toasts.firstChild.remove();
  }

  banner(title, sub, color = '#ffd27a') {
    const l = this.layers.banner;
    l.innerHTML = `<div class="banner" style="--bc:${color}"><div class="b-title">${title}</div><div class="b-sub">${sub || ''}</div></div>`;
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      const b = l.querySelector('.banner');
      if (b) b.classList.add('out');
    }, 2600);
  }

  levelCard(def) {
    this.banner(def.name, def.subtitle, '#fff1c8');
  }

  hint(text) {
    const l = this.layers.hint;
    if (!text) {
      l.classList.remove('show');
      return;
    }
    l.innerHTML = `<div class="hint-box"><span class="hint-ico">💡</span>${text}</div>`;
    l.classList.add('show');
  }

  // ------------------------------------------------------------------ pausa / opções
  showPause(actions) {
    const l = this.layers.overlay;
    l.innerHTML = '';
    l.className = 'layer layer-overlay show dim';
    const panel = h('div', 'panel pause-panel');
    panel.innerHTML = `<h2>Pausa</h2>`;
    l.appendChild(panel);
    this.buildMenu(panel, actions.items, { onBack: actions.onBack });
    const ctrl = h('div', 'controls-mini');
    ctrl.innerHTML = this.controlsHTML();
    panel.appendChild(ctrl);
  }

  hideOverlay() {
    const l = this.layers.overlay;
    l.className = 'layer layer-overlay';
    l.innerHTML = '';
    this.menu = null;
  }

  showOptions(onBack) {
    const s = this.game.settings;
    const qKeys = Object.keys(QUALITY_PRESETS);
    const cycle = (key, list, d) => {
      const i = list.indexOf(s[key]);
      s.set(key, list[(i + d + list.length) % list.length]);
    };
    const toggle = (key) => s.set(key, !s[key]);
    const vol = (key, d) => s.set(key, Math.round(Math.min(1, Math.max(0, s[key] + d)) * 10) / 10);
    const onoff = (v) => (v ? 'Ligado' : 'Desligado');
    const l = this.layers.overlay;
    l.innerHTML = '';
    l.className = 'layer layer-overlay show dim';
    const panel = h('div', 'panel options-panel');
    panel.innerHTML = `<h2>Opções</h2>`;
    l.appendChild(panel);
    this.buildMenu(panel, [
      { label: 'Qualidade gráfica', value: () => QUALITY_PRESETS[s.quality].label, left: () => cycle('quality', qKeys, -1), right: () => cycle('quality', qKeys, 1) },
      { label: 'Resolução dinâmica', value: () => onoff(s.dynamicRes), left: () => toggle('dynamicRes'), right: () => toggle('dynamicRes') },
      { label: 'Câmera na co-op', value: () => (s.splitScreen ? 'Tela dividida' : 'Compartilhada'), left: () => toggle('splitScreen'), right: () => toggle('splitScreen') },
      { label: 'Volume da música', value: () => `${Math.round(s.musicVolume * 100)}%`, left: () => vol('musicVolume', -0.1), right: () => vol('musicVolume', 0.1) },
      { label: 'Volume dos efeitos', value: () => `${Math.round(s.sfxVolume * 100)}%`, left: () => vol('sfxVolume', -0.1), right: () => vol('sfxVolume', 0.1) },
      { label: 'Tremor de tela', value: () => onoff(s.screenShake), left: () => toggle('screenShake'), right: () => toggle('screenShake') },
      { label: 'Aberração cromática', value: () => onoff(s.chromatic), left: () => toggle('chromatic'), right: () => toggle('chromatic') },
      { label: 'Granulado de filme', value: () => onoff(s.filmGrain), left: () => toggle('filmGrain'), right: () => toggle('filmGrain') },
      { label: 'Vibração do controle', value: () => onoff(s.rumble), left: () => toggle('rumble'), right: () => toggle('rumble') },
      { label: 'Mostrar FPS', value: () => onoff(s.showFps), left: () => toggle('showFps'), right: () => toggle('showFps') },
      { label: 'Voltar', action: onBack },
    ], { onBack, cls: 'options-menu' });
  }

  controlsHTML() {
    const row = (k, a) => `<tr><td>${a}</td><td>${CONTROL_HINTS.pad[k]}</td><td>${CONTROL_HINTS.kb1[k]}</td><td>${CONTROL_HINTS.kb2[k]}</td></tr>`;
    return `<table class="ctrl-table"><thead><tr><th></th><th>Controle</th><th>Teclado J1</th><th>Teclado J2</th></tr></thead><tbody>
      ${row('move', 'Andar')}${row('jump', 'Pular / pulo duplo')}${row('spin', 'Giro (ataque)')}${row('pound', 'Rolar · Patada no ar')}${row('cam', 'Girar câmera')}${row('pause', 'Pausa')}
    </tbody></table>`;
  }

  showHowTo(onBack) {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('howto');
    const panel = h('div', 'panel howto-panel');
    panel.innerHTML = `<h2>Como jogar</h2>
      ${this.controlsHTML()}
      <ul class="tips">
        <li><b>Pulo variável:</b> segure o pulo para ir mais alto. Pule de novo no ar para o <b>pulo duplo</b>.</li>
        <li><b>Rolar + pular</b> = <b>pulo longo</b>. No ar, o <b>giro</b> dá uma flutuadinha extra.</li>
        <li><b>Patada no chão</b> (no ar): quebra caixas e cria uma onda de choque que atordoa inimigos.</li>
        <li><b>Co-op:</b> pule na cabeça dos amigos para alcançar lugares altos! Quem cair vira uma <b>bolha</b> — encoste nela para reviver.</li>
        <li><b>Véus de Sombra</b> somem mais rápido com mais vaga-lumes juntos no círculo de luz.</li>
        <li>Cada capítulo esconde <b>3 Sementes de Luz</b>. A cada 50 centelhas você ganha um coração.</li>
      </ul>`;
    s.appendChild(panel);
    this.buildMenu(panel, [{ label: 'Voltar', action: onBack }], { onBack });
  }

  // ------------------------------------------------------------------ resultados
  showResults(res, onContinue) {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('results');
    const best = Math.max(...res.players.map((p) => p.sparks + p.stomps * 2 + p.seeds * 20));
    const cards = res.players
      .map((p) => {
        const score = p.sparks + p.stomps * 2 + p.seeds * 20;
        const crown = score === best && res.players.length > 1 ? crownSvg : '';
        return `<div class="rcard" style="--pc:${p.color}">
          <div class="r-crown">${crown}</div>
          <div class="r-portrait">${PORTRAITS[p.charId]}</div>
          <div class="r-name">J${p.slot + 1} · ${p.name}</div>
          <table class="r-stats">
            <tr><td>${sparkSvg} Centelhas</td><td>${p.sparks}</td></tr>
            <tr><td>Sementes de Luz</td><td>${p.seeds}</td></tr>
            <tr><td>Sombras derrotadas</td><td>${p.stomps}</td></tr>
            <tr><td>Amigos revividos</td><td>${p.revives}</td></tr>
            <tr><td>Quedas</td><td>${p.falls}</td></tr>
          </table>
        </div>`;
      })
      .join('');
    const total = res.players.reduce((a, p) => a + p.sparks, 0);
    const mm = Math.floor(res.time / 60), ss = Math.floor(res.time % 60).toString().padStart(2, '0');
    s.innerHTML = `<h2 class="screen-title">Farol aceso!</h2>
      <div class="r-summary">${sparkSvg} ${total} / ${res.totalSparks} centelhas · ${res.seeds.map((x) => seedSvg(x)).join('')} · ⏱ ${mm}:${ss}</div>
      <div class="rcards">${cards}</div>`;
    const panel = h('div', 'panel r-panel');
    s.appendChild(panel);
    this.buildMenu(panel, [{ label: 'Continuar', action: onContinue }]);
  }

  // ------------------------------------------------------------------ créditos
  showCredits(lines, onDone) {
    this.clearScreen();
    const s = this.layers.screen;
    s.classList.add('credits');
    s.innerHTML = `<div class="credits-roll">${lines.map(([a, b]) => `<div class="cr-line"><div class="cr-a">${a}</div><div class="cr-b">${b}</div></div>`).join('')}
      <div class="cr-cast">${['lampi', 'nuvi', 'musgo', 'zuca', 'candeia', 'noxPequena'].map((k) => `<div class="cr-p">${PORTRAITS[k]}</div>`).join('')}</div></div>`;
    const panel = h('div', 'panel credits-panel');
    s.appendChild(panel);
    this.buildMenu(panel, [{ label: 'Voltar ao título', action: onDone }], { onBack: onDone });
  }

  updateFps() {
    const g = this.game;
    const l = this.layers.fps;
    if (!g.settings.showFps) {
      if (l.textContent) l.textContent = '';
      return;
    }
    const st = g.renderer.stats;
    l.textContent = `${g.fps.toFixed(0)} fps · ${st.calls} draws · ${(st.tris / 1000).toFixed(0)}k tris · escala ${(st.scale * 100).toFixed(0)}%`;
  }

  update(dt) {
    if (!this.updateDialog(dt)) this.updateMenu(dt);
    this.updateHUD();
    this.updateFps();
  }
}

export { CHARACTERS };
