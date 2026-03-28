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
import { isManagementRoute, isRoute, routePath } from "./routes.js";

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function escapeHtml(value) {
  return String(value || "")
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
  return labels[role] || String(role || "Ngu?i dùng");
}

function createNavItems(auth) {
  if (auth?.isManagement) {
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

function shouldLockManagementToDashboard(auth) {
  if (typeof window === "undefined" || !auth?.isManagement) return false;
  const currentPath = window.location.pathname;
  return !isManagementRoute(currentPath) && !isRoute(currentPath, "login");
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
  toast.textContent = message;
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
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < rounded ? "star active" : "star"}">?</span>`).join("");
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
      ${description ? `<p>${escapeHtml(description)}</p>` : ""}
    </div>
  `;
}

export function renderTourCard(tour, { showWishlist = false, wished = false, variant = "listing" } = {}) {
  const detailHref = routePath("tour-detail", { slug: tour.slug });
  const checkoutHref = routePath("checkout", { slug: tour.slug });
  const rating = Number(tour.ratingAverage || 0).toFixed(1);

  if (variant === "featured") {
    return `
      <article class="tour-card tour-card-featured" data-tour-id="${escapeHtml(tour.id)}">
        <a class="tour-card-media" href="${detailHref}">
          <img class="tour-card-image" src="${escapeHtml(tour.coverImage)}" alt="${escapeHtml(tour.name)}" />
          <span class="tour-card-flag">${escapeHtml(tour.durationLabel)}</span>
        </a>
        <div class="tour-card-body">
          <div class="tour-card-heading-row">
            <div>
              <h3><a href="${detailHref}">${escapeHtml(tour.name)}</a></h3>
              <p class="tour-card-location">${escapeHtml(tour.destinationLabel)}</p>
            </div>
            <div class="tour-card-rating"><span>?</span>${rating}</div>
          </div>
          <div class="tour-card-price-row">
            <div class="tour-price-stack">
              <small>T?</small>
              <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
            </div>
            <a class="tour-inline-link" href="${checkoutHref}">Ð?t tour</a>
          </div>
        </div>
      </article>
    `;
  }

  return `
    <article class="tour-card tour-card-listing" data-tour-id="${escapeHtml(tour.id)}" data-tour-slug="${escapeHtml(tour.slug)}">
      <a class="tour-card-media" href="${detailHref}">
        <img class="tour-card-image" src="${escapeHtml(tour.coverImage)}" alt="${escapeHtml(tour.name)}" />
        <span class="tour-card-flag tour-card-flag-soft">${tour.isFeatured ? "N?i b?t" : escapeHtml(tour.destinationLabel)}</span>
      </a>
      <div class="tour-card-body">
        <div class="tour-card-topline">
          <span class="tour-card-pill">${escapeHtml(tour.destinationLabel)}</span>
          ${showWishlist ? `<button class="ghost-action wishlist-button" type="button" data-tour-id="${escapeHtml(tour.id)}">${wished ? "Ðã luu" : "Luu tour"}</button>` : ""}
        </div>
        <div class="tour-card-heading-row">
          <h3><a href="${detailHref}">${escapeHtml(tour.name)}</a></h3>
          <div class="tour-card-rating"><span>?</span>${rating}</div>
        </div>
        <p class="tour-card-copy">${escapeHtml(tour.shortDescription)}</p>
        <div class="tour-card-specs">
          <span>${escapeHtml(tour.durationLabel)}</span>
          <span>${tour.reviewCount} dánh giá</span>
          <span>${tour.viewerCount} ngu?i xem</span>
        </div>
        <div class="tour-card-footer">
          <div class="tour-price-stack">
            <small>T?</small>
            <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
          </div>
          <a class="button button-accent" href="${checkoutHref}">Ð?t ngay</a>
        </div>
      </div>
    </article>
  `;
}

export function renderDestinationCard(destination) {
  const toursHref = routePath("tours", { destination: destination.location.slug });

  return `
    <article class="destination-card destination-card-standard">
      <a class="destination-card-media" href="${toursHref}">
        <img class="destination-card-image" src="${escapeHtml(destination.featuredImage)}" alt="${escapeHtml(destination.location.name)}" />
      </a>
      <div class="destination-card-body">
        <span class="eyebrow">Ði?m d?n</span>
        <h3>${escapeHtml(destination.location.name)}</h3>
        <p>${escapeHtml(compactText(destination.location.description, "Khám phá nh?ng tour n?i b?t t?i di?m d?n này."))}</p>
        <div class="destination-card-footer">
          <strong>${destination.totalTours} tour</strong>
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
            <p>${escapeHtml(review.tourName || "Khách dã d?t tour")}</p>
          </div>
        </div>
        <div class="review-stars">${renderStars(review.rating)}</div>
      </div>
      <blockquote>${escapeHtml(review.comment)}</blockquote>
      <div class="review-card-footer">
        <span>${escapeHtml(formatLongDate(review.createdAt))}</span>
        ${review.reply ? `<span class="chip">Có ph?n h?i</span>` : ""}
      </div>
    </article>
  `;
}

export function renderPriceLines(lines = [], currency = "VND") {
  if (!lines.length) {
    return renderEmptyState("Chua có dòng giá", "Giá booking s? xu?t hi?n t?i dây sau khi t?o thành công.");
  }

  return `
    <div class="price-lines">
      ${lines
        .map((line) => `
          <div class="price-line">
            <div>
              <strong>${escapeHtml(line.label)}</strong>
              <p>S? lu?ng: ${line.quantity}</p>
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
          <small>Kh?i hành</small>
          <strong>${escapeHtml(formatShortDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</strong>
        </div>
        <div>
          <small>T?ng ti?n</small>
          <strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency))}</strong>
        </div>
        <div>
          <small>Thanh toán</small>
          <strong>${escapeHtml(statusLabel(payment?.status || booking.payment_status))}</strong>
        </div>
      </div>
      <div class="booking-card-actions">
        <a class="button button-secondary" href="${detailHref}">Xem chi ti?t</a>
      </div>
    </article>
  `;
}

function renderHeaderShell(pageKey, auth) {
  const activeKey = getActiveNavKey(pageKey);
  const navLinks = createNavItems(auth)
    .map((item) => `
      <a class="nav-link ${item.key === activeKey ? "is-active" : ""}" href="${item.href}">${escapeHtml(item.label)}</a>
    `)
    .join("");

  if (auth.user && auth.isManagement) {
    return `
      <header class="site-header site-header-management">
        <div class="container site-header-inner">
          <a class="brand" href="${routePath("admin")}" aria-label="The Horizon Dashboard">
            <span class="brand-wordmark">The Horizon</span>
          </a>
          <nav class="site-nav site-nav-management">${navLinks}</nav>
          <div class="header-actions header-actions-management">
            <span class="chip role-chip">${escapeHtml(formatRoleLabel(auth.primaryRole))}</span>
            <a class="button button-primary" href="${routePath("admin")}">M? dashboard</a>
            <button class="icon-button" id="logout-button" type="button" aria-label="Ðang xu?t">${escapeHtml(getInitials(auth.profile?.full_name || auth.user.email))}</button>
          </div>
        </div>
      </header>
    `;
  }

  const authBlock = auth.user
    ? `
        <div class="header-user-group">
          <a class="button button-primary" href="${routePath("account")}">Tài kho?n</a>
          <button class="icon-button" id="logout-button" type="button" aria-label="Ðang xu?t">${escapeHtml(getInitials(auth.profile?.full_name || auth.user.email))}</button>
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
          <label class="header-search" aria-label="Tìm ki?m hành trình">
            <span class="search-glyph">?</span>
            <input type="search" placeholder="Tìm ki?m chuy?n di..." />
          </label>
          ${authBlock}
        </div>
      </div>
    </header>
  `;
}

function renderFooterShell(auth) {
  if (auth?.isManagement) {
    return `
      <footer class="site-footer site-footer-management">
        <div class="container site-footer-bottom">
          <p>Không gian n?i b? dành cho ${escapeHtml(formatRoleLabel(auth.primaryRole))}.</p>
          <div class="site-footer-meta">
            <span>Dashboard only</span>
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
          <p>Ki?n t?o nh?ng hành trình c?m h?ng, tinh g?n và giàu tr?i nghi?m cho m?i du khách.</p>
          <div class="site-footer-socials">
            <a href="${routePath("home")}" aria-label="Trang ch?">•</a>
            <a href="${routePath("reviews")}" aria-label="Ðánh giá">?</a>
            <a href="${routePath("about-us")}" aria-label="Gi?i thi?u">?</a>
          </div>
        </div>
        <div>
          <h4>Khám phá</h4>
          <a href="${routePath("home")}">Destinations</a>
          <a href="${routePath("tours")}">Tours du l?ch</a>
          <a href="${routePath("reviews")}">Reviews</a>
          <a href="${routePath("destinations")}">Ði?m d?n</a>
        </div>
        <div>
          <h4>Công ty</h4>
          <a href="${routePath("about-us")}">About Us</a>
          <a href="${routePath("privacy-policy")}">Privacy Policy</a>
          <a href="${routePath("terms-and-conditions")}">Terms of Service</a>
          <a href="${routePath("login")}">Login</a>
        </div>
        <div>
          <h4>Newsletter</h4>
          <p>Ðang ký d? nh?n uu dãi tour s?m nh?t và l?ch kh?i hành m?i.</p>
          <form class="footer-newsletter">
            <input type="email" placeholder="Email c?a b?n" />
            <button class="button button-primary" type="button">G?i</button>
          </form>
        </div>
      </div>
      <div class="container site-footer-bottom">
        <p>© 2026 The Horizon Perspective. All rights reserved.</p>
        <div class="site-footer-meta">
          <span>Vietnam</span>
          <span>English (US)</span>
          <span>USD</span>
        </div>
      </div>
    </footer>
  `;
}

export async function mountLayout(pageKey) {
  const auth = await getAuthContext();

  if (shouldLockManagementToDashboard(auth)) {
    window.location.href = routePath("admin");
    return auth;
  }

  const header = qs("#site-header");
  const footer = qs("#site-footer");

  if (header) {
    header.innerHTML = renderHeaderShell(pageKey, auth);
  }

  if (footer) {
    footer.innerHTML = renderFooterShell(auth);
  }

  const logoutButton = qs("#logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await signOut();
      showToast("Ðã dang xu?t kh?i h? th?ng.", "success");
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

  if (!management && auth.isManagement && !isManagementRoute(window.location.pathname)) {
    window.location.href = routePath("admin");
    return null;
  }

  if (management && !auth.isManagement) {
    showToast("B?n không có quy?n truy c?p khu qu?n tr?.", "error");
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
          <p>${escapeHtml(description)}</p>
        </div>
        ${actions ? `<div class="page-hero-actions">${actions}</div>` : ""}
      </div>
    </section>
  `;
}

export function getParam(name) {
  return readSearchParams().get(name);
}

export function setLoading(target, message = "Ðang t?i d? li?u...") {
  target.innerHTML = `<div class="loading-card">${escapeHtml(message)}</div>`;
}

export function setPageError(target, error) {
  target.innerHTML = renderEmptyState("Không th? t?i d? li?u", error?.message || "Ðã có l?i x?y ra.");
}

export function bindAsyncForm(form, callback) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector('[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await callback(new FormData(form));
    } catch (error) {
      showToast(error.message || "Ðã có l?i x?y ra.", "error");
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



