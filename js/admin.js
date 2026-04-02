import { formatCurrency, formatDateTime, formatShortDate, getAdminDashboard, moderateReview, processRefund, recordManualPayment, reviewCancellation, saveAdminBanner, saveAdminCmsPage, saveAdminCoupon, saveAdminSchedule, saveAdminSystemSetting, saveAdminTour, setAdminTourStatus, signOut, toggleAdminBanner, toggleAdminCmsPage, toggleAdminCoupon, toggleAdminPaymentMethod, updateAdminUserRole, updateAdminUserStatus, updateBookingInternalNote, updateTicketStatus } from "./api.js";
import { escapeHtml, guardPage, normalizeUiText, normalizeUiTree, qs, renderMediaFrame, setLoading, showToast, getBookingCoverImage } from "./shared.js?v=20260331o";
import { routePath } from "./routes.js";

const ROLE_PERMISSION_MAP = {
  staff: [
    "tour.read",
    "tour.write",
    "schedule.read",
    "schedule.write",
    "booking.read_all",
    "booking.manage",
    "payment.read_all",
    "payment.manage",
    "review.moderate",
    "user.read_all",
    "coupon.manage",
    "report.read",
    "ticket.manage"
  ],
  admin: [
    "tour.read",
    "tour.write",
    "schedule.read",
    "schedule.write",
    "booking.read_all",
    "booking.manage",
    "payment.read_all",
    "payment.manage",
    "review.moderate",
    "user.read_all",
    "coupon.manage",
    "report.read",
    "ticket.manage",
    "user.manage",
    "banner.manage",
    "settings.manage"
  ],
  super_admin: [
    "tour.read",
    "tour.write",
    "schedule.read",
    "schedule.write",
    "booking.read_all",
    "booking.manage",
    "payment.read_all",
    "payment.manage",
    "review.moderate",
    "user.read_all",
    "coupon.manage",
    "report.read",
    "ticket.manage",
    "user.manage",
    "banner.manage",
    "settings.manage"
  ]
};

const PAGE_DEFINITIONS = {
  dashboard: {
    routeKey: "admin",
    group: "Điều hướng",
    icon: "dashboard",
    label: "Tổng quan",
    title: "Tổng quan",
    description: "Theo dõi booking, giao dịch và hỗ trợ từ dữ liệu thật.",
    searchPlaceholder: "Tìm booking, khách, tour..."
  },
  users: {
    routeKey: "admin-users",
    group: "Vận hành",
    icon: "group",
    label: "Người dùng",
    permission: "user.manage",
    title: "Người dùng",
    description: "Quản lý hồ sơ, vai trò và quyền truy cập hệ thống.",
    searchPlaceholder: "Tìm người dùng, email, vai trò..."
  },
  bookings: {
    routeKey: "admin-bookings",
    group: "Vận hành",
    icon: "assignment",
    label: "Đặt tour",
    permission: "booking.read_all",
    title: "Đặt tour",
    description: "Theo dõi đơn đặt tour và vòng đời booking thật.",
    searchPlaceholder: "Tìm booking, khách, tour..."
  },
  payments: {
    routeKey: "admin-payments",
    group: "Vận hành",
    icon: "payments",
    label: "Giao dịch",
    permission: "payment.read_all",
    title: "Giao dịch",
    description: "Theo dõi thanh toán, hoàn tiền và phương thức đang bật.",
    searchPlaceholder: "Tìm giao dịch, booking, phương thức..."
  },
  tours: {
    routeKey: "admin-tours",
    group: "Vận hành",
    icon: "travel_explore",
    label: "Tour & lịch",
    permission: "tour.read",
    title: "Tour và lịch khởi hành",
    description: "Quản lý tour, lịch khởi hành và chỗ còn lại.",
    searchPlaceholder: "Tìm tour, lịch, điểm đến..."
  },
  promotions: {
    routeKey: "admin-promotions",
    group: "Vận hành",
    icon: "sell",
    label: "Khuyến mãi",
    permission: "coupon.manage",
    title: "Khuyến mãi",
    description: "Theo dõi coupon, usage và hiệu quả giảm giá.",
    searchPlaceholder: "Tìm coupon, booking, usage..."
  },
  content: {
    routeKey: "admin-content",
    group: "Vận hành",
    icon: "campaign",
    label: "Nội dung",
    permission: "banner.manage",
    title: "Nội dung",
    description: "Quản lý banner và CMS đang chạy trên website.",
    searchPlaceholder: "Tìm banner, trang, slug..."
  },
  service: {
    routeKey: "admin-service",
    group: "Vận hành",
    icon: "support_agent",
    label: "Hỗ trợ & review",
    permission: "ticket.manage",
    title: "Hỗ trợ và review",
    description: "Xử lý ticket, review backlog và phản hồi khách hàng.",
    searchPlaceholder: "Tìm ticket, review, khách..."
  },
  customers: {
    routeKey: "admin-customers",
    group: "Vận hành",
    icon: "groups_2",
    label: "Khách hàng",
    permission: "user.read_all",
    title: "Khách hàng",
    description: "Xem lịch sử đặt tour, chi tiêu và mức độ quay lại.",
    searchPlaceholder: "Tìm khách, email, booking..."
  },
  settings: {
    routeKey: "admin-settings",
    group: "Hệ thống",
    icon: "settings",
    label: "Cài đặt",
    permission: "settings.manage",
    title: "Cài đặt",
    description: "Kiểm tra cấu hình hệ thống, payment methods và role model.",
    searchPlaceholder: "Tìm setting key, payment method..."
  },
  reports: {
    routeKey: "admin-reports",
    group: "Hệ thống",
    icon: "monitoring",
    label: "Báo cáo",
    permission: "report.read",
    title: "Báo cáo vận hành",
    description: "Xem doanh thu, hoàn tiền và mix booking theo vùng.",
    searchPlaceholder: "Tìm log, tour, booking..."
  }
};

const PAGE_ORDER = ["dashboard", "users", "bookings", "payments", "tours", "promotions", "content", "service", "customers", "settings", "reports"];

function formatStatus(status) {
  const map = {
    pending: "Chờ xử lý",
    awaiting_payment: "Chờ thanh toán",
    confirmed: "Đã xác nhận",
    completed: "Hoàn tất",
    cancel_requested: "Chờ duyệt hủy",
    cancelled: "Đã hủy",
    unpaid: "Chưa thanh toán",
    deposit_paid: "Đặt cọc",
    paid: "Đã thanh toán",
    failed: "Lỗi thanh toán",
    authorized: "Đã giữ tiền",
    expired: "Hết hạn",
    refunded: "Đã hoàn tiền",
    partially_refunded: "Hoàn tiền một phần",
    open: "Đang mở",
    sold_out: "Hết chỗ",
    closed: "Đã đóng",
    hidden: "Đã ẩn",
    approved: "Đã duyệt",
    in_progress: "Đang xử lý",
    resolved: "Đã xử lý"
  };
  return map[status] || String(status || "Không rõ");
}

function getCurrentPageKey() {
  return document.body.dataset.managementPage || "dashboard";
}

function getPermissionSet(role) {
  return new Set(ROLE_PERMISSION_MAP[role] || []);
}

function canAccessPage(role, pageKey) {
  const page = PAGE_DEFINITIONS[pageKey];
  if (!page) return false;
  if (!page.permission) return true;
  return getPermissionSet(role).has(page.permission);
}

function getAccessiblePages(role) {
  return Object.keys(PAGE_DEFINITIONS).filter((pageKey) => canAccessPage(role, pageKey));
}

function roleLabel(role) {
  const labels = {
    customer: "Khách hàng",
    staff: "Nhân viên",
    admin: "Quản trị viên",
    super_admin: "Super Admin"
  };
  return labels[role] || String(role || "Người dùng");
}

const ADMIN_TEXT_REPLACEMENTS = [
  ["�i?u h??ng", "\u0110i\u1ec1u h\u01b0\u1edbng"],
  ["Tổng quan", "T\u1ed5ng quan"],
  ["Theo ??i", "Theo d\u00f5i"],
  ["giao dịch", "giao d\u1ecbch"],
  ["h? tr?", "h\u1ed7 tr\u1ee3"],
  ["dữ liệu", "d\u1eef li\u1ec7u"],
  ["th?t", "th\u1eadt"],
  ["thực tế", "th\u1ef1c t\u1ebf"],
  ["Tìm", "T\u00ecm"],
  ["kh?ch", "kh\u00e1ch"],
  ["Kh�ch", "Kh\u00e1ch"],
  ["V?n h?nh", "V\u1eadn h\u00e0nh"],
  ["Người dùng", "Ng\u01b0\u1eddi d\u00f9ng"],
  ["Qu?n l?", "Qu\u1ea3n l\u00fd"],
  ["h? s?", "h\u1ed3 s\u01a1"],
  ["vai tr?", "vai tr\u00f2"],
  ["quy?n", "quy\u1ec1n"],
  ["truy c?p", "truy c\u1eadp"],
  ["h? th?ng", "h\u1ec7 th\u1ed1ng"],
  ["Đặt tour", "\u0110\u1eb7t tour"],
  ["Đặt", "\u0110\u1eb7t"],
  ["Giao dịch", "Giao d\u1ecbch"],
  ["thanh to?n", "thanh to\u00e1n"],
  ["hoàn tiền", "ho\u00e0n ti\u1ec1n"],
  ["ph??ng th?c", "ph\u01b0\u01a1ng th\u1ee9c"],
  ["Đang", "\u0111ang"],
  ["b?t", "b\u1eadt"],
  ["l?ch", "l\u1ecbch"],
  ["kh?i h?nh", "kh\u1edfi h\u00e0nh"],
  ["ch? c?n lỗi", "ch\u1ed7 c\u00f2n l\u1ea1i"],
  ["?i?m ??n", "\u0111i\u1ec3m \u0111\u1ebfn"],
  ["Khuy?n mới", "Khuy\u1ebfn m\u00e3i"],
  ["hi?u qu?", "hi\u1ec7u qu\u1ea3"],
  ["gi?m gi?", "gi\u1ea3m gi\u00e1"],
  ["Nội dung", "N\u1ed9i dung"],
  ["Khách hàng", "Kh\u00e1ch h\u00e0ng"],
  ["l?ch s?", "l\u1ecbch s\u1eed"],
  ["chi ti?u", "chi ti\u00eau"],
  ["quay lỗi", "quay l\u1ea1i"],
  ["C?i Đặt", "C\u00e0i \u0111\u1eb7t"],
  ["Bỏo c?o", "B\u00e1o c\u00e1o"],
  ["Chờ xử lý", "Ch\u1edd x\u1eed l\u00fd"],
  ["Chờ thanh toán", "Ch\u1edd thanh to\u00e1n"],
  ["?? xác nhận", "\u0110\u00e3 x\u00e1c nh\u1eadn"],
  ["Ho?n t?t", "Ho\u00e0n t\u1ea5t"],
  ["Chờ duyệt hủy", "Ch\u1edd duy\u1ec7t h\u1ee7y"],
  ["?? hủy", "\u0110\u00e3 h\u1ee7y"],
  ["Chưa thanh to?n", "Ch\u01b0a thanh to\u00e1n"],
  ["?? c?c", "\u0110\u1eb7t c\u1ecdc"],
  ["?? thanh to?n", "\u0110\u00e3 thanh to\u00e1n"],
  ["L?i thanh to?n", "L\u1ed7i thanh to\u00e1n"],
  ["?? gi? ti?n", "\u0110\u00e3 gi\u1eef ti\u1ec1n"],
  ["Hết hạn", "H\u1ebft h\u1ea1n"],
  ["Đã hoàn tiền", "\u0110\u00e3 ho\u00e0n ti\u1ec1n"],
  ["Hoàn tiền m?t ph?n", "Ho\u00e0n ti\u1ec1n m\u1ed9t ph\u1ea7n"],
  ["Đang m?", "\u0110ang m\u1edf"],
  ["Hết chỗ", "H\u1ebft ch\u1ed7"],
  ["Đã đóng", "\u0110\u00e3 \u0111\u00f3ng"],
  ["Đã ẩn", "\u0110\u00e3 \u1ea9n"],
  ["Đã duyệt", "\u0110\u00e3 duy\u1ec7t"],
  ["Đang x? l?", "\u0110ang x\u1eed l\u00fd"],
  ["?? x? l?", "\u0110\u00e3 x\u1eed l\u00fd"],
  ["Không rõ", "Kh\u00f4ng r\u00f5"],
  ["Nhắn vi?n", "Nh\u00e2n vi\u00ean"],
  ["Quản trị vi?n", "Qu\u1ea3n tr\u1ecb vi\u00ean"],
  ["Truy cập nhanh", "Truy c\u1eadp nhanh"],
  ["Hiển thị", "Hi\u1ec3n th\u1ecb"],
  ["b?n ghi", "b\u1ea3n ghi"],
  ["Duyệt", "Duy\u1ec7t"],
  ["s?ch", "s\u00e1ch"],
  ["g?n", "g\u1ea7n"],
  [">?n<", ">\u1ea8n<"],
  ["M?t", "M\u1ea5t"],
  ["liên kết", "li\u00ean k\u1ebft"],
  ["Không", "Kh\u00f4ng"],
  ["t?m thủy", "t\u00ecm th\u1ea5y"],
  ["Bỏn", "B\u1ea3n"],
  ["Hành khách", "H\u00e0nh kh\u00e1ch"],
  ["ghi ch?", "ghi ch\u00fa"],
  ["Ghi chú", "Ghi ch\u00fa"],
  ["n?i b?", "n\u1ed9i b\u1ed9"],
  ["Từ chối", "T\u1eeb ch\u1ed1i"],
  ["X?c nh?n", "X\u00e1c nh\u1eadn"],
  ["Tr?ng th?i", "Tr\u1ea1ng th\u00e1i"],
  ["Tổng tiền", "T\u1ed5ng ti\u1ec1n"],
  ["Gi? tr?", "Gi\u00e1 tr\u1ecb"],
  ["Kh?i h?nh", "Kh\u1edfi h\u00e0nh"],
  ["Chưa", "Ch\u01b0a"],
  ["ph?t sinh", "ph\u00e1t sinh"],
  ["vận hành", "v\u1eadn h\u00e0nh"],
  ["h?i tho?i", "h\u1ed9i tho\u1ea1i"],
  ["mới", "m\u1edbi"],
  ["thủ công", "th\u1ee7 c\u00f4ng"],
  ["v?i", "v\u1edbi"],
  ["ng??c", "ng\u01b0\u1ee3c"],
  ["Tất cả", "T\u1ea5t c\u1ea3"],
  ["L? do", "L\u00fd do"],
  ["chính sách", "ch\u00ednh s\u00e1ch"],
  ["Bộ phận", "B\u1ed9 ph\u1eadn"],
  ["ngoại tuyến", "ngo\u00e0i tuy\u1ebfn"],
  ["Phản hồi", "Ph\u1ea3n h\u1ed3i"],
  ["g?i k?m", "g\u1eedi k\u00e8m"],
  ["gửi tới", "g\u1eedi t\u1edbi"],
  ["c? th?", "c\u00f3 th\u1ec3"],
  ["?? tr?ng", "\u0111\u1ec3 tr\u1ed1ng"],
  ["Nhập", "Nh\u1eadp"],
  ["Cảm ơn", "C\u1ea3m \u01a1n"],
  ["b?n", "b\u1ea1n"],
  ["chia s?", "chia s\u1ebb"],
  ["trải nghiệm", "tr\u1ea3i nghi\u1ec7m"],
  ["ch?n", "ch\u1ecdn"],
  ["??", "\u0110\u00e3"],
  ["Lọc booking thật, mở detail drawer và export CSV nhẹ cho vận hành.", "L\u1ecdc booking th\u1eadt, m\u1edf detail drawer v\u00e0 export CSV nh\u1eb9 cho v\u1eadn h\u00e0nh."],
  ["Hàng đợi x? l?", "H\u00e0ng \u0111\u1ee3i x\u1eed l\u00fd"],
  ["Hàng đợi hủy booking", "H\u00e0ng \u0111\u1ee3i h\u1ee7y booking"],
  ["H?a ??n g?n ??y", "H\u00f3a \u0111\u01a1n g\u1ea7n \u0111\u00e2y"],
  ["H?a ??n liên kết trực tiếp v?i booking.", "H\u00f3a \u0111\u01a1n li\u00ean k\u1ebft tr\u1ef1c ti\u1ebfp v\u1edbi booking."],
  ["H?a ??n s? hiện ? ??y khi DB c? dữ liệu.", "H\u00f3a \u0111\u01a1n s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y khi DB c\u00f3 d\u1eef li\u1ec7u."],
  ["Hoạt động booking", "Ho\u1ea1t \u0111\u1ed9ng booking"],
  ["Timeline từ booking events và activity logs.", "Timeline t\u1eeb booking events v\u00e0 activity logs."],
  ["Hàng đợi xác nhận thanh toán tay hoặc thử lại lỗi giao dịch.", "H\u00e0ng \u0111\u1ee3i x\u00e1c nh\u1eadn thanh to\u00e1n tay ho\u1eb7c th\u1eed l\u1ea1i giao d\u1ecbch."],
  ["Tất cả provider", "T\u1ea5t c\u1ea3 provider"],
  ["Tất cả status", "T\u1ea5t c\u1ea3 status"],
  ["Tất cả refund", "T\u1ea5t c\u1ea3 refund"],
  ["Bản ghi giao dịch đọc từ bảng payments.", "B\u1ea3n ghi giao d\u1ecbch \u0111\u1ecdc t\u1eeb b\u1ea3ng payments."],
  ["Hàng đợi thanh to?n", "H\u00e0ng \u0111\u1ee3i thanh to\u00e1n"],
  ["Hàng đợi hoàn tiền", "H\u00e0ng \u0111\u1ee3i ho\u00e0n ti\u1ec1n"],
  ["Hoàn tiền g?n ??y", "Ho\u00e0n ti\u1ec1n g\u1ea7n \u0111\u00e2y"],
  ["Bản ghi hoàn tiền liên kết ngược với booking.", "B\u1ea3n ghi ho\u00e0n ti\u1ec1n li\u00ean k\u1ebft ng\u01b0\u1ee3c v\u1edbi booking."],
  ["Refund s? hiện ? ??y khi DB c? dữ liệu.", "Refund s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y khi DB c\u00f3 d\u1eef li\u1ec7u."],
  ["Tất cả khách", "T\u1ea5t c\u1ea3 kh\u00e1ch"],
  ["Có ticket hỗ trợ", "C\u00f3 ticket h\u1ed7 tr\u1ee3"],
  ["Xem lịch sử", "Xem l\u1ecbch s\u1eed"],
  ["Mở lịch sử booking, review, ticket và tổng chi tiêu của khách ngay trong admin.", "M\u1edf l\u1ecbch s\u1eed booking, review, ticket v\u00e0 t\u1ed5ng chi ti\u00eau c\u1ee7a kh\u00e1ch ngay trong admin."],
  ["Booking đang theo dõi", "Booking \u0111ang theo d\u00f5i"],
  ["Dữ liệu khách hàng sẽ hiện khi có booking hoặc profile customer.", "D\u1eef li\u1ec7u kh\u00e1ch h\u00e0ng s\u1ebd hi\u1ec7n khi c\u00f3 booking ho\u1eb7c profile customer."],
  ["Đọc từ profiles và user_roles, nối cùng booking history.", "\u0110\u1ecdc t\u1eeb profiles v\u00e0 user_roles, n\u1ed1i c\u00f9ng booking history."],
  ["Khách hàng sẽ hiện ở đây khi DB có profile hoặc booking.", "Kh\u00e1ch h\u00e0ng s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y khi DB c\u00f3 profile ho\u1eb7c booking."],
  ["Phản hồi review không được để trống.", "Ph\u1ea3n h\u1ed3i review kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng."],
  ["Ghi chú nội bộ không được để trống.", "Ghi ch\u00fa n\u1ed9i b\u1ed9 kh\u00f4ng \u0111\u01b0\u1ee3c \u0111\u1ec3 tr\u1ed1ng."],
  ["Đã lưu phản hồi review.", "\u0110\u00e3 l\u01b0u ph\u1ea3n h\u1ed3i review."],
  ["Đã lưu ghi chú nội bộ.", "\u0110\u00e3 l\u01b0u ghi ch\u00fa n\u1ed9i b\u1ed9."],
  ["y?u c?u", "y\u00eau c\u1ea7u"],
  ["quy định", "quy \u0111\u1ecbnh"],
  ["hiện hành", "hi\u1ec7n h\u00e0nh"],
  ["?n review", "\u1ea9n review"],
  ["l?u", "l\u01b0u"],
  ["quản trị", "qu\u1ea3n tr\u1ecb"],
  ["L?i", "L\u1ed7i"]
].sort((left, right) => right[0].length - left[0].length);

ADMIN_TEXT_REPLACEMENTS.push(...[
  ["Người dùng", "Người dùng"],
  ["người dùng", "người dùng"],
  ["Tổng hồ sơ hiện có", "Tổng hồ sơ hiện có"],
  ["Booking chờ xử lý", "Booking chờ xử lý"],
  ["Giao dịch cần xem", "Giao dịch cần xem"],
  ["Ticket mở và review backlog", "Ticket mở và review backlog"],
  ["Booking mới (7 ngày gần nhất)", "Booking mới (7 ngày gần nhất)"],
  ["Đếm số booking tạo mới mỗi ngày từ DB.", "Đếm số booking tạo mới mỗi ngày từ DB."],
  ["Tổng booking", "Tổng booking"],
  ["Chưa có booking mới", "Chưa có booking mới"],
  ["Booking mới trong 7 ngày gần nhất sẽ hiện ở đây.", "Booking mới trong 7 ngày gần nhất sẽ hiện ở đây."],
  ["Doanh thu thu về (7 ngày gần nhất)", "Doanh thu thu về (7 ngày gần nhất)"],
  ["Chỉ tính payment đã thành công.", "Chỉ tính payment đã thành công."],
  ["Tổng đã thu", "Tổng đã thu"],
  ["Chưa có giao dịch thành công", "Chưa có giao dịch thành công"],
  ["Doanh thu từ payment.status = paid sẽ hiện ở đây.", "Doanh thu từ payment.status = paid sẽ hiện ở đây."],
  ["Booking mới nhất", "Booking mới nhất"],
  ["Đơn đặt tour mới nhất từ hệ thống.", "Đơn đặt tour mới nhất từ hệ thống."],
  ["Hàng đợi hỗ trợ", "Hàng đợi hỗ trợ"],
  ["Ticket mở và review cần xử lý ngay.", "Ticket mở và review cần xử lý ngay."],
  ["Tour nổi bật", "Tour nổi bật"],
  ["Xếp hạng theo booking thực tế.", "Xếp hạng theo booking thực tế."],
  ["Hoạt động gần đây", "Hoạt động gần đây"],
  ["Nhật ký mới nhất từ activity_logs.", "Nhật ký mới nhất từ activity_logs."],
  ["Doanh thu đã thu", "Doanh thu đã thu"],
  ["Thanh toán chờ xử lý", "Thanh toán chờ xử lý"],
  ["Tổng hoàn tiền", "Tổng hoàn tiền"],
  ["Lượt dùng coupon", "Lượt dùng coupon"],
  ["Biểu đồ doanh thu", "Biểu đồ doanh thu"],
  ["6 tháng gần nhất từ payment records.", "6 tháng gần nhất từ payment records."],
  ["Cơ cấu booking theo vùng", "Cơ cấu booking theo vùng"],
  ["Các phương thức đang bật.", "Các phương thức đang bật."],
  ["Nhật ký hoạt động", "Nhật ký hoạt động"],
  ["Hoạt động mới nhất từ activity_logs.", "Hoạt động mới nhất từ activity_logs."],
  ["Lọc booking thật, mở detail drawer và export CSV nhẹ cho vận hành.", "Lọc booking thật, mở detail drawer và export CSV nhẹ cho vận hành."],
  ["Hóa đơn đã xuất", "Hóa đơn đã xuất"],
  ["Route này đọc trực tiếp booking thật từ DB.", "Route này đọc trực tiếp booking thật từ DB."],
  ["Hàng đợi hủy booking", "Hàng đợi hủy booking"],
  ["Duyệt hoặc từ chối yêu cầu hủy từ khách.", "Duyệt hoặc từ chối yêu cầu hủy từ khách."],
  ["Hóa đơn gần đây", "Hóa đơn gần đây"],
  ["Hóa đơn liên kết trực tiếp với booking.", "Hóa đơn liên kết trực tiếp với booking."],
  ["Chưa có hóa đơn", "Chưa có hóa đơn"],
  ["Hóa đơn sẽ hiện ở đây khi DB có dữ liệu.", "Hóa đơn sẽ hiện ở đây khi DB có dữ liệu."],
  ["Thủ công", "Thủ công"],
  ["Giao dịch chờ xử lý", "Giao dịch chờ xử lý"],
  ["Phương thức đang bật", "Phương thức đang bật"],
  ["Danh sách giao dịch", "Danh sách giao dịch"],
  ["Refund sẽ hiện ở đây khi DB có dữ liệu.", "Refund sẽ hiện ở đây khi DB có dữ liệu."],
  ["Các phương thức thanh toán đang mở cho luồng đặt tour.", "Các phương thức thanh toán đang mở cho luồng đặt tour."],
  ["Ticket đang mở", "Ticket đang mở"],
  ["Review chờ duyệt", "Review chờ duyệt"],
  ["Ticket đã xử lý", "Ticket đã xử lý"],
  ["Tổng review", "Tổng review"],
  ["Chọn đúng hội thoại cần xử lý ở cột trái.", "Chọn đúng hội thoại cần xử lý ở cột trái."],
  ["Kiểm duyệt review", "Kiểm duyệt review"],
  ["Tập trung duyệt và phản hồi review ngay dưới khu ticket.", "Tập trung duyệt và phản hồi review ngay dưới khu ticket."],
  ["Khách quay lỗi", "Khách quay lại"],
  ["chi ti?u cao", "chi tiêu cao"],
  ["Khách gần đây", "Khách gần đây"],
  ["Hồ sơ khách", "Hồ sơ khách"],
  ["Trang nội dung website", "Trang nội dung website"],
  ["Xem trước", "Xem trước"],
  ["Cấu hình hệ thống", "Cấu hình hệ thống"],
  ["Đã lưu tour thành công.", "Đã lưu tour thành công."],
  ["Đã lưu lịch khởi hành.", "Đã lưu lịch khởi hành."],
  ["Đã lưu coupon.", "Đã lưu coupon."],
  ["Đã lưu banner.", "Đã lưu banner."],
  ["Đã lưu trang CMS.", "Đã lưu trang CMS."],
  ["Đã cập nhật người dùng.", "Đã cập nhật người dùng."],
  ["Đã lưu cấu hình hệ thống.", "Đã lưu cấu hình hệ thống."],
  ["Lỗi lưu dữ liệu quản trị.", "Lỗi lưu dữ liệu quản trị."],
  ["Đã duyệt yêu cầu hủy booking.", "Đã duyệt yêu cầu hủy booking."],
  ["Đã từ chối yêu cầu hủy booking.", "Đã từ chối yêu cầu hủy booking."],
  ["Đã ghi nhận thanh toán thủ công.", "Đã ghi nhận thanh toán thủ công."],
  ["Ghi chú nội bộ không được để trống.", "Ghi chú nội bộ không được để trống."],
  ["Đã lưu ghi chú nội bộ.", "Đã lưu ghi chú nội bộ."],
  ["Đã cập nhật phương thức thanh toán.", "Đã cập nhật phương thức thanh toán."],
  ["Đã cập nhật trạng thái tour.", "Đã cập nhật trạng thái tour."],
  ["Đã cập nhật trạng thái coupon.", "Đã cập nhật trạng thái coupon."],
  ["Đã cập nhật trạng thái banner.", "Đã cập nhật trạng thái banner."],
  ["Đã cập nhật trạng thái CMS.", "Đã cập nhật trạng thái CMS."],
  ["Hỗ trợ chuyến đi", "Hỗ trợ chuyến đi"],
  ["Chưa phân công", "Chưa phân công"],
  ["Chưa có tour", "Chưa có tour"],
  ["Chưa có phản hồi mới.", "Chưa có phản hồi mới."],
  ["Chưa chọn ticket", "Chưa chọn ticket"],
  ["Trạng thái", "Trạng thái"],
  ["Ghi chú nội bộ", "Ghi chú nội bộ"],
  ["Duyệt hủy", "Duyệt hủy"],
  ["Từ chối hủy", "Từ chối hủy"],
  ["Tổng tiền", "Tổng tiền"],
  ["Giá trị booking", "Giá trị booking"],
  ["Chưa có nội dung review.", "Chưa có nội dung review."],
  ["Đang cập nhật", "Đang cập nhật"],
  ["Đối soát", "Đối soát"],
  ["Mã giao dịch", "Mã giao dịch"],
  ["Nhà cung cấp", "Nhà cung cấp"],
  ["Số tiền", "Số tiền"],
  ["Hạng khách", "Hạng khách"],
  ["Lịch sử booking", "Lịch sử booking"],
  ["Đóng panel chi tiết", "Đóng panel chi tiết"]
]);
ADMIN_TEXT_REPLACEMENTS.sort((left, right) => right[0].length - left[0].length);

