# PHỞ NHÀ ANNA – Lucky Wheel Dynamic Cycle

## Cơ chế lượt quay
- 2 lượt miễn phí/ngày.
- Mời bạn cùng đến ăn: sau khi quán xác nhận, mở thêm 2 lượt cho cả hai người.
- Tối đa 4 lượt/người/ngày.
- Admin mở trực tiếp cho cả 2 số điện thoại, không cần mã mở khóa.

## Cơ chế chu kỳ
Mặc định: 600 lượt/chu kỳ.

Các giải thường tự động giữ tỷ lệ theo chu kỳ 600:
- Giảm giá 5K: 6/600
- 1 Chai Sữa Tươi Mát Lạnh: 4/600
- 1 Ly Trà Gừng Mát Lạnh: 25/600
- Các lượt còn lại: Chúc Bạn May Mắn Lần Sau

Khi đổi kích thước chu kỳ, quota các giải thường được scale theo tỷ lệ và phân bổ bằng phương pháp phần dư lớn nhất để tổng số giải được giữ cân đối.

Giải đặc biệt:
- Chu kỳ 1: 50K ở khoảng vị trí 95/600, giải 2 tô ở khoảng 150/600. Khi chu kỳ 1 có kích thước khác, vị trí được scale theo cùng tỷ lệ.
- Chu kỳ 2 trở đi: 50K ở khoảng 52% chu kỳ; giải 2 tô ở cuối chu kỳ.
- Một khách không được sở hữu cả hai giải đặc biệt.

## Đổi số lượt/chu kỳ
Vào trang Admin → Cấu hình chu kỳ.
- Nếu chu kỳ hiện tại chưa có lượt: áp dụng ngay.
- Nếu đang chạy: số mới được đặt cho chu kỳ kế tiếp; chu kỳ hiện tại không bị thay đổi giữa chừng.

## D1 migration
Worker có thể tự tạo `cycle_config` và `cycle_state`. Có thể chạy `MIGRATION_DYNAMIC_CYCLE.sql` trước khi deploy nếu muốn khởi tạo D1 chủ động.

## Deploy
```bash
npm install
npx wrangler deploy
```

Không cần Secret `ADMIN_PASSWORD`; mật khẩu quản trị được lưu dạng hash + salt trong bảng `admin_credentials` đã có sẵn.
