#!/usr/bin/env python3
"""
Helper script to query and manage the remote Strato production database for Anni.
Reads connection credentials from .env and executes queries via SSH + PHP stdin.
"""

import sys
import os
import subprocess
import json
import re

def load_env(env_path):
    env = {}
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at {env_path}")
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

def run_remote_php(env, php_code):
    ssh_user = env.get("SSH_USER")
    ssh_server = env.get("SSH_SERVER")
    ssh_pass = env.get("SSH_PASSWORD")

    if not all([ssh_user, ssh_server, ssh_pass]):
        raise ValueError("Missing SSH_USER, SSH_SERVER, or SSH_PASSWORD in .env")

    cmd = [
        "sshpass", "-p", ssh_pass,
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ConnectTimeout=15",
        f"{ssh_user}@{ssh_server}",
        "php84"
    ]

    res = subprocess.run(cmd, input=php_code, text=True, capture_output=True)
    if res.returncode != 0 and not res.stdout:
        raise RuntimeError(f"SSH execution failed: {res.stderr}")
    
    # Strip PHP CGI headers if present
    stdout = res.stdout
    if "\r\n\r\n" in stdout:
        stdout = stdout.split("\r\n\r\n", 1)[1]
    elif "\n\n" in stdout:
        stdout = stdout.split("\n\n", 1)[1]
    return stdout.strip()

def exec_sql(env, sql, params=None):
    params_json = json.dumps(params or [])
    php = f"""<?php
$cfg = require('/mnt/web009/c1/31/51555031/htdocs/anni/api/config.php');
try {{
    $pdo = new PDO($cfg['db_dsn'], $cfg['db_user'], $cfg['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $st = $pdo->prepare({json.dumps(sql)});
    $st->execute({params_json});
    
    if ($st->columnCount() > 0) {{
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["status" => "ok", "rows" => $rows], JSON_UNESCAPED_UNICODE);
    }} else {{
        echo json_encode(["status" => "ok", "affected" => $st->rowCount()]);
    }}
}} catch (Exception $e) {{
    echo json_encode(["status" => "error", "error" => $e->getMessage()]);
}}
"""
    output = run_remote_php(env, php)
    try:
        return json.loads(output)
    except json.JSONDecodeError:
        return {"status": "error", "raw": output}

def cmd_users(env):
    res = exec_sql(env, "SELECT id, username, email, is_admin, lang, min_gap, min_rating, created_at FROM users ORDER BY id ASC")
    if res.get("status") != "ok":
        print("Error:", res.get("error") or res.get("raw"))
        return
    rows = res.get("rows", [])
    print(f"\nFound {len(rows)} user(s):")
    print(f"{'ID':<6} {'Username':<18} {'Email':<30} {'Admin':<7} {'Min Elo':<9} {'Created At'}")
    print("-" * 85)
    for r in rows:
        adm = "Yes 👑" if r.get("is_admin") == 1 else "No"
        print(f"{r['id']:<6} {r['username']:<18} {r['email']:<30} {adm:<7} {r.get('min_rating', 0):<9} {r['created_at']}")
    print()

def cmd_delete_user(env, user_ident):
    # Find user
    if user_ident.isdigit():
        check = exec_sql(env, "SELECT id, username, email FROM users WHERE id = ?", [int(user_ident)])
    else:
        check = exec_sql(env, "SELECT id, username, email FROM users WHERE username = ?", [user_ident])
    
    if check.get("status") != "ok" or not check.get("rows"):
        print(f"User '{user_ident}' not found.")
        return
    
    u = check["rows"][0]
    uid = u["id"]
    print(f"Deleting user ID {uid} ({u['username']} / {u['email']})...")
    
    res = exec_sql(env, "DELETE FROM users WHERE id = ?", [uid])
    if res.get("status") == "ok":
        print(f"Successfully deleted user {uid} ({u['username']}). Affected rows: {res.get('affected')}")
    else:
        print("Error deleting user:", res.get("error") or res.get("raw"))

def cmd_set_password(env, user_ident, new_password):
    php = f"""<?php
$cfg = require('/mnt/web009/c1/31/51555031/htdocs/anni/api/config.php');
try {{
    $pdo = new PDO($cfg['db_dsn'], $cfg['db_user'], $cfg['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pw = {json.dumps(new_password)};
    $ident = {json.dumps(user_ident)};
    $hash = password_hash($pw, PASSWORD_DEFAULT);
    $st = $pdo->prepare('UPDATE users SET pass_hash = ? WHERE username = ? OR email = ? OR id = ?');
    $st->execute([$hash, $ident, $ident, (int)$ident]);
    echo json_encode(["status" => "ok", "affected" => $st->rowCount()]);
}} catch (Exception $e) {{
    echo json_encode(["status" => "error", "error" => $e->getMessage()]);
}}
"""
    output = run_remote_php(env, php)
    try:
        res = json.loads(output)
        if res.get("status") == "ok":
            print(f"Password updated successfully for '{user_ident}'. (affected rows: {res.get('affected')})")
        else:
            print("Error updating password:", res.get("error") or res.get("raw"))
    except json.JSONDecodeError:
        print("Raw output:", output)

def cmd_stats(env):
    sql = """
    SELECT table_name, table_rows 
    FROM information_schema.tables 
    WHERE table_schema = DATABASE()
    ORDER BY table_name
    """
    res = exec_sql(env, sql)
    if res.get("status") != "ok":
        print("Error:", res.get("error") or res.get("raw"))
        return
    print("\nDatabase Table Row Counts:")
    print(f"{'Table':<25} {'Approx Rows':<15}")
    print("-" * 40)
    for r in res.get("rows", []):
        print(f"{r['table_name']:<25} {r['table_rows']:<15}")
    print()

def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env_path = os.path.join(root, ".env")
    try:
        env = load_env(env_path)
    except Exception as e:
        print(f"Error loading .env: {e}", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print("Usage: strato_db.py <command> [args]")
        print("Commands:")
        print("  users                   List all user accounts")
        print("  set-password <user> <pw> Update password for a user")
        print("  delete-user <id|name>   Delete a user account by ID or username")
        print("  stats                   Show summary table row counts")
        print("  sql <query>             Execute arbitrary SQL statement")
        sys.exit(0)

    cmd = sys.argv[1].lower()
    if cmd == "users":
        cmd_users(env)
    elif cmd == "set-password":
        if len(sys.argv) < 4:
            print("Error: set-password requires <username> <new_password>")
            sys.exit(1)
        cmd_set_password(env, sys.argv[2], sys.argv[3])
    elif cmd == "delete-user":
        if len(sys.argv) < 3:
            print("Error: delete-user requires an ID or username argument.")
            sys.exit(1)
        cmd_delete_user(env, sys.argv[2])
    elif cmd == "stats":
        cmd_stats(env)
    elif cmd == "sql":
        if len(sys.argv) < 3:
            print("Error: sql requires a query string.")
            sys.exit(1)
        sql = " ".join(sys.argv[2:])
        res = exec_sql(env, sql)
        print(json.dumps(res, indent=2, ensure_ascii=False))
    else:
        # Treat single argument as SQL if it looks like a query
        if any(cmd.startswith(kw) for kw in ["select", "show", "insert", "update", "delete", "describe"]):
            sql = " ".join(sys.argv[1:])
            res = exec_sql(env, sql)
            print(json.dumps(res, indent=2, ensure_ascii=False))
        else:
            print(f"Unknown command: {cmd}")
            sys.exit(1)

if __name__ == "__main__":
    main()
