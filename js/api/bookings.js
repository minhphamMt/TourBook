import {
  buildInFilter,
  compactText,
  computeSubtotal,
  createActivityLog,
  createNotification,
  formatCurrency,
  getAuthContext,
  requireAuth,
  restWrite,
  safeSelect,
  safeSingle,
  toNumber
} from "./core.js";
import { getBookingReferenceData, getCouponPreviewForTour, getSiteCatalog } from "./catalog.js";

function bookingEventLabel(type) {
  const labels = {
    booking_created: "Tạo booking",
    payment_recorded: "Ghi nhận thanh toán",
    payment_retry_requested: "Tạo lại phiên thanh toán",
    payment_expired: "Hết hạn thanh toán",
    manual_payment_recorded: "Ghi nhận thanh toán thủ công",
    invoice_requested: "Yêu cầu hóa đơn",
    cancel_requested: "Yêu cầu hủy booking",
    booking_cancelled: "Hủy booking",
    cancellation_approved: "Duyệt hủy booking",
    cancellation_rejected: "Từ chối hủy booking",
    refund_requested: "Tạo yêu cầu hoàn tiền",
    refund_processed: "Hoàn tiền thành công",
    refund_rejected: "Từ chối hoàn tiền",
    support_ticket_created: "Tạo ticket hỗ trợ",
    support_ticket_replied: "Trao đổi ticket",
    review_submitted: "Gửi đánh giá"
  };
  return labels[type] || compactText(type, "Cập nhật booking");
}

function countGuests(counts = {}) {
  return toNumber(counts.adults) + toNumber(counts.children) + toNumber(counts.infants);
}

function normalizeCounts(counts = {}) {
  const normalize = (value) => Math.max(0, Math.trunc(toNumber(value)));
  return {
    adults: normalize(counts.adults),
    children: normalize(counts.children),
    infants: normalize(counts.infants)
  };
}

function getTravelerPrice(schedule, travelerType) {
  const price = (schedule?.prices || []).find((item) => item.travelerType === travelerType);
  return price?.salePrice ?? price?.price ?? 0;
}

function sortByDate(list = [], field = "created_at", direction = "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...list].sort((left, right) => String(left?.[field] || "").localeCompare(String(right?.[field] || "")) * multiplier);
}

function groupBy(list = [], key) {
  return list.reduce((map, item) => {
    const value = typeof key === "function" ? key(item) : item?.[key];
    if (value == null) return map;
    const bucket = map.get(value) || [];
    bucket.push(item);
    map.set(value, bucket);
    return map;
  }, new Map());
}

function buildSnapshot({ tour, schedule, paymentMethod, coupon }) {
  return {
    tour_id: tour.id,
    tour_slug: tour.slug,
    tour_name: tour.name,
    destination_label: tour.destinationLabel,
    departure_date: schedule.departureDate,
    return_date: schedule.returnDate,
    schedule_id: schedule.id,
    selected_payment_method: paymentMethod?.name || paymentMethod?.code || "",
    payment_method_code: paymentMethod?.code || "",
    coupon_code: coupon?.code || null,
    currency: schedule.currency || tour.baseCurrency || "VND"
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function ensureBookableSchedule(schedule) {
  if (!schedule) throw new Error("Lịch khởi hành không hợp lệ.");
  if (!schedule.isBookable || schedule.displayStatus !== "open") {
    throw new Error("Lịch khởi hành hiện không nhận booking.");
  }
  if (schedule.cutoffAt && new Date(schedule.cutoffAt).getTime() <= Date.now()) {
    throw new Error("Đã quá thời hạn giữ chỗ cho lịch khởi hành này.");
  }
  if (schedule.departureDate) {
    const departureDeadline = new Date(`${schedule.departureDate}T23:59:59`).getTime();
    if (Number.isFinite(departureDeadline) && departureDeadline < Date.now()) {
      throw new Error("Lịch khởi hành này đã qua và không thể đặt mới.");
    }
  }
}

function normalizeInvoiceRequest(request, fallbackEmail = "") {
  if (!request?.enabled) return null;

  const companyName = String(request.companyName || "").trim();
  const taxCode = String(request.taxCode || "").trim();
  const billingEmail = String(request.billingEmail || fallbackEmail || "").trim();
  const billingAddress = String(request.billingAddress || "").trim();

  if (!companyName || !taxCode || !billingEmail || !billingAddress) {
    throw new Error("Thiếu thông tin xuất hóa đơn.");
  }
  if (!isValidEmail(billingEmail)) {
    throw new Error("Email nhận hóa đơn không hợp lệ.");
  }

  return {
    companyName,
    taxCode,
    billingEmail,
    billingAddress
  };
}

async function validateCouponUsage(coupon, userId) {
  if (!coupon?.id) return { totalCount: 0, userCount: 0 };

  const [couponUsageRows, userUsageRows] = await Promise.all([
    safeSelect("coupon_usages", { select: "id", coupon_id: `eq.${coupon.id}` }),
    userId
      ? safeSelect("coupon_usages", {
          select: "id",
          coupon_id: `eq.${coupon.id}`,
          user_id: `eq.${userId}`
        })
      : Promise.resolve([])
  ]);

  const totalCount = couponUsageRows.length;
  const userCount = userUsageRows.length;

  if (coupon.usageLimit != null && totalCount >= toNumber(coupon.usageLimit, 0)) {
    throw new Error("Mã giảm giá này đã hết lượt sử dụng.");
  }
  if (coupon.usagePerUserLimit != null && userCount >= toNumber(coupon.usagePerUserLimit, 0)) {
    throw new Error("Bạn đã dùng hết số lần áp dụng cho mã giảm giá này.");
  }

  return { totalCount, userCount };
}

function getLatestPayment(booking) {
  return booking?.payments?.[0] || null;
}

function shouldExpireBooking(booking) {
  const expiresAt = booking?.expires_at ? new Date(booking.expires_at).getTime() : 0;
  if (!expiresAt || Number.isNaN(expiresAt)) return false;
  if (![
    "pending",
    "awaiting_payment"
  ].includes(booking?.booking_status)) return false;
  if (["paid", "partially_paid", "refunded", "partially_refunded"].includes(booking?.payment_status)) return false;
  return expiresAt <= Date.now();
}

async function createBookingEventRecord({ bookingId, actorId = null, eventType, note = "", eventData = {} }) {
  if (!bookingId || !eventType) return null;
  const rows = await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: bookingId,
      actor_id: actorId,
      event_type: eventType,
      note: String(note || "").trim() || null,
      event_data: eventData || {}
    }
  });
  return rows?.[0] || null;
}

