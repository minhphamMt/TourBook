import { getAccountDashboard, getHomepageData, signOut } from "./api.js";
import { routePath } from "./routes.js";
import {
  bindAsyncForm,
  escapeHtml,
  formatCurrency,
  formatShortDate,
  guardPage,
  qs,
  setLoading,
  showToast
} from "./shared.js";

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

function getUpcomingCount(bookings) {
  const now = Date.now();
  return bookings.filter((booking) => {
    const departure = new Date(booking.snapshot_jsonb?.departure_date || booking.created_at).getTime();
    return departure >= now && !["cancelled", "completed"].includes(booking.booking_status);
  }).length;
}

function getCompletedCount(bookings) {
  return bookings.filter((booking) => booking.payment_status === "paid" || booking.booking_status === "completed").length;
}

function getPendingCount(bookings) {
  return bookings.filter((booking) => ["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status)).length;
}

function renderSummaryCard(tone, label, value, hint, icon) {
  return `
    <article class="user-summary-card user-summary-card-${tone}">
      <div class="user-summary-icon material-symbols-outlined">${icon}</div>
      <div class="user-summary-copy">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(String(value).padStart(2, "0"))}</strong>
        <p>${escapeHtml(hint)}</p>
      </div>
    </article>
  `;
}

function renderBookingItem(booking) {
  const href = routePath("booking-detail", { code: booking.booking_code });
  const toneClass = booking.payment_status === "paid" ? "is-paid" : booking.booking_status === "awaiting_payment" || booking.payment_status === "pending" ? "is-pending" : "is-neutral";
  const toneLabel = booking.payment_status === "paid" ? "Đã thanh toán" : booking.booking_status === "awaiting_payment" || booking.payment_status === "pending" ? "Đang chờ" : "Đang xử lý";
  const image = booking.tour?.coverImage || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80";

  return `
    <article class="user-booking-item" data-search="${escapeHtml(`${booking.tour?.name || ""} ${booking.contact_name || ""} ${booking.booking_code}`)}">
      <img class="user-booking-thumb" src="${escapeHtml(image)}" alt="${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}" />
      <div class="user-booking-copy">
        <div class="user-booking-top">
          <h4>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking")}</h4>
          <span class="user-booking-badge ${toneClass}">${escapeHtml(toneLabel)}</span>
        </div>
        <p class="user-booking-meta">
          <span class="material-symbols-outlined">calendar_today</span>
          ${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))} • ${escapeHtml(booking.tour?.durationLabel || "Lịch linh hoạt")}
        </p>
        <div class="user-booking-bottom">
          <strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency))}</strong>
          <a href="${href}">${booking.payment_status === "paid" ? "Chi tiết" : "Thanh toán ngay"}</a>
        </div>
      </div>
    </article>
  `;
}

function renderSuggestionCard(tour) {
  return `
    <article class="user-suggestion-card" data-search="${escapeHtml(`${tour.name} ${tour.destinationLabel}`)}">
      <div class="user-suggestion-media">
        <img src="${escapeHtml(tour.coverImage)}" alt="${escapeHtml(tour.name)}" />
        <span class="user-suggestion-flag">Mùa đẹp</span>
        <a class="user-suggestion-fav material-symbols-outlined" href="${routePath("tour-detail", { slug: tour.slug })}">favorite</a>
      </div>
      <div class="user-suggestion-copy">
        <p class="user-suggestion-location"><span class="material-symbols-outlined">location_on</span>${escapeHtml(tour.destinationLabel)}</p>
        <h4>${escapeHtml(tour.name)}</h4>
        <div class="user-suggestion-bottom">
          <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
          <span><span class="material-symbols-outlined">star</span>${escapeHtml(String(Number(tour.ratingAverage || 0).toFixed(1)))}</span>
        </div>
      </div>
    </article>
  `;
}

function renderUserDashboard(auth, data, suggestions) {
  const name = auth.profile?.full_name || auth.user?.email || "Khách hàng";
  const upcomingCount = getUpcomingCount(data.bookings);
  const completedCount = getCompletedCount(data.bookings);
  const pendingCount = getPendingCount(data.bookings);
  const recentBookings = data.bookings.slice(0, 4);
  const suggestionItems = suggestions.slice(0, 2);

  return `
    <aside class="portal-sidebar user-portal-sidebar">
      <div class="portal-brand-block">
        <a class="portal-brand" href="${routePath("account")}">
          <span class="portal-brand-icon material-symbols-outlined">landscape</span>
          <div>
            <strong>The Horizon</strong>
            <span>Explorer Portal</span>
          </div>
        </a>
      </div>
      <nav class="portal-side-menu">
        <a class="is-active" href="#user-overview"><span class="material-symbols-outlined">dashboard</span><span>Dashboard</span></a>
        <a href="#user-suggestions"><span class="material-symbols-outlined">explore</span><span>Tours</span></a>
        <a href="#user-bookings"><span class="material-symbols-outlined">event_available</span><span>Bookings</span></a>
        <a href="#user-settings"><span class="material-symbols-outlined">settings</span><span>Settings</span></a>
      </nav>
      <a class="portal-side-action" href="${routePath("tours")}">
        <span class="material-symbols-outlined">add</span>
        <span>Plan New Trip</span>
      </a>
    </aside>

    <main class="portal-main user-portal-main">
      <header class="portal-topbar">
        <div class="portal-search-wrap">
          <span class="material-symbols-outlined">search</span>
          <input id="user-dashboard-search" type="search" placeholder="Tìm kiếm chuyến đi, điểm đến..." />
        </div>
        <div class="portal-topbar-actions">
          <button class="portal-icon-button" type="button" aria-label="Thông báo">
            <span class="material-symbols-outlined">notifications</span>
            ${data.notifications.length ? '<span class="portal-dot"></span>' : ""}
          </button>
          <button class="portal-icon-button" type="button" aria-label="Hỗ trợ">
            <span class="material-symbols-outlined">help_outline</span>
          </button>
          <button class="portal-icon-button" id="user-logout" type="button" aria-label="Đăng xuất">
            <span class="material-symbols-outlined">logout</span>
          </button>
          <div class="portal-profile-block">
            <div class="portal-profile-copy">
              <strong>${escapeHtml(name)}</strong>
              <span>Explorer Gold</span>
            </div>
            ${renderAvatar(auth.profile, auth.user, "portal-avatar")}
          </div>
        </div>
      </header>

      <div class="portal-content user-portal-content">
        <section class="portal-welcome" id="user-overview">
          <h1>Chào mừng trở lại, ${escapeHtml(name)}</h1>
          <p>Bạn đã sẵn sàng cho chuyến phiêu lưu tiếp theo chưa?</p>
        </section>

        <section class="user-summary-grid">
          ${renderSummaryCard("primary", "Chuyến đi sắp tới", upcomingCount, `Sắp khởi hành: ${recentBookings[0] ? formatShortDate(recentBookings[0].snapshot_jsonb?.departure_date || recentBookings[0].created_at) : "Đang cập nhật"}`, "flight_takeoff")}
          ${renderSummaryCard("light", "Đơn hàng đã xong", completedCount, `+${completedCount} đơn hoàn tất`, "task_alt")}
          ${renderSummaryCard("accent", "Mục cần theo dõi", pendingCount, "Các booking đang chờ xử lý", "confirmation_number")}
        </section>

        <section class="user-main-grid">
          <div class="user-bookings-panel" id="user-bookings">
            <div class="portal-section-head">
              <h2>Các tour đã đặt gần đây</h2>
              <a href="#user-settings">Xem lịch sử</a>
            </div>
            <div class="user-booking-list">
              ${recentBookings.length ? recentBookings.map((booking) => renderBookingItem(booking)).join("") : '<div class="empty-state"><h3>Chưa có booking</h3><p>Bạn có thể bắt đầu từ danh sách tour để tạo chuyến đi đầu tiên.</p></div>'}
            </div>
          </div>

          <aside class="user-side-panel" id="user-suggestions">
            <div class="portal-section-head">
              <h2>Gợi ý tour mới</h2>
            </div>
            <div class="user-suggestion-list">
              ${suggestionItems.length ? suggestionItems.map((tour) => renderSuggestionCard(tour)).join("") : '<div class="empty-state"><h3>Chưa có gợi ý</h3><p>Dữ liệu tour nổi bật sẽ hiển thị tại đây.</p></div>'}
            </div>
            <article class="user-offer-card">
              <span class="material-symbols-outlined">workspace_premium</span>
              <h3>Ưu đãi độc quyền cho Explorer Gold</h3>
              <p>Giảm ngay 15% cho các tour quốc tế nổi bật và ưu tiên lịch khởi hành đẹp trong tháng này.</p>
              <a href="${routePath("tours")}">Nhận ưu đãi ngay</a>
            </article>
          </aside>
        </section>

        <section class="user-secondary-grid">
          <article class="user-notify-card" id="user-notifications">
            <div class="portal-section-head">
              <h2>Thông báo gần đây</h2>
            </div>
            <div class="portal-timeline-list">
              ${data.notifications.length
                ? data.notifications.slice(0, 4).map((notification) => `
                    <div class="portal-timeline-item">
                      <span class="portal-timeline-dot"></span>
                      <div>
                        <strong>${escapeHtml(notification.title)}</strong>
                        <p>${escapeHtml(notification.content)}</p>
                      </div>
                    </div>
                  `).join("")
                : '<div class="empty-state"><h3>Chưa có thông báo</h3><p>Các cập nhật booking mới sẽ xuất hiện ở đây.</p></div>'}
            </div>
          </article>

          <article class="user-settings-card" id="user-settings">
            <div class="portal-section-head">
              <h2>Settings</h2>
            </div>
            <form id="profile-form" class="user-settings-form">
              <label>Họ và tên<input name="fullName" value="${escapeHtml(auth.profile?.full_name || "")}" /></label>
              <label>Số điện thoại<input name="phone" value="${escapeHtml(auth.profile?.phone || "")}" /></label>
              <label>Avatar URL<input name="avatarUrl" value="${escapeHtml(auth.profile?.avatar_url || "")}" /></label>
              <label>Địa chỉ<textarea name="address">${escapeHtml(auth.profile?.address || "")}</textarea></label>
              <button type="submit">Cập nhật hồ sơ</button>
            </form>
          </article>
        </section>
      </div>
    </main>

    <nav class="portal-mobile-nav">
      <a class="is-active" href="#user-overview"><span class="material-symbols-outlined">dashboard</span><span>Trang chủ</span></a>
      <a href="#user-suggestions"><span class="material-symbols-outlined">explore</span><span>Khám phá</span></a>
      <a href="#user-bookings"><span class="material-symbols-outlined">event_available</span><span>Đơn hàng</span></a>
      <a href="#user-settings"><span class="material-symbols-outlined">person</span><span>Hồ sơ</span></a>
    </nav>
    <a class="portal-mobile-fab material-symbols-outlined" href="${routePath("tours")}">add</a>
  `;
}

function bindMenuState(root) {
  const links = Array.from(root.querySelectorAll(".portal-side-menu a, .portal-mobile-nav a"));
  links.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.getAttribute("href");
      links.forEach((item) => item.classList.toggle("is-active", item.getAttribute("href") === target));
    });
  });
}

