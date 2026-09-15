PHỞ NHÀ ANNA - BẢN TRIỂN KHAI

CẤU TRÚC:
- public/index.html: giao diện khách hàng
- public/admin.html: trang quản trị
- src/worker.js: Worker + API D1
- wrangler.toml: cấu hình Worker, Assets và D1
- package.json: thư viện cần thiết
- schema.sql: dùng khi cài mới
- MIGRATION_D1.sql: chỉ dùng cho migration; D1 hiện tại của anh đã chạy xong nên KHÔNG chạy lại.

TRIỂN KHAI BẰNG WRANGLER:
1. Cài Node.js.
2. Mở Terminal tại thư mục này.
3. Chạy: npm install
4. Đăng nhập: npx wrangler login
5. Triển khai: npm run deploy

LƯU Ý:
- Không chạy lại MIGRATION_D1.sql trên D1 hiện tại nếu các cột/bảng đã tồn tại.
- Không xóa bảng cycle_state khi chương trình đang hoạt động.
- Kiểm tra lại tên Worker và domain sau khi deploy.

CAP NHAT V2:
1. D1 hien tai da co expires_at, cycle_no, cycle_position va cycle_state.
2. Chay tung lenh trong file MIGRATION_D1_V2.sql mot lan de them bo dem 200 luot.
3. Sau do deploy src/worker.js va public/index.html, public/admin.html.
4. Khong xoa du lieu D1 va khong chay lai cac lenh migration cu.

CO CHE GIAI:
- Vi tri 300 cua bo dem 300: An pho mien phi 3 buoi/tuan.
- Vi tri 200 cua bo dem 200: 1 To Pho Mien Phi 50K.
- Neu hai moc trung nhau o luot 600, he thong uu tien giai moc 300.