async function createPaymentEventRecord({ paymentId, eventName, payload = {}, status = "received", processedAt = null }) {
  if (!paymentId || !eventName) return null;
  const rows = await restWrite("payment_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      payment_id: paymentId,
      event_name: eventName,
      payload: payload || {},
      status,
      processed_at: processedAt
    }
  });
  return rows?.[0] || null;
}

async function resolvePaymentMethodForBooking(booking, payment = null) {
  if (payment?.payment_method_id) {
    return safeSingle("payment_methods", {
      select: "id,code,name,method_type,provider_name,description,is_active",
      id: `eq.${payment.payment_method_id}`
    });
  }

  const methodCode = String(booking?.snapshot_jsonb?.payment_method_code || "").trim();
  if (!methodCode) return null;
  return safeSingle("payment_methods", {
    select: "id,code,name,method_type,provider_name,description,is_active",
    code: `eq.${methodCode}`,
    is_active: "eq.true"
  });
}

async function createPaymentAttemptForBooking(booking, actorId, source = "customer_portal_retry", note = "") {
  const latestPayment = getLatestPayment(booking);
  const paymentMethod = await resolvePaymentMethodForBooking(booking, latestPayment);
  if (!paymentMethod?.id) {
    throw new Error("Không tìm thấy phương thức thanh toán hợp lệ cho booking này.");
  }

  const paymentRows = await restWrite("payments", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      payment_method_id: paymentMethod.id,
      provider_name: paymentMethod.provider_name || paymentMethod.providerName || paymentMethod.name,
      amount: Number(booking.total_amount || latestPayment?.amount || 0),
      currency: booking.currency || latestPayment?.currency || booking.snapshot_jsonb?.currency || "VND",
      status: "pending",
      raw_response: {
        source,
        note: String(note || "").trim() || "Tạo phiên thanh toán mới cho booking.",
        retry_of: latestPayment?.id || null
      }
    }
  });

  const nextPayment = paymentRows?.[0];
  if (!nextPayment?.id) {
    throw new Error("Không thể tạo giao dịch thanh toán mới.");
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await restWrite("bookings", {
    method: "PATCH",
    query: {
      id: `eq.${booking.id}`,
      select: "*"
    },
    body: {
      booking_status: "awaiting_payment",
      payment_status: "pending",
      expires_at: expiresAt
    }
  });

  await createPaymentEventRecord({
    paymentId: nextPayment.id,
    eventName: "payment_requested",
    payload: {
      booking_code: booking.booking_code,
      source,
      retry_of: latestPayment?.id || null,
      amount: Number(nextPayment.amount || 0)
    }
  });

  await createBookingEventRecord({
    bookingId: booking.id,
    actorId,
    eventType: "payment_retry_requested",
    note: String(note || "").trim() || "Đã tạo lại phiên thanh toán cho booking.",
    eventData: {
      payment_id: nextPayment.id,
      retry_of: latestPayment?.id || null,
      source
    }
  });

  return {
    ...nextPayment,
    paymentMethod,
    expiresAt
  };
}

async function syncExpiredBookingIfNeeded(booking, catalogInput = null) {
  if (!shouldExpireBooking(booking)) return booking;

  const now = new Date().toISOString();
  const latestPayment = getLatestPayment(booking);
  if (latestPayment?.id && ["pending", "authorized"].includes(latestPayment.status)) {
    await restWrite("payments", {
      method: "PATCH",
      query: {
        id: `eq.${latestPayment.id}`,
        select: "*"
      },
      body: {
        status: "expired",
        failed_at: now,
        failure_reason: latestPayment.failure_reason || "Payment window expired.",
        raw_response: {
          ...(latestPayment.raw_response || {}),
          expired_at: now,
          source: "booking_expiry_sync"
        }
      }
    });

    await createPaymentEventRecord({
      paymentId: latestPayment.id,
      eventName: "payment_expired",
      payload: {
        booking_code: booking.booking_code,
        expired_at: now
      },
      status: "processed",
      processedAt: now
    });
  }

  await restWrite("bookings", {
    method: "PATCH",
    query: {
      id: `eq.${booking.id}`,
      select: "*"
    },
    body: {
      booking_status: "expired",
      payment_status: "failed",
      expires_at: null
    }
  });

  await createBookingEventRecord({
    bookingId: booking.id,
    actorId: booking.user_id || null,
    eventType: "payment_expired",
    note: "Booking đã hết thời hạn thanh toán.",
    eventData: {
      payment_id: latestPayment?.id || null
    }
  });

  await createActivityLog({
    actorId: booking.user_id || null,
    action: "booking_expired",
    entityType: "booking",
    entityId: booking.id,
    oldData: {
      booking_status: booking.booking_status,
      payment_status: booking.payment_status,
      expires_at: booking.expires_at
    },
    newData: {
      booking_status: "expired",
      payment_status: "failed",
      expires_at: null
    }
  });

  if (booking.user_id) {
    await createNotification({
      userId: booking.user_id,
      title: "Booking hết hạn thanh toán",
      content: `Booking ${booking.booking_code} đã hết thời gian giữ chỗ và được chuyển sang trạng thái expired.`,
      notificationType: "booking",
      referenceType: "booking",
      referenceId: booking.id
    });
  }

  return getHydratedBookingById(booking.id, catalogInput, { syncExpiries: false });
}

