import { formatCurrency, formatDateTime, formatShortDate, getAdminDashboard, signOut } from "./api.js";
import { escapeHtml, guardPage, qs, setLoading, showToast } from "./shared.js";
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
    group: "Overview",
    icon: "dashboard",
    label: "Dashboard",
    title: "Management dashboard",
    description: "Quick summary from bookings, payments, support tickets, activity logs and live catalog data.",
    searchPlaceholder: "Search booking, ticket, tour..."
  },
  reports: {
    routeKey: "admin-reports",
    group: "Overview",
    icon: "monitoring",
    label: "Reports",
    permission: "report.read",
    title: "Operations reports",
    description: "Revenue, refunds, regional booking mix and recent activity based on seeded database records.",
    searchPlaceholder: "Search booking, action log, tour..."
  },
  bookings: {
    routeKey: "admin-bookings",
    group: "Operations",
    icon: "assignment",
    label: "Bookings",
    permission: "booking.read_all",
    title: "Booking management",
    description: "Reads from public.bookings, booking_events, booking_travelers and invoices to track the full order lifecycle.",
    searchPlaceholder: "Search booking code, customer, tour..."
  },
  payments: {
    routeKey: "admin-payments",
    group: "Operations",
    icon: "payments",
    label: "Payments",
    permission: "payment.read_all",
    title: "Payments and refunds",
    description: "Tracks payment transactions, refunds and enabled payment methods using real management data.",
    searchPlaceholder: "Search transaction, payment method, booking..."
  },
  tours: {
    routeKey: "admin-tours",
    group: "Operations",
    icon: "travel_explore",
    label: "Tours",
    permission: "tour.read",
    title: "Tours and departures",
    description: "Uses seeded tours, departure_schedules, price tiers and destination data from Supabase.",
    searchPlaceholder: "Search tour, departure, destination..."
  },
  service: {
    routeKey: "admin-service",
    group: "Service",
    icon: "support_agent",
    label: "Service",
    permission: "ticket.manage",
    title: "Customer service",
    description: "Tracks support tickets, ticket messages, reviews and review replies in one place.",
    searchPlaceholder: "Search ticket, review, customer..."
  },
  customers: {
    routeKey: "admin-customers",
    group: "Service",
    icon: "groups_2",
    label: "Customers",
    permission: "user.read_all",
    title: "Customer insights",
    description: "Combines profiles, booking history and spend so staff can support and upsell with confidence.",
    searchPlaceholder: "Search customer, email, spend..."
  },
  promotions: {
    routeKey: "admin-promotions",
    group: "Service",
    icon: "sell",
    label: "Promotions",
    permission: "coupon.manage",
    title: "Coupons and promotions",
    description: "Shows coupons, coupon usages and real discount amounts from the seeded database.",
    searchPlaceholder: "Search coupon, usage, booking..."
  },
  users: {
    routeKey: "admin-users",
    group: "Admin",
    icon: "group",
    label: "Users",
    permission: "user.manage",
    title: "Users and roles",
    description: "Displays profiles, user_roles and roles to reflect the role model defined in schema.sql.",
    searchPlaceholder: "Search user, role, email..."
  },
  content: {
    routeKey: "admin-content",
    group: "Admin",
    icon: "campaign",
    label: "Content",
    permission: "banner.manage",
    title: "Banners and CMS",
    description: "Manages banner placements and CMS pages that power the public website.",
    searchPlaceholder: "Search banner, slug, content..."
  },
  settings: {
    routeKey: "admin-settings",
    group: "Admin",
    icon: "settings",
    label: "Settings",
    permission: "settings.manage",
    title: "System settings",
    description: "Snapshot of system_settings, payment_methods and current role structure.",
    searchPlaceholder: "Search setting key, payment method..."
  }
};

function formatStatus(status) {
  const map = {
    pending: "Pending",
    awaiting_payment: "Awaiting payment",
    confirmed: "Confirmed",
    completed: "Completed",
    cancel_requested: "Cancel requested",
    cancelled: "Cancelled",
    unpaid: "Unpaid",
    partially_paid: "Deposit paid",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    open: "Open",
    sold_out: "Sold out",
    closed: "Closed",
    hidden: "Hidden",
    approved: "Approved",
    in_progress: "In progress",
    resolved: "Resolved"
  };
  return map[status] || String(status || "Unknown");
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
  const map = {
    customer: "Customer",
    staff: "Staff",
    admin: "Admin",
    super_admin: "Super Admin"
  };
  return map[role] || String(role || "User");
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
  if (booking.booking_status === "cancelled") return { label: "Cancelled", tone: "danger" };
  if (booking.booking_status === "completed") return { label: "Completed", tone: "success" };
  if (booking.booking_status === "cancel_requested") return { label: "Cancel requested", tone: "danger" };
  if (["confirmed"].includes(booking.booking_status) || ["paid", "partially_paid"].includes(booking.payment_status)) {
    return { label: "Confirmed", tone: "success" };
  }
  return { label: "Pending", tone: "waiting" };
}

function getPaymentTone(payment) {
  if (payment.status === "paid") return { label: "Paid", tone: "success" };
  if (payment.status === "refunded") return { label: "Refunded", tone: "danger" };
  if (payment.status === "failed") return { label: "Failed", tone: "danger" };
  return { label: "Pending", tone: "waiting" };
}

function getReviewTone(review) {
  if (review.status === "approved") return { label: "Approved", tone: "success" };
  if (review.status === "hidden") return { label: "Hidden", tone: "danger" };
  return { label: formatStatus(review.status), tone: "waiting" };
}

function getTicketTone(ticket) {
  if (ticket.status === "resolved") return { label: "Resolved", tone: "success" };
  if (ticket.status === "closed") return { label: "Closed", tone: "danger" };
  return { label: formatStatus(ticket.status), tone: "waiting" };
}

