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


## V10.5 FINAL — server + camera + branded dialogs
- Added idempotent D1 core-schema repair for `customers` and `plays`.
- Added repair of older `daily_config` columns.
- Admin unlock/delete/history and spin endpoints explicitly ensure their dependency tables before SQL.
- Replaced browser-native `confirm()`/`prompt()` in Admin with PHỞ NHÀ ANNA branded dialogs.
- QR camera remains inside the web page as an inline scanner panel. The browser/OS camera permission prompt itself is security-controlled by the browser and cannot be replaced by webpage JavaScript.

## V10.6 verification
The package was re-tested after the V10.5 fixes. See `TEST_REPORT_V10_6.md` for the automated test matrix and the live-deployment limitation.


## V10.7 production repair notes

This package includes an additive D1 schema-repair pass for older deployments. In particular it repairs legacy `plays` columns used by the current spin insert (`cycle_no`, `cycle_position`, `cycle600_no`, `cycle600_position`, `redemption_count`, `expires_at`) and repairs legacy `cycle_config`/`daily_config` columns before API operations. Existing customer/play data is preserved; no destructive reset is required.

The Admin reward QR scanner is a branded PHỞ NHÀ ANNA modal window. It no longer occupies an inline block in the page. The browser's own camera permission prompt may still appear when permission has not previously been granted.

Deploy the complete package (`wrangler deploy`) and then hard-refresh the site. Verify: Admin login → F5 → status → unlock → delete one → delete all → daily/cycle config → QR camera modal → QR scan → redeem; and Index register → spin → result QR.


## V10.8 critical server repair
V10.8 is rebuilt directly from the owner's V10.7 package. It fixes the two server-side failure paths found during source review: D1 `UPDATE ... RETURNING` result handling in the spin counter, and legacy `plays` schema/index ordering. Registration also no longer depends on a legacy UNIQUE(phone) constraint. A global cycle lock serializes reservations across customers.

Deploy the entire package. Do not mix `worker.js` from an older version with the new `public/` files. Do not delete the D1 database.


## V10.9 hardening
V10.9 adds concurrency-safe legacy schema repair. On first deployment, simultaneous customer/admin requests can no longer fail merely because both requests attempted the same `ALTER TABLE` or index creation at the same time.

**D1 binding requirement:** the Worker environment must expose the D1 database as `env.DB`. The supplied `wrangler.toml` declares binding `DB` for database `pho-nha-anna`. If deploying through the Cloudflare Dashboard instead of Wrangler, verify the D1 binding is attached to the Worker.