function ensureTravelerPayload(counts, travelers) {
  const total = countGuests(counts);
  if (counts.adults < 1) {
    throw new Error("Booking phải có ít nhất 1 người lớn.");
  }
  if (total < 1) {
    throw new Error("Booking phải có ít nhất 1 hành khách.");
  }
  if (!Array.isArray(travelers) || travelers.length !== total) {
    throw new Error("Số lượng hành khách không khớp với booking.");
  }

  const actualCounts = travelers.reduce(
    (accumulator, traveler) => {
      const type = traveler?.travelerType || traveler?.type;
      if (type === "adult") accumulator.adults += 1;
      if (type === "child") accumulator.children += 1;
      if (type === "infant") accumulator.infants += 1;
      return accumulator;
    },
    { adults: 0, children: 0, infants: 0 }
  );

  if (
    actualCounts.adults !== counts.adults ||
    actualCounts.children !== counts.children ||
    actualCounts.infants !== counts.infants
  ) {
    throw new Error("Loại hành khách không khớp với số lượng đã chọn.");
  }

  travelers.forEach((traveler, index) => {
    if (!String(traveler?.fullName || "").trim()) {
      throw new Error(`Thiếu họ tên cho hành khách ${index + 1}.`);
    }
  });
}

function ensureBookingAccess(booking, auth) {
  requireAuth(auth, "Bạn cần đăng nhập để xem booking.");
  if (auth.isManagement) return booking;
  if (!booking) throw new Error("Không tìm thấy booking.");
  if (booking.user_id && booking.user_id === auth.user.id) return booking;
  if (booking.contact_email && auth.user.email && booking.contact_email.toLowerCase() === auth.user.email.toLowerCase()) return booking;
  throw new Error("Bạn không có quyền truy cập booking này.");
}

function hydrateReview(reviewRow, replyRow, booking, profileMap) {
  if (!reviewRow) return null;
  const author = profileMap.get(reviewRow.user_id) || null;
  const replyAuthor = replyRow ? profileMap.get(replyRow.replied_by) || null : null;
  return {
    ...reviewRow,
    bookingId: reviewRow.booking_id,
    tourId: reviewRow.tour_id,
    authorName: author?.full_name || author?.email || booking?.contact_name || "Khách hàng",
    contactName: booking?.contact_name || author?.full_name || author?.email || "Khách hàng",
    createdAt: reviewRow.created_at,
    updatedAt: reviewRow.updated_at,
    tour: booking?.tour || null,
    reply: replyRow
      ? {
          id: replyRow.id,
          text: replyRow.reply_text,
          createdAt: replyRow.created_at,
          authorName: replyAuthor?.full_name || replyAuthor?.email || "Staff"
        }
      : null
  };
}

function hydrateTickets(ticketRows, ticketMessageRows, booking, profileMap) {
  const messagesByTicketId = groupBy(ticketMessageRows, "ticket_id");
  return sortByDate(ticketRows, "updated_at", "desc").map((ticket) => ({
    ...ticket,
    bookingCode: booking?.booking_code || null,
    customerName:
      profileMap.get(ticket.user_id)?.full_name ||
      profileMap.get(ticket.user_id)?.email ||
      booking?.contact_name ||
      "Khách hàng",
    tour: booking?.tour || null,
    messages: sortByDate(messagesByTicketId.get(ticket.id) || [], "created_at", "asc").map((message) => ({
      ...message,
      senderName: profileMap.get(message.sender_id)?.full_name || profileMap.get(message.sender_id)?.email || message.sender_type
    }))
  }));
}