function decodeAdminMojibakeSegment(segment) {
  if (!segment || !/[\u00C0-\u00FF]/.test(segment)) return segment;
  if (Array.from(segment).some((char) => char.charCodeAt(0) > 255)) return segment;
  try {
    const bytes = Uint8Array.from(Array.from(segment).map((char) => char.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return segment;
  }
}

function normalizeAdminText(value) {
  if (value == null) return "";
  let result = String(value);

  if (!Array.from(result).some((char) => char.charCodeAt(0) > 255)) {
    const wholeDecoded = decodeAdminMojibakeSegment(result);
    if (wholeDecoded && wholeDecoded !== result) {
      result = wholeDecoded;
    }
  }

  for (let index = 0; index < 2; index += 1) {
    result = result.replace(/[A-Za-z0-9\u00C0-\u00FF][A-Za-z0-9\u00C0-\u00FF ,.;:!?()/%&+_#=\-"'`]*/g, (segment) => {
      if (!/[\u00C0-\u00FF]/.test(segment)) return segment;
      return decodeAdminMojibakeSegment(segment);
    });
  }

  ADMIN_TEXT_REPLACEMENTS.forEach(([from, to]) => {
    result = result.split(from).join(to);
  });
  return normalizeUiText(result);
}

function normalizeAdminCopy(html) {
  return normalizeUiText(normalizeAdminText(html));
}

let adminUnicodeObserver = null;

function normalizeAdminTree(scope = document.body) {
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
    const normalized = normalizeAdminText(node.nodeValue);
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
      const normalized = normalizeAdminText(value);
      if (normalized !== value) {
        element.setAttribute(attr, normalized);
      }
    });

    if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
      const normalizedValue = normalizeAdminText(element.value);
      if (normalizedValue !== element.value) {
        element.value = normalizedValue;
      }
    }
  });

  if (document.title) {
    document.title = normalizeAdminText(document.title);
  }
}

function showAdminToast(message, tone = "info") {
  showToast(normalizeAdminText(message), tone);
}

function installAdminUnicodeLayer() {
  if (typeof document === "undefined") return;
  document.body?.classList.add("admin-unicode-safe");
  normalizeAdminTree(document);
  if (adminUnicodeObserver || !document.body) return;

  adminUnicodeObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        const normalized = normalizeAdminText(mutation.target.nodeValue);
        if (normalized !== mutation.target.nodeValue) {
          mutation.target.nodeValue = normalized;
        }
        return;
      }

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const normalized = normalizeAdminText(node.nodeValue);
          if (normalized !== node.nodeValue) {
            node.nodeValue = normalized;
          }
          return;
        }
        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          normalizeAdminTree(node);
        }
      });
    });
  });

  adminUnicodeObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}
["group", "label", "title", "description", "searchPlaceholder"].forEach((field) => {
  Object.values(PAGE_DEFINITIONS).forEach((page) => {
    if (typeof page[field] === "string") {
      page[field] = normalizeAdminText(page[field]);
    }
  });
});

const MANAGEMENT_RUNTIME = {
  auth: null,
  data: null,
  currentPage: "dashboard",
  detail: null,
  modal: null,
  service: {
    activeTicketId: null
  },
  filters: {
    bookings: { bookingStatus: "all", paymentStatus: "all", cancellation: "all" },
    payments: { status: "all", refundStatus: "all", provider: "all" },
    customers: { segment: "all" }
  }
};

function getRuntimeFilters(pageKey) {
  if (!MANAGEMENT_RUNTIME.filters[pageKey]) {
    MANAGEMENT_RUNTIME.filters[pageKey] = {};
  }
  return MANAGEMENT_RUNTIME.filters[pageKey];
}

function getInitials(name) {
  return String(name || "TH")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TH";
}

function renderAvatar(profile, user, className = "portal-avatar") {
  const avatarUrl = profile?.avatar_url;
  const name = profile?.full_name || user?.email || "The Horizon";
  return avatarUrl
    ? `<img class="${className}" src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" />`
    : `<div class="${className} portal-avatar-fallback">${escapeHtml(getInitials(name))}</div>`;
}

function getBookingTone(booking) {
  if (booking.booking_status === "cancelled") return { label: "Đã hủy", tone: "danger" };
  if (booking.booking_status === "completed") return { label: "Hoàn tất", tone: "success" };
  if (booking.booking_status === "cancel_requested") return { label: "Chờ duyệt hủy", tone: "danger" };
  if (booking.booking_status === "expired") return { label: "Hết hạn", tone: "danger" };
  if (["confirmed"].includes(booking.booking_status) || ["paid", "partially_paid"].includes(booking.payment_status)) {
    return { label: "Đã xác nhận", tone: "success" };
  }
  return { label: "Chờ xử lý", tone: "waiting" };
}

function getPaymentTone(payment) {
  if (payment.status === "paid") return { label: "Đã thanh toán", tone: "success" };
  if (["refunded", "partially_refunded"].includes(payment.status)) return { label: formatStatus(payment.status), tone: "danger" };
  if (["failed", "cancelled", "expired"].includes(payment.status)) return { label: formatStatus(payment.status), tone: "danger" };
  if (payment.status === "authorized") return { label: "Đã giữ tiền", tone: "info" };
  return { label: "Chờ xử lý", tone: "waiting" };
}

function getReviewTone(review) {
  if (review.status === "approved") return { label: "Đã duyệt", tone: "success" };
  if (review.status === "hidden") return { label: "Đã ẩn", tone: "danger" };
  return { label: formatStatus(review.status), tone: "waiting" };
}

function getTicketTone(ticket) {
  if (ticket.status === "resolved") return { label: "Đã xử lý", tone: "success" };
  if (ticket.status === "closed") return { label: "Đã đóng", tone: "danger" };
  return { label: formatStatus(ticket.status), tone: "waiting" };
}

function getServiceAssignees(data) {
  return (Array.isArray(data?.profiles) ? data.profiles : [])
    .filter((profile) => ["staff", "admin", "super_admin"].includes(profile.primaryRole))
    .sort((left, right) => String(left.full_name || left.email || "").localeCompare(String(right.full_name || right.email || "")));
}

function syncActiveServiceTicket(tickets) {
  if (!tickets.length) {
    MANAGEMENT_RUNTIME.service.activeTicketId = null;
    return null;
  }
  const active = tickets.find((ticket) => String(ticket.id) === String(MANAGEMENT_RUNTIME.service.activeTicketId));
  if (active) return active;
  MANAGEMENT_RUNTIME.service.activeTicketId = tickets[0].id;
  return tickets[0];
}

function getActiveServiceTicket(tickets) {
  if (!tickets.length) return null;
  return tickets.find((ticket) => String(ticket.id) === String(MANAGEMENT_RUNTIME.service.activeTicketId)) || tickets[0];
}

function renderServiceTicketInbox(tickets) {
  if (!tickets.length) {
    return '<div class="empty-state"><h3>Chưa có ticket hỗ trợ</h3><p>Ticket từ DB sẽ xuất hiện tại đây để staff xử lý theo dạng inbox.</p></div>';
  }

  return tickets.map((ticket) => {
    const tone = getTicketTone(ticket);
    const latestMessage = ticket.messages?.[ticket.messages.length - 1] || null;
    const active = String(ticket.id) === String(MANAGEMENT_RUNTIME.service.activeTicketId);
    return `
      <button class="admin-service-thread ${active ? "is-active" : ""}" type="button" data-admin-ticket-select="${escapeHtml(ticket.id)}" data-search="${escapeHtml(`${ticket.subject || ""} ${ticket.customerName || ""} ${ticket.bookingCode || ""}`)}">
        <div class="admin-service-thread-top">
          <div>
            <strong>${escapeHtml(ticket.subject || "Hỗ trợ chuyến đi")}</strong>
            <p>${escapeHtml(ticket.customerName || "Khách hàng")} - ${escapeHtml(ticket.tour?.name || "Chưa có tour")}</p>
          </div>
          <span class="admin-service-thread-time">${escapeHtml(formatShortDate(latestMessage?.created_at || ticket.updated_at || ticket.created_at))}</span>
        </div>
        <div class="admin-service-thread-preview">${escapeHtml(latestMessage?.message || latestMessage?.message_text || "Chưa có phản hồi mới.")}</div>
        <div class="admin-service-thread-meta">
          ${renderStatusTag(tone.label, tone.tone)}
          <span class="chip">${escapeHtml(ticket.priority || "normal")}</span>
          <span class="chip">${escapeHtml(ticket.assigneeName || "Chưa phân công")}</span>
        </div>
      </button>
    `;
  }).join("");
}
function renderServiceTicketWorkspace(data, ticket) {
  if (!ticket) {
    return '<div class="admin-panel admin-service-chat-shell"><div class="empty-state"><h3>Chưa chọn ticket</h3><p>Chọn một ticket ở cột bên trái để staff/admin đọc hội thoại và xử lý ngay.</p></div></div>';
  }

  const tone = getTicketTone(ticket);
  const managementProfiles = getServiceAssignees(data);
  const closed = ["resolved", "closed"].includes(ticket.status);
  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const assigneeOptions = ['<option value="">Chưa phân công</option>']
    .concat(managementProfiles.map((profile) => `<option value="${escapeHtml(profile.id)}"${String(profile.id) === String(ticket.assigned_to || "") ? " selected" : ""}>${escapeHtml(profile.full_name || profile.email || "Staff")}</option>`))
    .join("");
  const statusOptions = ["open", "in_progress", "resolved", "closed"]
    .map((status) => `<option value="${status}"${status === ticket.status ? " selected" : ""}>${escapeHtml(formatStatus(status))}</option>`)
    .join("");

  return `
    <article class="admin-panel admin-service-chat-shell">
      <header class="admin-service-chat-header">
        <div>
          <span class="eyebrow">Hỗ trợ khách hàng</span>
          <h2>${escapeHtml(ticket.subject || "Hỗ trợ khách hàng")}</h2>
          <p>${escapeHtml(ticket.customerName || "Khách hàng")} - ${escapeHtml(ticket.tour?.name || "Chưa có tour")}</p>
        </div>
        <div class="admin-service-chat-header-side">
          ${renderStatusTag(tone.label, tone.tone)}
          <button class="admin-inline-button" type="button" data-admin-action="manage-ticket" data-ticket-id="${escapeHtml(ticket.id)}">Chi tiết</button>
        </div>
      </header>

      <div class="admin-service-chat-stream">
        ${messages.length
          ? messages.map((message) => `
              <article class="admin-service-bubble is-${escapeHtml(message.sender_type || "customer")}">
                <div class="admin-service-bubble-meta">
                  <strong>${escapeHtml(message.senderName || message.sender_type || "Hệ thống")}</strong>
                  <span>${escapeHtml(formatDateTime(message.created_at))}</span>
                </div>
                <p>${escapeHtml(message.message || message.message_text || "")}</p>
              </article>
            `).join("")
          : '<div class="empty-state"><h3>Chưa có hội thoại</h3><p>Ticket này chưa có tin nhắn nào được lưu trong DB.</p></div>'}
      </div>

      <form class="admin-service-composer" data-admin-service-ticket-form data-ticket-id="${escapeHtml(ticket.id)}">
        <div class="admin-service-composer-grid">
          <label class="admin-filter-field"><span>Trạng thái</span><select name="status">${statusOptions}</select></label>
          <label class="admin-filter-field"><span>Phân công</span><select name="assignedTo">${assigneeOptions}</select></label>
        </div>
        ${closed ? '<div class="admin-service-closed-note"><span class="material-symbols-outlined">lock</span><div><strong>Ticket đang đóng</strong><p>Nếu cần trao đổi tiếp, hãy đổi trạng thái về <code>in_progress</code> rồi gửi phản hồi mới.</p></div></div>' : ""}
        <label class="admin-service-composer-field">
          <span>Phản hồi mới</span>
          <textarea name="note" rows="4" placeholder="Nhập phản hồi cho khách hoặc ghi chú xử lý nội bộ..."></textarea>
        </label>
        <div class="admin-service-composer-actions">
          <button class="admin-inline-button is-primary" type="submit">Cập nhật ticket</button>
          <span class="admin-service-composer-hint">Cập nhật trạng thái, người phụ trách và phản hồi ngay trong cùng một khung.</span>
        </div>
      </form>
    </article>
  `;
}
function renderStatusTag(label, tone = "waiting") {
  return `<span class="admin-status-chip is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function renderStatCard({ icon, chip = "", chipTone = "success", label, value, hint, cardTone = "neutral" }) {
  return `
    <article class="admin-stat-card is-${escapeHtml(cardTone)}">
      <div class="admin-stat-head">
        <span class="material-symbols-outlined admin-stat-icon is-${escapeHtml(cardTone)}">${icon}</span>
        ${chip ? `<em class="${chipTone !== "success" ? `is-${chipTone}` : ""}">${escapeHtml(chip)}</em>` : ""}
      </div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(hint)}</p>
    </article>
  `;
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAdminDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function buildRecentDaySeries(items = [], resolveDate, resolveValue = () => 1) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const series = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    series.push({
      key: toLocalDateKey(date),
      label: WEEKDAY_LABELS[date.getDay()],
      value: 0
    });
  }

  const indexMap = new Map(series.map((item, index) => [item.key, index]));
  items.forEach((item) => {
    const rawDate = resolveDate(item);
    if (!rawDate) return;
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return;
    const key = toLocalDateKey(date);
    const targetIndex = indexMap.get(key);
    if (targetIndex == null) return;
    series[targetIndex].value += Number(resolveValue(item) || 0);
  });

  const max = Math.max(0, ...series.map((item) => item.value));
  return series.map((item, index) => ({
    ...item,
    height: max ? Math.max(18, Math.round((item.value / max) * 100)) : 0,
    isActive: index === series.length - 1
  }));
}

function renderChartPanel({ title, description, totalLabel, totalValue, series, tone = "blue", emptyTitle, emptyDescription }) {
  const hasData = series.some((item) => item.value > 0);
  return `
    <article class="admin-panel admin-chart-panel admin-chart-panel-${escapeHtml(tone)}">
      <div class="portal-section-head admin-chart-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="admin-chart-summary">
          <span>${escapeHtml(totalLabel)}</span>
          <strong>${escapeHtml(totalValue)}</strong>
        </div>
      </div>
      ${hasData
        ? `<div class="admin-bar-chart admin-bar-chart-weekly">${series
            .map(
              (item) => `<div class="admin-bar-col"><div class="admin-bar-fill is-${escapeHtml(tone)} ${item.isActive ? "is-active" : ""}" style="height:${item.height}%"></div><span>${escapeHtml(item.label)}</span><small>${escapeHtml(String(item.value))}</small></div>`
            )
            .join("")}</div>`
        : `<div class="empty-state"><h3>${escapeHtml(emptyTitle || "Chưa có dữ liệu")}</h3><p>${escapeHtml(emptyDescription || description)}</p></div>`}
    </article>
  `;
}

function getBacklogCount(stats) {
  return stats.pendingBookings.length + stats.pendingPayments.length + stats.pendingReviews.length + stats.unresolvedTickets.length;
}

function getDashboardAction(stats) {
  const reviewAndTicketCount = stats.pendingReviews.length + stats.unresolvedTickets.length;
  if (reviewAndTicketCount > 0) {
    return {
      routeKey: "admin-service",
      icon: "schedule",
      label: `${reviewAndTicketCount} mục chờ xử lý`
    };
  }

  if (stats.pendingPayments.length > 0) {
    return {
      routeKey: "admin-payments",
      icon: "payments",
      label: `${stats.pendingPayments.length} giao dịch cần xử lý`
    };
  }

  if (stats.pendingBookings.length > 0) {
    return {
      routeKey: "admin-bookings",
      icon: "assignment",
      label: `${stats.pendingBookings.length} booking đang chờ`
    };
  }

  return {
    routeKey: "admin",
    icon: "task_alt",
    label: "Không có backlog"
  };
}

function getQuickAccessMetric(pageKey, data, stats) {
  const map = {
    bookings: { value: stats.pendingBookings.length, hint: "đang chờ xử lý" },
    users: { value: stats.totalUsers, hint: "Hồ sơ đang có" },
    payments: { value: stats.pendingPayments.length, hint: "Cần đối soát" },
    tours: { value: stats.activeSchedules.length, hint: "Lịch đang mở" },
    promotions: { value: stats.activeCoupons.length, hint: "Mã đang chạy" },
    content: { value: data.cmsPages.length + stats.activeBanners.length, hint: "Banner và CMS" },
    service: { value: stats.pendingReviews.length + stats.unresolvedTickets.length, hint: "Ticket và review" },
    customers: { value: stats.customerCount, hint: "Khách có giao dịch" },
    settings: { value: data.systemSettings.length, hint: "Cấu hình hiện có" },
    reports: { value: getBacklogCount(stats), hint: "Tổng backlog" }
  };
  return map[pageKey] || { value: 0, hint: "Dữ liệu hệ thống" };
}

function buildQuickAccessItems(auth, data, stats) {
  const candidates = ["bookings", "users", "tours", "promotions", "settings", "service", "customers", "payments", "content", "reports"];
  return candidates
    .filter((pageKey) => canAccessPage(auth.primaryRole, pageKey))
    .slice(0, 5)
    .map((pageKey) => {
      const page = PAGE_DEFINITIONS[pageKey];
      const metric = getQuickAccessMetric(pageKey, data, stats);
      return {
        pageKey,
        routeKey: page.routeKey,
        icon: page.icon,
        title: page.label,
        hint: metric.hint,
        value: metric.value
      };
    });
}

function renderQuickAccessGrid(items = []) {
  if (!items.length) return "";
  return `
    <section class="admin-quick-section">
      <div class="portal-section-head">
        <div>
          <h2>Truy cập nhanh</h2>
          <p>Đi vào từng module vận hành bằng dữ liệu thực tế.</p>
        </div>
      </div>
      <div class="admin-quick-grid">
        ${items
          .map(
            (item) => `
              <a class="admin-quick-card" href="${routePath(item.routeKey)}" data-search="${escapeHtml(item.title)}">
                <div class="admin-quick-card-top">
                  <span class="material-symbols-outlined admin-quick-icon">${item.icon}</span>
                  <strong>${escapeHtml(String(item.value))}</strong>
                </div>
                <div class="admin-quick-card-copy">
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.hint)}</p>
                </div>
              </a>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function groupMonthlyRevenue(payments) {
  const labels = ["T1", "T2", "T3", "T4", "T5", "T6"];
  const grouped = new Map(labels.map((label) => [label, 0]));
  payments.forEach((payment) => {
    if (!["paid", "refunded"].includes(payment.status)) return;
    const date = payment.paid_at || payment.created_at || payment.requested_at;
    if (!date) return;
    const month = `T${new Date(date).getMonth() + 1}`;
    grouped.set(month, (grouped.get(month) || 0) + Number(payment.amount || 0));
  });
  const values = labels.map((label) => grouped.get(label) || 0);
  const max = Math.max(...values, 1);
  return labels.map((label, index) => ({ label, height: Math.max(18, Math.round((values[index] / max) * 100)) }));
}

function mapRegion(destinationLabel) {
  const value = String(destinationLabel || "").toLowerCase();
  if (/(ha long|ha noi|sapa|sa pa|ninh binh|quang ninh)/.test(value)) return "North";
  if (/(da nang|hoi an|hue|nha trang|quy nhon)/.test(value)) return "Central";
  return "South";
}

function getRegionBreakdown(bookings) {
  const counts = new Map([["North", 0], ["Central", 0], ["South", 0]]);
  bookings.forEach((booking) => {
    const region = mapRegion(booking.tour?.destinationLabel || booking.snapshot_jsonb?.tour_name || "");
    counts.set(region, (counts.get(region) || 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0) || 1;
  return Array.from(counts.entries()).map(([label, value]) => ({ label, percent: Math.round((value / total) * 100) }));
}
function getTopTours(bookings, tours = []) {
  const groups = new Map();
  bookings.forEach((booking) => {
    const key = booking.tour?.id || booking.tour_id || booking.snapshot_jsonb?.tour_name;
    if (!key) return;
    const current = groups.get(key) || {
      name: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour",
      image: getBookingCoverImage(booking),
      price: booking.tour?.startingPrice || booking.total_amount || 0,
      currency: booking.currency || booking.tour?.baseCurrency || "VND",
      rating: booking.tour?.ratingAverage || Number(booking.review?.rating || 0),
      bookings: 0,
      destinationLabel: booking.tour?.destinationLabel || "Đang cập nhật"
    };
    current.bookings += 1;
    groups.set(key, current);
  });
  const ranked = Array.from(groups.values()).sort((left, right) => right.bookings - left.bookings);
  if (ranked.length) return ranked.slice(0, 4);
  return [];
}

function slugifyAdminValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseAdminListInput(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}


function formatOptionHint(options = [], field = "slug", limit = 8) {
  return (options || [])
    .map((item) => String(item?.[field] || item?.name || item?.id || "").trim())
    .filter(Boolean)
    .slice(0, limit)
    .join(", ");
}

function formatDateTimeInputValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString().slice(0, 16);
}

function getSchedulePrice(schedule, travelerType = "adult") {
  const match = (schedule?.prices || []).find((item) => item.travelerType === travelerType || item.traveler_type === travelerType);
  return Number(match?.price || 0);
}

function getTourRecord(data, tourId) {
  return (data?.tours || []).find((tour) => String(tour.id) === String(tourId)) || null;
}

function getScheduleRecord(data, scheduleId) {
  return (data?.schedules || []).find((schedule) => String(schedule.id) === String(scheduleId)) || null;
}

function getCouponRecord(data, couponId) {
  return (data?.coupons || []).find((coupon) => String(coupon.id) === String(couponId)) || null;
}

function getBannerRecord(data, bannerId) {
  return (data?.banners || []).find((banner) => String(banner.id) === String(bannerId)) || null;
}

function getCmsRecord(data, pageId) {
  return (data?.cmsPages || []).find((page) => String(page.id) === String(pageId)) || null;
}

function getProfileRecord(data, profileId) {
  return (data?.profiles || []).find((profile) => String(profile.id) === String(profileId)) || null;
}

function getTicketRecord(data, ticketId) {
  return (data?.tickets || []).find((ticket) => String(ticket.id) === String(ticketId)) || null;
}

function getSystemSettingRecord(data, settingId) {
  return (data?.systemSettings || []).find((setting) => String(setting.id) === String(settingId)) || null;
}

function getPaymentMethodRecord(data, methodId) {
  return (data?.paymentMethods || []).find((method) => String(method.id) === String(methodId)) || null;
}

function getAssignableProfiles(data) {
  return (data?.profiles || []).filter((profile) => ["staff", "admin", "super_admin"].includes(profile.primaryRole));
}

function formatSettingValueInput(value) {
  if (value == null) return "{}";
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value, null, 2);
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return JSON.stringify(String(value), null, 2);
  }
}

function formatSettingValuePreview(value) {
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const normalized = String(raw || "");
  return normalized.length > 160 ? `${normalized.slice(0, 157)}...` : normalized;
}

function resolveCmsPreviewHref(page) {
  if (!page?.previewable) return "";
  return routePath(page.slug);
}

function openAdminCrudModal(entityType, options = {}) {
  MANAGEMENT_RUNTIME.modal = {
    entityType,
    entityId: options.entityId || null,
    seed: options.seed || {}
  };
}

function closeAdminCrudModal() {
  MANAGEMENT_RUNTIME.modal = null;
}

function getAdminCrudDraft(data, modal) {
  if (!modal) return null;
  const seed = modal.seed || {};

  if (modal.entityType === "tour") {
    const existing = modal.entityId ? getTourRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      name: existing?.name || "",
      slug: existing?.slug || "",
      status: existing?.status || "draft",
      durationDays: existing?.durationDays || 3,
      durationNights: existing?.durationNights || 2,
      baseCurrency: existing?.baseCurrency || "VND",
      destinationMode: existing?.primaryDestinationId || existing?.destinationIds?.[0] ? "existing" : "new",
      destinationId: existing?.primaryDestinationId || existing?.destinationIds?.[0] || "",
      newDestinationName: "",
      newDestinationSlug: "",
      newDestinationType: "city",
      newDestinationParentId: "",
      categoryIds: existing?.categoryIds || [],
      cancellationPolicyId: existing?.cancellationPolicyId || "",
      shortDescription: existing?.shortDescription || "",
      description: existing?.description || "",
      coverImageUrl: existing?.coverImage || "",
      galleryImageUrls: existing?.gallery?.filter((item) => !item.isCover).map((item) => item.imageUrl).join("\n") || "",
      itineraryInput: existing?.itineraryInput || "",
      includedText: existing?.includedText || "",
      excludedText: existing?.excludedText || "",
      termsText: existing?.termsText || "",
      importantNotes: existing?.importantNotes || "",
      isFeatured: Boolean(existing?.isFeatured)
    };
  }

  if (modal.entityType === "schedule") {
    const existing = modal.entityId ? getScheduleRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      tourId: existing?.tourId || seed.tourId || "",
      departureDate: existing?.departureDate || "",
      returnDate: existing?.returnDate || "",
      capacity: existing?.capacity || 20,
      status: existing?.status || "draft",
      adultPrice: getSchedulePrice(existing, "adult") || "",
      childPrice: getSchedulePrice(existing, "child") || "",
      infantPrice: getSchedulePrice(existing, "infant") || "",
      meetingPoint: existing?.meetingPoint || "",
      meetingAt: formatDateTimeInputValue(existing?.meetingAt),
      cutoffAt: formatDateTimeInputValue(existing?.cutoffAt),
      currency: existing?.currency || "VND",
      notes: existing?.notes || ""
    };
  }

  if (modal.entityType === "coupon") {
    const existing = modal.entityId ? getCouponRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      code: existing?.code || "",
      name: existing?.name || "",
      description: existing?.description || "",
      discountType: existing?.discountType || "percentage",
      discountValue: existing?.discountValue || "",
      minOrderAmount: existing?.minOrderAmount || 0,
      maxDiscountAmount: existing?.maxDiscountAmount ?? "",
      usageLimit: existing?.usageLimit ?? "",
      usagePerUserLimit: existing?.usagePerUserLimit ?? "",
      startAt: formatDateTimeInputValue(existing?.startAt),
      endAt: formatDateTimeInputValue(existing?.endAt),
      isActive: Boolean(existing?.isActive),
      tourIds: existing?.tourIds || [],
      categoryIds: existing?.categoryIds || []
    };
  }

  if (modal.entityType === "banner") {
    const existing = modal.entityId ? getBannerRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      title: existing?.title || "",
      imageUrl: existing?.imageUrl || "",
      linkUrl: existing?.linkUrl || "",
      placement: existing?.placement || "home",
      sortOrder: existing?.sortOrder ?? 0,
      startAt: formatDateTimeInputValue(existing?.startAt),
      endAt: formatDateTimeInputValue(existing?.endAt),
      isActive: Boolean(existing?.isActive ?? existing?.is_active)
    };
  }

  if (modal.entityType === "cms") {
    const existing = modal.entityId ? getCmsRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      title: existing?.title || "",
      slug: existing?.slug || "",
      metaTitle: existing?.metaTitle || "",
      metaDescription: existing?.metaDescription || "",
      content: existing?.content || "",
      isPublished: Boolean(existing?.isPublished),
      previewHref: resolveCmsPreviewHref(existing)
    };
  }

  if (modal.entityType === "ticket") {
    const existing = modal.entityId ? getTicketRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      ticketCode: existing?.ticket_code || existing?.ticketCode || "",
      subject: existing?.subject || "",
      customerName: existing?.customerName || "Khách hàng",
      bookingCode: existing?.bookingCode || "",
      priority: existing?.priority || "normal",
      status: existing?.status || "open",
      assignedTo: existing?.assigned_to || existing?.assignee?.id || "",
      note: "",
      createdAt: existing?.created_at || "",
      updatedAt: existing?.updated_at || "",
      tourName: existing?.tour?.name || "",
      messages: existing?.messages || []
    };
  }

  if (modal.entityType === "user") {
    const existing = modal.entityId ? getProfileRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      fullName: existing?.full_name || existing?.email || "Người dùng",
      email: existing?.email || "",
      roleName: existing?.primaryRole || "customer",
      status: existing?.status || "active",
      bookingCount: existing?.bookingCount || 0,
      totalSpend: existing?.totalSpend || 0,
      lastBookingAt: existing?.lastBookingAt || existing?.created_at || "",
      isSelf: String(existing?.id || "") === String(data?.viewer?.user?.id || "")
    };
  }

  if (modal.entityType === "setting") {
    const existing = modal.entityId ? getSystemSettingRecord(data, modal.entityId) : null;
    return {
      id: existing?.id || null,
      settingKey: existing?.setting_key || seed.settingKey || "",
      description: existing?.description || seed.description || "",
      settingValueInput: formatSettingValueInput(existing?.setting_value ?? seed.settingValue ?? {})
    };
  }

  return null;
}

function renderAdminFormField(label, control, { hint = "", full = false } = {}) {
  return `
    <label class="admin-form-field${full ? " is-full" : ""}">
      <span>${escapeHtml(label)}</span>
      ${control}
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
    </label>
  `;
}

function renderAdminTextInput({ label, name, value = "", type = "text", placeholder = "", required = false, full = false, min = null, step = null, hint = "" }) {
  return renderAdminFormField(label, `<input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""} ${min != null ? `min="${escapeHtml(String(min))}"` : ""} ${step != null ? `step="${escapeHtml(String(step))}"` : ""} />`, { hint, full });
}

function renderAdminTextarea({ label, name, value = "", rows = 4, placeholder = "", full = true, hint = "" }) {
  return renderAdminFormField(label, `<textarea name="${escapeHtml(name)}" rows="${escapeHtml(String(rows))}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`, { hint, full });
}

