// Client-side opening book lookup (built from data/openings.tsv -> public/book.json).
const epd = (fen) => fen.split(' ').slice(0, 4).join(' ');

let bookPromise = null;
let bookData = null;

export function loadBook() {
  if (bookData) return Promise.resolve(bookData);
  if (!bookPromise) {
    bookPromise = fetch('book.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { bookData = d; return d; })
      .catch(() => null);
  }
  return bookPromise;
}

/** Look up a FEN position in the opening book. Returns { eco, name, next } or null. */
export function bookLookup(fen) {
  if (!bookData) return null;
  const hit = bookData.p[epd(fen)];
  if (!hit) return null;
  return { eco: hit[0] || '', name: bookData.n[hit[1]] || '', next: hit[2] || [] };
}

/** Walk a list of SAN moves (with a Chess factory) and find the deepest ply still in the book. */
export function findBookEnd(Chess, moves) {
  if (!bookData) return null;
  const c = new Chess();
  let last = { ply: 0, eco: '', name: '', san: '' };
  for (let i = 0; i < moves.length && i < 45; i++) {
    try { c.move(moves[i]); } catch { break; }
    const hit = bookLookup(c.fen());
    if (hit) last = { ply: i + 1, eco: hit.eco, name: hit.name, san: moves[i] };
  }
  return last;
}
