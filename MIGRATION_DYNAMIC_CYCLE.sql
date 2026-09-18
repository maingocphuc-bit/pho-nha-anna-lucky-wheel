-- PHỞ NHÀ ANNA - Dynamic cycle configuration
-- Chạy 1 lần trên D1 pho-nha-anna nếu muốn khởi tạo trước khi deploy.
CREATE TABLE IF NOT EXISTS cycle_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_size INTEGER NOT NULL DEFAULT 600,
  pending_cycle_size INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO cycle_config(id,cycle_size,pending_cycle_size) VALUES(1,600,NULL);

CREATE TABLE IF NOT EXISTS cycle_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  cycle_no INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO cycle_state(id,cycle_no,position)
SELECT 1, COALESCE(MAX(cycle600_no),1), COALESCE(MAX(cycle600_position),0) FROM plays;
