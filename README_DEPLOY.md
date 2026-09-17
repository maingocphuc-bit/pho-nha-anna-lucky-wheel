# PHỞ NHÀ ANNA – Lucky Wheel V11 FIXED FINAL

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



## V11 – sửa lỗi thực tế trên D1 cũ

### A. Mở thêm lượt
V10 vẫn ghi trực tiếp `unlock_type=4` vào bảng `customer_unlocks`. Nếu D1 đang dùng schema cũ có ràng buộc khác, thao tác có thể ném lỗi 500. V11 tách chức năng này sang bảng `admin_extra_unlocks`, tự tạo bảng và index nếu chưa có. Dữ liệu cũ không bị xóa.

### B. F5 Admin
V11 dùng `admin_sessions` với token ngẫu nhiên 32 byte, lưu hash trong D1, thời hạn 30 ngày. Cookie HttpOnly/Secure/SameSite=Lax và token localStorage/sessionStorage cùng được hỗ trợ. Token kiểu cũ vẫn được chấp nhận để không làm mất phiên của bản cũ.

### C. Không thay đổi dữ liệu D1 hiện có
Không có lệnh DROP/TRUNCATE. Các bảng mới chỉ dùng `CREATE TABLE IF NOT EXISTS`.

### D. Sau khi deploy
1. Đăng nhập `/admin.html`.
2. F5 ngay 3 lần: trang phải giữ nguyên trạng thái quản lý.
3. Nhập SĐT khách đã đăng ký → bấm **MỞ KHÓA THÊM LƯỢT**.
4. Sang trang khách của đúng SĐT → số lượt phải tăng ngay trong tối đa 5 giây, không cần F5.
5. Thử bấm mở khóa lần 2 cùng ngày → hệ thống báo đã mở, không cộng trùng.
6. Test hai lượt quay liên tiếp có thưởng rồi lượt thứ ba: server phải trả ô 5, không phụ thuộc trình duyệt.

**Không deploy đồng thời một file worker khác lên cùng Worker.**


## V12 fixes verified
- `admin.html` contains working Change Password and Delete Data sections.
- All admin JS element references were checked; no missing DOM ids remain.
- Admin session is server-backed and rolling for 30 days; F5 refreshes the session cookie.
- HTML asset responses are explicitly no-store to avoid stale admin UI after deployment.
- `node --check src/worker.js` and inline admin JavaScript checks pass.
