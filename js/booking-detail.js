import { cancelBooking, createSupportTicket, getBookingByCode, payBooking, submitReview, replySupportTicket } from "./api.js";
import {
  createPageHero,
  guardPage,
  mountLayout,
  qs,
  renderPriceLines,
  renderSectionHeading,
  renderStatusPill,
  setPageError,
  setLoading,
  showToast
} from "./shared.js";

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
      <section class="card split-card">
        ${renderSectionHeading("Booking", "Thông tin chính", "Dữ liệu booking, hành khách, payment và event đều được gọi trực tiếp từ Supabase.")}
        <div class="inline-actions">
          ${renderStatusPill(booking.booking_status)}
          ${renderStatusPill(booking.payment_status)}
        </div>
        <div class="info-grid">
          <div class="card"><small>Khởi hành</small><strong>${booking.snapshot_jsonb?.departure_date || booking.created_at}</strong></div>
          <div class="card"><small>Tổng tiền</small><strong>${booking.total_amount} ${booking.currency}</strong></div>
          <div class="card"><small>Phương thức</small><strong>${booking.snapshot_jsonb?.selected_payment_method || "Đang cập nhật"}</strong></div>
        </div>
      </section>
    `;

    travelers.innerHTML = `
      ${renderSectionHeading("Hành khách", "Danh sách người đi", "Form checkout thuần JS sẽ tạo các traveler rows này khi submit booking.")}
      <div class="timeline">
        ${booking.travelers.length
          ? booking.travelers.map((traveler) => `
              <article class="timeline-item">
                <div>
                  <strong>${traveler.full_name}</strong>
                  <p>${traveler.traveler_type} • ${traveler.nationality || "Chưa cập nhật quốc tịch"}</p>
                </div>
                <span class="chip">${traveler.price_amount || 0} ${booking.currency}</span>
              </article>
            `).join("")
          : "<div class='empty-state'><h3>Chưa có hành khách</h3><p>Booking mới sẽ tự tạo traveler rows.</p></div>"}
      </div>
    `;

    events.innerHTML = `
      ${renderSectionHeading("Lịch sử", "Booking timeline", "Booking events và price lines được tách riêng thành các panel dễ đọc.")}
      <div class="card split-card">
        <h3>Price lines</h3>
        ${renderPriceLines(booking.lines, booking.currency)}
      </div>
      <div class="timeline">
        ${booking.events.length
          ? booking.events.map((event) => `
              <article class="timeline-item">
                <div>
                  <strong>${event.event_type}</strong>
                  <p>${event.note || "Không có ghi chú"}</p>
                </div>
                <span class="chip">${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(event.created_at))}</span>
              </article>
            `).join("")
          : "<div class='empty-state'><h3>Chưa có timeline</h3><p>Sự kiện booking sẽ xuất hiện sau khi bạn tạo hoặc cập nhật booking.</p></div>"}
      </div>
    `;

    const latestTicket = booking.tickets[0] || null;
    support.innerHTML = latestTicket
      ? `
          ${renderSectionHeading("Hỗ trợ", "Ticket hiện tại", "Khách có thể tiếp tục phản hồi trực tiếp từ giao diện static.")}
          <section class="card split-card">
            <div class="inline-summary"><strong>${latestTicket.subject}</strong>${renderStatusPill(latestTicket.status)}</div>
            <div class="timeline">
              ${latestTicket.messages.map((message) => `
                <article class="timeline-item">
                  <div>
                    <strong>${message.sender_type}</strong>
                    <p>${message.message}</p>
                  </div>
                  <span class="chip">${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</span>
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
            ${booking.review ? `<p>Review hiện tại: ${booking.review.comment}</p>` : "<p>Bạn chưa gửi review cho booking này.</p>"}
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
              <label>Nội dung<textarea name="comment" required>${booking.review?.comment || ""}</textarea></label>
              <button class="button button-secondary" type="submit">Gửi review</button>
            </form>
          </section>
        `
      : `
          ${renderSectionHeading("Review", "Đánh giá sau chuyến đi", "Form review sẽ chỉ mở khi booking ở trạng thái completed.")}
          <div class="empty-state"><h3>Chưa thể review</h3><p>Trạng thái booking hiện tại là ${booking.booking_status}.</p></div>
        `;

    actions.innerHTML = `
      <section class="card split-card">
        <span class="eyebrow">Thao tác</span>
        <h2>${booking.booking_code}</h2>
        <p>${booking.tour?.destinationLabel || booking.snapshot_jsonb?.destination_label || "TourBook"}</p>
        <div class="button-row">
          ${["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status) && ["unpaid", "pending", "partially_paid"].includes(booking.payment_status)
            ? '<button class="button button-primary" id="pay-booking-button" type="button">Thanh toán demo</button>'
            : ""}
          ${["pending", "awaiting_payment", "confirmed"].includes(booking.booking_status)
            ? '<button class="button button-danger" id="cancel-booking-button" type="button">Hủy booking</button>'
            : ""}
        </div>
        ${renderPriceLines(booking.lines, booking.currency)}
      </section>
    `;

    qs("#pay-booking-button")?.addEventListener("click", async () => {
      try {
        await payBooking(code);
        showToast("Thanh toán demo thành công.", "success");
        await renderPage(code);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    qs("#cancel-booking-button")?.addEventListener("click", async () => {
      const reason = window.prompt("Lý do hủy booking:", "Tôi muốn đổi lịch.") || "Khách hàng chủ động hủy.";
      try {
        await cancelBooking(code, reason);
        showToast("Đã xử lý yêu cầu hủy booking.", "success");
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
