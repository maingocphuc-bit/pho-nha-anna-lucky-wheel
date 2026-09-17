CẬP NHẬT ĐỔI QUÀ VÀ GIẢI ĐẶC BIỆT

1. Trang quản lý hiển thị cột Số lần đổi theo dạng 0/2, 1/2 hoặc 2/2 cho giải đặc biệt “Ăn miễn phí 2 tô phở / 1 tuần”. Các giải khác hiển thị tối đa 1 lần.
2. Khi nhân viên đổi quà, hệ thống tăng redemption_count. Giải đặc biệt được đổi tối đa 2 lần; các giải khác tối đa 1 lần.
3. Một khách đã từng trúng giải đặc biệt “Ăn miễn phí 2 tô phở / 1 tuần” sẽ không được trúng giải “1 Tô Phở Miễn Phí 50K”, và ngược lại. Nếu bộ đếm rơi vào giải bị loại, hệ thống chuyển kết quả thành “Chúc Bạn May Mắn Lần Sau”.
4. Giải 2 tô phở có hiệu lực 7 ngày, tối đa 1 tô/ngày, tối đa 50.000đ/tô; giải 50K có hiệu lực 2 ngày; Giảm giá 5K, Sữa Tươi và Trà Gừng có hiệu lực 1 ngày kể từ thời điểm trúng thưởng.
5. D1 hiện tại cần chạy file MIGRATION_REDEMPTION_AND_SPECIAL_RULES.sql một lần để thêm cột redemption_count nếu cột này chưa tồn tại.
