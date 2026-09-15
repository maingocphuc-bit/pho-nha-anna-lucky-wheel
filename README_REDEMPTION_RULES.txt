CẬP NHẬT ĐỔI QUÀ VÀ GIẢI ĐẶC BIỆT

1. Trang quản lý hiển thị cột Số lần đổi theo dạng 0/2, 1/2 hoặc 2/2 cho giải đặc biệt “Ăn miễn phí 2 tô phở / 1 tuần”. Các giải khác hiển thị tối đa 1 lần.
2. Khi nhân viên đổi quà, hệ thống tăng redemption_count. Giải đặc biệt được đổi tối đa 2 lần; các giải khác tối đa 1 lần.
3. Một khách đã từng trúng giải đặc biệt “Ăn miễn phí 2 tô phở / 1 tuần” sẽ không được trúng giải “1 Tô Phở Miễn Phí 50K”, và ngược lại. Nếu bộ đếm rơi vào giải bị loại, hệ thống chuyển kết quả thành “Chúc Bạn May Mắn Lần Sau”.
4. D1 hiện tại cần chạy file MIGRATION_REDEMPTION_AND_SPECIAL_RULES.sql một lần để thêm cột redemption_count.