async function loadHydratedBookingsByQuery(query = {}, catalogInput = null, options = {}) {
  const { syncExpiries = true } = options;
  const catalog = catalogInput || (await getSiteCatalog());
  const bookings = await safeSelect("bookings", { select: "*", ...query });
  if (!bookings.length) return [];

  const bookingIds = bookings.map((booking) => booking.id);
  const bookingFilter = buildInFilter(bookingIds);
  const [travelers, lines, events, payments, couponUsages, reviewRows, ticketRows, invoiceRows] = await Promise.all([
    safeSelect("booking_travelers", { select: "*", booking_id: bookingFilter, order: "created_at.asc" }),
    safeSelect("booking_price_lines", { select: "*", booking_id: bookingFilter, order: "created_at.asc" }),
    safeSelect("booking_events", { select: "*", booking_id: bookingFilter, order: "created_at.desc" }),
    safeSelect("payments", { select: "*", booking_id: bookingFilter, order: "requested_at.desc" }),
    safeSelect("coupon_usages", { select: "*", booking_id: bookingFilter, order: "created_at.desc" }),
    safeSelect("reviews", { select: "*", booking_id: bookingFilter, order: "created_at.desc" }),
    safeSelect("support_tickets", { select: "*", booking_id: bookingFilter, order: "updated_at.desc" }),
    safeSelect("invoices", { select: "*", booking_id: bookingFilter, order: "created_at.desc" })
  ]);

  const ticketIds = ticketRows.map((ticket) => ticket.id);
  const reviewIds = reviewRows.map((review) => review.id);
  const paymentIds = payments.map((payment) => payment.id).filter(Boolean);
  const paymentMethodIds = payments.map((payment) => payment.payment_method_id).filter(Boolean);
  const profileIds = [
    ...bookings.map((booking) => booking.user_id),
    ...events.map((event) => event.actor_id),
    ...ticketRows.map((ticket) => ticket.user_id),
    ...ticketRows.map((ticket) => ticket.assigned_to),
    ...reviewRows.map((review) => review.user_id),
    ...payments.map((payment) => payment.requested_by),
    ...payments.map((payment) => payment.created_by)
  ];

  const [ticketMessages, reviewReplies, profiles, paymentMethods, paymentEventRows, refundRows] = await Promise.all([
    ticketIds.length
      ? safeSelect("support_ticket_messages", { select: "*", ticket_id: buildInFilter(ticketIds), order: "created_at.asc" })
      : Promise.resolve([]),
    reviewIds.length
      ? safeSelect("review_replies", { select: "*", review_id: buildInFilter(reviewIds) })
      : Promise.resolve([]),
    profileIds.length
      ? safeSelect("profiles", {
          select: "id,email,full_name,avatar_url,customer_level",
          id: buildInFilter(profileIds.filter(Boolean))
        })
      : Promise.resolve([]),
    paymentMethodIds.length
      ? safeSelect("payment_methods", { select: "id,code,name,method_type,provider_name,description", id: buildInFilter(paymentMethodIds) })
      : Promise.resolve([]),
    paymentIds.length
      ? safeSelect("payment_events", { select: "*", payment_id: buildInFilter(paymentIds), order: "received_at.desc" })
      : Promise.resolve([]),
    paymentIds.length
      ? safeSelect("refunds", { select: "*", payment_id: buildInFilter(paymentIds), order: "created_at.desc" })
      : Promise.resolve([])
  ]);

  const travelerMap = groupBy(travelers, "booking_id");
  const lineMap = groupBy(lines, "booking_id");
  const eventMap = groupBy(events, "booking_id");
  const paymentMap = groupBy(payments, "booking_id");
  const couponUsageMap = groupBy(couponUsages, "booking_id");
  const reviewMap = groupBy(reviewRows, "booking_id");
  const reviewReplyMap = groupBy(reviewReplies, "review_id");
  const ticketMap = groupBy(ticketRows, "booking_id");
  const invoiceMap = groupBy(invoiceRows, "booking_id");
  const paymentEventMap = groupBy(paymentEventRows, "payment_id");
  const refundMap = groupBy(refundRows, "payment_id");
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const paymentMethodMap = new Map(paymentMethods.map((method) => [method.id, method]));
  const tourMap = new Map(catalog.tours.map((tour) => [tour.id, tour]));
  const scheduleMap = new Map(catalog.tours.flatMap((tour) => tour.schedules.map((schedule) => [schedule.id, schedule])));

  const hydratedBookings = bookings.map((booking) => {
    const bookingPayments = sortByDate(paymentMap.get(booking.id) || [], "requested_at", "desc").map((payment) => ({
      ...payment,
      paymentMethod: paymentMethodMap.get(payment.payment_method_id) || null,
      paymentEvents: sortByDate(paymentEventMap.get(payment.id) || [], "received_at", "desc"),
      refunds: sortByDate(refundMap.get(payment.id) || [], "created_at", "desc")
    }));
    const bookingReviewRow = (reviewMap.get(booking.id) || [])[0] || null;
    const bookingReplyRow = bookingReviewRow ? (reviewReplyMap.get(bookingReviewRow.id) || [])[0] || null : null;
    const bookingTour = tourMap.get(booking.tour_id) || null;
    const hydrated = {
      ...booking,
      totalGuests: countGuests({ adults: booking.adult_count, children: booking.child_count, infants: booking.infant_count }),
      tour: bookingTour,
      schedule: scheduleMap.get(booking.schedule_id) || null,
      travelers: travelerMap.get(booking.id) || [],
      lines: lineMap.get(booking.id) || [],
      events: sortByDate(eventMap.get(booking.id) || [], "created_at", "desc"),
      payments: bookingPayments,
      payment: bookingPayments[0] || null,
      refunds: bookingPayments.flatMap((payment) => payment.refunds || []),
      couponUsage: (couponUsageMap.get(booking.id) || [])[0] || null,
      invoices: invoiceMap.get(booking.id) || []
    };

    hydrated.review = hydrateReview(bookingReviewRow, bookingReplyRow, hydrated, profileMap);
    hydrated.tickets = hydrateTickets(ticketMap.get(booking.id) || [], ticketMessages, hydrated, profileMap);
    return hydrated;
  });

  if (syncExpiries) {
    const expiredBookings = hydratedBookings.filter((booking) => shouldExpireBooking(booking));
    if (expiredBookings.length) {
      await Promise.all(expiredBookings.map((booking) => syncExpiredBookingIfNeeded(booking, catalog)));
      return loadHydratedBookingsByQuery(query, catalog, { syncExpiries: false });
    }
  }

  return hydratedBookings;
}

