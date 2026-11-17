<?php
// Single entry point: /api/index.php?a=<action>   (works without URL rewriting on shared hosting)
require __DIR__ . '/lib/session.php';

$c = cfg();
start_session();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function out($data, int $code = 200): never {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }
function body(): array {
  $j = json_decode(file_get_contents('php://input') ?: '', true);
  return is_array($j) ? $j : [];
}
function uid(): int {
  if (empty($_SESSION['uid'])) fail('auth', 401);
  return (int)$_SESSION['uid'];
}
function csrf(): void {
  $h = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
  if (!$h || !hash_equals($_SESSION['csrf'] ?? '', $h)) fail('csrf', 403);
}
function user_row(int $id): array {
  $st = db()->prepare('SELECT id, username, email, is_admin, lang, min_gap, min_rating, (google_sub IS NOT NULL) AS has_google FROM users WHERE id = ?');
  $st->execute([$id]);
  return $st->fetch() ?: fail('auth', 401);
}

/** SQL: the game's opening equals a selected path or lies below it (next char after the path is ':' or ','). */
const COVERED = "EXISTS (SELECT 1 FROM user_opening_paths p WHERE p.user_id = ? AND (
    (LEFT(p.path, 1) = '=' AND g.opening_name = SUBSTRING(p.path, 2))
    OR (LEFT(p.path, 1) <> '=' AND LEFT(g.opening_name, CHAR_LENGTH(p.path)) = p.path
        AND (CHAR_LENGTH(g.opening_name) = CHAR_LENGTH(p.path) OR SUBSTRING(g.opening_name, CHAR_LENGTH(p.path) + 1, 1) IN (':', ','))))
  )";

$a = $_GET['a'] ?? '';
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$pdo = db();

if ($post && !in_array($a, ['login', 'register'], true)) csrf();

