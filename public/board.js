// Chessboard: click-to-move, drag-and-drop, promotion picker (unicode pieces). Logic by chess.js.
import { Chess } from './vendor/chess.js';

const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const FILES = 'abcdefgh';
const DRAG_THRESHOLD = 6; // px before a press becomes a drag

export class Board {
  /** @param {HTMLElement} el  @param {{onMove:(m:{from:string,to:string,promotion?:string})=>void}} opts */
  constructor(el, opts) {
    this.el = el;
    this.onMove = opts.onMove;
    this.state = { fen: new Chess().fen(), orientation: 'w', lastMove: null, interactive: false, hint: null };
    this.selected = null;
    this.drag = null;
    this._promoCancel = null;
    el.classList.add('board');
    el.addEventListener('pointerdown', (e) => this.#down(e));
    el.addEventListener('pointermove', (e) => this.#move(e));
    el.addEventListener('pointerup', (e) => this.#up(e));
    el.addEventListener('pointercancel', () => this.#cancelDrag());
  }

  set(patch) {
    Object.assign(this.state, patch);
    if (patch.fen !== undefined) {
      if (this._promoCancel) this._promoCancel();
      this.selected = null;
      this.#cancelDrag(false);
    }
    this.render();
  }

  #targets() {
    if (!this.selected) return [];
    try {
      return new Chess(this.state.fen).moves({ square: this.selected, verbose: true }).map((m) => m.to);
    } catch { return []; }
  }

  #squareAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const sq = hit && hit.closest ? hit.closest('[data-sq]') : null;
    return sq && this.el.contains(sq) ? sq.dataset.sq : null;
  }

  #down(e) {
    if (!this.state.interactive || (e.button !== undefined && e.button !== 0)) return;
    if (e.target.closest('.promo')) return;
    const sq = this.#squareAt(e.clientX, e.clientY);
    if (!sq) return;
    const chess = new Chess(this.state.fen);
    const piece = chess.get(sq);

    // click-click: a piece is selected and this square is a legal target
    if (this.selected && this.#targets().includes(sq)) { this.#attempt(this.selected, sq); return; }

    if (piece && piece.color === chess.turn()) {
      this.selected = sq;
      this.render();
      this.drag = { from: sq, x: e.clientX, y: e.clientY, moved: false, ghost: null, id: e.pointerId, glyph: piece };
      try { this.el.setPointerCapture(e.pointerId); } catch {}
    } else {
      this.selected = null;
      this.render();
    }
  }

  #move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD) return;
    if (!d.moved) {
      d.moved = true;
      const src = this.el.querySelector(`[data-sq="${d.from}"]`);
      if (src) src.classList.add('dragging');
      const g = document.createElement('div');
      g.className = `drag-ghost pc ${d.glyph.color}`;
      g.textContent = GLYPH[d.glyph.type];
      const size = this.el.getBoundingClientRect().width / 8;
      g.style.width = g.style.height = `${size}px`;
      g.style.fontSize = `${size * 0.8}px`;
      document.body.appendChild(g);
      d.ghost = g;
    }
    d.ghost.style.left = `${e.clientX}px`;
    d.ghost.style.top = `${e.clientY}px`;
  }

  #up(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const wasDrag = d.moved;
    const from = d.from;
    this.#cancelDrag(false);
    if (!wasDrag) return; // a plain click: selection was already handled on pointerdown
    const to = this.#squareAt(e.clientX, e.clientY);
    if (to && to !== from && this.#targets().includes(to)) this.#attempt(from, to);
    else this.render();
  }

  #cancelDrag(rerender = true) {
    if (this.drag?.ghost) this.drag.ghost.remove();
    if (this.drag) { try { this.el.releasePointerCapture(this.drag.id); } catch {} }
    this.drag = null;
    if (rerender) this.render();
  }

  #attempt(from, to) {
    const chess = new Chess(this.state.fen);
    const mover = chess.get(from);
    const promoting = mover && mover.type === 'p' && (to[1] === '8' || to[1] === '1');
    this.selected = null;
    if (!promoting) { this.onMove({ from, to }); return; }
    this.#askPromotion(to, mover.color).then((piece) => {
      if (piece) this.onMove({ from, to, promotion: piece });
      else this.render();
    });
  }

  #askPromotion(toSq, color) {
    if (this._promoCancel) this._promoCancel();
    return new Promise((resolve) => {
      this.render();
      const o = document.createElement('div');
      o.className = 'promo';
      const onKey = (e) => { if (e.key === 'Escape') done(null); };
      const away = (e) => { if (!o.contains(e.target)) done(null); };
      const done = (v) => {
        this._promoCancel = null;
        document.removeEventListener('pointerdown', away, true);
        document.removeEventListener('keydown', onKey);
        o.remove();
        resolve(v);
      };
      this._promoCancel = () => done(null);
      o.innerHTML = ['q', 'r', 'b', 'n'].map((p) => `<button type="button" data-p="${p}" class="pc ${color}">${GLYPH[p]}</button>`).join('');
      o.addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); done(b ? b.dataset.p : null); });
      this.el.appendChild(o);
      document.addEventListener('pointerdown', away, true);
      document.addEventListener('keydown', onKey);
    });
  }

  render() {
    const { fen, orientation, lastMove, hint } = this.state;
    const chess = new Chess(fen);
    const targets = new Set(this.#targets());
    const inCheck = chess.inCheck() ? this.#kingSquare(chess, chess.turn()) : null;
    const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();
    let html = '';
    for (const r of ranks) {
      for (const f of files) {
        const sq = f + r;
        const p = chess.get(sq);
        const dark = (FILES.indexOf(f) + r) % 2 === 1 ? 'light' : 'dark';
        const cls = ['sq', dark];
        if (lastMove && (lastMove.from === sq || lastMove.to === sq)) cls.push('last');
        if (this.selected === sq) cls.push('sel');
        if (hint === sq) cls.push('hint');
        if (inCheck === sq) cls.push('check');
        if (targets.has(sq)) cls.push(p ? 'cap' : 'dot');
        const coord = (f === files[0] ? `<i class="rk">${r}</i>` : '') + (r === ranks[ranks.length - 1] ? `<i class="fl">${f}</i>` : '');
        html += `<div class="${cls.join(' ')}" data-sq="${sq}">${coord}${p ? `<b class="pc ${p.color}">${GLYPH[p.type]}</b>` : ''}</div>`;
      }
    }
    this.el.innerHTML = html;
  }

  #kingSquare(chess, color) {
    for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square;
    return null;
  }
}
