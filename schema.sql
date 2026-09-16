PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS plays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  play_date TEXT NOT NULL,
  prize_index INTEGER NOT NULL,
  prize_name TEXT NOT NULL,
  reward_code TEXT NOT NULL UNIQUE,
  redeemed INTEGER NOT NULL DEFAULT 0,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  redeemed_at TEXT,
  expires_at TEXT,
  cycle_no INTEGER NOT NULL DEFAULT 1,
  cycle_position INTEGER,
  cycle200_no INTEGER NOT NULL DEFAULT 1,
  cycle200_position INTEGER,
  cycle600_no INTEGER NOT NULL DEFAULT 0,
  cycle600_position INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_plays_customer_date ON plays(customer_id, play_date);
CREATE INDEX IF NOT EXISTS idx_plays_code ON plays(reward_code);

CREATE TABLE IF NOT EXISTS unlock_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  customer_id INTEGER,
  phone TEXT NOT NULL,
  unlock_type INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued',
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE TABLE IF NOT EXISTS customer_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  unlock_type INTEGER NOT NULL,
  unlock_date TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(customer_id, unlock_type, unlock_date),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_unlock_tokens_token ON unlock_tokens(token);
CREATE INDEX IF NOT EXISTS idx_customer_unlocks_lookup ON customer_unlocks(customer_id, unlock_date);


-- Bộ đếm nguyên tử: không xóa bảng này trong thời gian chương trình chạy.
CREATE TABLE IF NOT EXISTS cycle_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_no INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 300),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO cycle_state(id, cycle_no, position) VALUES(1, 1, 0);
CREATE INDEX IF NOT EXISTS idx_plays_cycle ON plays(cycle_no, cycle_position);

-- Bộ đếm riêng cho giải 1 Tô Phở Miễn Phí 50K: 1 giải / 200 lượt.
CREATE TABLE IF NOT EXISTS cycle_state_200 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_no INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 200),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO cycle_state_200(id, cycle_no, position) VALUES(1, 1, 0);
CREATE INDEX IF NOT EXISTS idx_plays_cycle200 ON plays(cycle200_no, cycle200_position);

-- Bộ đếm chính 600 lượt/chu kỳ.
CREATE TABLE IF NOT EXISTS cycle_state_600 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_no INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 600),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO cycle_state_600(id, cycle_no, position) VALUES(1, 1, 0);
CREATE INDEX IF NOT EXISTS idx_plays_cycle600 ON plays(cycle600_no, cycle600_position);