function bindSearch(root) {
  const input = qs("#user-dashboard-search", root);
  const items = Array.from(root.querySelectorAll("[data-search]"));
  if (!input) return;

  input.addEventListener("input", () => {
    const query = input.value.trim().toLowerCase();
    items.forEach((item) => {
      const haystack = item.dataset.search.toLowerCase();
      item.style.display = !query || haystack.includes(query) ? "" : "none";
    });
  });
}

async function init() {
  const root = qs("#account-app");
  setLoading(root, "Đang tải dashboard...");

  const auth = await guardPage();
  if (!auth) return;

  try {
    const [data, homepage] = await Promise.all([getAccountDashboard(), getHomepageData()]);
    const bookedTourIds = new Set(data.bookings.map((booking) => booking.tour_id));
    const suggestions = homepage.featuredTours.filter((tour) => !bookedTourIds.has(tour.id));

    root.innerHTML = renderUserDashboard(auth, data, suggestions.length ? suggestions : homepage.featuredTours);
    bindMenuState(root);
    bindSearch(root);

    qs("#user-logout", root)?.addEventListener("click", async () => {
      await signOut();
      showToast("Đã đăng xuất khỏi hệ thống.", "success");
      window.location.href = routePath("home");
    });

    bindAsyncForm(qs("#profile-form", root), async (formData) => {
      const { updateProfile } = await import("./api.js");
      await updateProfile({
        fullName: formData.get("fullName"),
        phone: formData.get("phone"),
        avatarUrl: formData.get("avatarUrl"),
        address: formData.get("address")
      });
      showToast("Cập nhật hồ sơ thành công.", "success");
      window.location.reload();
    });
  } catch (error) {
    root.innerHTML = `<div class="empty-state"><h3>Không thể tải dashboard</h3><p>${escapeHtml(error.message || "Đã có lỗi xảy ra.")}</p></div>`;
  }
}

void init();