function renderAdminSelect({ label, name, value = "", options = [], required = false, full = false, hint = "" }) {
  return renderAdminFormField(label, `<select name="${escapeHtml(name)}" ${required ? "required" : ""}>${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(option.value) === String(value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select>`, { hint, full });
}

function renderAdminToggle({ label, name, checked = false, hint = "", full = true }) {
  return `
    <label class="admin-toggle-field${full ? " is-full" : ""}">
      <input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""} />
      <span>
        <strong>${escapeHtml(label)}</strong>
        ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
      </span>
    </label>
  `;
}

function renderAdminChecklist({ label, name, options = [], selectedValues = [], hint = "", full = true }) {
  const selected = new Set((selectedValues || []).map((value) => String(value)));
  const content = options.length
    ? options.map((option) => `
        <label class="admin-check-item">
          <input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option.id)}" ${selected.has(String(option.id)) ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(option.name || option.slug || option.id)}</strong>
            ${option.slug ? `<small>${escapeHtml(option.slug)}</small>` : ""}
          </span>
        </label>
      `).join("")
    : `<div class="admin-form-empty">Chưa có dữ liệu.</div>`;

  return `
    <fieldset class="admin-form-field admin-form-field-checklist${full ? " is-full" : ""}">
      <legend>${escapeHtml(label)}</legend>
      <div class="admin-form-checklist">${content}</div>
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
    </fieldset>
  `;
}

function renderAdminModalSection(title, description, body, { full = true, tone = "default" } = {}) {
  return `
    <section class="admin-modal-section admin-modal-section-${escapeHtml(tone)}${full ? " is-full" : ""}">
      <div class="admin-modal-section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <div class="admin-modal-section-body">${body}</div>
    </section>
  `;
}

function renderAdminModalShell({ title, description, entityType, entityId = "", submitLabel, body }) {
  return `
    <div class="admin-modal-header">
      <div>
        <span class="eyebrow">${escapeHtml(entityId ? "Ch\u1ec9nh s\u1eeda" : "T\u1ea1o m\u1edbi")}</span>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <button class="admin-inline-button" type="button" data-admin-close-modal>\u0110\u00f3ng</button>
    </div>
    <form class="admin-modal-form" data-admin-modal-form="${escapeHtml(entityType)}" data-entity-id="${escapeHtml(entityId)}">
      <div class="admin-form-grid">
        ${body}
      </div>
      <div class="admin-modal-actions">
        <button class="admin-inline-button" type="button" data-admin-close-modal>H\u1ee7y</button>
        <button class="admin-inline-button is-primary" type="submit">${escapeHtml(submitLabel)}</button>
      </div>
    </form>
  `;
}

function renderTourCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  const options = data?.catalogOptions || { locations: [], categories: [], cancellationPolicies: [] };
  const locationOptions = options.locations || [];
  const locationSelectOptions = [{ value: "", label: "Ch\u1ecdn \u0111i\u1ec3m \u0111\u1ebfn c\u00f3 s\u1eb5n" }, ...locationOptions.map((location) => ({ value: location.id, label: `${location.name} (${location.slug})` }))];
  const parentLocationOptions = [{ value: "", label: "Kh\u00f4ng g\u1eafn \u0111i\u1ec3m \u0111\u1ebfn cha" }, ...locationOptions.map((location) => ({ value: location.id, label: `${location.name} (${location.slug})` }))];

  return renderAdminModalShell({
    title: draft.id ? "S\u1eeda tour" : "T\u1ea1o tour m\u1edbi",
    description: "T\u1ea1o tour m\u1edbi t\u1eeb DB th\u1eadt, k\u00e8m \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi n\u1ebfu c\u1ea7n.",
    entityType: "tour",
    entityId: draft.id || "",
    submitLabel: draft.id ? "L\u01b0u tour" : "T\u1ea1o tour",
    body: `
      ${renderAdminModalSection("T\u1ed5ng quan tour", "Nh\u1eadp c\u00e1c th\u00f4ng tin c\u1ed1t l\u00f5i tr\u01b0\u1edbc khi m\u1edf b\u00e1n.", `
        <div class="admin-form-grid">
          ${renderAdminTextInput({ label: "T\u00ean tour", name: "name", value: draft.name, required: true })}
          ${renderAdminTextInput({ label: "Slug", name: "slug", value: draft.slug, required: true, hint: "D\u00f9ng cho \u0111\u01b0\u1eddng d\u1eabn public." })}
          ${renderAdminSelect({ label: "Tr\u1ea1ng th\u00e1i", name: "status", value: draft.status, options: [{ value: "draft", label: "Nh\u00e1p" }, { value: "published", label: "Hi\u1ec3n th\u1ecb" }, { value: "archived", label: "L\u01b0u tr\u1eef" }] })}
          ${renderAdminTextInput({ label: "Ti\u1ec1n t\u1ec7", name: "baseCurrency", value: draft.baseCurrency })}
          ${renderAdminTextInput({ label: "S\u1ed1 ng\u00e0y", name: "durationDays", value: draft.durationDays, type: "number", min: 1, step: 1 })}
          ${renderAdminTextInput({ label: "S\u1ed1 \u0111\u00eam", name: "durationNights", value: draft.durationNights, type: "number", min: 0, step: 1 })}
          ${renderAdminSelect({ label: "Ch\u00ednh s\u00e1ch h\u1ee7y", name: "cancellationPolicyId", value: draft.cancellationPolicyId, options: [{ value: "", label: "Kh\u00f4ng g\u1eafn ch\u00ednh s\u00e1ch" }, ...options.cancellationPolicies.map((policy) => ({ value: policy.id, label: policy.name }))] })}
          ${renderAdminToggle({ label: "\u0110\u00e1nh d\u1ea5u tour n\u1ed5i b\u1eadt", name: "isFeatured", checked: draft.isFeatured, hint: "Tour featured s\u1ebd \u01b0u ti\u00ean xu\u1ea5t hi\u1ec7n \u1edf home/listing.", full: false })}
        </div>
      `)}
      ${renderAdminModalSection("\u0110i\u1ec3m \u0111\u1ebfn v\u00e0 ph\u00e2n lo\u1ea1i", "B\u1ea1n c\u00f3 th\u1ec3 g\u1eafn location c\u00f3 s\u1eb5n ho\u1eb7c t\u1ea1o \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi ngay trong popup n\u00e0y.", `
        <div class="admin-form-grid">
          ${renderAdminSelect({ label: "\u0110i\u1ec3m \u0111\u1ebfn c\u00f3 s\u1eb5n", name: "destinationId", value: draft.destinationId, options: locationSelectOptions, hint: "N\u1ebfu b\u1ea1n nh\u1eadp \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi b\u00ean d\u01b0\u1edbi, h\u1ec7 th\u1ed1ng s\u1ebd \u01b0u ti\u00ean t\u1ea1o m\u1edbi." })}
          ${renderAdminChecklist({ label: "Danh m\u1ee5c \u00e1p d\u1ee5ng", name: "categoryIds", options: options.categories, selectedValues: draft.categoryIds, hint: "C\u00f3 th\u1ec3 ch\u1ecdn nhi\u1ec1u danh m\u1ee5c." })}
        </div>
        <div class="admin-modal-callout admin-modal-callout-highlight">
          <div class="admin-modal-callout-copy">
            <strong>T\u1ea1o \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi</strong>
            <p>\u0110i\u1ec1n c\u00e1c tr\u01b0\u1eddng b\u00ean d\u01b0\u1edbi n\u1ebfu tour n\u00e0y thu\u1ed9c m\u1ed9t location ch\u01b0a c\u00f3 trong DB.</p>
          </div>
          <div class="admin-form-grid">
            ${renderAdminTextInput({ label: "T\u00ean \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi", name: "newDestinationName", value: draft.newDestinationName, hint: "V\u00ed d\u1ee5: M\u0169i N\u00e9 - B\u00ecnh Thu\u1eadn" })}
            ${renderAdminTextInput({ label: "Slug \u0111i\u1ec3m \u0111\u1ebfn m\u1edbi", name: "newDestinationSlug", value: draft.newDestinationSlug, hint: "B\u1ecf tr\u1ed1ng \u0111\u1ec3 t\u1ef1 sinh theo t\u00ean." })}
            ${renderAdminSelect({ label: "Lo\u1ea1i location", name: "newDestinationType", value: draft.newDestinationType, options: [{ value: "city", label: "Th\u00e0nh ph\u1ed1 / \u0111i\u1ec3m \u0111\u1ebfn" }, { value: "province", label: "T\u1ec9nh / khu v\u1ef1c" }, { value: "island", label: "\u0110\u1ea3o" }, { value: "region", label: "V\u00f9ng" }, { value: "country", label: "Qu\u1ed1c gia" }] })}
            ${renderAdminSelect({ label: "\u0110i\u1ec3m \u0111\u1ebfn cha", name: "newDestinationParentId", value: draft.newDestinationParentId, options: parentLocationOptions, hint: "Gi\u00fap public page nh\u00f3m \u0111i\u1ec3m \u0111\u1ebfn \u0111\u1eb9p h\u01a1n n\u1ebfu b\u1ea1n g\u1eafn cha." })}
          </div>
        </div>
      `, { tone: "accent" })}
      ${renderAdminModalSection("N\u1ed9i dung hi\u1ec3n th\u1ecb", "M\u00f4 t\u1ea3 tour theo ng\u00f4n ng\u1eef ng\u1eafn g\u1ecdn, d\u1ec5 chuy\u1ec3n \u0111\u1ed5i.", `
        <div class="admin-form-grid">
          ${renderAdminTextarea({ label: "M\u00f4 t\u1ea3 ng\u1eafn", name: "shortDescription", value: draft.shortDescription, rows: 3 })}
          ${renderAdminTextarea({ label: "M\u00f4 t\u1ea3 chi ti\u1ebft", name: "description", value: draft.description, rows: 6 })}
          ${renderAdminTextarea({ label: "Bao g\u1ed3m", name: "includedText", value: draft.includedText, rows: 4 })}
          ${renderAdminTextarea({ label: "Kh\u00f4ng bao g\u1ed3m", name: "excludedText", value: draft.excludedText, rows: 4 })}
          ${renderAdminTextarea({ label: "\u0110i\u1ec1u kho\u1ea3n", name: "termsText", value: draft.termsText, rows: 4 })}
          ${renderAdminTextarea({ label: "L\u01b0u \u00fd quan tr\u1ecdng", name: "importantNotes", value: draft.importantNotes, rows: 4 })}
        </div>
      `)}
      ${renderAdminModalSection("H\u00ecnh \u1ea3nh v\u00e0 l\u1ecbch tr\u00ecnh", "Nh\u1eadp media v\u00e0 itinerary theo format \u0111\u1ec3 c\u00e1c page public d\u00f9ng ngay.", `
        <div class="admin-form-grid">
          ${renderAdminTextInput({ label: "\u1ea2nh cover URL", name: "coverImageUrl", value: draft.coverImageUrl, full: true, required: true, hint: "\u1ea2nh \u0111\u1ea7u ti\u00ean s\u1ebd d\u00f9ng cho card tour v\u00e0 chi ti\u1ebft tour." })}
          ${renderAdminTextarea({ label: "Gallery URL", name: "galleryImageUrls", value: draft.galleryImageUrls, rows: 4, hint: "M\u1ed7i d\u00f2ng m\u1ed9t URL \u1ea3nh ph\u1ee5." })}
          ${renderAdminTextarea({ label: "Itinerary", name: "itineraryInput", value: draft.itineraryInput, rows: 6, hint: "M\u1ed7i d\u00f2ng theo m\u1eabu: s\u1ed1Ng\u00e0y|Ti\u00eau \u0111\u1ec1|M\u00f4 t\u1ea3" })}
        </div>
      `)}
    `
  });
}

function renderScheduleCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  const tourOptions = data?.tours || [];
  return renderAdminModalShell({
    title: draft.id ? "S\u1eeda l\u1ecbch kh\u1edfi h\u00e0nh" : "T\u1ea1o l\u1ecbch kh\u1edfi h\u00e0nh",
    description: "C\u1eadp nh\u1eadt departure schedule v\u00e0 gi\u00e1 theo \u0111\u00fang d\u1eef li\u1ec7u checkout.",
    entityType: "schedule",
    entityId: draft.id || "",
    submitLabel: draft.id ? "L\u01b0u l\u1ecbch" : "T\u1ea1o l\u1ecbch",
    body: `
      ${renderAdminSelect({ label: "Tour", name: "tourId", value: draft.tourId, options: [{ value: "", label: "Ch\u1ecdn tour" }, ...tourOptions.map((tour) => ({ value: tour.id, label: `${tour.name} (${tour.slug})` }))], required: true, full: true })}
      ${renderAdminTextInput({ label: "Ng\u00e0y kh\u1edfi h\u00e0nh", name: "departureDate", value: draft.departureDate, type: "date", required: true })}
      ${renderAdminTextInput({ label: "Ng\u00e0y v\u1ec1", name: "returnDate", value: draft.returnDate, type: "date", required: true })}
      ${renderAdminTextInput({ label: "S\u1ee9c ch\u1ee9a", name: "capacity", value: draft.capacity, type: "number", min: 1, step: 1 })}
      ${renderAdminSelect({ label: "Tr\u1ea1ng th\u00e1i", name: "status", value: draft.status, options: [{ value: "draft", label: "Nh\u00e1p" }, { value: "open", label: "M\u1edf b\u00e1n" }, { value: "sold_out", label: "H\u1ebft ch\u1ed7" }, { value: "closed", label: "\u0110\u00e3 \u0111\u00f3ng" }, { value: "completed", label: "Ho\u00e0n t\u1ea5t" }, { value: "cancelled", label: "\u0110\u00e3 h\u1ee7y" }] })}
      ${renderAdminTextInput({ label: "Gi\u00e1 ng\u01b0\u1eddi l\u1edbn", name: "adultPrice", value: draft.adultPrice, type: "number", min: 0, step: 1000 })}
      ${renderAdminTextInput({ label: "Gi\u00e1 tr\u1ebb em", name: "childPrice", value: draft.childPrice, type: "number", min: 0, step: 1000 })}
      ${renderAdminTextInput({ label: "Gi\u00e1 em b\u00e9", name: "infantPrice", value: draft.infantPrice, type: "number", min: 0, step: 1000 })}
      ${renderAdminTextInput({ label: "\u0110i\u1ec3m h\u1eb9n", name: "meetingPoint", value: draft.meetingPoint })}
      ${renderAdminTextInput({ label: "Th\u1eddi gian h\u1eb9n", name: "meetingAt", value: draft.meetingAt, type: "datetime-local" })}
      ${renderAdminTextInput({ label: "H\u1ea1n ch\u1ed1t", name: "cutoffAt", value: draft.cutoffAt, type: "datetime-local" })}
      ${renderAdminTextInput({ label: "Ti\u1ec1n t\u1ec7", name: "currency", value: draft.currency })}
      ${renderAdminTextarea({ label: "Ghi ch\u00fa", name: "notes", value: draft.notes, rows: 4 })}
    `
  });
}

function renderCouponCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  const categoryOptions = data?.catalogOptions?.categories || [];
  const tours = data?.tours || [];
  return renderAdminModalShell({
    title: draft.id ? "S\u1eeda coupon" : "T\u1ea1o coupon",
    description: "Thi\u1ebft l\u1eadp rule gi\u1ea3m gi\u00e1 theo tour, danh m\u1ee5c v\u00e0 kho\u1ea3ng th\u1eddi gian \u00e1p d\u1ee5ng.",
    entityType: "coupon",
    entityId: draft.id || "",
    submitLabel: draft.id ? "L\u01b0u coupon" : "T\u1ea1o coupon",
    body: `
      ${renderAdminTextInput({ label: "M\u00e3 coupon", name: "code", value: draft.code, required: true })}
      ${renderAdminTextInput({ label: "T\u00ean coupon", name: "name", value: draft.name, required: true })}
      ${renderAdminSelect({ label: "Lo\u1ea1i gi\u1ea3m gi\u00e1", name: "discountType", value: draft.discountType, options: [{ value: "percentage", label: "Ph\u1ea7n tr\u0103m" }, { value: "fixed_amount", label: "S\u1ed1 ti\u1ec1n c\u1ed1 \u0111\u1ecbnh" }] })}
      ${renderAdminTextInput({ label: "Gi\u00e1 tr\u1ecb gi\u1ea3m", name: "discountValue", value: draft.discountValue, type: "number", min: 0, step: 1000, required: true })}
      ${renderAdminTextInput({ label: "\u0110\u01a1n t\u1ed1i thi\u1ec3u", name: "minOrderAmount", value: draft.minOrderAmount, type: "number", min: 0, step: 1000 })}
      ${renderAdminTextInput({ label: "Gi\u1ea3m t\u1ed1i \u0111a", name: "maxDiscountAmount", value: draft.maxDiscountAmount, type: "number", min: 0, step: 1000 })}
      ${renderAdminTextInput({ label: "T\u1ed5ng l\u01b0\u1ee3t d\u00f9ng", name: "usageLimit", value: draft.usageLimit, type: "number", min: 0, step: 1 })}
      ${renderAdminTextInput({ label: "L\u01b0\u1ee3t d\u00f9ng m\u1ed7i user", name: "usagePerUserLimit", value: draft.usagePerUserLimit, type: "number", min: 0, step: 1 })}
      ${renderAdminTextInput({ label: "B\u1eaft \u0111\u1ea7u", name: "startAt", value: draft.startAt, type: "datetime-local" })}
      ${renderAdminTextInput({ label: "K\u1ebft th\u00fac", name: "endAt", value: draft.endAt, type: "datetime-local" })}
      ${renderAdminToggle({ label: "B\u1eadt coupon", name: "isActive", checked: draft.isActive, hint: "N\u1ebfu t\u1eaft, checkout s\u1ebd kh\u00f4ng \u00e1p d\u1ee5ng m\u00e3 n\u00e0y." })}
      ${renderAdminTextarea({ label: "M\u00f4 t\u1ea3", name: "description", value: draft.description, rows: 4 })}
      ${renderAdminChecklist({ label: "\u00c1p d\u1ee5ng cho tour", name: "tourIds", options: tours.map((tour) => ({ id: tour.id, name: tour.name, slug: tour.slug })), selectedValues: draft.tourIds, hint: "B\u1ecf tr\u1ed1ng \u0111\u1ec3 \u00e1p d\u1ee5ng to\u00e0n b\u1ed9 tour." })}
      ${renderAdminChecklist({ label: "\u00c1p d\u1ee5ng cho danh m\u1ee5c", name: "categoryIds", options: categoryOptions, selectedValues: draft.categoryIds, hint: "C\u00f3 th\u1ec3 k\u1ebft h\u1ee3p v\u1edbi tour scope ho\u1eb7c \u0111\u1ec3 tr\u1ed1ng." })}
    `
  });
}

function renderBannerCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  return renderAdminModalShell({
    title: draft.id ? "S\u1eeda banner" : "T\u1ea1o banner",
    description: "Qu\u1ea3n l\u00fd banner hi\u1ec3n th\u1ecb public theo placement v\u00e0 th\u1eddi gian ch\u1ea1y.",
    entityType: "banner",
    entityId: draft.id || "",
    submitLabel: draft.id ? "L\u01b0u banner" : "T\u1ea1o banner",
    body: `
      ${renderAdminTextInput({ label: "Ti\u00eau \u0111\u1ec1", name: "title", value: draft.title, required: true })}
      ${renderAdminTextInput({ label: "Placement", name: "placement", value: draft.placement })}
      ${renderAdminTextInput({ label: "\u1ea2nh banner URL", name: "imageUrl", value: draft.imageUrl, full: true, required: true })}
      ${renderAdminTextInput({ label: "Link click", name: "linkUrl", value: draft.linkUrl, full: true })}
      ${renderAdminTextInput({ label: "Th\u1ee9 t\u1ef1 hi\u1ec3n th\u1ecb", name: "sortOrder", value: draft.sortOrder, type: "number", step: 1 })}
      ${renderAdminTextInput({ label: "B\u1eaft \u0111\u1ea7u", name: "startAt", value: draft.startAt, type: "datetime-local" })}
      ${renderAdminTextInput({ label: "K\u1ebft th\u00fac", name: "endAt", value: draft.endAt, type: "datetime-local" })}
      ${renderAdminToggle({ label: "B\u1eadt banner", name: "isActive", checked: draft.isActive, hint: "Banner b\u1eadt m\u1edbi hi\u1ec3n th\u1ecb l\u00ean public site." })}
    `
  });
}

function renderCmsCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  return renderAdminModalShell({
    title: draft.id ? "S\u1eeda trang CMS" : "T\u1ea1o trang CMS",
    description: "C\u1eadp nh\u1eadt n\u1ed9i dung trang t\u0129nh v\u00e0 \u0111\u1ed3ng b\u1ed9 hi\u1ec3n th\u1ecb public t\u1eeb DB th\u1eadt.",
    entityType: "cms",
    entityId: draft.id || "",
    submitLabel: draft.id ? "L\u01b0u trang" : "T\u1ea1o trang",
    body: `
      ${renderAdminTextInput({ label: "Ti\u00eau \u0111\u1ec1", name: "title", value: draft.title, required: true })}
      ${renderAdminTextInput({ label: "Slug", name: "slug", value: draft.slug, required: true, hint: "C\u00e1c slug about-us, privacy-policy, terms-and-conditions c\u00f3 th\u1ec3 preview tr\u1ef1c ti\u1ebfp." })}
      ${renderAdminTextInput({ label: "Meta title", name: "metaTitle", value: draft.metaTitle })}
      ${renderAdminTextarea({ label: "Meta description", name: "metaDescription", value: draft.metaDescription, rows: 3 })}
      ${renderAdminToggle({ label: "C\u00f4ng khai trang", name: "isPublished", checked: draft.isPublished, hint: draft.previewHref ? `Preview hi\u1ec7n t\u1ea1i: ${draft.previewHref}` : "N\u1ebfu t\u1eaft, public site s\u1ebd kh\u00f4ng \u0111\u1ecdc trang n\u00e0y." })}
      ${renderAdminTextarea({ label: "N\u1ed9i dung", name: "content", value: draft.content, rows: 10, hint: "Hi\u1ec7n \u0111ang render d\u1ea1ng text paragraphs t\u1eeb DB." })}
    `
  });
}

function renderTicketCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  const assigneeOptions = [{ value: "", label: "Tự nhận xử lý / giữ nguyên" }, ...getAssignableProfiles(data).map((profile) => ({ value: profile.id, label: `${profile.full_name || profile.email} (${roleLabel(profile.primaryRole)})` }))];
  const conversation = draft.messages.length
    ? draft.messages.slice(-6).map((message) => `
        <article class="admin-mini-row">
          <div>
            <strong>${escapeHtml(message.senderName || message.sender_type || "Hệ thống")}</strong>
            <p>${escapeHtml(message.message || "")}</p>
          </div>
          <div class="admin-mini-row-side">
            <span>${escapeHtml(message.sender_type || "system")}</span>
            <em>${escapeHtml(formatDateTime(message.created_at))}</em>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state"><h3>Chưa có hội thoại</h3><p>Ticket này chưa phát sinh tin nhắn nào trong DB.</p></div>';

  return renderAdminModalShell({
    title: `Xử lý ticket ${draft.ticketCode || ""}`.trim(),
    description: "Phân công staff, cập nhật trạng thái và trả lời khách ngay trên dữ liệu thật.",
    entityType: "ticket",
    entityId: draft.id || "",
    submitLabel: "Lưu ticket",
    body: `
      ${renderAdminModalSection("Thông tin ticket", "Tóm tắt yêu cầu đang cần xử lý.", `
        <div class="admin-settings-grid">
          <article class="admin-setting-card"><span>Khách hàng</span><strong>${escapeHtml(draft.customerName || "Khách hàng")}</strong><p>${escapeHtml(draft.bookingCode ? `Booking #${draft.bookingCode}` : "Không gắn booking")}</p></article>
          <article class="admin-setting-card"><span>Mức ưu tiên</span><strong>${escapeHtml(draft.priority || "normal")}</strong><p>${escapeHtml(draft.tourName || "Chưa có tour liên quan")}</p></article>
          <article class="admin-setting-card"><span>Trạng thái hiện tại</span><strong>${escapeHtml(formatStatus(draft.status))}</strong><p>${escapeHtml(draft.createdAt ? formatDateTime(draft.createdAt) : "Đang cập nhật")}</p></article>
          <article class="admin-setting-card"><span>Tiêu đề</span><strong>${escapeHtml(draft.subject || "Ticket hỗ trợ")}</strong><p>${escapeHtml(draft.updatedAt ? `Cập nhật ${formatDateTime(draft.updatedAt)}` : "")}</p></article>
        </div>
      `)}
      ${renderAdminModalSection("Hội thoại gần nhất", "Đọc nhanh nội dung trao đổi gần đây trước khi trả lời khách.", conversation)}
      ${renderAdminModalSection("Điều phối xử lý", "Chọn người phụ trách, đổi trạng thái và thêm phản hồi mới cho khách.", `
        <div class="admin-form-grid">
          ${renderAdminSelect({ label: "Trạng thái", name: "status", value: draft.status, options: [{ value: "open", label: "Đang mở" }, { value: "in_progress", label: "Đang xử lý" }, { value: "resolved", label: "Đã xử lý" }, { value: "closed", label: "Đã đóng" }], required: true })}
          ${renderAdminSelect({ label: "Phân công", name: "assignedTo", value: draft.assignedTo, options: assigneeOptions, hint: "Nếu bỏ trống, hệ thống sẽ giữ người đang xử lý hiện tại hoặc tự gán cho bạn." })}
          ${renderAdminTextarea({ label: "Phản hồi mới", name: "note", value: draft.note, rows: 5, hint: "Tin nhắn này sẽ được lưu vào support_ticket_messages và gửi thông báo cho khách." })}
        </div>
      `, { tone: "accent" })}
    `
  });
}

function renderUserCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  const roleOptions = (data?.roles || []).map((role) => ({ value: role.name, label: roleLabel(role.name) }));
  return renderAdminModalShell({
    title: "Quản lý người dùng",
    description: "Đổi vai trò và trạng thái tài khoản trực tiếp từ roles, user_roles và profiles.",
    entityType: "user",
    entityId: draft.id || "",
    submitLabel: "Lưu người dùng",
    body: `
      ${renderAdminModalSection("Tóm tắt tài khoản", "Kiểm tra nhanh hồ sơ trước khi chỉnh vai trò hoặc trạng thái.", `
        <div class="admin-settings-grid">
          <article class="admin-setting-card"><span>Người dùng</span><strong>${escapeHtml(draft.fullName)}</strong><p>${escapeHtml(draft.email || "Chưa có email")}</p></article>
          <article class="admin-setting-card"><span>Booking</span><strong>${escapeHtml(String(draft.bookingCount || 0))}</strong><p>${escapeHtml(formatCurrency(draft.totalSpend || 0, "VND"))}</p></article>
          <article class="admin-setting-card"><span>Vai trò hiện tại</span><strong>${escapeHtml(roleLabel(draft.roleName))}</strong><p>${escapeHtml(draft.lastBookingAt ? `Lần gần nhất ${formatDateTime(draft.lastBookingAt)}` : "Chưa có lịch sử booking")}</p></article>
          <article class="admin-setting-card"><span>Trạng thái</span><strong>${escapeHtml(formatStatus(draft.status))}</strong><p>${escapeHtml(draft.isSelf ? "Tài khoản đang đăng nhập" : "Có thể cập nhật từ popup này")}</p></article>
        </div>
      `)}
      ${renderAdminModalSection("Phân quyền và truy cập", "Role chỉ lấy từ DB thật. Không còn fallback từ email hay local state.", `
        <div class="admin-form-grid">
          ${renderAdminSelect({ label: "Vai trò", name: "roleName", value: draft.roleName, options: roleOptions, required: true })}
          ${renderAdminSelect({ label: "Trạng thái tài khoản", name: "status", value: draft.status, options: [{ value: "active", label: "Hoạt động" }, { value: "inactive", label: "Tạm ngừng" }, { value: "blocked", label: "Khóa" }], required: true })}
        </div>
        ${draft.isSelf ? '<div class="admin-mini-note"><strong>Lưu ý</strong><p>Backend sẽ chặn việc tự đổi vai trò hoặc tự khóa tài khoản đang đăng nhập.</p></div>' : ''}
      `, { tone: "accent" })}
    `
  });
}

function renderSettingCrudModal(data, modal) {
  const draft = getAdminCrudDraft(data, modal);
  return renderAdminModalShell({
    title: draft.id ? "Sửa cấu hình hệ thống" : "Tạo cấu hình hệ thống",
    description: "Cập nhật key/value trong bảng system_settings bằng JSON hợp lệ.",
    entityType: "setting",
    entityId: draft.id || "",
    submitLabel: draft.id ? "Lưu cấu hình" : "Tạo cấu hình",
    body: `
      ${renderAdminModalSection("Meta setting", "Key phải ổn định để app đọc đúng logic ở các page khác.", `
        <div class="admin-form-grid">
          ${renderAdminTextInput({ label: "Setting key", name: "settingKey", value: draft.settingKey, required: true })}
          ${renderAdminTextInput({ label: "Mô tả", name: "description", value: draft.description, full: true })}
        </div>
      `)}
      ${renderAdminModalSection("Giá trị JSON", "Nhập JSON hợp lệ. Ví dụ: true, 10, \"text\", [1,2] hoặc object đầy đủ.", `
        <div class="admin-form-grid">
          ${renderAdminTextarea({ label: "Setting value", name: "settingValue", value: draft.settingValueInput, rows: 12, hint: "Giá trị sẽ ghi thẳng vào system_settings.setting_value.", full: true })}
        </div>
      `, { tone: "accent" })}
    `
  });
}

function renderAdminCrudModal(data) {
  const modal = MANAGEMENT_RUNTIME.modal;
  if (!modal) return "";
  const content = {
    tour: () => renderTourCrudModal(data, modal),
    schedule: () => renderScheduleCrudModal(data, modal),
    coupon: () => renderCouponCrudModal(data, modal),
    banner: () => renderBannerCrudModal(data, modal),
    cms: () => renderCmsCrudModal(data, modal),
    ticket: () => renderTicketCrudModal(data, modal),
    user: () => renderUserCrudModal(data, modal),
    setting: () => renderSettingCrudModal(data, modal)
  }[modal.entityType]?.() || "";
  if (!content) return "";
  return `
    <div class="admin-modal-layer">
      <button class="admin-modal-backdrop" type="button" data-admin-close-modal aria-label="Đóng popup"></button>
      <section class="admin-modal-shell">
        ${content}
      </section>
    </div>
  `;
}

function readTourFormData(form) {
  const formData = new FormData(form);
  const newDestinationName = String(formData.get("newDestinationName") || "").trim();
  const newDestinationSlug = String(formData.get("newDestinationSlug") || "").trim();
  const newDestinationType = String(formData.get("newDestinationType") || "city").trim();
  const newDestinationParentId = String(formData.get("newDestinationParentId") || "").trim();
  const hasNewDestination = Boolean(newDestinationName);

  return {
    id: form.dataset.entityId || null,
    name: String(formData.get("name") || "").trim(),
    slug: String(formData.get("slug") || slugifyAdminValue(formData.get("name"))).trim(),
    status: String(formData.get("status") || "draft"),
    durationDays: Number(formData.get("durationDays") || 1),
    durationNights: Number(formData.get("durationNights") || 0),
    baseCurrency: String(formData.get("baseCurrency") || "VND").trim(),
    destinationIds: !hasNewDestination && formData.get("destinationId") ? [String(formData.get("destinationId"))] : [],
    newDestination: hasNewDestination
      ? {
          name: newDestinationName,
          slug: newDestinationSlug,
          locationType: newDestinationType,
          parentId: newDestinationParentId
        }
      : null,
    categoryIds: formData.getAll("categoryIds").map(String),
    cancellationPolicyId: String(formData.get("cancellationPolicyId") || "").trim(),
    shortDescription: String(formData.get("shortDescription") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    coverImageUrl: String(formData.get("coverImageUrl") || "").trim(),
    galleryImageUrls: parseAdminListInput(formData.get("galleryImageUrls") || ""),
    itineraryInput: String(formData.get("itineraryInput") || "").trim(),
    includedText: String(formData.get("includedText") || "").trim(),
    excludedText: String(formData.get("excludedText") || "").trim(),
    termsText: String(formData.get("termsText") || "").trim(),
    importantNotes: String(formData.get("importantNotes") || "").trim(),
    isFeatured: formData.has("isFeatured")
  };
}

function readScheduleFormData(form) {
  const formData = new FormData(form);
  return {
    id: form.dataset.entityId || null,
    tourId: String(formData.get("tourId") || "").trim(),
    departureDate: String(formData.get("departureDate") || "").trim(),
    returnDate: String(formData.get("returnDate") || "").trim(),
    capacity: Number(formData.get("capacity") || 0),
    status: String(formData.get("status") || "draft"),
    adultPrice: Number(formData.get("adultPrice") || 0),
    childPrice: Number(formData.get("childPrice") || 0),
    infantPrice: Number(formData.get("infantPrice") || 0),
    meetingPoint: String(formData.get("meetingPoint") || "").trim(),
    meetingAt: String(formData.get("meetingAt") || "").trim(),
    cutoffAt: String(formData.get("cutoffAt") || "").trim(),
    currency: String(formData.get("currency") || "VND").trim(),
    notes: String(formData.get("notes") || "").trim()
  };
}

function readCouponFormData(form) {
  const formData = new FormData(form);
  return {
    id: form.dataset.entityId || null,
    code: String(formData.get("code") || "").trim(),
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    discountType: String(formData.get("discountType") || "percentage"),
    discountValue: Number(formData.get("discountValue") || 0),
    minOrderAmount: Number(formData.get("minOrderAmount") || 0),
    maxDiscountAmount: String(formData.get("maxDiscountAmount") || "").trim(),
    usageLimit: String(formData.get("usageLimit") || "").trim(),
    usagePerUserLimit: String(formData.get("usagePerUserLimit") || "").trim(),
    startAt: String(formData.get("startAt") || "").trim(),
    endAt: String(formData.get("endAt") || "").trim(),
    isActive: formData.has("isActive"),
    tourIds: formData.getAll("tourIds").map(String),
    categoryIds: formData.getAll("categoryIds").map(String)
  };
}

function readBannerFormData(form) {
  const formData = new FormData(form);
  return {
    id: form.dataset.entityId || null,
    title: String(formData.get("title") || "").trim(),
    imageUrl: String(formData.get("imageUrl") || "").trim(),
    linkUrl: String(formData.get("linkUrl") || "").trim(),
    placement: String(formData.get("placement") || "home").trim(),
    sortOrder: Number(formData.get("sortOrder") || 0),
    startAt: String(formData.get("startAt") || "").trim(),
    endAt: String(formData.get("endAt") || "").trim(),
    isActive: formData.has("isActive")
  };
}

function readCmsFormData(form) {
  const formData = new FormData(form);
  return {
    id: form.dataset.entityId || null,
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || slugifyAdminValue(formData.get("title"))).trim(),
    metaTitle: String(formData.get("metaTitle") || "").trim(),
    metaDescription: String(formData.get("metaDescription") || "").trim(),
    content: String(formData.get("content") || "").trim(),
    isPublished: formData.has("isPublished")
  };
}

function readTicketFormData(form) {
  const formData = new FormData(form);
  return {
    ticketId: form.dataset.entityId || null,
    status: String(formData.get("status") || "open").trim(),
    assignedTo: String(formData.get("assignedTo") || "").trim(),
    note: String(formData.get("note") || "").trim()
  };
}

function readUserFormData(form) {
  const formData = new FormData(form);
  return {
    userId: form.dataset.entityId || null,
    roleName: String(formData.get("roleName") || "customer").trim(),
    status: String(formData.get("status") || "active").trim()
  };
}

function readSettingFormData(form) {
  const formData = new FormData(form);
  const rawValue = String(formData.get("settingValue") || "").trim();
  if (!rawValue) {
    throw new Error("Giá trị cấu hình không được để trống.");
  }

  let parsedValue;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error("Giá trị cấu hình phải là JSON hợp lệ.");
  }

  return {
    id: form.dataset.entityId || null,
    settingKey: String(formData.get("settingKey") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    settingValue: parsedValue
  };
}

async function handleAdminCrudSubmit(form, root, currentPage) {
  const entityType = form.dataset.adminModalForm;
  if (!entityType) return;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;

  try {
    if (entityType === "tour") {
      await saveAdminTour(readTourFormData(form));
      showAdminToast("Đã lưu tour thành công.", "success");
    }
    if (entityType === "schedule") {
      await saveAdminSchedule(readScheduleFormData(form));
      showAdminToast("Đã lưu lịch khởi hành.", "success");
    }
    if (entityType === "coupon") {
      await saveAdminCoupon(readCouponFormData(form));
      showAdminToast("Đã lưu coupon.", "success");
    }
    if (entityType === "banner") {
      await saveAdminBanner(readBannerFormData(form));
      showAdminToast("Đã lưu banner.", "success");
    }
    if (entityType === "cms") {
      await saveAdminCmsPage(readCmsFormData(form));
      showAdminToast("Đã lưu trang CMS.", "success");
    }
    if (entityType === "ticket") {
      await updateTicketStatus(readTicketFormData(form));
      showAdminToast("Đã cập nhật ticket hỗ trợ.", "success");
    }
    if (entityType === "user") {
      const payload = readUserFormData(form);
      await updateAdminUserRole(payload);
      await updateAdminUserStatus(payload);
      showAdminToast("Đã cập nhật người dùng.", "success");
    }
    if (entityType === "setting") {
      await saveAdminSystemSetting(readSettingFormData(form));
      showAdminToast("Đã lưu cấu hình hệ thống.", "success");
    }

    closeAdminCrudModal();
    await renderManagementRoot(root, MANAGEMENT_RUNTIME.auth, currentPage);
  } catch (error) {
    showAdminToast(normalizeAdminText(error.message || "Lỗi lưu dữ liệu quản trị."), "error");
    if (submitButton) submitButton.disabled = false;
  }
}

function getManagementStats(data) {
  const bookings = Array.isArray(data?.bookings) ? data.bookings : [];
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  const refunds = Array.isArray(data?.refunds) ? data.refunds : [];
  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  const reviews = Array.isArray(data?.reviews) ? data.reviews : [];
  const schedules = Array.isArray(data?.schedules) ? data.schedules : [];
  const coupons = Array.isArray(data?.coupons) ? data.coupons : [];
  const banners = Array.isArray(data?.banners) ? data.banners : [];
  const cmsPages = Array.isArray(data?.cmsPages) ? data.cmsPages : [];
  const couponUsages = Array.isArray(data?.couponUsages) ? data.couponUsages : [];
  const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
  const bookingCounts = new Map();

  bookings.forEach((booking) => {
    const key = booking.user_id || booking.contact_email || booking.contact_name || booking.booking_code;
    bookingCounts.set(key, (bookingCounts.get(key) || 0) + 1);
  });

  const customerGroups = new Map();
  bookings.forEach((booking) => {
    const key = booking.user_id || booking.contact_email || booking.contact_name || booking.booking_code;
    const current = customerGroups.get(key) || {
      id: key,
      name: booking.contact_name || "Khách hàng",
      email: booking.contact_email || "",
      bookings: 0,
      spend: 0,
      latestAt: booking.created_at || new Date().toISOString()
    };
    current.bookings += 1;
    current.spend += Number(booking.total_amount || 0);
    current.latestAt = String(current.latestAt) > String(booking.created_at || "") ? current.latestAt : booking.created_at;
    customerGroups.set(key, current);
  });

  const roleCounts = profiles.reduce((accumulator, profile) => {
    const role = profile.primaryRole || "customer";
    accumulator[role] = (accumulator[role] || 0) + 1;
    return accumulator;
  }, {});

  return {
    totalBookings: bookings.length,
    pendingBookings: bookings.filter((booking) => ["pending", "awaiting_payment", "cancel_requested"].includes(booking.booking_status)),
    pendingPayments: payments.filter((payment) => !["paid", "refunded"].includes(payment.status)),
    collectedRevenue: payments.filter((payment) => payment.status === "paid").reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    refundAmount: refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0),
    unresolvedTickets: tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)),
    pendingReviews: reviews.filter((review) => review.status !== "approved"),
    activeSchedules: schedules.filter((schedule) => ["draft", "open", "sold_out"].includes(schedule.status)),
    soldOutSchedules: schedules.filter((schedule) => schedule.status === "sold_out"),
    activeCoupons: coupons.filter((coupon) => coupon.isActive),
    activeBanners: banners.filter((banner) => Boolean(banner.is_active ?? banner.isActive)),
    publishedPages: cmsPages.filter((page) => Boolean(page.isPublished || page.is_published || page.publishedAt)),
    totalCouponUsage: couponUsages.length,
    totalUsers: profiles.length,
    customerCount: profiles.filter((profile) => profile.primaryRole === "customer").length,
    repeatCustomers: Array.from(bookingCounts.values()).filter((value) => value > 1).length,
    roleCounts,
    recentCustomers: Array.from(customerGroups.values()).sort((left, right) => String(right.latestAt).localeCompare(String(left.latestAt))).slice(0, 8)
  };
}

function getPageBadge(pageKey, stats) {
  const mapping = {
    reports: String(stats.pendingPayments.length),
    bookings: String(stats.pendingBookings.length),
    payments: String(stats.pendingPayments.length),
    tours: String(stats.activeSchedules.length),
    service: String(stats.unresolvedTickets.length + stats.pendingReviews.length),
    customers: String(stats.customerCount),
    promotions: String(stats.activeCoupons.length),
    users: String(stats.totalUsers),
    content: String(stats.activeBanners.length + stats.publishedPages.length),
    settings: String(stats.activeBanners.length + 1)
  };
  return mapping[pageKey] || "";
}

function buildMenuGroups(role, stats) {
  const pages = getAccessiblePages(role).sort((left, right) => {
    const leftIndex = PAGE_ORDER.indexOf(left);
    const rightIndex = PAGE_ORDER.indexOf(right);
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
  });
  const groups = new Map();
  pages.forEach((pageKey) => {
    const page = PAGE_DEFINITIONS[pageKey];
    if (!groups.has(page.group)) groups.set(page.group, []);
    groups.get(page.group).push({ pageKey, ...page, badge: getPageBadge(pageKey, stats) });
  });
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function buildRoleHighlights(role) {
  return getAccessiblePages(role)
    .filter((pageKey) => pageKey !== "dashboard")
    .slice(0, 4)
    .map((pageKey) => {
      const page = PAGE_DEFINITIONS[pageKey];
      return {
        icon: page.icon,
        title: page.label,
        description: "",
        code: page.permission || "management"
      };
    });
}

function renderMenuGroups(groups, currentPage) {
  return groups.map((group) => `
    <section class="admin-menu-group">
      <span class="admin-menu-label">${escapeHtml(group.label)}</span>
      <nav class="portal-side-menu">
        ${group.items.map((item) => `
          <a class="${item.pageKey === currentPage ? "is-active" : ""}" href="${routePath(item.routeKey)}">
            <span class="admin-menu-item-copy"><span class="material-symbols-outlined">${item.icon}</span><span>${escapeHtml(item.label)}</span></span>
            ${item.badge ? `<b class="admin-menu-badge">${escapeHtml(item.badge)}</b>` : ""}
          </a>
        `).join("")}
      </nav>
    </section>
  `).join("");
}

function renderSidebar(auth, currentPage, stats) {
  const groups = buildMenuGroups(auth.primaryRole, stats);
  return `
    <aside class="portal-sidebar admin-portal-sidebar">
      <a class="admin-sidebar-brand" href="${routePath("admin")}">
        <span class="admin-sidebar-brand-mark">TH</span>
        <span class="admin-sidebar-brand-copy"><strong>The Horizon</strong><span>Control Room</span></span>
      </a>
      <div class="admin-sidebar-user">
        ${renderAvatar(auth.profile, auth.user, "admin-sidebar-avatar")}
        <div>
          <strong>${escapeHtml(auth.profile?.full_name || auth.user?.email || "Admin")}</strong>
          <span>${escapeHtml(roleLabel(auth.primaryRole))}</span>
        </div>
      </div>
      <div class="admin-menu-groups">${renderMenuGroups(groups, currentPage)}</div>
    </aside>
  `;
}
function renderTopbar(auth, currentPage, sourceMode) {
  const page = PAGE_DEFINITIONS[currentPage];
  const name = auth.profile?.full_name || auth.user?.email || "Quản trị viên";
  return `
    <header class="portal-topbar admin-topbar">
      <div class="admin-topbar-copy">
        <span>${escapeHtml(sourceMode === "database" ? "Admin / DB live" : "Admin")}</span>
        <strong>${escapeHtml(page.label)}</strong>
      </div>
      <div class="admin-topbar-tools">
        <div class="portal-search-wrap admin-search-wrap"><span class="material-symbols-outlined">search</span><input id="admin-dashboard-search" type="search" placeholder="${escapeHtml(page.searchPlaceholder)}" /></div>
        <button class="portal-icon-button admin-logout-button" id="admin-logout" type="button" aria-label="Đăng xuất"><span class="material-symbols-outlined">logout</span></button>
        <div class="portal-profile-block admin-profile-block"><div class="portal-profile-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(roleLabel(auth.primaryRole))}</span></div>${renderAvatar(auth.profile, auth.user, "portal-avatar")}</div>
      </div>
    </header>
  `;
}
function renderPageIntro(auth, currentPage, data, stats) {
  const page = PAGE_DEFINITIONS[currentPage];
  const dashboardAction = getDashboardAction(stats);
  const introChips = (currentPage === "dashboard"
    ? [
        `${data.profiles.length} người dùng`,
        `${data.bookings.length} booking`
      ]
    : [
        `${getPageBadge(currentPage, stats) || 0} mục liên quan`
      ]).filter(Boolean).slice(0, 2);

  return `
    <section class="admin-page-intro ${currentPage === "dashboard" ? "is-dashboard" : ""}">
      <div class="admin-page-copy">
        <span class="admin-page-date">${escapeHtml(getAdminDateLabel())}</span>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.description || "Theo dõi và xử lý dữ liệu vận hành từ hệ thống.")}</p>
      </div>
      <div class="admin-page-actions">
        ${currentPage === "dashboard"
          ? `<a class="admin-primary-cta" href="${routePath(dashboardAction.routeKey)}"><span class="material-symbols-outlined">${dashboardAction.icon}</span><span>${escapeHtml(dashboardAction.label)}</span></a>`
          : ""}
        ${introChips.length ? `<div class="admin-chip-list">${introChips.map((chip) => `<span class="admin-soft-pill">${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
      </div>
    </section>
  `;
}
function renderCapabilityGrid(items) {
  return `<section class="admin-capability-grid">${items.map((item) => `<article class="admin-capability-card" data-search="${escapeHtml(`${item.title} ${item.code}`)}"><span class="material-symbols-outlined">${item.icon}</span><div><h3>${escapeHtml(item.title)}</h3></div><em>${escapeHtml(item.code)}</em></article>`).join("")}</section>`;
}

function renderTablePanel(title, description, headers, rows, footerText = "") {
  const summaryText = footerText || `Hiển thị ${rows.length} bản ghi`;
  return `
    <article class="admin-panel admin-ops-table-panel">
      <div class="portal-section-head admin-table-headline">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </div>
        <span class="admin-table-count">${escapeHtml(String(rows.length))} mục</span>
      </div>
      ${rows.length
        ? `<div class="admin-table-wrap"><table class="admin-data-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div><div class="admin-table-footer"><p>${escapeHtml(summaryText)}</p></div>`
        : `<div class="empty-state"><h3>Chưa có dữ liệu</h3><p>Dữ liệu sẽ hiển thị tại đây khi DB có bản ghi.</p></div>`}
    </article>
  `;
}
function renderBookingCards(booking) {
  if (!booking.length) return '<div class="empty-state"><h3>Chưa có booking</h3><p>Booking từ DB sẽ hiện ở đây khi phát sinh giao dịch.</p></div>';
  return booking.slice(0, 5).map((booking) => {
    const tone = getBookingTone(booking);
    return `<article class="admin-queue-card" data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""}`)}"><div class="admin-queue-copy"><strong>#${escapeHtml(booking.booking_code)}</strong><h4>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</h4><p>${escapeHtml(booking.contact_name || "Khách hàng")} - ${escapeHtml(formatShortDate(booking.created_at))}</p></div><div class="admin-queue-side"><span>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</span>${renderStatusTag(tone.label, tone.tone)}</div></article>`;
  }).join("");
}

