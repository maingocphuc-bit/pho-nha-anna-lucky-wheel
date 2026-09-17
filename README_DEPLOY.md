# PHỞ NHÀ ANNA – Lucky Wheel V14 FIXED FINAL

## Mục tiêu bản V14
- Sửa lỗi JavaScript trong Admin làm toàn bộ handler không chạy, khiến bấm ĐĂNG NHẬP không có thông báo.
- F5 Admin: giữ phiên bằng HttpOnly cookie + server session + local/session storage fallback.
- Lỗi mạng/API của Admin phải hiện thông báo thay vì im lặng.
- Giữ mở thêm lượt bằng SĐT, không cộng trùng trong ngày.
- Kiểm tra & đổi quà nằm ngay dưới mục Mở thêm lượt.
- Camera QR mở trong modal, không chèn camera cố định vào trang.
- Xóa 1 khách dùng hộp thoại PHỞ NHÀ ANNA.
- Xóa toàn bộ: cảnh báo -> xác nhận cuối -> bắt buộc nhập chính xác `XOA TAT CA`.
- Trang khách: sửa hiển thị trạng thái khi đã dùng hết lượt miễn phí nhưng chưa được mở khóa; nút quay bị khóa đúng lúc và hộp nhiệm vụ vẫn hiện.
- Trang khách báo lỗi kết nối rõ ràng hơn.

## Kiểm tra đã chạy
- `node --check src/worker.js`: PASS
- Inline JS `public/admin.html`: PASS
- Inline JS `public/index.html`: PASS
- HTML ID references: không có ID JavaScript nào thiếu trong HTML
- ZIP integrity: PASS

## Deploy
Deploy toàn bộ thư mục lên đúng Worker hiện tại của PHỞ NHÀ ANNA, giữ nguyên D1 database binding.
Không DROP/TRUNCATE/xóa D1 trong quá trình deploy.

## Sau deploy – test bắt buộc
1. Mở `/admin.html`.
2. Nhập mật khẩu và bấm ĐĂNG NHẬP. Nếu sai phải hiện thông báo.
3. F5 3 lần: vẫn ở Admin nếu session hợp lệ.
4. Mở thêm lượt cho SĐT đã đăng ký.
5. Trang khách của đúng SĐT: trạng thái lượt cập nhật tối đa vài giây.
6. Sau khi dùng lượt miễn phí, ô nhiệm vụ phải còn hiện nếu chưa mở khóa; nút quay không được cho quay.
7. Bấm mở khóa Admin: khách nhận thêm lượt mà không cần F5.
8. Quét QR đổi quà: camera phải mở trong hộp thoại nổi; đóng được bằng nút ĐÓNG CAMERA.
9. Xóa một khách: dùng hộp thoại riêng của PHỞ NHÀ ANNA.
10. Xóa tất cả: chỉ xóa khi nhập đúng `XOA TAT CA`.
11. Đổi mật khẩu: đổi xong F5 vẫn đăng nhập bằng phiên mới.