switch ($a) {
  case 'me':
    $u = !empty($_SESSION['uid']) ? user_row((int)$_SESSION['uid']) : null;
    out(['user' => $u, 'csrf' => $_SESSION['csrf'], 'google' => !empty(cfg()['google_client_id'])]);

  case 'register': {
    $b = body();
    $name = trim($b['username'] ?? ''); $email = trim($b['email'] ?? ''); $pw = (string)($b['password'] ?? '');
    if (!preg_match('/^[\w.\-]{3,32}$/u', $name)) fail('invalid_username');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('invalid_email');
    if (strlen($pw) < 8) fail('weak_password');
    $exists = $pdo->prepare('SELECT 1 FROM users WHERE username = ? OR email = ?');
    $exists->execute([$name, $email]);
    if ($exists->fetch()) fail('user_exists', 409);
    $first = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
    $pdo->prepare('INSERT INTO users (username, email, pass_hash, is_admin, lang) VALUES (?,?,?,?,?)')
        ->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT), $first ? 1 : 0, in_array($b['lang'] ?? '', ['de', 'en'], true) ? $b['lang'] : 'de']);
    login_session((int)$pdo->lastInsertId());
    out(['user' => user_row($_SESSION['uid']), 'csrf' => $_SESSION['csrf']]);
  }

  case 'login': {
    $b = body();
    $st = $pdo->prepare('SELECT id, pass_hash FROM users WHERE username = ? OR email = ?');
    $st->execute([trim($b['login'] ?? ''), trim($b['login'] ?? '')]);
    $r = $st->fetch();
    if (!$r || !password_verify((string)($b['password'] ?? ''), $r['pass_hash'])) { usleep(300000); fail('bad_credentials', 401); }
    login_session((int)$r['id']);
    out(['user' => user_row((int)$r['id']), 'csrf' => $_SESSION['csrf']]);
  }

  case 'logout':
    $_SESSION = []; session_destroy(); out(['ok' => true]);

  case 'settings': {
    $u = uid(); $b = body();
    $lang = in_array($b['lang'] ?? '', ['de', 'en'], true) ? $b['lang'] : 'de';
    $pdo->prepare('UPDATE users SET lang=?, min_gap=?, min_rating=? WHERE id=?')
        ->execute([$lang, max(0, min(1500, (int)($b['min_gap'] ?? 0))), max(0, min(3000, (int)($b['min_rating'] ?? 0))), $u]);
    out(['user' => user_row($u)]);
  }

  case 'openings': { // all opening names that occur in the games (with counts) + this user's selected paths
    $u = uid();
    $names = $pdo->query('SELECT opening_name AS name, COUNT(*) AS games FROM games WHERE opening_name IS NOT NULL GROUP BY opening_name ORDER BY opening_name')->fetchAll();
    foreach ($names as &$r) $r['games'] = (int)$r['games'];
    $st = $pdo->prepare('SELECT path FROM user_opening_paths WHERE user_id = ? ORDER BY path');
    $st->execute([$u]);
    out(['names' => $names, 'selected' => array_column($st->fetchAll(), 'path')]);
  }

  case 'set_openings': {
    $u = uid();
    $paths = array_values(array_unique(array_filter(body()['paths'] ?? [], fn($p) => is_string($p) && $p !== '' && mb_strlen($p) <= 190)));
    if (count($paths) > 3000) fail('bad_payload');
    $pdo->beginTransaction();
    $pdo->prepare('DELETE FROM user_opening_paths WHERE user_id = ?')->execute([$u]);
    $ins = $pdo->prepare('INSERT IGNORE INTO user_opening_paths (user_id, path) VALUES (?, ?)');
    foreach ($paths as $p) $ins->execute([$u, $p]);
    $pdo->commit();
    out(['ok' => true, 'count' => count($paths)]);
  }

  case 'next_game': {
    $u = uid(); $me = user_row($u);
    $skip = (int)($_GET['skip'] ?? 0); // current game id the user skipped, to avoid repeating immediately
    $where = 'g.stronger_side IS NOT NULL AND g.elo_gap >= ? AND g.max_elo >= ? AND ' . COVERED . ' AND g.id <> ?';
    $params = [$me['min_gap'], $me['min_rating'], $u, $skip];
    $repeat = !empty($_GET['repeat']);
    $sql = "SELECT g.* FROM games g WHERE $where "
         . ($repeat ? '' : 'AND g.id NOT IN (SELECT game_id FROM progress WHERE user_id = ?) ')
         . 'ORDER BY RAND() LIMIT 1';
    if (!$repeat) $params[] = $u;
    $st = $pdo->prepare($sql); $st->execute($params);
    $g = $st->fetch();
    if (!$g) out(['game' => null]);
    out(['game' => game_payload($g)]);
  }

  case 'game': {
    uid();
    $st = $pdo->prepare('SELECT * FROM games WHERE id = ?'); $st->execute([(int)($_GET['id'] ?? 0)]);
    $g = $st->fetch() ?: fail('not_found', 404);
    out(['game' => game_payload($g)]);
  }

  case 'progress': {
    $u = uid(); $b = body();
    $pdo->prepare('REPLACE INTO progress (user_id, game_id, attempts, first_try_correct, total_moves) VALUES (?,?,?,?,?)')
        ->execute([$u, (int)$b['game_id'], (int)$b['attempts'], (int)$b['first_try_correct'], (int)$b['total_moves']]);
    out(['ok' => true]);
  }

  case 'stats': {
    $u = uid();
    $st = $pdo->prepare('SELECT COUNT(*) games, COALESCE(SUM(first_try_correct),0) ok, COALESCE(SUM(total_moves),0) total FROM progress WHERE user_id = ?');
    $st->execute([$u]);
    $s = $st->fetch();
    $m = $pdo->prepare('SELECT COUNT(*) FROM annotations WHERE user_id = ?'); $m->execute([$u]);
    $mine = $pdo->prepare('SELECT COUNT(*) FROM games g WHERE g.stronger_side IS NOT NULL AND ' . COVERED);
    $mine->execute([$u]);
    out(['games' => (int)$s['games'], 'first_try_correct' => (int)$s['ok'], 'total_moves' => (int)$s['total'],
         'annotated' => (int)$m->fetchColumn(), 'available' => (int)$mine->fetchColumn()]);
  }

  case 'annotation_get': {
    $u = uid();
    $st = $pdo->prepare('SELECT tree_json, updated_at FROM annotations WHERE user_id = ? AND game_id = ?');
    $st->execute([$u, (int)($_GET['game_id'] ?? 0)]);
    $r = $st->fetch();
    out(['tree' => $r && $r['tree_json'] ? json_decode($r['tree_json'], true) : null, 'updated_at' => $r['updated_at'] ?? null]);
  }

  case 'annotation_save': {
    $u = uid(); $b = body();
    $gid = (int)($b['game_id'] ?? 0);
    $g = $pdo->prepare('SELECT * FROM games WHERE id = ?'); $g->execute([$gid]);
    $game = $g->fetch() ?: fail('not_found', 404);
    $tree = $b['tree'] ?? null;
    $movetext = (string)($b['movetext'] ?? '');
    if (!is_array($tree) || strlen($movetext) > 500000) fail('bad_payload');
    $pgn = pgn_headers($game) . "\n" . $movetext . ' ' . $game['result'] . "\n";
    $pdo->prepare('REPLACE INTO annotations (user_id, game_id, tree_json, pgn_annotated) VALUES (?,?,?,?)')
        ->execute([$u, $gid, json_encode($tree), $pgn]);
    out(['ok' => true]);
  }

  case 'annotated_list': {
    $u = uid();
    $st = $pdo->prepare('SELECT g.id, g.white, g.black, g.eco, g.game_date, a.updated_at FROM annotations a JOIN games g ON g.id = a.game_id WHERE a.user_id = ? ORDER BY a.updated_at DESC');
    $st->execute([$u]);
    out(['games' => $st->fetchAll()]);
  }

  case 'export': { // PGN download: single annotated game, or all of the user's annotated games
    $u = uid();
    header('Content-Type: application/x-chess-pgn; charset=utf-8');
    $gid = (int)($_GET['game_id'] ?? 0);
    if ($gid) {
      $st = $pdo->prepare('SELECT g.*, a.pgn_annotated FROM games g LEFT JOIN annotations a ON a.game_id = g.id AND a.user_id = ? WHERE g.id = ?');
      $st->execute([$u, $gid]);
      $g = $st->fetch() ?: fail('not_found', 404);
      header('Content-Disposition: attachment; filename="game-' . $gid . '.pgn"');
      echo $g['pgn_annotated'] ?: (pgn_headers($g) . "\n" . plain_movetext($g['moves_san']) . ' ' . $g['result'] . "\n");
    } else {
      $st = $pdo->prepare('SELECT pgn_annotated FROM annotations WHERE user_id = ? ORDER BY updated_at');
      $st->execute([$u]);
      header('Content-Disposition: attachment; filename="my-annotations.pgn"');
      foreach ($st->fetchAll() as $r) echo $r['pgn_annotated'], "\n";
    }
    exit;
  }

  default:
    fail('unknown_action', 404);
}