function renderTopTourList(tours) {
  if (!tours.length) return '<div class="empty-state"><h3>Chưa có xếp hạng tour</h3><p>Tour nổi bật sẽ hiện khi có booking thực tế.</p></div>';
  return tours.map((tour) => {
    const media = renderMediaFrame({
      src: tour.image,
      alt: tour.name,
      className: "admin-tour-image",
      placeholderLabel: "Chưa có ảnh tour trong DB"
    });
    return `
      <article class="admin-tour-item" data-search="${escapeHtml(tour.name)}">
        ${media}
        <div class="admin-tour-copy"><h4>${escapeHtml(tour.name)}</h4><p>${escapeHtml(tour.destinationLabel || "Chưa có điểm đến")} - ${escapeHtml(String(Number(tour.rating || 0).toFixed(1)))} sao</p></div>
        <div class="admin-tour-price"><strong>${escapeHtml(formatCurrency(tour.price, tour.currency || "VND"))}</strong><span>${tour.bookings ? `${tour.bookings} booking` : "Chưa có booking"}</span></div>
      </article>
    `;
  }).join("");
}
function renderTicketList(tickets) {
  if (!tickets.length) return '<div class="empty-state"><h3>Không có ticket mở</h3><p>Mọi yêu cầu hỗ trợ đều đã được xử lý.</p></div>';
  return tickets.slice(0, 8).map((ticket) => {
    const tone = getTicketTone(ticket);
    const latestMessage = ticket.messages?.[ticket.messages.length - 1] || null;
    return `
      <article class="admin-feedback-card" data-search="${escapeHtml(`${ticket.subject || ""} ${ticket.customerName || ""} ${ticket.bookingCode || ""}`)}">
        <div class="admin-feedback-head">
          <div>
            <strong>${escapeHtml(ticket.subject || `Hỗ trợ booking #${ticket.bookingCode || "N/A"}`)}</strong>
            <p>${escapeHtml(ticket.customerName || "Khách hàng")} - ${escapeHtml(ticket.bookingCode || "Không có booking")}</p>
          </div>
          ${renderStatusTag(tone.label, tone.tone)}
        </div>
        <div class="admin-ticket-meta">
          <span><span class="material-symbols-outlined">priority_high</span>${escapeHtml(ticket.priority || "normal")}</span>
          <span><span class="material-symbols-outlined">support_agent</span>${escapeHtml(ticket.assigneeName || "Chưa phân công")}</span>
          <span><span class="material-symbols-outlined">travel_explore</span>${escapeHtml(ticket.tour?.name || "Chưa có tour")}</span>
        </div>
        <blockquote>${escapeHtml(latestMessage?.message || "Chưa có phản hồi mới.")}</blockquote>
        <div class="admin-feedback-actions">
          <button class="admin-inline-button is-primary" type="button" data-admin-action="manage-ticket" data-ticket-id="${escapeHtml(ticket.id)}">Xử lý ticket</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderReviewList(reviews) {
  if (!reviews.length) return '<div class="empty-state"><h3>Không có review chờ duyệt</h3><p>Review mới từ DB sẽ hiện ở đây khi khách gửi đánh giá.</p></div>';
  return reviews.slice(0, 6).map((review) => {
    const tone = getReviewTone(review);
    const replyText = review.reply?.text || "";
    const replyLabel = replyText ? "Cập nhật phản hồi" : "Phản hồi";
    return `
      <article class="admin-feedback-card" data-search="${escapeHtml(`${review.authorName || ""} ${review.tour?.name || ""} ${review.comment || ""}`)}">
        <div class="admin-feedback-head">
          <div>
            <strong>${escapeHtml(review.authorName || review.contactName || "Khách hàng")}</strong>
            <p>${escapeHtml(review.tour?.name || "Tour")}</p>
          </div>
          ${renderStatusTag(tone.label, tone.tone)}
        </div>
        <div class="admin-ticket-meta">
          <span><span class="material-symbols-outlined">star</span>${escapeHtml(String(Number(review.rating || 0).toFixed(1)))}/5</span>
          <span><span class="material-symbols-outlined">schedule</span>${escapeHtml(formatDateTime(review.created_at))}</span>
        </div>
        <blockquote>${escapeHtml(review.comment || "Không có nội dung đánh giá.")}</blockquote>
        ${review.reply ? `<div class="admin-mini-note"><strong>Phản hồi</strong><p>${escapeHtml(review.reply.text)}</p></div>` : ""}
        <div class="admin-feedback-actions">
          ${review.status !== "approved" ? `<button class="admin-inline-button is-primary" type="button" data-admin-action="approve-review" data-review-id="${escapeHtml(review.id)}" data-review-status="approved" data-review-reply="${escapeHtml(replyText)}">Duyệt</button>` : ""}
          ${review.status !== "hidden" ? `<button class="admin-inline-button" type="button" data-admin-action="hide-review" data-review-id="${escapeHtml(review.id)}" data-review-status="hidden" data-review-reply="${escapeHtml(replyText)}">Ẩn</button>` : ""}
          <button class="admin-inline-button" type="button" data-admin-action="reply-review" data-review-id="${escapeHtml(review.id)}" data-review-status="${escapeHtml(review.status || "pending")}" data-review-reply="${escapeHtml(replyText)}">${escapeHtml(replyLabel)}</button>
        </div>
      </article>
    `;
  }).join("");
}
function renderCustomerRows(customers) {
  if (!customers.length) return '<div class="empty-state"><h3>Chưa có khách hàng</h3><p>Dữ liệu khách hàng sẽ hiện khi có profile hoặc booking.</p></div>';
  return customers.map((customer) => `<article class="admin-customer-row" data-search="${escapeHtml(`${customer.name} ${customer.email}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(customer.name))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(customer.name)}</strong><p>${escapeHtml(customer.email || "Chưa có email")}</p></div><div class="admin-customer-row-side"><span>${escapeHtml(String(customer.bookings))} booking</span><em>${escapeHtml(formatCurrency(customer.spend, "VND"))}</em></div></article>`).join("");
}

function renderProfileRows(profiles) {
  if (!profiles.length) return '<div class="empty-state"><h3>Chưa có hồ sơ</h3><p>Hồ sơ người dùng sẽ hiện ở đây.</p></div>';
  return profiles.slice(0, 8).map((profile) => `<article class="admin-profile-row" data-search="${escapeHtml(`${profile.full_name || ""} ${profile.email || ""} ${profile.primaryRole || ""}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(profile.full_name || profile.email || "TH"))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(profile.full_name || profile.email || "Người dùng")}</strong><p>${escapeHtml(profile.email || "Chưa có email")}</p></div><div class="admin-profile-role">${escapeHtml(roleLabel(profile.primaryRole))}</div></article>`).join("");
}

function renderRoleCards(roleCounts) {
  return ["customer", "staff", "admin", "super_admin"].map((role) => `<article class="admin-role-card"><span>${escapeHtml(roleLabel(role))}</span><strong>${escapeHtml(String(roleCounts[role] || 0))}</strong></article>`).join("");
}

function renderPaymentMethods(methods) {
  if (!methods.length) return '<div class="empty-state"><h3>Chưa cấu hình payment method</h3><p>Phương thức thanh toán sẽ hiện ở đây sau khi cấu hình.</p></div>';
  return `<div class="admin-chip-list">${methods.map((method) => `<span class="admin-soft-pill">${escapeHtml(method.name)}</span>`).join("")}</div>`;
}

function renderActivityList(items) {
  if (!items.length) return '<div class="empty-state"><h3>Chưa có activity log</h3><p>Hoạt động hệ thống sẽ hiện ở đây khi DB có bản ghi.</p></div>';
  return `<div class="portal-timeline-list admin-activity-list">${items.slice(0, 6).map((item, index) => `<div class="portal-timeline-item portal-timeline-item-accent-${(index % 3) + 1}" data-search="${escapeHtml(`${item.action} ${item.entity_type}`)}"><span class="portal-timeline-dot"></span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.actor?.full_name || "Hệ thống")} - ${escapeHtml(formatDateTime(item.created_at))}</p></div></div>`).join("")}</div>`;
}

