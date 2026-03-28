import { formatCurrency, formatLongDate, getTourBySlug, toggleWishlist } from "./api.js";
import { routePath } from "./routes.js";
import { escapeHtml, mountLayout, qs, renderReviewCard, setPageError, setLoading, showToast } from "./shared.js";

function getInitials(name) {
  return String(name || "TH")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "TH";
}

function renderList(items, emptyLabel) {
  return items.length
    ? `<ul class="tour-bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="tour-muted-copy">${escapeHtml(emptyLabel)}</p>`;
}

async function init() {
  await mountLayout("tours");

  const slug = new URLSearchParams(window.location.search).get("slug");
  const hero = qs("#tour-hero");
  const gallery = qs("#tour-gallery");
  const overview = qs("#tour-overview");
  const itinerary = qs("#tour-itinerary");
  const route = qs("#tour-route");
  const reviews = qs("#tour-reviews");
  const booking = qs("#tour-booking");

  [hero, gallery, overview, itinerary, route, reviews, booking].forEach((target) => setLoading(target));

  if (!slug) {
    const error = new Error("Thiếu slug tour.");
    [hero, gallery, overview, itinerary, route, reviews, booking].forEach((target) => setPageError(target, error));
    return;
  }

  try {
    const tour = await getTourBySlug(slug);
    if (!tour) {
      throw new Error("Không tìm thấy tour theo slug này.");
    }

    document.title = `${tour.name} | The Horizon`;

    const reviewScore = Number(tour.ratingAverage || 0).toFixed(1);
    const scheduleChoices = tour.schedules.filter((item) => item.status === "open").length
      ? tour.schedules.filter((item) => item.status === "open")
      : tour.schedules;
    const scheduleOptions = scheduleChoices.slice(0, 6);
    const galleryImages = [tour.coverImage, ...tour.gallery.map((item) => item.image_url)]
      .filter(Boolean)
      .filter((image, index, array) => array.indexOf(image) === index)
      .slice(0, 4);
    const routeImage = galleryImages[3] || galleryImages[1] || tour.coverImage;

    hero.innerHTML = `
      <section class="tour-hero-card">
        <nav class="tour-breadcrumbs">
          <a href="${routePath("home")}">Trang chủ</a>
          <span>›</span>
          <a href="${routePath("tours", { destination: tour.destinations[0]?.slug || "" })}">${escapeHtml(tour.destinationLabel)}</a>
          <span>›</span>
          <strong>${escapeHtml(tour.name)}</strong>
        </nav>
        <div class="tour-hero-main">
          <div class="tour-hero-copy">
            <h1>${escapeHtml(tour.name)}</h1>
            <div class="tour-hero-meta">
              <span>★ ${reviewScore} (${tour.reviewCount} đánh giá)</span>
              <span>◷ ${escapeHtml(tour.durationLabel)}</span>
              <span>⌖ ${escapeHtml(tour.destinationLabel)}</span>
            </div>
            <p>${escapeHtml(tour.shortDescription)}</p>
          </div>
          <div class="tour-hero-actions">
            <a class="button button-primary" href="${routePath("checkout", { slug: tour.slug, scheduleId: scheduleOptions[0]?.id || "" })}">Đặt ngay</a>
            <button class="button button-secondary" id="wishlist-toggle" type="button">Lưu wishlist</button>
          </div>
        </div>
      </section>
    `;

    qs("#wishlist-toggle")?.addEventListener("click", async () => {
      try {
        const result = await toggleWishlist(tour.id);
        showToast(result.active ? "Đã thêm tour vào wishlist." : "Đã bỏ tour khỏi wishlist.", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    gallery.innerHTML = `
      <section class="tour-panel tour-gallery-card">
        <div class="tour-section-head">
          <span class="eyebrow">Bộ sưu tập</span>
          <h2>Khung cảnh nổi bật của hành trình</h2>
        </div>
        <div class="tour-gallery-grid">
          ${galleryImages
            .map(
              (image, index) => `
                <div class="tour-gallery-item ${index === 0 ? "is-primary" : index === 3 ? "is-wide" : ""}">
                  <img src="${escapeHtml(image)}" alt="${escapeHtml(`${tour.name} ${index + 1}`)}" />
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    `;

    overview.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Tổng quan</span>
          <h2>Tổng quan chuyến đi</h2>
        </div>
        <p class="tour-panel-copy">${escapeHtml(tour.description)}</p>
        <div class="tour-highlight-grid">
          <article class="tour-highlight-card"><span>◍</span><strong>Khách sạn chất lượng</strong><p>Lịch trình tối ưu giữa nghỉ dưỡng và trải nghiệm thực tế.</p></article>
          <article class="tour-highlight-card"><span>⌘</span><strong>Ăn uống trọn gói</strong><p>Ưu tiên những điểm dừng đáng nhớ và tiện nghi phù hợp.</p></article>
          <article class="tour-highlight-card"><span>✦</span><strong>Đưa đón linh hoạt</strong><p>Điểm hẹn và khung giờ khởi hành luôn được hiển thị rõ ràng.</p></article>
          <article class="tour-highlight-card"><span>◎</span><strong>Hướng dẫn viên</strong><p>Đội ngũ đồng hành giàu kinh nghiệm cho từng cung đường.</p></article>
        </div>
        <div class="tour-bullet-grid">
          <article class="tour-bullet-card">
            <h3>Điểm nổi bật</h3>
            ${renderList(tour.noteItems, "Thông tin nổi bật đang được cập nhật.")}
          </article>
          <article class="tour-bullet-card">
            <h3>Đã bao gồm</h3>
            ${renderList(tour.includedItems, "Danh sách dịch vụ bao gồm đang được cập nhật.")}
          </article>
          <article class="tour-bullet-card">
            <h3>Không bao gồm</h3>
            ${renderList(tour.excludedItems, "Danh sách dịch vụ chưa bao gồm đang được cập nhật.")}
          </article>
        </div>
      </section>
    `;

    itinerary.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Lịch trình</span>
          <h2>Lịch trình chi tiết</h2>
        </div>
        <div class="tour-timeline">
          ${tour.itinerary.length
            ? tour.itinerary
                .map(
                  (day, index) => `
                    <article class="tour-timeline-item">
                      <div class="tour-timeline-index">${index + 1}</div>
                      <div class="tour-timeline-content">
                        <h3>Ngày ${day.day_number}: ${escapeHtml(day.title)}</h3>
                        <p>${escapeHtml(day.description || "Nội dung chi tiết của ngày này đang được cập nhật.")}</p>
                      </div>
                    </article>
                  `
                )
                .join("")
            : "<div class='empty-state'><h3>Chưa có lịch trình</h3><p>Tour này chưa được cập nhật itinerary.</p></div>"}
        </div>
      </section>
    `;

    route.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Lộ trình</span>
          <h2>Lộ trình chuyến đi</h2>
        </div>
        <div class="tour-map-card">
          <img src="${escapeHtml(routeImage)}" alt="${escapeHtml(tour.destinationLabel)}" />
          <div class="tour-map-overlay"></div>
          <div class="tour-map-chip">Xem bản đồ tương tác</div>
        </div>
      </section>
    `;

    reviews.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Đánh giá</span>
          <h2>Đánh giá từ khách hàng</h2>
        </div>
        <div class="review-grid tour-review-grid">
          ${tour.reviews.length
            ? tour.reviews.slice(0, 4).map((review) => renderReviewCard(review)).join("")
            : "<div class='empty-state'><h3>Chưa có review</h3><p>Những cảm nhận mới nhất sẽ xuất hiện tại đây.</p></div>"}
        </div>
      </section>
    `;

    const defaultSchedule = scheduleOptions[0] || null;

    booking.innerHTML = `
      <section class="tour-booking-card">
        <div class="tour-booking-top">
          <span>Giá từ</span>
          <div>
            <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
            <small>/khách</small>
          </div>
        </div>
        <label>
          Ngày khởi hành
          <select id="detail-schedule-select">
            ${scheduleOptions
              .map(
                (schedule) => `<option value="${schedule.id}">${escapeHtml(formatLongDate(schedule.departureDate))}</option>`
              )
              .join("")}
          </select>
        </label>
        <div class="tour-guest-picker">
          <span>Số lượng khách</span>
          <div class="tour-guest-controls">
            <button id="detail-guest-minus" type="button">-</button>
            <strong id="detail-guest-count">02</strong>
            <button id="detail-guest-plus" type="button">+</button>
          </div>
        </div>
        <div class="tour-booking-lines">
          <div class="tour-booking-line"><span>Giá tour</span><strong id="detail-subtotal">${escapeHtml(formatCurrency((defaultSchedule?.basePrice || tour.startingPrice) * 2, tour.baseCurrency))}</strong></div>
          <div class="tour-booking-line"><span>Dịch vụ</span><strong>Miễn phí</strong></div>
          <div class="tour-booking-line is-total"><span>Tổng cộng</span><strong id="detail-total">${escapeHtml(formatCurrency((defaultSchedule?.basePrice || tour.startingPrice) * 2, tour.baseCurrency))}</strong></div>
        </div>
        <a class="button button-primary" id="detail-booking-link" href="${routePath("checkout", { slug: tour.slug, scheduleId: defaultSchedule?.id || "" })}">Đặt ngay</a>
        <a class="button button-secondary" href="${routePath("tours", { destination: tour.destinations[0]?.slug || "" })}">Xem tour liên quan</a>
        <div class="tour-live-viewers">
          <div class="tour-live-avatars">
            ${["Minh Anh", "Hoàng Nam", "Lan Chi"].map((name) => `<span>${escapeHtml(getInitials(name))}</span>`).join("")}
          </div>
          <p>${tour.viewerCount} người khác đang xem tour này</p>
        </div>
      </section>
    `;

    const scheduleSelect = qs("#detail-schedule-select");
    const subtotalNode = qs("#detail-subtotal");
    const totalNode = qs("#detail-total");
    const guestCountNode = qs("#detail-guest-count");
    const bookingLink = qs("#detail-booking-link");
    const minusButton = qs("#detail-guest-minus");
    const plusButton = qs("#detail-guest-plus");
    let guests = 2;

    function syncBookingCard() {
      const activeSchedule = scheduleOptions.find((item) => item.id === scheduleSelect.value) || defaultSchedule;
      const basePrice = activeSchedule?.basePrice || tour.startingPrice;
      const total = basePrice * guests;
      guestCountNode.textContent = String(guests).padStart(2, "0");
      subtotalNode.textContent = formatCurrency(total, activeSchedule?.currency || tour.baseCurrency);
      totalNode.textContent = formatCurrency(total, activeSchedule?.currency || tour.baseCurrency);
      bookingLink.href = routePath("checkout", { slug: tour.slug, scheduleId: activeSchedule?.id || "" });
      minusButton.disabled = guests <= 1;
      plusButton.disabled = guests >= Math.max(2, activeSchedule?.availableSlots || 8);
    }

    scheduleSelect?.addEventListener("change", syncBookingCard);
    minusButton?.addEventListener("click", () => {
      guests = Math.max(1, guests - 1);
      syncBookingCard();
    });
    plusButton?.addEventListener("click", () => {
      const activeSchedule = scheduleOptions.find((item) => item.id === scheduleSelect.value) || defaultSchedule;
      guests = Math.min(Math.max(2, activeSchedule?.availableSlots || 8), guests + 1);
      syncBookingCard();
    });
    syncBookingCard();
  } catch (error) {
    [hero, gallery, overview, itinerary, route, reviews, booking].forEach((target) => setPageError(target, error));
  }
}

void init();
