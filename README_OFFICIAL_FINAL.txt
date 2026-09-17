PHỞ NHÀ ANNA – LUCKY WHEEL 600
OFFICIAL FINAL – D1 ADMIN

BẢN CHẠY CHÍNH THỨC

1. Chu kỳ 600 lượt, lưu bộ đếm trong D1.
2. Giải thường theo quota mỗi chu kỳ:
   - Giảm giá 5K: 6
   - 1 Chai Sữa Tươi Mát Lạnh: 4
   - 1 Ly Trà Gừng Mát Lạnh: 25
   - Còn lại: Chúc Bạn May Mắn Lần Sau
3. Giải đặc biệt:
   - 1 Tô Phở Miễn Phí 50K: chu kỳ 1 ưu tiên lượt 95; từ chu kỳ 2 trở đi ưu tiên lượt 310.
   - Ăn miễn phí 2 tô phở / 1 tuần: chu kỳ 1 ưu tiên lượt 150; từ chu kỳ 2 trở đi ưu tiên lượt 600.
4. Không cho cùng một khách nhận cả hai giải đặc biệt.
   - Nếu khách tại đúng mốc ưu tiên không đủ điều kiện vì đã từng nhận giải đặc biệt còn lại, hệ thống chuyển giải sang lượt thường gần nhất trước đó của khách đủ điều kiện để vẫn giữ đủ 1 giải đặc biệt trong chu kỳ.
   - Chu kỳ 1 dùng mốc 95 (50K) và 150 (2 tô); từ chu kỳ 2 trở đi dùng mốc 310 (50K) và 600 (2 tô).
5. Mỗi khách tối đa 3 lượt/ngày; lượt 2 và 3 cần mã mở khóa của quán.
6. Mã QR phần thưởng dùng để kiểm tra/đổi quà tại quán.
7. Admin dùng mật khẩu hash + salt trong D1; không phụ thuộc Cloudflare ADMIN_PASSWORD.
8. Admin có: trạng thái 600, mở khóa lượt, quét QR đổi quà, nhập mã, đổi mật khẩu, xóa 1 khách, xóa toàn bộ dữ liệu test, lịch sử lượt quay.
9. Xóa toàn bộ dữ liệu khách hàng đưa bộ đếm về chu kỳ 1, vị trí 0/600; không xóa tài khoản admin.
10. Hạn dùng: 2 tô phở = 7 ngày, tối đa 1 tô/ngày; 1 tô 50K = 2 ngày; Giảm giá 5K, Sữa Tươi và Trà Gừng = 1 ngày kể từ thời điểm trúng thưởng.

LƯU Ý TRƯỚC KHI CHẠY THẬT:
- Sau khi deploy bản này, nếu dữ liệu hiện tại chỉ là dữ liệu test, dùng nút "XÓA TOÀN BỘ DỮ LIỆU KHÁCH HÀNG" một lần để đưa bộ đếm về 0/600.
- Không xóa hoặc sửa các bảng D1 hiện có.

PHÂN BỔ GIẢI NHỎ TRÊN CHU KỲ 600
- Giảm giá 5K: 6 vị trí mục tiêu trải đều trong chu kỳ.
- 1 Chai Sữa Tươi Mát Lạnh: 4 vị trí mục tiêu trải đều trong chu kỳ.
- 1 Ly Trà Gừng Mát Lạnh: 25 vị trí mục tiêu trải đều trong chu kỳ.
- Hệ thống không còn bốc ngẫu nhiên thuần túy theo quota còn lại, nên giải nhỏ không bị dồn vào đầu chu kỳ.
- Nếu một mốc mục tiêu bị giải đặc biệt chiếm, giải nhỏ bị trễ sẽ được trao ở mốc phù hợp tiếp theo; quota cuối chu kỳ vẫn được giữ.
- Chu kỳ 1: giải 50K ưu tiên lượt 95, giải 2 tô ưu tiên lượt 150 để tạo hiệu ứng thưởng sớm. Từ chu kỳ 2 trở đi: giải 50K ưu tiên lượt 310, giải 2 tô ưu tiên lượt 600.



## Luồng mở khóa đơn giản
Khách không cần nhập mã/QR mở khóa. Sau mỗi lượt, khách bấm `THÊM LƯỢT QUAY 2` hoặc `THÊM LƯỢT QUAY 3`. Chủ quán xác nhận điều kiện và mở khóa trực tiếp theo số điện thoại trong trang quản trị.
