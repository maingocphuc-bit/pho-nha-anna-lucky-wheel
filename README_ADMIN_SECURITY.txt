PHỞ NHÀ ANNA – BẢO MẬT QUẢN TRỊ

Bản này không sử dụng ADMIN_PASSWORD của Cloudflare.

Mật khẩu quản trị được lưu trong D1 table admin_credentials dưới dạng:
- password_hash: SHA-256 có salt riêng (salt ngẫu nhiên).
- salt: salt ngẫu nhiên.
- token_hash: SHA-256 của token phiên ngẫu nhiên; token phiên không phải là mật khẩu.

Thiết lập lần đầu:
1. Mở /admin.html.
2. Khi D1 chưa có admin_credentials, form “Thiết lập lần đầu” xuất hiện.
3. Tạo mật khẩu >= 8 ký tự.
4. Sau khi tạo, endpoint setup không thể tạo tài khoản lần nữa vì id=1 đã tồn tại.

Đổi mật khẩu:
- Đăng nhập admin.
- Dùng mục “Đổi mật khẩu quản trị”.
- Hệ thống tạo salt mới và token phiên ngẫu nhiên mới.

Lưu ý vận hành:
- Không xóa dòng id=1 trong admin_credentials nếu chưa có phương án tạo tài khoản mới.
- Không chạy các migration ALTER TABLE đã chạy trước đó.
