PHỞ NHÀ ANNA – VÒNG QUAY MAY MẮN 600 LƯỢT

BẢN CHỐT
- 600 lượt / chu kỳ.
- Giảm giá 5K: 6 giải.
- 1 Chai Sữa Tươi Mát Lạnh: 4 giải.
- 1 Ly Trà Gừng Mát Lạnh: 25 giải.
- Ăn miễn phí 2 tô phở / 1 tuần: 1 giải / chu kỳ; chu kỳ 1 ưu tiên lượt 150, từ chu kỳ 2 trở đi ưu tiên lượt 600.
- 1 Tô Phở Miễn Phí 50K: 1 giải / chu kỳ; chu kỳ 1 ưu tiên lượt 95, từ chu kỳ 2 trở đi ưu tiên lượt 310.
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


## Cơ chế mở khóa lượt quay hiện tại
- Khách hàng không nhập mã mở khóa và không quét QR mở khóa.
- Sau lượt 1, trang khách hiển thị nút `THÊM LƯỢT QUAY 2`; sau lượt 2 hiển thị `THÊM LƯỢT QUAY 3`.
- Nếu chưa được quán mở khóa, bấm nút sẽ hiện hướng dẫn điều kiện.
- Chủ quán nhập số điện thoại, chọn lượt 2 hoặc 3 và bấm `MỞ KHÓA LƯỢT NÀY`. Hệ thống cấp quyền trực tiếp trong D1.
- Sau khi chủ quán mở khóa, khách bấm lại nút `THÊM LƯỢT QUAY` để hệ thống kiểm tra và cho quay tiếp.
