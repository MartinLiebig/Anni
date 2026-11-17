<?php
// Local defaults; override on the server via config.local.php (not committed).
$cfg = [
  'db_dsn'  => 'mysql:host=127.0.0.1;dbname=chess;charset=utf8mb4',
  'db_user' => 'chess',
  'db_pass' => 'chess',
  'session_name' => 'chessstudy',
  'secure_cookie' => false, // set true on HTTPS (Strato)
  'public_url' => '',       // e.g. https://anni.sv-bottrop21.de (optional; otherwise derived from the request)
  // Google OAuth (leave client id empty to disable). Redirect URI to register at Google:
  //   <your-origin>/api/oauth_google.php   e.g. http://127.0.0.1:8000/api/oauth_google.php
  'google_client_id' => '',
  'google_client_secret' => '',
  'google_auth_url' => 'https://accounts.google.com/o/oauth2/v2/auth',
  'google_token_url' => 'https://oauth2.googleapis.com/token',
  'google_userinfo_url' => 'https://openidconnect.googleapis.com/v1/userinfo',
];
if (is_file(__DIR__ . '/config.local.php')) {
  $cfg = array_merge($cfg, require __DIR__ . '/config.local.php');
}
return $cfg;