async function getHydratedBookingById(id, catalogInput = null, options = {}) {
  const rows = await loadHydratedBookingsByQuery({ id: `eq.${id}`, limit: 1 }, catalogInput, options);
  return rows[0] || null;
}

async function getHydratedBookingByCode(code, catalogInput = null, options = {}) {
  const rows = await loadHydratedBookingsByQuery({ booking_code: `eq.${code}`, limit: 1 }, catalogInput, options);
  return rows[0] || null;
}

export async function createBooking(payload) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để đặt tour.");
  const catalog = await getSiteCatalog({ force: true });
  const reference = payload?.tourSlug ? await getBookingReferenceData(payload.tourSlug) : { tour: null, paymentMethods: [], coupons: [] };
  const tour = reference.tour || catalog.tours.find((item) => item.id === payload?.tourId) || null;
  if (!tour || (payload?.tourId && tour.id !== payload.tourId)) {
    throw new Error("Không tìm thấy tour để đặt.");
  }

  const schedule = tour.schedules.find((item) => item.id === payload?.scheduleId) || null;
  ensureBookableSchedule(schedule);

  const counts = normalizeCounts(payload?.counts || {});
  const travelers = Array.isArray(payload?.travelers) ? payload.travelers : [];
  ensureTravelerPayload(counts, travelers);

  const totalGuests = countGuests(counts);
  if (schedule.availableSlots < totalGuests) {
    throw new Error("Số chỗ còn lại của lịch khởi hành không đủ.");
  }

  const contactName = String(payload?.contact?.fullName || "").trim();
  const contactEmail = String(payload?.contact?.email || auth.user.email || "").trim();
  const contactPhone = String(payload?.contact?.phone || "").trim();
  if (!contactName || !contactEmail || !contactPhone) {
    throw new Error("Thiếu thông tin liên hệ để tạo booking.");
  }
  if (!isValidEmail(contactEmail)) {
    throw new Error("Email liên hệ không hợp lệ.");
  }

  const invoiceRequest = normalizeInvoiceRequest(payload?.invoiceRequest, contactEmail);

  const paymentMethod = reference.paymentMethods.find((method) => method.code === payload?.paymentMethodCode) || null;
  if (!paymentMethod) {
    throw new Error("Phương thức thanh toán không hợp lệ hoặc chưa được bật.");
  }

  const subtotal = computeSubtotal(counts, schedule.prices);
  if (subtotal <= 0) {
    throw new Error("Không thể tính giá cho booking này.");
  }

  const couponCode = String(payload?.couponCode || "").trim();
  const couponPreview = couponCode
    ? getCouponPreviewForTour(reference.coupons, tour, counts, schedule.id)
        .find((item) => item.coupon.code.toLowerCase() === couponCode.toLowerCase()) || null
    : null;
  if (couponCode && !couponPreview) {
    throw new Error("Mã giảm giá không hợp lệ hoặc không áp dụng cho tour này.");
  }

  const couponUsageStats = couponPreview?.coupon?.id
    ? await validateCouponUsage(couponPreview.coupon, auth.user.id)
    : null;
  const discount = couponPreview?.discountAmount || 0;
  const currency = schedule.currency || tour.baseCurrency || "VND";
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const bookingRows = await restWrite("bookings", {
    method: "POST",
    query: { select: "*" },
    body: {
      user_id: auth.user.id,
      tour_id: tour.id,
      schedule_id: schedule.id,
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      adult_count: counts.adults,
      child_count: counts.children,
      infant_count: counts.infants,
      subtotal_amount: subtotal,
      discount_amount: discount,
      tax_amount: 0,
      service_fee_amount: 0,
      total_amount: Math.max(0, subtotal - discount),
      currency,
      booking_status: "awaiting_payment",
      payment_status: "pending",
      expires_at: expiresAt,
      customer_note: String(payload?.customerNote || "").trim() || null,
      snapshot_jsonb: buildSnapshot({
        tour,
        schedule,
        paymentMethod,
        coupon: couponPreview?.coupon || null
      })
    }
  });

  const booking = bookingRows?.[0];
  if (!booking?.id) throw new Error("Không thể tạo booking trong DB.");

  const travelerRows = travelers.map((traveler) => ({
    booking_id: booking.id,
    full_name: String(traveler.fullName || "").trim(),
    phone: String(traveler.phone || "").trim() || null,
    email: String(traveler.email || "").trim() || null,
    nationality: String(traveler.nationality || "").trim() || null,
    traveler_type: traveler.travelerType,
    price_amount: getTravelerPrice(schedule, traveler.travelerType),
    special_request: String(traveler.specialRequest || "").trim() || null
  }));

  if (travelerRows.length) {
    await restWrite("booking_travelers", {
      method: "POST",
      query: { select: "*" },
      body: travelerRows
    });
  }

  const priceLines = [
    counts.adults > 0
      ? {
          booking_id: booking.id,
          line_type: "fare",
          label: "Người lớn",
          quantity: counts.adults,
          unit_amount: getTravelerPrice(schedule, "adult"),
          total_amount: counts.adults * getTravelerPrice(schedule, "adult"),
          metadata_jsonb: { traveler_type: "adult" }
        }
      : null,
    counts.children > 0
      ? {
          booking_id: booking.id,
          line_type: "fare",
          label: "Trẻ em",
          quantity: counts.children,
          unit_amount: getTravelerPrice(schedule, "child"),
          total_amount: counts.children * getTravelerPrice(schedule, "child"),
          metadata_jsonb: { traveler_type: "child" }
        }
      : null,
    counts.infants > 0
      ? {
          booking_id: booking.id,
          line_type: "fare",
          label: "Em bé",
          quantity: counts.infants,
          unit_amount: getTravelerPrice(schedule, "infant"),
          total_amount: counts.infants * getTravelerPrice(schedule, "infant"),
          metadata_jsonb: { traveler_type: "infant" }
        }
      : null,
    discount > 0
      ? {
          booking_id: booking.id,
          line_type: "coupon",
          label: couponPreview?.coupon?.code || "Giảm giá",
          quantity: 1,
          unit_amount: discount,
          total_amount: discount * -1,
          metadata_jsonb: { coupon_code: couponPreview?.coupon?.code || null }
        }
      : null
  ].filter(Boolean);

  if (priceLines.length) {
    await restWrite("booking_price_lines", {
      method: "POST",
      query: { select: "*" },
      body: priceLines
    });
  }

  const paymentRows = await restWrite("payments", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      payment_method_id: paymentMethod.id,
      provider_name: paymentMethod.providerName || paymentMethod.name,
      amount: Math.max(0, subtotal - discount),
      currency,
      status: "pending",
      raw_response: {
        source: "frontend_manual_checkout",
        note: "Waiting for customer confirmation"
      }
    }
  });

  const initialPayment = paymentRows?.[0] || null;
  if (initialPayment?.id) {
    await createPaymentEventRecord({
      paymentId: initialPayment.id,
      eventName: "payment_requested",
      payload: {
        booking_code: booking.booking_code,
        source: "frontend_manual_checkout",
        amount: Number(initialPayment.amount || 0)
      }
    });
  }

  if (couponPreview?.coupon?.id && discount > 0) {
    await restWrite("coupon_usages", {
      method: "POST",
      query: { select: "*" },
      body: {
        coupon_id: couponPreview.coupon.id,
        booking_id: booking.id,
        user_id: auth.user.id,
        discount_amount: discount
      }
    });
  }

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "booking_created",
      note: `Tạo booking ${booking.booking_code} với tổng tiền ${formatCurrency(booking.total_amount, currency)}.`
    }
  });

  if (invoiceRequest) {
    await restWrite("invoices", {
      method: "POST",
      query: { select: "*" },
      body: {
        booking_id: booking.id,
        company_name: invoiceRequest.companyName,
        tax_code: invoiceRequest.taxCode,
        billing_email: invoiceRequest.billingEmail,
        billing_address: invoiceRequest.billingAddress,
        status: "requested"
      }
    });

    await restWrite("booking_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "invoice_requested",
        note: `Khách yêu cầu xuất hóa đơn cho booking ${booking.booking_code}.`
      }
    });
  }

  await createNotification({
    userId: auth.user.id,
    title: "Booking mới đã được tạo",
    content: `Booking ${booking.booking_code} đang chờ thanh toán.`,
    notificationType: "booking",
    referenceType: "booking",
    referenceId: booking.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "booking_created",
    entityType: "booking",
    entityId: booking.id,
    newData: {
      booking_code: booking.booking_code,
      total_amount: booking.total_amount,
      payment_method_code: paymentMethod.code,
      coupon_code: couponPreview?.coupon?.code || null,
      coupon_usage_count: couponUsageStats?.totalCount ?? null,
      invoice_requested: Boolean(invoiceRequest)
    }
  });

  return getHydratedBookingById(booking.id, catalog);
}