function renderCancellationQueue(booking) {
  if (!booking.length) {
    return '<div class="empty-state"><h3>Không có yêu cầu hủy</h3><p>Yêu cầu hủy booking từ khách sẽ hiện ở đây.</p></div>';
  }

  return booking.slice(0, 6).map((booking) => `
    <article class="admin-feedback-card" data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.cancel_reason || ""}`)}">
      <div class="admin-feedback-head">
        <div>
          <strong>#${escapeHtml(booking.booking_code)}</strong>
          <p>${escapeHtml(booking.contact_name || "Khách hàng")} - ${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</p>
        </div>
        ${renderStatusTag("Chờ duyệt hủy", "danger")}
      </div>
      <blockquote>${escapeHtml(booking.cancel_reason || "Khách đang chờ duyệt yêu cầu hủy booking.")}</blockquote>
      <div class="admin-ticket-meta">
        <span><span class="material-symbols-outlined">payments</span>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</span>
        <span><span class="material-symbols-outlined">calendar_today</span>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</span>
      </div>
      <div class="admin-feedback-actions">
        <button class="admin-inline-button is-primary" type="button" data-admin-action="approve-cancellation" data-booking-code="${escapeHtml(booking.booking_code)}">Duyệt hủy</button>
        <button class="admin-inline-button" type="button" data-admin-action="reject-cancellation" data-booking-code="${escapeHtml(booking.booking_code)}">Từ chối</button>
      </div>
    </article>
  `).join("");
}

function renderPendingPaymentQueue(booking) {
  const actionable = booking.filter((booking) => {
    const latestPayment = booking.payments?.[0] || null;
    const paymentState = latestPayment?.status || booking.payment_status;
    return !["cancelled", "cancel_requested", "expired", "completed"].includes(booking.booking_status)
      && ["pending", "unpaid", "failed"].includes(booking.payment_status)
      && !["paid", "refunded", "partially_refunded"].includes(paymentState);
  });

  if (!actionable.length) {
    return '<div class="empty-state"><h3>Không có queue thanh toán tay</h3><p>Booking chờ xác nhận thanh toán sẽ hiện ở đây.</p></div>';
  }

  return actionable.slice(0, 6).map((booking) => {
    const latestPayment = booking.payments?.[0] || null;
    const actionLabel = latestPayment && ["failed", "expired", "cancelled"].includes(latestPayment.status)
      ? "Thử lại và đánh dấu đã thanh toán"
      : "Ghi nhận thanh toán tay";
    return `
      <article class="admin-ticket-card" data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.tour?.name || ""}`)}">
        <div class="admin-feedback-head">
          <div>
            <strong>#${escapeHtml(booking.booking_code)}</strong>
            <p>${escapeHtml(booking.contact_name || "Khách hàng")} - ${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</p>
          </div>
          ${(() => { const tone = getPaymentTone({ status: latestPayment?.status || booking.payment_status }); return renderStatusTag(tone.label, tone.tone); })()}
        </div>
        <div class="admin-ticket-meta">
          <span><span class="material-symbols-outlined">payments</span>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</span>
          <span><span class="material-symbols-outlined">credit_score</span>${escapeHtml(booking.snapshot_jsonb?.selected_payment_method || latestPayment?.provider_name || "Thủ công")}</span>
        </div>
        <div class="admin-feedback-actions">
          <button class="admin-inline-button is-primary" type="button" data-admin-action="record-manual-payment" data-booking-code="${escapeHtml(booking.booking_code)}">${escapeHtml(actionLabel)}</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderRefundQueue(refunds) {
  const pendingRefunds = refunds.filter((refund) => refund.status === "pending");
  if (!pendingRefunds.length) {
    return '<div class="empty-state"><h3>Không có queue hoàn tiền</h3><p>Bản ghi hoàn tiền chờ xử lý sẽ hiện ở đây.</p></div>';
  }

  return pendingRefunds.slice(0, 6).map((refund) => `
    <article class="admin-feedback-card" data-search="${escapeHtml(`${refund.payment?.booking?.booking_code || ""} ${refund.reason || ""}`)}">
      <div class="admin-feedback-head">
        <div>
          <strong>${escapeHtml(refund.payment?.booking?.booking_code || "Hoàn tiền")}</strong>
          <p>${escapeHtml(refund.payment?.booking?.contact_name || "Khách")} - ${escapeHtml(refund.payment?.provider_name || "Thủ công")}</p>
        </div>
        ${renderStatusTag("Chờ hoàn tiền", "danger")}
      </div>
      <blockquote>${escapeHtml(refund.reason || "Yêu cầu hoàn tiền đang chờ xác nhận từ admin.")}</blockquote>
      <div class="admin-ticket-meta">
        <span><span class="material-symbols-outlined">savings</span>${escapeHtml(formatCurrency(refund.amount, refund.payment?.currency || "VND"))}</span>
        <span><span class="material-symbols-outlined">schedule</span>${escapeHtml(formatDateTime(refund.created_at))}</span>
      </div>
      <div class="admin-feedback-actions">
        <button class="admin-inline-button is-primary" type="button" data-admin-action="process-refund" data-refund-id="${escapeHtml(refund.id)}">Đánh dấu đã hoàn</button>
        <button class="admin-inline-button" type="button" data-admin-action="reject-refund" data-refund-id="${escapeHtml(refund.id)}">Từ chối</button>
      </div>
    </article>
  `).join("");
}

function getRefundState(payment) {
  const refunds = Array.isArray(payment?.refunds) ? payment.refunds : [];
  if (!refunds.length) return "none";
  if (refunds.some((refund) => refund.status === "pending")) return "pending";
  if (refunds.some((refund) => refund.status === "refunded")) return "refunded";
  if (refunds.some((refund) => refund.status === "rejected")) return "rejected";
  return refunds[0]?.status || "none";
}

function getPaymentReconciliation(payment) {
  const booking = payment?.booking || null;
  if (!booking?.id) return { label: "Mất liên kết booking", tone: "danger" };
  if (["paid", "partially_paid", "refunded", "partially_refunded"].includes(payment.status)
    && !["paid", "partially_paid", "refunded", "partially_refunded"].includes(booking.payment_status)) {
    return { label: "Cần đối soát", tone: "info" };
  }
  return { label: "Đã khớp", tone: "success" };
}

function getFilteredBookings(data) {
  const filters = getRuntimeFilters("bookings");
  return (Array.isArray(data?.bookings) ? data.bookings : []).filter((booking) => {
    if (filters.bookingStatus && filters.bookingStatus !== "all" && booking.booking_status !== filters.bookingStatus) return false;
    if (filters.paymentStatus && filters.paymentStatus !== "all" && booking.payment_status !== filters.paymentStatus) return false;
    if (filters.cancellation === "requested" && booking.booking_status !== "cancel_requested") return false;
    if (filters.cancellation === "resolved" && !["cancelled", "confirmed", "awaiting_payment"].includes(booking.booking_status)) return false;
    return true;
  });
}

function getFilteredPayments(data) {
  const filters = getRuntimeFilters("payments");
  return (Array.isArray(data?.payments) ? data.payments : []).filter((payment) => {
    const provider = String(payment.provider_name || payment.paymentMethod?.name || "manual").toLowerCase();
    if (filters.status && filters.status !== "all" && payment.status !== filters.status) return false;
    if (filters.refundStatus && filters.refundStatus !== "all" && getRefundState(payment) !== filters.refundStatus) return false;
    if (filters.provider && filters.provider !== "all" && provider !== filters.provider) return false;
    return true;
  });
}

function buildCustomerRecords(data) {
  const records = new Map();
  const emailIndex = new Map();
  const ensureRecord = (key, seed = {}) => {
    const normalizedKey = String(key || seed.email || seed.name || `customer-${records.size + 1}`);
    if (!records.has(normalizedKey)) {
      records.set(normalizedKey, {
        key: normalizedKey,
        profile: seed.profile || null,
        profileId: seed.profile?.id || seed.profileId || null,
        name: seed.name || seed.profile?.full_name || seed.profile?.email || "Khách hàng",
        email: seed.email || seed.profile?.email || "",
        customerLevel: seed.customerLevel || seed.profile?.customer_level || "",
        bookingCount: Number(seed.bookingCount || 0),
        spend: Number(seed.totalSpend || 0),
        lastActivityAt: seed.lastActivityAt || seed.profile?.lastBookingAt || seed.profile?.created_at || "",
        bookings: [],
        reviews: [],
        tickets: []
      });
    }
    const record = records.get(normalizedKey);
    if (record.email) emailIndex.set(record.email.toLowerCase(), normalizedKey);
    return record;
  };

  (Array.isArray(data?.profiles) ? data.profiles : []).filter((profile) => profile.primaryRole === "customer").forEach((profile) => {
    ensureRecord(profile.id || profile.email, {
      profile,
      name: profile.full_name || profile.email || "Khách hàng",
      email: profile.email || "",
      customerLevel: profile.customer_level || "",
      lastActivityAt: profile.lastBookingAt || profile.created_at || ""
    });
  });

  (Array.isArray(data?.bookings) ? data.bookings : []).forEach((booking) => {
    const key = booking.user_id || (booking.contact_email ? emailIndex.get(String(booking.contact_email).toLowerCase()) : null) || booking.contact_email || booking.contact_name || booking.booking_code;
    const record = ensureRecord(key, { name: booking.contact_name || "Khách hàng", email: booking.contact_email || "" });
    record.bookings.push(booking);
    record.bookingCount += 1;
    record.spend += Number(booking.total_amount || 0);
    record.name = record.name || booking.contact_name || "Khách hàng";
    record.email = record.email || booking.contact_email || "";
    if (booking.user_id && !record.profileId) record.profileId = booking.user_id;
    const bookingDate = String(booking.created_at || "");
    if (bookingDate > String(record.lastActivityAt || "")) record.lastActivityAt = bookingDate;
  });

  (Array.isArray(data?.reviews) ? data.reviews : []).forEach((review) => {
    const booking = review.booking || null;
    const key = review.user_id || booking?.user_id || (booking?.contact_email ? emailIndex.get(String(booking.contact_email).toLowerCase()) : null) || booking?.contact_email || review.authorName || review.id;
    const record = ensureRecord(key, { name: review.authorName || review.contactName || booking?.contact_name || "Khách hàng", email: booking?.contact_email || "" });
    record.reviews.push(review);
    const reviewDate = String(review.created_at || review.createdAt || "");
    if (reviewDate > String(record.lastActivityAt || "")) record.lastActivityAt = reviewDate;
  });

  (Array.isArray(data?.tickets) ? data.tickets : []).forEach((ticket) => {
    const booking = ticket.booking || null;
    const key = ticket.user_id || booking?.user_id || (booking?.contact_email ? emailIndex.get(String(booking.contact_email).toLowerCase()) : null) || booking?.contact_email || ticket.customerName || ticket.id;
    const record = ensureRecord(key, { name: ticket.customerName || booking?.contact_name || "Khách hàng", email: booking?.contact_email || "" });
    record.tickets.push(ticket);
    const ticketDate = String(ticket.updated_at || ticket.created_at || "");
    if (ticketDate > String(record.lastActivityAt || "")) record.lastActivityAt = ticketDate;
  });

  return Array.from(records.values()).filter((record) => record.bookingCount > 0 || record.profile?.primaryRole === "customer").sort((left, right) => String(right.lastActivityAt || "").localeCompare(String(left.lastActivityAt || "")));
}

function getFilteredCustomers(data) {
  const filters = getRuntimeFilters("customers");
  return buildCustomerRecords(data).filter((customer) => {
    if (filters.segment === "repeat") return customer.bookingCount > 1;
    if (filters.segment === "support") return customer.tickets.length > 0;
    if (filters.segment === "vip") return customer.spend >= 10000000 || customer.bookingCount >= 3;
    return true;
  });
}

function renderToolbarField(pageKey, filterKey, label, options) {
  const filters = getRuntimeFilters(pageKey);
  return `<label class="admin-filter-field"><span>${escapeHtml(label)}</span><select data-admin-filter="${escapeHtml(filterKey)}" data-admin-filter-page="${escapeHtml(pageKey)}">${options.map((option) => `<option value="${escapeHtml(option.value)}" ${String(filters[filterKey] || "all") === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
}

function renderOpsToolbar(title, copy, controls = [], actions = "") {
  return `
    <section class="admin-ops-toolbar">
      <div class="admin-ops-toolbar-copy">
        <strong>${escapeHtml(title)}</strong>
        ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
      </div>
      <div class="admin-ops-toolbar-controls">${controls.join("")}</div>
      ${actions ? `<div class="admin-ops-toolbar-actions">${actions}</div>` : ""}
    </section>
  `;
}
function csvEscape(value) {
  const safeValue = String(value ?? "").replace(/"/g, '""');
  return `"${safeValue}"`;
}

function buildCsvContent(headers, rows) {
  return [headers.map(csvEscape).join(","), ...rows.map((row) => row.map(csvEscape).join(","))].join("\n");
}

function downloadCsvFile(fileName, headers, rows) {
  if (typeof document === "undefined" || !rows.length) {
    showAdminToast("Không có dữ liệu để export CSV.", "error");
    return;
  }
  const blob = new Blob([buildCsvContent(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportAdminCsv(pageKey) {
  const data = MANAGEMENT_RUNTIME.data;
  if (!data) return;
  if (pageKey === "bookings") {
    const rows = getFilteredBookings(data).map((booking) => [booking.booking_code, booking.contact_name || "", booking.contact_email || "", booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour", booking.total_amount || 0, booking.booking_status || "", booking.payment_status || "", booking.created_at || ""]);
    downloadCsvFile("admin-bookings.csv", ["Booking code", "Customer", "Email", "Tour", "Amount", "Booking status", "Payment status", "Created at"], rows);
    return;
  }
  if (pageKey === "payments") {
    const rows = getFilteredPayments(data).map((payment) => [payment.transaction_code || payment.provider_payment_id || payment.id, payment.booking?.booking_code || "", payment.provider_name || payment.paymentMethod?.name || "", payment.amount || 0, payment.status || "", getRefundState(payment), payment.requested_at || payment.created_at || ""]);
    downloadCsvFile("admin-payments.csv", ["Transaction", "Booking", "Provider", "Amount", "Status", "Refund state", "Requested at"], rows);
  }
}

function getBookingById(data, id) {
  return (Array.isArray(data?.bookings) ? data.bookings : []).find((booking) => String(booking.id) === String(id) || String(booking.booking_code) === String(id)) || null;
}

function getPaymentById(data, id) {
  return (Array.isArray(data?.payments) ? data.payments : []).find((payment) => String(payment.id) === String(id)) || null;
}

function getCustomerByKey(data, key) {
  return buildCustomerRecords(data).find((customer) => String(customer.key) === String(key) || String(customer.profileId || "") === String(key)) || null;
}

function formatAdminEventType(eventType) {
  return String(eventType || "Hoạt động").split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function renderDetailStats(items) {
  return `<div class="admin-detail-grid">${items.map((item) => `<article class="admin-detail-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><p>${escapeHtml(item.hint || "")}</p></article>`).join("")}</div>`;
}

function renderDetailFactGrid(items) {
  return `<div class="admin-detail-fact-grid">${items.filter((item) => item && item.value).map((item) => `
    <article class="admin-detail-fact">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join("")}</div>`;
}

function renderDetailMiniRows(items, emptyTitle, emptyCopy) {
  if (!items.length) return `<div class="empty-state"><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyCopy)}</p></div>`;
  return `<div class="admin-list-stack">${items.join("")}</div>`;
}

function renderDetailSection(title, copy, content, extraClass = "") {
  return `
    <section class="admin-detail-section${extraClass ? ` ${extraClass}` : ""}">
      <div class="portal-section-head">
        <div>
          <h3>${escapeHtml(title)}</h3>
          ${copy ? `<p>${escapeHtml(copy)}</p>` : ""}
        </div>
      </div>
      ${content}
    </section>
  `;
}

function renderBookingDetail(booking) {
  if (!booking) return `<div class="empty-state"><h3>Không tìm thấy booking</h3><p>Bản ghi này không còn khả dụng trong hệ thống.</p></div>`;
  const canReviewCancellation = booking.booking_status === "cancel_requested";
  const canRecordPayment = !["cancelled", "completed"].includes(booking.booking_status) && ["pending", "unpaid", "failed", "expired"].includes(booking.payment_status);
  const departureDate = booking.snapshot_jsonb?.departure_date || booking.schedule?.departureDate || booking.created_at;
  const travelerRows = (booking.travelers || []).map((traveler) => `<article class="admin-mini-row"><div><strong>${escapeHtml(traveler.full_name || traveler.name || "Hành khách")}</strong><p>${escapeHtml([traveler.type || traveler.traveler_type || "guest", traveler.date_of_birth || traveler.passport_number || ""].filter(Boolean).join(" • "))}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(traveler.gender || traveler.nationality || "")}</span></div></article>`);
  const paymentRows = (booking.payments || []).map((payment) => `<article class="admin-mini-row"><div><strong>${escapeHtml(payment.provider_name || payment.paymentMethod?.name || "Thanh toán")}</strong><p>${escapeHtml(payment.transaction_code || payment.provider_payment_id || payment.id.slice(0, 8))}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(payment.amount, payment.currency || "VND"))}</span><em>${escapeHtml(`${formatStatus(payment.status)} • ${getRefundState(payment)}`)}</em></div></article>`);
  const eventRows = (booking.events || []).map((event) => `<article class="admin-mini-row"><div><strong>${escapeHtml(formatAdminEventType(event.event_type))}</strong><p>${escapeHtml(event.note || "Chưa có ghi chú bổ sung.")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatDateTime(event.created_at))}</span></div></article>`);
  const ticketRows = (booking.tickets || []).map((ticket) => `<article class="admin-mini-row"><div><strong>${escapeHtml(ticket.subject || ticket.bookingCode || "Ticket hỗ trợ")}</strong><p>${escapeHtml(ticket.messages?.[ticket.messages.length - 1]?.message_text || ticket.note || "Chưa có hội thoại bổ sung.")}</p></div><div class="admin-mini-row-side"><span>${renderStatusTag(getTicketTone(ticket).label, getTicketTone(ticket).tone)}</span></div></article>`);
  const reviewRows = booking.review ? [`<article class="admin-mini-row"><div><strong>${escapeHtml(`${Number(booking.review.rating || 0).toFixed(1)}/5`)} • ${escapeHtml(booking.review.authorName || "Khách hàng")}</strong><p>${escapeHtml(booking.review.comment || "Chưa có nội dung review.")}</p></div><div class="admin-mini-row-side"><span>${renderStatusTag(getReviewTone(booking.review).label, getReviewTone(booking.review).tone)}</span></div></article>`] : [];
  const factGrid = renderDetailFactGrid([
    { label: "Mã booking", value: booking.booking_code },
    { label: "Khách hàng", value: booking.contact_name || "Khách hàng" },
    { label: "Email", value: booking.contact_email || "Chưa cập nhật" },
    { label: "Điểm đến", value: booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "Đang cập nhật" },
    { label: "Khởi hành", value: formatLongDate(departureDate) },
    { label: "Số khách", value: String(booking.totalGuests || 0) }
  ]);
  const actionButtons = [
    `<button class="admin-inline-button" type="button" data-admin-action="add-booking-note" data-booking-code="${escapeHtml(booking.booking_code)}">Ghi chú nội bộ</button>`,
    canReviewCancellation ? `<button class="admin-inline-button is-primary" type="button" data-admin-action="approve-cancellation" data-booking-code="${escapeHtml(booking.booking_code)}">Duyệt hủy</button>` : "",
    canReviewCancellation ? `<button class="admin-inline-button" type="button" data-admin-action="reject-cancellation" data-booking-code="${escapeHtml(booking.booking_code)}">Từ chối hủy</button>` : "",
    canRecordPayment ? `<button class="admin-inline-button is-primary" type="button" data-admin-action="record-manual-payment" data-booking-code="${escapeHtml(booking.booking_code)}">Xác nhận thanh toán</button>` : ""
  ].filter(Boolean).join("");
  return `<div class="admin-detail-shell">
    <section class="admin-detail-hero-shell">
      <div class="admin-detail-hero-main">
        <span class="eyebrow">Booking overview</span>
        <h2>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</h2>
        <p class="admin-detail-lead">${escapeHtml(booking.contact_name || "Khách hàng")} • ${escapeHtml(booking.contact_email || "Chưa có email")}</p>
        <div class="admin-detail-pill-row">
          ${renderStatusTag(formatStatus(booking.booking_status), getBookingTone(booking.booking_status).tone)}
          ${renderStatusTag(formatStatus(booking.payment_status), getPaymentTone(booking.payment_status).tone)}
        </div>
      </div>
      <div class="admin-detail-hero-side">
        <button class="admin-inline-button" type="button" data-admin-close-detail>Đóng</button>
        ${actionButtons ? `<div class="admin-detail-actions">${actionButtons}</div>` : ""}
      </div>
    </section>
    ${renderDetailStats([
      { label: "Tổng tiền", value: formatCurrency(booking.total_amount, booking.currency || "VND"), hint: "Giá trị booking" },
      { label: "Khởi hành", value: formatShortDate(departureDate), hint: booking.schedule?.meetingPoint || "Lịch thực tế" },
      { label: "Hành khách", value: String(booking.totalGuests || 0), hint: "Số khách đã khai báo" },
      { label: "Hỗ trợ", value: String((booking.tickets || []).length), hint: booking.review ? "Đã có review" : "Chưa có review" }
    ])}
    <div class="admin-detail-body-grid">
      <div class="admin-detail-column">
        ${renderDetailSection("Thông tin chính", "Tóm tắt vận hành của booking này.", factGrid)}
        ${renderDetailSection("Hành khách", `${escapeHtml(String(booking.totalGuests || 0))} khách trong booking.`, renderDetailMiniRows(travelerRows, "Chưa có hành khách", "Booking này chưa có dữ liệu traveler."))}
        ${renderDetailSection("Timeline booking", "Các mốc vận hành gần nhất.", renderDetailMiniRows(eventRows, "Chưa có timeline", "Booking này chưa phát sinh event vận hành."))}
      </div>
      <div class="admin-detail-column">
        ${renderDetailSection("Thanh toán", "Đối soát payment và refund theo booking.", renderDetailMiniRows(paymentRows, "Chưa có thanh toán", "Booking này chưa phát sinh payment attempt."))}
        ${renderDetailSection("Hỗ trợ & review", "Các tương tác liên quan tới booking.", renderDetailMiniRows([...ticketRows, ...reviewRows], "Chưa có hỗ trợ", "Booking này chưa phát sinh ticket hoặc review."))}
      </div>
    </div>
  </div>`;
}

function renderPaymentDetail(payment) {
  if (!payment) return `<div class="empty-state"><h3>Không tìm thấy payment</h3><p>Bản ghi này không còn khả dụng trong hệ thống.</p></div>`;
  const booking = payment.booking || null;
  const reconciliation = getPaymentReconciliation(payment);
  const refundRows = (payment.refunds || []).map((refund) => `<article class="admin-mini-row"><div><strong>${escapeHtml(formatCurrency(refund.amount, payment.currency || "VND"))}</strong><p>${escapeHtml(refund.reason || "Chưa có lý do hoàn tiền.")}</p></div><div class="admin-mini-row-side"><span>${renderStatusTag(formatStatus(refund.status), refund.status === "pending" ? "danger" : "success")}</span><em>${escapeHtml(formatDateTime(refund.created_at))}</em></div>${refund.status === "pending" ? `<div class="admin-detail-inline-actions"><button class="admin-inline-button is-primary" type="button" data-admin-action="process-refund" data-refund-id="${escapeHtml(refund.id)}">Hoàn tiền</button><button class="admin-inline-button" type="button" data-admin-action="reject-refund" data-refund-id="${escapeHtml(refund.id)}">Từ chối</button></div>` : ""}</article>`);
  const eventRows = (payment.paymentEvents || []).map((event) => `<article class="admin-mini-row"><div><strong>${escapeHtml(formatAdminEventType(event.event_name))}</strong><p>${escapeHtml(JSON.stringify(event.payload || {}))}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatDateTime(event.processed_at || event.received_at || event.created_at))}</span></div></article>`);
  const factGrid = renderDetailFactGrid([
    { label: "Mã giao dịch", value: payment.transaction_code || payment.provider_payment_id || payment.id.slice(0, 8) },
    { label: "Nhà cung cấp", value: payment.provider_name || payment.paymentMethod?.name || "Thanh toán" },
    { label: "Booking", value: booking?.booking_code || "Chưa liên kết" },
    { label: "Tour", value: booking?.tour?.name || booking?.snapshot_jsonb?.tour_name || "Không có booking" },
    { label: "Tạo lúc", value: formatDateTime(payment.created_at || payment.received_at) },
    { label: "Cập nhật", value: formatDateTime(payment.updated_at || payment.processed_at || payment.created_at) }
  ]);
  const actionButtons = [
    booking?.booking_code ? `<button class="admin-inline-button" type="button" data-admin-action="add-booking-note" data-booking-code="${escapeHtml(booking.booking_code)}">Ghi chú booking</button>` : "",
    booking?.booking_code && ["pending", "unpaid", "failed", "expired"].includes(booking.payment_status) ? `<button class="admin-inline-button is-primary" type="button" data-admin-action="record-manual-payment" data-booking-code="${escapeHtml(booking.booking_code)}">Xác nhận thủ công</button>` : ""
  ].filter(Boolean).join("");
  return `<div class="admin-detail-shell">
    <section class="admin-detail-hero-shell">
      <div class="admin-detail-hero-main">
        <span class="eyebrow">Payment detail</span>
        <h2>${escapeHtml(payment.provider_name || payment.paymentMethod?.name || "Thanh toán")}</h2>
        <p class="admin-detail-lead">${escapeHtml(formatCurrency(payment.amount, payment.currency || "VND"))} • ${escapeHtml(booking?.booking_code || "Không có booking liên kết")}</p>
        <div class="admin-detail-pill-row">
          ${renderStatusTag(formatStatus(payment.status), getPaymentTone(payment.status).tone)}
          ${renderStatusTag(reconciliation.label, reconciliation.tone)}
        </div>
      </div>
      <div class="admin-detail-hero-side">
        <button class="admin-inline-button" type="button" data-admin-close-detail>Đóng</button>
        ${actionButtons ? `<div class="admin-detail-actions">${actionButtons}</div>` : ""}
      </div>
    </section>
    ${renderDetailStats([
      { label: "Số tiền", value: formatCurrency(payment.amount, payment.currency || "VND"), hint: "Giá trị giao dịch" },
      { label: "Refund", value: getRefundState(payment), hint: "Trạng thái hoàn tiền" },
      { label: "Đối soát", value: reconciliation.label, hint: "Liên kết booking/payment" },
      { label: "Booking", value: booking?.booking_code || "N/A", hint: booking?.tour?.name || booking?.snapshot_jsonb?.tour_name || "Không có booking" }
    ])}
    <div class="admin-detail-body-grid admin-detail-body-grid-narrow">
      <div class="admin-detail-column">
        ${renderDetailSection("Thông tin giao dịch", "Những dữ liệu cốt lõi của giao dịch.", factGrid)}
        ${renderDetailSection("Sự kiện thanh toán", "Log nhận từ payment events.", renderDetailMiniRows(eventRows, "Chưa có payment event", "Payment này chưa có log đối soát."))}
      </div>
      <div class="admin-detail-column">
        ${renderDetailSection("Refund", "Các yêu cầu hoàn tiền liên quan.", renderDetailMiniRows(refundRows, "Chưa có refund", "Payment này chưa phát sinh refund."))}
      </div>
    </div>
  </div>`;
}

function renderCustomerDetail(customer) {
  if (!customer) return `<div class="empty-state"><h3>Không tìm thấy khách hàng</h3><p>Hồ sơ này không còn khả dụng trong hệ thống.</p></div>`;
  const bookingRows = customer.bookings.slice(0, 12).map((booking) => `<article class="admin-mini-row"><div><strong>#${escapeHtml(booking.booking_code)}</strong><p>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</span><em>${escapeHtml(formatStatus(booking.booking_status))}</em></div></article>`);
  const reviewRows = customer.reviews.slice(0, 8).map((review) => `<article class="admin-mini-row"><div><strong>${escapeHtml(`${Number(review.rating || 0).toFixed(1)}/5`)} • ${escapeHtml(review.tour?.name || "Review")}</strong><p>${escapeHtml(review.comment || "Chưa có nội dung review.")}</p></div><div class="admin-mini-row-side"><span>${renderStatusTag(getReviewTone(review).label, getReviewTone(review).tone)}</span></div></article>`);
  const ticketRows = customer.tickets.slice(0, 8).map((ticket) => `<article class="admin-mini-row"><div><strong>${escapeHtml(ticket.subject || ticket.bookingCode || "Ticket")}</strong><p>${escapeHtml(ticket.messages?.[ticket.messages.length - 1]?.message_text || "Chưa có hội thoại mới.")}</p></div><div class="admin-mini-row-side"><span>${renderStatusTag(getTicketTone(ticket).label, getTicketTone(ticket).tone)}</span></div></article>`);
  const factGrid = renderDetailFactGrid([
    { label: "Tên khách", value: customer.name || "Khách hàng" },
    { label: "Email", value: customer.email || "Chưa cập nhật" },
    { label: "Hạng khách", value: customer.customerLevel || (customer.bookingCount > 1 ? "Repeat" : "New") },
    { label: "Tổng booking", value: String(customer.bookingCount || 0) },
    { label: "Chi tiêu", value: formatCurrency(customer.spend || 0, "VND") },
    { label: "Lần cập nhật", value: formatDateTime(customer.updated_at || customer.created_at || new Date().toISOString()) }
  ]);
  return `<div class="admin-detail-shell">
    <section class="admin-detail-hero-shell">
      <div class="admin-detail-hero-main">
        <span class="eyebrow">Customer profile</span>
        <h2>${escapeHtml(customer.name || "Khách hàng")}</h2>
        <p class="admin-detail-lead">${escapeHtml(customer.email || "Chưa có email")}</p>
      </div>
      <div class="admin-detail-hero-side">
        <button class="admin-inline-button" type="button" data-admin-close-detail>Đóng</button>
      </div>
    </section>
    ${renderDetailStats([
      { label: "Booking", value: String(customer.bookingCount || 0), hint: "Lịch sử đặt tour" },
      { label: "Chi tiêu", value: formatCurrency(customer.spend || 0, "VND"), hint: "Tổng chi tiêu" },
      { label: "Review", value: String(customer.reviews.length || 0), hint: "Phản hồi đã gửi" },
      { label: "Ticket", value: String(customer.tickets.length || 0), hint: "Yêu cầu hỗ trợ" }
    ])}
    <div class="admin-detail-body-grid admin-detail-body-grid-narrow">
      <div class="admin-detail-column">
        ${renderDetailSection("Thông tin khách hàng", "Hồ sơ và giá trị của khách hàng này.", factGrid)}
        ${renderDetailSection("Lịch sử booking", "Các booking gần nhất của khách hàng.", renderDetailMiniRows(bookingRows, "Chưa có booking", "Khách này chưa phát sinh booking thật."))}
      </div>
      <div class="admin-detail-column">
        ${renderDetailSection("Review", "Những đánh giá gắn với tài khoản này.", renderDetailMiniRows(reviewRows, "Chưa có review", "Khách này chưa gửi review."))}
        ${renderDetailSection("Ticket", "Các trao đổi hỗ trợ gần đây.", renderDetailMiniRows(ticketRows, "Chưa có ticket", "Khách này chưa tạo support ticket."))}
      </div>
    </div>
  </div>`;
}
function renderManagementDetailContent() {
  if (!MANAGEMENT_RUNTIME.detail || !MANAGEMENT_RUNTIME.data) return "";
  let content = "";
  if (MANAGEMENT_RUNTIME.detail.type === "booking") content = renderBookingDetail(getBookingById(MANAGEMENT_RUNTIME.data, MANAGEMENT_RUNTIME.detail.id));
  if (MANAGEMENT_RUNTIME.detail.type === "payment") content = renderPaymentDetail(getPaymentById(MANAGEMENT_RUNTIME.data, MANAGEMENT_RUNTIME.detail.id));
  if (MANAGEMENT_RUNTIME.detail.type === "customer") content = renderCustomerDetail(getCustomerByKey(MANAGEMENT_RUNTIME.data, MANAGEMENT_RUNTIME.detail.id));
  if (!content) return "";
  return `<div class="admin-detail-layer"><button class="admin-detail-backdrop" type="button" data-admin-close-detail aria-label="Đóng panel chi tiết"></button><aside class="admin-detail-drawer">${content}</aside></div>`;
}

function renderManagementShell(root) {
  if (!root || !MANAGEMENT_RUNTIME.auth || !MANAGEMENT_RUNTIME.data) return;
  root.innerHTML = normalizeAdminCopy(renderManagementApp(MANAGEMENT_RUNTIME.auth, MANAGEMENT_RUNTIME.data, MANAGEMENT_RUNTIME.currentPage));
  const detailMarkup = renderManagementDetailContent();
  if (detailMarkup) root.insertAdjacentHTML("beforeend", normalizeAdminCopy(detailMarkup));
  const modalMarkup = renderAdminCrudModal(MANAGEMENT_RUNTIME.data);
  if (modalMarkup) root.insertAdjacentHTML("beforeend", normalizeAdminCopy(modalMarkup));
  normalizeAdminTree(root);
  bindSearch(root);
}

function renderDashboardPage(auth, data, stats) {
  const topTours = getTopTours(data.bookings, data.tours);
  const transactionBacklog = stats.pendingPayments.length + data.refunds.filter((refund) => refund.status === "pending").length;
  const supportBacklog = stats.pendingReviews.length + stats.unresolvedTickets.length;
  const bookingSeries = buildRecentDaySeries(data.bookings, (booking) => booking.created_at);
  const bookingTotal = bookingSeries.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const revenueSeries = buildRecentDaySeries(
    data.payments.filter((payment) => payment.status === "paid"),
    (payment) => payment.paid_at || payment.requested_at || payment.created_at,
    (payment) => Number(payment.amount || 0)
  );
  const revenueTotal = revenueSeries.reduce((sum, item) => sum + Number(item.value || 0), 0);
  const cards = [
    { icon: "group", chip: `${stats.totalUsers}`, label: "Người dùng", value: String(stats.totalUsers), hint: "Tổng hồ sơ hiện có", cardTone: "blue" },
    { icon: "assignment", chip: `${stats.pendingBookings.length}`, chipTone: "warning", label: "Booking chờ xử lý", value: String(stats.pendingBookings.length), hint: "Chờ xử lý, thanh toán và hủy tour", cardTone: "orange" },
    { icon: "payments", chip: `${transactionBacklog}`, chipTone: transactionBacklog ? "info" : "success", label: "Giao dịch cần xem", value: String(transactionBacklog), hint: "Hàng đợi thanh toán và refund pending", cardTone: "green" },
    { icon: "support_agent", chip: `${supportBacklog}`, chipTone: supportBacklog ? "danger" : "success", label: "Hỗ trợ & review", value: String(supportBacklog), hint: "Ticket mở và review backlog", cardTone: "red" }
  ];

  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">${cards.map(renderStatCard).join("")}</section>
    <section class="admin-section-grid admin-section-grid-dashboard">
      ${renderChartPanel({
        title: "Booking mới (7 ngày gần nhất)",
        description: "Đếm số booking tạo mới mỗi ngày từ DB.",
        totalLabel: "Tổng booking",
        totalValue: String(bookingTotal),
        series: bookingSeries,
        tone: "blue",
        emptyTitle: "Chưa có booking mới",
        emptyDescription: "Booking mới trong 7 ngày gần nhất sẽ hiện ở đây."
      })}
      ${renderChartPanel({
        title: "Doanh thu thu về (7 ngày gần nhất)",
        description: "Chỉ tính payment đã thành công.",
        totalLabel: "Tổng đã thu",
        totalValue: formatCurrency(revenueTotal, "VND"),
        series: revenueSeries,
        tone: "green",
        emptyTitle: "Chưa có giao dịch thành công",
        emptyDescription: "Doanh thu từ payment.status = paid sẽ hiện ở đây."
      })}
    </section>
    ${renderQuickAccessGrid(buildQuickAccessItems(auth, data, stats))}
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><div><h2>Booking mới nhất</h2><p>Đơn đặt tour mới nhất từ hệ thống.</p></div></div><div class="admin-list-stack">${renderBookingCards(data.bookings)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><div><h2>Hàng đợi hỗ trợ</h2><p>Ticket mở và review cần xử lý ngay.</p></div></div><div class="admin-list-stack">${stats.unresolvedTickets.length ? renderTicketList(stats.unresolvedTickets) : renderReviewList(stats.pendingReviews)}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><div><h2>Tour nổi bật</h2><p>Xếp hạng theo booking thực tế.</p></div></div><div class="admin-tour-list">${renderTopTourList(topTours)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><div><h2>Hoạt động gần đây</h2><p>Nhật ký mới nhất từ activity_logs.</p></div></div>${renderActivityList(data.activityLogs)}</article>
    </section>
  `;
}

function renderReportsPage(data, stats) {
  const revenueBars = groupMonthlyRevenue(data.payments);
  const regions = getRegionBreakdown(data.bookings);
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "payments", chip: `+${stats.totalBookings}`, label: "Doanh thu đã thu", value: formatCurrency(stats.collectedRevenue, "VND"), hint: "payment.status = paid" })}
      ${renderStatCard({ icon: "receipt_long", chip: `${stats.pendingPayments.length}`, chipTone: "info", label: "Thanh toán chờ xử lý", value: String(stats.pendingPayments.length), hint: "Chờ xử lý và unpaid flow" })}
      ${renderStatCard({ icon: "restart_alt", chip: `${data.refunds.length}`, chipTone: "danger", label: "Tổng hoàn tiền", value: formatCurrency(stats.refundAmount, "VND"), hint: "Từ public.refunds" })}
      ${renderStatCard({ icon: "confirmation_number", chip: `${stats.activeCoupons.length}`, chipTone: "info", label: "Lượt dùng coupon", value: String(stats.totalCouponUsage), hint: "Từ coupon_usages" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel admin-chart-panel"><div class="portal-section-head"><div><h2>Biểu đồ doanh thu</h2><p>6 tháng gần nhất từ payment records.</p></div><button class="admin-pill-button" type="button">Theo tháng</button></div><div class="admin-bar-chart">${revenueBars.map((bar) => `<div class="admin-bar-col"><div class="admin-bar-fill ${bar.label === revenueBars[revenueBars.length - 1]?.label ? "is-active" : ""}" style="height:${bar.height}%"></div><span>${escapeHtml(bar.label)}</span></div>`).join("")}</div></article>
      <article class="admin-panel admin-region-panel"><h2>Cơ cấu booking theo vùng</h2><div class="admin-region-list">${regions.map((region, index) => `<div class="admin-region-item"><div class="admin-region-top"><div><i class="admin-region-dot admin-region-dot-${index + 1}"></i><span>${escapeHtml(region.label)}</span></div><strong>${escapeHtml(String(region.percent || 0))}%</strong></div><div class="admin-region-track"><span class="admin-region-progress admin-region-progress-${index + 1}" style="width:${Math.max(region.percent, 8)}%"></span></div></div>`).join("")}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Phương thức thanh toán</h2><p>Các phương thức đang bật.</p></div>${renderPaymentMethods(data.paymentMethods)}</article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Nhật ký hoạt động</h2><p>Hoạt động mới nhất từ activity_logs.</p></div>${renderActivityList(data.activityLogs)}</article>
    </section>
  `;
}

function renderBookingsPage(data, stats) {
  const filteredBookings = getFilteredBookings(data);
  const controls = [
    renderToolbarField("bookings", "bookingStatus", "Booking status", [
      { value: "all", label: "Tất cả booking" },
      { value: "pending", label: "Pending" },
      { value: "awaiting_payment", label: "Awaiting payment" },
      { value: "confirmed", label: "Confirmed" },
      { value: "cancel_requested", label: "Chờ duyệt hủy" },
      { value: "cancelled", label: "Cancelled" }
    ]),
    renderToolbarField("bookings", "paymentStatus", "Payment status", [
      { value: "all", label: "Tất cả payment" },
      { value: "pending", label: "Pending" },
      { value: "unpaid", label: "Unpaid" },
      { value: "paid", label: "Paid" },
      { value: "refunded", label: "Refunded" }
    ]),
    renderToolbarField("bookings", "cancellation", "Cancellation", [
      { value: "all", label: "Tất cả cancellation" },
      { value: "requested", label: "Đang chờ duyệt" },
      { value: "resolved", label: "Đã xử lý" }
    ])
  ];
  const rows = filteredBookings.map((booking) => {
    const tone = getBookingTone(booking);
    return `<tr data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""}`)}"><td><strong class="admin-order-code">#${escapeHtml(booking.booking_code)}</strong></td><td><div class="admin-customer-cell"><div class="admin-customer-avatar">${escapeHtml(getInitials(booking.contact_name || "KH"))}</div><div><strong>${escapeHtml(booking.contact_name || "Khách hàng")}</strong><span>${escapeHtml(booking.contact_email || "")}</span></div></div></td><td><div class="admin-tour-cell"><strong>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</strong><span>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</span></div></td><td>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</td><td>${renderStatusTag(tone.label, tone.tone)}</td><td>${escapeHtml(formatStatus(booking.payment_status || "pending"))}</td><td><div class="admin-table-actions"><button class="admin-inline-button" type="button" data-admin-open-detail="booking" data-admin-detail-id="${escapeHtml(booking.id)}">Chi tiết</button>${booking.booking_status === "cancel_requested" ? `<button class="admin-inline-button is-primary" type="button" data-admin-action="approve-cancellation" data-booking-code="${escapeHtml(booking.booking_code)}">Duyệt hủy</button>` : ""}</div></td></tr>`;
  });
  const invoiceRows = data.invoices.slice(0, 6).map((invoice) => `<article class="admin-mini-row" data-search="${escapeHtml(`${invoice.invoice_number} ${invoice.company_name || ""}`)}"><div><strong>${escapeHtml(invoice.invoice_number)}</strong><p>${escapeHtml(invoice.company_name || "Khách lẻ")} - ${escapeHtml(invoice.booking?.booking_code || "N/A")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatDateTime(invoice.issued_at))}</span></div></article>`).join("");
  const cancellationQueue = data.bookings.filter((booking) => booking.booking_status === "cancel_requested");
  return `
    ${renderOpsToolbar("Booking operations", "Lọc booking thật, mở detail drawer và export CSV nhẹ cho vận hành.", controls, `<button class="admin-inline-button" type="button" data-admin-export="bookings">Export CSV</button>`)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "assignment", chip: `${stats.totalBookings}`, label: "Tổng booking", value: String(stats.totalBookings), hint: "Từ public.bookings" })}
      ${renderStatCard({ icon: "hourglass_top", chip: `${stats.pendingBookings.length}`, chipTone: "warning", label: "Hàng đợi xử lý", value: String(stats.pendingBookings.length), hint: "pending, awaiting_payment, cancel_requested" })}
      ${renderStatCard({ icon: "task_alt", chip: `${data.bookings.filter((booking) => booking.booking_status === "completed").length}`, label: "Hoàn tất", value: String(data.bookings.filter((booking) => booking.booking_status === "completed").length), hint: "booking_status = completed" })}
      ${renderStatCard({ icon: "sell", chip: `${data.invoices.length}`, chipTone: "info", label: "Hóa đơn đã xuất", value: String(data.invoices.length), hint: "Từ public.invoices" })}
    </section>
    ${renderTablePanel("Danh sách booking", "Route này đọc trực tiếp booking thật từ DB.", ["Code", "Khách hàng", "Tour", "Amount", "Status", "Payment", "Actions"], rows, `Hiển thị ${rows.length} booking`) }
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Hàng đợi hủy booking</h2><p>Duyệt hoặc từ chối yêu cầu hủy từ khách.</p></div><div class="admin-list-stack">${renderCancellationQueue(cancellationQueue)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Hóa đơn gần đây</h2><p>Hóa đơn liên kết trực tiếp với booking.</p></div><div class="admin-list-stack">${invoiceRows || '<div class="empty-state"><h3>Chưa có hóa đơn</h3><p>Hóa đơn sẽ hiện ở đây khi DB có dữ liệu.</p></div>'}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Hoạt động booking</h2><p>Timeline từ booking events và activity logs.</p></div>${renderActivityList(data.activityLogs.filter((item) => item.entity_type === "booking" || item.entity_type === "support_ticket"))}</article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Chờ thanh toán</h2><p>Hàng đợi xác nhận thanh toán tay hoặc thử lại lỗi giao dịch.</p></div><div class="admin-list-stack">${renderPendingPaymentQueue(data.bookings)}</div></article>
    </section>
  `;
}
function renderPaymentsPage(data, stats) {
  const filteredPayments = getFilteredPayments(data);
  const providerOptions = [{ value: "all", label: "Tất cả provider" }].concat(Array.from(new Set((data.payments || []).map((payment) => String(payment.provider_name || payment.paymentMethod?.name || "manual").toLowerCase()))).sort().map((provider) => ({ value: provider, label: provider })));
  const controls = [
    renderToolbarField("payments", "status", "Payment status", [
      { value: "all", label: "Tất cả status" },
      { value: "pending", label: "Pending" },
      { value: "paid", label: "Paid" },
      { value: "failed", label: "Failed" },
      { value: "expired", label: "Expired" },
      { value: "refunded", label: "Refunded" }
    ]),
    renderToolbarField("payments", "refundStatus", "Refund state", [
      { value: "all", label: "Tất cả refund" },
      { value: "none", label: "Chưa có refund" },
      { value: "pending", label: "Refund pending" },
      { value: "refunded", label: "Refunded" },
      { value: "rejected", label: "Refund rejected" }
    ]),
    renderToolbarField("payments", "provider", "Provider", providerOptions)
  ];
  const rows = filteredPayments.map((payment) => {
    const tone = getPaymentTone(payment);
    const reconciliation = getPaymentReconciliation(payment);
    return `<tr data-search="${escapeHtml(`${payment.transaction_code || ""} ${payment.provider_name || ""} ${payment.booking?.booking_code || ""}`)}"><td><strong class="admin-order-code">${escapeHtml(payment.transaction_code || payment.provider_payment_id || payment.id.slice(0, 8))}</strong></td><td>${escapeHtml(payment.booking?.booking_code || "N/A")}</td><td>${escapeHtml(payment.provider_name || "Thủ công")}</td><td>${escapeHtml(formatCurrency(payment.amount, payment.currency || "VND"))}</td><td>${renderStatusTag(tone.label, tone.tone)}</td><td>${renderStatusTag(reconciliation.label, reconciliation.tone)}</td><td><div class="admin-table-actions"><button class="admin-inline-button" type="button" data-admin-open-detail="payment" data-admin-detail-id="${escapeHtml(payment.id)}">Chi tiết</button></div></td></tr>`;
  });
  const refundRows = data.refunds.map((refund) => `<article class="admin-mini-row" data-search="${escapeHtml(`${refund.reason || ""} ${refund.payment?.booking?.booking_code || ""}`)}"><div><strong>${escapeHtml(refund.payment?.booking?.booking_code || "Hoàn tiền")}</strong><p>${escapeHtml(refund.reason || "Chưa có lý do")} - ${escapeHtml(refund.status || "pending")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(refund.amount, refund.payment?.currency || "VND"))}</span><em>${escapeHtml(formatDateTime(refund.refunded_at || refund.created_at))}</em></div></article>`).join("");
  return `
    ${renderOpsToolbar("Payment operations", "Đối soát payment với booking thật, review refund status và export CSV cho finance ops.", controls, `<button class="admin-inline-button" type="button" data-admin-export="payments">Export CSV</button>`)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "payments", chip: `${stats.pendingPayments.length}`, chipTone: "info", label: "Giao dịch chờ xử lý", value: String(stats.pendingPayments.length), hint: "Luồng pending và unpaid" })}
      ${renderStatCard({ icon: "credit_score", chip: `${data.paymentMethods.length}`, label: "Phương thức thanh toán", value: String(data.paymentMethods.length), hint: "Phương thức đang bật" })}
      ${renderStatCard({ icon: "savings", chip: `${data.refunds.length}`, chipTone: "danger", label: "Tổng hoàn tiền", value: formatCurrency(stats.refundAmount, "VND"), hint: "Từ public.refunds" })}
      ${renderStatCard({ icon: "inventory", chip: `${data.invoices.length}`, label: "Hóa đơn liên kết", value: String(data.invoices.length), hint: "Issued invoice records" })}
    </section>
    ${renderTablePanel("Danh sách giao dịch", "Bản ghi giao dịch đọc từ bảng payments.", ["Transaction", "Booking", "Provider", "Amount", "Status", "Đối soát", "Actions"], rows, `Hiển thị ${rows.length} giao dịch`) }
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Hàng đợi thanh toán</h2><p>Xử lý thanh toán tay và retry từ booking thật.</p></div><div class="admin-list-stack">${renderPendingPaymentQueue(data.bookings)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Hàng đợi hoàn tiền</h2><p>Xử lý hoặc từ chối các refund đang pending.</p></div><div class="admin-list-stack">${renderRefundQueue(data.refunds)}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Hoàn tiền gần đây</h2><p>Bản ghi hoàn tiền liên kết ngược với booking.</p></div><div class="admin-list-stack">${refundRows || '<div class="empty-state"><h3>Chưa có dữ liệu hoàn tiền</h3><p>Refund sẽ hiện ở đây khi DB có dữ liệu.</p></div>'}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Phương thức đang bật</h2><p>Các phương thức thanh toán đang mở cho luồng đặt tour.</p></div>${renderPaymentMethods(data.paymentMethods)}</article>
    </section>
  `;
}

function renderToursPage(data, stats) {
  const topTours = getTopTours(data.bookings, data.tours);
  const tourRows = data.tours.slice(0, 12).map((tour) => `<tr data-search="${escapeHtml(`${tour.name} ${tour.slug} ${tour.destinationLabel || ""}`)}"><td><strong>${escapeHtml(tour.name)}</strong><p>${escapeHtml(tour.destinationLabel || "Chưa gắn điểm đến")}</p></td><td>${renderStatusTag(formatStatus(tour.status), tour.status === "published" ? "success" : tour.status === "archived" ? "danger" : "waiting")}</td><td>${escapeHtml(tour.categories?.map((category) => category.name).join(", ") || "Chưa gắn danh mục")}</td><td>${escapeHtml(String(tour.scheduleCount || 0))}</td><td>${escapeHtml(tour.schedules?.find((schedule) => ["open", "draft", "sold_out"].includes(schedule.status))?.departureDate ? formatShortDate(tour.schedules.find((schedule) => ["open", "draft", "sold_out"].includes(schedule.status)).departureDate) : "Chưa có lịch")}</td><td><div class="admin-table-actions"><button class="admin-inline-button is-primary" type="button" data-admin-action="edit-tour" data-tour-id="${escapeHtml(tour.id)}">Sửa</button><button class="admin-inline-button" type="button" data-admin-action="set-tour-status" data-tour-id="${escapeHtml(tour.id)}" data-tour-status="${escapeHtml(tour.status === "published" ? "archived" : "published")}">${tour.status === "published" ? "Lưu trữ" : "Hiển thị"}</button><button class="admin-inline-button" type="button" data-admin-action="create-schedule" data-tour-id="${escapeHtml(tour.id)}">Thêm lịch</button></div></td></tr>`);
  const scheduleRows = data.schedules.slice(0, 12).map((schedule) => `<tr data-search="${escapeHtml(`${schedule.tourName} ${schedule.destinationLabel || ""}`)}"><td><strong>${escapeHtml(schedule.tourName)}</strong><p>${escapeHtml(schedule.destinationLabel || "\u0110ang c\u1eadp nh\u1eadt")}</p></td><td>${escapeHtml(`${formatShortDate(schedule.departureDate)} -> ${formatShortDate(schedule.returnDate)}`)}</td><td>${escapeHtml(String(schedule.capacity || 0))} / ${escapeHtml(String(schedule.availableSlots || 0))}</td><td>${escapeHtml(formatCurrency(getSchedulePrice(schedule, "adult") || 0, schedule.currency || "VND"))}</td><td>${renderStatusTag(formatStatus(schedule.status), schedule.status === "open" ? "success" : schedule.status === "sold_out" ? "danger" : "waiting")}</td><td><div class="admin-table-actions"><button class="admin-inline-button" type="button" data-admin-action="edit-schedule" data-schedule-id="${escapeHtml(schedule.id)}">S\u1eeda l\u1ecbch</button></div></td></tr>`);
  return `
    ${renderOpsToolbar("Qu\u1ea3n l\u00fd tour", "T\u1ea1o tour, c\u1eadp nh\u1eadt h\u00ecnh \u1ea3nh v\u00e0 itinerary, r\u1ed3i m\u1edf l\u1ecbch kh\u1edfi h\u00e0nh t\u1eeb DB th\u1eadt.", [], `<button class="admin-inline-button is-primary" type="button" data-admin-action="create-tour">T\u1ea1o tour</button><button class="admin-inline-button" type="button" data-admin-action="create-schedule">T\u1ea1o l\u1ecbch</button>`)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "explore", chip: `${data.tours.length}`, label: "Tour \u0111ang hi\u1ec3n th\u1ecb", value: String(data.tours.length), hint: "\u0110\u1ecdc t\u1eeb public.tours" })}
      ${renderStatCard({ icon: "calendar_month", chip: `${stats.activeSchedules.length}`, chipTone: "info", label: "L\u1ecbch \u0111ang m\u1edf", value: String(stats.activeSchedules.length), hint: "draft, open, sold_out" })}
      ${renderStatCard({ icon: "event_busy", chip: `${stats.soldOutSchedules.length}`, chipTone: "danger", label: "H\u1ebft ch\u1ed7", value: String(stats.soldOutSchedules.length), hint: "schedule.status = sold_out" })}
      ${renderStatCard({ icon: "star", chip: `${topTours.length}`, label: "Top tour", value: topTours[0]?.name || "Ch\u01b0a c\u00f3 booking th\u1ef1c t\u1ebf", hint: "X\u1ebfp h\u1ea1ng theo s\u1ed1 l\u01b0\u1ee3ng booking" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Tour n\u1ed5i b\u1eadt</h2><p>S\u1eafp x\u1ebfp theo booking th\u1ef1c t\u1ebf.</p></div><div class="admin-tour-list">${renderTopTourList(topTours)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>H\u01b0\u1edbng d\u1eabn nhanh</h2><p>Nh\u1eadp cover image, gallery URL v\u00e0 itinerary theo t\u1eebng d\u00f2ng \u0111\u1ec3 c\u1eadp nh\u1eadt tour th\u1eadt.</p></div><div class="admin-list-stack"><article class="admin-mini-row"><div><strong>Tour editor</strong><p>Ch\u1ecdn \u0111i\u1ec3m \u0111\u1ebfn b\u1eb1ng slug/id, danh m\u1ee5c c\u00e1ch nhau b\u1edfi d\u1ea5u ph\u1ea9y.</p></div></article><article class="admin-mini-row"><div><strong>Schedule editor</strong><p>T\u1ea1o l\u1ecbch m\u1edbi v\u00e0 gi\u00e1 adult/child/infant \u0111\u1ec3 checkout d\u00f9ng d\u1eef li\u1ec7u th\u1eadt.</p></div></article></div></article>
    </section>
    ${renderTablePanel("Danh s\u00e1ch tour", "Bao g\u1ed3m c\u1ea3 draft, published v\u00e0 archived \u0111\u1ec3 admin thao t\u00e1c tr\u1ef1c ti\u1ebfp.", ["Tour", "Tr\u1ea1ng th\u00e1i", "Danh m\u1ee5c", "L\u1ecbch", "Kh\u1edfi h\u00e0nh g\u1ea7n nh\u1ea5t", "Thao t\u00e1c"], tourRows, `Hi\u1ec3n th\u1ecb ${tourRows.length} tour`) }
    ${renderTablePanel("L\u1ecbch kh\u1edfi h\u00e0nh", "C\u1eadp nh\u1eadt l\u1ecbch v\u00e0 gi\u00e1 tiers t\u1eeb departure_schedules v\u00e0 schedule_price_tiers.", ["Tour", "Ng\u00e0y", "Ch\u1ed7", "Gi\u00e1 ng\u01b0\u1eddi l\u1edbn", "Tr\u1ea1ng th\u00e1i", "Thao t\u00e1c"], scheduleRows, `Hi\u1ec3n th\u1ecb ${scheduleRows.length} l\u1ecbch`) }
  `;
}

function renderServicePage(data, stats) {
  const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
  syncActiveServiceTicket(tickets);
  const activeTicket = getActiveServiceTicket(tickets);
  const reviewItems = stats.pendingReviews.length ? stats.pendingReviews : data.reviews;

  return `
    ${renderOpsToolbar("Vận hành hỗ trợ", "Xử lý ticket và duyệt review trong cùng một khu làm việc gọn hơn.")}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "support_agent", chip: `${stats.unresolvedTickets.length}`, chipTone: "danger", label: "Ticket đang mở", value: String(stats.unresolvedTickets.length), hint: "open và in_progress" })}
      ${renderStatCard({ icon: "rate_review", chip: `${stats.pendingReviews.length}`, chipTone: "warning", label: "Review chờ duyệt", value: String(stats.pendingReviews.length), hint: "review.status != approved" })}
      ${renderStatCard({ icon: "mark_email_read", chip: `${tickets.filter((ticket) => ticket.status === "resolved").length}`, label: "Ticket đã xử lý", value: String(tickets.filter((ticket) => ticket.status === "resolved").length), hint: "status = resolved" })}
      ${renderStatCard({ icon: "star", chip: `${data.reviews.length}`, label: "Tổng review", value: String(data.reviews.length), hint: "approved và pending" })}
    </section>

    <section class="admin-service-layout">
      <aside class="admin-panel admin-service-inbox">
        <div class="portal-section-head">
          <div>
            <h2>Inbox ticket</h2>
            <p>Chọn đúng hội thoại cần xử lý ở cột trái.</p>
          </div>
          <span class="chip">${escapeHtml(String(tickets.length))} ticket</span>
        </div>
        <div class="admin-service-thread-list">${renderServiceTicketInbox(tickets)}</div>
      </aside>
      <div class="admin-service-main">${renderServiceTicketWorkspace(data, activeTicket)}</div>
    </section>

    <section class="admin-section-grid admin-section-grid-single">
      <article class="admin-panel">
        <div class="portal-section-head">
          <div>
            <h2>Kiểm duyệt review</h2>
            <p>Tập trung duyệt và phản hồi review ngay dưới khu ticket.</p>
          </div>
        </div>
        <div class="admin-list-stack">${renderReviewList(reviewItems)}</div>
      </article>
    </section>
  `;
}
function renderCustomersPage(data, stats) {
  const customers = getFilteredCustomers(data);
  const averageSpend = customers.length ? Math.round(customers.reduce((sum, customer) => sum + customer.spend, 0) / customers.length) : 0;
  const controls = [
    renderToolbarField("customers", "segment", "Segment", [
      { value: "all", label: "Tất cả khách" },
      { value: "repeat", label: "Khách quay lỗi" },
      { value: "support", label: "Có ticket hỗ trợ" },
      { value: "vip", label: "VIP / chi tiêu cao" }
    ])
  ];
  const customerRows = customers.slice(0, 12).map((customer) => `<article class="admin-customer-row" data-search="${escapeHtml(`${customer.name} ${customer.email}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(customer.name))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(customer.name)}</strong><p>${escapeHtml(customer.email || "Chưa có email")}</p></div><div class="admin-customer-row-side"><span>${escapeHtml(String(customer.bookingCount))} booking</span><em>${escapeHtml(formatCurrency(customer.spend, "VND"))}</em></div><div class="admin-row-action"><button class="admin-inline-button" type="button" data-admin-open-detail="customer" data-admin-detail-id="${escapeHtml(customer.key)}">Xem lịch sử</button></div></article>`).join("");
  const customerProfiles = customers.slice(0, 12).map((customer) => `<article class="admin-profile-row" data-search="${escapeHtml(`${customer.name} ${customer.email}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(customer.name))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(customer.name)}</strong><p>${escapeHtml(customer.email || "Chưa có email")}</p></div><div class="admin-profile-role">${escapeHtml(customer.customerLevel || (customer.bookingCount > 1 ? "Repeat" : "New"))}</div><button class="admin-inline-button" type="button" data-admin-open-detail="customer" data-admin-detail-id="${escapeHtml(customer.key)}">Chi tiết</button></article>`).join("");
  return `
    ${renderOpsToolbar("Customer operations", "Mở lịch sử booking, review, ticket và tổng chi tiêu của khách ngay trong admin.", controls)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "groups_2", chip: `${stats.customerCount}`, label: "Khách hàng", value: String(stats.customerCount), hint: "role = customer" })}
      ${renderStatCard({ icon: "repeat", chip: `${stats.repeatCustomers}`, chipTone: "info", label: "Khách quay lỗi", value: String(stats.repeatCustomers), hint: "Từ hai booking trở lên" })}
      ${renderStatCard({ icon: "shopping_bag", chip: `${stats.totalBookings}`, label: "Booking đang theo dõi", value: String(stats.totalBookings), hint: "Toàn bộ đơn hiện tại" })}
      ${renderStatCard({ icon: "savings", chip: `${customers.length}`, chipTone: "info", label: "Chi tiêu TB", value: formatCurrency(averageSpend, "VND"), hint: "Computed from filtered customers" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Khách gần đây</h2><p>Tổng hợp từ booking và thông tin liên hệ.</p></div><div class="admin-list-stack">${customerRows || '<div class="empty-state"><h3>Chưa có khách hàng</h3><p>Dữ liệu khách hàng sẽ hiện khi có booking hoặc profile customer.</p></div>'}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Hồ sơ khách</h2><p>Đọc từ profiles và user_roles, nối cùng booking history.</p></div><div class="admin-list-stack">${customerProfiles || '<div class="empty-state"><h3>Chưa có hồ sơ khách</h3><p>Khách hàng sẽ hiện ở đây khi DB có profile hoặc booking.</p></div>'}</div></article>
    </section>
  `;
}

function renderPromotionsPage(data, stats) {
  const categoryOptions = data.catalogOptions?.categories || [];
  const rows = data.coupons.map((coupon) => {
    const tourScope = (coupon.tourIds || []).map((id) => getTourRecord(data, id)?.name || id).join(", ");
    const categoryScope = (coupon.categoryIds || []).map((id) => categoryOptions.find((item) => item.id === id)?.name || id).join(", ");
    return `<tr data-search="${escapeHtml(`${coupon.code} ${coupon.name || ""}`)}"><td><strong>${escapeHtml(coupon.code)}</strong><p>${escapeHtml(coupon.name || coupon.code)}</p></td><td>${escapeHtml(coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, "VND"))}</td><td>${escapeHtml(tourScope || categoryScope || "To\u00e0n b\u1ed9 catalog")}</td><td>${escapeHtml(formatCurrency(coupon.minOrderAmount || 0, "VND"))}</td><td>${renderStatusTag(coupon.isActive ? "\u0110ang b\u1eadt" : "T\u1eaft", coupon.isActive ? "success" : "danger")}</td><td>${escapeHtml(String(coupon.usageCount || 0))}</td><td><div class="admin-table-actions"><button class="admin-inline-button is-primary" type="button" data-admin-action="edit-coupon" data-coupon-id="${escapeHtml(coupon.id)}">S\u1eeda</button><button class="admin-inline-button" type="button" data-admin-action="toggle-coupon" data-coupon-id="${escapeHtml(coupon.id)}" data-next-active="${coupon.isActive ? "false" : "true"}">${coupon.isActive ? "T\u1eaft" : "B\u1eadt"}</button></div></td></tr>`;
  });
  const usageRows = data.couponUsages.slice(0, 8).map((usage) => `<article class="admin-mini-row" data-search="${escapeHtml(`${usage.booking?.booking_code || ""} ${usage.customer?.full_name || ""}`)}"><div><strong>${escapeHtml(usage.booking?.booking_code || "L\u01b0\u1ee3t d\u00f9ng")}</strong><p>${escapeHtml(usage.customer?.full_name || "Kh\u00e1ch h\u00e0ng")} - ${escapeHtml(formatDateTime(usage.created_at))}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(usage.discount_amount, "VND"))}</span><em>${escapeHtml(usage.booking?.snapshot_jsonb?.tour_name || usage.booking?.tour?.name || "Tour")}</em></div></article>`).join("");
  return `
    ${renderOpsToolbar("Qu\u1ea3n l\u00fd khuy\u1ebfn m\u00e3i", "T\u1ea1o coupon th\u1eadt, g\u1eafn theo tour ho\u1eb7c danh m\u1ee5c v\u00e0 ki\u1ec3m tra usage summary t\u1eeb DB.", [], `<button class="admin-inline-button is-primary" type="button" data-admin-action="create-coupon">T\u1ea1o coupon</button>`)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "sell", chip: `${stats.activeCoupons.length}`, label: "Coupon \u0111ang b\u1eadt", value: String(stats.activeCoupons.length), hint: "\u0110\u1ecdc t\u1eeb public.coupons" })}
      ${renderStatCard({ icon: "confirmation_number", chip: `${stats.totalCouponUsage}`, chipTone: "info", label: "L\u01b0\u1ee3t d\u00f9ng", value: String(stats.totalCouponUsage), hint: "T\u1eeb coupon_usages" })}
      ${renderStatCard({ icon: "local_offer", chip: `${data.coupons.length}`, label: "T\u1ed5ng gi\u1ea3m \u0111\u00e3 \u00e1p d\u1ee5ng", value: formatCurrency(data.coupons.reduce((sum, coupon) => sum + Number(coupon.totalDiscount || 0), 0), "VND"), hint: "T\u1ed5ng ti\u1ec1n gi\u1ea3m th\u1ef1c t\u1ebf" })}
      ${renderStatCard({ icon: "payments", chip: `${data.coupons.length}`, label: "Coupon gi\u00e1 tr\u1ecb cao nh\u1ea5t", value: formatCurrency(Math.max(0, ...data.coupons.map((coupon) => Number(coupon.maxDiscountAmount || coupon.discountValue || 0))), "VND"), hint: "M\u1ee9c gi\u1ea3m cao nh\u1ea5t hi\u1ec7n t\u1ea1i" })}
    </section>
    ${renderTablePanel("Danh s\u00e1ch coupon", "Coupon \u0111ang ho\u1ea1t \u0111\u1ed9ng, b\u1ea3n nh\u00e1p/t\u1eaft v\u00e0 ph\u1ea1m vi \u00e1p d\u1ee5ng \u0111\u1ec1u \u0111\u1ecdc t\u1eeb DB th\u1eadt.", ["Coupon", "M\u1ee9c gi\u1ea3m", "Ph\u1ea1m vi", "\u0110\u01a1n t\u1ed1i thi\u1ec3u", "Tr\u1ea1ng th\u00e1i", "L\u01b0\u1ee3t d\u00f9ng", "Thao t\u00e1c"], rows, `Hi\u1ec3n th\u1ecb ${rows.length} coupon`) }
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>L\u01b0\u1ee3t d\u00f9ng coupon</h2><p>Booking n\u00e0o \u0111\u00e3 d\u00f9ng coupon v\u00e0 gi\u1ea3m bao nhi\u00eau.</p></div><div class="admin-list-stack">${usageRows || '<div class="empty-state"><h3>Ch\u01b0a c\u00f3 l\u01b0\u1ee3t d\u00f9ng coupon</h3><p>L\u01b0\u1ee3t d\u00f9ng coupon s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y sau khi \u00e1p d\u1ee5ng.</p></div>'}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>H\u01b0\u1edbng d\u1eabn ph\u1ea1m vi \u00e1p d\u1ee5ng</h2><p>Nh\u1eadp slug tour ho\u1eb7c slug danh m\u1ee5c \u0111\u1ec3 g\u1eafn coupon \u0111\u00fang logic checkout th\u1eadt.</p></div><div class="admin-list-stack"><article class="admin-mini-row"><div><strong>Tour scope</strong><p>${escapeHtml(formatOptionHint(data.tours || [], "slug", 8) || "Ch\u01b0a c\u00f3 tour")}</p></div></article><article class="admin-mini-row"><div><strong>Category scope</strong><p>${escapeHtml(formatOptionHint(categoryOptions, "slug", 8) || "Ch\u01b0a c\u00f3 danh m\u1ee5c")}</p></div></article></div></article></section>
  `;
}

function renderUsersPage(data, stats) {
  const blockedUsers = data.profiles.filter((profile) => profile.status === "blocked").length;
  const managedProfiles = data.profiles.slice(0, 12).map((profile) => `
    <article class="admin-profile-row" data-search="${escapeHtml(`${profile.full_name || ""} ${profile.email || ""} ${profile.primaryRole || ""}`)}">
      <div class="admin-customer-avatar">${escapeHtml(getInitials(profile.full_name || profile.email || "TH"))}</div>
      <div class="admin-customer-row-copy">
        <strong>${escapeHtml(profile.full_name || profile.email || "Người dùng")}</strong>
        <p>${escapeHtml(profile.email || "Chưa có email")}</p>
      </div>
      <div class="admin-mini-row-side">
        <span>${escapeHtml(roleLabel(profile.primaryRole || "customer"))}</span>
        <em>${escapeHtml(formatStatus(profile.status || "active"))}</em>
      </div>
      <div class="admin-row-action"><button class="admin-inline-button is-primary" type="button" data-admin-action="manage-user" data-user-id="${escapeHtml(profile.id)}">Quản lý</button></div>
    </article>
  `).join("");

  return `
    ${renderOpsToolbar("Quản lý người dùng", "Đổi role và khóa hoặc mở tài khoản trực tiếp từ roles, user_roles và profiles trong DB thật.")}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "group", chip: `${stats.totalUsers}`, label: "Tổng người dùng", value: String(stats.totalUsers), hint: "Đọc từ profiles" })}
      ${renderStatCard({ icon: "badge", chip: `${stats.roleCounts.staff || 0}`, chipTone: "info", label: "Nhân viên", value: String(stats.roleCounts.staff || 0), hint: "role = staff" })}
      ${renderStatCard({ icon: "security", chip: `${(stats.roleCounts.admin || 0) + (stats.roleCounts.super_admin || 0)}`, chipTone: "info", label: "Quản trị", value: String((stats.roleCounts.admin || 0) + (stats.roleCounts.super_admin || 0)), hint: "admin và super_admin" })}
      ${renderStatCard({ icon: "person_off", chip: `${blockedUsers}`, chipTone: blockedUsers ? "danger" : "info", label: "Tài khoản bị khóa", value: String(blockedUsers), hint: "profiles.status = blocked" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Phân bố vai trò</h2><p>Tổng hợp từ roles và user_roles hiện tại.</p></div><div class="admin-role-grid">${renderRoleCards(stats.roleCounts)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Người dùng gần đây</h2><p>Mở popup để đổi quyền hoặc khóa tài khoản mà không cần sửa DB tay.</p></div><div class="admin-list-stack">${managedProfiles || '<div class="empty-state"><h3>Chưa có hồ sơ</h3><p>Người dùng sẽ hiện ở đây khi DB có profile.</p></div>'}</div></article>
    </section>
  `;
}

function renderContentPage(data, stats) {
  const bannerRows = data.banners.map((banner) => `<tr data-search="${escapeHtml(`${banner.title} ${banner.placement || ""}`)}"><td><strong>${escapeHtml(banner.title)}</strong><p>${escapeHtml(banner.imageUrl || "")}</p></td><td>${escapeHtml(banner.placement || "home")}</td><td>${renderStatusTag(Boolean(banner.is_active ?? banner.isActive) ? "\u0110ang b\u1eadt" : "T\u1eaft", Boolean(banner.is_active ?? banner.isActive) ? "success" : "danger")}</td><td>${escapeHtml(String(banner.sortOrder ?? banner.sort_order ?? 0))}</td><td>${escapeHtml(formatShortDate(banner.startAt || banner.createdAt || banner.created_at))}</td><td><div class="admin-table-actions"><button class="admin-inline-button is-primary" type="button" data-admin-action="edit-banner" data-banner-id="${escapeHtml(banner.id)}">S\u1eeda</button><button class="admin-inline-button" type="button" data-admin-action="toggle-banner" data-banner-id="${escapeHtml(banner.id)}" data-next-active="${(banner.is_active ?? banner.isActive) ? "false" : "true"}">${(banner.is_active ?? banner.isActive) ? "T\u1eaft" : "B\u1eadt"}</button></div></td></tr>`);
  const cmsRows = data.cmsPages.map((page) => `<article class="admin-mini-row" data-search="${escapeHtml(`${page.slug} ${page.title}`)}"><div><strong>${escapeHtml(page.title)}</strong><p>${escapeHtml(page.summary || page.description || "Trang nội dung website")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(page.publishedAt ? formatShortDate(page.publishedAt) : (page.isPublished ? "Đang công khai" : "Nháp"))}</span></div><div class="admin-detail-inline-actions"><button class="admin-inline-button is-primary" type="button" data-admin-action="edit-cms" data-page-id="${escapeHtml(page.id)}">Sửa</button><button class="admin-inline-button" type="button" data-admin-action="toggle-cms" data-page-id="${escapeHtml(page.id)}" data-next-published="${page.isPublished ? "false" : "true"}">${page.isPublished ? "Ẩn" : "Công khai"}</button>${page.previewable ? `<a class="admin-inline-button" href="${resolveCmsPreviewHref(page)}" target="_blank" rel="noreferrer">Xem trước</a>` : ""}</div></article>`).join("");
  return `
    ${renderOpsToolbar("Qu\u1ea3n l\u00fd n\u1ed9i dung", "Qu\u1ea3n l\u00fd banner v\u00e0 CMS t\u1eeb DB th\u1eadt, kh\u00f4ng c\u1ea7n s\u1eeda tay SQL.", [], `<button class="admin-inline-button is-primary" type="button" data-admin-action="create-banner">T\u1ea1o banner</button><button class="admin-inline-button" type="button" data-admin-action="create-cms">T\u1ea1o trang CMS</button>`)}
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "campaign", chip: `${stats.activeBanners.length}`, label: "Banner \u0111ang b\u1eadt", value: String(stats.activeBanners.length), hint: "public.banners" })}
      ${renderStatCard({ icon: "description", chip: `${data.cmsPages.length}`, chipTone: "info", label: "Trang CMS", value: String(data.cmsPages.length), hint: "public.cms_pages" })}
      ${renderStatCard({ icon: "visibility", chip: `${stats.publishedPages.length}`, label: "Trang c\u00f4ng khai", value: String(stats.publishedPages.length || data.cmsPages.length), hint: "Trang \u0111ang hi\u1ec3n th\u1ecb tr\u00ean website" })}
      ${renderStatCard({ icon: "palette", chip: `${data.banners.length}`, chipTone: "info", label: "V\u1ecb tr\u00ed hi\u1ec3n th\u1ecb", value: String(new Set(data.banners.map((banner) => banner.placement || "home")).size), hint: "hero, home, listing" })}
    </section>
    ${renderTablePanel("Danh s\u00e1ch banner", "Banner \u0111\u1ecdc tr\u1ef1c ti\u1ebfp t\u1eeb b\u1ea3ng banners v\u00e0 c\u00f3 th\u1ec3 b\u1eadt/t\u1eaft ngay trong admin.", ["Banner", "V\u1ecb tr\u00ed", "Tr\u1ea1ng th\u00e1i", "Th\u1ee9 t\u1ef1", "B\u1eaft \u0111\u1ea7u", "Thao t\u00e1c"], bannerRows, `Hi\u1ec3n th\u1ecb ${bannerRows.length} banner`) }
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>Trang CMS</h2><p>C\u00e1c trang n\u1ed9i dung \u0111ang \u0111\u01b0\u1ee3c d\u00f9ng tr\u00ean website.</p></div><div class="admin-list-stack">${cmsRows || '<div class="empty-state"><h3>Ch\u01b0a c\u00f3 trang CMS</h3><p>Trang CMS s\u1ebd hi\u1ec7n \u1edf \u0111\u00e2y khi DB c\u00f3 d\u1eef li\u1ec7u.</p></div>'}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>T\u1ed5ng quan n\u1ed9i dung</h2><p>Xem nhanh banner, coupon v\u00e0 CMS.</p></div><div class="admin-content-grid"><article class="admin-content-card"><span>Banner \u0111ang b\u1eadt</span><strong>${escapeHtml(String(stats.activeBanners.length))}</strong><p>V\u1ecb tr\u00ed \u0111ang \u0111\u01b0\u1ee3c b\u1eadt tr\u00ean website.</p></article><article class="admin-content-card"><span>Coupon \u0111ang b\u1eadt</span><strong>${escapeHtml(String(stats.activeCoupons.length))}</strong><p>M\u00e3 gi\u1ea3m gi\u00e1 \u0111ang kh\u1ea3 d\u1ee5ng.</p></article><article class="admin-content-card"><span>Trang CMS</span><strong>${escapeHtml(String(data.cmsPages.length))}</strong><p>C\u00e1c trang n\u1ed9i dung \u0111ang \u0111\u01b0\u1ee3c qu\u1ea3n l\u00fd.</p></article><article class="admin-content-card"><span>Ngu\u1ed3n d\u1eef li\u1ec7u</span><strong>DB</strong><p>D\u1eef li\u1ec7u admin \u0111ang \u0111\u1ecdc tr\u1ef1c ti\u1ebfp t\u1eeb Supabase.</p></article></div></article></section>
  `;
}

function renderSettingsPage(data, stats) {
  const settingRows = data.systemSettings.map((setting) => `
    <article class="admin-mini-row" data-search="${escapeHtml(`${setting.setting_key} ${setting.description || ""}`)}">
      <div>
        <strong>${escapeHtml(setting.setting_key)}</strong>
        <p>${escapeHtml(setting.description || "Cấu hình hệ thống")}</p>
        <pre class="admin-setting-value">${escapeHtml(formatSettingValuePreview(setting.setting_value))}</pre>
      </div>
      <div class="admin-mini-row-side">
        <span>${escapeHtml(formatDateTime(setting.updated_at || setting.created_at))}</span>
        <button class="admin-inline-button" type="button" data-admin-action="edit-setting" data-setting-id="${escapeHtml(setting.id)}">Sửa</button>
      </div>
    </article>
  `).join("");

  const paymentRows = data.paymentMethods.map((method) => `
    <article class="admin-mini-row" data-search="${escapeHtml(`${method.name} ${method.code} ${method.providerName || ""}`)}">
      <div>
        <strong>${escapeHtml(method.name)}</strong>
        <p>${escapeHtml(method.description || method.providerName || method.code)}</p>
      </div>
      <div class="admin-mini-row-side">
        ${renderStatusTag(method.isActive ? "Đang bật" : "Tắt", method.isActive ? "success" : "danger")}
        <button class="admin-inline-button" type="button" data-admin-action="toggle-payment-method" data-method-id="${escapeHtml(method.id)}" data-next-active="${method.isActive ? "false" : "true"}">${method.isActive ? "Tắt" : "Bật"}</button>
      </div>
    </article>
  `).join("");

  return `
    ${renderOpsToolbar("Cài đặt hệ thống", "Chỉnh system settings, bật hoặc tắt payment methods và xem activity log từ DB thật.", [], `<button class="admin-inline-button is-primary" type="button" data-admin-action="create-setting">Tạo setting</button>`) }
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "settings", chip: `${data.systemSettings.length}`, label: "Cấu hình hệ thống", value: String(data.systemSettings.length), hint: "public.system_settings" })}
      ${renderStatCard({ icon: "payments", chip: `${data.paymentMethods.filter((method) => method.isActive).length}`, chipTone: "info", label: "Payment method đang bật", value: String(data.paymentMethods.filter((method) => method.isActive).length), hint: "Bật cho checkout thực tế" })}
      ${renderStatCard({ icon: "admin_panel_settings", chip: `${Object.keys(stats.roleCounts).length}`, label: "Mô hình vai trò", value: "4", hint: "customer, staff, admin, super_admin" })}
      ${renderStatCard({ icon: "database", chip: "DB", chipTone: "info", label: "Nguồn dữ liệu", value: "Supabase", hint: "Đọc trực tiếp từ DB" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>System settings</h2><p>Key và value lấy trực tiếp từ public.system_settings.</p></div><div class="admin-list-stack">${settingRows || '<div class="empty-state"><h3>Chưa có cấu hình</h3><p>Cài đặt hệ thống sẽ hiện ở đây khi DB sẵn sàng.</p></div>'}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Phương thức thanh toán</h2><p>Bật hoặc tắt trực tiếp các phương thức mà checkout đang sử dụng.</p></div><div class="admin-list-stack">${paymentRows || '<div class="empty-state"><h3>Chưa có payment method</h3><p>Phương thức thanh toán sẽ hiện ở đây khi DB có dữ liệu.</p></div>'}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Health check</h2><p>Snapshot nhanh để xác nhận admin đang đọc đúng dữ liệu thật.</p></div><div class="admin-settings-grid"><article class="admin-setting-card"><span>Source mode</span><strong>${escapeHtml(data.sourceMode || "database")}</strong><p>Không dùng local demo hay số liệu fake.</p></article><article class="admin-setting-card"><span>Viewer role</span><strong>${escapeHtml(roleLabel(data.viewer?.primaryRole || "admin"))}</strong><p>Quyền đang dùng để thao tác khu quản trị.</p></article><article class="admin-setting-card"><span>Activity logs</span><strong>${escapeHtml(String(data.activityLogs.length))}</strong><p>Bản ghi vận hành mới nhất trong hệ thống.</p></article><article class="admin-setting-card"><span>Payment methods</span><strong>${escapeHtml(String(data.paymentMethods.length))}</strong><p>Số cổng thanh toán hiện đang có trong DB.</p></article></div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Activity log</h2><p>Các thao tác nhạy cảm ở admin phải để lại log vận hành.</p></div>${renderActivityList(data.activityLogs)}</article>
    </section>
  `;
}

function renderPageBody(auth, currentPage, data, stats) {
  const renderers = {
    dashboard: () => renderDashboardPage(auth, data, stats),
    reports: () => renderReportsPage(data, stats),
    bookings: () => renderBookingsPage(data, stats),
    payments: () => renderPaymentsPage(data, stats),
    tours: () => renderToursPage(data, stats),
    service: () => renderServicePage(data, stats),
    customers: () => renderCustomersPage(data, stats),
    promotions: () => renderPromotionsPage(data, stats),
    users: () => renderUsersPage(data, stats),
    content: () => renderContentPage(data, stats),
    settings: () => renderSettingsPage(data, stats)
  };
  return (renderers[currentPage] || renderers.dashboard)();
}

function renderManagementApp(auth, data, currentPage) {
  const stats = { ...getManagementStats(data), sourceMode: data.sourceMode };
  const mobileOrder = ["dashboard", "bookings", "payments", "service", "settings"];
  const mobilePages = mobileOrder.filter((pageKey) => canAccessPage(auth.primaryRole, pageKey)).slice(0, 4);
  return `
    ${renderSidebar(auth, currentPage, stats)}
    <main class="portal-main admin-portal-main">
      ${renderTopbar(auth, currentPage, data.sourceMode)}
      <div class="portal-content admin-portal-content">
        ${renderPageIntro(auth, currentPage, data, stats)}
        ${renderPageBody(auth, currentPage, data, stats)}
      </div>
    </main>
    <nav class="portal-mobile-nav admin-mobile-nav">${mobilePages.map((pageKey) => `<a class="${pageKey === currentPage ? "is-active" : ""}" href="${routePath(PAGE_DEFINITIONS[pageKey].routeKey)}"><span class="material-symbols-outlined">${PAGE_DEFINITIONS[pageKey].icon}</span><span>${escapeHtml(PAGE_DEFINITIONS[pageKey].label)}</span></a>`).join("")}</nav>
  `;
}

function bindSearch(root) {
  const input = qs("#admin-dashboard-search", root);
  const items = Array.from(root.querySelectorAll("[data-search]"));
  if (!input) return;
  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    items.forEach((item) => {
      const haystack = String(item.dataset.search || "").toLowerCase();
      item.style.display = !query || haystack.includes(query) ? "" : "none";
    });
  });
}

