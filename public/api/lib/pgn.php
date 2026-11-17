<?php
/** Split a PGN file's text into games: yields ['headers'=>[], 'moves'=>'e4 e5 ...', 'result'=>'1-0'] */
function parse_pgn_games(string $text): Generator {
  $text = str_replace("\r", '', $text);
  $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);
  // A game starts at a header block following a blank line (or file start)
  $chunks = preg_split('/\n\s*\n(?=\[)/', "\n" . trim($text));
  foreach ($chunks as $chunk) {
    $chunk = trim($chunk);
    if ($chunk === '') continue;
    $game = parse_single_pgn($chunk);
    if ($game) yield $game;
  }
}

function parse_single_pgn(string $g): ?array {
  $headers = [];
  $lines = explode("\n", $g);
  $moveLines = [];
  foreach ($lines as $line) {
    if (preg_match('/^\[(\w+)\s+"((?:[^"\\\\]|\\\\.)*)"\]\s*$/', $line, $m)) {
      $headers[$m[1]] = stripcslashes($m[2]);
    } elseif (trim($line) !== '') {
      $moveLines[] = $line;
    }
  }
  if (!$headers || !$moveLines) return null;
  $mt = implode(' ', $moveLines);
  $mt = preg_replace('/\{[^}]*\}/s', ' ', $mt);          // {comments}
  $mt = preg_replace('/;[^\n]*/', ' ', $mt);              // ; comments (rare after join)
  // remove (nested) variations
  while (preg_match('/\([^()]*\)/', $mt)) $mt = preg_replace('/\([^()]*\)/', ' ', $mt);
  $mt = preg_replace('/\$\d+/', ' ', $mt);                // NAGs
  $mt = preg_replace('/\d+\.(\.\.)?/', ' ', $mt);         // move numbers
  $result = $headers['Result'] ?? '*';
  $tokens = [];
  foreach (preg_split('/\s+/', trim($mt)) as $t) {
    if ($t === '' || in_array($t, ['1-0', '0-1', '1/2-1/2', '*'], true)) continue;
    $t = rtrim($t, '!?');
    $tokens[] = $t;
  }
  if (!$tokens) return null;
  return ['headers' => $headers, 'moves' => implode(' ', $tokens), 'result' => $result];
}
