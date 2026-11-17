<?php
// Usage:
//   php tools/import_pgn.php games  <file.pgn> "<Database name>" ["<source>"]
//   php tools/import_pgn.php openings <data/openings.tsv>
require __DIR__ . '/../public/api/lib/db.php';
require __DIR__ . '/../public/api/lib/pgn.php';

$mode = $argv[1] ?? '';
$pdo = db();

/** Load named opening lines (lichess chess-openings tsv) grouped by ECO: [eco => [[name, [san...]], ...]] */
function load_book(string $tsv): array {
  $book = [];
  foreach (file($tsv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    [$eco, $name, $pgn] = array_pad(explode("\t", $line), 3, '');
    if (!preg_match('/^[A-E]\d\d$/', $eco) || $pgn === '') continue;
    $toks = array_values(array_filter(preg_split('/\s+/', preg_replace('/\d+\.(\.\.)?/', ' ', $pgn))));
    $book[$eco][] = [$name, array_map(fn($t) => rtrim($t, '+#'), $toks)];
  }
  return $book;
}

/** Deepest book line that is a prefix of the game (same-ECO lines first, any ECO as fallback): [plies, name]. */
function book_match(array $book, ?string $eco, array $moves): array {
  $norm = array_map(fn($t) => rtrim($t, '+#'), $moves);
  $best = [0, null];
  $scan = function (array $lines) use ($norm, &$best) {
    foreach ($lines as [$name, $toks]) {
      $n = count($toks);
      if ($n > $best[0] && $n <= count($norm) && array_slice($norm, 0, $n) === $toks) $best = [$n, $name];
    }
  };
  if ($eco && isset($book[$eco])) $scan($book[$eco]);
  if ($best[0] === 0) foreach ($book as $lines) $scan($lines);
  return $best;
}

if ($mode === 'openings') {
  // lichess chess-openings tsv: eco \t name \t pgn.
  // Representative name per ECO code = its shortest defining line (fewest plies, then shortest name),
  // e.g. A07 -> "King's Indian Attack" (1.Nf3 d5 2.g3), not whichever variation happens to be listed first.
  $best = [];
  foreach (file($argv[2], FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    [$eco, $name, $pgn] = array_pad(explode("\t", $line), 3, '');
    if (!preg_match('/^[A-E]\d\d$/', $eco) || $pgn === '') continue;
    $plies = count(array_filter(preg_split('/\s+/', preg_replace('/\d+\.(\.\.)?/', ' ', $pgn))));
    if (!isset($best[$eco]) || [$plies, strlen($name)] < [$best[$eco][0], strlen($best[$eco][1])]) $best[$eco] = [$plies, $name];
  }
  $st = $pdo->prepare('REPLACE INTO openings (eco, name) VALUES (?, ?)');
  foreach ($best as $eco => [, $name]) $st->execute([$eco, $name]);
  echo count($best) . " openings imported\n";
  exit(0);
}

if ($mode === 'bookplies') { // recompute for existing games: php import_pgn.php bookplies data/openings.tsv
  $book = load_book($argv[2] ?? __DIR__ . '/../data/openings.tsv');
  $upd = $pdo->prepare('UPDATE games SET book_plies = ?, book_name = ? WHERE id = ?');
  $n = 0;
  foreach ($pdo->query('SELECT id, eco, moves_san FROM games')->fetchAll() as $g) {
    [$bp, $bn] = book_match($book, $g['eco'], explode(' ', $g['moves_san']));
    $upd->execute([$bp, $bn, $g['id']]); $n++;
  }
  echo "$n games updated\n";
  exit(0);
}

if ($mode !== 'games' || empty($argv[2]) || empty($argv[3])) {
  fwrite(STDERR, "usage: import_pgn.php games <file.pgn> <db name> [source] | openings <tsv>\n");
  exit(1);
}

$file = $argv[2];
$name = $argv[3];
$dbIds = [];
$dbIdFor = function (string $n) use ($pdo, &$dbIds, $argv): int {
  if (!isset($dbIds[$n])) {
    $pdo->prepare('INSERT IGNORE INTO game_databases (name, source) VALUES (?, ?)')->execute([$n, $argv[4] ?? null]);
    $st = $pdo->prepare('SELECT id FROM game_databases WHERE name = ?'); $st->execute([$n]);
    $dbIds[$n] = (int)$st->fetchColumn();
  }
  return $dbIds[$n];
};

$ins = $pdo->prepare('INSERT IGNORE INTO games
 (db_id, external_id, event, site, game_date, round, white, black, white_elo, black_elo, white_title, black_title,
  result, eco, stronger_side, elo_gap, max_elo, book_plies, book_name, moves_san)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

$book = load_book(__DIR__ . '/../data/openings.tsv');
$added = $skipped = 0;
$pdo->beginTransaction();
foreach (parse_pgn_games(file_get_contents($file)) as $g) {
  $h = $g['headers'];
  $plies = substr_count($g['moves'], ' ') + 1;
  if (($h['Variant'] ?? 'Standard') !== 'Standard' || isset($h['FEN']) || $plies < 10 || $g['result'] === '*') {
    $skipped++; continue;
  }
  $we = isset($h['WhiteElo']) ? (int)$h['WhiteElo'] : null;
  $be = isset($h['BlackElo']) ? (int)$h['BlackElo'] : null;
  $stronger = null; $gap = 0; $max = max($we ?? 0, $be ?? 0);
  if ($we && $be && $we !== $be) { $stronger = $we > $be ? 'w' : 'b'; $gap = abs($we - $be); }
  $ext = $h['GameURL'] ?? sha1(($h['White'] ?? '') . '|' . ($h['Black'] ?? '') . '|' . ($h['Date'] ?? '') . '|' . ($h['Round'] ?? '') . '|' . $g['moves']);
  $eco = isset($h['ECO']) && preg_match('/^[A-E]\d\d/', $h['ECO']) ? substr($h['ECO'], 0, 3) : null;
  [$bp, $bn] = book_match($book, $eco, explode(' ', $g['moves']));
  $ins->execute([
    $dbIdFor($h['Database'] ?? $name), $ext, $h['Event'] ?? null, $h['Site'] ?? null, $h['Date'] ?? null, $h['Round'] ?? null,
    $h['White'] ?? '?', $h['Black'] ?? '?', $we, $be, $h['WhiteTitle'] ?? null, $h['BlackTitle'] ?? null,
    $g['result'], $eco, $stronger, $gap, $max, $bp, $bn, $g['moves'],
  ]);
  $ins->rowCount() ? $added++ : $skipped++;
}
$pdo->commit();
echo "added=$added skipped(or duplicate)=$skipped into '$name'\n";
