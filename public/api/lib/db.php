<?php
function cfg(): array {
  static $c = null;
  return $c ??= require __DIR__ . '/../config.php';
}

function db(): PDO {
  static $pdo = null;
  if (!$pdo) {
    $c = cfg();
    $pdo = new PDO($c['db_dsn'], $c['db_user'], $c['db_pass'], [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  }
  return $pdo;
}