function game_payload(array $g): array {
  $side = $g['stronger_side'] ?: 'w';
  return [
    'id' => (int)$g['id'], 'side' => $side, 'moves' => explode(' ', $g['moves_san']),
    'white' => $g['white'], 'black' => $g['black'],
    'white_elo' => $g['white_elo'] ? (int)$g['white_elo'] : null, 'black_elo' => $g['black_elo'] ? (int)$g['black_elo'] : null,
    'white_title' => $g['white_title'], 'black_title' => $g['black_title'],
    'result' => $g['result'], 'eco' => $g['eco'], 'event' => $g['event'], 'date' => $g['game_date'], 'round' => $g['round'],
    'elo_gap' => (int)$g['elo_gap'], 'book_plies' => (int)$g['book_plies'], 'book_name' => $g['book_name'], 'opening_name' => $g['opening_name'],
  ];
}

function pgn_headers(array $g): string {
  $esc = fn($s) => str_replace(['\\', '"'], ['\\\\', '\\"'], (string)$s);
  $h = [
    'Event' => $g['event'] ?: '?', 'Site' => $g['site'] ?: '?', 'Date' => $g['game_date'] ?: '????.??.??',
    'Round' => $g['round'] ?: '?', 'White' => $g['white'], 'Black' => $g['black'], 'Result' => $g['result'],
  ];
  if ($g['white_elo']) $h['WhiteElo'] = $g['white_elo'];
  if ($g['black_elo']) $h['BlackElo'] = $g['black_elo'];
  if ($g['white_title']) $h['WhiteTitle'] = $g['white_title'];
  if ($g['black_title']) $h['BlackTitle'] = $g['black_title'];
  if ($g['eco']) $h['ECO'] = $g['eco'];
  $s = '';
  foreach ($h as $k => $v) $s .= "[$k \"" . $esc($v) . "\"]\n";
  return $s;
}

function plain_movetext(string $san): string {
  $out = []; $i = 0;
  foreach (explode(' ', $san) as $m) {
    if ($i % 2 === 0) $out[] = (intdiv($i, 2) + 1) . '.';
    $out[] = $m; $i++;
  }
  return implode(' ', $out);
}
