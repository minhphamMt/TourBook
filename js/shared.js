import {
  compactText,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  getAuthContext,
  resolvePostLoginPath,
  signOut,
  statusLabel
} from "./api.js";
import { isManagementRoute, routePath } from "./routes.js";

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function escapeHtml(value) {
  return String(normalizeUiText(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}


function readSearchParams() {
  return new URLSearchParams(window.location.search);
}

function formatRoleLabel(role) {
  const labels = {
    customer: "Khách hàng",
    staff: "Staff",
    admin: "Admin",
    super_admin: "Super Admin"
  };
  return labels[role] || String(role || "Người dùng");
}

function isManagementPageContext(pageKey) {
  if (typeof window === "undefined") return String(pageKey || "").startsWith("admin");
  return String(pageKey || "").startsWith("admin") || isManagementRoute(window.location.pathname);
}

function createNavItems(auth, pageKey) {
  if (auth?.isManagement && isManagementPageContext(pageKey)) {
    return [{ key: "admin", label: "Dashboard", href: routePath("admin") }];
  }

  return [
    { key: "home", label: "Destinations", href: routePath("home") },
    { key: "tours", label: "Tours", href: routePath("tours") },
    { key: "reviews", label: "Reviews", href: routePath("reviews") }
  ];
}

function getActiveNavKey(pageKey) {
  if (pageKey === "home" || pageKey === "destinations") return "home";
  if (pageKey === "tours") return "tours";
  if (pageKey === "reviews") return "reviews";
  if (String(pageKey || "").startsWith("admin")) return "admin";
  return null;
}

function getInitials(name) {
  return String(name || "TB")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TB";
}

function shouldLockManagementToDashboard() {
  return true;
}

const UI_TEXT_REPLACEMENTS = [
  ["Tổng quan tài khoản", "T\u1ed5ng quan t\u00e0i kho\u1ea3n"],
  ["Booking của tôi", "Booking c\u1ee7a t\u00f4i"],
  ["Chuyến đi sắp tới", "Chuy\u1ebfn \u0111i s\u1eafp t\u1edbi"],
  ["Thông báo chưa đọc", "Th\u00f4ng b\u00e1o ch\u01b0a \u0111\u1ecdc"],
  ["Dựa trên lịch khởi hành chưa hoàn tất.", "D\u1ef1a tr\u00ean l\u1ecbch kh\u1edfi h\u00e0nh ch\u01b0a ho\u00e0n t\u1ea5t."],
  ["Những booking cần theo dõi ngay.", "Nh\u1eefng booking c\u1ea7n theo d\u00f5i ngay."],
  ["Trao đổi với staff theo ticket thật.", "Trao \u0111\u1ed5i v\u1edbi staff theo ticket th\u1eadt."],
  ["Quay lại các tour bạn đã lưu.", "Quay l\u1ea1i c\u00e1c tour b\u1ea1n \u0111\u00e3 l\u01b0u."],
  ["Xem toàn bộ đơn đặt tour và trạng thái.", "Xem to\u00e0n b\u1ed9 \u0111\u01a1n \u0111\u1eb7t tour v\u00e0 tr\u1ea1ng th\u00e1i."],
  ["Nhắn với staff trong trung tâm hỗ trợ.", "Nh\u1eafn v\u1edbi staff trong trung t\u00e2m h\u1ed7 tr\u1ee3."],
  ["Quản lý hồ sơ, hành khách và địa chỉ.", "Qu\u1ea3n l\u00fd h\u1ed3 s\u01a1, h\u00e0nh kh\u00e1ch v\u00e0 \u0111\u1ecba ch\u1ec9."],
  ["Khi booking, payment, refund hoặc ticket có cập nhật, hệ thống sẽ tạo thông báo tại đây.", "Khi booking, payment, refund ho\u1eb7c ticket c\u00f3 c\u1eadp nh\u1eadt, h\u1ec7 th\u1ed1ng s\u1ebd t\u1ea1o th\u00f4ng b\u00e1o t\u1ea1i \u0111\u00e2y."],
  ["Bạn có thể lưu tour từ trang danh sách hoặc chi tiết tour để quay lại sau.", "B\u1ea1n c\u00f3 th\u1ec3 l\u01b0u tour t\u1eeb trang danh s\u00e1ch ho\u1eb7c chi ti\u1ebft tour \u0111\u1ec3 quay l\u1ea1i sau."],
  ["Thêm địa chỉ để bộ phận điều hành có thể liên hệ nhanh hơn khi cần.", "Th\u00eam \u0111\u1ecba ch\u1ec9 \u0111\u1ec3 b\u1ed9 ph\u1eadn \u0111i\u1ec1u h\u00e0nh c\u00f3 th\u1ec3 li\u00ean h\u1ec7 nhanh h\u01a1n khi c\u1ea7n."],
  ["Tất cả yêu cầu hỗ trợ của tài khoản này.", "T\u1ea5t c\u1ea3 y\u00eau c\u1ea7u h\u1ed7 tr\u1ee3 c\u1ee7a t\u00e0i kho\u1ea3n n\u00e0y."],
  ["Thông báo vận hành gửi đến tài khoản của bạn.", "Th\u00f4ng b\u00e1o v\u1eadn h\u00e0nh g\u1eedi \u0111\u1ebfn t\u00e0i kho\u1ea3n c\u1ee7a b\u1ea1n."],
  ["Tổng booking đang theo dõi trong DB.", "T\u1ed5ng booking \u0111ang theo d\u00f5i trong DB."],
  ["Trung tâm hỗ trợ", "Trung t\u00e2m h\u1ed7 tr\u1ee3"],
  ["Danh sách hành khách", "Danh s\u00e1ch h\u00e0nh kh\u00e1ch"],
  ["Danh sách địa chỉ", "Danh s\u00e1ch \u0111\u1ecba ch\u1ec9"],
  ["Hồ sơ tài khoản", "H\u1ed3 s\u01a1 t\u00e0i kho\u1ea3n"],
  ["Tổng quan", "T\u1ed5ng quan"],
  ["Tìm", "T\u00ecm"],
  ["của", "c\u1ee7a"],
  ["Hỗ trợ", "H\u1ed7 tr\u1ee3"],
  ["Hồ sơ", "H\u1ed3 s\u01a1"],
  ["Hành khách", "H\u00e0nh kh\u00e1ch"],
  ["Địa chỉ", "\u0110\u1ecba ch\u1ec9"],
  ["Thông báo", "Th\u00f4ng b\u00e1o"],
  ["Tài khoản", "T\u00e0i kho\u1ea3n"],
  ["Người lớn", "Ng\u01b0\u1eddi l\u1edbn"],
  ["Trẻ em", "Tr\u1ebb em"],
  ["Em bé", "Em b\u00e9"],
  ["Chưa", "Ch\u01b0a"],
  ["Tất cả", "T\u1ea5t c\u1ea3"],
  ["Sắp tới", "S\u1eafp t\u1edbi"],
  ["Chờ thanh toán", "Ch\u1edd thanh to\u00e1n"],
  ["Đã xong", "\u0110\u00e3 xong"],
  ["Hủy / hết hạn", "H\u1ee7y / h\u1ebft h\u1ea1n"],
  ["Thanh toán", "Thanh to\u00e1n"],
  ["chi tiết", "chi ti\u1ebft"],
  ["Không", "Kh\u00f4ng"],
  ["Đang", "\u0110ang"],
  ["Nhắn", "Nh\u1eafn"],
  ["Gửi", "G\u1eedi"],
  ["Tạo", "T\u1ea1o"],
  ["Tiêu đề", "Ti\u00eau \u0111\u1ec1"],
  ["Nội dung", "N\u1ed9i dung"],
  ["Mô tả", "M\u00f4 t\u1ea3"],
  ["Bỏ", "B\u1ecf"],
  ["Đặt", "\u0110\u1eb7t"],
  ["Quốc tịch", "Qu\u1ed1c t\u1ecbch"],
  ["Số điện thoại", "S\u1ed1 \u0111i\u1ec7n tho\u1ea1i"],
  ["Khu vực", "Khu v\u1ef1c"],
  ["Quốc gia", "Qu\u1ed1c gia"],
  ["Họ và tên", "H\u1ecd v\u00e0 t\u00ean"],
  ["Loại hành khách", "Lo\u1ea1i h\u00e0nh kh\u00e1ch"],
  ["Ngày sinh", "Ng\u00e0y sinh"],
  ["Giới tính", "Gi\u1edbi t\u00ednh"],
  ["Ghi chú", "Ghi ch\u00fa"],
  ["Cập nhật", "C\u1eadp nh\u1eadt"],
  ["Thêm", "Th\u00eam"],
  ["Sửa", "S\u1eeda"],
  ["Xóa", "X\u00f3a"],
  ["Danh sách", "Danh s\u00e1ch"],
  ["Khách hàng", "Kh\u00e1ch h\u00e0ng"],
  ["Khám phá", "Kh\u00e1m ph\u00e1"],
  ["Trang chủ", "Trang ch\u1ee7"],
  ["Đăng xuất", "\u0110\u0103ng xu\u1ea5t"],
  ["Về tổng quan", "V\u1ec1 t\u1ed5ng quan"],
  ["ticket mở", "ticket m\u1edf"],
  ["thành công", "th\u00e0nh c\u00f4ng"],
  ["lỗi", "l\u1ed7i"],
  ["chuyến", "chuy\u1ebfn"],
  ["sắp", "s\u1eafp"],
  ["mới", "m\u1edbi"],
  ["Booking gần đây", "Booking g\u1ea7n \u0111\u00e2y"],
  ["Hỗ trợ gần đây", "H\u1ed7 tr\u1ee3 g\u1ea7n \u0111\u00e2y"],
  ["Đánh dấu đã đọc", "\u0110\u00e1nh d\u1ea5u \u0111\u00e3 \u0111\u1ecdc"],
  ["Đã đọc", "\u0110\u00e3 \u0111\u1ecdc"],
  ["Ticket đang mở", "Ticket \u0111ang m\u1edf"],
  ["chuyến sắp tới", "chuy\u1ebfn s\u1eafp t\u1edbi"],
  ["Đặt tour mới", "\u0110\u1eb7t tour m\u1edbi"],
  ["tour đang lưu trong wishlist", "tour \u0111ang l\u01b0u trong wishlist"],
  ["đang lưu trong wishlist", "\u0111ang l\u01b0u trong wishlist"],
  ["Đang cập nhật", "\u0110ang c\u1eadp nh\u1eadt"],
  ["Đang chờ xử lý", "\u0110ang ch\u1edd x\u1eed l\u00fd"],
  ["Đang chờ staff nhận", "\u0110ang ch\u1edd staff nh\u1eadn"],
  ["Chưa có", "Ch\u01b0a c\u00f3"],
  ["Hãy tạo ticket mới hoặc chọn một cuộc hỗ trợ ở cột bên trái.", "H\u00e3y t\u1ea1o ticket m\u1edbi ho\u1eb7c ch\u1ecdn m\u1ed9t cu\u1ed9c h\u1ed7 tr\u1ee3 \u1edf c\u1ed9t b\u00ean tr\u00e1i."],
  ["Ticket đã đóng", "Ticket \u0111\u00e3 \u0111\u00f3ng"],
  ["gửi thêm tin nhắn", "g\u1eedi th\u00eam tin nh\u1eafn"],
  ["ở trạng thái", "\u1edf tr\u1ea1ng th\u00e1i"],
  ["Tour hiện đang mở bán trên hệ thống.", "Tour hi\u1ec7n \u0111ang m\u1edf b\u00e1n tr\u00ean h\u1ec7 th\u1ed1ng."],
  ["Không thể tải dashboard khách hàng", "Kh\u00f4ng th\u1ec3 t\u1ea3i dashboard kh\u00e1ch h\u00e0ng"],
  ["Đã có lỗi xảy ra.", "\u0110\u00e3 c\u00f3 l\u1ed7i x\u1ea3y ra."],
  ["Đã lưu", "\u0110\u00e3 l\u01b0u"],
  ["Đã xóa", "\u0110\u00e3 x\u00f3a"],
  ["Đã gửi", "\u0110\u00e3 g\u1eedi"],
  ["Đã tạo", "\u0110\u00e3 t\u1ea1o"],
  ["Đã cập nhật", "\u0110\u00e3 c\u1eadp nh\u1eadt"],
  ["Đã duyệt", "\u0110\u00e3 duy\u1ec7t"],
  ["Đã từ chối", "\u0110\u00e3 t\u1eeb ch\u1ed1i"],
  ["Đã ghi nhận", "\u0110\u00e3 ghi nh\u1eadn"],
  ["Đã hoàn tiền", "\u0110\u00e3 ho\u00e0n ti\u1ec1n"],
  ["Đã đánh dấu", "\u0110\u00e3 \u0111\u00e1nh d\u1ea5u"],
  ["Đã ẩn", "\u0110\u00e3 \u1ea9n"],
  ["không được để trống", "kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng"],
  ["Lỗi quản trị không mong muốn.", "L\u1ed7i qu\u1ea3n tr\u1ecb kh\u00f4ng mong mu\u1ed1n."],
  ["mã đặt", "m\u00e3 \u0111\u1eb7t"],
  ["mã ticket", "m\u00e3 ticket"],
  ["Danh sách tour", "Danh s\u00e1ch tour"],
  ["hành khách", "h\u00e0nh kh\u00e1ch"],
  ["lưu sẵn", "l\u01b0u s\u1eb5n"],
  ["liên hệ", "li\u00ean h\u1ec7"],
  ["người nhận", "ng\u01b0\u1eddi nh\u1eadn"],
  ["định", "\u0111\u1ecbnh"],
  ["Quận / Huyện", "Qu\u1eadn / Huy\u1ec7n"],
  ["Phường / Xã", "Ph\u01b0\u1eddng / X\u00e3"],
  ["Tỉnh / Thành", "T\u1ec9nh / Th\u00e0nh"],
  ["Mã bưu chính", "M\u00e3 b\u01b0u ch\u00ednh"],
  ["Đặt thêm tour", "\u0110\u1eb7t th\u00eam tour"],
  ["Không có", "Kh\u00f4ng c\u00f3"],
  ["Không gắn booking", "Kh\u00f4ng g\u1eafn booking"],
  ["Không thể tải dashboard khách hàng", "Kh\u00f4ng th\u1ec3 t\u1ea3i dashboard kh\u00e1ch h\u00e0ng"],
  ["Không thể cập nhật", "Kh\u00f4ng th\u1ec3 c\u1eadp nh\u1eadt"],
  ["Không thể xóa", "Kh\u00f4ng th\u1ec3 x\u00f3a"],
  ["Không thể gửi", "Kh\u00f4ng th\u1ec3 g\u1eedi"],
  ["Không tìm thấy", "Kh\u00f4ng t\u00ecm th\u1ea5y"],
  ["Không mong muốn", "Kh\u00f4ng mong mu\u1ed1n"],
  ["Cuộc hỗ trợ", "Cu\u1ed9c h\u1ed7 tr\u1ee3"],
  ["phản hồi", "ph\u1ea3n h\u1ed3i"],
  ["xuất hiện", "xu\u1ea5t hi\u1ec7n"],
  ["dưới", "d\u01b0\u1edbi"],
  ["trước", "tr\u01b0\u1edbc"],
  ["vào", "v\u00e0o"],
  ["trực tiếp", "tr\u1ef1c ti\u1ebfp"],
  ["thực tế", "th\u1ef1c t\u1ebf"],
  ["Đã lưu", "\u0110\u00e3 l\u01b0u"],
  ["Đã xóa", "\u0110\u00e3 x\u00f3a"],
  ["Đã gửi", "\u0110\u00e3 g\u1eedi"],
  ["Đã tạo", "\u0110\u00e3 t\u1ea1o"],
  ["Đã cập nhật", "\u0110\u00e3 c\u1eadp nh\u1eadt"],
  ["Đang", "\u0110ang"],
  ["Tạo hỗ trợ mới", "Tạo hỗ trợ mới"],
  ["Chưa có ticket hỗ trợ", "Chưa có ticket hỗ trợ"],
  ["Tất cả khách", "Tất cả khách"],
  ["Tất cả provider", "Tất cả provider"],
  ["Tất cả status", "Tất cả status"],
  ["Tất cả refund", "Tất cả refund"],
  ["Chưa có refund", "Chưa có refund"],
  ["Đang chờ duyệt", "Đang chờ duyệt"],
  ["Chi tiết", "Chi tiết"],
  ["Xem lịch sử", "Xem lịch sử"],
  ["Tổng hoàn tiền", "Tổng hoàn tiền"],
  ["Hóa đơn liên kết", "Hóa đơn liên kết"],
  ["Danh sách giao dịch", "Danh sách giao dịch"],
  ["Bản ghi giao dịch đọc từ bảng payments.", "Bản ghi giao dịch đọc từ bảng payments."],
  ["Bản ghi hoàn tiền liên kết ngược với booking.", "Bản ghi hoàn tiền liên kết ngược với booking."],
  ["Hàng đợi", "Hàng đợi"],
  ["dữ liệu", "dữ liệu"],
  ["liên kết", "liên kết"],
  ["vận hành", "vận hành"],
  ["thủ công", "thủ công"],
  ["xác nhận", "xác nhận"],
  ["duyệt", "duyệt"],
  ["từ chối", "từ chối"],
  ["hủy", "hủy"],
  ["hoàn tiền", "hoàn tiền"],
  ["Bộ phận", "Bộ phận"],
  ["ngoại tuyến", "ngoại tuyến"],
  ["quy định", "quy định"],
  ["hiện hành", "hiện hành"],
  ["chính sách", "chính sách"],
  ["Phản hồi", "Phản hồi"],
  ["Nhập", "Nhập"],
  ["gửi tới", "gửi tới"],
  ["khỏi public pages", "khỏi public pages"],
  ["Không có dữ liệu để export CSV.", "Không có dữ liệu để export CSV."],
  ["mất liên kết booking", "mất liên kết booking"],
  ["Khách đang chờ duyệt yêu cầu hủy booking.", "Khách đang chờ duyệt yêu cầu hủy booking."],
  ["Đối soát", "Đối soát"],
  ["Đối soát", "Đối soát"],
  ["quản trị", "quản trị"],
  ["Lỗi quản trị", "Lỗi quản trị"],
  ["Cảm ơn", "Cảm ơn"],
  ["Booking liên quan", "Booking liên quan"],
  ["Chọn booking cần hỗ trợ", "Chọn booking cần hỗ trợ"],
  ["Tiêu đề", "Tiêu đề"],
  ["Ví dụ: Cần đổi lịch khởi hành", "Ví dụ: Cần đổi lịch khởi hành"],
  ["Mô tả chi tiết vấn đề bạn cần hỗ trợ...", "Mô tả chi tiết vấn đề bạn cần hỗ trợ..."],
  ["Tạo ticket hỗ trợ", "Tạo ticket hỗ trợ"],
  ["Nhập nội dung bạn muốn phản hồi...", "Nhập nội dung bạn muốn phản hồi..."],
  ["Gửi tin nhắn", "Gửi tin nhắn"],
  ["Chưa có hội thoại", "Chưa có hội thoại"],
  ["Ticket này chưa có tin nhắn nào.", "Ticket này chưa có tin nhắn nào."],
  ["Ticket đã đóng", "Ticket đã đóng"],
  ["Nếu cần tiếp tục, hãy mở ticket mới hoặc chờ nhân viên cập nhật lại trạng thái.", "Nếu cần tiếp tục, hãy mở ticket mới hoặc chờ nhân viên cập nhật lại trạng thái."],
  ["Hệ thống", "Hệ thống"],
  ["Nguồn dữ liệu", "Nguồn dữ liệu"],
  ["Đọc trực tiếp từ DB", "Đọc trực tiếp từ DB"],
  ["Phương thức thanh toán", "Phương thức thanh toán"],
  ["Đã cập nhật ticket hỗ trợ.", "Đã cập nhật ticket hỗ trợ."],
  ["Đã đăng xuất khỏi khu quản trị.", "Đã đăng xuất khỏi khu quản trị."],
  ["Đang tải khu quản trị...", "Đang tải khu quản trị..."],
  ["trải nghiệm", "trải nghiệm"],
  ["hiện", "hiện"],
  ["Đã đăng xuất khỏi hệ thống.", "\u0110\u00e3 \u0111\u0103ng xu\u1ea5t kh\u1ecfi h\u1ec7 th\u1ed1ng."]].sort((left, right) => right[0].length - left[0].length);

const EXTRA_UI_TEXT_FIXES = [
  ["?i?u h??ng", "\u0110i\u1ec1u h\u01b0\u1edbng"],
  ["Ng??i d?ng", "Ng\u01b0\u1eddi d\u00f9ng"],
  ["Ngu?i d?ng", "Ng\u01b0\u1eddi d\u00f9ng"],
  ["Ngu?i d\u00f9ng", "Ng\u01b0\u1eddi d\u00f9ng"],
  ["giao ??ch", "giao d\u1ecbch"],
  ["Giao ??ch", "Giao d\u1ecbch"],
  ["??t tour", "\u0110\u1eb7t tour"],
  ["??n ??t tour", "\u0111\u01a1n \u0111\u1eb7t tour"],
  ["V?n h\u00e0nh", "V\u1eadn h\u00e0nh"],
  ["V?n h?nh", "V\u1eadn h\u00e0nh"],
  ["qu?n l\u00fd", "qu\u1ea3n l\u00fd"],
  ["Qu?n l\u00fd", "Qu\u1ea3n l\u00fd"],
  ["qu?n l?", "qu\u1ea3n l\u00fd"],
  ["Qu?n l?", "Qu\u1ea3n l\u00fd"],
  ["Qu?n tr?", "Qu\u1ea3n tr\u1ecb"],
  ["H? tr?", "H\u1ed7 tr\u1ee3"],
  ["h? tr?", "h\u1ed7 tr\u1ee3"],
  ["H? th?ng", "H\u1ec7 th\u1ed1ng"],
  ["h? th?ng", "h\u1ec7 th\u1ed1ng"],
  ["Khuy?n m?i", "Khuy\u1ebfn m\u00e3i"],
  ["Khuy?n m\u00e3i", "Khuy\u1ebfn m\u00e3i"],
  ["Khuy?n m?i", "Khuy\u1ebfn m\u00e3i"],
  ["C?i d?t", "C\u00e0i \u0111\u1eb7t"],
  ["T?ng quan", "T\u1ed5ng quan"],
  ["T?ng ti?n", "T\u1ed5ng ti\u1ec1n"],
  ["B?o c\u00e1o v?n h?nh", "B\u00e1o c\u00e1o v\u1eadn h\u00e0nh"],
  ["Ph?n b? vai tr?", "Ph\u00e2n b\u1ed5 vai tr\u00f2"],
  ["T?ng h?p t? roles v? user_roles hi?n t?i.", "T\u1ed5ng h\u1ee3p t\u1eeb roles v\u00e0 user_roles hi\u1ec7n t\u1ea1i."],
  ["quy?n truy c?p", "quy\u1ec1n truy c\u1eadp"],
  ["h? s?", "h\u1ed3 s\u01a1"],
  ["h? so", "h\u1ed3 s\u01a1"],
  ["theo d?i booking, giao ??ch v? h? tr? t? d? li?u th?t.", "theo d\u00f5i booking, giao d\u1ecbch v\u00e0 h\u1ed7 tr\u1ee3 t\u1eeb d\u1eef li\u1ec7u th\u1eadt."],
  ["Theo d?i booking, giao ??ch v? h? tr? t? d? li?u th?t.", "Theo d\u00f5i booking, giao d\u1ecbch v\u00e0 h\u1ed7 tr\u1ee3 t\u1eeb d\u1eef li\u1ec7u th\u1eadt."],
  ["Theo d?i ??n ??t tour v? v?ng ??i booking th?t.", "Theo d\u00f5i \u0111\u01a1n \u0111\u1eb7t tour v\u00e0 v\u00f2ng \u0111\u1eddi booking th\u1eadt."],
  ["Theo d?i thanh to?n, ho?n ti?n v? ph??ng th?c ?ang b?t.", "Theo d\u00f5i thanh to\u00e1n, ho\u00e0n ti\u1ec1n v\u00e0 ph\u01b0\u01a1ng th\u1ee9c \u0111ang b\u1eadt."],
  ["Qu?n l? tour, l?ch kh?i h?nh v? ch? c?n l?i.", "Qu\u1ea3n l\u00fd tour, l\u1ecbch kh\u1edfi h\u00e0nh v\u00e0 ch\u1ed7 c\u00f2n l\u1ea1i."],
  ["Theo d?i coupon, usage v? hi?u qu? gi?m gi?.", "Theo d\u00f5i coupon, usage v\u00e0 hi\u1ec7u qu\u1ea3 gi\u1ea3m gi\u00e1."],
  ["Qu?n l? banner v? CMS dang ch?y tr?n website.", "Qu\u1ea3n l\u00fd banner v\u00e0 CMS \u0111ang ch\u1ea1y tr\u00ean website."],
  ["Xem l?ch s? ??t tour, chi ti?u v? m?c ?? quay l?i.", "Xem l\u1ecbch s\u1eed \u0111\u1eb7t tour, chi ti\u00eau v\u00e0 m\u1ee9c \u0111\u1ed9 quay l\u1ea1i."],
  ["Ki?m tra c?u h?nh h? th?ng, payment methods v? role model.", "Ki\u1ec3m tra c\u1ea5u h\u00ecnh h\u1ec7 th\u1ed1ng, payment methods v\u00e0 role model."],
  ["Xem doanh thu, ho?n ti?n v? mix booking theo v?ng.", "Xem doanh thu, ho\u00e0n ti\u1ec1n v\u00e0 mix booking theo v\u00f9ng."],
  ["?? x?c nh?n", "\u0110\u00e3 x\u00e1c nh\u1eadn"],
  ["?? thanh to?n", "\u0110\u00e3 thanh to\u00e1n"],
  ["?? ho?n ti?n", "\u0110\u00e3 ho\u00e0n ti\u1ec1n"],
  ["?? duy?t", "\u0110\u00e3 duy\u1ec7t"],
  ["?? x? l?", "\u0110\u00e3 x\u1eed l\u00fd"],
  ["?? h?y", "\u0110\u00e3 h\u1ee7y"],
  ["?ang m?", "\u0110ang m\u1edf"],
  ["?ang x? l?", "\u0110ang x\u1eed l\u00fd"],
  ["?ang c?p nh?t", "\u0110ang c\u1eadp nh\u1eadt"],
  ["?ang xu?t", "\u0110\u0103ng xu\u1ea5t"],
  ["??ng", "\u0110\u00f3ng"],
  ["?i?m ??n", "\u0110i\u1ec3m \u0111\u1ebfn"],
  ["?i?m d?n", "\u0110i\u1ec3m \u0111\u1ebfn"],
  ["??nh gi?", "\u0110\u00e1nh gi\u00e1"],
  ["?? bao g?m", "\u0110\u00e3 bao g\u1ed3m"],
  ["Kh?i h?nh", "Kh\u1edfi h\u00e0nh"],
  ["Kh?i h\u00e0nh", "Kh\u1edfi h\u00e0nh"],
  ["L?ch m?", "L\u1ecbch m\u1edf"],
  ["L?ch tr?nh", "L\u1ecbch tr\u00ecnh"],
  ["L?u ?", "L\u01b0u \u00fd"],
  ["Th?i l??ng", "Th\u1eddi l\u01b0\u1ee3ng"],
  ["Gi? t?", "Gi\u00e1 t\u1eeb"],
  ["Theo i?u ki?n", "Theo \u0111i\u1ec1u ki\u1ec7n"],
  ["T?m", "T\u00ecm"],
  ["T?i kho?n", "T\u00e0i kho\u1ea3n"],
  ["Th?ng b?o", "Th\u00f4ng b\u00e1o"],
  ["th?ng b?o", "th\u00f4ng b\u00e1o"],
  ["th?ng tin", "th\u00f4ng tin"],
  ["Ch?a", "Ch\u01b0a"],
  ["ch?a", "ch\u01b0a"],
  ["C?p nh?t", "C\u1eadp nh\u1eadt"],
  ["c?p nh?t", "c\u1eadp nh\u1eadt"],
  ["li?n quan", "li\u00ean quan"],
  ["Li?n h?", "Li\u00ean h\u1ec7"],
  ["li?n h?", "li\u00ean h\u1ec7"],
  ["g?n nh?t", "g\u1ea7n nh\u1ea5t"],
  ["g?n d?y", "g\u1ea7n \u0111\u00e2y"],
  ["Xem t?t c?", "Xem t\u1ea5t c\u1ea3"],
  ["M? trung t?m h? tr?", "M\u1edf trung t\u00e2m h\u1ed7 tr\u1ee3"],
  ["Cu?c tr? chuy?n", "Cu\u1ed9c tr\u00f2 chuy\u1ec7n"],
  ["Wishlist ?ang tr?ng", "Wishlist \u0111ang tr\u1ed1ng"],
  ["??nh d?u ?? ??c t?t c?", "\u0110\u00e1nh d\u1ea5u \u0111\u00e3 \u0111\u1ecdc t\u1ea5t c\u1ea3"],
  ["?nh booking chua c?", "\u1ea2nh booking ch\u01b0a c\u00f3"],
  ["?nh tour chua c?", "\u1ea2nh tour ch\u01b0a c\u00f3"],
  ["Ch?a c? ?nh from DB", "Ch\u01b0a c\u00f3 \u1ea3nh t\u1eeb DB"],
  ["Ch?a c? ?nh", "Ch\u01b0a c\u00f3 \u1ea3nh"],
  ["H?t h?n", "H\u1ebft h\u1ea1n"],
  ["H?t ch?", "H\u1ebft ch\u1ed7"],
  ["L?i thanh to?n", "L\u1ed7i thanh to\u00e1n"],
  ["ph??ng th?c", "ph\u01b0\u01a1ng th\u1ee9c"],
  ["?ang b?t", "\u0111ang b\u1eadt"],
  ["?ang", "\u0111ang"],
  ["??ch", "d\u1ecbch"],
  ["??t", "\u0111\u1eb7t"],
  ["??n", "\u0111\u01a1n"],
  ["??i", "\u0111\u1ed5i"],
  ["??c", "\u0111\u1ecdc"],
  ["??y", "\u0111\u00e2y"],
  ["?i?u", "\u0111i\u1ec1u"],
  ["?i?m", "\u0111i\u1ec3m"],
  ["gi?i t?nh", "gi\u1edbi t\u00ednh"],
  ["t?nh", "t\u00ednh"],
  ["Kh?c", "Kh\u00e1c"],
  ["M? h? tr?", "M\u1edf h\u1ed7 tr\u1ee3"],
  ["M? trung t?m h? tr?", "M\u1edf trung t\u00e2m h\u1ed7 tr\u1ee3"],
  ["M? trung tâm h? tr?", "M\u1edf trung t\u00e2m h\u1ed7 tr\u1ee3"],
  ["Th?ng b?o chua ??c", "Th\u00f4ng b\u00e1o ch\u01b0a \u0111\u1ecdc"],
  ["Th?ng b?o chua ??c", "Th\u00f4ng b\u00e1o ch\u01b0a \u0111\u1ecdc"],
  ["Gi? tr? booking hi?n t?i", "Gi\u00e1 tr\u1ecb booking hi\u1ec7n t\u1ea1i"],
  ["C?c trao ??i v? ph?n h?i c?a b?n.", "C\u00e1c trao \u0111\u1ed5i v\u00e0 ph\u1ea3n h\u1ed3i c\u1ee7a b\u1ea1n."],
  ["Booking n?y chua ph?t sinh ticket ho?c review.", "Booking n\u00e0y ch\u01b0a ph\u00e1t sinh ticket ho\u1eb7c review."],
  ["?ang c?p nh?t", "\u0110ang c\u1eadp nh\u1eadt"],
  ["?? c?p nh?t", "\u0110\u00e3 c\u1eadp nh\u1eadt"],
  ["Kh?i h?nh", "Kh\u1edfi h\u00e0nh"],
  ["M?t li?n k?t booking", "M\u1ea5t li\u00ean k\u1ebft booking"],
  ["T?ng booking", "T\u1ed5ng booking"],
  ["T?ng d? thu", "T\u1ed5ng \u0111\u00e3 thu"],
  ["T?ng backlog", "T\u1ed5ng backlog"],
  ["m?c li?n quan", "m\u1ee5c li\u00ean quan"],
  ["?? ??ng xu?t kh?i h? th?ng.", "\u0110\u00e3 \u0111\u0103ng xu\u1ea5t kh\u1ecfi h\u1ec7 th\u1ed1ng."],
  ["xu?t", "xu\u1ea5t"],
  ["kh?i", "kh\u1ecfi"],
  ["chua", "ch\u01b0a"],
  ["b?n", "b\u1ea1n"],
  ["h?p", "h\u1ee3p"],
  ["ho?c", "ho\u1eb7c"],
  ["c?t", "c\u1ed9t"],
  ["h?i tho?i", "h\u1ed9i tho\u1ea1i"],
  ["n?i dung", "n\u1ed9i dung"],
  ["l?u", "l\u01b0u"],
  ["d?ng", "\u0111\u00f3ng"],
  ["g?i", "g\u1eedi"],
  ["ti?p", "ti\u1ebfp"],
  ["g?n", "g\u1ea7n"],
  ["T?m th?ng tin t?i kho?n...", "T\u00ecm th\u00f4ng tin t\u00e0i kho\u1ea3n..."],
  ["Thanh to?n tr?c tuy?n", "Thanh to\u00e1n tr\u1ef1c tuy\u1ebfn"],
  ["L?ch t? DB", "L\u1ecbch t\u1eeb DB"],
  ["Nh?ng l?n thanh to?n li?n quan t?i booking.", "Nh\u1eefng l\u1ea7n thanh to\u00e1n li\u00ean quan t\u1edbi booking."],
  ["Gi? m? b?n th?p nh?t", "Gi\u00e1 m\u1edf b\u00e1n th\u1ea5p nh\u1ea5t"],
  ["Theo c?u h?nh tour", "Theo c\u1ea5u h\u00ecnh tour"],
  ["Nh?ng booking c?n theo d?i ngay.", "Nh\u1eefng booking c\u1ea7n theo d\u00f5i ngay."],
  ["?? ??nh d?u t?t c? th?ng b?o l? ?? ??c.", "\u0110\u00e3 \u0111\u00e1nh d\u1ea5u t\u1ea5t c\u1ea3 th\u00f4ng b\u00e1o l\u00e0 \u0111\u00e3 \u0111\u1ecdc."],
  ["C?n ??i so?t", "C\u1ea7n \u0111\u1ed1i so\u00e1t"],
  ["T?ng ngu?i d?ng", "T\u1ed5ng ng\u01b0\u1eddi d\u00f9ng"],
  ["Ch?a c? booking", "Ch\u01b0a c\u00f3 booking"],
  ["Ch?a c? x?p h?ng tour", "Ch\u01b0a c\u00f3 x\u1ebfp h\u1ea1ng tour"],
  ["M?i y?u c?u h? tr? ??u d? ???c x? l?.", "M\u1ecdi y\u00eau c\u1ea7u h\u1ed7 tr\u1ee3 \u0111\u1ec1u \u0111\u00e3 \u0111\u01b0\u1ee3c x\u1eed l\u00fd."],
  ["H?ng ??i thanh to?n", "H\u00e0ng \u0111\u1ee3i thanh to\u00e1n"],
  ["?? c?p nh?t ph??ng th?c thanh to?n.", "\u0110\u00e3 c\u1eadp nh\u1eadt ph\u01b0\u01a1ng th\u1ee9c thanh to\u00e1n."],
  ["Giao d?ch", "Giao d\u1ecbch"],
  ["Tour & l?ch", "Tour & l\u1ecbch"],
  ["l?ch kh?i h?nh", "l\u1ecbch kh\u1edfi h\u00e0nh"],
  ["hi?u qu? gi?m gi?.", "hi\u1ec7u qu\u1ea3 gi\u1ea3m gi\u00e1."],
  ["B?o c?o v?n h?nh", "B\u00e1o c\u00e1o v\u1eadn h\u00e0nh"],
  ["Ho?n t?t", "Ho\u00e0n t\u1ea5t"],
  ["??t c?c", "\u0110\u1eb7t c\u1ecdc"]
].sort((left, right) => right[0].length - left[0].length);

function decodeUtf8MojibakeSegment(segment) {
  if (!segment || !/[\u00C0-\u00FF]/.test(segment)) return segment;
  if (Array.from(segment).some((char) => char.charCodeAt(0) > 255)) return segment;

  try {
    const bytes = Uint8Array.from(Array.from(segment).map((char) => char.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return segment;
  }
}

export function normalizeUiText(value) {
  if (value == null) return "";
  let result = String(value);
  result = result
    .replaceAll("\u00D0", "\u0110")
    .replaceAll("\u00F0", "\u0111")
    .replaceAll("\uFFFD", "?");

  if (!Array.from(result).some((char) => char.charCodeAt(0) > 255)) {
    const wholeDecoded = decodeUtf8MojibakeSegment(result);
    if (wholeDecoded && wholeDecoded !== result) {
      result = wholeDecoded;
    }
  }

  for (let index = 0; index < 2; index += 1) {
    result = result.replace(/[A-Za-z0-9\u00C0-\u00FF][A-Za-z0-9\u00C0-\u00FF ,.;:!?()/%&+_#=\-"'`?]*/g, (segment) => {
      if (!/[\u00C0-\u00FF]/.test(segment)) return segment;
      return decodeUtf8MojibakeSegment(segment);
    });
  }

  UI_TEXT_REPLACEMENTS.forEach(([from, to]) => {
    result = result.split(from).join(to);
  });

  EXTRA_UI_TEXT_FIXES.forEach(([from, to]) => {
    result = result.split(from).join(to);
  });

  return result;
}

export function normalizeUiTree(scope = document.body) {
  if (typeof document === "undefined") return;
  const root = scope?.nodeType === 9 ? scope.documentElement : scope;
  if (!root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) return;
    const normalized = normalizeUiText(node.nodeValue);
    if (normalized !== node.nodeValue) {
      node.nodeValue = normalized;
    }
  });

  const attrNames = ["placeholder", "title", "aria-label", "alt"];
  const elements = root.querySelectorAll ? [root, ...root.querySelectorAll("*")] : [root];
  elements.forEach((element) => {
    if (!element?.getAttribute) return;
    attrNames.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (!value) return;
      const normalized = normalizeUiText(value);
      if (normalized !== value) {
        element.setAttribute(attr, normalized);
      }
    });

    if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
      const normalizedValue = normalizeUiText(element.value);
      if (normalizedValue !== element.value) {
        element.value = normalizedValue;
      }
    }
  });

  if (document.title) {
    document.title = normalizeUiText(document.title);
  }
}

