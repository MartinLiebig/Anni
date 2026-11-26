// Client-side Stockfish 19 (lite single-threaded WASM) wrapper for the Analysis view.
import { Chess } from './vendor/chess.js';

export class Engine {
  constructor() {
    this.worker = null;
    this.ready = false;
    this.multipv = 3;
    this.depth = 18;
    this.fen = '';
    this.lines = [];
    this.curDepth = 0;
    this.onUpdate = null;
    this._pending = null;
  }

  _boot() {
    if (this.worker) return;
    this.worker = new Worker('vendor/stockfish/stockfish-19-lite-single.js');
    this.worker.onmessage = (e) => this._onLine(String(e.data || ''));
    this.worker.postMessage('uci');
  }

  _onLine(line) {
    if (line === 'uciok') {
      this.worker.postMessage(`setoption name MultiPV value ${this.multipv}`);
      this.worker.postMessage('isready');
      return;
    }
    if (line === 'readyok') {
      this.ready = true;
      if (this._pending) { const p = this._pending; this._pending = null; this.analyze(p.fen, p.opts); }
      return;
    }
    if (line.startsWith('bestmove ') && this._bestResolve) {
      const bm = line.split(/\s+/)[1];
      const res = this._bestResolve;
      this._bestResolve = null;
      res(bm && bm !== '(none)' ? bm : null);
      return;
    }
    if (!line.startsWith('info ') || !line.includes(' pv ')) return;

    const dm = /\bdepth (\d+)/.exec(line);
    const pm = /\bmultipv (\d+)/.exec(line);
    const sm = /\bscore (cp|mate) (-?\d+)/.exec(line);
    const pvMatch = /\bpv (.+)$/.exec(line);
    if (!dm || !sm || !pvMatch) return;

    const depth = +dm[1];
    const idx = pm ? +pm[1] : 1;
    if (idx > this.multipv) return;

    // Normalize score to White's perspective (UCI reports from side-to-move).
    const turn = this.fen.split(' ')[1] || 'w';
    const sign = turn === 'b' ? -1 : 1;
    const kind = sm[1];
    const val = (+sm[2]) * sign;

    const ucis = pvMatch[1].trim().split(/\s+/).slice(0, 10);
    const sans = this._uciToSan(this.fen, ucis);

    if (depth > this.curDepth) { this.curDepth = depth; }
    this.lines[idx - 1] = { idx, depth, kind, val, sans, ucis };
    if (this.onUpdate) this.onUpdate({ depth: this.curDepth, lines: this.lines.filter(Boolean) });
  }

  _uciToSan(fen, ucis) {
    const c = new Chess(fen);
    const out = [];
    for (const u of ucis) {
      try {
        const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
        if (!m) break;
        out.push({ san: m.san, ply: out.length + 1 });
      } catch { break; }
    }
    return out;
  }

  setMultiPV(n) {
    this.multipv = Math.max(1, Math.min(5, n | 0));
    if (this.worker && this.ready) {
      this.worker.postMessage('stop');
      this.worker.postMessage(`setoption name MultiPV value ${this.multipv}`);
      if (this.fen) this.analyze(this.fen, { onUpdate: this.onUpdate });
    }
  }

  setDepth(d) {
    this.depth = d === 'inf' || +d <= 0 ? 0 : Math.max(8, Math.min(40, +d));
    if (this.worker && this.ready && this.fen) this.analyze(this.fen, { onUpdate: this.onUpdate });
  }

  analyze(fen, opts = {}) {
    if (opts.onUpdate) this.onUpdate = opts.onUpdate;
    if (opts.depth !== undefined) this.depth = opts.depth === 'inf' || +opts.depth <= 0 ? 0 : +opts.depth;
    this.fen = fen;
    this.lines = [];
    this.curDepth = 0;
    this._boot();
    if (!this.ready) { this._pending = { fen, opts }; return; }
    this.worker.postMessage('stop');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(this.depth > 0 ? `go depth ${this.depth}` : 'go infinite');
  }

  stop() {
    this._pending = null;
    this._bestResolve = null;
    if (this.worker && this.ready) this.worker.postMessage('stop');
  }

  bestMove(fen, depth = 10) {
    return new Promise((resolve) => {
      this._bestResolve = resolve;
      this.analyze(fen, { depth, onUpdate: null });
    });
  }

  destroy() {
    if (this.worker) { this.worker.terminate(); this.worker = null; }
    this.ready = false;
    this._pending = null;
  }
}

/** Format a White-perspective score for display (+1.4, -0.3, #3, -#2). */
export function fmtScore(kind, val) {
  if (kind === 'mate') return val > 0 ? `#${val}` : `-#${Math.abs(val)}`;
  const n = (val / 100).toFixed(1);
  return val > 0 ? `+${n}` : n;
}

/** White's winning percentage [0..100] using Lichess's eval-bar curve. */
export function evalPct(kind, val) {
  if (kind === 'mate') return val > 0 ? 100 : 0;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * val)) - 1);
}
