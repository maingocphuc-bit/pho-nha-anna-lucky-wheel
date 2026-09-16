PHỞ NHÀ ANNA – VÒNG QUAY MAY MẮN 600 LƯỢT

BẢN CHỐT
- 600 lượt / chu kỳ.
- Giảm giá 5K: 6 giải.
- 1 Chai Sữa Tươi Mát Lạnh: 4 giải.
- 1 Ly Trà Gừng Mát Lạnh: 25 giải.
- Ăn miễn phí 2 tô phở / 1 tuần: 1 giải / chu kỳ, vị trí ưu tiên 600.
- 1 Tô Phở Miễn Phí 50K: 1 giải / chu kỳ, vị trí ưu tiên 310.
- Nếu khách ở vị trí ưu tiên không đủ điều kiện vì đã từng nhận giải đặc biệt còn lại, giải đặc biệt được chuyển sang lượt thường gần nhất đủ điều kiện (riêng vị trí 600 nếu bị chặn thì lượt 600 là lượt may mắn lần sau). Quy tắc này giữ nguyên nguyên tắc một khách không sở hữu cả hai giải đặc biệt.
- Tối đa 3 lượt/ngày; lượt 2 và 3 cần quán mở khóa.
- QR phần thưởng có thời hạn theo giải và đổi quà được kiểm soát ở admin.
- Mật khẩu admin lưu dạng băm trong D1, KHÔNG dùng Cloudflare Secret ADMIN_PASSWORD.

DEPLOY
1. Giữ nguyên wrangler.toml và D1 binding DB.
2. Đẩy các file trong thư mục này lên GitHub repo maingocphuc-bit/pho-nha-anna-lucky-wheel.
3. Cloudflare Pages/Workers deploy lại Worker.
4. Không cần tạo Secret ADMIN_PASSWORD.
5. Mở /admin.html. Lần đầu, trang sẽ hiện “Thiết lập lần đầu”; tạo mật khẩu quản trị từ 8 ký tự.
6. Sau khi tạo xong, mật khẩu được lưu trong D1 và có thể đổi ngay trong trang quản trị.

D1
- Bản D1 hiện tại đã có admin_credentials và cycle_state_600 theo các migration đã chạy trước đó.
- Không chạy lại MIGRATION_600_RULES.sql hoặc MIGRATION_REDEMPTION_AND_SPECIAL_RULES.sql nếu các cột/bảng đã tồn tại.

ADMIN
- Xem Lượt hiện tại / 600, Chu kỳ, Lượt trong chu kỳ, Tổng lượt.
- Mở khóa lượt 2/3.
- Kiểm tra và đổi quà.
- Đổi mật khẩu.
- Xem lịch sử lượt quay.
