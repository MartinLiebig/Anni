-- Chess Study App schema (MySQL 8.0, utf8mb4)
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  email VARCHAR(190) NOT NULL UNIQUE,
  google_sub VARCHAR(64) NULL UNIQUE,      -- Google OAuth subject id
  pass_hash VARCHAR(255) NOT NULL,
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  lang CHAR(2) NOT NULL DEFAULT 'de',
  min_gap SMALLINT NOT NULL DEFAULT 0,
  min_rating SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS game_databases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL UNIQUE,
  source VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS games (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  db_id INT UNSIGNED NOT NULL,
  external_id VARCHAR(190) NOT NULL,       -- dedupe key (GameURL or hash)
  event VARCHAR(190) NULL,
  site VARCHAR(190) NULL,
  game_date VARCHAR(10) NULL,
  round VARCHAR(16) NULL,
  white VARCHAR(120) NOT NULL,
  black VARCHAR(120) NOT NULL,
  white_elo SMALLINT NULL,
  black_elo SMALLINT NULL,
  white_title VARCHAR(8) NULL,
  black_title VARCHAR(8) NULL,
  result VARCHAR(8) NOT NULL,
  eco CHAR(3) NULL,
  stronger_side ENUM('w','b') NULL,        -- NULL if Elo missing/equal
  elo_gap SMALLINT NOT NULL DEFAULT 0,
  max_elo SMALLINT NOT NULL DEFAULT 0,
  book_plies SMALLINT NOT NULL DEFAULT 0,  -- plies covered by the named ECO opening line (auto-played in training)
  book_name VARCHAR(190) NULL,             -- name of the matched opening line
  opening_name VARCHAR(190) NULL,          -- deepest named opening reached by POSITION (shown to the user; tools/classify_openings.mjs)
  moves_san MEDIUMTEXT NOT NULL,           -- clean "e4 e5 Nf3 ..." (no comments)
  UNIQUE KEY uq_game (db_id, external_id),
  KEY idx_eco (eco),
  KEY idx_opening (opening_name),
  KEY idx_gap (elo_gap),
  FOREIGN KEY (db_id) REFERENCES game_databases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS openings (
  eco CHAR(3) NOT NULL PRIMARY KEY,
  name VARCHAR(190) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_openings (
  user_id INT UNSIGNED NOT NULL,
  eco CHAR(3) NOT NULL,
  PRIMARY KEY (user_id, eco),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS progress (
  user_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  first_try_correct INT NOT NULL DEFAULT 0,
  total_moves INT NOT NULL DEFAULT 0,
  finished_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS annotations (
  user_id INT UNSIGNED NOT NULL,
  game_id INT UNSIGNED NOT NULL,
  tree_json MEDIUMTEXT NULL,               -- editable annotation tree (JSON)
  pgn_annotated MEDIUMTEXT NOT NULL,       -- full PGN with comments, NAGs, variations
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, game_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
