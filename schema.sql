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
  redeemed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_plays_customer_date ON plays(customer_id, play_date);
CREATE INDEX IF NOT EXISTS idx_plays_code ON plays(reward_code);
