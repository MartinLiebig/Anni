---
name: strato-deploy
description: >-
  Use this skill to deploy the Anni web application to Strato production hosting (anni.sv-bottrop21.de), verify syntax, rebuild book.json if needed, and smoke-check live endpoints.
---

# Strato Production Deployment Skill

Use this skill whenever deploying updates from `public/` to the live Strato server (`http://anni.sv-bottrop21.de`).

---

## 🎯 Target Environment

- **Remote path**: `/mnt/web009/c1/31/51555031/htdocs/anni/`
- **SSH Host / User**: Read from `.env` (`SSH_SERVER`, `SSH_USER`, `SSH_PASSWORD`)
- **Excluded from deploy**: `api/config.local.php` (server-specific DB/OAuth secrets), `data/`, `tools/`, `deploy/`, `wip/`, `README.md`

---

## 🚀 Deployment Steps

### 1. Pre-flight Checks (Local)
Run syntax checks on modified JS/PHP files:
```bash
node --check public/app.js && node --check public/board.js && node --check public/book.js && node --check public/i18n.js
php -l public/api/index.php
```
If `data/openings.tsv` changed, rebuild the client-side opening book first:
```bash
node tools/build_book.mjs
```

### 2. Deploy via Helper Script
Run [deploy.sh](./scripts/deploy.sh) (supports `--dry-run` to preview the archive):
```bash
.agents/skills/strato-deploy/scripts/deploy.sh
```
The script automatically:
1. Reads `SSH_SERVER`, `SSH_USER`, and `SSH_PASSWORD` from `.env`.
2. Creates a tarball of `public/` using `--no-xattrs` and `--exclude='api/config.local.php'`.
3. Uploads to `~` via `scp` (Strato blocks direct `scp` writes into some subdirs, so upload to `~` then extract into `htdocs/anni/`).
4. Waits 2 seconds between `scp` and `ssh` to avoid Strato's SSH rate limiter, then extracts and removes the archive.
5. Smoke-checks `/`, `/app.js`, `/book.js`, `/book.json`, `/i18n.js`, `/styles.css`, `/api/index.php?a=me` (all HTTP 200) and `/api/config.local.php` (HTTP 403).

---

## ⚠️ Strato Notes
- **Always use `--no-xattrs`** when creating tarballs on macOS so Strato's `tar` does not print `LIBARCHIVE.xattr.*` warnings.
- **Rate limiting**: Avoid rapid back-to-back SSH connections; keep a `sleep 2` between `scp` and `ssh`.
- **Database changes**: Deploying code does **not** touch the database. For DB queries or migrations, use the `strato-remote-db` skill (`tools/strato_db.py`).
