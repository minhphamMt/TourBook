import { createBooking, formatCurrency, getBookingReferenceData, getCouponPreviewForTour } from "./api.js";
import { routePath } from "./routes.js";
import { escapeHtml, formatLongDate, guardPage, mountLayout, qs, setPageError, setLoading, showToast } from "./shared.js";

function getTravelerPlan(counts) {
  const plan = [];
  ["adult", "child", "infant"].forEach((type) => {
    const amount = Number(counts[type === "adult" ? "adults" : type === "child" ? "children" : "infants"]) || 0;
    for (let index = 0; index < amount; index += 1) {
      plan.push({ type, index });
    }
  });
  return plan;
}

function computeSubtotal(schedule, counts) {
  const priceMap = new Map(schedule.prices.map((price) => [price.travelerType, price.salePrice ?? price.price]));
  return (
    (Number(counts.adults) || 0) * (priceMap.get("adult") || 0) +
    (Number(counts.children) || 0) * (priceMap.get("child") || 0) +
    (Number(counts.infants) || 0) * (priceMap.get("infant") || 0)
  );
}

function travelerLabel(type) {
  return type === "adult" ? "Người lớn" : type === "child" ? "Trẻ em" : "Em bé";
}

function renderTravelerFields(container, counts) {
  const plan = getTravelerPlan(counts);
  container.innerHTML = plan.length
    ? `<div class="checkout-traveler-stack">${plan
        .map(
          (traveler, index) => `
            <article class="checkout-traveler-card">
              <div class="checkout-traveler-head">
                <strong>Hành khách ${index + 1}</strong>
                <span>${travelerLabel(traveler.type)}</span>
              </div>
              <div class="checkout-traveler-grid">
                <label>Họ và tên<input name="traveler_fullName_${index}" required /></label>
                <label>Email<input type="email" name="traveler_email_${index}" /></label>
                <label>Số điện thoại<input name="traveler_phone_${index}" /></label>
                <label>Quốc tịch<input name="traveler_nationality_${index}" value="Việt Nam" /></label>
              </div>
              <input type="hidden" name="traveler_type_${index}" value="${traveler.type}" />
            </article>
          `
        )
        .join("")}</div>`
    : "<div class='empty-state'><h3>Chưa có hành khách</h3><p>Hãy chọn ít nhất 1 người lớn để tiếp tục đặt tour.</p></div>";
}

