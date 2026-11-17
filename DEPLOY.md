# Deploying to Strato (anni.sv-bottrop21.de)

Needs: PHP 8.x with `pdo_mysql` (and `curl` only for Google login), MySQL 8, HTTPS.

1. **Database** – Strato customer portal → *Datenbanken & Webspace* → create a MySQL database. Note host, name, user, password.
2. **Import** – open phpMyAdmin for that database → *Import*: first `deploy/1_schema.sql`, then `deploy/2_data.sql`
   (1.5 MB, ~2,200 games, 500 openings; contains no users). If the upload limit is hit, split `2_data.sql` by table.
3. **Upload** – via SFTP/FTP upload the **contents of `public/`** into the subdomain's document root
   (the folder assigned to anni.sv-bottrop21.de in the portal). Do **not** upload `data/`, `tools/`, `deploy/`, `README.md`.
4. **Config** – on the server copy `api/config.local.php.example` to `api/config.local.php` and fill in the DB values.
5. **HTTPS** – make sure the subdomain has an SSL certificate (Strato: *Sicherheit → SSL*) and that
   http:// redirects to https:// (required because `secure_cookie` is on).
6. **PHP version** – set the subdomain to PHP 8.2+ in the portal if it isn't already.
7. **First user** – open the site and register: the first account becomes admin. Register it yourself right away.

## Adding games later
The importer is a command-line script, and Strato shared hosting usually has no shell. So import locally, then copy only the new rows:
```
tools/fetch_lichess.sh <tournamentId> "<Database name>"      # imports into the local DB
mariadb-dump chess --no-create-info --complete-insert --skip-comments \
  --where="id > <last id already on the server>" games | grep -v '^/\*M!' > new_games.sql
```
Also export the new `game_databases` row (same flags, `--where="name='<Database name>'"`), import it first, then `new_games.sql`
in phpMyAdmin. Users, progress and annotations on the server are not touched.
Make sure `db_id` values still match: the new game rows reference the `game_databases.id` from your local DB, so import
databases in the same order locally and on the server.

## Smoke test after deploy
Register → pick openings → play a game → annotate → export PGN. Check that `https://…/api/lib/db.php` and
`https://…/api/config.local.php` return nothing / 403 (no PHP errors or credentials shown).