async function renderManagementRoot(root, auth, currentPage) {
  MANAGEMENT_RUNTIME.auth = auth;
  MANAGEMENT_RUNTIME.currentPage = currentPage;
  MANAGEMENT_RUNTIME.data = await getAdminDashboard();
  renderManagementShell(root);
}

async function handleManagementAction(button, root, auth, currentPage) {
  const action = button.dataset.adminAction;
  if (!action) return;

  const promptMap = {
    "approve-cancellation": { message: "Ghi chú khi duyệt hủy booking:", value: "Đã duyệt yêu cầu hủy theo quy định hiện hành." },
    "reject-cancellation": { message: "Lý do từ chối yêu cầu hủy:", value: "Booking hiện chưa đủ điều kiện hủy theo chính sách." },
    "record-manual-payment": { message: "Ghi chú xác nhận thanh toán thủ công:", value: "Bộ phận vận hành đã xác nhận thanh toán ngoại tuyến." },
    "process-refund": { message: "Ghi chú hoàn tiền:", value: "Refund đã được xử lý và ghi nhận trên hệ thống." },
    "reject-refund": { message: "Lý do từ chối refund:", value: "Refund request chưa đủ điều kiện xử lý." },
    "approve-review": { message: "Phản hồi gửi kèm khi duyệt review (có thể để trống):", value: button.dataset.reviewReply || "Cảm ơn bạn đã chia sẻ trải nghiệm thực tế." },
    "hide-review": { message: "Phản hồi gửi tới khách khi ẩn review (có thể để trống):", value: button.dataset.reviewReply || "" },
    "reply-review": { message: "Nhập phản hồi cho review này:", value: button.dataset.reviewReply || "Cảm ơn bạn đã chọn TourBook." },
    "add-booking-note": { message: "Ghi chú nội bộ cho booking:", value: "" }
  };

  const promptConfig = promptMap[action] || null;
  const note = promptConfig ? window.prompt(normalizeUiText(normalizeAdminText(promptConfig.message)), normalizeUiText(normalizeAdminText(promptConfig.value))) : "";
  if (promptConfig && note === null) return;

  button.disabled = true;
  try {
    switch (action) {
      case "approve-cancellation":
        await reviewCancellation({ bookingCode: button.dataset.bookingCode, decision: "approved", note });
        showAdminToast("Đã duyệt yêu cầu hủy booking.", "success");
        break;
      case "reject-cancellation":
        await reviewCancellation({ bookingCode: button.dataset.bookingCode, decision: "rejected", note });
        showAdminToast("Đã từ chối yêu cầu hủy booking.", "success");
        break;
      case "record-manual-payment":
        await recordManualPayment({ bookingCode: button.dataset.bookingCode, note });
        showAdminToast("Đã ghi nhận thanh toán thủ công.", "success");
        break;
      case "process-refund":
        await processRefund({ refundId: button.dataset.refundId, decision: "refunded", note });
        showAdminToast("Đã hoàn tiền thành công.", "success");
        break;
      case "reject-refund":
        await processRefund({ refundId: button.dataset.refundId, decision: "rejected", note });
        showAdminToast("Đã từ chối refund.", "success");
        break;
      case "approve-review":
        await moderateReview({ reviewId: button.dataset.reviewId, status: "approved", replyText: note });
        showAdminToast("Đã duyệt review.", "success");
        break;
      case "hide-review":
        await moderateReview({ reviewId: button.dataset.reviewId, status: "hidden", replyText: note });
        showAdminToast("Đã ẩn review khỏi public pages.", "success");
        break;
      case "reply-review":
        if (!String(note || "").trim()) {
          showAdminToast("Phản hồi review không được để trống.", "error");
          return;
        }
        await moderateReview({ reviewId: button.dataset.reviewId, status: button.dataset.reviewStatus || "pending", replyText: note });
        showAdminToast("Đã lưu phản hồi review.", "success");
        break;
      case "add-booking-note":
        if (!String(note || "").trim()) {
          showAdminToast("Ghi chú nội bộ không được để trống.", "error");
          return;
        }
        await updateBookingInternalNote({ bookingCode: button.dataset.bookingCode, bookingId: button.dataset.bookingId, note });
        showAdminToast("Đã lưu ghi chú nội bộ.", "success");
        break;
      case "manage-ticket":
        openAdminCrudModal("ticket", { entityId: button.dataset.ticketId });
        renderManagementShell(root);
        return;
      case "manage-user":
        openAdminCrudModal("user", { entityId: button.dataset.userId });
        renderManagementShell(root);
        return;
      case "create-setting":
        openAdminCrudModal("setting");
        renderManagementShell(root);
        return;
      case "edit-setting":
        openAdminCrudModal("setting", { entityId: button.dataset.settingId });
        renderManagementShell(root);
        return;
      case "toggle-payment-method":
        await toggleAdminPaymentMethod(button.dataset.methodId, button.dataset.nextActive === "true");
        showAdminToast("Đã cập nhật phương thức thanh toán.", "success");
        break;
      case "create-tour":
        openAdminCrudModal("tour");
        renderManagementShell(root);
        return;
      case "edit-tour":
        openAdminCrudModal("tour", { entityId: button.dataset.tourId });
        renderManagementShell(root);
        return;
      case "set-tour-status":
        await setAdminTourStatus(button.dataset.tourId, button.dataset.tourStatus || "published");
        showAdminToast("Đã cập nhật trạng thái tour.", "success");
        break;
      case "create-schedule":
        openAdminCrudModal("schedule", { seed: { tourId: button.dataset.tourId || "" } });
        renderManagementShell(root);
        return;
      case "edit-schedule":
        openAdminCrudModal("schedule", { entityId: button.dataset.scheduleId });
        renderManagementShell(root);
        return;
      case "create-coupon":
        openAdminCrudModal("coupon");
        renderManagementShell(root);
        return;
      case "edit-coupon":
        openAdminCrudModal("coupon", { entityId: button.dataset.couponId });
        renderManagementShell(root);
        return;
      case "toggle-coupon":
        await toggleAdminCoupon(button.dataset.couponId, button.dataset.nextActive === "true");
        showAdminToast("Đã cập nhật trạng thái coupon.", "success");
        break;
      case "create-banner":
        openAdminCrudModal("banner");
        renderManagementShell(root);
        return;
      case "edit-banner":
        openAdminCrudModal("banner", { entityId: button.dataset.bannerId });
        renderManagementShell(root);
        return;
      case "toggle-banner":
        await toggleAdminBanner(button.dataset.bannerId, button.dataset.nextActive === "true");
        showAdminToast("Đã cập nhật trạng thái banner.", "success");
        break;
      case "create-cms":
        openAdminCrudModal("cms");
        renderManagementShell(root);
        return;
      case "edit-cms":
        openAdminCrudModal("cms", { entityId: button.dataset.pageId });
        renderManagementShell(root);
        return;
      case "toggle-cms":
        await toggleAdminCmsPage(button.dataset.pageId, button.dataset.nextPublished === "true");
        showAdminToast("Đã cập nhật trạng thái CMS.", "success");
        break;
      default:
        return;
    }

    await renderManagementRoot(root, auth, currentPage);
  } catch (error) {
    showAdminToast(normalizeAdminText(error.message || "Lỗi quản trị không mong muốn."), "error");
  } finally {
    button.disabled = false;
  }
}

