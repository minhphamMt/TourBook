import {
  createSupportTicket,
  deleteSavedTraveler,
  deleteUserAddress,
  getAccountDashboard,
  markNotificationRead,
  replySupportTicket,
  saveSavedTraveler,
  saveUserAddress,
  signOut,
  toggleWishlist,
  updateProfile
} from "./api.js";
import { routePath } from "./routes.js";
import {
  bindAsyncForm,
  escapeHtml,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  guardPage,
  normalizeRenderedHtml,
  normalizeUiText,
  normalizeUiTree,
  qs,
  renderMediaFrame,
  getBookingCoverImage,
  renderStatusPill,
  setLoading,
  showToast
} from "./shared.js?v=20260331o";

const PAGE_DEFINITIONS = {
  dashboard: {
    routeKey: "account",
    group: "Dashboard",
    icon: "dashboard",
    label: "Tổng quan",
    title: "Tổng quan",
    searchPlaceholder: "Tìm booking, ticket, tour..."
  },
  bookings: {
    routeKey: "account-bookings",
    group: "Dashboard",
    icon: "event_available",
    label: "Booking",
    title: "Booking của tôi",
    searchPlaceholder: "Tìm booking, tour, mã đặt..."
  },
  support: {
    routeKey: "account-support",
    group: "Dashboard",
    icon: "support_agent",
    label: "Hỗ trợ",
    title: "Trung tâm hỗ trợ",
    searchPlaceholder: "Tìm ticket, mã ticket..."
  },
  wishlist: {
    routeKey: "account-wishlist",
    group: "Dashboard",
    icon: "favorite",
    label: "Wishlist",
    title: "Wishlist",
    searchPlaceholder: "Tìm tour Đã lưu..."
  },
  travelers: {
    routeKey: "account-travelers",
    group: "Hồ sơ",
    icon: "badge",
    label: "H\u00e0nh kh\u00e1ch",
    title: "H\u00e0nh kh\u00e1ch lưu sẵn",
    searchPlaceholder: "Tìm hành khách, email..."
  },
  addresses: {
    routeKey: "account-addresses",
    group: "Hồ sơ",
    icon: "home_pin",
    label: "Địa chỉ",
    title: "Địa chỉ liên hệ",
    searchPlaceholder: "Tìm Địa chỉ, người nhận..."
  },
  notifications: {
    routeKey: "account-notifications",
    group: "Hồ sơ",
    icon: "notifications",
    label: "Thông báo",
    title: "Thông báo",
    searchPlaceholder: "Tìm th?ng b?o..."
  },
  settings: {
    routeKey: "account-settings",
    group: "Hồ sơ",
    icon: "settings",
    label: "Tài khoản",
    title: "Tài khoản",
    searchPlaceholder: "Tìm th?ng tin t?i kho?n..."
  }
};

const MOBILE_PAGES = ["dashboard", "bookings", "support", "settings"];

["group", "label", "title", "searchPlaceholder"].forEach((field) => {
  Object.values(PAGE_DEFINITIONS).forEach((page) => {
    if (typeof page[field] === "string") {
      page[field] = normalizeUiText(page[field]);
    }
  });
});
const uiState = {
  bookingFilter: "all",
  editingTravelerId: null,
  editingAddressId: null,
  activeTicketId: null,
  detailType: null,
  detailId: null,
  searchQuery: ""
};

let latestData = null;

function getCurrentPageKey() {
  const key = document.body.dataset.accountPage || "dashboard";
  return PAGE_DEFINITIONS[key] ? key : "dashboard";
}

function getPageDefinition(pageKey) {
  return PAGE_DEFINITIONS[pageKey] || PAGE_DEFINITIONS.dashboard;
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

function travelerTypeLabel(type) {
  const labels = {
    adult: "Người lớn",
    child: "Trẻ em",
    infant: "Em bé"
  };
  return labels[type] || String(type || "H\u00e0nh kh\u00e1ch");
}

function getUpcomingCount(bookings) {
  const now = Date.now();
  return bookings.filter((booking) => {
    const departure = new Date(booking.snapshot_jsonb?.departure_date || booking.created_at).getTime();
    return departure >= now && !["cancelled", "completed", "expired"].includes(booking.booking_status);
  }).length;
}

function getOpenTicketCount(tickets) {
  return tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length;
}

function getUnreadNotificationCount(notifications) {
  return notifications.filter((notification) => !notification.is_read).length;
}

function getPendingPaymentCount(bookings) {
  return bookings.filter((booking) => ["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status)
    && ["pending", "unpaid", "failed"].includes(booking.payment_status)).length;
}

function isTicketClosed(ticket) {
  return ["resolved", "closed"].includes(ticket?.status);
}

function syncActiveTicketState(tickets) {
  if (!tickets.length) {
    uiState.activeTicketId = null;
    return null;
  }

  const match = tickets.find((ticket) => String(ticket.id) === String(uiState.activeTicketId));
  if (match) return match;

  uiState.activeTicketId = tickets[0].id;
  return tickets[0];
}

function getActiveTicket(tickets) {
  if (!tickets.length) return null;
  return tickets.find((ticket) => String(ticket.id) === String(uiState.activeTicketId)) || tickets[0];
}

function openAccountDetail(type, id) {
  uiState.detailType = type || null;
  uiState.detailId = id || null;
}

function closeAccountDetail() {
  uiState.detailType = null;
  uiState.detailId = null;
}

function syncActiveDetailState(data) {
  if (!uiState.detailType || !uiState.detailId) return;

  if (uiState.detailType === "booking") {
    const exists = (data?.bookings || []).some((booking) => String(booking.id) == String(uiState.detailId));
    if (!exists) closeAccountDetail();
    return;
  }

  if (uiState.detailType === "tour") {
    const tourIds = new Set([
      ...(data?.wishlistTours || []).map((tour) => String(tour.id)),
      ...(data?.bookings || []).map((booking) => String(booking.tour?.id || "")).filter(Boolean)
    ]);
    if (!tourIds.has(String(uiState.detailId))) closeAccountDetail();
  }
}

function getActiveBookingDetail(data) {
  if (uiState.detailType !== "booking") return null;
  return (data?.bookings || []).find((booking) => String(booking.id) === String(uiState.detailId)) || null;
}

function getActiveTourDetail(data) {
  if (uiState.detailType !== "tour") return null;
  return (data?.wishlistTours || []).find((tour) => String(tour.id) === String(uiState.detailId))
    || (data?.bookings || []).map((booking) => booking.tour).find((tour) => String(tour?.id) === String(uiState.detailId))
    || null;
}

function formatReadableStatus(value, fallback = "N/A") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  return raw.replaceAll("_", " ");
}

function renderAccountDetailStats(items) {
  return `<div class="admin-detail-grid">${items.map((item) => `
    <article class="admin-detail-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${item.html ? item.value : escapeHtml(item.value)}</strong>
      <p>${escapeHtml(item.hint || "")}</p>
    </article>
  `).join("")}</div>`;
}

function renderAccountDetailFactGrid(items) {
  return `<div class="admin-detail-fact-grid">${items.filter((item) => item && item.value).map((item) => `
    <article class="admin-detail-fact">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.value)}</strong>
    </article>
  `).join("")}</div>`;
}

function renderAccountDetailRows(rows, emptyTitle, emptyCopy) {
  if (!rows.length) {
    return `<div class="empty-state"><h3>${escapeHtml(emptyTitle)}</h3><p>${escapeHtml(emptyCopy)}</p></div>`;
  }

  return `<div class="admin-list-stack">${rows.join("")}</div>`;
}

