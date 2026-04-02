import { createBooking, formatCurrency, getBookingReferenceData, getCouponPreviewForTour } from "./api.js";
import { routePath } from "./routes.js";
import {
  escapeHtml,
  formatDateTime,
  formatLongDate,
  guardPage,
  mountLayout,
  qs,
  renderMediaFrame,
  setPageError,
  setLoading,
  showToast
} from "./shared.js?v=20260331o";

function parseCount(value, minimum = 0) {
  return Math.max(minimum, Math.trunc(Number(value) || 0));
}

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

function readTravelerDrafts(container) {
  return Array.from(container.querySelectorAll(".checkout-traveler-card")).map((card, index) => ({
    fullName: card.querySelector(`[name="traveler_fullName_${index}"]`)?.value || "",
    email: card.querySelector(`[name="traveler_email_${index}"]`)?.value || "",
    phone: card.querySelector(`[name="traveler_phone_${index}"]`)?.value || "",
    nationality: card.querySelector(`[name="traveler_nationality_${index}"]`)?.value || "Việt Nam"
  }));
}

function renderTravelerFields(container, counts, drafts = []) {
  const plan = getTravelerPlan(counts);
  container.innerHTML = plan.length
    ? `<div class="checkout-traveler-stack">${plan
        .map((traveler, index) => {
          const draft = drafts[index] || {};
          return `
            <article class="checkout-traveler-card">
              <div class="checkout-traveler-head">
                <strong>Hành khách ${index + 1}</strong>
                <span>${travelerLabel(traveler.type)}</span>
              </div>
              <div class="checkout-traveler-grid">
                <label>Họ và tên<input name="traveler_fullName_${index}" required value="${escapeHtml(draft.fullName || "")}" /></label>
                <label>Email<input type="email" name="traveler_email_${index}" value="${escapeHtml(draft.email || "")}" /></label>
                <label>Số điện thoại<input name="traveler_phone_${index}" value="${escapeHtml(draft.phone || "")}" /></label>
                <label>Quốc tịch<input name="traveler_nationality_${index}" value="${escapeHtml(draft.nationality || "Việt Nam")}" /></label>
              </div>
              <input type="hidden" name="traveler_type_${index}" value="${traveler.type}" />
            </article>
          `;
        })
        .join("")}</div>`
    : "<div class='empty-state'><h3>Chưa có hành khách</h3><p>Hãy chọn ít nhất 1 người lớn để tiếp tục đặt tour.</p></div>";
}

function buildInvoiceRequest(form) {
  const enabled = Boolean(form.querySelector('[name="requestInvoice"]')?.checked);
  if (!enabled) return null;
  return {
    enabled,
    companyName: form.querySelector('[name="invoiceCompanyName"]')?.value || "",
    taxCode: form.querySelector('[name="invoiceTaxCode"]')?.value || "",
    billingEmail: form.querySelector('[name="invoiceBillingEmail"]')?.value || "",
    billingAddress: form.querySelector('[name="invoiceBillingAddress"]')?.value || ""
  };
}

function setInvoiceFieldsState(form) {
  const enabled = Boolean(form.querySelector('[name="requestInvoice"]')?.checked);
  const invoiceFields = qs("#invoice-fields", form);
  if (invoiceFields) {
    invoiceFields.hidden = !enabled;
  }

  ["invoiceCompanyName", "invoiceTaxCode", "invoiceBillingEmail", "invoiceBillingAddress"].forEach((name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (!input) return;
    input.required = enabled;
  });
}

function renderInlineNote(message, tone = "info") {
  if (!message) return "";
  return `<div class="checkout-coupon-note is-${tone}">${escapeHtml(message)}</div>`;
}

