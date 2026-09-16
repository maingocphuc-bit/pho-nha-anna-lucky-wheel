PHỞ NHÀ ANNA – BẢO MẬT ADMIN + HIỂN THỊ BỘ ĐẾM 600

1) D1 MIGRATION
Chạy 1 lần:
CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

2) CẤU HÌNH MẬT KHẨU KHỞI TẠO
Mật khẩu ADMIN KHÔNG nằm trong worker.js.
Anh cần tạo Cloudflare Secret tên:
ADMIN_PASSWORD

Có thể làm bằng Wrangler:
npx wrangler secret put ADMIN_PASSWORD

Hoặc vào Cloudflare Dashboard → Worker → Settings → Variables and Secrets → Add secret.

Lần đầu đăng nhập, hệ thống lấy ADMIN_PASSWORD làm mật khẩu khởi tạo và lưu dạng mã băm vào D1.
Sau khi đã khởi tạo, mật khẩu được quản lý trong D1 dạng mã băm; ADMIN_PASSWORD không còn được dùng để đăng nhập.

3) ĐỔI MẬT KHẨU
Sau khi đăng nhập Admin, dùng mục “Đổi mật khẩu quản trị”.
Mật khẩu mới được băm PBKDF2 + salt trước khi lưu D1.
Không lưu mật khẩu dạng chữ thường trong code.

4) HIỂN THỊ BỘ ĐẾM
Admin có mục “Trạng thái chương trình” hiển thị:
- Lượt hiện tại / 600
- Chu kỳ
- Lượt đã ghi nhận trong chu kỳ
- Tổng lượt đã quay

Lượt hiện tại lấy trực tiếp từ cycle_state_600, là bộ đếm dùng để cấp số thứ tự cho lượt quay.

5) RESET MẬT KHẨU KHẨN CẤP
Nếu quên mật khẩu quản trị, xóa đúng 1 dòng trong bảng admin_credentials bằng D1:
DELETE FROM admin_credentials WHERE id=1;

Sau đó đăng nhập lại bằng ADMIN_PASSWORD đang đặt trong Cloudflare Secret để khởi tạo mật khẩu mới.
