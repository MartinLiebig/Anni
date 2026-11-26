// Generates printable A4 PDF handouts (DE & EN) from public/endgames.js using Playwright.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDGAMES } from '../public/endgames.js';

const require = createRequire(import.meta.url);
const playwrightPath = process.env.PLAYWRIGHT_PATH
  || '/Users/martinliebig/.gemini/antigravity-cli/brain/e983f41d-811b-462d-b727-3882accf03ea/scratch/node_modules/playwright';
const { chromium } = require(playwrightPath);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GLYPH = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
const FILES = 'abcdefgh';

const UI = {
  de: {
    brand: 'SV Bottrop 21 · Kinder- & Jugendtraining',
    title: 'Endspiel-Grundlagen — Arbeitsblatt',
    subtitle: '3 Stufen vom Mattsetzen über Schlüsselregeln bis zu Turm vs. Läufer und Dame vs. Freibauer',
    nameLabel: 'Name:',
    dateLabel: 'Datum:',
    level: 'Stufe',
    wMove: 'Weiß am Zug',
    bMove: 'Schwarz am Zug',
    bothMove: 'Weiß oder Schwarz am Zug',
    wWins: 'Weiß gewinnt',
    draw: 'Remis',
    why: 'Begründung / Notizen:',
    plan: 'Plan / 1. Zug:',
    solutionsTitle: 'Lösungen & Trainer-Tipps',
    solutionsSub: 'Hinweis für Trainer: Diese letzte Seite enthält alle Antworten und Tipps.',
    tip: 'Tipp:',
    answer: 'Lösung:',
  },
  en: {
    brand: 'SV Bottrop 21 · Kids & Youth Training',
    title: 'Endgame Basics — Practice Handout',
    subtitle: '3 levels from basic checkmates and key rules to Rook vs Bishop and Queen vs Pawn',
    nameLabel: 'Name:',
    dateLabel: 'Date:',
    level: 'Level',
    wMove: 'White to move',
    bMove: 'Black to move',
    bothMove: 'White or Black to move',
    wWins: 'White wins',
    draw: 'Draw',
    why: 'Why? / Notes:',
    plan: 'Plan / 1st move:',
    solutionsTitle: 'Solutions & Coach Notes',
    solutionsSub: 'Coach note: This final page contains all answers and hints.',
    tip: 'Hint:',
    answer: 'Answer:',
  },
};

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function parseFenBoard(fen) {
  const rows = fen.split(' ')[0].split('/');
  return rows.map((row) => {
    const out = [];
    for (const ch of row) {
      if (/\d/.test(ch)) out.push(...Array(+ch).fill(null));
      else out.push({ color: ch === ch.toUpperCase() ? 'w' : 'b', type: ch.toLowerCase() });
    }
    return out;
  });
}

