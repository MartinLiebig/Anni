<?php
// Google OAuth 2.0 authorization-code flow (server side).
//   /api/oauth_google.php            -> redirects to Google   (add ?link=1 while logged in to link an existing account)
//   /api/oauth_google.php?code=&state= -> callback (this is the redirect URI to register at Google)
require __DIR__ . '/lib/session.php';
start_session();
$c = cfg();

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
$origin = rtrim($c['public_url'] ?: ($scheme . '://' . $_SERVER['HTTP_HOST']), '/');
$apiPath = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$appPath = rtrim(dirname($apiPath), '/');
$redirectUri = $origin . $apiPath . '/oauth_google.php';

function back(string $hash): never {
  global $origin, $appPath;
  header('Location: ' . $origin . $appPath . '/index.html#/' . $hash);
  exit;
}

function http(string $url, ?array $post = null, ?string $bearer = null): ?array {
  $ch = curl_init($url);
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_CONNECTTIMEOUT => 5]);
  if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
  if ($bearer) curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $bearer]);
  $res = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  $j = $res ? json_decode($res, true) : null;
  return ($code >= 200 && $code < 300 && is_array($j)) ? $j : null;
}

if (empty($c['google_client_id']) || empty($c['google_client_secret'])) back('login/oauth_unconfigured');

// ---- step 1: send the user to Google
if (!isset($_GET['code']) && !isset($_GET['error'])) {
  $_SESSION['oauth_state'] = bin2hex(random_bytes(16));
  $_SESSION['oauth_link'] = (!empty($_GET['link']) && !empty($_SESSION['uid'])) ? (int)$_SESSION['uid'] : null;
  header('Location: ' . $c['google_auth_url'] . '?' . http_build_query([
    'client_id' => $c['google_client_id'], 'redirect_uri' => $redirectUri, 'response_type' => 'code',
    'scope' => 'openid email profile', 'state' => $_SESSION['oauth_state'], 'prompt' => 'select_account',
  ]));
  exit;
}

// ---- step 2: callback
$state = $_SESSION['oauth_state'] ?? '';
$linkUid = $_SESSION['oauth_link'] ?? null;
unset($_SESSION['oauth_state'], $_SESSION['oauth_link']);
if (isset($_GET['error']) || !$state || !hash_equals($state, (string)($_GET['state'] ?? ''))) back('login/oauth_failed');

$tok = http($c['google_token_url'], [
  'code' => (string)$_GET['code'], 'client_id' => $c['google_client_id'], 'client_secret' => $c['google_client_secret'],
  'redirect_uri' => $redirectUri, 'grant_type' => 'authorization_code',
]);
$info = !empty($tok['access_token']) ? http($c['google_userinfo_url'], null, $tok['access_token']) : null;
if (!$info || empty($info['sub']) || empty($info['email']) || empty($info['email_verified'])) back('login/oauth_failed');

$sub = (string)$info['sub'];
$email = strtolower((string)$info['email']);
$pdo = db();

// link flow: attach Google to the logged-in account
if ($linkUid) {
  $taken = $pdo->prepare('SELECT id FROM users WHERE google_sub = ? AND id <> ?');
  $taken->execute([$sub, $linkUid]);
  if ($taken->fetch()) back('home/google_taken');
  $pdo->prepare('UPDATE users SET google_sub = ? WHERE id = ?')->execute([$sub, $linkUid]);
  back('home');
}

$st = $pdo->prepare('SELECT id FROM users WHERE google_sub = ?');
$st->execute([$sub]);
if ($row = $st->fetch()) { login_session((int)$row['id']); back('home'); }

// Same email as a password account: do NOT auto-link (emails are not verified at password sign-up).
$st = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
$st->execute([$email]);
if ($st->fetch()) back('login/email_taken_password');

$base = preg_replace('/[^\w.\-]/u', '', explode('@', $email)[0]);
$base = substr(strlen($base) >= 3 ? $base : $base . 'user', 0, 28);
$name = $base;
$exists = $pdo->prepare('SELECT 1 FROM users WHERE username = ?');
for ($i = 1; ; $i++) {
  $exists->execute([$name]);
  if (!$exists->fetch()) break;
  $name = $base . $i;
}
$first = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
$pdo->prepare('INSERT INTO users (username, email, google_sub, pass_hash, is_admin, lang) VALUES (?,?,?,?,?,?)')
    ->execute([$name, $email, $sub, password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT), $first ? 1 : 0, 'de']);
login_session((int)$pdo->lastInsertId());
back('home');
