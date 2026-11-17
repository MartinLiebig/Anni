// Assign each game its opening NAME and book length by POSITION (handles transpositions).
//   node tools/classify_openings.mjs          -> only games without opening_name
//   node tools/classify_openings.mjs --all    -> recompute every game
// Reads data/openings.tsv (lichess chess-openings) and the local MariaDB via the `mariadb` CLI.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Chess } from '../public/vendor/chess.js';

const ALL = process.argv.includes('--all');
const DB = process.env.CHESS_DB || 'chess';
const epd = (c) => c.fen().split(' ').slice(0, 4).join(' ');

// position table: epd -> {name, ply}; if one position is reachable by several lines keep the one with most plies
const table = new Map();
for (const l of fs.readFileSync(new URL('../data/openings.tsv', import.meta.url), 'utf8').split('\n')) {
  const [eco, name, pgn] = l.split('\t');
  if (!/^[A-E]\d\d$/.test(eco || '') || !pgn) continue;
  const c = new Chess(); let ply = 0;
  try { for (const s of pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/)) { c.move(s); ply++; } } catch { continue; }
  const k = epd(c); const cur = table.get(k);
  if (!cur || ply > cur.ply) table.set(k, { name, ply, eco });
}

const rows = execFileSync('mariadb', ['-N', DB, '-e', `SELECT id, moves_san FROM games ${ALL ? '' : 'WHERE opening_name IS NULL'}`], { maxBuffer: 1 << 30 }).toString().split('\n').filter(Boolean);
const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
let sql = '', n = 0, named = 0;
for (const line of rows) {
  const [id, moves] = line.split('\t');
  const c = new Chess(); let best = null, plyAt = 0, p = 0;
  for (const s of moves.split(' ').slice(0, 45)) {
    try { c.move(s); } catch { break; }
    p++;
    const hit = table.get(epd(c));
    if (hit) { best = hit; plyAt = p; }
  }
  if (best) named++;
  sql += `UPDATE games SET opening_name=${best ? q(best.name) : 'NULL'}, book_plies=${plyAt}, book_name=${best ? q(best.name) : 'NULL'} WHERE id=${id};\n`;
  if (best) sql += `UPDATE games SET eco=${q(best.eco)} WHERE id=${id} AND eco IS NULL;\n`;
  n++;
  if (sql.length > 4e6) { execFileSync('mariadb', [DB], { input: sql }); sql = ''; }
}
if (sql) execFileSync('mariadb', [DB], { input: sql });
console.log(`classified ${n} games, ${named} got an opening name (position table: ${table.size} positions)`);
