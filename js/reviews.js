import { getReviewsPageData } from "./api.js";
import { routePath } from "./routes.js";
import {
  createPageHero,
  escapeHtml,
  formatCurrency,
  formatLongDate,
  mountLayout,
  qs,
  renderEmptyState,
  renderMediaFrame,
  setPageError,
  setLoading
} from "./shared.js?v=20260331m";

function getInitials(name) {
  return String(name || "KH")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "KH";
}

function renderStars(rating) {
  const safeRating = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
  return `${"★".repeat(safeRating)}${"☆".repeat(5 - safeRating)}`;
}

function renderRatingBreakdown(breakdown = []) {
  return breakdown
    .map((item) => {
      const width = item.count ? Math.max(item.percent, 8) : 0;
      return `
        <div class="reviews-breakdown-row">
          <span>${escapeHtml(String(item.rating))} sao</span>
          <div class="reviews-breakdown-track"><span style="width:${width}%"></span></div>
          <strong>${escapeHtml(String(item.count))}</strong>
        </div>
      `;
    })
    .join("");
}

function renderHighlightedTours(tours = []) {
  if (!tours.length) {
    return renderEmptyState("Chưa có tour nổi bật từ review", "Khi DB có đủ approved reviews, các tour được đánh giá nhiều nhất sẽ xuất hiện tại đây.");
  }

  return `
    <div class="reviews-highlight-grid">
      ${tours.map((tour) => {
        const detailHref = routePath("tour-detail", { slug: tour.slug });
        return `
          <article class="reviews-highlight-card">
            <a class="reviews-highlight-media" href="${detailHref}">
              ${renderMediaFrame({
                src: tour.coverImage,
                alt: tour.name,
                className: "reviews-highlight-image",
                placeholderLabel: "Chưa có ảnh review từ DB"
              })}
            </a>
            <div class="reviews-highlight-body">
              <div>
                <span class="eyebrow">${escapeHtml(tour.destinationLabel || "Tour")}</span>
                <h3><a href="${detailHref}">${escapeHtml(tour.name)}</a></h3>
                <p>${escapeHtml(tour.shortDescription || tour.description || "Tour này đang có phản hồi thật từ khách đã đi.")}</p>
              </div>
              <div class="reviews-highlight-meta">
                <span>★ ${escapeHtml(Number(tour.ratingAverage || 0).toFixed(1))}</span>
                <span>${escapeHtml(String(tour.reviewCount || 0))} review</span>
                <span>${escapeHtml(tour.startingPrice ? formatCurrency(tour.startingPrice, tour.baseCurrency || "VND") : "Liên hệ")}</span>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function getTourOptions(reviews = []) {
  const items = reviews.reduce((map, review) => {
    if (!review.tourSlug) return map;
    if (!map.has(review.tourSlug)) {
      map.set(review.tourSlug, {
        slug: review.tourSlug,
        name: review.tourName || review.tourSlug
      });
    }
    return map;
  }, new Map());

  return Array.from(items.values()).sort((left, right) => left.name.localeCompare(right.name));
}

function filterReviews(reviews, state) {
  return reviews.filter((review) => {
    const matchesRating = state.rating === "all" || Math.round(Number(review.rating || 0)) === Number(state.rating);
    const matchesTour = state.tourSlug === "all" || review.tourSlug === state.tourSlug;
    return matchesRating && matchesTour;
  });
}

function renderFilters(target, tourOptions, state) {
  const ratingOptions = ["all", "5", "4", "3", "2", "1"];
  target.innerHTML = `
    <section class="reviews-toolbar">
      <div class="reviews-filter-group" role="group" aria-label="Lọc theo số sao">
        ${ratingOptions.map((value) => {
          const label = value === "all" ? "Tất cả" : `${value} sao`;
          return `<button class="reviews-filter-chip ${state.rating === value ? "is-active" : ""}" type="button" data-review-rating="${value}">${escapeHtml(label)}</button>`;
        }).join("")}
      </div>
      <label class="reviews-select">
        <span>Tour</span>
        <select id="reviews-tour-filter">
          <option value="all">Tất cả tour</option>
          ${tourOptions.map((tour) => `<option value="${escapeHtml(tour.slug)}" ${tour.slug === state.tourSlug ? "selected" : ""}>${escapeHtml(tour.name)}</option>`).join("")}
        </select>
      </label>
      <p class="reviews-toolbar-result" id="reviews-result-copy"></p>
    </section>
  `;
}

function renderReviewStoryCard(review, index) {
  const detailHref = review.tourSlug ? routePath("tour-detail", { slug: review.tourSlug }) : routePath("reviews");
  return `
    <article class="reviews-story-card ${index % 5 === 0 ? "is-featured" : ""}">
      <div class="reviews-story-top">
        <div class="reviews-story-author">
          <div class="reviews-story-avatar">${escapeHtml(getInitials(review.authorName))}</div>
          <div>
            <strong>${escapeHtml(review.authorName || "Khách đã đặt tour")}</strong>
            <span>${escapeHtml(review.tourDestinationLabel || review.tourName || "TourBook")}</span>
          </div>
        </div>
        <div class="reviews-story-rating">
          <strong>${escapeHtml(Number(review.rating || 0).toFixed(1))}</strong>
          <span>${escapeHtml(renderStars(review.rating))}</span>
        </div>
      </div>
      <blockquote>"${escapeHtml(review.comment || "Khách hàng chưa để lại nội dung.")}"</blockquote>
      <div class="reviews-story-footer">
        <div class="reviews-story-meta">
          <span>${escapeHtml(formatLongDate(review.createdAt))}</span>
          <a href="${detailHref}">${escapeHtml(review.tourName || "Xem tour")}</a>
        </div>
        ${review.reply ? `<div class="reviews-story-reply"><span>TourBook phản hồi</span><p>${escapeHtml(review.reply.text)}</p></div>` : ""}
      </div>
    </article>
  `;
}

function renderReviewsGrid(target, resultNode, reviews, allReviews) {
  target.innerHTML = reviews.length
    ? `<div class="reviews-story-grid">${reviews.map((review, index) => renderReviewStoryCard(review, index)).join("")}</div>`
    : renderEmptyState("Không có review khớp bộ lọc", "Hãy đổi số sao hoặc tour để xem thêm đánh giá đã được duyệt từ DB.");

  if (resultNode) {
    resultNode.textContent = reviews.length === allReviews.length
      ? `Hiển thị toàn bộ ${allReviews.length} review đã duyệt.`
      : `Hiển thị ${reviews.length}/${allReviews.length} review khớp bộ lọc.`;
  }
}

async function init() {
  await mountLayout("reviews");
  const hero = qs("#page-hero");
  const summary = qs("#reviews-summary");
  const highlights = qs("#reviews-highlights");
  const filters = qs("#reviews-filters");
  const grid = qs("#reviews-grid");

  hero.innerHTML = createPageHero({
    eyebrow: "Đánh giá",
    title: "Review đã duyệt từ khách thật",
    description: "",
    actions: `<a class="button button-primary" href="${routePath("tours")}">Xem tour đang mở</a>`
  });

  [summary, highlights, filters, grid].forEach((target) => setLoading(target));

  try {
    const data = await getReviewsPageData();
    const state = { rating: "all", tourSlug: "all" };
    const tourOptions = getTourOptions(data.reviews);

    summary.innerHTML = `
      <section class="reviews-summary-grid">
        <article class="reviews-score-card">
          <span class="eyebrow">Điểm trung bình</span>
          <strong>${escapeHtml(Number(data.averageRating || 0).toFixed(1))}</strong>
          <p>${escapeHtml(String(data.totalReviews || 0))} review đã duyệt từ khách hoàn thành booking.</p>
        </article>
        <article class="reviews-breakdown-card">
          <div class="reviews-section-head">
            <div>
              <span class="eyebrow">Phân bố sao</span>
              <h2>Khách đang đánh giá thế nào?</h2>
            </div>
            <strong>${escapeHtml(String(data.recommendedPercent || 0))}% tích cực</strong>
          </div>
          <div class="reviews-breakdown-list">${renderRatingBreakdown(data.ratingBreakdown || [])}</div>
        </article>
        <article class="reviews-metric-card">
          <div class="reviews-mini-metric"><span>Tour có review</span><strong>${escapeHtml(String(data.toursWithReviews || 0))}</strong></div>
          <div class="reviews-mini-metric"><span>Review có reply</span><strong>${escapeHtml(String(data.replyCount || 0))}</strong></div>
          <div class="reviews-mini-metric"><span>Nguồn dữ liệu</span><strong>Supabase</strong></div>
        </article>
      </section>
    `;

    highlights.innerHTML = `
      <section class="reviews-block">
        <div class="reviews-section-head">
          <div>
            <span class="eyebrow">Social proof</span>
            <h2>Tour được nhắc đến nhiều nhất</h2>
          </div>
        </div>
        ${renderHighlightedTours(data.topReviewedTours || [])}
      </section>
    `;

    renderFilters(filters, tourOptions, state);
    const resultCopy = qs("#reviews-result-copy");

    const syncFilteredReviews = () => {
      const visibleReviews = filterReviews(data.reviews, state);
      renderReviewsGrid(grid, resultCopy, visibleReviews, data.reviews);
      filters.querySelectorAll("[data-review-rating]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.reviewRating === state.rating);
      });
    };

    filters.addEventListener("click", (event) => {
      const button = event.target.closest("[data-review-rating]");
      if (!button) return;
      state.rating = button.dataset.reviewRating || "all";
      syncFilteredReviews();
    });

    qs("#reviews-tour-filter", filters)?.addEventListener("change", (event) => {
      state.tourSlug = event.target.value || "all";
      syncFilteredReviews();
    });

    syncFilteredReviews();
  } catch (error) {
    [summary, highlights, filters, grid].forEach((target) => setPageError(target, error));
  }
}

void init();
