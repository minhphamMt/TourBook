import { formatCurrency, getHomepageData } from "./api.js";
import { normalizeInternalHref, routePath } from "./routes.js";
import { escapeHtml, mountLayout, qs, renderMediaFrame, renderTourCard, setLoading, setPageError } from "./shared.js?v=20260331m";

function renderSectionHeader({ eyebrow, title, actionLabel, actionHref, description = "" }) {
  return `
    <div class="home-section-head">
      <div>
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h2>${escapeHtml(title)}</h2>
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
      </div>
      ${actionLabel && actionHref ? `<a class="home-section-link" href="${actionHref}">${escapeHtml(actionLabel)}</a>` : ""}
    </div>
  `;
}

function getInitials(name) {
  return String(name || "TH")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TH";
}

function renderOptions(items, selected, getValue, getLabel) {
  return items
    .map((item) => {
      const value = getValue(item);
      const active = value === selected ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${active}>${escapeHtml(getLabel(item))}</option>`;
    })
    .join("");
}

function renderStatCard(label, value, hint) {
  return `
    <article class="home-proof-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(hint)}</p>
    </article>
  `;
}

function renderDestinationTile(destination, modifierClass) {
  const href = routePath("tours", { destination: destination.location.slug });
  const priceLabel = destination.startingPrice ? formatCurrency(destination.startingPrice) : "Lien he";
  const media = renderMediaFrame({
    src: destination.featuredImage,
    alt: destination.location.name,
    className: "home-destination-image",
    placeholderLabel: "No destination image in DB"
  });
  return `
    <a class="home-destination-card ${modifierClass}" href="${href}">
      ${media}
      <span class="home-destination-overlay"></span>
      <div class="home-destination-copy">
        <span class="home-destination-region">${escapeHtml(destination.regionLabel || destination.countryLabel || "Destination")}</span>
        <h3>${escapeHtml(destination.location.name)}</h3>
        <p>${destination.totalTours} tours - from ${escapeHtml(priceLabel)}</p>
      </div>
    </a>
  `;
}

function resolveCmsHref(slug) {
  const staticSlugs = ["about-us", "privacy-policy", "terms-and-conditions"];
  return staticSlugs.includes(slug) ? routePath(slug) : routePath("tours");
}

function renderReviewFeed(reviews) {
  if (!reviews.length) {
    return "<div class='empty-state'><h3>Chưa có cảm nhận</h3><p>Review mới nhất sẽ hiển thị ở đây khi hệ thống có dữ liệu duyệt thật.</p></div>";
  }

  const leadReview = reviews[0];
  const secondaryReviews = reviews.slice(1, 3);
  return `
    <section class="home-story-copy">
      <span class="eyebrow">Cảm nhận thật</span>
      <h2>Những chuyến đi đã được khách hàng xác nhận bằng đánh giá thực tế</h2>
      <article class="home-testimonial-card">
        <div class="home-testimonial-stars">★★★★★</div>
        <blockquote>“${escapeHtml(leadReview.comment)}”</blockquote>
        <div class="home-testimonial-author">
          <div class="review-avatar">${escapeHtml(getInitials(leadReview.authorName))}</div>
          <div>
            <strong>${escapeHtml(leadReview.authorName)}</strong>
            <p>${escapeHtml(leadReview.tourName || "Khách hàng The Horizon")}</p>
          </div>
        </div>
      </article>
      <div class="home-review-rail">
        ${secondaryReviews
          .map(
            (review) => `
              <article class="home-review-mini-card">
                <strong>${escapeHtml(review.authorName)}</strong>
                <p>${escapeHtml(review.comment)}</p>
                <span>${escapeHtml(review.tourName || "TourBook")}</span>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderStoryPanel(data) {
  const leadBanner = data.secondaryBanners[0] || data.heroBanner || null;
  const cmsSpotlight = data.cmsSpotlight;
  const bannerMedia = leadBanner
    ? renderMediaFrame({
        src: leadBanner.image_url,
        alt: leadBanner.title || "The Horizon",
        className: "home-banner-image",
        placeholderLabel: "No banner image in DB"
      })
    : "";

  return `
    <section class="home-story-stack">
      ${leadBanner
        ? `
          <a class="home-banner-card" href="${normalizeInternalHref(leadBanner.link_url) || routePath("tours")}">
            ${bannerMedia}
            <span class="home-banner-layer"></span>
            <div class="home-banner-copy">
              <span class="eyebrow eyebrow-light">Banner</span>
              <h3>${escapeHtml(leadBanner.title || "Live banner")}</h3>
              <p>${escapeHtml(leadBanner.placement || "public")}</p>
            </div>
          </a>
        `
        : "<div class='empty-state'><h3>No active banner</h3><p>This area updates automatically when the database has a live public banner.</p></div>"}
      ${cmsSpotlight
        ? `
          <article class="home-editorial-card">
            <span class="eyebrow">CMS Highlight</span>
            <h3>${escapeHtml(cmsSpotlight.title)}</h3>
            <p>${escapeHtml(cmsSpotlight.excerpt || cmsSpotlight.metaDescription || "Content is synced from CMS.")}</p>
            <a class="text-link" href="${resolveCmsHref(cmsSpotlight.slug)}">Read more</a>
          </article>
        `
        : "<div class='empty-state'><h3>No public CMS page</h3><p>This area will render once a published CMS page exists.</p></div>"}
    </section>
  `;
}

function renderCouponSection(coupons) {
  if (!coupons.length) {
    return `
      <section class="home-offer-panel home-offer-panel-empty">
        <div class="home-offer-content">
          <span class="eyebrow eyebrow-light">Ưu đãi</span>
          <h2>Hiện chưa có coupon công khai</h2>
          <p>Khi hệ thống có mã giảm giá đang hoạt động, khối này sẽ hiển thị điều kiện áp dụng và CTA tương ứng.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="home-offer-panel">
      <span class="home-offer-orb home-offer-orb-left"></span>
      <span class="home-offer-orb home-offer-orb-right"></span>
      <div class="home-offer-content home-offer-content-left">
        <span class="eyebrow eyebrow-light">Ưu đãi thật từ DB</span>
        <h2>Mã giảm giá đang mở cho khách đặt tour</h2>
        <p>Tất cả coupon dưới đây đều lấy trực tiếp từ bảng coupons, không có mã demo hoặc số liệu giả.</p>
        <div class="home-coupon-grid">
          ${coupons
            .map(
              (coupon) => `
                <article class="home-coupon-card">
                  <span class="home-coupon-code">${escapeHtml(coupon.code)}</span>
                  <h3>${escapeHtml(coupon.name || coupon.code)}</h3>
                  <p>${escapeHtml(coupon.description)}</p>
                  <div class="home-coupon-meta">
                    <span>${escapeHtml(coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue))}</span>
                    <span>Đơn tối thiểu ${escapeHtml(formatCurrency(coupon.minOrderAmount || 0))}</span>
                  </div>
                  <a class="button button-accent" href="${routePath("tours")}">Xem tour áp dụng</a>
                </article>
              `
            )
            .join("")}
        </div>
      </div>
    </section>
  `;
}

async function init() {
  await mountLayout("home");

  const hero = qs("#home-hero");
  const featured = qs("#featured-tours");
  const featuredSection = qs("#featured-section");
  const destinationSection = qs("#destination-section");
  const destinations = qs("#top-destinations");
  const reviewHighlight = qs("#review-highlight");
  const bannerCard = qs("#hero-banner-card");
  const couponStrip = qs("#coupon-strip");

  [hero, featured, destinations, reviewHighlight, bannerCard, couponStrip].forEach((target) => setLoading(target));

  try {
    const data = await getHomepageData();
    const featuredTours = data.featuredTours.slice(0, 3);
    const destinationItems = data.destinations.slice(0, 4);
    const heroImage = data.heroBanner?.image_url || featuredTours[0]?.coverImage || destinationItems[0]?.featuredImage || null;
    const quickLinks = data.searchFacets.destinations.slice(0, 5);

    hero.innerHTML = `
      <section class="home-hero-shell">
        ${renderMediaFrame({ src: heroImage, alt: data.heroBanner?.title || "The Horizon", className: "home-hero-image", placeholderLabel: "No homepage image in DB" })}
        <div class="home-hero-layer"></div>
        <div class="home-hero-bottom-fade"></div>
        <div class="container home-hero-inner">
          <div class="home-hero-content">
            <span class="eyebrow eyebrow-light">The Horizon</span>
            <h1>${escapeHtml(data.heroBanner?.title || "Tìm chuyến đi phù hợp bằng dữ liệu thật, không phải cảm giác")}</h1>
            <p>Khám phá tour theo điểm đến, ngày khởi hành và nhóm trải nghiệm đang mở công khai trên hệ thống.</p>
            <div class="home-proof-grid">
              ${renderStatCard("Tour công khai", data.stats.publishedTours, "Đang mở trên website")}
              ${renderStatCard("Lịch khởi hành", data.stats.activeDepartures, "Các lịch mở booking thật")}
              ${renderStatCard("Điểm đến", data.stats.destinations, "Có tour đang hiển thị")}
              ${renderStatCard("Review đã duyệt", data.stats.approvedReviews, "Từ khách hàng thật")}
            </div>
            <form class="home-search-panel" action="${routePath("tours")}" method="get">
              <label class="home-search-field">
                <span class="home-search-label">Từ khóa</span>
                <div class="home-search-value">
                  <span class="home-search-icon">⌕</span>
                  <input type="search" name="query" placeholder="Tên tour hoặc trải nghiệm" />
                </div>
              </label>
              <label class="home-search-field">
                <span class="home-search-label">Điểm đến</span>
                <div class="home-search-value">
                  <span class="home-search-icon">⌖</span>
                  <select name="destination">
                    <option value="">Tất cả điểm đến</option>
                    ${renderOptions(data.searchFacets.destinations, "", (item) => item.slug, (item) => item.name)}
                  </select>
                </div>
              </label>
              <label class="home-search-field">
                <span class="home-search-label">Ngày đi</span>
                <div class="home-search-value">
                  <span class="home-search-icon">◷</span>
                  <input type="date" name="date" />
                </div>
              </label>
              <label class="home-search-field">
                <span class="home-search-label">Danh mục</span>
                <div class="home-search-value">
                  <span class="home-search-icon">◎</span>
                  <select name="category">
                    <option value="">Tất cả danh mục</option>
                    ${renderOptions(data.searchFacets.categories, "", (item) => item.slug, (item) => item.name)}
                  </select>
                </div>
              </label>
              <button class="button button-accent home-search-submit" type="submit">Tìm tour phù hợp</button>
            </form>
            <div class="home-hero-actions">
              <a class="button button-primary" href="${routePath("tours", { sort: "popular" })}">Xem tour phổ biến</a>
              <a class="button button-secondary" href="${routePath("destinations")}">Khám phá điểm đến</a>
            </div>
            <div class="home-hero-quicklinks">
              ${quickLinks.map((item) => `<a class="home-hero-chip" href="${routePath("tours", { destination: item.slug })}">${escapeHtml(item.name)}</a>`).join("")}
            </div>
          </div>
        </div>
      </section>
    `;

    featuredSection.innerHTML = renderSectionHeader({
      eyebrow: "Gợi ý từ catalog",
      title: "Tour nổi bật từ dữ liệu đặt chỗ và review",
      description: "Ưu tiên tour đang có tín hiệu thật từ lịch mở, mức độ quan tâm và đánh giá công khai.",
      actionLabel: "Xem tất cả",
      actionHref: routePath("tours", { sort: "popular" })
    });

    featured.innerHTML = featuredTours.length
      ? featuredTours.map((tour) => renderTourCard(tour, { variant: "featured" })).join("")
      : "<div class='empty-state'><h3>Chưa có tour nổi bật</h3><p>Dữ liệu tour sẽ xuất hiện tại đây khi catalog tải thành công.</p></div>";

    destinationSection.innerHTML = renderSectionHeader({
      eyebrow: "Điểm đến",
      title: "Đi theo vùng và điểm chạm thật đang có tour",
      description: "Chỉ hiển thị những nơi đang gắn với tour công khai và có thể deep link sang danh sách đã lọc.",
      actionLabel: "Xem toàn bộ",
      actionHref: routePath("destinations")
    });

    destinations.innerHTML = destinationItems.length
      ? `
        <div class="home-destination-mosaic">
          ${destinationItems[0] ? renderDestinationTile(destinationItems[0], "is-large") : ""}
          ${destinationItems[1] ? renderDestinationTile(destinationItems[1], "is-tall") : ""}
          ${destinationItems[2] ? renderDestinationTile(destinationItems[2], "is-small") : ""}
          ${destinationItems[3] ? renderDestinationTile(destinationItems[3], "is-wide") : ""}
        </div>
      `
      : "<div class='empty-state'><h3>Chưa có điểm đến</h3><p>Khi DB có location gắn với tour public, khu vực này sẽ tự động cập nhật.</p></div>";

    reviewHighlight.innerHTML = renderReviewFeed(data.reviews);
    bannerCard.innerHTML = renderStoryPanel(data);
    couponStrip.innerHTML = renderCouponSection(data.coupons);
  } catch (error) {
    [hero, featured, destinations, reviewHighlight, bannerCard, couponStrip].forEach((target) => setPageError(target, error));
  }
}

void init();