function renderStatusTag(label, tone = "waiting") {
  return `<span class="admin-status-chip is-${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function renderStatCard({ icon, chip, chipTone = "success", label, value, hint }) {
  return `
    <article class="admin-stat-card">
      <div class="admin-stat-head">
        <span class="material-symbols-outlined">${icon}</span>
        <em class="${chipTone !== "success" ? `is-${chipTone}` : ""}">${escapeHtml(chip)}</em>
      </div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(hint)}</p>
    </article>
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
      image: booking.tour?.coverImage || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      price: booking.tour?.startingPrice || booking.total_amount || 0,
      currency: booking.currency || booking.tour?.baseCurrency || "VND",
      rating: booking.tour?.ratingAverage || Number(booking.review?.rating || 4.8),
      bookings: 0,
      destinationLabel: booking.tour?.destinationLabel || "Updating"
    };
    current.bookings += 1;
    groups.set(key, current);
  });
  const ranked = Array.from(groups.values()).sort((left, right) => right.bookings - left.bookings);
  if (ranked.length) return ranked.slice(0, 4);
  return tours.slice(0, 4).map((tour) => ({
    name: tour.name,
    image: tour.coverImage,
    price: tour.startingPrice,
    currency: tour.baseCurrency || "VND",
    rating: tour.ratingAverage || 0,
    bookings: 0,
    destinationLabel: tour.destinationLabel || "Updating"
  }));
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
      name: booking.contact_name || "Customer",
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
  const pages = getAccessiblePages(role);
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
        description: page.description,
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
  const accessiblePages = getAccessiblePages(auth.primaryRole);
  const actionPageKey = accessiblePages.find((pageKey) => pageKey !== currentPage && pageKey !== "dashboard") || "dashboard";
  const actionPage = PAGE_DEFINITIONS[actionPageKey];
  const sourceLabel = stats.sourceMode === "local" ? "Local fallback" : "Supabase live";
  return `
    <aside class="portal-sidebar admin-portal-sidebar">
      <div class="portal-brand-block">
        <a class="portal-brand" href="${routePath("admin")}">
          <span class="portal-brand-icon material-symbols-outlined">explore</span>
          <div><strong>The Horizon</strong><span>Management Portal</span></div>
        </a>
      </div>
      <div class="admin-menu-groups">${renderMenuGroups(groups, currentPage)}</div>
      <div class="admin-sidebar-note">
        <strong>${escapeHtml(roleLabel(auth.primaryRole))}</strong>
        <p>Menus are split into dedicated routes and follow the role model defined in schema.sql.</p>
        <div class="admin-chip-list"><span class="admin-soft-pill">${escapeHtml(sourceLabel)}</span></div>
      </div>
      <a class="portal-side-action" href="${routePath(actionPage.routeKey)}"><span class="material-symbols-outlined">${actionPage.icon}</span><span>${escapeHtml(actionPage.label)}</span></a>
    </aside>
  `;
}

function renderTopbar(auth, currentPage, sourceMode) {
  const page = PAGE_DEFINITIONS[currentPage];
  const name = auth.profile?.full_name || auth.user?.email || "Manager";
  return `
    <header class="portal-topbar">
      <div class="portal-search-wrap"><span class="material-symbols-outlined">search</span><input id="admin-dashboard-search" type="search" placeholder="${escapeHtml(page.searchPlaceholder)}" /></div>
      <div class="portal-topbar-actions">
        <button class="portal-icon-button" type="button" aria-label="Notifications"><span class="material-symbols-outlined">notifications</span>${sourceMode === "database" ? '<span class="portal-dot"></span>' : ""}</button>
        <button class="portal-icon-button" type="button" aria-label="Help"><span class="material-symbols-outlined">help_outline</span></button>
        <button class="portal-icon-button" id="admin-logout" type="button" aria-label="Logout"><span class="material-symbols-outlined">logout</span></button>
        <div class="portal-profile-block"><div class="portal-profile-copy"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(roleLabel(auth.primaryRole))}</span></div>${renderAvatar(auth.profile, auth.user, "portal-avatar")}</div>
      </div>
    </header>
  `;
}

function renderPageIntro(auth, currentPage, data) {
  const page = PAGE_DEFINITIONS[currentPage];
  const sourceLabel = data.sourceMode === "database" ? "Source: Supabase seed" : "Source: local fallback";
  return `
    <section class="portal-welcome">
      <span class="eyebrow">${escapeHtml(roleLabel(auth.primaryRole))} / ${escapeHtml(page.label)}</span>
      <h1>${escapeHtml(page.title)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <div class="admin-chip-list">
        <span class="admin-soft-pill">${escapeHtml(sourceLabel)}</span>
        <span class="admin-soft-pill">${escapeHtml(String(data.bookings.length))} bookings</span>
        <span class="admin-soft-pill">${escapeHtml(String(data.payments.length))} payments</span>
      </div>
    </section>
  `;
}

function renderCapabilityGrid(items) {
  return `<section class="admin-capability-grid">${items.map((item) => `<article class="admin-capability-card" data-search="${escapeHtml(`${item.title} ${item.code}`)}"><span class="material-symbols-outlined">${item.icon}</span><div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div><em>${escapeHtml(item.code)}</em></article>`).join("")}</section>`;
}

function renderTablePanel(title, description, headers, rows, footerText = "") {
  return `
    <article class="admin-panel admin-ops-table-panel">
      <div class="portal-section-head admin-table-headline"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div></div>
      ${rows.length
        ? `<div class="admin-table-wrap"><table class="admin-data-table"><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div><div class="admin-table-footer"><p>${escapeHtml(footerText || `Showing ${rows.length} records`)}</p></div>`
        : `<div class="empty-state"><h3>No data yet</h3><p>${escapeHtml(description)}</p></div>`}
    </article>
  `;
}