export async function getBookingById(id) {
  const auth = await getAuthContext();
  const booking = await getHydratedBookingById(id);
  if (!booking) return null;
  ensureBookingAccess(booking, auth);
  return booking;
}

export async function getBookingByCode(code) {
  const auth = await getAuthContext();
  const booking = await getHydratedBookingByCode(code);
  if (!booking) return null;
  ensureBookingAccess(booking, auth);
  return booking;
}

export async function payBooking(code, options = {}) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để thanh toán booking.");
  let booking = await getHydratedBookingByCode(code);
  if (!booking) throw new Error("Không tìm thấy booking.");
  ensureBookingAccess(booking, auth);

  booking = await syncExpiredBookingIfNeeded(booking);
  if (["cancel_requested", "cancelled", "expired", "completed"].includes(booking.booking_status)) {
    throw new Error("Booking này không thể thanh toán ở trạng thái hiện tại.");
  }
  if (booking.payment_status === "paid") return booking;
  if (["refunded", "partially_refunded"].includes(booking.payment_status)) {
    throw new Error("Booking này đã có trạng thái hoàn tiền và không thể thanh toán lại.");
  }

  const source = String(options?.source || (auth.isManagement ? "management_manual_payment" : "frontend_manual_payment")).trim();
  const safeNote = String(options?.note || "").trim();
  const now = new Date().toISOString();
  const latestPayment = getLatestPayment(booking);
  let payment = latestPayment;
  let retried = false;

  if (!payment?.id || ["failed", "cancelled", "expired"].includes(payment.status)) {
    payment = await createPaymentAttemptForBooking(
      booking,
      auth.user.id,
      source,
      safeNote || (auth.isManagement ? "Tạo lại phiên thanh toán thủ công." : "Khách khởi tạo thanh toán lại.")
    );
    retried = true;
  }

  if (!payment?.id) {
    throw new Error("Không tìm thấy giao dịch thanh toán để cập nhật.");
  }

  await restWrite("payments", {
    method: "PATCH",
    query: {
      id: `eq.${payment.id}`,
      select: "*"
    },
    body: {
      status: "paid",
      paid_at: now,
      transaction_code: payment.transaction_code || `TX-${Date.now()}`,
      failure_reason: null,
      raw_response: {
        ...(payment.raw_response || {}),
        source,
        confirmed_at: now,
        note: safeNote || (auth.isManagement ? "Manual payment recorded by management." : "Customer confirmed payment from booking detail.")
      }
    }
  });

  await createPaymentEventRecord({
    paymentId: payment.id,
    eventName: auth.isManagement ? "manual_payment_recorded" : retried ? "payment_retry_paid" : "payment_paid",
    payload: {
      booking_code: booking.booking_code,
      amount: Number(payment.amount || booking.total_amount || 0),
      actor_role: auth.primaryRole,
      source,
      note: safeNote || null
    },
    status: "processed",
    processedAt: now
  });

  await restWrite("bookings", {
    method: "PATCH",
    query: {
      id: `eq.${booking.id}`,
      select: "*"
    },
    body: {
      booking_status: booking.booking_status === "completed" ? "completed" : "confirmed",
      payment_status: "paid",
      confirmed_at: booking.confirmed_at || now,
      expires_at: null
    }
  });

  await createBookingEventRecord({
    bookingId: booking.id,
    actorId: auth.user.id,
    eventType: auth.isManagement ? "manual_payment_recorded" : "payment_recorded",
    note: safeNote || (auth.isManagement
      ? `Đã ghi nhận thanh toán thủ công cho booking ${booking.booking_code}.`
      : retried
        ? `Khách đã thanh toán lại thành công cho booking ${booking.booking_code}.`
        : "Khách đã hoàn tất thanh toán booking."),
    eventData: {
      payment_id: payment.id,
      source,
      retried
    }
  });

  await createNotification({
    userId: booking.user_id || auth.user.id,
    title: auth.isManagement ? "Booking đã được ghi nhận thanh toán" : "Thanh toán thành công",
    content: `Booking ${booking.booking_code} đã được ghi nhận thanh toán${auth.isManagement ? " bởi bộ phận vận hành" : ""}.`,
    notificationType: "payment",
    referenceType: "booking",
    referenceId: booking.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: auth.isManagement ? "manual_payment_recorded" : retried ? "payment_retry_recorded" : "payment_recorded",
    entityType: "booking",
    entityId: booking.id,
    oldData: {
      payment_status: booking.payment_status,
      booking_status: booking.booking_status,
      payment_id: latestPayment?.id || null
    },
    newData: {
      payment_status: "paid",
      booking_status: booking.booking_status === "completed" ? "completed" : "confirmed",
      payment_id: payment.id,
      retried
    }
  });

  return getHydratedBookingById(booking.id);
}

