---
name: strato-remote-db
description: >-
  Use this skill to inspect, query, or manage the remote Strato production database and hosting server for the Anni project (e.g. listing users, deleting accounts, inspecting table row counts, executing SQL, or checking production state).
---

# Strato Production Remote Database & Hosting Skill

This skill provides procedures and utilities to interact with the deployed **Anni** environment hosted on Strato.

---

## 🔑 Architecture & Connection Model

- **Hosting Environment**: Strato Shared Hosting (Linux).
- **Webroot**: `/mnt/web009/c1/31/51555031/htdocs/anni/`
- **PHP CLI**: `php84` (PHP 8.4 CGI)
- **Firewall Restriction**: The MariaDB host (`database-5021926383.webspace-host.com:3306`) is **firewalled** from external IPs and the SSH gateway. It can only be queried from PHP scripts executing locally within the webserver environment.
- **SSH Gateway**: `51555031.ssh.w1.strato.hosting` (User: `stu110682253`).
- **Authentication**: Password is stored in the local `.env` file (`SSH_PASSWORD` / `DB_PASSWORD`).

---

## 🛠️ Preferred Tool: `tools/strato_db.py`

A dedicated helper script is available at [`tools/strato_db.py`](file:///Users/martinliebig/Projects/Anni/tools/strato_db.py). It reads connection details from `.env` and executes queries in a single SSH session by streaming PHP over stdin to `php84`.

> [!NOTE]
> Always execute with `BypassSandbox: true` since outbound SSH network access is required.

### Common Commands

#### 1. List Users
```bash
python3 tools/strato_db.py users
```
Outputs a formatted table of all registered users, roles, Elo settings, and timestamps.

#### 2. Delete a User
```bash
python3 tools/strato_db.py delete-user <username_or_id>
```
*Example:* `python3 tools/strato_db.py delete-user Alibaba` or `python3 tools/strato_db.py delete-user 6`  
Cascades automatically to delete foreign-key records in `user_openings`, `progress`, and `annotations`.

#### 3. Set a User's Password
```bash
python3 tools/strato_db.py set-password <username_or_email_or_id> '<new password>'
```
Hashes the password on the server (`password_hash`). **Never** write a bcrypt hash into a shell-quoted `sql` command: `$2y$12$...` gets expanded by the shell and silently corrupts the hash. Use `set-password` instead. Tell the user the new password and recommend changing it.

#### 4. View Table Statistics
```bash
python3 tools/strato_db.py stats
```
Displays approximate row counts for `games`, `openings`, `users`, `game_databases`, etc.

#### 5. Run Custom SQL Queries
```bash
python3 tools/strato_db.py sql "SELECT id, event, white, black, result FROM games LIMIT 5"
```
Returns structured JSON with query status, affected rows, or result sets.

---

## 💻 Direct SSH Fallback Method

If running raw shell commands directly, pipe PHP code into remote `php84` via `sshpass`:

```bash
sshpass -p "<SSH_PASSWORD>" ssh -o StrictHostKeyChecking=no stu110682253@51555031.ssh.w1.strato.hosting "php84" <<'EOF'
<?php
$cfg = require('/mnt/web009/c1/31/51555031/htdocs/anni/api/config.php');
$pdo = new PDO($cfg['db_dsn'], $cfg['db_user'], $cfg['db_pass']);
$st = $pdo->query('SELECT id, username, email FROM users');
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $u) {
    echo "USER: {$u['id']} | {$u['username']}\n";
}
EOF
```

### Strato Caveats & Diagnostics
- **Rate limiting**: Do not open rapid parallel SSH connections in tight loops. Strato will temporarily block connections for 5–10 seconds. Use single-session scripts or add `sleep 2` between calls.
- **RSA warning**: The warning `client_global_hostkeys_prove_confirm: server gave bad signature for RSA key 0` is cosmetic on Strato and can be ignored.
- **`whoami` mapping**: Strato assigns UID 974607 without a `/etc/passwd` entry; warnings regarding username lookup are normal.
