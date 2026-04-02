import { formatCurrency, formatDateTime, formatLongDate, formatShortDate, getTourBySlug, toggleWishlist } from "./api.js";
import { routePath } from "./routes.js";
import {
  escapeHtml,
  mountLayout,
  qs,
  renderEmptyState,
  renderMediaFrame,
  renderReviewCard,
  renderTourCard,
  setPageError,
  setLoading,
  showToast
} from "./shared.js?v=20260331o";

function renderList(items, emptyLabel) {
  return items.length
    ? `<ul class="tour-bullet-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="tour-muted-copy">${escapeHtml(emptyLabel)}</p>`;
}

function uniqueValues(values = []) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function scheduleStatusLabel(status) {
  const labels = {
    open: "Mo booking",
    sold_out: "Het cho",
    closed: "Da dong",
    completed: "Da di",
    cancelled: "Da huy",
    draft: "Ban nhap"
  };
  return labels[status] || status || "Khong ro";
}

function renderScheduleStatus(status) {
  return `<span class="tour-status-pill tour-status-${escapeHtml(status || "unknown")}">${escapeHtml(scheduleStatusLabel(status))}</span>`;
}

function getVisibleSchedules(tour) {
  const activeSchedules = (tour.schedules || []).filter((schedule) => !["completed", "cancelled"].includes(schedule.displayStatus || schedule.status));
  return activeSchedules.length ? activeSchedules : (tour.schedules || []);
}

function getDefaultSchedule(schedules, preferredScheduleId) {
  return schedules.find((schedule) => schedule.id === preferredScheduleId)
    || schedules.find((schedule) => schedule.isBookable)
    || schedules[0]
    || null;
}

function buildBookingHref(tour, schedule, guests) {
  if (!tour?.slug) return routePath("tours");
  return routePath("checkout", {
    slug: tour.slug,
    scheduleId: schedule?.id || "",
    adults: guests,
    children: 0,
    infants: 0
  });
}

