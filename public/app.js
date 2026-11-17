import { Chess } from './vendor/chess.js';
import { Board } from './board.js';
import * as T from './tree.js';
import { t, getLang, setLang } from './i18n.js';

const API = 'api/index.php';
let csrf = '';
let user = null;
let googleEnabled = false;
let showComments = localStorage.getItem('showComments') !== '0'; // collapse/expand comments in move lists
let onlyDecisive = localStorage.getItem('only_decisive') === '1'; // filter games to 1-0 and 0-1 results only
let viewId = 0;          // incremented on each navigation; async callbacks compare to drop stale work
let cleanup = null;      // per-view teardown (key handlers, pending saves)

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(action, { body, params } = {}) {
  const qs = new URLSearchParams({ a: action, ...params });
  const res = await fetch(`${API}?${qs}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({ error: 'bad_response' }));
  if (!res.ok) {
    if (res.status === 401) { user = null; if (location.hash !== '#/login') location.hash = '#/login'; }
    throw Object.assign(new Error(data.error || 'error'), { code: data.error, status: res.status });
  }
  return data;
}

const norm = (san) => san.replace(/[+#!?]/g, '');
const errText = (e) => t('err_' + e.code) !== 'err_' + e.code ? t('err_' + e.code) : t('err_generic') + (e.code || e.message);

// ---------------------------------------------------------------- shell / routing
function shell(inner) {
  const links = [['home', 'nav_home'], ['openings', 'nav_openings'], ['train', 'nav_train'], ['mine', 'nav_mine']];
  const cur = location.hash.slice(2).split('/')[0] || 'home';
  app.innerHTML = `
    <header class="top">
      <strong class="brand">♞ ${t('app')}</strong>
      <nav>${links.map(([h, k]) => `<a href="#/${h}" class="${cur === h ? 'on' : ''}">${t(k)}</a>`).join('')}</nav>
      <span class="grow"></span>
      <button id="fs" class="ghost" title="${t('fullscreen')}">⛶</button>
      <button id="lang" class="ghost">${getLang() === 'de' ? 'EN' : 'DE'}</button>
      ${user ? `<span class="who">${esc(user.username)}</span><button id="logout" class="ghost">${t('logout')}</button>` : ''}
    </header>
    <main>${inner}</main>`;
  document.getElementById('fs').onclick = () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); };
  document.getElementById('lang').onclick = async () => {
    setLang(getLang() === 'de' ? 'en' : 'de');
    if (user) { try { await api('settings', { body: { lang: getLang(), min_gap: user.min_gap, min_rating: user.min_rating } }); user.lang = getLang(); } catch {} }
    route();
  };
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => { await api('logout', { body: {} }); user = null; const me = await api('me'); csrf = me.csrf; googleEnabled = !!me.google; location.hash = '#/login'; };
  return app.querySelector('main');
}

async function route() {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  const my = ++viewId;
  const [name, arg] = (location.hash.slice(2) || 'home').split('/');
  if (!user && name !== 'login') { location.hash = '#/login'; return; }
  try {
    switch (name) {
      case 'login': return viewLogin('login', arg);
      case 'openings': return await viewOpenings(my);
      case 'train': return await viewTrain(my, {});
      case 'annotate': return await viewAnnotate(my, parseInt(arg, 10));
      case 'mine': return await viewMine(my);
      default: return await viewHome(my, arg);
    }
  } catch (e) {
    if (e.status !== 401) shell(`<p class="err">${esc(errText(e))}</p>`);
  }
}
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------- login
function viewLogin(mode = 'login', errCode = '') {
  const reg = mode === 'register';
  shell(`
    <form id="f" class="card narrow">
      <h2>${reg ? t('register') : t('login')}</h2>
      ${reg ? `<label>${t('username')}<input name="username" required autocomplete="username"></label>
               <label>${t('email')}<input name="email" type="email" required autocomplete="email"></label>`
            : `<label>${t('login_id')}<input name="login" required autocomplete="username"></label>`}
      <label>${t('password')}<input name="password" type="password" required autocomplete="${reg ? 'new-password' : 'current-password'}"></label>
      <p class="err" id="err">${errCode ? esc(errText({ code: errCode })) : ''}</p>
      <button class="primary">${reg ? t('register') : t('login')}</button>
      ${googleEnabled ? `<a class="btn google" href="api/oauth_google.php">${t('google_login')}</a>` : ''}
      <p><a href="#" id="sw">${reg ? t('have_account') : t('no_account')}</a></p>
    </form>`);
  document.getElementById('sw').onclick = (e) => { e.preventDefault(); viewLogin(reg ? 'login' : 'register'); };
  document.getElementById('f').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    if (reg) body.lang = getLang();
    try {
      const r = await api(reg ? 'register' : 'login', { body });
      user = r.user; csrf = r.csrf; setLang(user.lang);
      location.hash = '#/home';
    } catch (err) { document.getElementById('err').textContent = errText(err); }
  };
}

// ---------------------------------------------------------------- home
async function viewHome(my, errCode = '') {
  const s = await api('stats');
  if (my !== viewId) return;
  const pct = s.total_moves ? Math.round((100 * s.first_try_correct) / s.total_moves) : 0;
  shell(`
    <h2>${t('welcome')}, ${esc(user.username)}!</h2>
    ${errCode ? `<p class="err">${esc(errText({ code: errCode }))}</p>` : ''}
    ${googleEnabled && !user.has_google ? `<p><a class="btn google" href="api/oauth_google.php?link=1">${t('google_link')}</a></p>` : ''}
    <div class="stats">
      <div class="stat"><b>${s.games}</b><span>${t('stats_games')}</span></div>
      <div class="stat"><b>${pct}%</b><span>${t('stats_acc')}</span></div>
      <div class="stat"><b>${s.available}</b><span>${t('stats_avail')}</span></div>
      <div class="stat"><b>${s.annotated}</b><span>${t('stats_annot')}</span></div>
    </div>
    ${s.available === 0 ? `<p>${t('pick_openings_first')} <a href="#/openings">${t('nav_openings')} →</a></p>`
                         : `<p><a class="btn primary" href="#/train">${t('start_training')}</a></p>`}`);
}

// ---------------------------------------------------------------- openings (ECO tree)
async function viewOpenings(my) {
  const { openings } = await api('openings');
  if (my !== viewId) return;
  const sel = new Set(openings.filter((o) => o.selected).map((o) => o.eco));
  const main = shell(`
    <h2>${t('openings_title')}</h2>
    <div class="card row">
      <strong>${t('filter_title')}</strong>
      <label>${t('min_gap')} <input id="gap" type="number" min="0" max="1500" step="50" value="${user.min_gap}"></label>
      <label>${t('min_rating')} <input id="rat" type="number" min="0" max="3000" step="50" value="${user.min_rating}"></label>
      <label class="chk"><input id="decisive_pref" type="checkbox" ${onlyDecisive ? 'checked' : ''}> ${t('only_decisive')}</label>
    </div>
    <div class="row">
      <input id="q" type="search" placeholder="${t('search')}">
      <label><input id="only" type="checkbox" checked> ${t('only_with_games')}</label>
      <button id="expand" class="ghost">${t('expand_all')}</button>
      <button id="collapse" class="ghost">${t('collapse_all')}</button>
      <button id="all" class="ghost">${t('select_visible')}</button>
      <button id="none" class="ghost">${t('clear_all')}</button>
      <span class="grow"></span>
      <span id="cnt"></span>
      <button id="save" class="primary">${t('save')}</button>
      <span id="st"></span>
    </div>
    <div id="list" class="olist"></div>`);
  const $ = (id) => main.querySelector('#' + id);
  const visible = () => {
    const q = $('q').value.trim().toLowerCase();
    return openings.filter((o) => (!$('only').checked || o.games > 0) && (!q || o.eco.toLowerCase().includes(q) || o.name.toLowerCase().includes(q)));
  };

  // ---- collapsible tree: volume (A-E) -> groups of ten codes (e.g. B20-B29) -> codes
  const openKeys = new Set([...new Set([...sel].map((e) => e[0]))]); // volumes that already contain a selection start open
  const groups = new Map(); // group key -> visible eco codes in it
  const base = (n) => n.split(':')[0];
  const groupLabel = (items) => { // most frequent opening family in the group
    const c = {};
    items.forEach((o) => { const b = base(o.name); c[b] = (c[b] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
  };
  const stat = (items) => `<span class="muted">${items.filter((o) => sel.has(o.eco)).length}/${items.length} · ${items.reduce((n, o) => n + o.games, 0)} ${t('games')}</span>`;
  const row = (o) => `<label class="orow"><input type="checkbox" data-eco="${o.eco}" ${sel.has(o.eco) ? 'checked' : ''}> <b>${o.eco}</b> ${esc(o.name)} <span class="muted">(${o.games} ${t('games')})</span></label>`;
  const draw = () => {
    const list = visible();
    const searching = $('q').value.trim() !== '';
    const keep = $('list').scrollTop;
    groups.clear();
    const tree = new Map();
    for (const o of list) {
      const v = o.eco[0], d = o.eco.slice(0, 2);
      if (!tree.has(v)) tree.set(v, new Map());
      if (!tree.get(v).has(d)) tree.get(v).set(d, []);
      tree.get(v).get(d).push(o);
    }
    let html = '';
    for (const [v, dm] of [...tree].sort()) {
      const all = [...dm.values()].flat();
      groups.set(v, all.map((o) => o.eco));
      let inner = '';
      for (const [d, items] of [...dm].sort()) {
        groups.set(d, items.map((o) => o.eco));
        inner += `<details class="dec" data-k="${d}" ${searching || openKeys.has(d) ? 'open' : ''}><summary><input type="checkbox" class="grp" data-grp="${d}"> <b>${d}0–${d}9</b> ${esc(groupLabel(items))} ${stat(items)}</summary>${items.map(row).join('')}</details>`;
      }
      html += `<details class="vol" data-k="${v}" ${searching || openKeys.has(v) ? 'open' : ''}><summary><input type="checkbox" class="grp" data-grp="${v}"> <b>${v}</b> ${t('eco_' + v)} ${stat(all)}</summary>${inner}</details>`;
    }
    $('list').innerHTML = html || '<p class="muted pad">–</p>';
    $('list').querySelectorAll('input.grp').forEach((c) => { // tri-state: none / some / all selected
      const ecos = groups.get(c.dataset.grp);
      const n = ecos.filter((e) => sel.has(e)).length;
      c.checked = n === ecos.length && n > 0;
      c.indeterminate = n > 0 && n < ecos.length;
    });
    $('cnt').textContent = `${sel.size} ${t('selected_n')}`;
    $('list').scrollTop = keep;
  };
  $('list').onchange = (e) => {
    const c = e.target;
    if (c.classList.contains('grp')) (groups.get(c.dataset.grp) || []).forEach((eco) => (c.checked ? sel.add(eco) : sel.delete(eco)));
    else c.checked ? sel.add(c.dataset.eco) : sel.delete(c.dataset.eco);
    draw();
  };
  $('list').addEventListener('toggle', (e) => { // remember what the user opened/closed (not while a search forces groups open)
    const k = e.target.dataset && e.target.dataset.k;
    if (!k || $('q').value.trim() !== '') return;
    e.target.open ? openKeys.add(k) : openKeys.delete(k);
  }, true);
  $('expand').onclick = () => { groups.forEach((_, k) => openKeys.add(k)); draw(); };
  $('collapse').onclick = () => { openKeys.clear(); draw(); };
  $('q').oninput = draw; $('only').onchange = draw;
  $('all').onclick = () => { visible().forEach((o) => sel.add(o.eco)); draw(); };
  $('none').onclick = () => { sel.clear(); draw(); };
  $('save').onclick = async () => {
    await api('set_openings', { body: { ecos: [...sel] } });
    const r = await api('settings', { body: { lang: getLang(), min_gap: +$('gap').value || 0, min_rating: +$('rat').value || 0 } });
    user = r.user;
    onlyDecisive = $('decisive_pref').checked;
    localStorage.setItem('only_decisive', onlyDecisive ? '1' : '0');
    $('st').textContent = t('saved');
  };
  draw();
}

// ---------------------------------------------------------------- training
function sanPairs(sans) {
  let out = '';
  sans.forEach((s, i) => { out += (i % 2 === 0 ? `<span class="num">${i / 2 + 1}.</span>` : '') + `<span class="mv">${esc(s)}</span> `; });
  return out;
}

async function viewTrain(my, { repeat = false, skip = 0, fresh = false }) {
  // The current game (and position) is remembered per user; it only changes on "next game" / "skip".
  const key = `train:${user.id}`;
  let resume = null;
  let game = null;
  if (!fresh) {
    try { resume = JSON.parse(localStorage.getItem(key)); } catch { resume = null; }
    if (resume && resume.gameId) {
      try { game = (await api('game', { params: { id: resume.gameId } })).game; } catch { game = null; }
    }
    if (!game) resume = null;
  }
  if (!game) ({ game } = await api('next_game', { params: { skip, ...(repeat ? { repeat: 1 } : {}), ...(onlyDecisive ? { decisive: 1 } : {}) } }));
  if (my !== viewId) return;
  if (!game) {
    localStorage.removeItem(key);
    const main = shell(`<p>${t('no_games')}</p>
      <p><label><input type="checkbox" id="rep"> ${t('repeat_games')}</label></p>
      <p><label class="chk"><input type="checkbox" id="decisive_chk" ${onlyDecisive ? 'checked' : ''}> ${t('only_decisive')}</label></p>
      <p><a class="btn" href="#/openings">${t('nav_openings')}</a></p>`);
    main.querySelector('#rep').onchange = (e) => { if (e.target.checked) viewTrain(my, { repeat: true }); };
    main.querySelector('#decisive_chk').onchange = (e) => {
      onlyDecisive = e.target.checked;
      localStorage.setItem('only_decisive', onlyDecisive ? '1' : '0');
      viewTrain(my, { repeat, fresh: true });
    };
    return;
  }
  const { tree: savedTree } = await api('annotation_get', { params: { game_id: game.id } });
  if (my !== viewId) return;
  const root = savedTree ? T.reviveTree(savedTree) : T.buildTree(game.moves);

  const mine = game.side;
  const myElo = mine === 'w' ? game.white_elo : game.black_elo;
  const oppElo = mine === 'w' ? game.black_elo : game.white_elo;
  const main = shell(`
    <div class="game-layout">
      <div class="boardwrap"><div id="board"></div></div>
      <div class="side">
        <p class="who2">${t('train_side')}: <b>${mine === 'w' ? t('white') : t('black')}</b> (${myElo ?? '?'} vs. ${oppElo ?? '?'})</p>
        <div id="bookinfo" class="muted"></div>
        <div id="msg" class="msg"></div>
        <div class="row">
          <button id="hint" class="ghost">${t('hint')}</button>
          <button id="freetrain" class="ghost" title="${t('free_mode_tt')}">${t('free_mode')}</button>
          <button id="skip" class="primary">${t('new_game')}</button>
        </div>
        <div id="train_nav" class="train-nav" style="display:none;">
          <button id="t_prev" class="ghost" type="button">${t('prev_move')}</button>
          <button id="t_next" class="primary" type="button">${t('next_move')}</button>
        </div>
        <div class="row" style="gap:12px; align-items:center; flex-wrap:wrap;">
          <label class="chk"><input type="checkbox" id="showcm" ${showComments ? 'checked' : ''}> ${t('show_comments')}</label>
          <label class="chk"><input type="checkbox" id="decisive" ${onlyDecisive ? 'checked' : ''}> ${t('only_decisive')}</label>
        </div>
        <div id="moves" class="movelist"></div>
        <div class="card notes">
          <label><span id="notelabel"></span><textarea id="note" rows="3"></textarea></label>
          <div class="row nags">
            ${[1, 2, 3, 4, 5, 6, 10, 14, 15, 16, 17].map((n) => `<button data-nag="${n}">${T.NAG_SYMBOL[n]}</button>`).join('')}
            <span class="grow"></span>
            <span id="nst" class="muted"></span>
            <button id="savenote" class="primary">${t('save')}</button>
          </div>
        </div>
        <div id="end"></div>
      </div>
    </div>`);
  const $ = (id) => main.querySelector('#' + id);
  const chess = new Chess();
  const S = { ply: 0, tries: 0, hinted: false, wrong: 0, firstTry: 0, userMoves: 0, busy: false, done: false, freeMode: false };
  const MAX_TRIES = 3;
  function persist() { // remember the current game + position so leaving the page doesn't lose it
    localStorage.setItem(key, JSON.stringify({ gameId: game.id, ply: S.ply, firstTry: S.firstTry, wrong: S.wrong, userMoves: S.userMoves, done: S.done }));
  }
  let timer = null;
  let noteDirty = false;
  let noteTimer = null;
  const nodeAtPly = (ply) => {                       // follow the game's moves through the tree (robust to promoted variations)
    let n = root;
    for (let i = 0; i < ply; i++) { n = n.children.find((c) => c.san === game.moves[i]); if (!n) return null; }
    return n;
  };
  async function saveNotes() {
    clearTimeout(noteTimer);
    if (!noteDirty) return;
    noteDirty = false;
    try {
      await api('annotation_save', { body: { game_id: game.id, tree: root, movetext: T.toMovetext(root) } });
      $('nst').textContent = t('saved');
    } catch { noteDirty = true; }
  }
  const noteChanged = () => { noteDirty = true; $('nst').textContent = '…'; clearTimeout(noteTimer); noteTimer = setTimeout(saveNotes, 1500); };
  function syncNote() {
    const n = nodeAtPly(S.ply);
    $('note').disabled = !n;
    $('note').value = n ? n.comment : '';
    $('notelabel').textContent = !n ? '' : n === root ? t('note_start') : `${t('note_after')} ${Math.ceil(S.ply / 2)}${S.ply % 2 ? '.' : '…'} ${n.san}`;
    main.querySelectorAll('[data-nag]').forEach((b) => {
      b.disabled = !n || n === root;
      b.classList.toggle('on', !!n && n.nags.includes(+b.dataset.nag));
    });
  }
  function renderMoves() { // move list incl. your symbols and comments (only up to the current position)
    let n = root, h = '';
    for (let i = 0; i < S.ply; i++) {
      n = n && n.children.find((c) => c.san === game.moves[i]);
      if (i % 2 === 0) h += `<span class="num">${i / 2 + 1}.</span>`;
      h += `<span class="mv">${esc(game.moves[i])}${n ? n.nags.map((x) => esc(T.NAG_SYMBOL[x] || '$' + x)).join('') : ''}</span> `;
      if (showComments && n && n.comment) h += `<span class="cm">${esc(n.comment)}</span> `;
    }
    $('moves').innerHTML = h;
    $('moves').scrollTop = $('moves').scrollHeight;
  }
  $('showcm').onchange = (e) => { showComments = e.target.checked; localStorage.setItem('showComments', showComments ? '1' : '0'); renderMoves(); };
  $('savenote').onclick = async () => { await saveNotes(); $('nst').textContent = t('saved'); };
  $('note').oninput = (e) => { const n = nodeAtPly(S.ply); if (n) { n.comment = e.target.value; noteChanged(); renderMoves(); } };
  main.querySelectorAll('[data-nag]').forEach((b) => { b.onclick = () => { const n = nodeAtPly(S.ply); if (n && n !== root) { T.toggleNag(n, +b.dataset.nag); noteChanged(); syncNote(); renderMoves(); } }; });
  cleanup = () => { clearTimeout(timer); saveNotes(); };

  const board = new Board($('board'), { onMove: userMove });
  const msg = (cls, text) => { $('msg').className = 'msg ' + cls; $('msg').textContent = text; };
  const draw = (extra = {}) => {
    const h = chess.history({ verbose: true });
    const last = h.at(-1);
    board.set({ fen: chess.fen(), orientation: mine, lastMove: last ? { from: last.from, to: last.to } : null, hint: null, ...extra });
    renderMoves();
    $('moves').scrollTop = $('moves').scrollHeight;
    syncNote();
    persist();
  };
  const myTurn = () => (S.ply % 2 === 0 ? 'w' : 'b') === mine;

  function advance() {
    if (my !== viewId) return;
    if (S.ply >= game.moves.length) return finish();
    if (S.freeMode) {
      S.busy = false;
      draw({ interactive: true });
      return;
    }
    if (myTurn()) {
      S.busy = false; S.tries = 0; S.hinted = false;
      msg('', t('your_move'));
      draw({ interactive: true });
    } else {
      S.busy = true;
      msg('', t('opp_move'));
      board.set({ interactive: false });
      timer = setTimeout(() => { chess.move(game.moves[S.ply]); S.ply++; draw({ interactive: false }); advance(); }, 550);
    }
  }

  function playExpected() {
    chess.move(game.moves[S.ply]); S.ply++;
  }

  function userMove(m) {
    if (S.busy || S.done) return;
    if (S.freeMode) {
      const expected = game.moves[S.ply];
      const probe = new Chess(chess.fen());
      let r;
      try { r = probe.move(m); } catch { return draw({ interactive: true }); }
      if (norm(r.san) === norm(expected)) {
        msg('ok', t('correct'));
      } else {
        msg('bad', `${t('revealed')} ${expected}`);
      }
      playExpected();
      if (S.ply >= game.moves.length) {
        draw({ interactive: false });
        finish();
      } else {
        draw({ interactive: true });
      }
      return;
    }
    if (!myTurn()) return;
    const expected = game.moves[S.ply];
    const probe = new Chess(chess.fen());
    let r;
    try { r = probe.move(m); } catch { return draw({ interactive: true }); }
    S.userMoves += 1;
    if (norm(r.san) === norm(expected)) {
      if (S.tries === 0 && !S.hinted) S.firstTry++;
      playExpected();
      draw({ interactive: false });
      msg('ok', t('correct'));
      S.busy = true;
      timer = setTimeout(advance, 350);
    } else {
      S.userMoves -= 1; // only count the move once it is solved
      S.tries++; S.wrong++;
      const left = MAX_TRIES - S.tries;
      if (left <= 0) {
        S.userMoves += 1;
        playExpected();
        draw({ interactive: false });
        msg('bad', `${t('revealed')} ${expected}`);
        S.busy = true;
        timer = setTimeout(advance, 1500);
      } else {
        msg('bad', `${t('wrong')} ${left} ${t('tries_left')}`);
        draw({ interactive: true });
      }
    }
  }

  $('freetrain').onclick = () => {
    if (S.done) return;
    S.freeMode = !S.freeMode;
    $('freetrain').classList.toggle('on', S.freeMode);
    $('train_nav').style.display = S.freeMode ? 'flex' : 'none';
    if (S.freeMode) {
      clearTimeout(timer);
      S.busy = false;
      msg('', t('free_mode_active'));
      draw({ interactive: true });
    } else {
      advance();
    }
  };

  $('t_next').onclick = () => {
    if (S.done || S.ply >= game.moves.length) return;
    playExpected();
    if (S.ply >= game.moves.length) {
      draw({ interactive: false });
      finish();
    } else {
      draw({ interactive: true });
    }
  };

  $('t_prev').onclick = () => {
    if (S.ply <= 0) return;
    clearTimeout(timer);
    S.ply--;
    chess.reset();
    for (let i = 0; i < S.ply; i++) chess.move(game.moves[i]);
    draw({ interactive: true });
  };

  $('decisive').onchange = (e) => {
    onlyDecisive = e.target.checked;
    localStorage.setItem('only_decisive', onlyDecisive ? '1' : '0');
    if (onlyDecisive && game.result === '1/2-1/2') {
      msg('', `${t('only_decisive')}: ${t('new_game')}?`);
    }
  };

  $('hint').onclick = () => {
    if (S.busy || S.done || !myTurn()) return;
    const mv = chess.moves({ verbose: true }).find((x) => norm(x.san) === norm(game.moves[S.ply]));
    if (mv) { S.hinted = true; board.set({ hint: mv.from }); }
  };
  $('skip').onclick = () => { // new game; ask first if the current one is in progress, so it isn't lost by accident
    if (S.userMoves > 0 && !S.done && !confirm(t('confirm_new'))) return;
    viewTrain(my, { repeat, skip: game.id, fresh: true });
  };

  async function finish() {
    S.done = true;
    persist();
    board.set({ interactive: false });
    $('hint').disabled = true;
    if ($('freetrain')) $('freetrain').disabled = true;
    if ($('train_nav')) $('train_nav').style.display = 'none';
    msg('', `${t('game_over')}: ${esc(game.result)}`);
    const pct = S.userMoves ? Math.round((100 * S.firstTry) / S.userMoves) : 0;

    let explainTitle = '';
    if (game.result === '1-0') {
      explainTitle = t('why_won_white').replace('{name}', esc(game.white));
    } else if (game.result === '0-1') {
      explainTitle = t('why_won_black').replace('{name}', esc(game.black));
    } else if (game.result === '1/2-1/2') {
      explainTitle = t('why_draw');
    } else {
      explainTitle = t('why_won_generic');
    }

    const finalNode = nodeAtPly(game.moves.length);
    const existingComment = finalNode ? (finalNode.comment || '') : (root.comment || '');

    $('end').innerHTML = `
      <div class="card">
        <p><b>${esc(game.white)}</b> ${game.white_title ? `(${esc(game.white_title)}) ` : ''}${game.white_elo ?? ''} –
           <b>${esc(game.black)}</b> ${game.black_title ? `(${esc(game.black_title)}) ` : ''}${game.black_elo ?? ''}</p>
        <p>${t('result')}: <b>${esc(game.result)}</b> · ${esc(game.event || '')} ${esc(game.date || '')} · ${esc(game.opening_name || game.eco || '')}</p>
        ${!S.freeMode ? `<p>${t('score')}: <b>${S.firstTry}/${S.userMoves}</b> (${pct}%)</p>` : ''}

        <div class="explain-box">
          <p class="title">${explainTitle}</p>
          <p class="sub">${t('explain_prompt')}</p>
          <textarea id="why_win" rows="3" placeholder="${t('explain_placeholder')}">${esc(existingComment)}</textarea>
          <div class="row" style="align-items: center;">
            <button id="save_why" class="primary" type="button">${t('save_explanation')}</button>
            <span id="why_st" class="muted" style="margin-left: 8px;"></span>
          </div>
        </div>

        <p><a class="btn primary" id="next" href="#/train">${t('next_game')}</a>
           <a class="btn" href="#/annotate/${game.id}">${t('review')}</a></p>
      </div>`;

    const whyBox = $('end').querySelector('#why_win');
    const saveWhyBtn = $('end').querySelector('#save_why');
    const whySt = $('end').querySelector('#why_st');

    async function saveExplanation() {
      const val = whyBox.value.trim();
      const fn = nodeAtPly(game.moves.length);
      if (fn) fn.comment = val;
      else root.comment = val;
      syncNote();
      renderMoves();
      whySt.textContent = '…';
      try {
        await api('annotation_save', { body: { game_id: game.id, tree: root, movetext: T.toMovetext(root) } });
        whySt.textContent = t('saved');
      } catch {
        whySt.textContent = 'Fehler';
      }
    }

    saveWhyBtn.onclick = saveExplanation;
    whyBox.oninput = () => {
      whySt.textContent = '';
      const fn = nodeAtPly(game.moves.length);
      if (fn) fn.comment = whyBox.value;
      noteChanged();
    };

    $('next').onclick = (e) => { e.preventDefault(); viewTrain(my, { repeat, fresh: true }); };
    await saveNotes();
    if (!S.freeMode && !(resume && resume.done)) try { await api('progress', { body: { game_id: game.id, attempts: S.wrong, first_try_correct: S.firstTry, total_moves: S.userMoves } }); } catch {}
  }

  // The named ECO opening line is played automatically; guessing starts after it.
  // Keep at least the last 2 plies for the user so there is always something to solve.
  const book = Math.max(0, Math.min(game.book_plies || 0, game.moves.length - 2));
  if (resume && resume.gameId === game.id) { // restore the saved position instead of replaying the book
    S.ply = Math.max(0, Math.min(resume.ply | 0, game.moves.length));
    for (let i = 0; i < S.ply; i++) chess.move(game.moves[i]);
    S.firstTry = resume.firstTry | 0; S.wrong = resume.wrong | 0; S.userMoves = resume.userMoves | 0;
  } else {
    for (; S.ply < book; S.ply++) chess.move(game.moves[S.ply]);
  }
  draw();
  if (book > 0) {
    $('bookinfo').textContent = `${t('book_played')} ${game.opening_name || game.book_name || game.eco || ''} · ${Math.ceil(book / 2)} ${t('moves')}`;
  }
  advance();
}

// ---------------------------------------------------------------- annotate
async function viewAnnotate(my, id) {
  const [{ game }, { tree }] = await Promise.all([api('game', { params: { id } }), api('annotation_get', { params: { game_id: id } })]);
  if (my !== viewId) return;
  const root = tree ? T.reviveTree(tree) : T.buildTree(game.moves);
  let sel = root;
  let dirty = false;
  let saveTimer = null;

  const main = shell(`
    <h2>${t('annotate_title')}</h2>
    <p><b>${esc(game.white)}</b> ${game.white_elo ?? ''} – <b>${esc(game.black)}</b> ${game.black_elo ?? ''} · ${esc(game.result)} · ${esc(game.opening_name || game.eco || '')}</p>
    <div class="game-layout with-nav">
      <div class="boardwrap">
        <div id="board"></div>
        <div class="row nav"><button id="first">⏮</button><button id="prev">◀</button><button id="next">▶</button><button id="last">⏭</button></div>
      </div>
      <div class="side">
        <label class="chk"><input type="checkbox" id="showcm" ${showComments ? 'checked' : ''}> ${t('show_comments')}</label>
        <div id="ml" class="movelist tall"></div>
        <div class="row nags">
          ${[1, 2, 3, 4, 5, 6, 10, 14, 15, 16, 17].map((n) => `<button data-nag="${n}">${T.NAG_SYMBOL[n]}</button>`).join('')}
        </div>
        <label>${t('comment')}<textarea id="cm" rows="3"></textarea></label>
        <div class="row">
          <button id="promote" class="ghost">${t('make_main')}</button>
          <button id="del" class="ghost">${t('delete_move')}</button>
        </div>
        <div class="row">
          <button id="save" class="primary">${t('save')}</button>
          <button id="exp">${t('export_game')}</button>
          <a class="btn" href="${API}?a=export">${t('export_all')}</a>
          <span id="st" class="muted"></span>
        </div>
      </div>
    </div>`);
  const $ = (q) => main.querySelector(q);
  const board = new Board($('#board'), { onMove });
  let nodes = [];

  function onMove(m) {
    const c = T.chessAt(sel);
    let r;
    try { r = c.move(m); } catch { return refresh(); }
    sel = T.addMove(sel, r.san);
    changed(); refresh(true);
  }

  const mv = (node, ply, needNum) => {
    nodes.push(node);
    const i = nodes.length - 1;
    let s = ply % 2 === 0 ? `<span class="num">${ply / 2 + 1}.</span>` : needNum ? `<span class="num">${(ply - 1) / 2 + 1}…</span>` : '';
    s += `<span class="mv${node === sel ? ' on' : ''}" data-i="${i}">${esc(node.san)}${node.nags.map((n) => esc(T.NAG_SYMBOL[n] || '$' + n)).join('')}</span> `;
    if (node.comment && showComments) s += `<span class="cm">${esc(node.comment)}</span> `;
    return s;
  };
  const line = (parent, ply, needNum) => {
    const kids = parent.children;
    if (!kids.length) return '';
    const [main0, ...vars] = kids;
    let s = mv(main0, ply, needNum);
    for (const v of vars) s += `<span class="var">(${mv(v, ply, true)}${line(v, ply + 1, false)})</span> `;
    return s + line(main0, ply + 1, vars.length > 0 || !!main0.comment);
  };

  function refresh(syncText = false) {
    const c = T.chessAt(sel);
    const last = c.history({ verbose: true }).at(-1);
    board.set({ fen: c.fen(), orientation: game.side, lastMove: last ? { from: last.from, to: last.to } : null, interactive: true });
    nodes = [root];
    $('#ml').innerHTML = `<span class="mv${sel === root ? ' on' : ''}" data-i="0">${t('start_pos')}</span> ${root.comment && showComments ? `<span class="cm">${esc(root.comment)}</span> ` : ''}` + line(root, 0, true);
    main.querySelectorAll('[data-nag]').forEach((b) => {
      b.disabled = sel === root;
      b.classList.toggle('on', sel.nags.includes(+b.dataset.nag));
    });
    $('#del').disabled = sel === root;
    $('#promote').disabled = sel === root || sel.parent.children[0] === sel;
    if (syncText) syncComment();
    const on = $('#ml .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  const syncComment = () => { $('#cm').value = sel.comment; };
  const go = (n) => { if (n) { sel = n; refresh(true); } };
  const lastOfLine = (n) => { while (n.children.length) n = n.children[0]; return n; };

  function changed() {
    dirty = true; $('#st').textContent = '…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1500);
  }
  async function save() {
    clearTimeout(saveTimer);
    if (!dirty) return;
    dirty = false;
    try {
      await api('annotation_save', { body: { game_id: game.id, tree: root, movetext: T.toMovetext(root) } });
      if (my === viewId) $('#st').textContent = t('saved');
    } catch (e) { dirty = true; if (my === viewId) $('#st').textContent = errText(e); }
  }

  $('#showcm').onchange = (e) => { showComments = e.target.checked; localStorage.setItem('showComments', showComments ? '1' : '0'); refresh(); };
  $('#ml').onclick = (e) => { const el = e.target.closest('[data-i]'); if (el) go(nodes[+el.dataset.i]); };
  $('#first').onclick = () => go(root);
  $('#prev').onclick = () => go(sel.parent);
  $('#next').onclick = () => go(sel.children[0]);
  $('#last').onclick = () => go(lastOfLine(sel));
  main.querySelectorAll('[data-nag]').forEach((b) => { b.onclick = () => { T.toggleNag(sel, +b.dataset.nag); changed(); refresh(); }; });
  $('#cm').oninput = (e) => { sel.comment = e.target.value; changed(); refresh(); };
  $('#del').onclick = () => { sel = T.removeNode(sel); changed(); refresh(true); };
  $('#promote').onclick = () => { T.promote(sel); changed(); refresh(); };
  $('#save').onclick = save;
  $('#exp').onclick = async () => { await save(); location.href = `${API}?a=export&game_id=${game.id}`; };

  const keys = (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') { go(sel.parent); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { go(sel.children[0]); e.preventDefault(); }
    else if (e.key === 'Home') { go(root); e.preventDefault(); }
    else if (e.key === 'End') { go(lastOfLine(sel)); e.preventDefault(); }
  };
  document.addEventListener('keydown', keys);
  cleanup = () => { document.removeEventListener('keydown', keys); save(); };

  refresh(true);
}

// ---------------------------------------------------------------- my annotations
async function viewMine(my) {
  const { games } = await api('annotated_list');
  if (my !== viewId) return;
  shell(`
    <h2>${t('mine_title')}</h2>
    ${games.length ? `<ul class="list">${games.map((g) =>
      `<li><a href="#/annotate/${g.id}">${esc(g.white)} – ${esc(g.black)}</a> <span class="muted">${esc(g.eco || '')} · ${esc(g.game_date || '')} · ${esc(g.updated_at)}</span></li>`).join('')}</ul>
      <p><a class="btn" href="${API}?a=export">${t('export_all')}</a></p>` : `<p>${t('none_yet')}</p>`}`);
}

// ---------------------------------------------------------------- boot
(async function boot() {
  try {
    const me = await api('me');
    csrf = me.csrf; user = me.user; googleEnabled = !!me.google;
    if (user) setLang(user.lang);
  } catch {}
  if (!location.hash) location.hash = user ? '#/home' : '#/login';
  route();
})();