export async function cancelBooking(code, reason = "Khách hàng chủ động yêu cầu hủy.") {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để hủy booking.");
  const booking = await getHydratedBookingByCode(code);
  if (!booking) throw new Error("Không tìm thấy booking.");
  ensureBookingAccess(booking, auth);

  if (["completed", "cancelled", "expired"].includes(booking.booking_status)) {
    throw new Error("Booking này không thể hủy ở trạng thái hiện tại.");
  }

  const nextStatus = auth.isManagement ? "cancelled" : "cancel_requested";
  const now = new Date().toISOString();
  await restWrite("bookings", {
    method: "PATCH",
    query: {
      id: `eq.${booking.id}`,
      select: "*"
    },
    body: {
      booking_status: nextStatus,
      cancelled_at: auth.isManagement ? now : booking.cancelled_at,
      cancel_reason: String(reason || "").trim() || booking.cancel_reason || null
    }
  });

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: auth.isManagement ? "booking_cancelled" : "cancel_requested",
      note: String(reason || "").trim() || "Cập nhật hủy booking."
    }
  });

  await createNotification({
    userId: booking.user_id || auth.user.id,
    title: auth.isManagement ? "Booking đã được hủy" : "Đã ghi nhận yêu cầu hủy booking",
    content: `Booking ${booking.booking_code} đã chuyển sang trạng thái ${nextStatus}.`,
    notificationType: "booking",
    referenceType: "booking",
    referenceId: booking.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: auth.isManagement ? "booking_cancelled" : "cancel_requested",
    entityType: "booking",
    entityId: booking.id,
    oldData: {
      booking_status: booking.booking_status,
      cancel_reason: booking.cancel_reason
    },
    newData: {
      booking_status: nextStatus,
      cancel_reason: String(reason || "").trim() || booking.cancel_reason || null
    }
  });

  return getHydratedBookingById(booking.id);
}

