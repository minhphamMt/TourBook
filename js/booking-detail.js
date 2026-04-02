import {
  bookingEventLabel,
  cancelBooking,
  createSupportTicket,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  getBookingByCode,
  payBooking,
  replySupportTicket,
  submitReview
} from "./api.js";
import {
  createPageHero,
  escapeHtml,
  guardPage,
  mountLayout,
  qs,
  renderMediaFrame,
  renderPriceLines,
  getBookingCoverImage,
  renderSectionHeading,
  renderStatusPill,
  setPageError,
  setLoading,
  showToast
} from "./shared.js?v=20260331o";

function paymentEventLabel(eventName) {
  const labels = {
    payment_requested: "Tạo giao dịch thanh toán",
    payment_paid: "Thanh toán thành công",
    payment_retry_paid: "Thanh toán lại thành công",
    manual_payment_recorded: "Ghi nhận thanh toán thủ công",
    payment_expired: "Hết hạn thanh toán",
    payment_cancelled: "Giao dịch bị hủy",
    refund_requested: "Tạo yêu cầu hoàn tiền",
    refund_processed: "Đã hoàn tiền",
    refund_rejected: "Refund bị từ chối"
  };
  return labels[eventName] || String(eventName || "Payment event");
}

function travelerTypeLabel(type) {
  return type === "adult" ? "Người lớn" : type === "child" ? "Trẻ em" : "Em bé";
}

function buildLifecycleItems(booking) {
  const bookingItems = (booking.events || []).map((event) => ({
    id: `booking-${event.id}`,
    time: event.created_at,
    title: bookingEventLabel(event.event_type),
    detail: event.note || "Không có ghi chú.",
    tone: ["refund_processed", "payment_recorded", "manual_payment_recorded", "cancellation_approved"].includes(event.event_type)
      ? "success"
      : ["refund_rejected", "cancellation_rejected", "payment_expired"].includes(event.event_type)
        ? "danger"
        : "info"
  }));

  const paymentItems = (booking.payments || []).flatMap((payment) => (payment.paymentEvents || []).map((event) => ({
    id: `payment-${event.id}`,
    time: event.processed_at || event.received_at || payment.paid_at || payment.requested_at || payment.created_at,
    title: paymentEventLabel(event.event_name),
    detail: `${payment.provider_name || payment.paymentMethod?.name || "Manual"} • ${formatCurrency(payment.amount, payment.currency || booking.currency || "VND")}`,
    tone: ["payment_paid", "payment_retry_paid", "manual_payment_recorded", "refund_processed"].includes(event.event_name)
      ? "success"
      : ["refund_rejected", "payment_expired", "payment_cancelled"].includes(event.event_name)
        ? "danger"
        : "info"
  })));

  const refundItems = (booking.refunds || []).map((refund) => ({
    id: `refund-${refund.id}`,
    time: refund.refunded_at || refund.created_at,
    title: refund.status === "refunded" ? "Refund completed" : refund.status === "rejected" ? "Refund rejected" : "Refund pending",
    detail: `${formatCurrency(refund.amount, booking.currency || refund.payment?.currency || "VND")} • ${refund.reason || "Không có ghi chú"}`,
    tone: refund.status === "refunded" ? "success" : refund.status === "rejected" ? "danger" : "info"
  }));

  const invoiceItems = (booking.invoices || []).map((invoice) => ({
    id: `invoice-${invoice.id}`,
    time: invoice.issued_at || invoice.created_at,
    title: `Invoice ${invoice.invoice_number}`,
    detail: invoice.company_name || invoice.billing_email || "Yêu cầu hóa đơn đã được tạo.",
    tone: "info"
  }));

  return [...bookingItems, ...paymentItems, ...refundItems, ...invoiceItems]
    .filter((item) => item.time)
    .sort((left, right) => String(right.time).localeCompare(String(left.time)));
}

function renderLifecycleTimeline(booking) {
  const items = buildLifecycleItems(booking);
  if (!items.length) {
    return "<div class='empty-state'><h3>Chưa có timeline</h3><p>Các sự kiện booking, thanh toán và refund sẽ hiển thị tại đây.</p></div>";
  }

  return `<div class="timeline">${items.map((item) => `
    <article class="timeline-item booking-lifecycle-item is-${escapeHtml(item.tone)}">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.detail)}</p>
      </div>
      <span class="chip">${escapeHtml(formatDateTime(item.time))}</span>
    </article>
  `).join("")}</div>`;
}