function renderBookingCards(bookings) {
  if (!bookings.length) return '<div class="empty-state"><h3>No bookings yet</h3><p>Booking data will appear here once transactions exist.</p></div>';
  return bookings.slice(0, 5).map((booking) => {
    const tone = getBookingTone(booking);
    return `<article class="admin-queue-card" data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""}`)}"><div class="admin-queue-copy"><strong>#${escapeHtml(booking.booking_code)}</strong><h4>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</h4><p>${escapeHtml(booking.contact_name || "Customer")} - ${escapeHtml(formatShortDate(booking.created_at))}</p></div><div class="admin-queue-side"><span>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</span>${renderStatusTag(tone.label, tone.tone)}</div></article>`;
  }).join("");
}

function renderTopTourList(tours) {
  if (!tours.length) return '<div class="empty-state"><h3>No tour data</h3><p>Tour ranking will appear once catalog or booking data is available.</p></div>';
  return tours.map((tour) => `<article class="admin-tour-item" data-search="${escapeHtml(tour.name)}"><img src="${escapeHtml(tour.image)}" alt="${escapeHtml(tour.name)}" /><div class="admin-tour-copy"><h4>${escapeHtml(tour.name)}</h4><p>${escapeHtml(tour.destinationLabel || "Updating")} - ${escapeHtml(String(Number(tour.rating || 0).toFixed(1)))} stars</p></div><div class="admin-tour-price"><strong>${escapeHtml(formatCurrency(tour.price, tour.currency || "VND"))}</strong><span>${tour.bookings ? `${tour.bookings} bookings` : "Catalog"}</span></div></article>`).join("");
}
function renderTicketList(tickets) {
  if (!tickets.length) return '<div class="empty-state"><h3>No open tickets</h3><p>All support requests are currently resolved.</p></div>';
  return tickets.slice(0, 4).map((ticket) => {
    const tone = getTicketTone(ticket);
    return `<article class="admin-ticket-card" data-search="${escapeHtml(`${ticket.subject || ""} ${ticket.customerName || ""} ${ticket.bookingCode || ""}`)}"><div class="admin-feedback-head"><div><strong>${escapeHtml(ticket.subject || `Support for booking #${ticket.bookingCode || "N/A"}`)}</strong><p>${escapeHtml(ticket.customerName || "Customer")} - ${escapeHtml(ticket.bookingCode || "No booking")}</p></div>${renderStatusTag(tone.label, tone.tone)}</div><div class="admin-ticket-meta"><span><span class="material-symbols-outlined">priority_high</span>${escapeHtml(ticket.priority || "normal")}</span><span><span class="material-symbols-outlined">travel_explore</span>${escapeHtml(ticket.tour?.name || "No tour")}</span></div></article>`;
  }).join("");
}

function renderReviewList(reviews) {
  if (!reviews.length) return '<div class="empty-state"><h3>No review queue</h3><p>Reviews will appear here when customers submit new feedback.</p></div>';
  return reviews.slice(0, 4).map((review) => {
    const tone = getReviewTone(review);
    return `<article class="admin-feedback-card" data-search="${escapeHtml(`${review.authorName || ""} ${review.tour?.name || ""} ${review.comment || ""}`)}"><div class="admin-feedback-head"><div><strong>${escapeHtml(review.authorName || review.contactName || "Customer")}</strong><p>${escapeHtml(review.tour?.name || "Tour")} - ${escapeHtml(formatStatus(review.status))}</p></div>${renderStatusTag(tone.label, tone.tone)}</div><blockquote>${escapeHtml(review.comment || "No comment provided.")}</blockquote>${review.reply ? `<div class="admin-mini-note"><strong>Reply</strong><p>${escapeHtml(review.reply.text)}</p></div>` : ""}</article>`;
  }).join("");
}

