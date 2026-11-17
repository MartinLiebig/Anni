<?php
require_once __DIR__ . '/db.php';

function start_session(): void {
  $c = cfg();
  session_name($c['session_name']);
  session_set_cookie_params([
    'lifetime' => 60 * 60 * 24 * 30, 'path' => '/', 'httponly' => true,
    'secure' => $c['secure_cookie'], 'samesite' => 'Lax',
  ]);
  session_start();
  if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
}

function login_session(int $uid): void {
  session_regenerate_id(true);
  $_SESSION['uid'] = $uid;
  $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
