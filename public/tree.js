// Annotation tree: pure logic (no DOM) so it can be unit-tested under Node.
import { Chess } from './vendor/chess.js';

export const MOVE_NAGS = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };
export const POS_NAGS = { 10: '=', 14: '+=', 15: '=+', 16: '+/-', 17: '-/+' };
export const NAG_SYMBOL = { ...MOVE_NAGS, ...POS_NAGS };

export function makeNode(san, parent = null) {
  const n = { san, nags: [], comment: '', children: [] };
  Object.defineProperty(n, 'parent', { value: parent, writable: true, enumerable: false }); // not serialized
  return n;
}

export function buildTree(sanMoves) {
  const root = makeNode(null);
  let cur = root;
  for (const san of sanMoves) {
    const n = makeNode(san, cur);
    cur.children.push(n);
    cur = n;
  }
  return root;
}

/** Restore parent links after JSON.parse */
export function reviveTree(json, parent = null) {
  const n = makeNode(json.san ?? null, parent);
  n.nags = json.nags || [];
  n.comment = json.comment || '';
  n.children = (json.children || []).map((c) => reviveTree(c, n));
  return n;
}

export function pathTo(node) {
  const p = [];
  for (let n = node; n && n.parent; n = n.parent) p.unshift(n);
  return p;
}

export function plyOf(node) { return pathTo(node).length; } // 0 = root

export function chessAt(node) {
  const c = new Chess();
  for (const n of pathTo(node)) c.move(n.san);
  return c;
}

export function addMove(node, san) {
  const existing = node.children.find((c) => c.san === san);
  if (existing) return existing;
  const n = makeNode(san, node);
  node.children.push(n);
  return n;
}

export function removeNode(node) {
  if (!node.parent) return node;
  const p = node.parent;
  p.children = p.children.filter((c) => c !== node);
  return p;
}

export function promote(node) {
  const p = node.parent;
  if (!p) return;
  p.children = [node, ...p.children.filter((c) => c !== node)];
}

/** Toggle a NAG; move NAGs (1-6) and position NAGs (10-17) are each mutually exclusive groups. */
export function toggleNag(node, nag) {
  const group = nag in MOVE_NAGS ? MOVE_NAGS : POS_NAGS;
  const had = node.nags.includes(nag);
  node.nags = node.nags.filter((x) => !(x in group));
  if (!had) node.nags.push(nag);
}

const cleanComment = (s) => s.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();

function moveText(node, ply, needNum) {
  let s = '';
  if (ply % 2 === 0) s += `${ply / 2 + 1}. `;
  else if (needNum) s += `${(ply - 1) / 2 + 1}... `;
  s += node.san;
  for (const nag of node.nags) s += ` $${nag}`;
  const cm = cleanComment(node.comment);
  if (cm) s += ` {${cm}}`;
  return s;
}

function lineText(parent, ply, needNum) {
  const kids = parent.children;
  if (!kids.length) return '';
  const main = kids[0];
  const parts = [moveText(main, ply, needNum)];
  for (const v of kids.slice(1)) {
    parts.push(`(${[moveText(v, ply, true), lineText(v, ply + 1, false)].filter(Boolean).join(' ')})`);
  }
  const hasInterruption = kids.length > 1 || cleanComment(main.comment) !== '';
  const rest = lineText(main, ply + 1, hasInterruption);
  if (rest) parts.push(rest);
  return parts.join(' ');
}

/** PGN movetext (without headers/result) incl. comments, NAGs, variations. */
export function toMovetext(root) {
  const cm = cleanComment(root.comment);
  const body = lineText(root, 0, true);
  return [cm ? `{${cm}}` : '', body].filter(Boolean).join(' ');
}