function boardSvg(fen, orientation = 'w') {
  const grid = parseFenBoard(fen);
  const sq = 22;
  const pad = 14;
  const size = sq * 8 + pad * 2;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="176" height="176" class="svg-board">`);
  parts.push(`<rect x="${pad - 1}" y="${pad - 1}" width="${sq * 8 + 2}" height="${sq * 8 + 2}" fill="none" stroke="#1e3a5f" stroke-width="1.5" rx="2"/>`);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const fr = orientation === 'w' ? r : 7 - r;
      const fc = orientation === 'w' ? c : 7 - c;
      const light = (fr + fc) % 2 === 0;
      const x = pad + c * sq;
      const y = pad + r * sq;
      parts.push(`<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="${light ? '#f2f5fa' : '#8aa5c8'}"/>`);
      const pc = grid[fr][fc];
      if (pc) {
        const isW = pc.color === 'w';
        parts.push(
          `<text x="${x + sq / 2}" y="${y + sq * 0.77}" text-anchor="middle" font-size="18.5" font-family="'Apple Symbols','Segoe UI Symbol','DejaVu Sans',sans-serif" `
          + `fill="${isW ? '#ffffff' : '#111827'}" stroke="${isW ? '#111827' : '#ffffff'}" stroke-width="${isW ? '0.9' : '0.35'}" paint-order="stroke">${GLYPH[pc.type]}</text>`
        );
      }
    }
  }

  for (let i = 0; i < 8; i++) {
    const file = FILES[orientation === 'w' ? i : 7 - i];
    const rank = orientation === 'w' ? 8 - i : i + 1;
    parts.push(`<text x="${pad + i * sq + sq / 2}" y="${size - 2.5}" text-anchor="middle" font-size="8.5" fill="#475569" font-weight="600">${file}</text>`);
    parts.push(`<text x="${pad - 5}" y="${pad + i * sq + sq * 0.65}" text-anchor="end" font-size="8.5" fill="#475569" font-weight="600">${rank}</text>`);
  }
  parts.push('</svg>');
  return parts.join('');
}

function turnBadge(eg, u) {
  if (eg.altFen) return `<span class="badge both">◐ ${esc(u.bothMove)}</span>`;
  const turn = eg.fen.split(' ')[1];
  return turn === 'w'
    ? `<span class="badge w">⬜ ${esc(u.wMove)}</span>`
    : `<span class="badge b">⬛ ${esc(u.bMove)}</span>`;
}

function answerBox(eg, u) {
  if (eg.mode === 'quiz' && eg.altFen) {
    return `
      <div class="quiz-box">
        <div class="q-row"><strong>${esc(u.wMove)}:</strong> <span class="cb">☐</span> ${esc(u.wWins)} &nbsp; <span class="cb">☐</span> ${esc(u.draw)}</div>
        <div class="q-row"><strong>${esc(u.bMove)}:</strong> <span class="cb">☐</span> ${esc(u.wWins)} &nbsp; <span class="cb">☐</span> ${esc(u.draw)}</div>
        <div class="notes">${esc(u.why)}</div>
      </div>`;
  }
  if (eg.mode === 'quiz') {
    return `
      <div class="quiz-box">
        <div class="q-row"><span class="cb">☐</span> ${esc(u.wWins)} &nbsp;&nbsp; <span class="cb">☐</span> ${esc(u.draw)}</div>
        <div class="notes">${esc(u.why)}</div>
      </div>`;
  }
  return `<div class="notes small">${esc(u.plan)}</div>`;
}

function renderHtml(lang) {
  const u = UI[lang];
  let idx = 0;
  const levelsHtml = [1, 2, 3].map((lvl) => {
    const items = ENDGAMES.filter((e) => e.level === lvl);
    const cards = items.map((eg) => {
      idx += 1;
      const txt = eg[lang];
      return `
        <article class="ex-card">
          <div class="ex-board">${boardSvg(eg.fen, eg.side)}</div>
          <div class="ex-body">
            <div class="ex-head">
              <span class="num">#${idx}</span>
              ${turnBadge(eg, u)}
            </div>
            <h3>${esc(txt.title)}</h3>
            <p class="task">${esc(txt.task)}</p>
            ${answerBox(eg, u)}
          </div>
        </article>`;
    }).join('');
    return `
      <section class="lvl-section">
        <div class="lvl-title">${esc(u.level)} ${lvl}</div>
        <div class="ex-grid">${cards}</div>
      </section>`;
  }).join('');

  let sIdx = 0;
  const solutionsHtml = ENDGAMES.map((eg) => {
    sIdx += 1;
    const txt = eg[lang];
    const body = txt.explain
      ? `<strong>${esc(u.answer)}</strong> ${esc(txt.explain)}`
      : `<strong>${esc(u.tip)}</strong> ${esc(txt.hint || '')}`;
    return `<div class="sol-item"><span class="sol-num">#${sIdx} (${esc(u.level)} ${eg.level})</span> <strong>${esc(txt.title)}:</strong> ${body}</div>`;
  }).join('');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 portrait; margin: 12mm 13mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 10px; }
  .brand { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #1d4ed8; }
  h1 { margin: 2px 0 3px; font-size: 18px; color: #0f172a; }
  .sub { margin: 0; color: #475569; font-size: 10.5px; }
  .meta { display: flex; gap: 14px; font-size: 10.5px; color: #334155; }
  .meta span { border-bottom: 1px solid #94a3b8; min-width: 95px; display: inline-block; padding-bottom: 1px; }
  .lvl-section { margin-bottom: 10px; }
  .lvl-title { background: #1e3a8a; color: #fff; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 5px; margin: 8px 0 8px; break-after: avoid; }
  .ex-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
  .ex-card { display: flex; gap: 12px; align-items: flex-start; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #fff; break-inside: avoid; }
  .ex-board { flex: 0 0 auto; }
  .svg-board { display: block; }
  .ex-body { flex: 1; min-width: 0; }
  .ex-head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .num { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 700; font-size: 10px; padding: 1px 6px; border-radius: 999px; }
  .badge { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 999px; border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; }
  h3 { margin: 0 0 3px; font-size: 13px; color: #0f172a; }
  .task { margin: 0 0 7px; font-size: 11px; color: #1e293b; }
  .quiz-box { background: #f8fafc; border: 1px dashed #94a3b8; border-radius: 6px; padding: 6px 8px; }
  .q-row { margin-bottom: 4px; font-size: 11px; }
  .cb { font-size: 13px; }
  .notes { border-top: 1px dotted #94a3b8; margin-top: 5px; padding-top: 4px; min-height: 30px; color: #64748b; font-size: 10px; }
  .notes.small { border: 1px dashed #cbd5e1; border-radius: 6px; padding: 5px 8px; min-height: 36px; background: #fafafa; }
  .solutions { page-break-before: always; }
  .sol-item { border-bottom: 1px solid #e2e8f0; padding: 6px 0; font-size: 11px; break-inside: avoid; }
  .sol-num { font-weight: 700; color: #1d4ed8; }
</style>
</head>
<body>
  <header class="header">
    <div>
      <div class="brand">${esc(u.brand)}</div>
      <h1>${esc(u.title)}</h1>
      <p class="sub">${esc(u.subtitle)}</p>
    </div>
    <div class="meta">
      <div>${esc(u.nameLabel)} <span>&nbsp;</span></div>
      <div>${esc(u.dateLabel)} <span>&nbsp;</span></div>
    </div>
  </header>
  ${levelsHtml}
  <section class="solutions">
    <header class="header">
      <div>
        <div class="brand">${esc(u.brand)}</div>
        <h1>${esc(u.solutionsTitle)}</h1>
        <p class="sub">${esc(u.solutionsSub)}</p>
      </div>
    </header>
    ${solutionsHtml}
  </section>
</body>
</html>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const lang of ['de', 'en']) {
    await page.setContent(renderHtml(lang), { waitUntil: 'load' });
    const outPath = path.join(ROOT, 'public', `endgames-handout-${lang}.pdf`);
    await page.pdf({ path: outPath, format: 'A4', printBackground: true });
    console.log('Wrote', outPath);
  }
} finally {
  await browser.close();
}