async function init() {
  const root = qs("#admin-app");
  installAdminUnicodeLayer();
  document.title = normalizeAdminText(document.title);
  setLoading(root, normalizeAdminText("Đang tải khu quản trị..."));
  const auth = await guardPage({ management: true });
  if (!auth) return;

  const currentPage = getCurrentPageKey();
  if (!canAccessPage(auth.primaryRole, currentPage)) {
    const fallbackPage = getAccessiblePages(auth.primaryRole)[0] || "dashboard";
    window.location.href = routePath(PAGE_DEFINITIONS[fallbackPage].routeKey);
    return;
  }

  root.addEventListener("change", (event) => {
    const filterControl = event.target.closest("[data-admin-filter]");
    if (!filterControl) return;
    const pageKey = filterControl.dataset.adminFilterPage || currentPage;
    getRuntimeFilters(pageKey)[filterControl.dataset.adminFilter] = filterControl.value;
    renderManagementShell(root);
  });

  root.addEventListener("click", async (event) => {
    const logoutButton = event.target.closest("#admin-logout");
    if (logoutButton) {
      await signOut();
      showAdminToast("Đã đăng xuất khỏi khu quản trị.", "success");
      window.location.href = routePath("home");
      return;
    }

    const closeDetailButton = event.target.closest("[data-admin-close-detail]");
    if (closeDetailButton) {
      MANAGEMENT_RUNTIME.detail = null;
      renderManagementShell(root);
      return;
    }

    const closeModalButton = event.target.closest("[data-admin-close-modal]");
    if (closeModalButton) {
      closeAdminCrudModal();
      renderManagementShell(root);
      return;
    }

    const exportButton = event.target.closest("[data-admin-export]");
    if (exportButton) {
      exportAdminCsv(exportButton.dataset.adminExport);
      return;
    }

    const detailButton = event.target.closest("[data-admin-open-detail]");
    if (detailButton) {
      MANAGEMENT_RUNTIME.detail = {
        type: detailButton.dataset.adminOpenDetail,
        id: detailButton.dataset.adminDetailId
      };
      renderManagementShell(root);
      return;
    }

    const ticketSelectButton = event.target.closest("[data-admin-ticket-select]");
    if (ticketSelectButton) {
      MANAGEMENT_RUNTIME.service.activeTicketId = ticketSelectButton.dataset.adminTicketSelect || null;
      renderManagementShell(root);
      return;
    }

    const actionButton = event.target.closest("[data-admin-action]");
    if (actionButton) {
      event.preventDefault();
      await handleManagementAction(actionButton, root, auth, currentPage);
    }
  });

  root.addEventListener("submit", async (event) => {
    const serviceTicketForm = event.target.closest("[data-admin-service-ticket-form]");
    if (serviceTicketForm) {
      event.preventDefault();
      const formData = new FormData(serviceTicketForm);
      await updateTicketStatus({
        ticketId: serviceTicketForm.dataset.ticketId,
        status: formData.get("status"),
        assignedTo: formData.get("assignedTo"),
        note: formData.get("note")
      });
      showAdminToast("Đã cập nhật ticket hỗ trợ.", "success");
      await renderManagementRoot(root, auth, currentPage);
      return;
    }

    const form = event.target.closest("[data-admin-modal-form]");
    if (!form) return;
    event.preventDefault();
    await handleAdminCrudSubmit(form, root, currentPage);
  });

  try {
    await renderManagementRoot(root, auth, currentPage);
  } catch (error) {
    root.innerHTML = normalizeAdminCopy(`<div class="empty-state"><h3>Không thể tải khu quản trị</h3><p>${escapeHtml(error.message || "Lỗi không mong muốn.")}</p></div>`);
    normalizeAdminTree(root);
  }
}

void init();



