async function init() {
  await mountLayout("checkout");
  const auth = await guardPage();
  if (!auth) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const preferredScheduleId = params.get("scheduleId") || "";
  const defaultCounts = {
    adults: Math.max(1, parseCount(params.get("adults") || 1)),
    children: parseCount(params.get("children") || 0),
    infants: parseCount(params.get("infants") || 0)
  };
  const hero = qs("#checkout-page-hero");
  const formShell = qs("#booking-form-shell");
  const summary = qs("#checkout-summary");

  setLoading(hero);
  setLoading(formShell);
  setLoading(summary);

  try {
    const data = await getBookingReferenceData(slug, { force: true });
    if (!data.tour) {
      throw new Error("Thiếu slug tour hoặc tour không tồn tại.");
    }
    if (!data.paymentMethods.length) {
      throw new Error("Chưa có phương thức thanh toán nào được cấu hình trong DB.");
    }

    const tour = data.tour;
    const schedules = tour.schedules.filter((schedule) => schedule.isBookable);
    if (!schedules.length) {
      throw new Error("Tour này hiện chưa có lịch mở booking hợp lệ.");
    }

    hero.innerHTML = `
      <section class="checkout-hero">
        <div class="checkout-hero-copy">
          <span class="eyebrow">Checkout</span>
          <h1>Hoàn tất đặt chỗ của bạn</h1>
          <p>Toàn bộ giá, lịch khởi hành và ưu đãi đều đang lấy trực tiếp từ DB hiện tại của hệ thống.</p>
        </div>
        <div class="checkout-steps" aria-label="Các bước checkout">
          <div class="checkout-step is-active"><span>1</span><strong>Thông tin khách hàng</strong></div>
          <div class="checkout-step"><span>2</span><strong>Tạo booking</strong></div>
          <div class="checkout-step"><span>3</span><strong>Thanh toán</strong></div>
        </div>
      </section>
    `;

    formShell.innerHTML = `
      <form id="booking-form" class="checkout-form">
        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Thông tin khách hàng</h2>
            <p>Hệ thống sẽ dùng các thông tin này để tạo booking, gửi xác nhận và hỗ trợ sau bán.</p>
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
            <label class="checkout-field-full">
              Yêu cầu đặc biệt
              <textarea name="customerNote" placeholder="Ví dụ: Chế độ ăn uống, dị ứng, hỗ trợ di chuyển hoặc lưu ý về phòng ở..."></textarea>
            </label>
          </div>
        </section>

        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Thông tin chuyến đi</h2>
            <p>Chỉ hiển thị các lịch còn book được theo dữ liệu thời gian thực.</p>
          </div>
          <div class="checkout-form-grid">
            <label>
              Ngày khởi hành
              <select name="scheduleId" id="schedule-select">
                ${schedules
                  .map(
                    (schedule) => `<option value="${schedule.id}">${escapeHtml(formatLongDate(schedule.departureDate))} • ${escapeHtml(String(schedule.availableSlots))} chỗ</option>`
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
              <label>Người lớn<input type="number" min="1" name="adults" value="${escapeHtml(String(defaultCounts.adults))}" /></label>
              <label>Trẻ em<input type="number" min="0" name="children" value="${escapeHtml(String(defaultCounts.children))}" /></label>
              <label>Em bé<input type="number" min="0" name="infants" value="${escapeHtml(String(defaultCounts.infants))}" /></label>
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

        <section class="checkout-card">
          <div class="checkout-card-head">
            <h2>Hóa đơn</h2>
            <p>Nếu cần xuất hóa đơn, booking sẽ tạo luôn invoice request thật trong DB.</p>
          </div>
          <label class="checkout-toggle">
            <input type="checkbox" name="requestInvoice" />
            <span class="checkout-toggle-copy">
              <strong>Yêu cầu xuất hóa đơn cho booking này</strong>
              <small>Thông tin sẽ được lưu vào bảng invoices để staff/admin xử lý tiếp.</small>
            </span>
          </label>
          <div class="checkout-form-grid checkout-invoice-grid" id="invoice-fields" hidden>
            <label>
              Tên công ty
              <input name="invoiceCompanyName" placeholder="Công ty TNHH ABC" />
            </label>
            <label>
              Mã số thuế
              <input name="invoiceTaxCode" placeholder="0123456789" />
            </label>
            <label>
              Email nhận hóa đơn
              <input type="email" name="invoiceBillingEmail" value="${escapeHtml(auth.profile?.email || auth.user.email || "")}" placeholder="billing@example.com" />
            </label>
            <label class="checkout-field-full">
              Địa chỉ xuất hóa đơn
              <textarea name="invoiceBillingAddress" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"></textarea>
            </label>
          </div>
        </section>

        <div class="checkout-actions">
          <a class="checkout-back-link" href="${routePath("tour-detail", { slug: tour.slug })}">← Quay lại</a>
          <button class="button button-primary" type="submit">Tạo booking</button>
        </div>
      </form>
    `;

    const form = qs("#booking-form");
    const travelerFields = qs("#traveler-fields", form);
    const scheduleSelect = qs("#schedule-select", form);
    const countInputs = ["adults", "children", "infants"].map((name) => form.querySelector(`[name="${name}"]`));
    const couponInput = form.querySelector('[name="couponCode"]');
    const paymentMethodSelect = form.querySelector('[name="paymentMethodCode"]');
    const submitButton = form.querySelector('[type="submit"]');
    const invoiceToggle = form.querySelector('[name="requestInvoice"]');
    const contactEmailInput = form.querySelector('[name="contactEmail"]');
    const invoiceEmailInput = form.querySelector('[name="invoiceBillingEmail"]');

    if (preferredScheduleId && schedules.some((schedule) => schedule.id === preferredScheduleId)) {
      scheduleSelect.value = preferredScheduleId;
    }

    function getCounts() {
      return {
        adults: parseCount(form.querySelector('[name="adults"]').value || 0),
        children: parseCount(form.querySelector('[name="children"]').value || 0),
        infants: parseCount(form.querySelector('[name="infants"]').value || 0)
      };
    }

    function getCheckoutState() {
      const schedule = schedules.find((item) => item.id === scheduleSelect.value) || schedules[0];
      const counts = getCounts();
      const couponCode = couponInput.value.trim();
      const couponPreview = couponCode
        ? getCouponPreviewForTour(data.coupons, tour, counts, schedule.id).find((item) => item.coupon.code.toLowerCase() === couponCode.toLowerCase()) || null
        : null;
      const subtotal = computeSubtotal(schedule, counts);
      const discount = couponPreview?.discountAmount || 0;
      const total = Math.max(0, subtotal - discount);
      const guestTotal = (counts.adults || 0) + (counts.children || 0) + (counts.infants || 0);
      const validationMessages = [];

      if (counts.adults < 1) {
        validationMessages.push("Booking cần ít nhất 1 người lớn.");
      }
      if (guestTotal < 1) {
        validationMessages.push("Hãy chọn ít nhất 1 hành khách để tiếp tục.");
      }
      if (guestTotal > schedule.availableSlots) {
        validationMessages.push(`Lịch này chỉ còn ${schedule.availableSlots} chỗ trống.`);
      }
      if (schedule.cutoffAt && new Date(schedule.cutoffAt).getTime() <= Date.now()) {
        validationMessages.push("Lịch này đã qua thời hạn nhận booking.");
      }
      if (couponCode && !couponPreview) {
        validationMessages.push("Mã giảm giá chưa hợp lệ cho lịch và tổng tiền hiện tại.");
      }

      return {
        schedule,
        counts,
        couponCode,
        couponPreview,
        subtotal,
        discount,
        total,
        guestTotal,
        validationMessages,
        canSubmit: schedule.isBookable && validationMessages.length === 0
      };
    }

    function renderSummary() {
      setInvoiceFieldsState(form);
      const state = getCheckoutState();
      const travelerDrafts = readTravelerDrafts(travelerFields);
      renderTravelerFields(travelerFields, state.counts, travelerDrafts);

      submitButton.disabled = !state.canSubmit;
      submitButton.textContent = state.canSubmit ? "Tạo booking" : "Kiểm tra lại booking";

      summary.innerHTML = `
        <div class="checkout-summary-stack">
          <section class="checkout-summary-card">
            <div class="checkout-summary-media">
              ${renderMediaFrame({ src: tour.coverImage, alt: tour.name, className: "checkout-summary-image", placeholderLabel: "?nh tour chua c�" })}
              <span class="checkout-summary-badge">${escapeHtml(state.schedule.availableSlots > 0 ? `${state.schedule.availableSlots} chỗ trống` : "Sold out")}</span>
            </div>
            <div class="checkout-summary-body">
              <h3>${escapeHtml(tour.name)}</h3>
              <p>${escapeHtml(tour.destinationLabel)}</p>
              <div class="checkout-summary-rows">
                <div><span>Ngày khởi hành</span><strong>${escapeHtml(formatLongDate(state.schedule.departureDate))}</strong></div>
                <div><span>Số lượng khách</span><strong>${escapeHtml(String(state.guestTotal))} hành khách</strong></div>
                <div><span>Điểm hẹn</span><strong>${escapeHtml(state.schedule.meetingPoint || "Đang cập nhật")}</strong></div>
                ${state.schedule.meetingAt ? `<div><span>Giờ tập trung</span><strong>${escapeHtml(formatDateTime(state.schedule.meetingAt))}</strong></div>` : ""}
                ${state.schedule.cutoffAt ? `<div><span>Hạn giữ chỗ</span><strong>${escapeHtml(formatDateTime(state.schedule.cutoffAt))}</strong></div>` : ""}
                <div><span>Thanh toán</span><strong>${escapeHtml(paymentMethodSelect.selectedOptions[0]?.textContent || "Đang cập nhật")}</strong></div>
              </div>
              <div class="checkout-price-lines">
                <div><span>Giá tour</span><strong>${escapeHtml(formatCurrency(state.subtotal, state.schedule.currency))}</strong></div>
                <div><span>Thuế & phí</span><strong>Đã bao gồm</strong></div>
                <div><span>Giảm giá</span><strong>${state.discount ? `- ${escapeHtml(formatCurrency(state.discount, state.schedule.currency))}` : "0 ₫"}</strong></div>
              </div>
              <div class="checkout-total-row">
                <span>Tổng cộng</span>
                <strong>${escapeHtml(formatCurrency(state.total, state.schedule.currency))}</strong>
              </div>
              <div class="checkout-summary-notes">
                ${state.couponPreview ? renderInlineNote(`Áp dụng mã ${state.couponPreview.coupon.code} thành công.`, "success") : ""}
                ${state.schedule.notes ? renderInlineNote(state.schedule.notes, "info") : ""}
                ${state.validationMessages.map((message) => renderInlineNote(message, "warning")).join("")}
              </div>
            </div>
          </section>
          <section class="checkout-secure-card">
            <strong>Booking sẽ được tạo trực tiếp trên DB</strong>
            <p>Sau khi submit, booking mới phải xuất hiện đồng thời ở account và admin, không qua local fallback.</p>
          </section>
        </div>
      `;
    }

    countInputs.forEach((input) => input.addEventListener("input", renderSummary));
    scheduleSelect.addEventListener("change", renderSummary);
    couponInput.addEventListener("input", renderSummary);
    paymentMethodSelect.addEventListener("change", renderSummary);
    invoiceToggle.addEventListener("change", renderSummary);
    contactEmailInput.addEventListener("change", () => {
      if (!invoiceEmailInput.value.trim()) {
        invoiceEmailInput.value = contactEmailInput.value.trim();
      }
    });
    renderSummary();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const state = getCheckoutState();
      if (!state.canSubmit) {
        renderSummary();
        showToast(state.validationMessages[0] || "Vui lòng kiểm tra lại thông tin booking.", "error");
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = "Đang tạo booking...";

      try {
        const plan = getTravelerPlan(state.counts);
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
          paymentMethodCode: paymentMethodSelect.value,
          couponCode: couponInput.value.trim() || null,
          counts: state.counts,
          contact: {
            fullName: form.querySelector('[name="contactName"]').value,
            email: contactEmailInput.value,
            phone: form.querySelector('[name="contactPhone"]').value
          },
          customerNote: form.querySelector('[name="customerNote"]').value,
          travelers,
          invoiceRequest: buildInvoiceRequest(form)
        });

        showToast("Tạo booking thành công.", "success");
        window.location.href = routePath("booking-detail", { code: booking.booking_code });
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        renderSummary();
      }
    });
  } catch (error) {
    setPageError(hero, error);
    setPageError(formShell, error);
    setPageError(summary, error);
  }
}

void init();



