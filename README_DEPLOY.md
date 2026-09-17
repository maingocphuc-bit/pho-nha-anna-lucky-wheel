# PHỞ NHÀ ANNA – Lucky Wheel V10.1 ADMIN FIX

Bản này được sửa trực tiếp từ `PHO_NHA_ANNA_LUCKY_WHEEL_V10_FIXED_3_LOI.zip`.

## Đã sửa theo yêu cầu
1. **Thêm khung Xóa dữ liệu**: xóa 1 khách theo SĐT hoặc xóa toàn bộ dữ liệu khách hàng/lượt quay/mã mở khóa; có xác nhận 2 bước.
2. **Camera đổi quà**: camera nằm ngay trong khung `Kiểm tra và đổi quà`, có hộp camera riêng, nút đóng camera, hỗ trợ QR thuần `ANNA-...` hoặc URL chứa mã.
3. **F5 Admin**: dùng HttpOnly cookie làm phiên chính + token tương thích; API/session dùng `no-store`; F5 không tự đưa ra màn hình đăng nhập chỉ vì request tạm thời lỗi.
4. **Đổi mật khẩu Admin**: có khung ngay trên Admin; bắt buộc mật khẩu hiện tại, mật khẩu mới tối thiểu 8 ký tự và xác nhận lại.
5. **Đưa khung Đổi quà lên trên**: đặt ngay sau `Trạng thái chu kỳ` để thao tác nhanh trên điện thoại.
6. **Bảo vệ dữ liệu**: xóa khách cũng xóa unlock/token/spin lock/lượt quay liên quan; xóa toàn bộ đưa bộ đếm chu kỳ về 0 nhưng không xóa cấu hình giải.
7. **Bootstrap tài khoản Admin**: tự tạo bảng `admin_credentials` nếu D1 cũ chưa có bảng, tránh lỗi server khi kiểm tra phiên.

## Deploy
Deploy toàn bộ thư mục trong ZIP lên Worker hiện tại của PHỞ NHÀ ANNA. Không xóa D1.

Sau deploy test:
- đăng nhập Admin;
- F5 3 lần liên tiếp;
- mở khung Đổi quà -> Quét QR -> cấp quyền camera -> đóng camera;
- đổi mật khẩu;
- xóa 1 khách test;
- xóa toàn bộ dữ liệu test nếu cần.

