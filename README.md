# PHỞ NHÀ ANNA – Vòng Quay May Mắn

Bản triển khai thật, ưu tiên miễn phí với Cloudflare Workers + D1.

## Tính năng
- Khách nhập họ tên + số điện thoại.
- Lưu khách và lượt chơi vào D1.
- Tối đa 3 lượt/ngày theo số điện thoại.
- Bánh quay hiển thị 5 ô bằng nhau; tỷ lệ thật được xử lý ở server: 5%, 10%, 15%, 20%, 50%.
- 5% là Giải đặc biệt: 1 Tô Phở Ăn Miễn Phí, hiệu ứng Jackpot.
- Mỗi phần thưởng có mã nhận thưởng duy nhất.
- QR chứa mã nhận thưởng để quán kiểm tra.
- Trang quản trị có đăng nhập bằng mật khẩu bí mật và xem/đánh dấu đã trao thưởng.
- Có trường ghi nhận lượt chia sẻ/điều kiện lượt 2/3; việc xác minh người bạn thực sự chơi cần bổ sung cơ chế xác nhận server nếu muốn chống gian lận hoàn toàn.

## Nền tảng miễn phí đề xuất
Cloudflare Workers + D1. Theo tài liệu Cloudflare hiện tại, Workers Free có 100.000 request/ngày; D1 Free có 5 triệu rows read/ngày, 100.000 rows written/ngày và 5 GB storage. Cloudflare đã bắt đầu áp dụng giới hạn D1 Free hằng ngày từ 01/09/2026; khi vượt hạn mức truy vấn sẽ tạm lỗi tới lần reset tiếp theo.

## Cài đặt
1. Tạo tài khoản Cloudflare.
2. Cài Node.js và Wrangler.
3. Trong thư mục này chạy:
   npm install
   npx wrangler login
4. Tạo database:
   npx wrangler d1 create pho-nha-anna
   Sau đó lấy database_id và điền vào wrangler.toml.
5. Chạy schema:
   npx wrangler d1 execute pho-nha-anna --remote --file=schema.sql
6. Tạo mật khẩu quản trị:
   npx wrangler secret put ADMIN_PASSWORD
7. Deploy:
   npm run deploy
8. Cloudflare sẽ cấp URL dạng *.workers.dev. Có thể dùng URL này để tạo QR tại quán.

## Lưu ý dữ liệu
Tên và số điện thoại là dữ liệu cá nhân. Chỉ thu thập những gì cần thiết cho chương trình, thông báo mục đích sử dụng, hạn chế quyền truy cập admin và không công khai danh sách khách.

## QR
Mã QR thưởng được tạo trên trình duyệt từ mã nhận thưởng. QR chỉ có ý nghĩa sau khi hệ thống server đã phát mã và lưu mã đó trong D1.