function renderAccountDetailSection(title, copy, content, extraClass = "") {
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

function renderAccountBookingDetail(booking) {
  if (!booking) {
    return '<div class="admin-detail-shell"><div class="empty-state"><h3>Không tìm thủy booking</h3><p>Booking này không còn kh? ??ng trong dashboard.</p></div></div>';
  }

  const travelers = booking.travelers || [];
  const payments = booking.payments || [];
  const tickets = booking.tickets || [];
  const review = booking.review || null;
  const departureDate = booking.snapshot_jsonb?.departure_date || booking.schedule?.departureDate || booking.created_at;
  const paymentRows = payments.map((payment) => `
    <article class="admin-mini-row">
      <div>
        <strong>${escapeHtml(payment.provider_name || payment.paymentMethod?.name || "Thanh toán")}</strong>
        <p>${escapeHtml(payment.transaction_code || payment.provider_payment_id || payment.paymentMethod?.name || "Thanh toán tr?c tuy?n")}</p>
      </div>
      <div class="admin-mini-row-side">
        <span>${escapeHtml(formatCurrency(payment.amount, payment.currency || booking.currency || "VND"))}</span>
        <em>${escapeHtml(`${formatReadableStatus(payment.status)} / ${formatReadableStatus(payment.refunds?.[0]?.status || "no_refund", "no refund")}`)}</em>
      </div>
    </article>
  `);
  const travelerRows = travelers.map((traveler) => `
    <article class="admin-mini-row">
      <div>
        <strong>${escapeHtml(traveler.full_name || traveler.name || "Hành khách")}</strong>
        <p>${escapeHtml([traveler.traveler_type || traveler.type || "guest", traveler.passport_number || traveler.date_of_birth || ""].filter(Boolean).join(" • "))}</p>
      </div>
      <div class="admin-mini-row-side">
        <span>${escapeHtml(traveler.gender || traveler.nationality || "")}</span>
      </div>
    </article>
  `);
  const supportRows = [
    ...tickets.map((ticket) => `
      <article class="admin-mini-row">
        <div>
          <strong>${escapeHtml(ticket.subject || "Ticket hỗ trợ")}</strong>
          <p>${escapeHtml(ticket.messages?.[ticket.messages.length - 1]?.message || ticket.messages?.[ticket.messages.length - 1]?.message_text || "Chưa có phản hồi mới")}</p>
        </div>
        <div class="admin-mini-row-side">
          <span>${renderStatusPill(ticket.status)}</span>
        </div>
      </article>
    `),
    ...(review ? [`
      <article class="admin-mini-row">
        <div>
          <strong>${escapeHtml(`Review ${Number(review.rating || 0).toFixed(1)}/5`)}</strong>
          <p>${escapeHtml(review.comment || "Chưa có n?i dung review")}</p>
        </div>
        <div class="admin-mini-row-side">
          <span>${renderStatusPill(review.status || "pending")}</span>
        </div>
      </article>
    `] : [])
  ];
  const factGrid = renderAccountDetailFactGrid([
    { label: "Mã booking", value: booking.booking_code || "Ðang c?p nh?t" },
    { label: "Ði?m ??n", value: booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "Ðang c?p nh?t" },
    { label: "Kh?i hành", value: formatLongDate(departureDate) },
    { label: "S? khách", value: String(booking.totalGuests || travelers.length || 0) },
    { label: "Liên h?", value: booking.contact_name || "Khách hàng" },
    { label: "Email", value: booking.contact_email || "Chưa cóp nh?t" }
  ]);

  return `
    <div class="admin-detail-shell user-detail-shell">
      <section class="admin-detail-hero-shell admin-detail-hero-shell-has-media">
        <div class="admin-detail-media-panel">
          ${renderMediaFrame({
            src: getBookingCoverImage(booking),
            alt: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
            className: "user-detail-cover admin-detail-cover",
            placeholderLabel: "?nh booking chua c�"
          })}
        </div>
        <div class="admin-detail-hero-main">
          <span class="eyebrow">Booking detail</span>
          <h2>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</h2>
          <p class="admin-detail-lead">${escapeHtml(booking.contact_name || "Khách hàng")} • ${escapeHtml(booking.contact_email || "Chưa có email")}</p>
          <div class="admin-detail-pill-row">
            ${renderStatusPill(booking.booking_status)}
            ${renderStatusPill(booking.payment_status)}
          </div>
        </div>
        <div class="admin-detail-hero-side">
          <button class="admin-inline-button" type="button" data-account-close-detail="true">Ðóng</button>
          <div class="admin-detail-actions">
            ${booking.tour?.id ? `<button class="admin-inline-button" type="button" data-account-open-detail="tour" data-account-detail-id="${escapeHtml(booking.tour.id)}">Xem tour</button>` : ""}
            <a class="admin-inline-button" href="${routePath("account-support")}">M? h? tr?</a>
          </div>
        </div>
      </section>
      ${renderAccountDetailStats([
        { label: "T?ng ti?n", value: formatCurrency(booking.total_amount, booking.currency || "VND"), hint: "Giá tr? booking hiện t?i" },
        { label: "Khách", value: String(booking.totalGuests || travelers.length || 0), hint: "S? hành khách" },
        { label: "Kh?i hành", value: formatShortDate(departureDate), hint: booking.schedule?.meetingPoint || "L?ch t? DB" },
        { label: "Hỗ trợ", value: String(tickets.length), hint: review ? "Ðã có review" : "Chưa có review" }
      ])}
      <div class="admin-detail-body-grid">
        <div class="admin-detail-column">
          ${renderAccountDetailSection("Thông tin booking", "Các thông tin quan tr?ng cho chuyến di này.", factGrid)}
          ${renderAccountDetailSection("Hành khách", "Danh sách hành khách trong booking.", renderAccountDetailRows(travelerRows, "Chưa có hành khách", "Booking này chua có dữ liệu traveler."))}
        </div>
        <div class="admin-detail-column">
          ${renderAccountDetailSection("Thanh toán", "Nhắng l?n thanh toán liên quan t?i booking.", renderAccountDetailRows(paymentRows, "Chưa có thanh toán", "Booking này chua phát sinh payment attempt."))}
          ${renderAccountDetailSection("Hỗ trợ & review", "Các trao ??i và phản hồi của b?n.", renderAccountDetailRows(supportRows, "Chưa có h? tr?", "Booking này chua phát sinh ticket ho?c review."))}
        </div>
      </div>
    </div>
  `;
}

function renderAccountTourDetail(tour) {
  if (!tour) {
    return '<div class="admin-detail-shell"><div class="empty-state"><h3>Không tìm thủy tour</h3><p>Tour này không còn kh? ??ng trong dashboard.</p></div></div>';
  }

  const nextSchedule = (tour.schedules || []).find((schedule) => schedule.isBookable) || (tour.schedules || [])[0] || null;
  const itineraryRows = (tour.itinerary || []).slice(0, 5).map((day) => `
    <article class="admin-mini-row">
      <div>
        <strong>${escapeHtml(`Ngày ${day.day_number || "?"}: ${day.title || "L?ch trình"}`)}</strong>
        <p>${escapeHtml(day.description || day.summary || "Ðang c?p nh?t")}</p>
      </div>
    </article>
  `);
  const noteRows = (tour.includedItems || []).slice(0, 4).map((item) => `<article class="admin-mini-row"><div><strong>Ðã bao g?m</strong><p>${escapeHtml(item)}</p></div></article>`);
  const extraRows = (tour.noteItems || []).slice(0, 4).map((item) => `<article class="admin-mini-row"><div><strong>L?u ý</strong><p>${escapeHtml(item)}</p></div></article>`);
  const factGrid = renderAccountDetailFactGrid([
    { label: "Ði?m ??n", value: tour.destinationLabel || tour.regionLabel || "Ðang c?p nh?t" },
    { label: "Giá t?", value: formatCurrency(tour.startingPrice || 0, tour.baseCurrency || "VND") },
    { label: "Th?i l??ng", value: tour.durationLabel || `${tour.durationDays || 0}N${tour.durationNights || 0}Ð` },
    { label: "Kh?i hành g?n nh?t", value: nextSchedule?.departureDate ? formatLongDate(nextSchedule.departureDate) : "Chưa có l?ch" },
    { label: "Ðánh giá", value: tour.ratingAverage ? `${tour.ratingAverage}/5` : "Chưa có" },
    { label: "L?ch m?", value: String(tour.openScheduleCount || 0) }
  ]);

  return `
    <div class="admin-detail-shell user-detail-shell">
      <section class="admin-detail-hero-shell admin-detail-hero-shell-has-media">
        <div class="admin-detail-media-panel">
          ${renderMediaFrame({
            src: tour.coverImage,
            alt: tour.name,
            className: "user-detail-cover admin-detail-cover",
            placeholderLabel: "?nh tour chua c�"
          })}
        </div>
        <div class="admin-detail-hero-main">
          <span class="eyebrow">Tour detail</span>
          <h2>${escapeHtml(tour.name)}</h2>
          <p class="admin-detail-lead">${escapeHtml(tour.shortDescription || tour.description || "Tour dang ???c c?p nh?t mô t? chi tiết.")}</p>
          <div class="admin-detail-pill-row">
            ${tour.openScheduleCount ? `<span class="chip">${escapeHtml(String(tour.openScheduleCount))} l?ch m?</span>` : ""}
            ${tour.reviewCount ? `<span class="chip">${escapeHtml(`${tour.reviewCount} review`)}</span>` : ""}
            ${tour.ratingAverage ? `<span class="chip">${escapeHtml(`${tour.ratingAverage}/5`)}</span>` : ""}
          </div>
        </div>
        <div class="admin-detail-hero-side">
          <button class="admin-inline-button" type="button" data-account-close-detail="true">Ðóng</button>
          <div class="admin-detail-actions">
            <a class="admin-inline-button is-primary" href="${routePath("checkout", { slug: tour.slug })}">Đặt tour</a>
          </div>
        </div>
      </section>
      ${renderAccountDetailStats([
        { label: "Giá t?", value: formatCurrency(tour.startingPrice || 0, tour.baseCurrency || "VND"), hint: "Giá m? bán th?p nh?t" },
        { label: "Th?i l??ng", value: tour.durationLabel || `${tour.durationDays || 0}N${tour.durationNights || 0}Ð`, hint: "Theo c?u hình tour" },
        { label: "Kh?i hành", value: nextSchedule?.departureDate ? formatShortDate(nextSchedule.departureDate) : "Chưa có l?ch", hint: nextSchedule?.meetingPoint || "L?ch t? DB" },
        { label: "H?y tour", value: tour.cancellationPolicy?.name || "Theo ?i?u ki?n", hint: tour.cancellationPolicy?.description || "Xem k? trước khi Đặt" }
      ])}
      <div class="admin-detail-body-grid">
        <div class="admin-detail-column">
          ${renderAccountDetailSection("Thông tin tour", "Nhắng di?m chính b?n c?n n?m tr??c khi ??t.", factGrid)}
          ${renderAccountDetailSection("L?ch trình n?i b?t", "Các ?i?m ??ng và ho?t ??ng chính.", renderAccountDetailRows(itineraryRows, "Chưa có l?ch trình", "Tour này chua có itinerary trong h? th?ng."))}
        </div>
        <div class="admin-detail-column">
          ${renderAccountDetailSection("D?ch v? bao g?m", "Nhắng ti?n ích dã có trong tour.", renderAccountDetailRows(noteRows, "Chưa có dữ liệu", "Tour này chua có danh sách ??ch v? bao g?m."))}
          ${renderAccountDetailSection("L?u ý thêm", "Nhắng ghi chú quan tr?ng tr??c chuyến di.", renderAccountDetailRows(extraRows, "Chưa có l?u ý", "Tour này chua có ghi chú v?n hành."))}
        </div>
      </div>
    </div>
  `;
}
function renderAccountDetailLayer(data) {
  if (!uiState.detailType || !uiState.detailId) return "";
  const content = uiState.detailType === "booking"
    ? renderAccountBookingDetail(getActiveBookingDetail(data))
    : renderAccountTourDetail(getActiveTourDetail(data));

  return `
    <div class="admin-detail-layer user-detail-layer">
      <button class="admin-detail-backdrop" type="button" data-account-close-detail="true" aria-label="\u0110\u00f3ng chi ti\u1ebft"></button>
      <aside class="admin-detail-drawer user-detail-drawer">${content}</aside>
    </div>
  `;
}

function getTicketPreview(ticket) {
  const latestMessage = ticket.messages?.[ticket.messages.length - 1];
  return latestMessage?.message || ticket.subject || "Chưa có n?i dung trao ??i.";
}

function getPageBadge(pageKey, data) {
  switch (pageKey) {
    case "bookings":
      return data.bookings.length;
    case "support":
      return getOpenTicketCount(data.tickets);
    case "wishlist":
      return data.wishlistTours.length;
    case "travelers":
      return data.savedTravelers.length;
    case "addresses":
      return data.addresses.length;
    case "notifications":
      return getUnreadNotificationCount(data.notifications);
    default:
      return 0;
  }
}

function matchesBookingFilter(booking, filter) {
  const departure = new Date(booking.snapshot_jsonb?.departure_date || booking.created_at).getTime();
  const now = Date.now();

  switch (filter) {
    case "upcoming":
      return departure >= now && !["cancelled", "completed", "expired"].includes(booking.booking_status);
    case "payment":
      return ["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status)
        && ["pending", "unpaid", "failed"].includes(booking.payment_status);
    case "completed":
      return booking.booking_status === "completed" || booking.payment_status === "paid";
    case "cancelled":
      return ["cancel_requested", "cancelled", "expired"].includes(booking.booking_status);
    default:
      return true;
  }
}

function getBookingFilterOptions(bookings) {
  return [
    { key: "all", label: "Tất cả", count: bookings.length },
    { key: "upcoming", label: "Sắp tới", count: bookings.filter((booking) => matchesBookingFilter(booking, "upcoming")).length },
    { key: "payment", label: "Chờ thanh toán", count: bookings.filter((booking) => matchesBookingFilter(booking, "payment")).length },
    { key: "completed", label: "Đã xong", count: bookings.filter((booking) => matchesBookingFilter(booking, "completed")).length },
    { key: "cancelled", label: "Hủy / hết hạn", count: bookings.filter((booking) => matchesBookingFilter(booking, "cancelled")).length }
  ];
}

function renderStatCard({ label, value, detail, icon, tone = "blue" }) {
  return `
    <article class="admin-stat-card is-${escapeHtml(tone)}">
      <div class="admin-stat-head">
        <span class="material-symbols-outlined admin-stat-icon is-${escapeHtml(tone)}">${escapeHtml(icon)}</span>
      </div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function renderQuickCard({ href, title, value, copy, icon }) {
  return `
    <a class="admin-quick-card" href="${escapeHtml(href)}">
      <div class="admin-quick-card-top">
        <span class="material-symbols-outlined admin-quick-icon">${escapeHtml(icon)}</span>
        <strong>${escapeHtml(String(value))}</strong>
      </div>
      <div class="admin-quick-card-copy">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(copy)}</p>
      </div>
    </a>
  `;
}

function renderBookingFilterBar(bookings, activeFilter) {
  return `
    <div class="user-filter-bar">
      ${getBookingFilterOptions(bookings).map((item) => `
        <button class="user-filter-pill ${item.key === activeFilter ? "is-active" : ""}" type="button" data-booking-filter="${escapeHtml(item.key)}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(item.count))}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderBookingItem(booking) {
  const bookingMedia = renderMediaFrame({
    src: getBookingCoverImage(booking),
    alt: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
    className: "user-booking-thumb",
    placeholderLabel: "?nh booking chua c�"
  });
  const totalGuests = Number(booking.adult_count || 0) + Number(booking.child_count || 0) + Number(booking.infant_count || 0);
  const ctaLabel = "Xem chi tiết";

  return `
    <article class="user-booking-item" data-search="${escapeHtml(`${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""} ${booking.contact_name || ""} ${booking.booking_code}`)}">
      ${bookingMedia}
      <div class="user-booking-copy">
        <div class="user-booking-top">
          <div>
            
            <h4>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</h4>
          </div>
          <div class="status-group">
            ${renderStatusPill(booking.booking_status)}
            ${renderStatusPill(booking.payment_status)}
          </div>
        </div>
        <p class="user-booking-meta"><span class="material-symbols-outlined">calendar_today</span>${escapeHtml(formatLongDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</p>
        <div class="user-booking-facts">
          <span><span class="material-symbols-outlined">group</span>${escapeHtml(String(totalGuests || booking.travelers?.length || 0))} hành khách</span>
          <span><span class="material-symbols-outlined">location_on</span>${escapeHtml(booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "TourBook")}</span>
          <span><span class="material-symbols-outlined">support_agent</span>${escapeHtml(String(booking.tickets?.length || 0))} ticket</span>
        </div>
        <div class="user-booking-bottom">
          <strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</strong>
          <div class="inline-actions">
            <button class="button button-secondary" type="button" data-account-open-detail="booking" data-account-detail-id="${escapeHtml(booking.id)}">${escapeHtml(ctaLabel)}</button>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderTicketListItem(ticket, isActive = false) {
  const latestMessage = ticket.messages?.[ticket.messages.length - 1] || null;
  return `
    <button class="support-thread-item ${isActive ? "is-active" : ""}" type="button" data-ticket-select="${escapeHtml(ticket.id)}" data-search="${escapeHtml(`${ticket.subject || ""} ${ticket.bookingCode || ""}`)}">
      <div class="support-thread-main">
        <div>
          <strong>${escapeHtml(ticket.subject || "Ticket hỗ trợ")}</strong>
          <p>${escapeHtml(ticket.tour?.name || ticket.bookingCode || getTicketPreview(ticket))}</p>
        </div>
        <span class="support-thread-time">${escapeHtml(formatDateTime(latestMessage?.created_at || ticket.updated_at || ticket.created_at))}</span>
      </div>
      <div class="support-thread-meta">
        <span>${escapeHtml(ticket.assignedToName || "Ðang ch? x? lý")}</span>
      </div>
      <div class="support-thread-tags">
        ${renderStatusPill(ticket.status)}
        <span class="chip">${escapeHtml(ticket.priority || "normal")}</span>
      </div>
    </button>
  `;
}

function renderTicketWorkspace(ticket) {
  if (!ticket) {
    return `<article class="admin-panel user-panel support-chat-shell"><div class="empty-state"><h3>Chưa ch?n ticket</h3><p>Ch?n ticket ? c?t trái ?? xem h?i tho?i và phản hồi.</p></div></article>`;
  }

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const bookingLabel = ticket.tour?.name || (ticket.bookingCode ? `Booking ${ticket.bookingCode}` : "Không g?n booking");
  return `
    <article class="admin-panel user-panel support-chat-shell">
      <header class="support-chat-head">
        <div>
          <span class="eyebrow">Hỗ trợ khách hàng</span>
          <h2>${escapeHtml(ticket.subject || "Ticket hỗ trợ")}</h2>
          <p>${escapeHtml(bookingLabel)}</p>
        </div>
        <div class="support-chat-head-side">${renderStatusPill(ticket.status || "open")}</div>
      </header>
      <div class="support-chat-stream">
        ${messages.length
          ? messages.map((message) => `
            <article class="support-bubble is-${escapeHtml(message.sender_type || "customer")}">
              <div class="support-bubble-meta">
                <strong>${escapeHtml(message.senderName || message.sender_type || "Hệ thống")}</strong>
                <span>${escapeHtml(formatDateTime(message.created_at))}</span>
              </div>
              <p>${escapeHtml(message.message || message.message_text || "")}</p>
            </article>`).join("")
          : `<div class="empty-state"><h3>Chưa có hội thoại</h3><p>Ticket này chưa có tin nhắn nào.</p></div>`}
      </div>
      ${["resolved", "closed"].includes(ticket.status)
        ? `<div class="support-closed-note"><strong>Ticket đã đóng</strong><p>Nếu cần tiếp tục, hãy mở ticket mới hoặc chờ nhân viên cập nhật lại trạng thái.</p></div>`
        : `<form class="support-chat-composer ticket-reply-form" data-ticket-id="${escapeHtml(ticket.id)}"><label><span>Nhắn tiếp cho staff</span><textarea name="message" required placeholder="Nhập nội dung bạn muốn phản hồi..."></textarea></label><button class="button button-primary" type="submit">Gửi tin nhắn</button></form>`}
    </article>
  `;
}

function renderTicketCreatePanel(bookings) {
  if (!bookings.length) {
    return '<section class="support-create-card"><div class="empty-state"><h3>Chưa có booking để mở ticket</h3><p>Hãy đặt tour trước, sau đó ticket hỗ trợ sẽ gắn trực tiếp vào booking thực tế.</p></div></section>';
  }

  return `
    <section class="support-create-card">
      <div class="support-create-head">
        <div>
          <span class="eyebrow">New ticket</span>
          <h3>Tạo hỗ trợ mới</h3>
        </div>
      </div>
      <form id="ticket-create-form" class="user-data-form user-ticket-create-form">
        <div class="user-form-grid">
          <label>Booking liên quan
            <select name="bookingId" required>
              <option value="">Chọn booking cần hỗ trợ</option>
              ${bookings.map((booking) => `<option value="${escapeHtml(booking.id)}">${escapeHtml(booking.booking_code)} • ${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</option>`).join("")}
            </select>
          </label>
          <label class="user-form-span-2">Tiêu đề<input name="subject" required placeholder="Ví dụ: Cần đổi lịch khởi hành" /></label>
          <label class="user-form-span-2">Nội dung<textarea name="message" required placeholder="Mô tả chi tiết vấn đề bạn cần hỗ trợ..."></textarea></label>
        </div>
        <button class="button button-primary" type="submit">Tạo ticket hỗ trợ</button>
      </form>
    </section>
  `;
}

function renderWishlistCard(tour) {
  return `
    <article class="user-wishlist-card" data-search="${escapeHtml(`${tour.name} ${tour.destinationLabel}`)}">
      <div class="user-wishlist-media">
        ${renderMediaFrame({
          src: tour.coverImage,
          alt: tour.name,
          className: "user-wishlist-image",
          placeholderLabel: "?nh tour chua c�"
        })}
        <button class="user-wishlist-remove material-symbols-outlined" type="button" data-wishlist-tour-id="${escapeHtml(tour.id)}" aria-label="Bỏ khỏi wishlist">favorite</button>
      </div>
      <div class="user-wishlist-copy">
        <span class="eyebrow">${escapeHtml(tour.destinationLabel)}</span>
        <h4>${escapeHtml(tour.name)}</h4>
        <p>${escapeHtml(tour.shortDescription || "Tour hiện đang mở bán trên hệ thống.")}</p>
        <div class="user-wishlist-bottom">
          <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency || "VND"))}</strong>
          <div class="inline-actions">
            <button class="button button-secondary" type="button" data-account-open-detail="tour" data-account-detail-id="${escapeHtml(tour.id)}">Xem tour</button>
            <a class="button button-primary" href="${routePath("checkout", { slug: tour.slug })}">Đặt tour</a>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderNotificationRow(notification) {
  return `
    <article class="user-notification-row ${notification.is_read ? "is-read" : "is-unread"}" data-search="${escapeHtml(`${notification.title} ${notification.content}`)}">
      <div class="user-notification-copy">
        <strong>${escapeHtml(notification.title)}</strong>
        <p>${escapeHtml(notification.content)}</p>
        <div class="user-notification-meta">
          <span>${escapeHtml(formatDateTime(notification.created_at))}</span>
          <span>${escapeHtml(notification.notification_type || "notification")}</span>
        </div>
      </div>
      <div class="user-notification-side">
        ${notification.is_read ? '<span class="chip">Đã đọc</span>' : `<button class="button button-secondary" type="button" data-notification-id="${escapeHtml(notification.id)}">Đánh dấu đã đọc</button>`}
      </div>
    </article>
  `;
}

function renderTravelerCard(traveler) {
  return `
    <article class="user-data-card" data-search="${escapeHtml(`${traveler.full_name || ""} ${traveler.nationality || ""} ${traveler.email || ""}`)}">
      <div class="user-data-head">
        <div>
          <strong>${escapeHtml(traveler.full_name)}</strong>
          <p>${escapeHtml(travelerTypeLabel(traveler.traveler_type))}</p>
        </div>
        <div class="inline-actions">
          <button class="button button-secondary" type="button" data-edit-traveler="${escapeHtml(traveler.id)}">Sửa</button>
          <button class="button button-danger" type="button" data-delete-traveler="${escapeHtml(traveler.id)}">Xóa</button>
        </div>
      </div>
      <div class="user-data-list">
        <span><small>Quốc tịch</small><strong>${escapeHtml(traveler.nationality || "\u0110ang c\u1eadp nh\u1eadt")}</strong></span>
        <span><small>Email</small><strong>${escapeHtml(traveler.email || "\u0110ang c\u1eadp nh\u1eadt")}</strong></span>
        <span><small>Passport</small><strong>${escapeHtml(traveler.passport_number || traveler.id_number || "Chưa có")}</strong></span>
      </div>
      ${traveler.notes ? `<p class="user-data-note">${escapeHtml(traveler.notes)}</p>` : ""}
    </article>
  `;
}

function renderAddressCard(address) {
  return `
    <article class="user-data-card" data-search="${escapeHtml(`${address.label || ""} ${address.full_name || ""} ${address.address_line || ""}`)}">
      <div class="user-data-head">
        <div>
          <strong>${escapeHtml(address.label || "Địa chỉ")}</strong>
          <p>${escapeHtml(address.full_name)}${address.is_default ? " ? M?c định" : ""}</p>
        </div>
        <div class="inline-actions">
          <button class="button button-secondary" type="button" data-edit-address="${escapeHtml(address.id)}">Sửa</button>
          <button class="button button-danger" type="button" data-delete-address="${escapeHtml(address.id)}">Xóa</button>
        </div>
      </div>
      <div class="user-data-list">
        <span><small>Số điện thoại</small><strong>${escapeHtml(address.phone)}</strong></span>
        <span><small>Khu vực</small><strong>${escapeHtml([address.ward, address.district, address.province].filter(Boolean).join(", ") || "\u0110ang c\u1eadp nh\u1eadt")}</strong></span>
        <span><small>Quốc gia</small><strong>${escapeHtml(address.country_code || "VN")}</strong></span>
      </div>
      <p class="user-data-note">${escapeHtml(address.address_line)}</p>
    </article>
  `;
}

function selectedAttr(value, expected) {
  return String(value || "") === String(expected || "") ? " selected" : "";
}

function renderTravelerForm(traveler) {
  return `
    <form id="traveler-form" class="user-data-form">
      <input type="hidden" name="travelerId" value="${escapeHtml(traveler?.id || "")}" />
      <div class="user-form-grid">
        <label>Họ và tên<input name="fullName" value="${escapeHtml(traveler?.full_name || "")}" required /></label>
        <label>Loại hành khách
          <select name="travelerType">
            <option value="adult"${selectedAttr(traveler?.traveler_type, "adult")}>Người lớn</option>
            <option value="child"${selectedAttr(traveler?.traveler_type, "child")}>Trẻ em</option>
            <option value="infant"${selectedAttr(traveler?.traveler_type, "infant")}>Em bé</option>
          </select>
        </label>
        <label>Số điện thoại<input name="phone" value="${escapeHtml(traveler?.phone || "")}" /></label>
        <label>Email<input name="email" type="email" value="${escapeHtml(traveler?.email || "")}" /></label>
        <label>Ngày sinh<input name="dateOfBirth" type="date" value="${escapeHtml(traveler?.date_of_birth || "")}" /></label>
        <label>Giới tính
          <select name="gender">
            <option value="">Ch?n gi?i t�nh</option>
            <option value="male"${selectedAttr(traveler?.gender, "male")}>Nam</option>
            <option value="female"${selectedAttr(traveler?.gender, "female")}>N?</option>
            <option value="other"${selectedAttr(traveler?.gender, "other")}>Kh�c</option>
          </select>
        </label>
        <label>Quốc tịch<input name="nationality" value="${escapeHtml(traveler?.nationality || "")}" /></label>
        <label>CCCD / ID<input name="idNumber" value="${escapeHtml(traveler?.id_number || "")}" /></label>
        <label>Passport<input name="passportNumber" value="${escapeHtml(traveler?.passport_number || "")}" /></label>
        <label class="user-form-span-2">Ghi chú<textarea name="notes">${escapeHtml(traveler?.notes || "")}</textarea></label>
      </div>
      <div class="inline-actions">
        <button class="button button-primary" type="submit">${traveler ? "Cập nhật hành khách" : "Thêm hành khách"}</button>
        ${traveler ? '<button class="button button-secondary" type="button" data-cancel-traveler-edit="true">H?y s?a</button>' : ""}
      </div>
    </form>
  `;
}

function renderAddressForm(address) {
  return `
    <form id="address-form" class="user-data-form">
      <input type="hidden" name="addressId" value="${escapeHtml(address?.id || "")}" />
      <div class="user-form-grid">
        <label>Nhắn Địa chỉ<input name="label" value="${escapeHtml(address?.label || "")}" /></label>
        <label>Họ và tên<input name="fullName" value="${escapeHtml(address?.full_name || "")}" required /></label>
        <label>Số điện thoại<input name="phone" value="${escapeHtml(address?.phone || "")}" required /></label>
        <label>Quốc gia<input name="countryCode" value="${escapeHtml(address?.country_code || "VN")}" /></label>
        <label class="user-form-span-2">Địa chỉ chi tiết<textarea name="addressLine" required>${escapeHtml(address?.address_line || "")}</textarea></label>
        <label>Tỉnh / Thành<input name="province" value="${escapeHtml(address?.province || "")}" /></label>
        <label>Quận / Huyện<input name="district" value="${escapeHtml(address?.district || "")}" /></label>
        <label>Phường / Xã<input name="ward" value="${escapeHtml(address?.ward || "")}" /></label>
        <label>Mã bưu chính<input name="postalCode" value="${escapeHtml(address?.postal_code || "")}" /></label>
        <label class="user-checkbox"><input name="isDefault" type="checkbox" ${address?.is_default ? "checked" : ""} />Đặt l?m Địa chỉ m?c định</label>
      </div>
      <div class="inline-actions">
        <button class="button button-primary" type="submit">${address ? "Cập nhật Địa chỉ" : "Thêm Địa chỉ"}</button>
        ${address ? '<button class="button button-secondary" type="button" data-cancel-address-edit="true">H?y s?a</button>' : ""}
      </div>
    </form>
  `;
}

function renderMetricsPanel(data) {
  return `
    <article class="admin-panel user-panel">
      <div class="portal-section-head">
        <div><h2>Ch? s? t?i kho?n</h2></div>
      </div>
      <div class="user-meta-grid">
        <article class="user-meta-item"><span>Booking</span><strong>${escapeHtml(String(data.bookings.length))}</strong><p>Tổng booking đang theo dõi trong DB.</p></article>
        <article class="user-meta-item"><span>Tickets</span><strong>${escapeHtml(String(data.tickets.length))}</strong><p>Tất cả yêu cầu hỗ trợ của tài khoản này.</p></article>
        <article class="user-meta-item"><span>Wishlist</span><strong>${escapeHtml(String(data.wishlistTours.length))}</strong><p>Tour Đã lưu ?? quay lỗi sau.</p></article>
        <article class="user-meta-item"><span>Thông báo</span><strong>${escapeHtml(String(data.notifications.length))}</strong><p>Thông báo vận hành gửi đến tài khoản của bạn.</p></article>
      </div>
    </article>
  `;
}

function renderBookingCompactRow(booking) {
  const totalGuests = Number(booking.adult_count || 0) + Number(booking.child_count || 0) + Number(booking.infant_count || 0);
  return `
    <article class="user-booking-table-row" data-search="${escapeHtml(`${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""} ${booking.contact_name || ""} ${booking.booking_code}`)}">
      <div class="user-booking-table-tour">
        ${renderMediaFrame({
          src: getBookingCoverImage(booking),
          alt: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
          className: "user-booking-table-thumb",
          placeholderLabel: "?nh booking chua c�"
        })}
        <div>
          <strong>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</strong>
          <span>${escapeHtml(booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "TourBook")}</span>
        </div>
      </div>
      <div class="user-booking-table-col">
        <small>Kh?i hành</small>
        <strong>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</strong>
      </div>
      <div class="user-booking-table-col">
        <small>Hành khách</small>
        <strong>${escapeHtml(String(totalGuests || booking.travelers?.length || 0))}</strong>
      </div>
      <div class="user-booking-table-col user-booking-table-status">
        ${renderStatusPill(booking.booking_status)}
        ${renderStatusPill(booking.payment_status)}
      </div>
      <div class="user-booking-table-col">
        <small>T?ng ti?n</small>
        <strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</strong>
      </div>
      <div class="user-booking-table-actions">
        <button class="button button-secondary" type="button" data-account-open-detail="booking" data-account-detail-id="${escapeHtml(booking.id)}">Xem chi tiết</button>
      </div>
    </article>
  `;
}

function renderBookingListMarkup(bookings, state, { condensed = false } = {}) {
  const filtered = condensed ? bookings.slice(0, 4) : bookings.filter((booking) => matchesBookingFilter(booking, state.bookingFilter));
  if (!filtered.length) {
    return condensed
      ? '<div class="empty-state"><h3>Chưa có booking g?n dây</h3><p>Các booking mới s? xuất hiện t?i dây ?? b?n theo dõi nhanh.</p></div>'
      : '<div class="empty-state"><h3>Không có booking phù h?p</h3><p>Th? ??i b? l?c ho?c t?o booking mới t? danh sách tour.</p></div>';
  }
  return condensed
    ? `<div class="user-booking-table">${filtered.map((booking) => renderBookingCompactRow(booking)).join("")}</div>`
    : filtered.map((booking) => renderBookingItem(booking)).join("");
}

function refreshBookingPanel(root) {
  if (!root || !latestData) return;
  const panel = qs('[data-bookings-panel="full"]', root);
  if (!panel) return;
  const filterRegion = qs('[data-booking-filter-region]', panel);
  const listRegion = qs('[data-booking-list]', panel);
  if (filterRegion) filterRegion.innerHTML = renderBookingFilterBar(latestData.bookings, uiState.bookingFilter);
  if (listRegion) listRegion.innerHTML = renderBookingListMarkup(latestData.bookings, uiState, { condensed: false });
  applyAccountSearchVisibility(root);
}

function renderBookingsPanel(bookings, state, { condensed = false } = {}) {
  return `
    <article class="admin-panel user-panel" data-bookings-panel="${condensed ? "condensed" : "full"}">
      <div class="portal-section-head">
        <div><h2>${condensed ? "Booking g?n dây" : "Booking của tôi"}</h2></div>
        ${condensed ? `<a class="text-link" href="${routePath("account-bookings")}">Xem t?t c?</a>` : `<a class="text-link" href="${routePath("tours")}">Ð?t thêm tour</a>`}
      </div>
      ${condensed ? "" : `<div data-booking-filter-region>${renderBookingFilterBar(bookings, uiState.bookingFilter)}</div>`}
      <div class="${condensed ? "user-booking-table-wrap" : "user-booking-list"}" data-booking-list>
        ${renderBookingListMarkup(bookings, state, { condensed })}
      </div>
    </article>
  `;
}

function renderSupportPanel(data, { condensed = false } = {}) {
  const activeTicket = getActiveTicket(data.tickets);
  if (condensed) {
    const tickets = data.tickets.slice(0, 4);
    return `
      <article class="admin-panel user-panel">
        <div class="portal-section-head">
          <div><h2>Hỗ trợ gần đây</h2></div>
          <a class="text-link" href="${routePath("account-support")}">M? trung t�m h? tr?</a>
        </div>
        <div class="support-thread-list">
          ${tickets.length
            ? tickets.map((ticket) => renderTicketListItem(ticket, false)).join("")
            : '<div class="empty-state"><h3>Chưa có ticket hỗ trợ</h3><p>Khi bạn gửi yêu cầu mới, ticket sẽ xuất hiện tại đây.</p></div>'}
        </div>
      </article>
    `;
  }

  return `
    <article class="admin-panel user-panel">
      <div class="portal-section-head">
        <div><h2>Trung tâm hỗ trợ</h2></div>
      </div>
      <div class="support-messenger-layout">
        <aside class="support-sidebar-column">
          ${renderTicketCreatePanel(data.bookings)}
          <section class="support-thread-list-shell">
            <div class="support-thread-list-head">
              <div>
                <span class="eyebrow">Inbox</span>
                <strong>Cu?c tr? chuyến</strong>
              </div>
              <span class="chip">${escapeHtml(String(data.tickets.length))} ticket</span>
            </div>
            <div class="support-thread-list">
              ${data.tickets.length
                ? data.tickets.map((ticket) => renderTicketListItem(ticket, String(ticket.id) === String(activeTicket?.id))).join("")
                : '<div class="empty-state"><h3>Chưa có ticket hỗ trợ</h3><p>Ticket mới sẽ xuất hiện tại đây sau khi bạn gửi yêu cầu.</p></div>'}
            </div>
          </section>
        </aside>
        <div class="support-chat-column">${renderTicketWorkspace(activeTicket)}</div>
      </div>
    </article>
  `;
}

function renderWishlistPanel(tours, { condensed = false } = {}) {
  const list = condensed ? tours.slice(0, 4) : tours;
  return `
    <article class="admin-panel user-panel">
      <div class="portal-section-head">
        <div><h2>Wishlist</h2></div>
        ${condensed ? `<a class="text-link" href="${routePath("account-wishlist")}">Xem t?t c?</a>` : `<a class="text-link" href="${routePath("tours")}">Khám phá thêm</a>`}
      </div>
      <div class="user-wishlist-grid${condensed ? " is-condensed" : ""}">
        ${list.length
          ? list.map((tour) => renderWishlistCard(tour)).join("")
          : '<div class="empty-state"><h3>Wishlist Đang tr?ng</h3><p>Bỏn có th? l?u tour t? trang danh sách ho?c chi tiết tour ?? quay lỗi sau.</p></div>'}
      </div>
    </article>
  `;
}

function renderNotificationsPanel(notifications, { condensed = false } = {}) {
  const list = condensed ? notifications.slice(0, 4) : notifications;
  const unreadCount = getUnreadNotificationCount(notifications);
  return `
    <article class="admin-panel user-panel">
      <div class="portal-section-head">
        <div><h2>Thông báo</h2></div>
        ${!condensed && unreadCount ? '<button class="button button-secondary" type="button" data-mark-all-notifications="true">Đánh dấu đã đọc t?t c?</button>' : condensed ? `<a class="text-link" href="${routePath("account-notifications")}">Xem t?t c?</a>` : ""}
      </div>
      <div class="user-notification-list">
        ${list.length
          ? list.map((notification) => renderNotificationRow(notification)).join("")
          : '<div class="empty-state"><h3>Chưa có th?ng b?o</h3><p>Khi booking, payment, refund hoặc ticket có cập nhật, hệ thống sẽ tạo thông báo tại đây.</p></div>'}
      </div>
    </article>
  `;
}

function renderTravelersPage(data) {
  const editingTraveler = data.savedTravelers.find((traveler) => String(traveler.id) === String(uiState.editingTravelerId)) || null;
  return `
    <section class="admin-section-grid user-page-grid-two">
      <article class="admin-panel user-panel">
        <div class="portal-section-head"><div><h2>Danh sách hành khách</h2></div></div>
        <div class="user-data-list-grid">
          ${data.savedTravelers.length
            ? data.savedTravelers.map((traveler) => renderTravelerCard(traveler)).join("")
            : '<div class="empty-state"><h3>Ch\u01b0a c\u00f3 h\u00e0nh kh\u00e1ch lưu sẵn</h3><p>Bỏn c? th? l?u h? s? hành khách ngay b?n dưới.</p></div>'}
        </div>
      </article>
      <article class="admin-panel user-panel">
        <div class="portal-section-head"><div><h2>${editingTraveler ? "Cập nhật hành khách" : "Thêm hành khách"}</h2></div></div>
        <div class="user-form-card">${renderTravelerForm(editingTraveler)}</div>
      </article>
    </section>
  `;
}

function renderAddressesPage(data) {
  const editingAddress = data.addresses.find((address) => String(address.id) === String(uiState.editingAddressId)) || null;
  return `
    <section class="admin-section-grid user-page-grid-two">
      <article class="admin-panel user-panel">
        <div class="portal-section-head"><div><h2>Danh sách địa chỉ</h2></div></div>
        <div class="user-data-list-grid">
          ${data.addresses.length
            ? data.addresses.map((address) => renderAddressCard(address)).join("")
            : '<div class="empty-state"><h3>Chưa có Địa chỉ l?u</h3><p>Thêm địa chỉ để bộ phận điều hành có thể liên hệ nhanh hơn khi cần.</p></div>'}
        </div>
      </article>
      <article class="admin-panel user-panel">
        <div class="portal-section-head"><div><h2>${editingAddress ? "Cập nhật Địa chỉ" : "Thêm Địa chỉ"}</h2></div></div>
        <div class="user-form-card">${renderAddressForm(editingAddress)}</div>
      </article>
    </section>
  `;
}

function renderSettingsPage(auth, data) {
  const profile = data.profile || auth.profile || {};
  return `
    <section class="admin-section-grid user-page-grid-two">
      <article class="admin-panel user-panel">
        <div class="portal-section-head"><div><h2>Hồ sơ tài khoản</h2></div></div>
        <form id="profile-form" class="user-data-form">
          <div class="user-form-grid">
            <label>Email<input value="${escapeHtml(auth.user?.email || "")}" disabled /></label>
            <label>C?p th?nh vi?n<input value="${escapeHtml(profile.customer_level || "regular")}" disabled /></label>
            <label>Họ và tên<input name="fullName" value="${escapeHtml(profile.full_name || "")}" /></label>
            <label>Số điện thoại<input name="phone" value="${escapeHtml(profile.phone || "")}" /></label>
            <label>Avatar URL<input name="avatarUrl" value="${escapeHtml(profile.avatar_url || "")}" /></label>
            <label class="user-form-span-2">Địa chỉ h? s?<textarea name="address">${escapeHtml(profile.address || "")}</textarea></label>
          </div>
          <button class="button button-primary" type="submit">Cập nhật h? s?</button>
        </form>
      </article>
      ${renderMetricsPanel(data)}
    </section>
  `;
}

function renderDashboardPage(data) {
  const upcomingCount = getUpcomingCount(data.bookings);
  const openTicketCount = getOpenTicketCount(data.tickets);
  const unreadCount = getUnreadNotificationCount(data.notifications);
  const pendingPaymentCount = getPendingPaymentCount(data.bookings);

  return `
    <section class="admin-stats-grid admin-stats-grid-analytics user-summary-grid">
      ${renderStatCard({ label: "Chuyến đi sắp tới", value: upcomingCount, detail: "D?a trên l?ch kh?i hành chua hoàn t?t.", icon: "flight_takeoff", tone: "blue" })}
      ${renderStatCard({ label: "Ch? thanh toán", value: pendingPaymentCount, detail: "Nhắng booking c?n theo dõi ngay.", icon: "payments", tone: "orange" })}
      ${renderStatCard({ label: "Ticket đang mở", value: openTicketCount, detail: "Trao đổi với staff theo ticket thật.", icon: "support_agent", tone: "green" })}
      ${renderStatCard({ label: "Thông báo chua ??c", value: unreadCount, detail: `${data.wishlistTours.length} tour đang lưu trong wishlist.`, icon: "notifications", tone: "red" })}
    </section>
    <section class="user-dashboard-stack">
      ${renderBookingsPanel(data.bookings, uiState, { condensed: true })}
      ${renderSupportPanel(data, { condensed: true })}
      ${renderWishlistPanel(data.wishlistTours, { condensed: true })}
      ${renderNotificationsPanel(data.notifications, { condensed: true })}
    </section>
  `;
}
function renderPageBody(auth, currentPage, data) {
  const renderers = {
    dashboard: () => renderDashboardPage(data),
    bookings: () => renderBookingsPanel(data.bookings, uiState),
    support: () => renderSupportPanel(data),
    wishlist: () => renderWishlistPanel(data.wishlistTours),
    travelers: () => renderTravelersPage(data),
    addresses: () => renderAddressesPage(data),
    notifications: () => renderNotificationsPanel(data.notifications),
    settings: () => renderSettingsPage(auth, data)
  };

  return renderers[currentPage] ? renderers[currentPage]() : renderers.dashboard();
}

function buildMenuGroups(data) {
  return [
    {
      label: "Dashboard",
      items: ["dashboard", "bookings", "support", "wishlist"]
    },
    {
      label: "Hồ sơ",
      items: ["travelers", "addresses", "notifications", "settings"]
    }
  ].map((group) => ({
    ...group,
    items: group.items.map((pageKey) => ({
      pageKey,
      ...PAGE_DEFINITIONS[pageKey],
      badge: getPageBadge(pageKey, data)
    }))
  }));
}

function renderMenuGroups(currentPage, data) {
  return buildMenuGroups(data).map((group) => `
    <section class="admin-menu-group">
      <span class="admin-menu-label">${escapeHtml(group.label)}</span>
      <nav class="portal-side-menu">
        ${group.items.map((item) => `
          <a class="${item.pageKey === currentPage ? "is-active" : ""}" href="${routePath(item.routeKey)}">
            <span class="admin-menu-item-copy"><span class="material-symbols-outlined">${escapeHtml(item.icon)}</span><span>${escapeHtml(item.label)}</span></span>
            ${item.badge ? `<b class="admin-menu-badge">${escapeHtml(String(item.badge))}</b>` : ""}
          </a>
        `).join("")}
      </nav>
    </section>
  `).join("");
}

function renderSidebar(auth, currentPage, data) {
  const profile = data.profile || auth.profile || {};
  const name = profile.full_name || auth.user?.email || "Kh\u00e1ch h\u00e0ng";
  return `
    <aside class="portal-sidebar admin-portal-sidebar user-portal-sidebar">
      <a class="admin-sidebar-brand user-sidebar-brand" href="${routePath("account")}">
        <span class="admin-sidebar-brand-mark">TH</span>
        <span class="admin-sidebar-brand-copy"><strong>The Horizon</strong><span>Traveler Desk</span></span>
      </a>
      <div class="admin-sidebar-user">
        ${renderAvatar(profile, auth.user, "admin-sidebar-avatar")}
        <div>
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(profile.customer_level || "Kh\u00e1ch h\u00e0ng")}</span>
        </div>
      </div>
      <div class="admin-menu-groups">${renderMenuGroups(currentPage, data)}</div>
      <div class="admin-sidebar-footer">
        <a class="portal-side-action admin-side-home" href="${routePath("tours")}"><span class="material-symbols-outlined">travel_explore</span><span>Khám phá tour</span></a>
      </div>
    </aside>
  `;
}

function renderTopbar(auth, currentPage, data) {
  const page = getPageDefinition(currentPage);
  const profile = data.profile || auth.profile || {};
  const name = profile.full_name || auth.user?.email || "Khách hàng";
  return `
    <header class="portal-topbar admin-topbar user-topbar">
      <div class="admin-topbar-copy">
        <span>Traveler desk</span>
        <strong>${escapeHtml(page.label)}</strong>
      </div>
      <div class="admin-topbar-tools">
        <div class="portal-search-wrap admin-search-wrap">
          <span class="material-symbols-outlined">search</span>
          <input id="user-dashboard-search" type="search" placeholder="${escapeHtml(page.searchPlaceholder)}" value="${escapeHtml(uiState.searchQuery)}" />
        </div>
        <button class="portal-icon-button admin-logout-button" id="user-logout" type="button" aria-label="Ðang xu?t"><span class="material-symbols-outlined">logout</span></button>
        <div class="portal-profile-block admin-profile-block">
          <div class="portal-profile-copy">
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(profile.customer_level || "Khách hàng")}</span>
          </div>
          ${renderAvatar(profile, auth.user, "portal-avatar")}
        </div>
      </div>
    </header>
  `;
}
function renderPageIntro(currentPage, data) {
  const page = getPageDefinition(currentPage);
  const upcomingCount = getUpcomingCount(data.bookings);
  const openTicketCount = getOpenTicketCount(data.tickets);

  const introChips = (currentPage === "dashboard"
    ? [`${upcomingCount} chuyến sắp tới`, `${openTicketCount} ticket mở`]
    : [`${getPageBadge(currentPage, data) || 0} m?c liên quan`]).filter(Boolean).slice(0, 2);

  return `
    <section class="admin-page-intro ${currentPage === "dashboard" ? "is-dashboard" : ""}">
      <div class="admin-page-copy">
        <span class="admin-page-date">Traveler desk</span>
        <h1>${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.description || "Theo dõi h? s?, booking và h? tr? của b?n.")}</p>
      </div>
      <div class="admin-page-actions">
        ${currentPage === "dashboard"
          ? `<a class="admin-primary-cta" href="${routePath("tours")}"><span class="material-symbols-outlined">flight_takeoff</span><span>Đặt tour mới</span></a>`
          : ""}
        ${introChips.length ? `<div class="admin-chip-list">${introChips.map((chip) => `<span class="admin-soft-pill">${escapeHtml(chip)}</span>`).join("")}</div>` : ""}
      </div>
    </section>
  `;
}
function renderAccountApp(auth, data, currentPage) {
  return `
    ${renderSidebar(auth, currentPage, data)}
    <main class="portal-main admin-portal-main user-portal-main">
      ${renderTopbar(auth, currentPage, data)}
      <div class="portal-content admin-portal-content user-portal-content">
        ${renderPageIntro(currentPage, data)}
        ${renderPageBody(auth, currentPage, data)}
      </div>
    </main>
    <nav class="portal-mobile-nav admin-mobile-nav">
      ${MOBILE_PAGES.map((pageKey) => {
        const page = PAGE_DEFINITIONS[pageKey];
        return `<a class="${pageKey === currentPage ? "is-active" : ""}" href="${routePath(page.routeKey)}"><span class="material-symbols-outlined">${escapeHtml(page.icon)}</span><span>${escapeHtml(page.label)}</span></a>`;
      }).join("")}
    </nav>
    ${renderAccountDetailLayer(data)}
  `;
}

function applyAccountSearchVisibility(root) {
  if (!root) return;
  const input = qs("#user-dashboard-search", root);
  const query = String(input?.value ?? uiState.searchQuery ?? "").trim().toLowerCase();
  Array.from(root.querySelectorAll("[data-search]"))
    .forEach((item) => {
      const haystack = String(item.dataset.search || "").toLowerCase();
      item.style.display = !query || haystack.includes(query) ? "" : "none";
    });
}

function bindSearch(root) {
  const input = qs("#user-dashboard-search", root);
  if (!input) return;
  input.value = uiState.searchQuery || "";
  input.addEventListener("input", () => {
    uiState.searchQuery = input.value;
    applyAccountSearchVisibility(root);
  });
  applyAccountSearchVisibility(root);
}

function bindFormIfPresent(form, handler) {
  if (!form) return;
  bindAsyncForm(form, handler);
}

function rerenderAccountView(root, auth, currentPage) {
  if (!latestData) return;
  root.innerHTML = normalizeRenderedHtml(renderAccountApp(auth, latestData, currentPage));
  normalizeUiTree(root);
  bindSearch(root);
  bindAccountForms(root, auth, currentPage);
}

async function renderAccountRoot(root, auth, currentPage) {
  latestData = await getAccountDashboard();
  syncActiveTicketState(latestData.tickets || []);
  syncActiveDetailState(latestData);
  rerenderAccountView(root, auth, currentPage);
}

function bindAccountForms(root, auth, currentPage) {
  bindFormIfPresent(qs("#profile-form", root), async (formData) => {
    await updateProfile({
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      avatarUrl: formData.get("avatarUrl"),
      address: formData.get("address")
    });
    showToast("Cập nhật h? s? thành công.", "success");
    await renderAccountRoot(root, auth, currentPage);
  });

  bindFormIfPresent(qs("#ticket-create-form", root), async (formData) => {
    const createdTicket = await createSupportTicket({
      bookingId: formData.get("bookingId"),
      subject: formData.get("subject"),
      message: formData.get("message")
    });
    uiState.activeTicketId = createdTicket?.id || uiState.activeTicketId;
    showToast("Đã tạo ticket hỗ trợ.", "success");
    await renderAccountRoot(root, auth, currentPage);
  });

  bindFormIfPresent(qs("#traveler-form", root), async (formData) => {
    await saveSavedTraveler({
      id: formData.get("travelerId"),
      fullName: formData.get("fullName"),
      travelerType: formData.get("travelerType"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      dateOfBirth: formData.get("dateOfBirth"),
      gender: formData.get("gender"),
      nationality: formData.get("nationality"),
      idNumber: formData.get("idNumber"),
      passportNumber: formData.get("passportNumber"),
      notes: formData.get("notes")
    });
    uiState.editingTravelerId = null;
    showToast("Đã lưu hành khách thành công.", "success");
    await renderAccountRoot(root, auth, currentPage);
  });

  bindFormIfPresent(qs("#address-form", root), async (formData) => {
    await saveUserAddress({
      id: formData.get("addressId"),
      label: formData.get("label"),
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      addressLine: formData.get("addressLine"),
      province: formData.get("province"),
      district: formData.get("district"),
      ward: formData.get("ward"),
      postalCode: formData.get("postalCode"),
      countryCode: formData.get("countryCode"),
      isDefault: formData.get("isDefault") === "on"
    });
    uiState.editingAddressId = null;
    showToast("Đã lưu Địa chỉ thành công.", "success");
    await renderAccountRoot(root, auth, currentPage);
  });

  Array.from(root.querySelectorAll(".ticket-reply-form")).forEach((form) => {
    bindAsyncForm(form, async (formData) => {
      await replySupportTicket({
        ticketId: form.dataset.ticketId,
        message: formData.get("message")
      });
      uiState.activeTicketId = form.dataset.ticketId || uiState.activeTicketId;
      showToast("Đã gửi phản hồi ticket.", "success");
      await renderAccountRoot(root, auth, currentPage);
    });
  });
}

async function init() {
  const root = qs("#account-app");
  const currentPage = getCurrentPageKey();
  setLoading(root, "Đang tải dashboard khách hàng...");

  const auth = await guardPage();
  if (!auth) return;

  root.addEventListener("click", async (event) => {
    const closeDetailButton = event.target.closest("[data-account-close-detail]");
    if (closeDetailButton) {
      closeAccountDetail();
      rerenderAccountView(root, auth, currentPage);
      return;
    }

    const openDetailButton = event.target.closest("[data-account-open-detail]");
    if (openDetailButton) {
      openAccountDetail(openDetailButton.dataset.accountOpenDetail, openDetailButton.dataset.accountDetailId);
      rerenderAccountView(root, auth, currentPage);
      return;
    }

    const logoutButton = event.target.closest("#user-logout");
    if (logoutButton) {
      await signOut();
      showToast("?? Ðang xu?t kh?i h? th?ng.", "success");
      window.location.href = routePath("home");
      return;
    }

    const filterButton = event.target.closest("[data-booking-filter]");
    if (filterButton) {
      uiState.bookingFilter = filterButton.dataset.bookingFilter || "all";
      if (latestData) {
        if (currentPage === "bookings") {
          refreshBookingPanel(root);
        } else {
          rerenderAccountView(root, auth, currentPage);
        }
      }
      return;
    }

    const ticketSelectButton = event.target.closest("[data-ticket-select]");
    if (ticketSelectButton) {
      uiState.activeTicketId = ticketSelectButton.dataset.ticketSelect || null;
      if (latestData) {
        rerenderAccountView(root, auth, currentPage);
      }
      return;
    }

    const wishlistButton = event.target.closest("[data-wishlist-tour-id]");
    if (wishlistButton) {
      try {
        await toggleWishlist(wishlistButton.dataset.wishlistTourId);
        showToast("Đã cập nhật wishlist.", "success");
        await renderAccountRoot(root, auth, currentPage);
      } catch (error) {
        showToast(error.message || "Không thể cập nhật wishlist.", "error");
      }
      return;
    }

    const notificationButton = event.target.closest("[data-notification-id]");
    if (notificationButton) {
      try {
        await markNotificationRead(notificationButton.dataset.notificationId);
        showToast("Đã đánh dấu th?ng b?o l? Đã đọc.", "success");
        await renderAccountRoot(root, auth, currentPage);
      } catch (error) {
        showToast(error.message || "Không thể cập nhật th?ng b?o.", "error");
      }
      return;
    }

    const markAllButton = event.target.closest("[data-mark-all-notifications]");
    if (markAllButton) {
      try {
        await markNotificationRead({ all: true });
        showToast("Đã đánh dấu t?t c? th?ng b?o l? Đã đọc.", "success");
        await renderAccountRoot(root, auth, currentPage);
      } catch (error) {
        showToast(error.message || "Không thể cập nhật th?ng b?o.", "error");
      }
      return;
    }

    const editTravelerButton = event.target.closest("[data-edit-traveler]");
    if (editTravelerButton) {
      uiState.editingTravelerId = editTravelerButton.dataset.editTraveler;
      if (latestData) {
        rerenderAccountView(root, auth, currentPage);
      }
      return;
    }

    const cancelTravelerEditButton = event.target.closest("[data-cancel-traveler-edit]");
    if (cancelTravelerEditButton) {
      uiState.editingTravelerId = null;
      if (latestData) {
        rerenderAccountView(root, auth, currentPage);
      }
      return;
    }

    const deleteTravelerButton = event.target.closest("[data-delete-traveler]");
    if (deleteTravelerButton) {
      if (!window.confirm("Xóa hành khách lưu sẵn n?y?")) return;
      try {
        await deleteSavedTraveler(deleteTravelerButton.dataset.deleteTraveler);
        if (uiState.editingTravelerId === deleteTravelerButton.dataset.deleteTraveler) {
          uiState.editingTravelerId = null;
        }
        showToast("Đã xóa hành khách lưu sẵn.", "success");
        await renderAccountRoot(root, auth, currentPage);
      } catch (error) {
        showToast(error.message || "Không thể xóa hành khách.", "error");
      }
      return;
    }

    const editAddressButton = event.target.closest("[data-edit-address]");
    if (editAddressButton) {
      uiState.editingAddressId = editAddressButton.dataset.editAddress;
      if (latestData) {
        rerenderAccountView(root, auth, currentPage);
      }
      return;
    }

    const cancelAddressEditButton = event.target.closest("[data-cancel-address-edit]");
    if (cancelAddressEditButton) {
      uiState.editingAddressId = null;
      if (latestData) {
        rerenderAccountView(root, auth, currentPage);
      }
      return;
    }

    const deleteAddressButton = event.target.closest("[data-delete-address]");
    if (deleteAddressButton) {
      if (!window.confirm("Xóa Địa chỉ Đã lưu n?y?")) return;
      try {
        await deleteUserAddress(deleteAddressButton.dataset.deleteAddress);
        if (uiState.editingAddressId === deleteAddressButton.dataset.deleteAddress) {
          uiState.editingAddressId = null;
        }
        showToast("Đã xóa Địa chỉ Đã lưu.", "success");
        await renderAccountRoot(root, auth, currentPage);
      } catch (error) {
        showToast(error.message || "Không thể xóa Địa chỉ.", "error");
      }
    }
  });

  try {
    await renderAccountRoot(root, auth, currentPage);
  } catch (error) {
    root.innerHTML = normalizeRenderedHtml(`<div class="empty-state"><h3>Không thể tải dashboard khách hàng</h3><p>${escapeHtml(error.message || "Đã có lỗi xảy ra.")}</p></div>`);
  }
}

void init();





















