# Names-based opening tree (paused, not deployed)
Variant of the opening picker that selects opening NAME paths ("Sicilian Defense: Najdorf Variation") instead of ECO codes.
- Needs: `games.opening_name` (filled by `tools/classify_openings.mjs`, position based), table `user_opening_paths`, API actions
  `openings`/`set_openings`/`next_game`/`stats` from `index.php` here, `viewOpenings` from `app.js` here.
- `=path` = that exact opening without its variations (used when a branch is split).
- Last fix (exact-only rows + merge-up) was written but NOT tested when this was paused.
- Local DB: `CREATE TABLE user_opening_paths (user_id INT UNSIGNED NOT NULL, path VARCHAR(190) NOT NULL, PRIMARY KEY (user_id, path), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);`
