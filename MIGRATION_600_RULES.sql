-- CHỈ CHẠY 1 LẦN trên D1 hiện tại của PHỞ NHÀ ANNA.
-- Không xóa dữ liệu cũ.
ALTER TABLE plays ADD COLUMN cycle600_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE plays ADD COLUMN cycle600_position INTEGER;

CREATE TABLE IF NOT EXISTS cycle_state_600 (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_no INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 600),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO cycle_state_600(id, cycle_no, position)
SELECT 1, CAST(COUNT(*) / 600 AS INTEGER) + 1, COUNT(*) % 600 FROM plays;

CREATE INDEX IF NOT EXISTS idx_plays_cycle600 ON plays(cycle600_no, cycle600_position);
