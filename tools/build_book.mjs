// Build a compact position-keyed opening book (public/book.json) from data/openings.tsv.
// Usage: node tools/build_book.mjs
import fs from 'node:fs';
import { Chess } from '../public/vendor/chess.js';

const epd = (c) => c.fen().split(' ').slice(0, 4).join(' ');
const lines = fs.readFileSync(new URL('../data/openings.tsv', import.meta.url), 'utf8').split('\n');

const names = [''];
const nameIdx = new Map([['', 0]]);
const idxOf = (name) => {
  if (!nameIdx.has(name)) { nameIdx.set(name, names.length); names.push(name); }
  return nameIdx.get(name);
};

const pos = new Map(); // epd -> { eco, name, next: Set<string>, exact: boolean }
for (const line of lines) {
  const [eco, name, pgn] = line.split('\t');
  if (!/^[A-E]\d\d$/.test(eco || '') || !pgn) continue;
  const c = new Chess();
  const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/).filter(Boolean);
  let curEco = eco, curName = '';
  for (let i = 0; i < sans.length; i++) {
    const pk = epd(c);
    if (!pos.has(pk)) pos.set(pk, { eco: curEco, name: curName, next: new Set(), exact: false });
    let m;
    try { m = c.move(sans[i]); } catch { break; }
    pos.get(pk).next.add(m.san);

    const k = epd(c);
    const isEnd = i === sans.length - 1;
    if (isEnd) { curEco = eco; curName = name; }
    const existing = pos.get(k);
    if (!existing) {
      pos.set(k, { eco: curEco, name: curName, next: new Set(), exact: isEnd });
    } else if (isEnd && (!existing.exact || name.length > existing.name.length)) {
      existing.eco = eco;
      existing.name = name;
      existing.exact = true;
    } else if (!existing.name && curName) {
      existing.eco = curEco;
      existing.name = curName;
    }
  }
}

const p = {};
const startEpd = epd(new Chess());
for (const [k, v] of pos) {
  if (k === startEpd) p[k] = ['', 0, [...v.next]];
  else p[k] = [v.eco, idxOf(v.name), [...v.next]];
}

const outPath = new URL('../public/book.json', import.meta.url);
const json = JSON.stringify({ n: names, p });
fs.writeFileSync(outPath, json);
console.log(`Wrote ${pos.size} positions, ${names.length - 1} opening names -> public/book.json (${(json.length / 1024).toFixed(1)} KB)`);
