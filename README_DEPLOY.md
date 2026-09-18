# PHỞ NHÀ ANNA – Lucky Wheel V10.2 FINAL ADMIN/F5 FIX

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



## V10.2 critical fix
The previous V10.1 Admin page referenced changePasswordBtn/currentPassword/newPassword/confirmPassword/passwordMsg in JavaScript but did not render those DOM elements. The null dereference stopped the script before bootAdmin(), making F5 return to login and making every Admin button appear dead. V10.2 adds the complete password-change card and a defensive JS error surface.

### Verification
- All Admin element IDs referenced by JavaScript exist in public/admin.html.
- Admin JavaScript syntax checked with Node.
- Worker JavaScript syntax checked with Node.
- ZIP integrity checked.


## V10.4 critical server fix
The Worker now self-heals the core `customers` and `plays` tables before API handling and
creates the indexes required by the Admin/customer flows. Existing rows are preserved.
This prevents the generic HTTP 500 "Lỗi máy chủ" when the deployed D1 is older or only
partially migrated. `ensurePlayColumns()` also runs through the same base-schema repair.