function renderCustomerRows(customers) {
  if (!customers.length) return '<div class="empty-state"><h3>No customers yet</h3><p>Customer data will appear when profiles or bookings exist.</p></div>';
  return customers.map((customer) => `<article class="admin-customer-row" data-search="${escapeHtml(`${customer.name} ${customer.email}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(customer.name))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(customer.name)}</strong><p>${escapeHtml(customer.email || "No email")}</p></div><div class="admin-customer-row-side"><span>${escapeHtml(String(customer.bookings))} bookings</span><em>${escapeHtml(formatCurrency(customer.spend, "VND"))}</em></div></article>`).join("");
}

function renderProfileRows(profiles) {
  if (!profiles.length) return '<div class="empty-state"><h3>No profiles yet</h3><p>User profiles will appear here.</p></div>';
  return profiles.slice(0, 8).map((profile) => `<article class="admin-profile-row" data-search="${escapeHtml(`${profile.full_name || ""} ${profile.email || ""} ${profile.primaryRole || ""}`)}"><div class="admin-customer-avatar">${escapeHtml(getInitials(profile.full_name || profile.email || "TH"))}</div><div class="admin-customer-row-copy"><strong>${escapeHtml(profile.full_name || profile.email || "User")}</strong><p>${escapeHtml(profile.email || "No email")}</p></div><div class="admin-profile-role">${escapeHtml(roleLabel(profile.primaryRole))}</div></article>`).join("");
}

function renderRoleCards(roleCounts) {
  return ["customer", "staff", "admin", "super_admin"].map((role) => `<article class="admin-role-card"><span>${escapeHtml(roleLabel(role))}</span><strong>${escapeHtml(String(roleCounts[role] || 0))}</strong></article>`).join("");
}

function renderPaymentMethods(methods) {
  if (!methods.length) return '<div class="empty-state"><h3>No payment method</h3><p>Payment methods will appear here when configured.</p></div>';
  return `<div class="admin-chip-list">${methods.map((method) => `<span class="admin-soft-pill">${escapeHtml(method.name)}</span>`).join("")}</div>`;
}

function renderActivityList(items) {
  if (!items.length) return '<div class="empty-state"><h3>No activity log</h3><p>System activity will appear here once records are available.</p></div>';
  return `<div class="portal-timeline-list admin-activity-list">${items.slice(0, 6).map((item, index) => `<div class="portal-timeline-item portal-timeline-item-accent-${(index % 3) + 1}" data-search="${escapeHtml(`${item.action} ${item.entity_type}`)}"><span class="portal-timeline-dot"></span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.actor?.full_name || "System")} - ${escapeHtml(formatDateTime(item.created_at))}</p></div></div>`).join("")}</div>`;
}

function renderDashboardPage(auth, data, stats) {
  const topTours = getTopTours(data.bookings, data.tours);
  const cards = auth.primaryRole === "staff"
    ? [
        { icon: "assignment", chip: `${stats.pendingBookings.length}`, label: "Pending bookings", value: String(stats.pendingBookings.length).padStart(2, "0"), hint: "From public.bookings" },
        { icon: "payments", chip: `${stats.pendingPayments.length}`, chipTone: "info", label: "Payment queue", value: String(stats.pendingPayments.length).padStart(2, "0"), hint: "From public.payments" },
        { icon: "support_agent", chip: `${stats.unresolvedTickets.length}`, chipTone: "danger", label: "Open tickets", value: String(stats.unresolvedTickets.length).padStart(2, "0"), hint: "From support_tickets" },
        { icon: "calendar_month", chip: `${stats.activeSchedules.length}`, chipTone: "info", label: "Open departures", value: String(stats.activeSchedules.length).padStart(2, "0"), hint: "From departure_schedules" }
      ]
    : [
        { icon: "payments", chip: `${data.sourceMode === "database" ? "seed" : "fallback"}`, chipTone: "info", label: "Collected revenue", value: formatCurrency(stats.collectedRevenue, "VND"), hint: "Only paid transactions" },
        { icon: "assignment_turned_in", chip: `${stats.totalBookings}`, label: "Total bookings", value: String(stats.totalBookings).padStart(2, "0"), hint: "From public.bookings" },
        { icon: "groups", chip: `${stats.totalUsers}`, label: "Total users", value: String(stats.totalUsers).padStart(2, "0"), hint: "From profiles and user_roles" },
        { icon: "campaign", chip: `${stats.activeBanners.length}`, chipTone: "info", label: "Active banners", value: String(stats.activeBanners.length).padStart(2, "0"), hint: "From public.banners" }
      ];
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">${cards.map(renderStatCard).join("")}</section>
    ${renderCapabilityGrid(buildRoleHighlights(auth.primaryRole))}
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Latest bookings</h2><p>Recent order stream using real booking data.</p></div><div class="admin-list-stack">${renderBookingCards(data.bookings)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Top tours by demand</h2><p>Ranked from live bookings linked to the current catalog.</p></div><div class="admin-tour-list">${renderTopTourList(topTours)}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Service queue</h2><p>Open tickets and review backlog at a glance.</p></div><div class="admin-list-stack">${stats.unresolvedTickets.length ? renderTicketList(stats.unresolvedTickets) : renderReviewList(stats.pendingReviews)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Recent activity</h2><p>From activity_logs or booking_events fallback.</p></div>${renderActivityList(data.activityLogs)}</article>
    </section>
  `;
}

