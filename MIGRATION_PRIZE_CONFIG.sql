-- PHỞ NHÀ ANNA - Prize quota configuration
-- Chạy 1 lần trên D1 nếu bảng cycle_config đã tồn tại từ bản Dynamic Cycle trước.
ALTER TABLE cycle_config ADD COLUMN quota_prize0 INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cycle_config ADD COLUMN quota_prize1 INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cycle_config ADD COLUMN quota_prize2 INTEGER NOT NULL DEFAULT 6;
ALTER TABLE cycle_config ADD COLUMN quota_prize3 INTEGER NOT NULL DEFAULT 4;
ALTER TABLE cycle_config ADD COLUMN quota_prize4 INTEGER NOT NULL DEFAULT 25;
ALTER TABLE cycle_config ADD COLUMN pending_quota_prize0 INTEGER;
ALTER TABLE cycle_config ADD COLUMN pending_quota_prize1 INTEGER;
ALTER TABLE cycle_config ADD COLUMN pending_quota_prize2 INTEGER;
ALTER TABLE cycle_config ADD COLUMN pending_quota_prize3 INTEGER;
ALTER TABLE cycle_config ADD COLUMN pending_quota_prize4 INTEGER;
