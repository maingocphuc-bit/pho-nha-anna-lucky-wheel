-- CHỈ CHẠY 1 LẦN trên D1 hiện tại của PHỞ NHÀ ANNA.
-- Tạo nơi lưu thông tin đăng nhập quản trị dạng mã băm.
-- Không lưu mật khẩu dạng chữ thường.
CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