export function normalizeRenderedHtml(html) {
  if (typeof document === "undefined") {
    return normalizeUiText(html);
  }

  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  normalizeUiTree(template.content);
  return template.innerHTML;
}
export function showToast(message, tone = "info") {
  let root = qs("#toast-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "toast-root";
    document.body.append(root);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = normalizeUiText(message);
  root.append(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

export function renderStatusPill(status) {
  return `<span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>`;
}

export function renderStars(rating = 0) {
  const rounded = Math.round(Number(rating) || 0);
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < rounded ? "star active" : "star"}">&#9733;</span>`).join("");
}

export function renderMediaFrame({ src, alt, className, placeholderLabel = "Ch\u01b0a c\u00f3 \u1ea3nh" }) {
  const safeClassName = escapeHtml(className);
  const safeAlt = escapeHtml(alt);
  const safePlaceholder = escapeHtml(placeholderLabel);
  const fallback =     `<div class="${safeClassName} media-placeholder" role="img" aria-label="${safePlaceholder}"><span>${safePlaceholder}</span></div>`;

  if (src) {
    const onError = escapeHtml(`this.onerror=null;this.outerHTML=${JSON.stringify(fallback)}`);
    return `<img class="${safeClassName}" src="${escapeHtml(src)}" alt="${safeAlt}" onerror="${onError}" />`;
  }

  return fallback;
}

export function getBookingCoverImage(booking) {
  const tour = booking?.tour || null;
  const snapshot = booking?.snapshot_jsonb || {};
  const galleryImage = Array.isArray(tour?.gallery)
    ? tour.gallery.find((item) => item?.imageUrl || item?.image_url || item?.url) || null
    : null;
  return tour?.coverImage
    || tour?.cover_image
    || galleryImage?.imageUrl
    || galleryImage?.image_url
    || galleryImage?.url
    || snapshot.cover_image_url
    || snapshot.coverImage
    || snapshot.tour_cover_image
    || snapshot.image_url
    || snapshot.cover_url
    || null;
}

export function renderEmptyState(title, description) {
  return `
    <div class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

export function renderSectionHeading(eyebrow, title, description) {
  return `
    <div class="section-heading">
      <span class="eyebrow">${escapeHtml(eyebrow)}</span>
      <h2>${escapeHtml(title)}</h2>
      
    </div>
  `;
}

export function renderTourCard(tour, { showWishlist = false, wished = false, variant = "listing" } = {}) {
  const detailHref = routePath("tour-detail", { slug: tour.slug });
  const checkoutHref = routePath("checkout", { slug: tour.slug });
  const rating = Number(tour.ratingAverage || 0).toFixed(1);
  const tourMedia = renderMediaFrame({
    src: tour.coverImage,
    alt: tour.name,
    className: "tour-card-image",
    placeholderLabel: "Ch?a c? ?nh t? DB"
  });

  if (variant === "featured") {
    return `
      <article class="tour-card tour-card-featured" data-tour-id="${escapeHtml(tour.id)}">
        <a class="tour-card-media" href="${detailHref}">
          ${tourMedia}
          <span class="tour-card-flag">${escapeHtml(tour.durationLabel)}</span>
        </a>
        <div class="tour-card-body">
          <div class="tour-card-heading-row">
            <div>
              <h3><a href="${detailHref}">${escapeHtml(tour.name)}</a></h3>
              <p class="tour-card-location">${escapeHtml(tour.destinationLabel)}</p>
            </div>
            <div class="tour-card-rating"><span>★</span>${rating}</div>
          </div>
          <div class="tour-card-price-row">
            <div class="tour-price-stack">
              <small>Từ</small>
              <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
            </div>
            <a class="tour-inline-link" href="${checkoutHref}">Đặt tour</a>
          </div>
        </div>
      </article>
    `;
  }

  return `
    <article class="tour-card tour-card-listing" data-tour-id="${escapeHtml(tour.id)}" data-tour-slug="${escapeHtml(tour.slug)}">
      <a class="tour-card-media" href="${detailHref}">
        ${tourMedia}
        <span class="tour-card-flag tour-card-flag-soft">${tour.isFeatured ? "Nổi bật" : escapeHtml(tour.destinationLabel)}</span>
      </a>
      <div class="tour-card-body">
        <div class="tour-card-topline">
          <span class="tour-card-pill">${escapeHtml(tour.destinationLabel)}</span>
          ${showWishlist ? `<button class="ghost-action wishlist-button" type="button" data-tour-id="${escapeHtml(tour.id)}">${wished ? "Đã lưu" : "Lưu tour"}</button>` : ""}
        </div>
        <div class="tour-card-heading-row">
          <h3><a href="${detailHref}">${escapeHtml(tour.name)}</a></h3>
          <div class="tour-card-rating"><span>★</span>${rating}</div>
        </div>
        <p class="tour-card-copy">${escapeHtml(tour.shortDescription)}</p>
        <div class="tour-card-specs">
          <span>${escapeHtml(tour.durationLabel)}</span>
          <span>${escapeHtml(tour.nextDeparture ? `Khởi hành ${formatShortDate(tour.nextDeparture)}` : `${tour.openScheduleCount || 0} lịch mở`)}</span>
          <span>${tour.reviewCount} đánh giá</span>
        </div>
        <div class="tour-card-footer">
          <div class="tour-price-stack">
            <small>Từ</small>
            <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
          </div>
          <a class="button button-accent" href="${checkoutHref}">Đặt ngay</a>
        </div>
      </div>
    </article>
  `;
}

export function renderDestinationCard(destination) {
  const toursHref = routePath("tours", { destination: destination.location.slug });
  const destinationMedia = renderMediaFrame({
    src: destination.featuredImage,
    alt: destination.location.name,
    className: "destination-card-image",
    placeholderLabel: "No destination image in DB"
  });

  return `
    <article class="destination-card destination-card-standard">
      <a class="destination-card-media" href="${toursHref}">
        ${destinationMedia}
      </a>
      <div class="destination-card-body">
        <span class="eyebrow">${escapeHtml(destination.regionLabel || destination.countryLabel || "Điểm đến")}</span>
        <h3>${escapeHtml(destination.location.name)}</h3>
        <p>${escapeHtml(compactText(destination.location.description, destination.regionDescription || "Khám phá những tour nổi bật tại điểm đến này."))}</p>
        <div class="destination-card-footer">
          <div class="tour-price-stack">
            <small>${destination.totalTours} tour</small>
            <strong>${escapeHtml(destination.startingPrice ? formatCurrency(destination.startingPrice) : "Liên hệ")}</strong>
          </div>
          <a class="text-link" href="${toursHref}">Xem tour</a>
        </div>
      </div>
    </article>
  `;
}

export function renderReviewCard(review) {
  const initials = getInitials(review.authorName);
  return `
    <article class="review-card">
      <div class="review-card-header">
        <div class="review-card-author">
          <div class="review-avatar">${escapeHtml(initials)}</div>
          <div>
            <strong>${escapeHtml(review.authorName)}</strong>
            <p>${escapeHtml(review.tourName || "Khách đã đặt tour")}</p>
          </div>
        </div>
        <div class="review-stars">${renderStars(review.rating)}</div>
      </div>
      <blockquote>${escapeHtml(review.comment)}</blockquote>
      <div class="review-card-footer">
        <span>${escapeHtml(formatLongDate(review.createdAt))}</span>
        ${review.reply ? `<span class="chip">Có phản hồi</span>` : ""}
      </div>
    </article>
  `;
}

export function renderPriceLines(lines = [], currency = "VND") {
  if (!lines.length) {
    return renderEmptyState("Chưa có dòng giá", "Giá booking sẽ xuất hiện tại đây sau khi tạo thành công.");
  }

  return `
    <div class="price-lines">
      ${lines
        .map((line) => `
          <div class="price-line">
            <div>
              <strong>${escapeHtml(line.label)}</strong>
              <p>Số lượng: ${line.quantity}</p>
            </div>
            <strong>${escapeHtml(formatCurrency(line.total_amount, currency))}</strong>
          </div>
        `)
        .join("")}
    </div>
  `;
}

export function renderBookingCard(booking) {
  const payment = booking.payments?.[0];
  const detailHref = routePath("booking-detail", { code: booking.booking_code });

  return `
    <article class="booking-card">
      <div class="booking-card-header">
        <div>
          <span class="eyebrow">${escapeHtml(booking.booking_code)}</span>
          <h3>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</h3>
        </div>
        <div class="status-group">
          ${renderStatusPill(booking.booking_status)}
          ${renderStatusPill(booking.payment_status)}
        </div>
      </div>
      <div class="booking-card-grid">
        <div>
          <small>Khởi hành</small>
          <strong>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</strong>
        </div>
        <div>
          <small>Tổng tiền</small>
          <strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency))}</strong>
        </div>
        <div>
          <small>Thanh toán</small>
          <strong>${escapeHtml(statusLabel(payment?.status || booking.payment_status))}</strong>
        </div>
      </div>
      <div class="booking-card-actions">
        <a class="button button-secondary" href="${detailHref}">Xem chi tiết</a>
      </div>
    </article>
  `;
}

function renderHeaderShell(pageKey, auth) {
  const activeKey = getActiveNavKey(pageKey);
  const navLinks = createNavItems(auth, pageKey)
    .map((item) => `
      <a class="nav-link ${item.key === activeKey ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>
    `)
    .join("");

  if (auth.user && auth.isManagement && isManagementPageContext(pageKey)) {
    return `
      <header class="site-header site-header-management">
        <div class="container site-header-inner">
          <a class="brand" href="${routePath("admin")}" aria-label="The Horizon Dashboard">
            <span class="brand-wordmark">The Horizon</span>
          </a>
          <nav class="site-nav site-nav-management">${navLinks}</nav>
          <div class="header-actions header-actions-management">
            <span class="chip role-chip">${escapeHtml(formatRoleLabel(auth.primaryRole))}</span>
            <a class="button button-primary" href="${routePath("admin")}">Mở dashboard</a>
            <button class="icon-button" id="logout-button" type="button" aria-label="Đăng xuất">${escapeHtml(getInitials(auth.profile?.full_name || auth.user.email))}</button>
          </div>
        </div>
      </header>
    `;
  }

  const authBlock = auth.user
    ? `
        <div class="header-user-group">
          ${auth.isManagement ? `<a class="button button-secondary" href="${routePath("admin")}">Dashboard</a>` : ""}
          <a class="button button-primary" href="${routePath("account")}">Tài khoản</a>
          <button class="icon-button" id="logout-button" type="button" aria-label="Đăng xuất">${escapeHtml(getInitials(auth.profile?.full_name || auth.user.email))}</button>
        </div>
      `
    : `
        <a class="button button-primary" href="${routePath("login")}">Login</a>
      `;

  return `
    <header class="site-header">
      <div class="container site-header-inner">
        <a class="brand" href="${routePath("home")}" aria-label="The Horizon">
          <span class="brand-wordmark">The Horizon</span>
        </a>
        <nav class="site-nav">${navLinks}</nav>
        <div class="header-actions">
          <a class="button button-secondary" href="${routePath("tours", { sort: "popular" })}">Explore tours</a>
          ${authBlock}
        </div>
      </div>
    </header>
  `;
}

function renderFooterShell(auth, pageKey) {
  if (auth?.isManagement && isManagementPageContext(pageKey)) {
    return `
      <footer class="site-footer site-footer-management">
        <div class="container site-footer-bottom">
          <p>Không gian nội bộ dành cho ${escapeHtml(formatRoleLabel(auth.primaryRole))}.</p>
          <div class="site-footer-meta">
            <span>Không gian quản trị</span>
            <span>${escapeHtml(auth.user?.email || "")}</span>
          </div>
        </div>
      </footer>
    `;
  }

  return `
    <footer class="site-footer">
      <div class="container site-footer-top">
        <div class="site-footer-brand">
          <h3>The Horizon</h3>
          <p>Kiến tạo những hành trình cảm hứng, tinh gọn và giàu trải nghiệm cho mọi du khách.</p>
          <div class="site-footer-socials">
            <a href="${routePath("home")}" aria-label="Trang chủ">•</a>
            <a href="${routePath("reviews")}" aria-label="Đánh giá">★</a>
            <a href="${routePath("about-us")}" aria-label="Giới thiệu">i</a>
          </div>
        </div>
        <div>
          <h4>Khám phá</h4>
          <a href="${routePath("home")}">Destinations</a>
          <a href="${routePath("tours")}">Tours du lịch</a>
          <a href="${routePath("reviews")}">Reviews</a>
          <a href="${routePath("destinations")}">Điểm đến</a>
        </div>
        <div>
          <h4>Công ty</h4>
          <a href="${routePath("about-us")}">About Us</a>
          <a href="${routePath("privacy-policy")}">Privacy Policy</a>
          <a href="${routePath("terms-and-conditions")}">Terms of Service</a>
          <a href="${routePath("login")}">Login</a>
        </div>
        <div>
          <h4>Account</h4>
          <p>Follow bookings, sign in, and revisit tours that are currently published in the live catalog.</p>
          <div class="footer-link-stack">
            <a href="${routePath("login")}">Login</a>
            <a href="${routePath("account")}">Account</a>
            <a href="${routePath("tours")}">Book tour</a>
            <a href="${routePath("reviews")}">Reviews</a>
          </div>
        </div>
      </div>
      <div class="container site-footer-bottom">
        <p>© 2026 The Horizon Perspective. All rights reserved.</p>
        <div class="site-footer-meta">
          <a href="${routePath("tours")}">Tours</a>
          <a href="${routePath("destinations")}">Destinations</a>
          <a href="${routePath("reviews")}">Reviews</a>
        </div>
      </div>
    </footer>
  `;
}

export async function mountLayout(pageKey) {
  const auth = await getAuthContext();

  if (
    auth.user
    && auth.isManagement
    && shouldLockManagementToDashboard()
    && !isManagementPageContext(pageKey)
  ) {
    window.location.href = routePath("admin");
    return null;
  }

  const header = qs("#site-header");
  const footer = qs("#site-footer");

  if (header) {
    header.innerHTML = renderHeaderShell(pageKey, auth);
    normalizeUiTree(header);
  }

  if (footer) {
    footer.innerHTML = renderFooterShell(auth, pageKey);
    normalizeUiTree(footer);
  }

  const logoutButton = qs("#logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await signOut();
      showToast("Đã đăng xuất khỏi hệ thống.", "success");
      window.location.href = routePath("home");
    });
  }

  document.documentElement.dataset.role = auth.primaryRole || "guest";
  return auth;
}

export async function guardPage({ management = false, redirect = null } = {}) {
  const auth = await getAuthContext();
  if (!auth.user) {
    const nextPath = redirect || `${window.location.pathname}${window.location.search}`;
    window.location.href = routePath("login", { redirect: nextPath });
    return null;
  }

  if (!management && auth.isManagement && shouldLockManagementToDashboard()) {
    window.location.href = routePath("admin");
    return null;
  }

  if (management && !auth.isManagement) {
    showToast("Bạn không có quyền truy cập khu quản trị.", "error");
    window.location.href = resolvePostLoginPath(auth.roles);
    return null;
  }

  return auth;
}

export function createPageHero({ eyebrow, title, description, actions = "" }) {
  return `
    <section class="page-hero">
      <div class="container page-hero-inner">
        <div>
          <span class="eyebrow">${escapeHtml(eyebrow)}</span>
          <h1>${escapeHtml(title)}</h1>
        </div>
        ${actions ? `<div class="page-hero-actions">${actions}</div>` : ""}
      </div>
    </section>
  `;
}

export function getParam(name) {
  return readSearchParams().get(name);
}

export function setLoading(target, message = "Đang tải dữ liệu...") {
  target.innerHTML = `<div class="loading-card">${escapeHtml(normalizeUiText(message))}</div>`;
}

export function setPageError(target, error) {
  target.innerHTML = renderEmptyState("Không thể tải dữ liệu", error?.message || "Đã có lỗi xảy ra.");
}

export function bindAsyncForm(form, callback) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await callback(new FormData(form));
    } catch (error) {
      showToast(error.message || "Đã có lỗi xảy ra.", "error");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

export {
  qs,
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShortDate
};