function renderReportsPage(data, stats) {
  const revenueBars = groupMonthlyRevenue(data.payments);
  const regions = getRegionBreakdown(data.bookings);
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "payments", chip: `+${stats.totalBookings}`, label: "Collected revenue", value: formatCurrency(stats.collectedRevenue, "VND"), hint: "payment.status = paid" })}
      ${renderStatCard({ icon: "receipt_long", chip: `${stats.pendingPayments.length}`, chipTone: "info", label: "Pending payments", value: String(stats.pendingPayments.length), hint: "Pending and unpaid flow" })}
      ${renderStatCard({ icon: "restart_alt", chip: `${data.refunds.length}`, chipTone: "danger", label: "Refund total", value: formatCurrency(stats.refundAmount, "VND"), hint: "From public.refunds" })}
      ${renderStatCard({ icon: "confirmation_number", chip: `${stats.activeCoupons.length}`, chipTone: "info", label: "Coupon usages", value: String(stats.totalCouponUsage), hint: "From coupon_usages" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel admin-chart-panel"><div class="portal-section-head"><div><h2>Revenue chart</h2><p>Last six months from payment records.</p></div><button class="admin-pill-button" type="button">Monthly</button></div><div class="admin-bar-chart">${revenueBars.map((bar) => `<div class="admin-bar-col"><div class="admin-bar-fill ${bar.label === revenueBars[revenueBars.length - 1]?.label ? "is-active" : ""}" style="height:${bar.height}%"></div><span>${escapeHtml(bar.label)}</span></div>`).join("")}</div></article>
      <article class="admin-panel admin-region-panel"><h2>Booking mix by region</h2><div class="admin-region-list">${regions.map((region, index) => `<div class="admin-region-item"><div class="admin-region-top"><div><i class="admin-region-dot admin-region-dot-${index + 1}"></i><span>${escapeHtml(region.label)}</span></div><strong>${escapeHtml(String(region.percent || 0))}%</strong></div><div class="admin-region-track"><span class="admin-region-progress admin-region-progress-${index + 1}" style="width:${Math.max(region.percent, 8)}%"></span></div></div>`).join("")}</div></article>
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Payment methods</h2><p>Currently enabled methods.</p></div>${renderPaymentMethods(data.paymentMethods)}</article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Activity log</h2><p>Latest management actions from activity_logs.</p></div>${renderActivityList(data.activityLogs)}</article>
    </section>
  `;
}

function renderBookingsPage(data, stats) {
  const rows = data.bookings.map((booking) => {
    const tone = getBookingTone(booking);
    return `<tr data-search="${escapeHtml(`${booking.booking_code} ${booking.contact_name || ""} ${booking.tour?.name || booking.snapshot_jsonb?.tour_name || ""}`)}"><td><strong class="admin-order-code">#${escapeHtml(booking.booking_code)}</strong></td><td><div class="admin-customer-cell"><div class="admin-customer-avatar">${escapeHtml(getInitials(booking.contact_name || "KH"))}</div><div><strong>${escapeHtml(booking.contact_name || "Customer")}</strong><span>${escapeHtml(booking.contact_email || "")}</span></div></div></td><td><div class="admin-tour-cell"><strong>${escapeHtml(booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Tour")}</strong><span>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</span></div></td><td>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</td><td>${renderStatusTag(tone.label, tone.tone)}</td><td>${escapeHtml(formatStatus(booking.payment_status || "pending"))}</td></tr>`;
  });
  const invoiceRows = data.invoices.slice(0, 6).map((invoice) => `<article class="admin-mini-row" data-search="${escapeHtml(`${invoice.invoice_number} ${invoice.company_name || ""}`)}"><div><strong>${escapeHtml(invoice.invoice_number)}</strong><p>${escapeHtml(invoice.company_name || "Retail customer")} - ${escapeHtml(invoice.booking?.booking_code || "N/A")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatDateTime(invoice.issued_at))}</span></div></article>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "assignment", chip: `${stats.totalBookings}`, label: "Total bookings", value: String(stats.totalBookings), hint: "From public.bookings" })}
      ${renderStatCard({ icon: "hourglass_top", chip: `${stats.pendingBookings.length}`, chipTone: "warning", label: "Pending queue", value: String(stats.pendingBookings.length), hint: "pending, awaiting_payment, cancel_requested" })}
      ${renderStatCard({ icon: "task_alt", chip: `${data.bookings.filter((booking) => booking.booking_status === "completed").length}`, label: "Completed", value: String(data.bookings.filter((booking) => booking.booking_status === "completed").length), hint: "booking_status = completed" })}
      ${renderStatCard({ icon: "sell", chip: `${data.invoices.length}`, chipTone: "info", label: "Invoices issued", value: String(data.invoices.length), hint: "From public.invoices" })}
    </section>
    ${renderTablePanel("Booking list", "Each menu is a dedicated route and shows real order data from seed records or local fallback.", ["Code", "Customer", "Tour", "Amount", "Status", "Payment"], rows, `Showing ${rows.length} bookings`) }
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Booking activity</h2><p>Timeline from booking events and activity logs.</p></div>${renderActivityList(data.activityLogs.filter((item) => item.entity_type === "booking" || item.entity_type === "support_ticket"))}</article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Recent invoices</h2><p>Invoice records linked back to bookings.</p></div><div class="admin-list-stack">${invoiceRows || '<div class="empty-state"><h3>No invoices yet</h3><p>Invoices will appear here when records exist.</p></div>'}</div></article>
    </section>
  `;
}
function renderPaymentsPage(data, stats) {
  const rows = data.payments.map((payment) => {
    const tone = getPaymentTone(payment);
    return `<tr data-search="${escapeHtml(`${payment.transaction_code || ""} ${payment.provider_name || ""} ${payment.booking?.booking_code || ""}`)}"><td><strong class="admin-order-code">${escapeHtml(payment.transaction_code || payment.provider_payment_id || payment.id.slice(0, 8))}</strong></td><td>${escapeHtml(payment.booking?.booking_code || "N/A")}</td><td>${escapeHtml(payment.provider_name || "Manual")}</td><td>${escapeHtml(formatCurrency(payment.amount, payment.currency || "VND"))}</td><td>${renderStatusTag(tone.label, tone.tone)}</td><td>${escapeHtml(formatDateTime(payment.paid_at || payment.requested_at || payment.created_at))}</td></tr>`;
  });
  const refundRows = data.refunds.map((refund) => `<article class="admin-mini-row" data-search="${escapeHtml(`${refund.reason || ""} ${refund.payment?.booking?.booking_code || ""}`)}"><div><strong>${escapeHtml(refund.payment?.booking?.booking_code || "Refund")}</strong><p>${escapeHtml(refund.reason || "No reason provided")} - ${escapeHtml(refund.status || "pending")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(refund.amount, refund.payment?.currency || "VND"))}</span><em>${escapeHtml(formatDateTime(refund.refunded_at || refund.created_at))}</em></div></article>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "payments", chip: `${stats.pendingPayments.length}`, chipTone: "info", label: "Pending transactions", value: String(stats.pendingPayments.length), hint: "pending and unpaid flow" })}
      ${renderStatCard({ icon: "credit_score", chip: `${data.paymentMethods.length}`, label: "Payment methods", value: String(data.paymentMethods.length), hint: "Enabled payment methods" })}
      ${renderStatCard({ icon: "savings", chip: `${data.refunds.length}`, chipTone: "danger", label: "Refund total", value: formatCurrency(stats.refundAmount, "VND"), hint: "From public.refunds" })}
      ${renderStatCard({ icon: "inventory", chip: `${data.invoices.length}`, label: "Invoices linked", value: String(data.invoices.length), hint: "Issued invoice records" })}
    </section>
    ${renderTablePanel("Payment list", "Transaction records from the seeded payments table.", ["Transaction", "Booking", "Provider", "Amount", "Status", "Time"], rows, `Showing ${rows.length} payments`) }
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Recent refunds</h2><p>Refund records joined back to the related booking.</p></div><div class="admin-list-stack">${refundRows || '<div class="empty-state"><h3>No refund data</h3><p>Refund rows will appear here when available.</p></div>'}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Enabled payment methods</h2><p>Current payment methods exposed to the booking flow.</p></div>${renderPaymentMethods(data.paymentMethods)}</article>
    </section>
  `;
}

function renderToursPage(data, stats) {
  const topTours = getTopTours(data.bookings, data.tours);
  const rows = data.schedules.slice(0, 12).map((schedule) => `<tr data-search="${escapeHtml(`${schedule.tourName} ${schedule.destinationLabel || ""}`)}"><td><strong>${escapeHtml(schedule.tourName)}</strong></td><td>${escapeHtml(schedule.destinationLabel || "Updating")}</td><td>${escapeHtml(formatShortDate(schedule.departureDate))}</td><td>${escapeHtml(String(schedule.capacity || 0))}</td><td>${escapeHtml(String(schedule.availableSlots || 0))}</td><td>${renderStatusTag(formatStatus(schedule.status), schedule.status === "sold_out" ? "danger" : schedule.status === "open" ? "success" : "waiting")}</td></tr>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "explore", chip: `${data.tours.length}`, label: "Published tours", value: String(data.tours.length), hint: "From public.tours" })}
      ${renderStatCard({ icon: "calendar_month", chip: `${stats.activeSchedules.length}`, chipTone: "info", label: "Active departures", value: String(stats.activeSchedules.length), hint: "draft, open, sold_out" })}
      ${renderStatCard({ icon: "event_busy", chip: `${stats.soldOutSchedules.length}`, chipTone: "danger", label: "Sold out", value: String(stats.soldOutSchedules.length), hint: "schedule.status = sold_out" })}
      ${renderStatCard({ icon: "star", chip: `${topTours.length}`, label: "Top tour", value: topTours[0]?.name || "Updating", hint: "Ranked by booking volume" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Top tours</h2><p>Sorted by real booking demand.</p></div><div class="admin-tour-list">${renderTopTourList(topTours)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Categories</h2><p>Current category tags from the tour catalog.</p></div><div class="admin-chip-list">${data.tours.flatMap((tour) => tour.categories || []).slice(0, 12).map((category) => `<span class="admin-soft-pill">${escapeHtml(category.name)}</span>`).join("")}</div></article>
    </section>
    ${renderTablePanel("Departure schedules", "Upcoming departures from departure_schedules and catalog joins.", ["Tour", "Destination", "Departure", "Capacity", "Available", "Status"], rows, `Showing ${rows.length} schedules`) }
  `;
}

function renderServicePage(data, stats) {
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "support_agent", chip: `${stats.unresolvedTickets.length}`, chipTone: "danger", label: "Open tickets", value: String(stats.unresolvedTickets.length), hint: "open and in_progress" })}
      ${renderStatCard({ icon: "rate_review", chip: `${stats.pendingReviews.length}`, chipTone: "warning", label: "Review backlog", value: String(stats.pendingReviews.length), hint: "review.status != approved" })}
      ${renderStatCard({ icon: "mark_email_read", chip: `${data.tickets.filter((ticket) => ticket.status === "resolved").length}`, label: "Resolved tickets", value: String(data.tickets.filter((ticket) => ticket.status === "resolved").length), hint: "status = resolved" })}
      ${renderStatCard({ icon: "star", chip: `${data.reviews.length}`, label: "Total reviews", value: String(data.reviews.length), hint: "approved plus pending" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Support tickets</h2><p>Ticket list from public.support_tickets.</p></div><div class="admin-list-stack">${renderTicketList(data.tickets)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Review moderation</h2><p>Review feed from public.reviews and review_replies.</p></div><div class="admin-list-stack">${renderReviewList(stats.pendingReviews.length ? stats.pendingReviews : data.reviews)}</div></article>
    </section>
  `;
}

function renderCustomersPage(data, stats) {
  const customerProfiles = data.profiles.filter((profile) => profile.primaryRole === "customer");
  const averageSpend = stats.recentCustomers.length ? Math.round(stats.recentCustomers.reduce((sum, customer) => sum + customer.spend, 0) / stats.recentCustomers.length) : 0;
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "groups_2", chip: `${stats.customerCount}`, label: "Customers", value: String(stats.customerCount), hint: "role = customer" })}
      ${renderStatCard({ icon: "repeat", chip: `${stats.repeatCustomers}`, chipTone: "info", label: "Repeat customers", value: String(stats.repeatCustomers), hint: "More than one booking" })}
      ${renderStatCard({ icon: "shopping_bag", chip: `${stats.totalBookings}`, label: "Bookings tracked", value: String(stats.totalBookings), hint: "All current orders" })}
      ${renderStatCard({ icon: "savings", chip: `${stats.recentCustomers.length}`, chipTone: "info", label: "Avg spend (recent)", value: formatCurrency(averageSpend, "VND"), hint: "Computed from recent customers" })}
    </section>
    <section class="admin-section-grid">
      <article class="admin-panel"><div class="portal-section-head"><h2>Recent customers</h2><p>Built from bookings plus contact data.</p></div><div class="admin-list-stack">${renderCustomerRows(stats.recentCustomers)}</div></article>
      <article class="admin-panel"><div class="portal-section-head"><h2>Customer profiles</h2><p>From profiles and user_roles.</p></div><div class="admin-list-stack">${renderProfileRows(customerProfiles)}</div></article>
    </section>
  `;
}

function renderPromotionsPage(data, stats) {
  const rows = data.coupons.map((coupon) => `<tr data-search="${escapeHtml(`${coupon.code} ${coupon.name || ""}`)}"><td><strong>${escapeHtml(coupon.code)}</strong></td><td>${escapeHtml(coupon.name || coupon.code)}</td><td>${escapeHtml(coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue, "VND"))}</td><td>${escapeHtml(formatCurrency(coupon.minOrderAmount || 0, "VND"))}</td><td>${renderStatusTag(coupon.isActive ? "Active" : "Off", coupon.isActive ? "success" : "danger")}</td><td>${escapeHtml(String(coupon.usageCount || 0))}</td></tr>`).join("");
  const usageRows = data.couponUsages.slice(0, 8).map((usage) => `<article class="admin-mini-row" data-search="${escapeHtml(`${usage.booking?.booking_code || ""} ${usage.customer?.full_name || ""}`)}"><div><strong>${escapeHtml(usage.booking?.booking_code || "Usage")}</strong><p>${escapeHtml(usage.customer?.full_name || "Customer")} - ${escapeHtml(formatDateTime(usage.created_at))}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(formatCurrency(usage.discount_amount, "VND"))}</span><em>${escapeHtml(usage.booking?.snapshot_jsonb?.tour_name || usage.booking?.tour?.name || "Tour")}</em></div></article>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "sell", chip: `${stats.activeCoupons.length}`, label: "Active coupons", value: String(stats.activeCoupons.length), hint: "From public.coupons" })}
      ${renderStatCard({ icon: "confirmation_number", chip: `${stats.totalCouponUsage}`, chipTone: "info", label: "Usages", value: String(stats.totalCouponUsage), hint: "From coupon_usages" })}
      ${renderStatCard({ icon: "local_offer", chip: `${data.coupons.length}`, label: "Discount granted", value: formatCurrency(data.coupons.reduce((sum, coupon) => sum + Number(coupon.totalDiscount || 0), 0), "VND"), hint: "Total real discount amount" })}
      ${renderStatCard({ icon: "payments", chip: `${data.coupons.length}`, label: "Top coupon value", value: formatCurrency(Math.max(0, ...data.coupons.map((coupon) => Number(coupon.maxDiscountAmount || coupon.discountValue || 0))), "VND"), hint: "Current highest seeded cap" })}
    </section>
    ${renderTablePanel("Coupon list", "Active coupons and usage counts based on real database rows.", ["Code", "Name", "Discount", "Min order", "Status", "Usage"], rows, `Showing ${rows.length} coupons`) }
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>Coupon usages</h2><p>Which bookings used a coupon and how much discount was applied.</p></div><div class="admin-list-stack">${usageRows || '<div class="empty-state"><h3>No coupon usage yet</h3><p>Coupon usage rows will appear here once applied.</p></div>'}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>Related payment methods</h2><p>Useful when staff wants to verify coupon flows against payment records.</p></div>${renderPaymentMethods(data.paymentMethods)}</article></section>
  `;
}

function renderUsersPage(data, stats) {
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "group", chip: `${stats.totalUsers}`, label: "Total users", value: String(stats.totalUsers), hint: "From profiles" })}
      ${renderStatCard({ icon: "badge", chip: `${stats.roleCounts.staff || 0}`, chipTone: "info", label: "Staff", value: String(stats.roleCounts.staff || 0), hint: "role = staff" })}
      ${renderStatCard({ icon: "security", chip: `${(stats.roleCounts.admin || 0) + (stats.roleCounts.super_admin || 0)}`, chipTone: "info", label: "Admins", value: String((stats.roleCounts.admin || 0) + (stats.roleCounts.super_admin || 0)), hint: "admin plus super_admin" })}
      ${renderStatCard({ icon: "person", chip: `${stats.customerCount}`, label: "Customers", value: String(stats.customerCount), hint: "role = customer" })}
    </section>
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>Role distribution</h2><p>Mirrors roles and user_roles in the current schema.</p></div><div class="admin-role-grid">${renderRoleCards(stats.roleCounts)}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>Latest profiles</h2><p>Newest user profiles currently available.</p></div><div class="admin-list-stack">${renderProfileRows(data.profiles)}</div></article></section>
  `;
}

function renderContentPage(data, stats) {
  const bannerRows = data.banners.slice(0, 8).map((banner) => `<tr data-search="${escapeHtml(`${banner.title} ${banner.placement || ""}`)}"><td><strong>${escapeHtml(banner.title)}</strong></td><td>${escapeHtml(banner.placement || "home")}</td><td>${renderStatusTag(Boolean(banner.is_active ?? banner.isActive) ? "Active" : "Off", Boolean(banner.is_active ?? banner.isActive) ? "success" : "danger")}</td><td>${escapeHtml(String(banner.sort_order ?? 0))}</td><td>${escapeHtml(formatShortDate(banner.start_at || banner.created_at))}</td></tr>`).join("");
  const cmsRows = data.cmsPages.slice(0, 8).map((page) => `<article class="admin-mini-row" data-search="${escapeHtml(`${page.slug} ${page.title}`)}"><div><strong>${escapeHtml(page.title)}</strong><p>${escapeHtml(page.slug)}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(page.metaTitle || page.title)}</span><em>${escapeHtml(page.publishedAt ? formatShortDate(page.publishedAt) : "Active")}</em></div></article>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "campaign", chip: `${stats.activeBanners.length}`, label: "Active banners", value: String(stats.activeBanners.length), hint: "public.banners" })}
      ${renderStatCard({ icon: "description", chip: `${data.cmsPages.length}`, chipTone: "info", label: "CMS pages", value: String(data.cmsPages.length), hint: "public.cms_pages" })}
      ${renderStatCard({ icon: "visibility", chip: `${stats.publishedPages.length}`, label: "Public pages", value: String(stats.publishedPages.length || data.cmsPages.length), hint: "Pages exposed on website" })}
      ${renderStatCard({ icon: "palette", chip: `${data.banners.length}`, chipTone: "info", label: "Placements", value: String(new Set(data.banners.map((banner) => banner.placement || "home")).size), hint: "hero, home, listing" })}
    </section>
    ${renderTablePanel("Banner list", "Banner rows read from the seeded banners table.", ["Banner", "Placement", "Status", "Sort", "Start"], bannerRows, `Showing ${bannerRows.length} banners`) }
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>CMS pages</h2><p>Public content pages currently used by the website.</p></div><div class="admin-list-stack">${cmsRows || '<div class="empty-state"><h3>No CMS pages</h3><p>CMS entries will appear here when available.</p></div>'}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>Content summary</h2><p>Quick view across banner, coupon and CMS modules.</p></div><div class="admin-content-grid"><article class="admin-content-card"><span>Active banners</span><strong>${escapeHtml(String(stats.activeBanners.length))}</strong><p>Placements currently enabled on the website.</p></article><article class="admin-content-card"><span>Active coupons</span><strong>${escapeHtml(String(stats.activeCoupons.length))}</strong><p>Promotion codes currently available.</p></article><article class="admin-content-card"><span>CMS pages</span><strong>${escapeHtml(String(data.cmsPages.length))}</strong><p>Content pages under management.</p></article><article class="admin-content-card"><span>Source mode</span><strong>${escapeHtml(data.sourceMode === "database" ? "DB" : "Local")}</strong><p>Shows whether management data is live or fallback.</p></article></div></article></section>
  `;
}

function renderSettingsPage(data, stats) {
  const settingRows = data.systemSettings.map((setting) => `<article class="admin-mini-row" data-search="${escapeHtml(setting.setting_key)}"><div><strong>${escapeHtml(setting.setting_key)}</strong><p>${escapeHtml(setting.description || "System setting")}</p></div><div class="admin-mini-row-side"><span>${escapeHtml(typeof setting.setting_value === "string" ? setting.setting_value : JSON.stringify(setting.setting_value))}</span></div></article>`).join("");
  return `
    <section class="admin-stats-grid admin-stats-grid-analytics">
      ${renderStatCard({ icon: "settings", chip: `${data.systemSettings.length}`, label: "System settings", value: String(data.systemSettings.length), hint: "From public.system_settings" })}
      ${renderStatCard({ icon: "payments", chip: `${data.paymentMethods.length}`, chipTone: "info", label: "Payment methods", value: String(data.paymentMethods.length), hint: "Current gateways and manual methods" })}
      ${renderStatCard({ icon: "admin_panel_settings", chip: `${Object.keys(stats.roleCounts).length}`, label: "Role model", value: "4", hint: "customer, staff, admin, super_admin" })}
      ${renderStatCard({ icon: "database", chip: data.sourceMode === "database" ? "DB" : "Local", chipTone: "info", label: "Data source", value: data.sourceMode === "database" ? "Supabase" : "Fallback", hint: "Quick source health check" })}
    </section>
    <section class="admin-section-grid"><article class="admin-panel"><div class="portal-section-head"><h2>System key/value snapshot</h2><p>Current values from public.system_settings.</p></div><div class="admin-list-stack">${settingRows || '<div class="empty-state"><h3>No settings available</h3><p>System settings will appear here when DB access is available.</p></div>'}</div></article><article class="admin-panel"><div class="portal-section-head"><h2>Payment methods and role model</h2><p>Quick operational configuration for admins.</p></div>${renderPaymentMethods(data.paymentMethods)}<div class="admin-settings-grid"><article class="admin-setting-card"><span>Customer</span><strong>${escapeHtml(String(stats.roleCounts.customer || 0))}</strong><p>End users and travelers.</p></article><article class="admin-setting-card"><span>Staff</span><strong>${escapeHtml(String(stats.roleCounts.staff || 0))}</strong><p>Operations, support, booking and payment.</p></article><article class="admin-setting-card"><span>Admin</span><strong>${escapeHtml(String(stats.roleCounts.admin || 0))}</strong><p>Content and platform management.</p></article><article class="admin-setting-card"><span>Super Admin</span><strong>${escapeHtml(String(stats.roleCounts.super_admin || 0))}</strong><p>Full configuration access.</p></article></div></article></section>
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
  const mobilePages = getAccessiblePages(auth.primaryRole).slice(0, 4);
  return `
    ${renderSidebar(auth, currentPage, stats)}
    <main class="portal-main admin-portal-main">
      ${renderTopbar(auth, currentPage, data.sourceMode)}
      <div class="portal-content admin-portal-content">
        ${renderPageIntro(auth, currentPage, data)}
        ${renderPageBody(auth, currentPage, data, stats)}
      </div>
    </main>
    <nav class="portal-mobile-nav admin-mobile-nav">${mobilePages.map((pageKey) => `<a class="${pageKey === currentPage ? "is-active" : ""}" href="${routePath(PAGE_DEFINITIONS[pageKey].routeKey)}"><span class="material-symbols-outlined">${PAGE_DEFINITIONS[pageKey].icon}</span><span>${escapeHtml(PAGE_DEFINITIONS[pageKey].label)}</span></a>`).join("")}</nav>
    <button class="admin-floating-button material-symbols-outlined" type="button">chat_bubble</button>
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

async function init() {
  const root = qs("#admin-app");
  setLoading(root, "Loading management area...");
  const auth = await guardPage({ management: true });
  if (!auth) return;

  const currentPage = getCurrentPageKey();
  if (!canAccessPage(auth.primaryRole, currentPage)) {
    const fallbackPage = getAccessiblePages(auth.primaryRole)[0] || "dashboard";
    window.location.href = routePath(PAGE_DEFINITIONS[fallbackPage].routeKey);
    return;
  }

  try {
    const data = await getAdminDashboard();
    root.innerHTML = renderManagementApp(auth, data, currentPage);
    bindSearch(root);
    qs("#admin-logout", root)?.addEventListener("click", async () => {
      await signOut();
      showToast("Logged out from management area.", "success");
      window.location.href = routePath("home");
    });
  } catch (error) {
    root.innerHTML = `<div class="empty-state"><h3>Unable to load management area</h3><p>${escapeHtml(error.message || "Unexpected error.")}</p></div>`;
  }
}

void init();