function renderPaymentPanels(booking) {
  const paymentCards = booking.payments?.length
    ? booking.payments.map((payment) => {
        const paymentEvents = payment.paymentEvents || [];
        const refundRows = payment.refunds || [];
        return `
          <article class="booking-payment-card">
            <div class="booking-payment-head">
              <div>
                <strong>${escapeHtml(payment.paymentMethod?.name || payment.provider_name || "Manual")}</strong>
                <p>${escapeHtml(formatCurrency(payment.amount, payment.currency || booking.currency || "VND"))}</p>
              </div>
              <div class="booking-payment-status">
                ${renderStatusPill(payment.status)}
              </div>
            </div>
            <div class="booking-payment-meta">
              <span>Requested: ${escapeHtml(formatDateTime(payment.requested_at || payment.created_at))}</span>
              <span>${escapeHtml(payment.transaction_code || payment.provider_payment_id || payment.id.slice(0, 8))}</span>
            </div>
            ${paymentEvents.length ? `<div class="booking-payment-events">${paymentEvents.slice(0, 4).map((event) => `<span class="chip">${escapeHtml(paymentEventLabel(event.event_name))}</span>`).join("")}</div>` : ""}
            ${refundRows.length ? `<div class="booking-refund-list">${refundRows.map((refund) => `<div class="booking-refund-row"><span>${escapeHtml(refund.status)}</span><strong>${escapeHtml(formatCurrency(refund.amount, payment.currency || booking.currency || "VND"))}</strong></div>`).join("")}</div>` : ""}
          </article>
        `;
      }).join("")
    : "<div class='empty-state'><h3>Chưa có payment row</h3><p>Checkout sẽ tạo payment record thật trước khi khách thanh toán.</p></div>";

  const invoiceCards = booking.invoices?.length
    ? booking.invoices.map((invoice) => `
        <article class="booking-payment-card">
          <div class="booking-payment-head">
            <div>
              <strong>${escapeHtml(invoice.invoice_number)}</strong>
              <p>${escapeHtml(invoice.company_name || invoice.billing_email || "Invoice request")}</p>
            </div>
            <div class="booking-payment-status">${renderStatusPill(invoice.status || "issued")}</div>
          </div>
          <div class="booking-payment-meta">
            <span>${escapeHtml(invoice.tax_code || "Không có MST")}</span>
            <span>${escapeHtml(formatDateTime(invoice.issued_at || invoice.created_at))}</span>
          </div>
        </article>
      `).join("")
    : "<div class='empty-state'><h3>Chưa có invoice</h3><p>Invoice request thật từ DB sẽ xuất hiện ở đây nếu khách yêu cầu.</p></div>";

  return `
    <div class="booking-payment-stack">
      <section>
        <h3>Payment attempts</h3>
        <div class="booking-payment-stack-inner">${paymentCards}</div>
      </section>
      <section>
        <h3>Invoices</h3>
        <div class="booking-payment-stack-inner">${invoiceCards}</div>
      </section>
    </div>
  `;
}

