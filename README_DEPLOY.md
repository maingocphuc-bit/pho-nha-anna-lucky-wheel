# PHỞ NHÀ ANNA – Lucky Wheel V9 FINAL

## Bản này đã rà soát các lỗi anh báo

- Admin dùng **HttpOnly cookie** làm phiên đăng nhập chính.
- Khi F5, `admin.html` gọi `/api/admin/session` để xác thực lại phiên từ server.
- Có fallback bằng token trong localStorage/sessionStorage để tương thích với phiên cũ.
- Có `/api/admin/logout` để xóa cookie phiên.
- API có `Cache-Control: no-store` để tránh giữ dữ liệu API cũ.
- `index.html` và `admin.html` được gửi với `Cache-Control: no-store` để hạn chế trình duyệt giữ giao diện cũ sau deploy.
- Mở thêm lượt chỉ cần **1 số điện thoại**. Hệ thống cộng đúng số **lượt làm nhiệm vụ** đang cấu hình và không cộng trùng trong cùng ngày.
- Bảng `customer_unlocks` và `unlock_tokens` được tạo tự động nếu D1 chưa có; không xóa dữ liệu cũ.
- Cấu hình ngày: Tổng lượt/ngày, lượt miễn phí/ngày, lượt làm nhiệm vụ và nội dung nhiệm vụ.
- Cấu hình ngày được áp dụng cho cả trang khách và API giới hạn lượt.
- Trạng thái chu kỳ giữ kiểu hiển thị chữ đơn giản, dễ nhìn trên điện thoại.
- Cấu hình chu kỳ và số lượng từng giải vẫn giữ nguyên.

## Kiểm tra trước khi đóng gói

- `node --check src/worker.js`: PASS
- JavaScript trong `public/admin.html`: PASS
- `unzip -t`: PASS
- Kiểm tra không còn giao diện Admin cũ dạng chọn "Lượt quay thứ 2/3": PASS
- Kiểm tra không còn luật cũ "tối đa 3 lượt/ngày": PASS
- Kiểm tra Admin có đúng 1 ô SĐT mở thêm lượt: PASS

## Deploy

Deploy toàn bộ thư mục này lên **Worker hiện tại** của PHỞ NHÀ ANNA.

Không xóa D1. Không chạy lệnh xóa dữ liệu.

Sau deploy, test theo thứ tự:

1. Mở `/admin.html`, đăng nhập.
2. F5 trang Admin: phải vẫn ở trang quản lý và tải được trạng thái.
3. Nhập SĐT khách đã đăng ký → **MỞ KHÓA THÊM LƯỢT**.
4. Mở trang khách → đăng ký SĐT → kiểm tra số lượt.
5. Đổi cấu hình lượt/ngày trên Admin → trang khách phải nhận cấu hình mới.

Nếu trình duyệt đang giữ bản HTML cũ, đóng tab Admin rồi mở lại URL `/admin.html`; bản V9 đã gửi header no-store cho trang Admin/khách.

## V10 FIXED – 3 lỗi vòng quay
- **Thêm lượt:** trang khách tự đồng bộ trạng thái với máy chủ mỗi 5 giây và ngay khi quay lại tab; không cần F5 để thấy lượt được admin mở thêm.
- **3 lượt liên tiếp đều trúng:** server kiểm tra 2 lượt gần nhất trên toàn hệ thống; nếu cả 2 đều là giải có thưởng thì lượt kế tiếp bắt buộc là “Chúc Bạn May Mắn Lần Sau”.
- **Chống bấm/quay đồng thời:** server dùng khóa D1 toàn cục cho lượt quay, tránh hai request cùng lúc làm sai bộ đếm chu kỳ hoặc vượt quy tắc liên tiếp.
- **Admin F5:** phiên quản trị dùng HttpOnly cookie và endpoint `/api/admin/session`; trang admin giữ trạng thái khi tải lại và chỉ đăng xuất khi server xác nhận phiên đã hết hiệu lực.