function getScheduleCounts(schedules) {
  return schedules.reduce((accumulator, schedule) => {
    const key = schedule.displayStatus || schedule.status || "unknown";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function renderStatCard(label, value, hint) {
  return `
    <article class="tour-hero-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <p>${escapeHtml(hint)}</p>
    </article>
  `;
}

function renderReviewBreakdown(ratingBreakdown = []) {
  if (!ratingBreakdown.some((item) => item.count > 0)) {
    return `<p class="tour-muted-copy">Review approved từ DB sẽ hiển thị breakdown tại đây ngay khi có đủ dữ liệu.</p>`;
  }

  return `
    <div class="tour-review-breakdown">
      ${ratingBreakdown
        .map((item) => {
          const width = item.count ? Math.max(item.percent, 8) : 0;
          return `
            <div class="tour-review-breakdown-row">
              <span>${escapeHtml(String(item.rating))} sao</span>
              <div class="tour-review-breakdown-track"><span style="width:${width}%"></span></div>
              <strong>${escapeHtml(String(item.count))}</strong>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderScheduleCard(schedule, isActive = false) {
  return `
    <button class="tour-schedule-card ${isActive ? "is-active" : ""}" type="button" data-schedule-id="${escapeHtml(schedule.id)}">
      <div class="tour-schedule-top">
        <div>
          <strong>${escapeHtml(formatLongDate(schedule.departureDate))}</strong>
          <p>${escapeHtml(formatShortDate(schedule.departureDate))} - ${escapeHtml(formatShortDate(schedule.returnDate))}</p>
        </div>
        ${renderScheduleStatus(schedule.displayStatus || schedule.status)}
      </div>
      <div class="tour-schedule-meta">
        <span>${escapeHtml(`${schedule.availableSlots || 0}/${schedule.capacity || 0} cho`)}</span>
        <span>${escapeHtml(schedule.meetingPoint || "?ang c?p nh?t diem gap")}</span>
        <span>${escapeHtml(schedule.meetingAt ? formatDateTime(schedule.meetingAt) : "Ch?a c? gi? t?p trung")}</span>
        <span>${escapeHtml(schedule.cutoffAt ? `Cutoff ${formatDateTime(schedule.cutoffAt)}` : "Kh?ng c? cutoff")}</span>
      </div>
      ${schedule.notes ? `<p class="tour-schedule-note">${escapeHtml(schedule.notes)}</p>` : ""}
      <div class="tour-schedule-foot">
        <strong>${escapeHtml(formatCurrency(schedule.basePrice || 0, schedule.currency || "VND"))}</strong>
        <span>${schedule.isBookable ? "Chon lich nay" : "Chi de tham khao"}</span>
      </div>
    </button>
  `;
}

function renderPolicyBlock(policy) {
  if (!policy) {
    return renderEmptyState("Ch?a co chinh sach huy", "Khi tour gan voi cancellation policy trong DB, quy dinh hoan huy se hien thi tai day.");
  }

  return `
    <div class="tour-policy-stack">
      <p class="tour-muted-copy">${escapeHtml(policy.description)}</p>
      ${policy.rules.length
        ? `<div class="tour-policy-list">${policy.rules
            .map((rule) => `<div class="tour-policy-item"><strong>${escapeHtml(String(rule.daysBefore))} ngay truoc</strong><span>${escapeHtml(String(rule.refundPercent))}% hoan</span></div>`)
            .join("")}</div>`
        : `<p class="tour-muted-copy">Ch?a co rule hoan huy chi tiet.</p>`}
    </div>
  `;
}

function renderJourneyTrack(tour) {
  const stops = [];
  if (tour.departureLocation?.name) stops.push(tour.departureLocation.name);
  (tour.destinations || []).forEach((destination) => {
    if (!stops.includes(destination.name)) stops.push(destination.name);
  });

  if (!stops.length) {
    return renderEmptyState("Ch?a co lo trinh diem den", "Them departure location va tour destinations trong DB de hien thi hanh trinh tai day.");
  }

  return `
    <div class="tour-journey-track">
      ${stops.map((stop) => `<span class="tour-journey-stop">${escapeHtml(stop)}</span>`).join("")}
    </div>
  `;
}

async function init() {
  await mountLayout("tours");

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const preferredScheduleId = params.get("scheduleId") || "";

  const hero = qs("#tour-hero");
  const gallery = qs("#tour-gallery");
  const overview = qs("#tour-overview");
  const availability = qs("#tour-availability");
  const itinerary = qs("#tour-itinerary");
  const route = qs("#tour-route");
  const reviews = qs("#tour-reviews");
  const related = qs("#tour-related");
  const booking = qs("#tour-booking");

  [hero, gallery, overview, availability, itinerary, route, reviews, related, booking].forEach((target) => setLoading(target));

  if (!slug) {
    const error = new Error("Thieu slug tour.");
    [hero, gallery, overview, availability, itinerary, route, reviews, related, booking].forEach((target) => setPageError(target, error));
    return;
  }

  try {
    const tour = await getTourBySlug(slug);
    if (!tour) {
      throw new Error("Khong tim thay tour theo slug nay.");
    }

    document.title = `${tour.name} | The Horizon`;

    const reviewScore = Number(tour.ratingAverage || 0).toFixed(1);
    const visibleSchedules = getVisibleSchedules(tour);
    const defaultSchedule = getDefaultSchedule(visibleSchedules, preferredScheduleId);
    const scheduleCounts = getScheduleCounts(visibleSchedules);
    const galleryImages = [tour.coverImage, ...tour.gallery.map((item) => item.image_url)]
      .filter(Boolean)
      .filter((image, index, array) => array.indexOf(image) === index)
      .slice(0, 4);
    const meetingPoints = uniqueValues(visibleSchedules.map((schedule) => schedule.meetingPoint));
    const scheduleNotes = uniqueValues(visibleSchedules.map((schedule) => schedule.notes)).slice(0, 3);
    const categoryChips = (tour.categories || []).slice(0, 4);
    const relatedTours = (tour.relatedTours || []).slice(0, 3);

    hero.innerHTML = `
      <section class="tour-hero-card">
        <nav class="tour-breadcrumbs">
          <a href="${routePath("home")}">Trang chu</a>
          <span>&rsaquo;</span>
          <a href="${routePath("tours", { destination: tour.destinations[0]?.slug || "" })}">${escapeHtml(tour.destinationLabel)}</a>
          <span>&rsaquo;</span>
          <strong>${escapeHtml(tour.name)}</strong>
        </nav>
        <div class="tour-hero-main">
          <div class="tour-hero-copy">
            <h1>${escapeHtml(tour.name)}</h1>
            <div class="tour-hero-meta">
              <span>? ${reviewScore} (${tour.reviewCount} danh gia)</span>
              <span>? ${escapeHtml(tour.durationLabel)}</span>
              <span>? ${escapeHtml(tour.destinationLabel)}</span>
              <span>${escapeHtml(tour.nextDeparture ? `Kh?i h?nh ${formatShortDate(tour.nextDeparture)}` : "Ch?a c? l?ch s?p t?i")}</span>
            </div>
            <p>${escapeHtml(tour.shortDescription)}</p>
            <div class="tour-chip-row">
              ${categoryChips.map((category) => `<span class="tour-category-chip">${escapeHtml(category.name)}</span>`).join("")}
            </div>
            <div class="tour-hero-stats">
              ${renderStatCard("Lich mo", tour.openScheduleCount, "Dang nhan booking")}
              ${renderStatCard("Cho con", tour.availableSlotCount, "Tong cho kha dung")}
              ${renderStatCard("Khoi hanh", tour.departureLocation?.name || tour.destinationLabel, "Diem tap trung")}
              ${renderStatCard("Huy tour", tour.cancellationPolicy?.name || "Theo dieu kien", "Doc ky truoc khi dat")}
            </div>
          </div>
          <div class="tour-hero-actions">
            <a class="button button-primary" href="#tour-booking-panel">Chon lich va dat tour</a>
            <button class="button button-secondary" id="wishlist-toggle" type="button">L?u wishlist</button>
          </div>
        </div>
      </section>
    `;

    qs("#wishlist-toggle")?.addEventListener("click", async (event) => {
      try {
        const result = await toggleWishlist(tour.id);
        event.currentTarget.textContent = result.active ? "B? kh?i wishlist" : "L?u wishlist";
        showToast(result.active ? "Da them tour vao wishlist." : "Da bo tour khoi wishlist.", "success");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    gallery.innerHTML = `
      <section class="tour-panel tour-gallery-card">
        <div class="tour-section-head">
          <span class="eyebrow">Bo suu tap</span>
          <h2>Hinh anh tu he thong</h2>
        </div>
        <div class="tour-gallery-grid">
          ${galleryImages.length
            ? galleryImages
                .map(
                  (image, index) => `
                    <div class="tour-gallery-item ${index === 0 ? "is-primary" : index === 3 ? "is-wide" : ""}">
                      ${renderMediaFrame({ src: image, alt: `${tour.name} ${index + 1}`, className: "gallery-image", placeholderLabel: "No gallery image in DB" })}
                    </div>
                  `
                )
                .join("")
            : renderEmptyState("Ch?a co gallery", "Tour nay se hien thi hinh anh tai day khi DB co media hop le.")}
        </div>
      </section>
    `;

    overview.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Tong quan</span>
          <h2>Thong tin can biet truoc khi dat</h2>
        </div>
        <p class="tour-panel-copy">${escapeHtml(tour.description)}</p>
        <div class="tour-overview-grid">
          <article class="tour-overview-card">
            <span class="eyebrow">Khoi hanh</span>
            <h3>${escapeHtml(tour.departureLocation?.name || tour.destinationLabel)}</h3>
            <p>${escapeHtml(meetingPoints[0] || "Diem gap se duoc chot theo lich khoi hanh ban chon.")}</p>
          </article>
          <article class="tour-overview-card">
            <span class="eyebrow">Diem den</span>
            <h3>${escapeHtml(tour.destinations.map((item) => item.name).join(" &rsaquo; ") || tour.destinationLabel)}</h3>
            <p>${escapeHtml(tour.regionLabel || "?ang c?p nh?t")}</p>
          </article>
          <article class="tour-overview-card">
            <span class="eyebrow">Chinh sach huy</span>
            <h3>${escapeHtml(tour.cancellationPolicy?.name || "Theo dieu kien tour")}</h3>
            <p>${escapeHtml(tour.cancellationPolicy?.description || "Doc ky dieu kien huy va hoan truoc khi xac nhan thanh toan.")}</p>
          </article>
          <article class="tour-overview-card">
            <span class="eyebrow">Danh muc</span>
            <h3>${escapeHtml(categoryChips.map((item) => item.name).join(" &rsaquo; ") || "Tour công khai")}</h3>
            <p>${escapeHtml(`${tour.openScheduleCount} lịch đang mở ? ${tour.availableSlotCount} chỗ khả dụng`)}</p>
          </article>
        </div>
        <div class="tour-bullet-grid">
          <article class="tour-bullet-card">
            <h3>Dieu can l?u y</h3>
            ${renderList(tour.noteItems, "Thong tin l?u y dang duoc cap nhat.")}
          </article>
          <article class="tour-bullet-card">
            <h3>Da bao gom</h3>
            ${renderList(tour.includedItems, "Danh sach dich vu bao gom dang duoc cap nhat.")}
          </article>
          <article class="tour-bullet-card">
            <h3>Khong bao gom</h3>
            ${renderList(tour.excludedItems, "Danh sach dich vu chua bao gom dang duoc cap nhat.")}
          </article>
          <article class="tour-bullet-card">
            <h3>Dieu kien dat tour</h3>
            ${renderList(tour.termsItems, "Dieu kien thanh toan va huy tour se hien thi khi DB co noi dung.")}
          </article>
        </div>
      </section>
    `;

    availability.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Lich khoi hanh</span>
          <h2>Chon lich phu hop voi nhu cau cua ban</h2>
          <p>Trang nay hien ro trang thai tung lich, so cho con lai, diem gap va moc dong booking.</p>
        </div>
        <div class="tour-schedule-summary-grid">
          ${renderStatCard("Mo booking", scheduleCounts.open || 0, "Co the dat ngay")}
          ${renderStatCard("Het cho", scheduleCounts.sold_out || 0, "Khong nhan them khach")}
          ${renderStatCard("Da dong", scheduleCounts.closed || 0, "Da khoa booking")}
          ${renderStatCard("Da di", scheduleCounts.completed || 0, "Lich da hoan tat")}
        </div>
        <div class="tour-schedule-list">
          ${visibleSchedules.length
            ? visibleSchedules.map((schedule) => renderScheduleCard(schedule, schedule.id === defaultSchedule?.id)).join("")
            : renderEmptyState("Ch?a co lich khoi hanh", "Them departure_schedules trong DB de mo booking cho tour nay.")}
        </div>
      </section>
    `;

    itinerary.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Lich trinh</span>
          <h2>Lich trinh chi tiet</h2>
        </div>
        <div class="tour-timeline">
          ${tour.itinerary.length
            ? tour.itinerary
                .map(
                  (day, index) => `
                    <article class="tour-timeline-item">
                      <div class="tour-timeline-index">${index + 1}</div>
                      <div class="tour-timeline-content">
                        <h3>Ngay ${day.day_number}: ${escapeHtml(day.title)}</h3>
                        <p>${escapeHtml(day.description || "Noi dung chi tiet cua ngay nay dang duoc cap nhat.")}</p>
                      </div>
                    </article>
                  `
                )
                .join("")
            : renderEmptyState("Ch?a co lich trinh", "Tour nay chua duoc cap nhat itinerary trong DB.")}
        </div>
      </section>
    `;

    route.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head">
          <span class="eyebrow">Kh?i h?nh va chinh sach</span>
          <h2>Thong tin van hanh tu du lieu that</h2>
        </div>
        <div class="tour-logistics-grid">
          <article class="tour-logistics-card">
            <h3>Hanh trinh diem den</h3>
            ${renderJourneyTrack(tour)}
          </article>
          <article class="tour-logistics-card">
            <h3>Diem gap</h3>
            ${meetingPoints.length ? `<div class="tour-inline-list">${meetingPoints.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>` : `<p class="tour-muted-copy">Ch?a co diem gap cu the trong DB.</p>`}
          </article>
          <article class="tour-logistics-card">
            <h3>Chinh sach huy tour</h3>
            ${renderPolicyBlock(tour.cancellationPolicy)}
          </article>
          <article class="tour-logistics-card">
            <h3>Ghi chu van hanh</h3>
            ${scheduleNotes.length ? renderList(scheduleNotes, "") : `<p class="tour-muted-copy">Ch?a co ghi chu van hanh cho cac lich hien tai.</p>`}
          </article>
        </div>
      </section>
    `;

    reviews.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head tour-section-head-split">
          <div>
            <span class="eyebrow">Danh gia</span>
            <h2>Phan hoi tu khach da dat tour</h2>
          </div>
          <div class="tour-review-overview">
            <div class="tour-review-summary">
              <strong>${escapeHtml(reviewScore)}</strong>
              <span>${escapeHtml(`${tour.reviewCount} review`)}</span>
              <p>${escapeHtml(tour.reviewCount
                ? `${tour.recommendedPercent || 0}% khách chấm 4-5 sao ? ${tour.replyCount || 0} review đã có phản hồi.`
                : "Review approved từ DB sẽ xuất hiện ngay sau khi được duyệt.")}</p>
            </div>
            <div class="tour-review-breakdown-card">
              ${renderReviewBreakdown(tour.ratingBreakdown || [])}
            </div>
          </div>
        </div>
        <div class="review-grid tour-review-grid">
          ${tour.reviews.length
            ? tour.reviews.slice(0, 4).map((review) => renderReviewCard(review)).join("")
            : renderEmptyState("Ch?a co review", "Nhung cam nhan moi nhat se xuat hien tai day khi co duyet that tu DB.")}
        </div>
      </section>
    `;

    related.innerHTML = `
      <section class="tour-panel">
        <div class="tour-section-head tour-section-head-split">
          <div>
            <span class="eyebrow">Tour lien quan</span>
            <h2>Goi y tiep theo tu catalog that</h2>
          </div>
          <a class="text-link" href="${routePath("tours", { destination: tour.destinations[0]?.slug || "" })}">Xem th?m tour</a>
        </div>
        <div class="tour-related-grid">
          ${relatedTours.length
            ? relatedTours.map((item) => renderTourCard(item, { variant: "featured" })).join("")
            : renderEmptyState("Ch?a co tour lien quan", "He thong se goi y tu nhung tour cung diem den hoac cung danh muc khi catalog co du lieu phu hop.")}
        </div>
      </section>
    `;

    if (!visibleSchedules.length) {
      booking.innerHTML = `
        <section class="tour-booking-card" id="tour-booking-panel">
          ${renderEmptyState("Ch?a mo booking", "Tour nay chua co lich hop le de di tiep sang checkout.")}
          <a class="button button-secondary" href="${routePath("tours")}">Quay lai danh sach tour</a>
        </section>
      `;
      return;
    }

    booking.innerHTML = `
      <section class="tour-booking-card" id="tour-booking-panel">
        <div class="tour-booking-top">
          <span>Gia tu</span>
          <div>
            <strong>${escapeHtml(formatCurrency(tour.startingPrice, tour.baseCurrency))}</strong>
            <small>/khach</small>
          </div>
        </div>
        <div class="tour-booking-status" id="detail-schedule-status"></div>
        <label>
          Lich khoi hanh
          <select id="detail-schedule-select">
            ${visibleSchedules
              .map((schedule) => `<option value="${schedule.id}" ${schedule.id === defaultSchedule?.id ? "selected" : ""}>${escapeHtml(formatLongDate(schedule.departureDate))} &middot; ${escapeHtml(scheduleStatusLabel(schedule.displayStatus || schedule.status))}</option>`)
              .join("")}
          </select>
        </label>
        <div class="tour-booking-meta-stack">
          <div class="tour-booking-line"><span>Diem gap</span><strong id="detail-meeting-point">-</strong></div>
          <div class="tour-booking-line"><span>Tap trung</span><strong id="detail-meeting-time">-</strong></div>
          <div class="tour-booking-line"><span>Dong booking</span><strong id="detail-cutoff">-</strong></div>
          <div class="tour-booking-line"><span>Cho con lai</span><strong id="detail-slots">-</strong></div>
        </div>
        <div class="tour-guest-picker">
          <span>So luong khach</span>
          <div class="tour-guest-controls">
            <button id="detail-guest-minus" type="button">-</button>
            <strong id="detail-guest-count">02</strong>
            <button id="detail-guest-plus" type="button">+</button>
          </div>
        </div>
        <div class="tour-booking-lines">
          <div class="tour-booking-line"><span>Gia tour</span><strong id="detail-subtotal">${escapeHtml(formatCurrency((defaultSchedule?.basePrice || tour.startingPrice) * 2, defaultSchedule?.currency || tour.baseCurrency))}</strong></div>
          <div class="tour-booking-line"><span>Dich vu</span><strong>Da bao gom theo tour</strong></div>
          <div class="tour-booking-line is-total"><span>Tong cong</span><strong id="detail-total">${escapeHtml(formatCurrency((defaultSchedule?.basePrice || tour.startingPrice) * 2, defaultSchedule?.currency || tour.baseCurrency))}</strong></div>
        </div>
        <p class="tour-booking-note" id="detail-booking-note"></p>
        <a class="button button-primary" id="detail-booking-link" href="${buildBookingHref(tour, defaultSchedule, 2)}">Ti?p t?c sang checkout</a>
        <a class="button button-secondary" href="${routePath("tours", { destination: tour.destinations[0]?.slug || "" })}">Xem th?m tour cung diem den</a>
      </section>
    `;

    const scheduleSelect = qs("#detail-schedule-select");
    const statusNode = qs("#detail-schedule-status");
    const subtotalNode = qs("#detail-subtotal");
    const totalNode = qs("#detail-total");
    const guestCountNode = qs("#detail-guest-count");
    const bookingLink = qs("#detail-booking-link");
    const bookingNote = qs("#detail-booking-note");
    const meetingPointNode = qs("#detail-meeting-point");
    const meetingTimeNode = qs("#detail-meeting-time");
    const cutoffNode = qs("#detail-cutoff");
    const slotsNode = qs("#detail-slots");
    const minusButton = qs("#detail-guest-minus");
    const plusButton = qs("#detail-guest-plus");
    const scheduleButtons = Array.from(document.querySelectorAll("[data-schedule-id]"));
    let guests = 2;

    function syncScheduleSelection(scheduleId) {
      scheduleSelect.value = scheduleId;
      scheduleButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.scheduleId === scheduleId));
    }

    function syncBookingCard() {
      const activeSchedule = visibleSchedules.find((item) => item.id === scheduleSelect.value) || defaultSchedule;
      const basePrice = activeSchedule?.basePrice || tour.startingPrice || 0;
      const total = basePrice * guests;
      const availableSlots = Math.max(0, Number(activeSchedule?.availableSlots || 0));
      const maxGuests = activeSchedule?.isBookable ? Math.max(1, availableSlots) : Math.max(1, guests);
      if (activeSchedule?.isBookable) {
        guests = Math.min(maxGuests, Math.max(1, guests));
      }

      guestCountNode.textContent = String(guests).padStart(2, "0");
      subtotalNode.textContent = formatCurrency(total, activeSchedule?.currency || tour.baseCurrency);
      totalNode.textContent = formatCurrency(total, activeSchedule?.currency || tour.baseCurrency);
      meetingPointNode.textContent = activeSchedule?.meetingPoint || "?ang c?p nh?t";
      meetingTimeNode.textContent = activeSchedule?.meetingAt ? formatDateTime(activeSchedule.meetingAt) : "Ch?a c? gi? t?p trung";
      cutoffNode.textContent = activeSchedule?.cutoffAt ? formatDateTime(activeSchedule.cutoffAt) : "Kh?ng c? cutoff";
      slotsNode.textContent = `${availableSlots}/${activeSchedule?.capacity || 0} cho`;
      statusNode.innerHTML = `${renderScheduleStatus(activeSchedule?.displayStatus || activeSchedule?.status)}<span>${escapeHtml(activeSchedule?.notes || "Thong tin lich khoi hanh dang hien thi tu DB.")}</span>`;
      syncScheduleSelection(activeSchedule?.id || "");

      if (activeSchedule?.isBookable) {
        bookingLink.href = buildBookingHref(tour, activeSchedule, guests);
        bookingLink.classList.remove("is-disabled");
        bookingLink.setAttribute("aria-disabled", "false");
        bookingLink.textContent = "Ti?p t?c sang checkout";
        bookingNote.textContent = availableSlots <= 3
          ? `Lich nay con ${availableSlots} cho. Ban nen dat som neu muon giu cho.`
          : `Lich nay dang mo booking va cho phep dat toi da ${availableSlots} khach.`;
      } else {
        bookingLink.href = routePath("tour-detail", { slug: tour.slug, scheduleId: activeSchedule?.id || "" });
        bookingLink.classList.add("is-disabled");
        bookingLink.setAttribute("aria-disabled", "true");
        bookingLink.textContent = "L?ch n?y ch?a th? ??t";
        bookingNote.textContent = activeSchedule?.displayStatus === "sold_out"
          ? "Lich nay da het cho. Hay chon mot lich dang mo booking khac."
          : "Lich nay khong mo booking o thoi diem hien tai.";
      }

      minusButton.disabled = guests <= 1;
      plusButton.disabled = !activeSchedule?.isBookable || guests >= maxGuests;
    }

    scheduleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        syncScheduleSelection(button.dataset.scheduleId || "");
        syncBookingCard();
      });
    });

    scheduleSelect?.addEventListener("change", syncBookingCard);
    minusButton?.addEventListener("click", () => {
      guests = Math.max(1, guests - 1);
      syncBookingCard();
    });
    plusButton?.addEventListener("click", () => {
      guests += 1;
      syncBookingCard();
    });
    bookingLink?.addEventListener("click", (event) => {
      if (bookingLink.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        showToast("Lich nay khong the tiep tuc sang checkout.", "error");
      }
    });

    syncBookingCard();
  } catch (error) {
    [hero, gallery, overview, availability, itinerary, route, reviews, related, booking].forEach((target) => setPageError(target, error));
  }
}

void init();