async function init() {
  await mountLayout("checkout");
  const auth = await guardPage();
  if (!auth) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const preferredScheduleId = params.get("scheduleId") || "";
  const hero = qs("#checkout-page-hero");
  const formShell = qs("#booking-form-shell");
  const summary = qs("#checkout-summary");

  setLoading(hero);
  setLoading(formShell);
  setLoading(summary);

  try {
    const data = await getBookingReferenceData(slug);
    if (!data.tour) {
      throw new Error("Thiếu slug tour hoặc tour không tồn tại.");
    }

    const tour = data.tour;
    const schedules = tour.schedules.filter((schedule) => schedule.status === "open").length
      ? tour.schedules.filter((schedule) => schedule.status === "open")
      : tour.schedules;

    if (!schedules.length) {
      throw new Error("Tour này hiện chưa có lịch mở booking.");
    }

    hero.innerHTML = `
      <section class="checkout-hero">
        <div class="checkout-hero-copy">
          <span class="eyebrow">Checkout</span>
          <h1>Hoàn tất đặt chỗ của bạn</h1>
          <p>Chỉ còn vài bước nữa là bạn sẽ bắt đầu hành trình khám phá đầy kỳ thú cùng The Horizon.</p>
        </div>
        <div class="checkout-steps" aria-label="Các bước checkout">
          <div class="checkout-step is-active"><span>1</span><strong>Thông tin khách hàng</strong></div>
          <div class="checkout-step"><span>2</span><strong>Thanh toán</strong></div>
          <div class="checkout-step"><span>3</span><strong>Xác nhận</strong></div>
        </div>
      </section>
    `;

    formShell.innerHTML = `
      <form id="booking-form" class="checkout-form">
        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Thông tin khách hàng</h2>
            <p>Điền nhanh thông tin liên hệ chính để hệ thống giữ chỗ và gửi xác nhận cho bạn.</p>
          </div>
          <div class="checkout-form-grid">
            <label>
              Họ và tên
              <input name="contactName" required value="${escapeHtml(auth.profile?.full_name || "")}" placeholder="Nguyễn Văn A" />
            </label>
            <label>
              Email
              <input type="email" name="contactEmail" required value="${escapeHtml(auth.profile?.email || auth.user.email || "")}" placeholder="example@gmail.com" />
            </label>
            <label>
              Số điện thoại
              <input name="contactPhone" required value="${escapeHtml(auth.profile?.phone || "")}" placeholder="+84 123 456 789" />
            </label>
            <label>
              Quốc tịch
              <input name="contactNationality" value="Việt Nam" placeholder="Việt Nam" />
            </label>
            <label class="checkout-field-full">
              Yêu cầu đặc biệt
              <textarea name="customerNote" placeholder="Ví dụ: Chế độ ăn uống, dị ứng, hỗ trợ di chuyển hoặc lưu ý về phòng ở..."></textarea>
            </label>
          </div>
        </section>

        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Thông tin chuyến đi</h2>
            <p>Chọn lịch khởi hành, phương thức thanh toán và số lượng hành khách.</p>
          </div>
          <div class="checkout-form-grid">
            <label>
              Ngày khởi hành
              <select name="scheduleId" id="schedule-select">
                ${schedules
                  .map(
                    (schedule) => `<option value="${schedule.id}">${escapeHtml(formatLongDate(schedule.departureDate))}</option>`
                  )
                  .join("")}
              </select>
            </label>
            <label>
              Thanh toán
              <select name="paymentMethodCode">
                ${data.paymentMethods.map((method) => `<option value="${method.code}">${escapeHtml(method.name)}</option>`).join("")}
              </select>
            </label>
            <label>
              Mã giảm giá
              <input name="couponCode" placeholder="Nhập mã nếu có" />
            </label>
            <div class="checkout-count-grid">
              <label>Người lớn<input type="number" min="1" name="adults" value="2" /></label>
              <label>Trẻ em<input type="number" min="0" name="children" value="0" /></label>
              <label>Em bé<input type="number" min="0" name="infants" value="0" /></label>
            </div>
          </div>
        </section>

        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Danh sách hành khách</h2>
            <p>Thông tin này sẽ được ghi vào booking để xuất vé và hỗ trợ nhanh hơn.</p>
          </div>
          <div id="traveler-fields"></div>
        </section>

        <section class="checkout-card checkout-card-muted">
          <div class="checkout-card-head">
            <h2>Thanh toán</h2>
            <p>Vui lòng hoàn thành đầy đủ thông tin khách hàng để tiếp tục bước thanh toán và xác nhận.</p>
          </div>
        </section>

        <div class="checkout-actions">
          <a class="checkout-back-link" href="${routePath("tour-detail", { slug: tour.slug })}">← Quay lại</a>
          <button class="button button-primary" type="submit">Tiếp theo: Thanh toán</button>
        </div>
      </form>
    `;

    const form = qs("#booking-form");
    const travelerFields = qs("#traveler-fields", form);
    const scheduleSelect = qs("#schedule-select", form);
    const countInputs = ["adults", "children", "infants"].map((name) => form.querySelector(`[name="${name}"]`));
    const couponInput = form.querySelector('[name="couponCode"]');

    if (preferredScheduleId && schedules.some((schedule) => schedule.id === preferredScheduleId)) {
      scheduleSelect.value = preferredScheduleId;
    }

    function getCounts() {
      return {
        adults: Number(form.querySelector('[name="adults"]').value || 0),
        children: Number(form.querySelector('[name="children"]').value || 0),
        infants: Number(form.querySelector('[name="infants"]').value || 0)
      };
    }

    function renderSummary() {
      const schedule = schedules.find((item) => item.id === scheduleSelect.value) || schedules[0];
      const counts = getCounts();
      renderTravelerFields(travelerFields, counts);

      const subtotal = computeSubtotal(schedule, counts);
      const couponPreview = couponInput.value
        ? getCouponPreviewForTour(data.coupons, tour, counts, schedule.id).find((item) => item.coupon.code.toLowerCase() === couponInput.value.trim().toLowerCase())
        : null;
      const discount = couponPreview?.discountAmount || 0;
      const total = Math.max(0, subtotal - discount);
      const guestTotal = (counts.adults || 0) + (counts.children || 0) + (counts.infants || 0);

      summary.innerHTML = `
        <div class="checkout-summary-stack">
          <section class="checkout-summary-card">
            <div class="checkout-summary-media">
              <img src="${escapeHtml(tour.coverImage)}" alt="${escapeHtml(tour.name)}" />
              <span class="checkout-summary-badge">Tour Phổ Biến</span>
            </div>
            <div class="checkout-summary-body">
              <h3>${escapeHtml(tour.name)}</h3>
              <p>${escapeHtml(tour.destinationLabel)}</p>
              <div class="checkout-summary-rows">
                <div><span>Ngày khởi hành</span><strong>${escapeHtml(formatLongDate(schedule.departureDate))}</strong></div>
                <div><span>Số lượng khách</span><strong>${guestTotal || 0} hành khách</strong></div>
                <div><span>Thanh toán</span><strong>${escapeHtml(form.querySelector('[name="paymentMethodCode"]').selectedOptions[0]?.textContent || "Đang cập nhật")}</strong></div>
              </div>
              <div class="checkout-price-lines">
                <div><span>Giá tour</span><strong>${escapeHtml(formatCurrency(subtotal, schedule.currency))}</strong></div>
                <div><span>Thuế & phí</span><strong>Đã bao gồm</strong></div>
                <div><span>Giảm giá</span><strong>${discount ? `- ${escapeHtml(formatCurrency(discount, schedule.currency))}` : "0 ₫"}</strong></div>
              </div>
              <div class="checkout-total-row">
                <span>Tổng cộng</span>
                <strong>${escapeHtml(formatCurrency(total, schedule.currency))}</strong>
              </div>
              ${couponPreview ? `<div class="checkout-coupon-note">Áp dụng mã <strong>${escapeHtml(couponPreview.coupon.code)}</strong> thành công.</div>` : ""}
            </div>
          </section>
          <section class="checkout-secure-card">
            <strong>Thanh toán an toàn</strong>
            <p>Dữ liệu của bạn được mã hóa và bảo mật tuyệt đối theo tiêu chuẩn quốc tế.</p>
          </section>
        </div>
      `;
    }

    countInputs.forEach((input) => input.addEventListener("input", renderSummary));
    scheduleSelect.addEventListener("change", renderSummary);
    couponInput.addEventListener("input", renderSummary);
    form.querySelector('[name="paymentMethodCode"]').addEventListener("change", renderSummary);
    renderSummary();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;

      try {
        const counts = getCounts();
        const plan = getTravelerPlan(counts);
        const travelers = plan.map((traveler, index) => ({
          travelerType: traveler.type,
          fullName: form.querySelector(`[name="traveler_fullName_${index}"]`).value,
          email: form.querySelector(`[name="traveler_email_${index}"]`).value,
          phone: form.querySelector(`[name="traveler_phone_${index}"]`).value,
          nationality: form.querySelector(`[name="traveler_nationality_${index}"]`).value
        }));

        const booking = await createBooking({
          tourId: tour.id,
          tourSlug: tour.slug,
          scheduleId: scheduleSelect.value,
          paymentMethodCode: form.querySelector('[name="paymentMethodCode"]').value,
          couponCode: couponInput.value || null,
          counts,
          contact: {
            fullName: form.querySelector('[name="contactName"]').value,
            email: form.querySelector('[name="contactEmail"]').value,
            phone: form.querySelector('[name="contactPhone"]').value
          },
          customerNote: form.querySelector('[name="customerNote"]').value,
          travelers
        });

        showToast("Tạo booking thành công.", "success");
        window.location.href = routePath("booking-detail", { code: booking.booking_code });
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        submitButton.disabled = false;
      }
    });
  } catch (error) {
    setPageError(hero, error);
    setPageError(formShell, error);
    setPageError(summary, error);
  }
}

void init();
