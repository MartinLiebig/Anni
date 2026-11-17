# Schach-Training (local prototype)

Replay strong-vs-weaker games from the German Bundesliga (and other leagues): the app assigns you the stronger
player's side, hides that side's moves and asks you to find them (3 tries + hint, then reveal). Annotate games
(comments, NAG symbols, variations) and export them as PGN. Multi-user, German/English.

Stack: PHP 8 + MySQL/MariaDB backend (`public/api`), vanilla JS frontend (chess.js), no build step.

## Run locally
```
brew install php mariadb && brew services start mariadb
mariadb -e "CREATE DATABASE chess CHARACTER SET utf8mb4; CREATE USER 'chess'@'localhost' IDENTIFIED BY 'chess'; GRANT ALL ON chess.* TO 'chess'@'localhost';"
mariadb chess < tools/schema.sql
php tools/import_pgn.php openings data/openings.tsv
tools/fetch_lichess.sh jJzJv14g "Bundesliga 2026/27"
cd public && php -S 127.0.0.1:8000     # open http://127.0.0.1:8000
```
The first registered user becomes admin. DB credentials: `public/api/config.php` (override in `config.local.php`).

## Layout
- `public/` – SPA (`app.js`, `board.js`, `tree.js` annotation tree + PGN export, `i18n.js`) and `api/index.php` (`?a=<action>`)
- `tools/` – `schema.sql`, `import_pgn.php` (games/openings), `fetch_lichess.sh`
- `data/` – ECO list and downloaded PGNs

## Features & Known limits
- Interactive board supports click-to-move, drag-and-drop, and underpromotion picker (Queen, Rook, Bishop, Knight).
- Registration is open; no password reset or email verification.
- Only Lichess broadcast PGNs were tested as source.

## Google login (optional)
1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* (type: Web application).
2. Authorized redirect URIs: `http://127.0.0.1:8000/api/oauth_google.php` (local) and
   `https://anni.sv-bottrop21.de/api/oauth_google.php` (production).
3. Create `public/api/config.local.php` (never commit/share it):
   ```php
   <?php return [
     'google_client_id'     => '…apps.googleusercontent.com',
     'google_client_secret' => '…',
     // production only: 'public_url' => 'https://anni.sv-bottrop21.de', 'secure_cookie' => true,
   ];
   ```
The "Mit Google anmelden" button appears automatically once a client id is set. Google users are created on first
login; an email that already belongs to a password account is *not* auto-linked (emails aren't verified at
password sign-up) — log in with the password and use "Konto mit Google verknüpfen" on the start page.
PHP needs the `curl` extension.

## Opening book
`games.book_plies/book_name` hold the deepest named ECO line matching each game; training auto-plays those moves.
Recompute after changing `data/openings.tsv`: `php tools/import_pgn.php bookplies data/openings.tsv`.
