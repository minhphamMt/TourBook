import { getHomepageData, formatCurrency } from "./api.js";
import { normalizeInternalHref, routePath } from "./routes.js";
import { escapeHtml, mountLayout, qs, renderTourCard, setLoading, setPageError } from "./shared.js";

function renderSectionHeader({ eyebrow, title, actionLabel, actionHref }) {
  return `
    <div class="home-section-head">
      <div>
        <span class="eyebrow">${escapeHtml(eyebrow)}</span>
        <h2>${escapeHtml(title)}</h2>
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

function renderDestinationTile(destination, modifierClass) {
  const href = routePath("tours", { destination: destination.location.slug });
  return `
    <a class="home-destination-card ${modifierClass}" href="${href}">
      <img src="${escapeHtml(destination.featuredImage)}" alt="${escapeHtml(destination.location.name)}" />
      <span class="home-destination-overlay"></span>
      <div class="home-destination-copy">
        <h3>${escapeHtml(destination.location.name)}</h3>
        <p>${destination.totalTours}+ chuyến khám phá</p>
      </div>
    </a>
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
    const leadReview = data.reviews[0] || null;
    const heroImage = data.heroBanner?.image_url || featuredTours[0]?.coverImage || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80";
    const storyImage = data.secondaryBanners[0]?.image_url || destinationItems[0]?.featuredImage || featuredTours[1]?.coverImage || heroImage;
    const bannerLink = normalizeInternalHref(data.heroBanner?.link_url) || routePath("tours");
    const coupon = data.coupons[0] || null;

    hero.innerHTML = `
      <section class="home-hero-shell">
        <img class="home-hero-image" src="${escapeHtml(heroImage)}" alt="${escapeHtml(data.heroBanner?.title || "The Horizon")}" />
        <div class="home-hero-layer"></div>
        <div class="home-hero-bottom-fade"></div>
        <div class="container home-hero-inner">
          <div class="home-hero-content">
            <span class="eyebrow eyebrow-light">The Horizon</span>
            <h1>${escapeHtml(data.heroBanner?.title || "Khám phá thế giới theo cách của bạn")}</h1>
            <p>Trải nghiệm những hành trình độc bản, từ đỉnh núi hùng vĩ đến những bãi biển thiên đường.</p>
            <form class="home-search-panel" action="${routePath("tours")}" method="get">
              <label class="home-search-field">
                <span class="home-search-label">Địa điểm</span>
                <div class="home-search-value">
                  <span class="home-search-icon">⌖</span>
                  <input type="search" name="query" placeholder="Bạn muốn đi đâu?" />
                </div>
              </label>
              <label class="home-search-field">
                <span class="home-search-label">Thời gian</span>
                <div class="home-search-value">
                  <span class="home-search-icon">◷</span>
                  <input type="date" name="date" />
                </div>
              </label>
              <label class="home-search-field">
                <span class="home-search-label">Hành khách</span>
                <div class="home-search-value">
                  <span class="home-search-icon">◉</span>
                  <select name="travelers">
                    <option value="2">2 khách</option>
                    <option value="4">4 khách</option>
                    <option value="6">6 khách</option>
                  </select>
                </div>
              </label>
              <button class="button button-accent home-search-submit" type="submit">Tìm kiếm</button>
            </form>
            <div class="home-hero-actions">
              <a class="button button-primary" href="${bannerLink}">Khám phá tour</a>
              <a class="button button-secondary" href="${routePath("reviews")}">Xem cảm nhận</a>
            </div>
          </div>
        </div>
      </section>
    `;

    featuredSection.innerHTML = renderSectionHeader({
      eyebrow: "Xu hướng",
      title: "Tour Phổ Biến Nhất",
      actionLabel: "Xem tất cả",
      actionHref: routePath("tours")
    });

    featured.innerHTML = featuredTours.length
      ? featuredTours.map((tour) => renderTourCard(tour, { variant: "featured" })).join("")
      : "<div class='empty-state'><h3>Chưa có tour nổi bật</h3><p>Dữ liệu tour sẽ xuất hiện tại đây khi catalog tải thành công.</p></div>";

    destinationSection.innerHTML = renderSectionHeader({
      eyebrow: "Điểm đến",
      title: "Điểm Đến Hàng Đầu"
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
      : "<div class='empty-state'><h3>Chưa có điểm đến</h3><p>Khi có dữ liệu location public, khu vực này sẽ tự động cập nhật.</p></div>";

    reviewHighlight.innerHTML = leadReview
      ? `
        <section class="home-story-copy">
          <span class="eyebrow">Cảm nhận</span>
          <h2>Họ đã trải nghiệm, còn bạn thì sao?</h2>
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
        </section>
      `
      : "<div class='empty-state'><h3>Chưa có cảm nhận</h3><p>Review mới nhất sẽ hiển thị ở đây.</p></div>";

    bannerCard.innerHTML = `
      <article class="home-story-visual">
        <img src="${escapeHtml(storyImage)}" alt="Trải nghiệm cùng The Horizon" />
      </article>
    `;

    couponStrip.innerHTML = `
      <section class="home-offer-panel">
        <span class="home-offer-orb home-offer-orb-left"></span>
        <span class="home-offer-orb home-offer-orb-right"></span>
        <div class="home-offer-content">
          <span class="eyebrow eyebrow-light">Ưu đãi độc quyền</span>
          <h2>Đừng bỏ lỡ những ưu đãi độc quyền</h2>
          <p>${escapeHtml(coupon?.description || "Đăng ký nhận bản tin để cập nhật điểm đến mới nhất và mã giảm giá cho chuyến đi tiếp theo của bạn.")}</p>
          <div class="home-offer-form">
            <input type="email" placeholder="Email của bạn" />
            <a class="button button-accent" href="${routePath("tours")}">Đăng ký ngay</a>
          </div>
          ${coupon ? `<div class="home-offer-code">Mã hiện có: <strong>${escapeHtml(coupon.code)}</strong> · giảm ${escapeHtml(coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue))}</div>` : ""}
        </div>
      </section>
    `;
  } catch (error) {
    [hero, featured, destinations, reviewHighlight, bannerCard, couponStrip].forEach((target) => setPageError(target, error));
  }
}

void init();
