# Agent Roadmap - TourBook

Folder `agent` này chia dự án thành các task triển khai có thể giao cho agent hoặc dev làm độc lập, nhưng vẫn đi theo một thứ tự an toàn để hoàn thiện web nhanh và ít vỡ nhất.

## 0. Rule bắt buộc

- Mọi chức năng phải đọc và ghi bằng dữ liệu thật từ DB.
- Mọi màn hình chỉ được hiển thị dữ liệu thật từ DB hoặc empty state/error state đúng thực tế.
- Không dùng `localStorage` làm source of truth cho booking, payment, review, ticket, wishlist, profile, role.
- Không dùng số liệu fake, chart fake, counter fake, viewer fake, badge fake hoặc dữ liệu demo để lấp UI.
- Không suy role từ email hay identity string; role chỉ được lấy từ `roles` + `user_roles` hoặc cơ chế phân quyền thật trong DB/Auth.
- Business rule phải khóa ở tầng nghiệp vụ/data layer, không chỉ khóa ở UI.
- Customer, staff và admin phải nhìn cùng một nguồn dữ liệu, không được mỗi bên một state khác nhau.

## 1. Ảnh chụp hiện trạng

- Stack hiện tại: HTML/CSS/JavaScript thuần, `server.js` chạy static multi-page, dữ liệu đọc từ Supabase REST/Auth.
- Public site đã có sẵn các trang chính: home, tours, tour-detail, destinations, reviews, checkout, booking-detail, login, account.
- Admin đã có khung route riêng và render qua `js/admin.js`, nhưng hiện chủ yếu là dashboard đọc dữ liệu, chưa phải bộ công cụ vận hành hoàn chỉnh.
- Schema Supabase khá đầy đủ: bookings, travelers, payments, refunds, invoices, reviews, tickets, banners, cms, settings, roles.

## 2. Những gap lớn nhất hiện tại

- Nhiều thao tác ghi dữ liệu vẫn đang chạy bằng `localStorage` hoặc flow demo trong `js/api.js`, ví dụ:
  - `toggleWishlist`
  - `createBooking`
  - `payBooking`
  - `cancelBooking`
  - `createSupportTicket`
  - `replySupportTicket`
  - `submitReview`
  - `moderateReview`
  - `reviewCancellation`
  - `updateTicketStatus`
- Nhiều chuỗi tiếng Việt đang bị lỗi encoding, thấy rõ trong `js/api.js` và `js/shared.js`.
- Admin hiện có nhiều dữ liệu thật nhưng chưa match visual target bạn muốn: sidebar sáng, card thống kê, chart, quick access, bố cục nhẹ và sạch như ảnh mẫu.
- Các trang admin đa phần mới là read-only hoặc read-heavy, chưa có CRUD/action đầy đủ.
- Chưa có lớp QA/release rõ ràng trước khi đem web đi dùng thật.
- Phân quyền hiện tại chưa đúng logic thật vì còn fallback suy role từ email.
- Luồng user và admin/staff đang có nguy cơ nhìn ra hai nguồn dữ liệu khác nhau.
- Nhiều nghiệp vụ đang khóa bằng UI nhưng chưa khóa bằng service/data layer.

## 3. Nguyên tắc triển khai

- Giao diện public tiếp tục giữ visual direction hiện tại.
- Admin đổi sang phong cách của ảnh mẫu, nhưng menu và module phải map đúng domain tour booking.
- Ưu tiên biến các luồng demo/local thành dữ liệu thật trên Supabase trước khi polish sâu.
- Mỗi task phải có acceptance criteria rõ ràng để có thể giao cho agent chạy độc lập.
- Không task nào được coi là hoàn thành nếu còn local fallback hoặc data giả trên UI.

## 4. Thứ tự làm khuyến nghị

1. `tasks/task-01-foundation-hardening.md`
2. `tasks/task-02-public-discovery-and-home.md`
3. `tasks/task-03-tour-detail-and-conversion.md`
4. `tasks/task-04-booktour-checkout.md`
5. `tasks/task-05-payment-and-booking-lifecycle.md`
6. `tasks/task-06-account-wishlist-and-support.md`
7. `tasks/task-07-review-and-social-proof.md`
8. `tasks/task-08-admin-shell-redesign.md`
9. `tasks/task-09-admin-bookings-payments-customers.md`
10. `tasks/task-10-admin-tours-content-promotions.md`
11. `tasks/task-11-admin-service-users-settings.md`
12. `tasks/task-12-qa-security-release.md`

## 5. Task nào có thể chạy song song

- Sau khi xong Task 01:
  - Task 02 và Task 08 có thể chạy song song.
- Sau khi xong Task 03:
  - Task 04 có thể bắt đầu.
- Sau khi xong Task 04:
  - Task 05 và Task 06 có thể làm song song.
- Sau khi xong Task 05:
  - Task 07 có thể bắt đầu ổn định.
- Sau khi xong Task 08:
  - Task 09, Task 10, Task 11 có thể chia team làm song song nếu chốt chung component admin.

## 6. Mapping admin theo domain hiện tại

Ảnh mẫu là admin cho nền tảng tổng quát. Với TourBook, nên giữ visual đó nhưng đổi menu theo nghiệp vụ thật:

- Tổng quan
- Người dùng
- Đặt tour
- Giao dịch
- Tour và lịch khởi hành
- Khuyến mãi
- Nội dung
- Hỗ trợ và review
- Cài đặt

Chi tiết visual và rule layout xem thêm ở `admin-ui-target.md`.

## 7. Điểm bắt đầu tốt nhất

Nếu chỉ chọn đúng một task để mở màn, nên bắt đầu bằng Task 01 rồi đi thẳng sang Task 04.

Lý do:

- Task 01 dọn nền, sửa text lỗi, bỏ role inference sai và cắt toàn bộ local/demo fallback để các task sau không bị chồng chéo.
- Task 04 là trục sống còn của web tour vì trực tiếp biến "xem tour" thành "đặt tour thật".