export async function createSupportTicket({ bookingId, subject, message }) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để gửi ticket hỗ trợ.");
  const booking = await getHydratedBookingById(bookingId);
  if (!booking) throw new Error("Không tìm thấy booking để tạo ticket.");
  ensureBookingAccess(booking, auth);

  const safeSubject = String(subject || "").trim();
  const safeMessage = String(message || "").trim();
  if (!safeSubject || !safeMessage) {
    throw new Error("Ticket hỗ trợ cần có tiêu đề và nội dung.");
  }

  const ticketRows = await restWrite("support_tickets", {
    method: "POST",
    query: { select: "*" },
    body: {
      user_id: booking.user_id || auth.user.id,
      booking_id: booking.id,
      subject: safeSubject,
      status: "open",
      priority: "normal"
    }
  });

  const ticket = ticketRows?.[0];
  if (!ticket?.id) throw new Error("Không thể tạo ticket hỗ trợ.");

  await restWrite("support_ticket_messages", {
    method: "POST",
    query: { select: "*" },
    body: {
      ticket_id: ticket.id,
      sender_id: auth.user.id,
      sender_type: auth.isManagement ? "staff" : "customer",
      message: safeMessage
    }
  });

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "support_ticket_created",
      note: safeSubject
    }
  });

  await createNotification({
    userId: booking.user_id || auth.user.id,
    title: "Ticket hỗ trợ mới",
    content: `${ticket.ticket_code} - ${safeSubject}`,
    notificationType: "support_ticket",
    referenceType: "support_ticket",
    referenceId: ticket.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "support_ticket_created",
    entityType: "support_ticket",
    entityId: ticket.id,
    newData: {
      booking_id: booking.id,
      subject: safeSubject
    }
  });

  return ticket;
}

export async function replySupportTicket({ ticketId, message }) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để phản hồi ticket.");
  const ticket = await safeSingle("support_tickets", {
    select: "*",
    id: `eq.${ticketId}`
  });
  if (!ticket) throw new Error("Không tìm thấy ticket hỗ trợ.");

  const booking = ticket.booking_id ? await getHydratedBookingById(ticket.booking_id) : null;
  if (!auth.isManagement) {
    if (!ticket.user_id || ticket.user_id !== auth.user.id) {
      throw new Error("Bạn không có quyền phản hồi ticket này.");
    }
  }

  const safeMessage = String(message || "").trim();
  if (!safeMessage) {
    throw new Error("Nội dung phản hồi không được để trống.");
  }
  if (["resolved", "closed"].includes(ticket.status)) {
    throw new Error("Ticket n?y ? ?ng n?n kh?ng th? gửi thêm tin nhắn.");
  }

  await restWrite("support_ticket_messages", {
    method: "POST",
    query: { select: "*" },
    body: {
      ticket_id: ticket.id,
      sender_id: auth.user.id,
      sender_type: auth.isManagement ? "staff" : "customer",
      message: safeMessage
    }
  });

  const nextStatus = auth.isManagement ? (ticket.status === "resolved" || ticket.status === "closed" ? ticket.status : "in_progress") : "open";
  await restWrite("support_tickets", {
    method: "PATCH",
    query: {
      id: `eq.${ticket.id}`,
      select: "*"
    },
    body: {
      status: nextStatus,
      closed_at: ["resolved", "closed"].includes(nextStatus) ? ticket.closed_at : null
    }
  });

  if (booking?.id) {
    await restWrite("booking_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "support_ticket_replied",
        note: safeMessage
      }
    });
  }

  if (auth.isManagement && ticket.user_id) {
    await createNotification({
      userId: ticket.user_id,
      title: "Ticket hỗ trợ có phản hồi mới",
      content: safeMessage,
      notificationType: "support_ticket",
      referenceType: "support_ticket",
      referenceId: ticket.id
    });
  }

  await createActivityLog({
    actorId: auth.user.id,
    action: "support_ticket_replied",
    entityType: "support_ticket",
    entityId: ticket.id,
    oldData: { status: ticket.status },
    newData: { status: nextStatus }
  });

  return safeSingle("support_tickets", { select: "*", id: `eq.${ticket.id}` });
}

export async function submitReview({ bookingId, rating, comment }) {
  const auth = requireAuth(await getAuthContext(), "Bạn cần đăng nhập để gửi đánh giá.");
  const booking = await getHydratedBookingById(bookingId);
  if (!booking) throw new Error("Không tìm thấy booking để đánh giá.");
  if (!booking.user_id || booking.user_id !== auth.user.id) {
    throw new Error("Bạn chỉ có thể đánh giá booking của chính mình.");
  }
  if (booking.booking_status !== "completed") {
    throw new Error("Chỉ booking đã hoàn thành mới được gửi review.");
  }

  const safeRating = Math.max(1, Math.min(5, toNumber(rating, 0)));
  const safeComment = String(comment || "").trim();
  if (!safeRating || !safeComment) {
    throw new Error("Review cần có điểm số và nội dung.");
  }

  const existingReview = await safeSingle("reviews", {
    select: "*",
    booking_id: `eq.${booking.id}`
  });

  if (existingReview?.id) {
    await restWrite("reviews", {
      method: "PATCH",
      query: {
        id: `eq.${existingReview.id}`,
        select: "*"
      },
      body: {
        rating: safeRating,
        comment: safeComment,
        status: "pending"
      }
    });
  } else {
    await restWrite("reviews", {
      method: "POST",
      query: { select: "*" },
      body: {
        tour_id: booking.tour_id,
        booking_id: booking.id,
        user_id: auth.user.id,
        rating: safeRating,
        comment: safeComment,
        status: "pending"
      }
    });
  }

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "review_submitted",
      note: safeComment
    }
  });

  await createNotification({
    userId: auth.user.id,
    title: "Đã gửi đánh giá",
    content: `Review cho booking ${booking.booking_code} đang chờ duyệt.`,
    notificationType: "review",
    referenceType: "booking",
    referenceId: booking.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "review_submitted",
    entityType: "review",
    entityId: existingReview?.id || booking.id,
    newData: {
      booking_id: booking.id,
      rating: safeRating,
      status: "pending"
    }
  });

  return getHydratedBookingById(booking.id);
}

export {
  bookingEventLabel,
  getHydratedBookingByCode,
  getHydratedBookingById,
  loadHydratedBookingsByQuery
};