function canPayBooking(booking) {
  return ["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status)
    && ["unpaid", "pending", "failed"].includes(booking.payment_status);
}

function canCancelBooking(booking) {
  return ["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status);
}

function getPaymentActionLabel(booking) {
  const latestPayment = booking.payments?.[0] || null;
  return latestPayment && ["failed", "cancelled", "expired"].includes(latestPayment.status)
    ? "Thử thanh toán lại"
    : "Thanh toán ngay";
}

async function renderPage(code) {
  const hero = qs("#page-hero");
  const summary = qs("#booking-summary");
  const travelers = qs("#booking-travelers");
  const events = qs("#booking-events");
  const support = qs("#booking-support");
  const review = qs("#booking-review");
  const actions = qs("#booking-actions");

  [summary, travelers, events, support, review, actions].forEach((target) => setLoading(target));

  try {
    const booking = await getBookingByCode(code);
    if (!booking) {
      throw new Error("Không tìm thấy booking theo mã này.");
    }

    hero.innerHTML = createPageHero({
      eyebrow: booking.booking_code,
      title: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
      description: `${booking.contact_name} • ${booking.contact_email} • ${booking.contact_phone}`
    });

    summary.innerHTML = `
      <section class="card split-card booking-overview-card">
        ${renderSectionHeading("Booking", "Thông tin chính", "Màn hình này theo dõi booking, payment, refund và invoice từ cùng một nguồn DB thật.")}
        <div class="inline-actions">
          ${renderStatusPill(booking.booking_status)}
          ${renderStatusPill(booking.payment_status)}
        </div>
        <div class="booking-overview-grid">
          <div class="booking-overview-media">
            ${renderMediaFrame({
              src: getBookingCoverImage(booking),
              alt: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
              className: "booking-overview-image",
              placeholderLabel: "?nh booking chua c�"
            })}
          </div>
          <div class="booking-overview-copy">
            <div class="info-grid">
              <div class="card"><small>Khởi hành</small><strong>${escapeHtml(formatLongDate(booking.snapshot_jsonb?.departure_date || booking.created_at))}</strong></div>
              <div class="card"><small>Tổng tiền</small><strong>${escapeHtml(formatCurrency(booking.total_amount, booking.currency || "VND"))}</strong></div>
              <div class="card"><small>Phương thức</small><strong>${escapeHtml(booking.snapshot_jsonb?.selected_payment_method || booking.payments?.[0]?.paymentMethod?.name || booking.payments?.[0]?.provider_name || "Đang cập nhật")}</strong></div>
              <div class="card"><small>Expires at</small><strong>${escapeHtml(formatDateTime(booking.expires_at))}</strong></div>
            </div>
            ${(booking.refunds || []).length ? `<div class="booking-inline-note is-warning">Booking hiện có ${(booking.refunds || []).length} refund record trong DB.</div>` : ""}
            ${(booking.invoices || []).length ? `<div class="booking-inline-note">Booking này có ${(booking.invoices || []).length} invoice record được liên kết.</div>` : ""}
          </div>
        </div>
      </section>
    `;

    travelers.innerHTML = `
      ${renderSectionHeading("Hành khách", "Danh sách người đi", "Traveler rows này được sinh thật từ checkout và lưu ở bảng booking_travelers.")}
      <div class="timeline">
        ${booking.travelers.length
          ? booking.travelers.map((traveler) => `
              <article class="timeline-item">
                <div>
                  <strong>${escapeHtml(traveler.full_name)}</strong>
                  <p>${escapeHtml(travelerTypeLabel(traveler.traveler_type))} • ${escapeHtml(traveler.nationality || "Chưa cập nhật quốc tịch")}</p>
                </div>
                <span class="chip">${escapeHtml(formatCurrency(traveler.price_amount || 0, booking.currency || "VND"))}</span>
              </article>
            `).join("")
          : "<div class='empty-state'><h3>Chưa có hành khách</h3><p>Booking mới sẽ tự tạo traveler rows khi submit checkout.</p></div>"}
      </div>
    `;

    events.innerHTML = `
      ${renderSectionHeading("Lifecycle", "Booking timeline", "Timeline này gộp booking events, payment events, refund rows và invoice rows từ DB.")}
      <div class="card split-card">
        <h3>Price lines</h3>
        ${renderPriceLines(booking.lines, booking.currency)}
      </div>
      <div class="booking-lifecycle-grid">
        <section class="card split-card">
          <h3>Timeline</h3>
          ${renderLifecycleTimeline(booking)}
        </section>
        <section class="card split-card">
          ${renderPaymentPanels(booking)}
        </section>
      </div>
    `;

    const latestTicket = booking.tickets[0] || null;
    support.innerHTML = latestTicket
      ? `
          ${renderSectionHeading("Hỗ trợ", "Ticket hiện tại", "Khách có thể tiếp tục phản hồi trực tiếp từ trang booking này.")}
          <section class="card split-card">
            <div class="inline-summary"><strong>${escapeHtml(latestTicket.subject)}</strong>${renderStatusPill(latestTicket.status)}</div>
            <div class="timeline">
              ${latestTicket.messages.map((message) => `
                <article class="timeline-item">
                  <div>
                    <strong>${escapeHtml(message.senderName || message.sender_type)}</strong>
                    <p>${escapeHtml(message.message)}</p>
                  </div>
                  <span class="chip">${escapeHtml(formatDateTime(message.created_at))}</span>
                </article>
              `).join("")}
            </div>
            <form id="reply-ticket-form" class="form-grid">
              <label>Phản hồi thêm<textarea name="message" required placeholder="Tiếp tục trao đổi với đội ngũ hỗ trợ..."></textarea></label>
              <button class="button button-secondary" type="submit">Gửi phản hồi</button>
            </form>
          </section>
        `
      : `
          ${renderSectionHeading("Hỗ trợ", "Mở ticket hỗ trợ", "Nếu có vấn đề với booking, bạn có thể gửi ticket trực tiếp từ đây.")}
          <section class="card split-card">
            <form id="create-ticket-form" class="form-grid">
              <label>Tiêu đề<input name="subject" placeholder="Ví dụ: Cần đổi điểm đón" required /></label>
              <label>Nội dung<textarea name="message" required placeholder="Mô tả chi tiết cần hỗ trợ..."></textarea></label>
              <button class="button button-secondary" type="submit">Tạo ticket</button>
            </form>
          </section>
        `;

    review.innerHTML = booking.booking_status === "completed"
      ? `
          ${renderSectionHeading("Review", "Đánh giá chuyến đi", "Khách hoàn thành tour có thể tạo hoặc cập nhật review từ trang booking.")}
          <section class="card split-card">
            ${booking.review ? `<p>Review hiện tại: ${escapeHtml(booking.review.comment || "Khách chưa để lại nội dung.")}</p>` : "<p>Bạn chưa gửi review cho booking này.</p>"}
            <form id="review-form" class="form-grid">
              <label>Điểm số
                <select name="rating">
                  <option value="5">5 sao</option>
                  <option value="4">4 sao</option>
                  <option value="3">3 sao</option>
                  <option value="2">2 sao</option>
                  <option value="1">1 sao</option>
                </select>
              </label>
              <label>Nội dung<textarea name="comment" required>${escapeHtml(booking.review?.comment || "")}</textarea></label>
              <button class="button button-secondary" type="submit">Gửi review</button>
            </form>
          </section>
        `
      : `
          ${renderSectionHeading("Review", "Đánh giá sau chuyến đi", "Form review sẽ chỉ mở khi booking ở trạng thái completed.")}
          <div class="empty-state"><h3>Chưa thể review</h3><p>Trạng thái booking hiện tại là ${escapeHtml(booking.booking_status)}.</p></div>
        `;

    actions.innerHTML = `
      <section class="card split-card booking-action-card">
        <div class="booking-action-media">
          ${renderMediaFrame({
            src: getBookingCoverImage(booking),
            alt: booking.tour?.name || booking.snapshot_jsonb?.tour_name || "Booking",
            className: "booking-action-image",
            placeholderLabel: "?nh tour chua c�"
          })}
        </div>
        <span class="eyebrow">Thao tác</span>
        <h2>${escapeHtml(booking.booking_code)}</h2>
        <p>${escapeHtml(booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "TourBook")}</p>
        <div class="booking-action-stack">
          <div class="booking-action-row"><span>Payment status</span><strong>${escapeHtml(booking.payment_status)}</strong></div>
          <div class="booking-action-row"><span>Booking status</span><strong>${escapeHtml(booking.booking_status)}</strong></div>
          <div class="booking-action-row"><span>Latest payment</span><strong>${escapeHtml(booking.payments?.[0]?.status || "N/A")}</strong></div>
        </div>
        ${booking.booking_status === "cancel_requested" ? '<div class="booking-inline-note is-warning">Yêu cầu hủy đang chờ staff/admin xử lý.</div>' : ""}
        ${(booking.refunds || []).some((refund) => refund.status === "pending") ? '<div class="booking-inline-note is-warning">Refund đã được tạo và đang chờ xử lý.</div>' : ""}
        <div class="button-row">
          ${canPayBooking(booking) ? `<button class="button button-primary" id="pay-booking-button" type="button">${escapeHtml(getPaymentActionLabel(booking))}</button>` : ""}
          ${canCancelBooking(booking) ? '<button class="button button-danger" id="cancel-booking-button" type="button">Gửi yêu cầu hủy</button>' : ""}
        </div>
        ${renderPriceLines(booking.lines, booking.currency)}
      </section>
    `;

    qs("#pay-booking-button")?.addEventListener("click", async () => {
      try {
        await payBooking(code);
        showToast("Đã ghi nhận thanh toán thành công.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    qs("#cancel-booking-button")?.addEventListener("click", async () => {
      const reason = window.prompt("Lý do hủy booking:", "Tôi muốn đổi lịch.") || "Khách hàng chủ động hủy.";
      try {
        await cancelBooking(code, reason);
        showToast("Đã gửi yêu cầu hủy booking.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    qs("#create-ticket-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await createSupportTicket({
          bookingId: booking.id,
          subject: formData.get("subject"),
          message: formData.get("message")
        });
        showToast("Đã tạo ticket hỗ trợ.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    qs("#reply-ticket-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await replySupportTicket({
          ticketId: latestTicket.id,
          message: formData.get("message")
        });
        showToast("Đã gửi phản hồi ticket.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    qs("#review-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      try {
        await submitReview({
          bookingId: booking.id,
          rating: Number(formData.get("rating")),
          comment: formData.get("comment")
        });
        showToast("Đã gửi review thành công.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  } catch (error) {
    [summary, travelers, events, support, review, actions].forEach((target) => setPageError(target, error));
  }
}

async function init() {
  await mountLayout();
  const auth = await guardPage();
  if (!auth) return;

  const code = new URLSearchParams(window.location.search).get("code");
  if (!code) {
    const error = new Error("Thiếu mã booking.");
    ["#booking-summary", "#booking-travelers", "#booking-events", "#booking-support", "#booking-review", "#booking-actions"].forEach((selector) => setPageError(qs(selector), error));
    return;
  }

  await renderPage(code);
}

void init();





