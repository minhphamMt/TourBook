import {
  compactText,
  createActivityLog,
  createNotification,
  getAuthContext,
  getPrimaryRole,
  normalizeRoles,
  requireManagement,
  restWrite,
  safeSelect,
  safeSingle,
  toNumber
} from "./core.js";
import { getSiteCatalog, invalidateSiteCatalogCache } from "./catalog.js";
import { getHydratedBookingByCode, getHydratedBookingById, loadHydratedBookingsByQuery, payBooking } from "./bookings.js";

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

function buildScheduleRows(tours = []) {
  return tours
    .flatMap((tour) =>
      (tour.schedules || []).map((schedule) => ({
        ...schedule,
        tourName: tour.name,
        destinationLabel: tour.destinationLabel,
        currency: schedule.currency || tour.baseCurrency || "VND"
      }))
    )
    .sort((left, right) => String(left.departureDate || "").localeCompare(String(right.departureDate || "")));
}

function attachProfileRoles(profileRows, roleRows, userRoleRows, bookings) {
  const rolesById = new Map(roleRows.map((role) => [role.id, String(role.name || "").toLowerCase()]));
  const userRolesMap = userRoleRows.reduce((map, item) => {
    const list = map.get(item.user_id) || [];
    const roleName = rolesById.get(item.role_id);
    if (roleName) list.push(roleName);
    map.set(item.user_id, list);
    return map;
  }, new Map());
  const bookingStats = bookings.reduce((map, booking) => {
    const userId = booking.user_id;
    if (!userId) return map;
    const current = map.get(userId) || { bookingCount: 0, totalSpend: 0, lastBookingAt: null };
    current.bookingCount += 1;
    current.totalSpend += Number(booking.total_amount || 0);
    current.lastBookingAt = [current.lastBookingAt, booking.created_at].filter(Boolean).sort().pop() || booking.created_at;
    map.set(userId, current);
    return map;
  }, new Map());

  return sortByDate(
    profileRows.map((profile) => {
      const roles = normalizeRoles(userRolesMap.get(profile.id) || ["customer"]);
      const stats = bookingStats.get(profile.id) || { bookingCount: 0, totalSpend: 0, lastBookingAt: null };
      return {
        ...profile,
        roles,
        primaryRole: getPrimaryRole(roles),
        bookingCount: stats.bookingCount,
        totalSpend: stats.totalSpend,
        lastBookingAt: stats.lastBookingAt
      };
    }),
    "created_at",
    "desc"
  );
}

function hydrateReviews(reviewRows, reviewReplyRows, bookingsById, profileMap, tourMap) {
  const replyMap = groupBy(reviewReplyRows, "review_id");
  return sortByDate(reviewRows, "created_at", "desc").map((review) => {
    const booking = bookingsById.get(review.booking_id) || null;
    const tour = booking?.tour || tourMap.get(review.tour_id) || null;
    const author = profileMap.get(review.user_id) || null;
    const replyRow = (replyMap.get(review.id) || [])[0] || null;
    const replyAuthor = replyRow ? profileMap.get(replyRow.replied_by) || null : null;
    return {
      ...review,
      booking,
      tour,
      authorName: author?.full_name || author?.email || booking?.contact_name || "Khách hàng",
      contactName: booking?.contact_name || author?.full_name || author?.email || "Khách hàng",
      reply: replyRow
        ? {
            id: replyRow.id,
            text: replyRow.reply_text,
            createdAt: replyRow.created_at,
            authorName: replyAuthor?.full_name || replyAuthor?.email || "Staff"
          }
        : null
    };
  });
}

function hydrateTickets(ticketRows, ticketMessageRows, bookingsById, profileMap) {
  const messageMap = groupBy(ticketMessageRows, "ticket_id");
  return sortByDate(ticketRows, "updated_at", "desc").map((ticket) => {
    const booking = bookingsById.get(ticket.booking_id) || null;
    const customer = profileMap.get(ticket.user_id) || null;
    const assignee = profileMap.get(ticket.assigned_to) || null;
    return {
      ...ticket,
      booking,
      bookingCode: booking?.booking_code || null,
      customerName: customer?.full_name || customer?.email || booking?.contact_name || "Khách hàng",
      assignee,
      assigneeName: assignee?.full_name || assignee?.email || "",
      tour: booking?.tour || null,
      messages: sortByDate(messageMap.get(ticket.id) || [], "created_at", "asc").map((message) => ({
        ...message,
        senderName: profileMap.get(message.sender_id)?.full_name || profileMap.get(message.sender_id)?.email || message.sender_type
      }))
    };
  });
}

function hydratePayments(paymentRows, paymentMethodMap, bookingsById) {
  return sortByDate(paymentRows, "requested_at", "desc").map((payment) => ({
    ...payment,
    booking: bookingsById.get(payment.booking_id) || null,
    paymentMethod: paymentMethodMap.get(payment.payment_method_id) || null
  }));
}

function hydrateRefunds(refundRows, paymentsById) {
  return sortByDate(refundRows, "created_at", "desc").map((refund) => ({
    ...refund,
    payment: paymentsById.get(refund.payment_id) || null
  }));
}

function hydrateInvoices(invoiceRows, bookingsById) {
  return sortByDate(invoiceRows, "created_at", "desc").map((invoice) => ({
    ...invoice,
    booking: bookingsById.get(invoice.booking_id) || null
  }));
}

function hydrateCouponUsages(couponUsageRows, couponsById, bookingsById, profileMap) {
  return sortByDate(couponUsageRows, "created_at", "desc").map((usage) => ({
    ...usage,
    booking: bookingsById.get(usage.booking_id) || null,
    coupon: couponsById.get(usage.coupon_id) || null,
    customer: profileMap.get(usage.user_id) || profileMap.get(bookingsById.get(usage.booking_id)?.user_id) || null
  }));
}

function hydrateActivityLogs(activityRows, profileMap) {
  return sortByDate(activityRows, "created_at", "desc").map((item) => ({
    ...item,
    actor: profileMap.get(item.actor_id) || null
  }));
}

function mapCoupons(catalogCoupons, couponUsages) {
  const usageMap = groupBy(couponUsages, "coupon_id");
  return catalogCoupons.map((coupon) => {
    const usages = usageMap.get(coupon.id) || [];
    return {
      ...coupon,
      usageCount: usages.length,
      totalDiscount: usages.reduce((sum, usage) => sum + Number(usage.discount_amount || 0), 0)
    };
  });
}

function resolveModerateReviewPayload(reviewIdOrPayload, status, replyText) {
  if (reviewIdOrPayload && typeof reviewIdOrPayload === "object") {
    return {
      reviewId: reviewIdOrPayload.reviewId || reviewIdOrPayload.id,
      status: reviewIdOrPayload.status,
      replyText: reviewIdOrPayload.replyText ? reviewIdOrPayload.reply ? ""
        : reviewIdOrPayload.replyText : ""  
    };
  }
  return {
    reviewId: reviewIdOrPayload,
    status,
    replyText: replyText || ""
  };
  
}

function resolveCancellationPayload(bookingOrPayload, decision, note) {
  if (bookingOrPayload && typeof bookingOrPayload === "object") {
    return {
      bookingId: bookingOrPayload.bookingId || bookingOrPayload.id || null,
      bookingCode: bookingOrPayload.bookingCode || bookingOrPayload.code || null,
      decision: bookingOrPayload.decision || (bookingOrPayload.approved === false ? "rejected" : "approved"),
      note: bookingOrPayload.note || bookingOrPayload.reason || ""
    };
  }
  return {
    bookingId: bookingOrPayload,
    bookingCode: typeof bookingOrPayload === "string" && bookingOrPayload.startsWith("BK") ? bookingOrPayload : null,
    decision: decision || "approved",
    note: note || ""
  };
}

function resolveTicketPayload(ticketOrPayload, status, note) {
  if (ticketOrPayload && typeof ticketOrPayload === "object") {
    return {
      ticketId: ticketOrPayload.ticketId || ticketOrPayload.id,
      status: ticketOrPayload.status || status || null,
      assignedTo: ticketOrPayload.assignedTo || ticketOrPayload.assigned_to || "",
      note: ticketOrPayload.note || ticketOrPayload.message || note || ""
    };
  }
  return {
    ticketId: ticketOrPayload,
    status: status || null,
    assignedTo: "",
    note: note || ""
  };
}

function resolveManualPaymentPayload(bookingOrPayload, note) {
  if (bookingOrPayload && typeof bookingOrPayload === "object") {
    return {
      bookingId: bookingOrPayload.bookingId || bookingOrPayload.id || null,
      bookingCode: bookingOrPayload.bookingCode || bookingOrPayload.code || null,
      note: bookingOrPayload.note || bookingOrPayload.reason || ""
    };
  }
  return {
    bookingId: bookingOrPayload,
    bookingCode: typeof bookingOrPayload === "string" && bookingOrPayload.startsWith("BK") ? bookingOrPayload : null,
    note: note || ""
  };
}

function resolveRefundPayload(refundOrPayload, decision, note) {
  if (refundOrPayload && typeof refundOrPayload === "object") {
    return {
      refundId: refundOrPayload.refundId || refundOrPayload.id || null,
      decision: refundOrPayload.decision || decision || "refunded",
      note: refundOrPayload.note || refundOrPayload.reason || note || ""
    };
  }
  return {
    refundId: refundOrPayload,
    decision: decision || "refunded",
    note: note || ""
  };
}


function normalizeSlug(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .flatMap((value) => String(value || "").split(/[,\n]/))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

function parseItineraryInput(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [dayPart, titlePart, ...descriptionParts] = line.split("|").map((part) => part.trim());
      const dayNumber = toNumber(dayPart, index + 1) || index + 1;
      return {
        dayNumber,
        title: titlePart || `Ngay ${dayNumber}`,
        description: descriptionParts.join(" | ") || ""
      };
    });
}

function formatItineraryInput(days = []) {
  return days
    .sort((left, right) => toNumber(left.dayNumber || left.day_number) - toNumber(right.dayNumber || right.day_number))
    .map((day) => `${toNumber(day.dayNumber || day.day_number)}|${day.title || ""}|${day.description || ""}`)
    .join("\n");
}

function normalizeDateTime(value) {
  if (!value) return null;
  const textValue = String(value).trim();
  if (!textValue) return null;
  const parsed = new Date(textValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeDateOnly(value) {
  if (!value) return null;
  const textValue = String(value).trim();
  return textValue || null;
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function buildAdminCatalogData({
  tours: tourRows = [],
  destinations: destinationRows = [],
  locations: locationRows = [],
  categories: categoryRows = [],
  tourCategories: tourCategoryRows = [],
  images: imageRows = [],
  itinerary: itineraryRows = [],
  schedules: scheduleRows = [],
  scheduleAvailability: availabilityRows = [],
  priceTiers: priceTierRows = [],
  cancellationPolicies: cancellationPolicyRows = [],
  banners: bannerRows = [],
  cmsPages: cmsPageRows = [],
  coupons: couponRows = [],
  couponTours: couponTourRows = [],
  couponCategories: couponCategoryRows = [],
  couponUsages: couponUsageRows = []
}) {
  const locationMap = new Map(locationRows.map((item) => [item.id, item]));
  const categoryMap = new Map(categoryRows.map((item) => [item.id, item]));
  const cancellationPolicyMap = new Map(cancellationPolicyRows.map((item) => [item.id, item]));
  const destinationGroups = groupBy(destinationRows, "tour_id");
  const categoryGroups = groupBy(tourCategoryRows, "tour_id");
  const imageGroups = groupBy(imageRows, "tour_id");
  const itineraryGroups = groupBy(itineraryRows, "tour_id");
  const scheduleGroups = groupBy(scheduleRows, "tour_id");
  const priceGroups = groupBy(priceTierRows, "schedule_id");
  const availabilityMap = new Map(availabilityRows.map((item) => [item.schedule_id, item]));
  const couponTourMap = groupBy(couponTourRows, "coupon_id");
  const couponCategoryMap = groupBy(couponCategoryRows, "coupon_id");
  const couponUsageMap = groupBy(couponUsageRows, "coupon_id");

  const tours = sortByDate(tourRows, "updated_at", "desc").map((tour) => {
    const destinations = (destinationGroups.get(tour.id) || [])
      .sort((left, right) => toNumber(left.sort_order) - toNumber(right.sort_order))
      .map((item) => {
        const location = locationMap.get(item.location_id);
        return location
          ? {
              id: location.id,
              name: location.name,
              slug: location.slug,
              locationType: location.location_type,
              sortOrder: item.sort_order || 0,
              isPrimary: Boolean(item.is_primary)
            }
          : null;
      })
      .filter(Boolean);
    const primaryDestination = destinations.find((item) => item.isPrimary) || destinations[0] || null;
    const categories = (categoryGroups.get(tour.id) || [])
      .map((item) => categoryMap.get(item.category_id))
      .filter(Boolean)
      .map((item) => ({ id: item.id, name: item.name, slug: item.slug }));
    const gallery = (imageGroups.get(tour.id) || [])
      .sort((left, right) => toNumber(left.sort_order) - toNumber(right.sort_order))
      .map((item) => ({
        id: item.id,
        imageUrl: item.image_url,
        altText: item.alt_text || "",
        isCover: Boolean(item.is_cover),
        sortOrder: toNumber(item.sort_order)
      }));
    const coverImage = gallery.find((item) => item.isCover)?.imageUrl || gallery[0]?.imageUrl || null;
    const itinerary = (itineraryGroups.get(tour.id) || [])
      .sort((left, right) => toNumber(left.day_number) - toNumber(right.day_number))
      .map((item) => ({
        id: item.id,
        dayNumber: toNumber(item.day_number),
        title: item.title,
        description: item.description || "",
        meals: item.meals || [],
        accommodation: item.accommodation || "",
        transportation: item.transportation || ""
      }));
    const schedules = (scheduleGroups.get(tour.id) || [])
      .sort((left, right) => String(left.departure_date || "").localeCompare(String(right.departure_date || "")))
      .map((item) => {
        const availability = availabilityMap.get(item.id) || null;
        const prices = (priceGroups.get(item.id) || [])
          .map((price) => ({
            id: price.id,
            travelerType: price.traveler_type,
            price: Number(price.price || 0),
            salePrice: price.sale_price == null ? null : Number(price.sale_price),
            currency: price.currency || item.currency || tour.base_currency || "VND"
          }))
          .sort((left, right) => String(left.travelerType).localeCompare(String(right.travelerType)));
        return {
          id: item.id,
          tourId: item.tour_id,
          departureDate: item.departure_date,
          returnDate: item.return_date,
          meetingPoint: item.meeting_point || "",
          meetingAt: item.meeting_at || null,
          cutoffAt: item.cutoff_at || null,
          capacity: toNumber(item.capacity, 0),
          availableSlots: toNumber(availability?.available_slots ? item.capacity : 0, 0),
          reservedSlots: toNumber(availability?.reserved_slots ? item.capacity : 0, 0),
          status: item.status || "draft",
          currency: item.currency || tour.base_currency || "VND",
          notes: item.notes || "",
          prices
        };
      });

    return {
      id: tour.id,
      slug: tour.slug,
      name: tour.name,
      shortDescription: tour.short_description || "",
      description: tour.description || "",
      durationDays: toNumber(tour.duration_days, 1),
      durationNights: toNumber(tour.duration_nights, 0),
      baseCurrency: tour.base_currency || "VND",
      isFeatured: Boolean(tour.is_featured),
      status: tour.status || "draft",
      includedText: tour.included_text || "",
      excludedText: tour.excluded_text || "",
      termsText: tour.terms_text || "",
      importantNotes: tour.important_notes || "",
      cancellationPolicyId: tour.cancellation_policy_id || "",
      cancellationPolicy: cancellationPolicyMap.get(tour.cancellation_policy_id) || null,
      destinationLabel: primaryDestination?.name || "Chưa g?n ?i?m ?n",
      destinations,
      destinationIds: destinations.map((item) => item.id),
      primaryDestinationId: primaryDestination?.id || "",
      categories,
      categoryIds: categories.map((item) => item.id),
      coverImage,
      gallery,
      itinerary,
      itineraryInput: formatItineraryInput(itinerary),
      schedules,
      scheduleCount: schedules.length,
      openScheduleCount: schedules.filter((item) => ["open", "sold_out"].includes(item.status)).length,
      publishedAt: tour.published_at || null,
      createdAt: tour.created_at,
      updatedAt: tour.updated_at
    };
  });

  const coupons = sortByDate(couponRows, "updated_at", "desc").map((coupon) => {
    const usageRows = couponUsageMap.get(coupon.id) || [];
    const tourIds = (couponTourMap.get(coupon.id) || []).map((item) => item.tour_id);
    const categoryIds = (couponCategoryMap.get(coupon.id) || []).map((item) => item.category_id);
    return {
      id: coupon.id,
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || "",
      discountType: coupon.discount_type,
      discountValue: Number(coupon.discount_value || 0),
      minOrderAmount: Number(coupon.min_order_amount || 0),
      maxDiscountAmount: coupon.max_discount_amount == null ? null : Number(coupon.max_discount_amount),
      startAt: coupon.start_at || null,
      endAt: coupon.end_at || null,
      usageLimit: coupon.usage_limit == null ? null : Number(coupon.usage_limit),
      usagePerUserLimit: coupon.usage_per_user_limit == null ? null : Number(coupon.usage_per_user_limit),
      usedCount: Number(coupon.used_count || 0),
      usageCount: usageRows.length,
      totalDiscount: usageRows.reduce((sum, item) => sum + Number(item.discount_amount || 0), 0),
      isActive: Boolean(coupon.is_active),
      tourIds,
      categoryIds,
      createdAt: coupon.created_at,
      updatedAt: coupon.updated_at
    };
  });

  const banners = sortByDate(bannerRows, "updated_at", "desc").map((banner) => ({
    id: banner.id,
    title: banner.title,
    imageUrl: banner.image_url,
    linkUrl: banner.link_url || "",
    placement: banner.placement || "home",
    sortOrder: toNumber(banner.sort_order, 0),
    isActive: Boolean(banner.is_active),
    is_active: Boolean(banner.is_active),
    startAt: banner.start_at || null,
    endAt: banner.end_at || null,
    createdAt: banner.created_at,
    updatedAt: banner.updated_at
  }));

  const cmsPages = sortByDate(cmsPageRows, "updated_at", "desc").map((page) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    content: page.content || "",
    metaTitle: page.meta_title || "",
    metaDescription: page.meta_description || "",
    isPublished: Boolean(page.is_published),
    is_published: Boolean(page.is_published),
    publishedAt: page.published_at || null,
    createdAt: page.created_at,
    updatedAt: page.updated_at,
    previewable: ["about-us", "privacy-policy", "terms-and-conditions"].includes(page.slug)
  }));

  return {
    tours,
    schedules: buildScheduleRows(tours),
    coupons,
    banners,
    cmsPages,
    catalogOptions: {
      locations: locationRows.map((item) => ({ id: item.id, name: item.name, slug: item.slug })).sort((left, right) => String(left.name).localeCompare(String(right.name))),
      categories: categoryRows.map((item) => ({ id: item.id, name: item.name, slug: item.slug })).sort((left, right) => String(left.name).localeCompare(String(right.name))),
      cancellationPolicies: cancellationPolicyRows.map((item) => ({ id: item.id, name: item.name })).sort((left, right) => String(left.name).localeCompare(String(right.name)))
    }
  };
}

async function getAdminCatalogData() {
  const [
    tours,
    destinations,
    locations,
    categories,
    tourCategories,
    images,
    itinerary,
    schedules,
    scheduleAvailability,
    priceTiers,
    cancellationPolicies,
    banners,
    cmsPages,
    coupons,
    couponTours,
    couponCategories,
    couponUsages
  ] = await Promise.all([
    safeSelect("tours", { select: "*", order: "updated_at.desc" }),
    safeSelect("tour_destinations", { select: "*", order: "sort_order.asc" }),
    safeSelect("locations", { select: "id,name,slug,location_type,sort_order,is_active", order: "sort_order.asc" }),
    safeSelect("categories", { select: "id,name,slug,is_active", order: "name.asc" }),
    safeSelect("tour_categories", { select: "*" }),
    safeSelect("tour_images", { select: "*", order: "sort_order.asc" }),
    safeSelect("tour_itinerary_days", { select: "*", order: "day_number.asc" }),
    safeSelect("departure_schedules", { select: "*", order: "departure_date.asc" }),
    safeSelect("schedule_availability", { select: "schedule_id,tour_id,departure_date,return_date,capacity,reserved_slots,available_slots" }),
    safeSelect("schedule_price_tiers", { select: "*" }),
    safeSelect("cancellation_policies", { select: "id,name,is_active", order: "name.asc" }),
    safeSelect("banners", { select: "*", order: "sort_order.asc" }),
    safeSelect("cms_pages", { select: "*", order: "updated_at.desc" }),
    safeSelect("coupons", { select: "*", order: "updated_at.desc" }),
    safeSelect("coupon_tours", { select: "*" }),
    safeSelect("coupon_categories", { select: "*" }),
    safeSelect("coupon_usages", { select: "coupon_id,discount_amount,created_at" })
  ]);

  return buildAdminCatalogData({
    tours,
    destinations,
    locations,
    categories,
    tourCategories,
    images,
    itinerary,
    schedules,
    scheduleAvailability,
    priceTiers,
    cancellationPolicies,
    banners,
    cmsPages,
    coupons,
    couponTours,
    couponCategories,
    couponUsages
  });
}

async function replaceJoinTableRows(table, foreignKey, foreignValue, rows = []) {
  await restWrite(table, {
    method: "DELETE",
    query: { [foreignKey]: `eq.${foreignValue}` }
  });
  if (!rows.length) return [];
  return restWrite(table, {
    method: "POST",
    query: { select: "*" },
    body: rows
  });
}

async function ensureAdminLocation(payload = {}) {
  const name = String(payload.name || payload.label || "").trim();
  const slug = normalizeSlug(payload.slug || name);
  if (!name || !slug) return null;

  const existing = await safeSingle("locations", {
    select: "id,name,slug,parent_id,location_type,sort_order,is_active",
    slug: `eq.${slug}`
  });
  if (existing?.id) return existing;

  const lastLocation = await safeSingle("locations", {
    select: "sort_order",
    order: "sort_order.desc"
  });

  const rows = await restWrite("locations", {
    method: "POST",
    query: { select: "id,name,slug,parent_id,location_type,sort_order,is_active" },
    body: {
      name,
      slug,
      parent_id: String(payload.parentId || payload.parent_id || "").trim() || null,
      location_type: String(payload.locationType || payload.location_type || "city").trim() || "city",
      sort_order: toNumber(lastLocation?.sort_order, 0) + 1,
      is_active: true
    }
  });

  return rows[0] || null;
}

export async function getAdminDashboard() {
  const auth = requireManagement(await getAuthContext());
  const publicCatalog = await getSiteCatalog({ force: true });
  const adminCatalog = await getAdminCatalogData();
  const bookings = await loadHydratedBookingsByQuery({ order: "created_at.desc" }, publicCatalog);
  const bookingsById = new Map(bookings.map((booking) => [booking.id, booking]));

  const [
    profileRows,
    roleRows,
    userRoleRows,
    paymentRows,
    refundRows,
    invoiceRows,
    ticketRows,
    ticketMessageRows,
    reviewRows,
    reviewReplyRows,
    couponUsageRows,
    activityRows,
    systemSettings,
    paymentMethodRows
  ] = await Promise.all([
    safeSelect("profiles", { select: "*", order: "created_at.desc" }),
    safeSelect("roles", { select: "id,name,description", order: "created_at.asc" }),
    safeSelect("user_roles", { select: "user_id,role_id,created_at", order: "created_at.desc" }),
    safeSelect("payments", { select: "*", order: "requested_at.desc" }),
    safeSelect("refunds", { select: "*", order: "created_at.desc" }),
    safeSelect("invoices", { select: "*", order: "created_at.desc" }),
    safeSelect("support_tickets", { select: "*", order: "updated_at.desc" }),
    safeSelect("support_ticket_messages", { select: "*", order: "created_at.asc" }),
    safeSelect("reviews", { select: "*", order: "created_at.desc" }),
    safeSelect("review_replies", { select: "*", order: "created_at.desc" }),
    safeSelect("coupon_usages", { select: "*", order: "created_at.desc" }),
    safeSelect("activity_logs", { select: "*", order: "created_at.desc" }),
    safeSelect("system_settings", { select: "*", order: "setting_key.asc" }),
    safeSelect("payment_methods", { select: "*", order: "name.asc" })
  ]);

  const profiles = attachProfileRoles(profileRows, roleRows, userRoleRows, bookings);
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const tourMap = new Map(adminCatalog.tours.map((tour) => [tour.id, tour]));
  const couponMap = new Map(adminCatalog.coupons.map((coupon) => [coupon.id, coupon]));
  const paymentMethodMap = new Map(paymentMethodRows.map((method) => [method.id, {
    id: method.id,
    code: method.code,
    name: method.name,
    methodType: method.method_type,
    providerName: method.provider_name,
    description: compactText(method.description, `${method.name} thanh toan`),
    isActive: Boolean(method.is_active),
    settings: method.settings_jsonb || {}
  }]));

  const payments = hydratePayments(paymentRows, paymentMethodMap, bookingsById);
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));
  const refunds = hydrateRefunds(refundRows, paymentsById);
  const invoices = hydrateInvoices(invoiceRows, bookingsById);
  const tickets = hydrateTickets(ticketRows, ticketMessageRows, bookingsById, profileMap);
  const reviews = hydrateReviews(reviewRows, reviewReplyRows, bookingsById, profileMap, tourMap);
  const couponUsages = hydrateCouponUsages(couponUsageRows, couponMap, bookingsById, profileMap);
  const activityLogs = hydrateActivityLogs(activityRows, profileMap);

  return {
    sourceMode: "database",
    bookings,
    payments,
    refunds,
    invoices,
    tickets,
    reviews,
    tours: adminCatalog.tours,
    schedules: adminCatalog.schedules,
    coupons: adminCatalog.coupons,
    couponUsages,
    banners: adminCatalog.banners,
    cmsPages: adminCatalog.cmsPages,
    catalogOptions: adminCatalog.catalogOptions,
    profiles,
    paymentMethods: [...paymentMethodMap.values()],
    systemSettings,
    activityLogs,
    roles: roleRows,
    viewer: {
      user: auth.user,
      profile: auth.profile,
      roles: auth.roles,
      primaryRole: auth.primaryRole
    }
  };
}

export async function moderateReview(reviewIdOrPayload, status, replyText = "") {
  const auth = requireManagement(await getAuthContext(), "Bạn không có quyền duyệt review.");
  const payload = resolveModerateReviewPayload(reviewIdOrPayload, status, replyText);
  if (!payload.reviewId || !payload.status) {
    throw new Error("Thiếu thông tin duyệt review.");
  }

  const review = await safeSingle("reviews", {
    select: "*",
    id: `eq.${payload.reviewId}`
  });
  if (!review) throw new Error("Không tìm thấy review.");

  await restWrite("reviews", {
    method: "PATCH",
    query: {
      id: `eq.${review.id}`,
      select: "*"
    },
    body: {
      status: payload.status
    }
  });

  const safeReply = String(payload.replyText || "").trim();
  if (safeReply) {
    const existingReply = await safeSingle("review_replies", {
      select: "*",
      review_id: `eq.${review.id}`
    });

    if (existingReply?.id) {
      await restWrite("review_replies", {
        method: "PATCH",
        query: {
          id: `eq.${existingReply.id}`,
          select: "*"
        },
        body: {
          reply_text: safeReply,
          replied_by: auth.user.id
        }
      });
    } else {
      await restWrite("review_replies", {
        method: "POST",
        query: { select: "*" },
        body: {
          review_id: review.id,
          replied_by: auth.user.id,
          reply_text: safeReply
        }
      });
    }
  }

  await createActivityLog({
    actorId: auth.user.id,
    action: "review_moderated",
    entityType: "review",
    entityId: review.id,
    oldData: { status: review.status },
    newData: { status: payload.status }
  });

  return safeSingle("reviews", { select: "*", id: `eq.${review.id}` });
}

export async function reviewCancellation(bookingOrPayload, decision = "approved", note = "") {
  const auth = requireManagement(await getAuthContext(), "Bạn không có quyền xử lý yêu cầu hủy.");
  const payload = resolveCancellationPayload(bookingOrPayload, decision, note);
  const booking = payload.bookingCode
    ? await getHydratedBookingByCode(payload.bookingCode)
    : await getHydratedBookingById(payload.bookingId);

  if (!booking) throw new Error("Không tìm thấy booking cần xử lý.");
  if (booking.booking_status !== "cancel_requested") {
    throw new Error("Booking này hiện không ở trạng thái chờ duyệt hủy.");
  }

  const approve = payload.decision !== "rejected" && payload.decision !== "reject";
  const safeNote = String(payload.note || "").trim();
  const now = new Date().toISOString();
  const latestPayment = booking.payments[0] || null;
  let nextPaymentStatus = booking.payment_status;
  let refundRecord = null;

  if (approve && latestPayment?.id && ["pending", "authorized"].includes(latestPayment.status)) {
    await restWrite("payments", {
      method: "PATCH",
      query: {
        id: `eq.${latestPayment.id}`,
        select: "*"
      },
      body: {
        status: "cancelled",
        failed_at: now,
        failure_reason: safeNote || "Booking cancellation approved before payment completion.",
        raw_response: {
          ...(latestPayment.raw_response || {}),
          cancelled_at: now,
          source: "management_cancellation_review"
        }
      }
    });

    await restWrite("payment_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        payment_id: latestPayment.id,
        event_name: "payment_cancelled",
        payload: {
          booking_code: booking.booking_code,
          note: safeNote || null
        },
        status: "processed",
        processed_at: now
      }
    });

    nextPaymentStatus = "unpaid";
  }

  if (approve && ["paid", "partially_paid"].includes(booking.payment_status) && latestPayment?.id) {
    const existingRefund = await safeSingle("refunds", {
      select: "*",
      payment_id: `eq.${latestPayment.id}`
    });

    if (existingRefun?.id) {
      refundRecord = existingRefund;
    } else {
      const refundRows = await restWrite("refunds", {
        method: "POST",
        query: { select: "*" },
        body: {
          payment_id: latestPayment.id,
          amount: Number(latestPayment.amount || booking.total_amount || 0),
          reason: safeNote || "Duyệt yêu cầu hủy booking",
          status: "pending",
          requested_by: booking.user_id || null,
          approved_by: auth.user.id
        }
      });
      refundRecord = refundRows?.[0] || null;

      await restWrite("payment_events", {
        method: "POST",
        query: { select: "*" },
        body: {
          payment_id: latestPayment.id,
          event_name: "refund_requested",
          payload: {
            booking_code: booking.booking_code,
            refund_id: refundRecor?.id || null,
            amount: Number(refundRecor?.amount || latestPayment.amount || 0)
          },
          status: "received"
        }
      });

      await restWrite("booking_events", {
        method: "POST",
        query: { select: "*" },
        body: {
          booking_id: booking.id,
          actor_id: auth.user.id,
          event_type: "refund_requested",
          note: `Đã tạo yêu cầu hoàn tiền cho booking ${booking.booking_code}.`
        }
      });
    }
  }

  const nextStatus = approve ? "cancelled" : (["paid", "partially_paid"].includes(booking.payment_status) ? "confirmed" : "awaiting_payment");
  await restWrite("bookings", {
    method: "PATCH",
    query: {
      id: `eq.${booking.id}`,
      select: "*"
    },
    body: {
      booking_status: nextStatus,
      payment_status: approve ? nextPaymentStatus : booking.payment_status,
      cancelled_at: approve ? now : null,
      cancel_reason: safeNote || booking.cancel_reason || null
    }
  });

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: approve ? "cancellation_approved" : "cancellation_rejected",
      note: safeNote || (approve ? "Yêu cầu hủy đã được duyệt." : "Yêu cầu hủy bị từ chối.")
    }
  });

  await createNotification({
    userId: booking.user_id,
    title: approve ? "Yêu cầu hủy đã được duyệt" : "Yêu cầu hủy bị từ chối",
    content: approve && refundRecor?.id
      ? `Booking ${booking.booking_code} đã được hủy và đang chờ hoàn tiền.`
      : `Booking ${booking.booking_code} đã được xử lý với kết quả ${approve ? "đồng ý hủy" : "từ chối hủy"}.`,
    notificationType: "booking",
    referenceType: "booking",
    referenceId: booking.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: approve ? "cancellation_approved" : "cancellation_rejected",
    entityType: "booking",
    entityId: booking.id,
    oldData: {
      booking_status: booking.booking_status,
      payment_status: booking.payment_status
    },
    newData: {
      booking_status: nextStatus,
      payment_status: approve ? nextPaymentStatus : booking.payment_status,
      refund_id: refundRecor?.id || null
    }
  });

  return getHydratedBookingById(booking.id);
}

export async function recordManualPayment(bookingOrPayload, note = "") {
  requireManagement(await getAuthContext(), "Bạn không có quyền ghi nhận thanh toán thủ công.");
  const payload = resolveManualPaymentPayload(bookingOrPayload, note);
  const booking = payload.bookingCode
    ? await getHydratedBookingByCode(payload.bookingCode)
    : await getHydratedBookingById(payload.bookingId);

  if (!booking) throw new Error("Không tìm thấy booking để ghi nhận thanh toán.");
  return payBooking(booking.booking_code, {
    source: "management_manual_payment",
    note: String(payload.note || "").trim() || "Bộ phận vận hành ghi nhận thanh toán thủ công."
  });
}


export async function updateBookingInternalNote(bookingOrPayload, note = "") {
  const auth = requireManagement(await getAuthContext(), "Bỏn kh?ng c? quy?n l?u ghi ch? n?i b?.");
  const payload = resolveManualPaymentPayload(bookingOrPayload, note);
  const booking = payload.bookingCode
    ? await getHydratedBookingByCode(payload.bookingCode)
    : await getHydratedBookingById(payload.bookingId);

  if (!booking) throw new Error("Không tìm thấy booking Đã lưu ghi ch? n?i b?.");
  const safeNote = String(payload.note || "").trim();
  if (!safeNote) {
    throw new Error("Ghi chú n?i b? không được để trống.");
  }

  await restWrite("booking_events", {
    method: "POST",
    query: { select: "*" },
    body: {
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "internal_note_added",
      note: safeNote,
      event_data: {
        visibility: "management",
        note_type: "internal"
      }
    }
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "booking_internal_note_added",
    entityType: "booking",
    entityId: booking.id,
    newData: { note: safeNote }
  });

  return getHydratedBookingById(booking.id);
}

export async function processRefund(refundOrPayload, decision = "refunded", note = "") {
  const auth = requireManagement(await getAuthContext(), "Bạn không có quyền xử lý refund.");
  const payload = resolveRefundPayload(refundOrPayload, decision, note);
  if (!payload.refundId) {
    throw new Error("Thiếu refund để xử lý.");
  }

  const refund = await safeSingle("refunds", {
    select: "*",
    id: `eq.${payload.refundId}`
  });
  if (!refund) throw new Error("Không tìm thấy refund cần xử lý.");

  const payment = refund.payment_id
    ? await safeSingle("payments", {
        select: "*",
        id: `eq.${refund.payment_id}`
      })
    : null;
  if (!payment?.id) throw new Error("Không tìm thấy payment gốc của refund này.");

  const booking = await getHydratedBookingById(payment.booking_id);
  if (!booking) throw new Error("Không tìm thấy booking liên quan tới refund.");

  const now = new Date().toISOString();
  const safeNote = String(payload.note || "").trim();
  const approve = payload.decision !== "rejected" && payload.decision !== "reject";

  if (approve) {
    const paymentAmount = Number(payment.amount || booking.total_amount || 0);
    const refundAmount = Number(refund.amount || 0);
    const nextPaymentStatus = refundAmount > 0 && refundAmount < paymentAmount ? "partially_refunded" : "refunded";

    await restWrite("refunds", {
      method: "PATCH",
      query: {
        id: `eq.${refund.id}`,
        select: "*"
      },
      body: {
        status: "refunded",
        approved_by: auth.user.id,
        refunded_at: now,
        reason: safeNote || refund.reason || null
      }
    });

    await restWrite("payments", {
      method: "PATCH",
      query: {
        id: `eq.${payment.id}`,
        select: "*"
      },
      body: {
        status: nextPaymentStatus,
        raw_response: {
          ...(payment.raw_response || {}),
          refund_processed_at: now,
          refund_note: safeNote || refund.reason || null,
          source: "management_refund_processing"
        }
      }
    });

    await restWrite("bookings", {
      method: "PATCH",
      query: {
        id: `eq.${booking.id}`,
        select: "*"
      },
      body: {
        payment_status: nextPaymentStatus
      }
    });

    await restWrite("payment_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        payment_id: payment.id,
        event_name: "refund_processed",
        payload: {
          booking_code: booking.booking_code,
          refund_id: refund.id,
          amount: refundAmount
        },
        status: "processed",
        processed_at: now
      }
    });

    await restWrite("booking_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "refund_processed",
        note: safeNote || `Đã xử lý hoàn tiền cho booking ${booking.booking_code}.`
      }
    });

    await createNotification({
      userId: booking.user_id,
      title: "Refund đã được xử lý",
      content: `Booking ${booking.booking_code} đã được hoàn tiền${nextPaymentStatus === "partially_refunded" ? " một phần" : ""}.`,
      notificationType: "payment",
      referenceType: "booking",
      referenceId: booking.id
    });

    await createActivityLog({
      actorId: auth.user.id,
      action: "refund_processed",
      entityType: "refund",
      entityId: refund.id,
      oldData: { status: refund.status },
      newData: { status: "refunded", payment_status: nextPaymentStatus }
    });
  } else {
    await restWrite("refunds", {
      method: "PATCH",
      query: {
        id: `eq.${refund.id}`,
        select: "*"
      },
      body: {
        status: "rejected",
        reason: safeNote || refund.reason || null
      }
    });

    await restWrite("payment_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        payment_id: payment.id,
        event_name: "refund_rejected",
        payload: {
          booking_code: booking.booking_code,
          refund_id: refund.id,
          note: safeNote || null
        },
        status: "processed",
        processed_at: now
      }
    });

    await restWrite("booking_events", {
      method: "POST",
      query: { select: "*" },
      body: {
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "refund_rejected",
        note: safeNote || `Yêu cầu hoàn tiền cho booking ${booking.booking_code} đã bị từ chối.`
      }
    });

    await createNotification({
      userId: booking.user_id,
      title: "Yêu cầu refund bị từ chối",
      content: `Refund của booking ${booking.booking_code} chưa được duyệt.`,
      notificationType: "payment",
      referenceType: "booking",
      referenceId: booking.id
    });

    await createActivityLog({
      actorId: auth.user.id,
      action: "refund_rejected",
      entityType: "refund",
      entityId: refund.id,
      oldData: { status: refund.status },
      newData: { status: "rejected" }
    });
  }

  return getHydratedBookingById(booking.id);
}

function requireAdminScope(auth, errorMessage = "Bỏn kh?ng c? quy?n th?c hiện thao t?c quản trị n?y.") {
  requireManagement(auth, errorMessage);
  if (!["admin", "super_admin"].includes(auth.primaryRole)) {
    throw new Error(errorMessage);
  }
  return auth;
}

async function resolveRoleMap() {
  const roles = await safeSelect("roles", { select: "id,name,description", order: "created_at.asc" });
  return new Map(roles.map((role) => [String(role.name || "").toLowerCase(), role]));
}

async function resolveUserRoleState(userId) {
  if (!userId) {
    return { roles: ["customer"], primaryRole: "customer" };
  }
  const [roleRows, assignments] = await Promise.all([
    safeSelect("roles", { select: "id,name", order: "created_at.asc" }),
    safeSelect("user_roles", { select: "user_id,role_id", user_id: `eq.${userId}` })
  ]);
  const roleMap = new Map(roleRows.map((role) => [role.id, String(role.name || "").toLowerCase()]));
  const roles = normalizeRoles(assignments.map((assignment) => roleMap.get(assignment.role_id)).filter(Boolean));
  return { roles, primaryRole: getPrimaryRole(roles) };
}

async function resolveManagementAssignee(assignedTo) {
  const nextAssignee = String(assignedTo || "").trim();
  if (!nextAssignee) return null;
  const state = await resolveUserRoleState(nextAssignee);
  if (!["staff", "admin", "super_admin"].includes(state.primaryRole)) {
    throw new Error("Ticket ch? c? th? ph?n cho staff ho?c admin.");
  }
  return nextAssignee;
}

function resolveUserRolePayload(userOrPayload, roleName = "") {
  if (userOrPayload && typeof userOrPayload === "object") {
    return {
      userId: userOrPayload.userId || userOrPayload.id,
      roleName: userOrPayload.roleName || userOrPayload.role || roleName || ""
    };
  }
  return { userId: userOrPayload, roleName: roleName || "" };
}

function resolveUserStatusPayload(userOrPayload, status = "blocked") {
  if (userOrPayload && typeof userOrPayload === "object") {
    return {
      userId: userOrPayload.userId || userOrPayload.id,
      status: userOrPayload.status || status || "blocked"
    };
  }
  return { userId: userOrPayload, status: status || "blocked" };
}

function normalizeSystemSettingValue(value) {
  if (value == null) return {};
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export async function updateTicketStatus(ticketOrPayload, status, note = "") {
  const auth = requireManagement(await getAuthContext(), "Bạn không có quyền cập nhật ticket.");
  const payload = resolveTicketPayload(ticketOrPayload, status, note);
  if (!payload.ticketId) {
    throw new Error("Thiếu thông tin cập nhật ticket.");
  }

  const ticket = await safeSingle("support_tickets", {
    select: "*",
    id: `eq.${payload.ticketId}`
  });
  if (!ticket) throw new Error("Không tìm thấy ticket hỗ trợ.");

  const nextStatus = payload.status || ticket.status || "open";
  const safeNote = String(payload.note || "").trim();
  const nextAssignedTo = await resolveManagementAssignee(payload.assignedTo) || ticket.assigned_to || auth.user.id;
  const closedAt = ["resolved", "closed"].includes(nextStatus) ? new Date().toISOString() : null;

  await restWrite("support_tickets", {
    method: "PATCH",
    query: { id: `eq.${ticket.id}`, select: "*" },
    body: { status: nextStatus, assigned_to: nextAssignedTo, closed_at: closedAt }
  });

  if (safeNote) {
    await restWrite("support_ticket_messages", {
      method: "POST",
      query: { select: "*" },
      body: { ticket_id: ticket.id, sender_id: auth.user.id, sender_type: "staff", message: safeNote }
    });
  }

  await createNotification({
    userId: ticket.user_id,
    title: "Ticket hỗ trợ được cập nhật",
    content: safeNote || `Ticket ${ticket.ticket_code} đã chuyển sang trạng thái ${nextStatus}.`,
    notificationType: "support_ticket",
    referenceType: "support_ticket",
    referenceId: ticket.id
  });

  await createActivityLog({
    actorId: auth.user.id,
    action: "support_ticket_updated",
    entityType: "support_ticket",
    entityId: ticket.id,
    oldData: { status: ticket.status, assigned_to: ticket.assigned_to || null },
    newData: { status: nextStatus, assigned_to: nextAssignedTo, note: safeNote || null }
  });

  return safeSingle("support_tickets", { select: "*", id: `eq.${ticket.id}` });
}


export async function updateAdminUserRole(userOrPayload, roleName = "") {
  const auth = requireAdminScope(await getAuthContext(), "Bạn không có quyền đổi vai trò người dùng.");
  const payload = resolveUserRolePayload(userOrPayload, roleName);
  const userId = String(payload.userId || "").trim();
  const nextRole = String(payload.roleName || "").trim().toLowerCase();
  if (!userId || !nextRole) throw new Error("Thiếu người dùng hoặc vai trò cần cập nhật.");
  if (userId === auth.user.id) throw new Error("Không thể tự đổi vai trò của tài khoản đang đăng nhập.");

  const profile = await safeSingle("profiles", { select: "*", id: `eq.${userId}` });
  if (!profile) throw new Error("Không tìm thấy người dùng cần cập nhật.");

  const currentState = await resolveUserRoleState(userId);
  if (currentState.primaryRole === nextRole) return profile;
  if ((nextRole === "super_admin" || currentState.primaryRole === "super_admin") && auth.primaryRole !== "super_admin") {
    throw new Error("Chỉ super admin mới có thể thay đổi vai trò super admin.");
  }

  const roleMap = await resolveRoleMap();
  const roleRecord = roleMap.get(nextRole);
  if (!roleRecor?.id) throw new Error("Vai trò được chọn không tồn tại trong DB.");

  await replaceJoinTableRows("user_roles", "user_id", userId, [{ user_id: userId, role_id: roleRecord.id, assigned_by: auth.user.id }]);
  await createActivityLog({ actorId: auth.user.id, action: "user_role_updated", entityType: "profile", entityId: userId, oldData: { role: currentState.primaryRole }, newData: { role: nextRole } });
  return safeSingle("profiles", { select: "*", id: `eq.${userId}` });
}

export async function updateAdminUserStatus(userOrPayload, status = "blocked") {
  const auth = requireAdminScope(await getAuthContext(), "Bạn không có quyền khóa hoặc mở tài khoản.");
  const payload = resolveUserStatusPayload(userOrPayload, status);
  const userId = String(payload.userId || "").trim();
  const nextStatus = ["active", "inactive", "blocked"].includes(payload.status) ? payload.status : "active";
  if (!userId) throw new Error("Thiếu người dùng cần cập nhật trạng thái.");
  if (userId === auth.user.id && nextStatus !== "active") throw new Error("Không thể tự khóa tài khoản đang đăng nhập.");

  const profile = await safeSingle("profiles", { select: "*", id: `eq.${userId}` });
  if (!profile) throw new Error("Không tìm thấy người dùng cần cập nhật trạng thái.");

  const currentState = await resolveUserRoleState(userId);
  if (currentState.primaryRole === "super_admin" && auth.primaryRole !== "super_admin") {
    throw new Error("Chỉ super admin mới có thể thay đổi trạng thái tài khoản super admin.");
  }
  if (String(profile.status || "active") == nextStatus) return profile;

  const rows = await restWrite("profiles", { method: "PATCH", query: { id: `eq.${userId}`, select: "*" }, body: { status: nextStatus } });
  await createActivityLog({ actorId: auth.user.id, action: "user_status_updated", entityType: "profile", entityId: userId, oldData: { status: profile.status || "active" }, newData: { status: nextStatus } });
  await createNotification({
    userId,
    title: nextStatus === "blocked" ? "Tài khoản đã bị khóa" : "Tài khoản đã được cập nhật",
    content: nextStatus === "blocked"
      ? "Tài khoản của bạn đang bị khóa tạm thời. Vui lòng liên hệ bộ phận hỗ trợ nếu cần thêm thông tin."
      : `Tài khoản của bạn hiện ở trạng thái ${nextStatus}.`,
    notificationType: "system",
    referenceType: "profile",
    referenceId: userId
  });
  return rows?.[0] || null;
}

export async function saveAdminSystemSetting(payload = {}) {
  const auth = requireAdminScope(await getAuthContext(), "Bạn không có quyền cập nhật cấu hình hệ thống.");
  const settingId = String(payload.id || "").trim() || null;
  const settingKey = String(payload.settingKey || payload.setting_key || "").trim();
  if (!settingKey) throw new Error("Setting key là bắt buộc.");

  const current = settingId
    ? await safeSingle("system_settings", { select: "*", id: `eq.${settingId}` })
    : await safeSingle("system_settings", { select: "*", setting_key: `eq.${settingKey}` });
  const settingValue = normalizeSystemSettingValue(payload.settingValue ? payload.setting_value ? payload.setting_value : payload.settingValue : current?.setting_value);
  const body = { setting_key: settingKey, setting_value: settingValue, description: String(payload.description || "").trim() || null, updated_by: auth.user.id };
  const rows = current?.id
    ? await restWrite("system_settings", { method: "PATCH", query: { id: `eq.${current.id}`, select: "*" }, body })
    : await restWrite("system_settings", { method: "POST", query: { select: "*" }, body });

  await createActivityLog({
    actorId: auth.user.id,
    action: current?.id ? "system_setting_updated" : "system_setting_created",
    entityType: "system_setting",
    entityId: rows?.[0]?.id || current?.id || null,
    oldData: current ? { setting_key: current.setting_key, setting_value: current.setting_value } : null,
    newData: { setting_key: settingKey, setting_value: settingValue }
  });
  return rows?.[0] || null;
}

export async function toggleAdminPaymentMethod(methodId, isActive) {
  const auth = requireAdminScope(await getAuthContext(), "Bạn không có quyền cập nhật phương thức thanh toán.");
  if (!methodId) throw new Error("Thiếu phương thức thanh toán cần cập nhật.");
  const existing = await safeSingle("payment_methods", { select: "*", id: `eq.${methodId}` });
  if (!existing) throw new Error("Không tìm thấy phương thức thanh toán.");

  const rows = await restWrite("payment_methods", { method: "PATCH", query: { id: `eq.${methodId}`, select: "*" }, body: { is_active: Boolean(isActive) } });
  await createActivityLog({ actorId: auth.user.id, action: "payment_method_toggled", entityType: "payment_method", entityId: methodId, oldData: { is_active: Boolean(existing.is_active) }, newData: { is_active: Boolean(isActive) } });
  return rows?.[0] || null;
}

export async function saveAdminTour(payload = {}) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t tour.");
  const existingId = payload.id || null;
  const name = String(payload.name || "").trim();
  const slug = normalizeSlug(payload.slug || name);
  if (!name || !slug) throw new Error("Ten tour va slug la bat buoc.");

  const createdLocation = payload.newDestination ? await ensureAdminLocation(payload.newDestination) : null;
  const destinationIds = uniqueStrings([payload.destinationIds || payload.primaryDestinationId || [], createdLocation?.id || ""]);
  if (!destinationIds.length) throw new Error("Tour can it nhat mot diem den.");

  const durationDays = Math.max(1, toNumber(payload.durationDays || payload.duration_days, 1));
  const durationNights = Math.max(0, toNumber(payload.durationNights || payload.duration_nights, 0));
  const status = ["draft", "published", "archived"].includes(payload.status) ? payload.status : "draft";
  const actorId = auth.user.id;
  const tourBody = {
    slug,
    name,
    short_description: String(payload.shortDescription || payload.short_description || "").trim() || null,
    description: String(payload.description || "").trim() || null,
    duration_days: durationDays,
    duration_nights: durationNights,
    base_currency: String(payload.baseCurrency || payload.base_currency || "VND").trim() || "VND",
    is_featured: Boolean(payload.isFeatured || payload.is_featured),
    included_text: String(payload.includedText || payload.included_text || "").trim() || null,
    excluded_text: String(payload.excludedText || payload.excluded_text || "").trim() || null,
    terms_text: String(payload.termsText || payload.terms_text || "").trim() || null,
    important_notes: String(payload.importantNotes || payload.important_notes || "").trim() || null,
    cancellation_policy_id: payload.cancellationPolicyId || payload.cancellation_policy_id || null,
    status,
    updated_by: actorId,
    published_at: status === "published" ? (payload.publishedAt || new Date().toISOString()) : null
  };

  const rows = existingId
    ? await restWrite("tours", { method: "PATCH", query: { id: `eq.${existingId}`, select: "*" }, body: tourBody })
    : await restWrite("tours", { method: "POST", query: { select: "*" }, body: { ...tourBody, created_by: actorId } });
  const tour = rows[0];
  if (!tour?.id) throw new Error("Khong the l?u tour.");

  await replaceJoinTableRows("tour_destinations", "tour_id", tour.id, destinationIds.map((locationId, index) => ({
    tour_id: tour.id,
    location_id: locationId,
    sort_order: index,
    is_primary: index === 0
  })));

  const categoryIds = uniqueStrings(payload.categoryIds || []);
  await replaceJoinTableRows("tour_categories", "tour_id", tour.id, categoryIds.map((categoryId) => ({
    tour_id: tour.id,
    category_id: categoryId
  })));

  const galleryImageUrls = Array.isArray(payload.galleryImageUrls) ? payload.galleryImageUrls : uniqueStrings(payload.galleryImageUrls || []);
  const imageUrls = uniqueStrings([payload.coverImageUrl || payload.cover_image_url || "", ...galleryImageUrls]);
  await replaceJoinTableRows("tour_images", "tour_id", tour.id, imageUrls.map((imageUrl, index) => ({
    tour_id: tour.id,
    image_url: imageUrl,
    alt_text: name,
    is_cover: index === 0,
    sort_order: index
  })));

  const itineraryDays = Array.isArray(payload.itineraryDays) ? payload.itineraryDays : parseItineraryInput(payload.itineraryInput || payload.itinerary || "");
  await replaceJoinTableRows("tour_itinerary_days", "tour_id", tour.id, itineraryDays.map((day, index) => ({
    tour_id: tour.id,
    day_number: toNumber(day.dayNumber || day.day_number, index + 1),
    title: String(day.title || `Ngay ${index + 1}`).trim(),
    description: String(day.description || "").trim() || null,
    meals: Array.isArray(day.meals) ? day.meals : [],
    accommodation: day.accommodation || null,
    transportation: day.transportation || null
  })));

  invalidateSiteCatalogCache();
  await createActivityLog({
    actorId,
    action: existingId ? "tour_updated" : "tour_created",
    entityType: "tour",
    entityId: tour.id,
    newData: { status }
  });

  return tour;
}

export async function setAdminTourStatus(tourId, status) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t tour.");
  if (!tourId || !["draft", "published", "archived"].includes(status)) {
    throw new Error("Trang thai tour khong hop le.");
  }
  const rows = await restWrite("tours", {
    method: "PATCH",
    query: { id: `eq.${tourId}`, select: "*" },
    body: {
      status,
      updated_by: auth.user.id,
      published_at: status === "published" ? new Date().toISOString() : null
    }
  });
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: "tour_status_updated", entityType: "tour", entityId: tourId, newData: { status } });
  return rows[0] || null;
}

export async function saveAdminSchedule(payload = {}) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t l?ch kh?i h?nh.");
  const scheduleId = payload.id || null;
  const tourId = payload.tourId || payload.tour_id;
  if (!tourId) throw new Error("Can chon tour cho lich khoi hanh.");
  const departureDate = normalizeDateOnly(payload.departureDate || payload.departure_date);
  const returnDate = normalizeDateOnly(payload.returnDate || payload.return_date);
  if (!departureDate || !returnDate) throw new Error("Ngay khoi hanh va ngay ve la bat buoc.");
  const capacity = Math.max(1, toNumber(payload.capacity, 1));
  const status = ["draft", "open", "sold_out", "closed", "completed", "cancelled"].includes(payload.status) ? payload.status : "draft";
  const currency = String(payload.currency || "VND").trim() || "VND";

  const rows = scheduleId
    ? await restWrite("departure_schedules", {
        method: "PATCH",
        query: { id: `eq.${scheduleId}`, select: "*" },
        body: {
          tour_id: tourId,
          departure_date: departureDate,
          return_date: returnDate,
          meeting_point: String(payload.meetingPoint || payload.meeting_point || "").trim() || null,
          meeting_at: normalizeDateTime(payload.meetingAt || payload.meeting_at),
          capacity,
          cutoff_at: normalizeDateTime(payload.cutoffAt || payload.cutoff_at),
          status,
          currency,
          notes: String(payload.notes || "").trim() || null,
          updated_by: auth.user.id
        }
      })
    : await restWrite("departure_schedules", {
        method: "POST",
        query: { select: "*" },
        body: {
          tour_id: tourId,
          departure_date: departureDate,
          return_date: returnDate,
          meeting_point: String(payload.meetingPoint || payload.meeting_point || "").trim() || null,
          meeting_at: normalizeDateTime(payload.meetingAt || payload.meeting_at),
          capacity,
          cutoff_at: normalizeDateTime(payload.cutoffAt || payload.cutoff_at),
          status,
          currency,
          notes: String(payload.notes || "").trim() || null,
          created_by: auth.user.id,
          updated_by: auth.user.id
        }
      });

  const schedule = rows[0];
  if (!schedule?.id) throw new Error("Khong the l?u lich khoi hanh.");

  const priceRows = [
    { traveler_type: "adult", price: Number(payload.adultPrice || 0), age_from: null, age_to: null },
    { traveler_type: "child", price: Number(payload.childPrice || 0), age_from: 2, age_to: 11 },
    { traveler_type: "infant", price: Number(payload.infantPrice || 0), age_from: 0, age_to: 1 }
  ].filter((item) => item.price > 0);
  await replaceJoinTableRows("schedule_price_tiers", "schedule_id", schedule.id, priceRows.map((item) => ({
    schedule_id: schedule.id,
    traveler_type: item.traveler_type,
    age_from: item.age_from,
    age_to: item.age_to,
    price: item.price,
    sale_price: null,
    currency
  })));

  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: scheduleId ? "schedule_updated" : "schedule_created", entityType: "schedule", entityId: schedule.id, newData: { status } });
  return schedule;
}

export async function saveAdminCoupon(payload = {}) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t coupon.");
  const couponId = payload.id || null;
  const code = String(payload.code || "").trim().toUpperCase();
  const name = String(payload.name || code).trim();
  if (!code || !name) throw new Error("Code va ten coupon la bat buoc.");
  const discountType = payload.discountType === "fixed_amount" ? "fixed_amount" : "percentage";
  const discountValue = Number(payload.discountValue || 0);
  if (!(discountValue > 0)) throw new Error("Gia tri giam gia phai lon hon 0.");

  const rows = couponId
    ? await restWrite("coupons", {
        method: "PATCH",
        query: { id: `eq.${couponId}`, select: "*" },
        body: {
          code,
          name,
          description: String(payload.description || "").trim() || null,
          discount_type: discountType,
          discount_value: discountValue,
          min_order_amount: Number(payload.minOrderAmount || 0),
          max_discount_amount: payload.maxDiscountAmount === "" || payload.maxDiscountAmount == null ? null : Number(payload.maxDiscountAmount),
          start_at: normalizeDateTime(payload.startAt),
          end_at: normalizeDateTime(payload.endAt),
          usage_limit: payload.usageLimit === "" || payload.usageLimit == null ? null : Number(payload.usageLimit),
          usage_per_user_limit: payload.usagePerUserLimit === "" || payload.usagePerUserLimit == null ? null : Number(payload.usagePerUserLimit),
          is_active: Boolean(payload.isActive)
        }
      })
    : await restWrite("coupons", {
        method: "POST",
        query: { select: "*" },
        body: {
          code,
          name,
          description: String(payload.description || "").trim() || null,
          discount_type: discountType,
          discount_value: discountValue,
          min_order_amount: Number(payload.minOrderAmount || 0),
          max_discount_amount: payload.maxDiscountAmount === "" || payload.maxDiscountAmount == null ? null : Number(payload.maxDiscountAmount),
          start_at: normalizeDateTime(payload.startAt),
          end_at: normalizeDateTime(payload.endAt),
          usage_limit: payload.usageLimit === "" || payload.usageLimit == null ? null : Number(payload.usageLimit),
          usage_per_user_limit: payload.usagePerUserLimit === "" || payload.usagePerUserLimit == null ? null : Number(payload.usagePerUserLimit),
          is_active: Boolean(payload.isActive),
          created_by: auth.user.id
        }
      });
  const coupon = rows[0];
  if (!coupon?.id) throw new Error("Khong the l?u coupon.");

  await replaceJoinTableRows("coupon_tours", "coupon_id", coupon.id, uniqueStrings(payload.tourIds || []).map((tourId) => ({ coupon_id: coupon.id, tour_id: tourId })));
  await replaceJoinTableRows("coupon_categories", "coupon_id", coupon.id, uniqueStrings(payload.categoryIds || []).map((categoryId) => ({ coupon_id: coupon.id, category_id: categoryId })));
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: couponId ? "coupon_updated" : "coupon_created", entityType: "coupon", entityId: coupon.id });
  return coupon;
}

export async function toggleAdminCoupon(couponId, isActive) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t coupon.");
  const rows = await restWrite("coupons", {
    method: "PATCH",
    query: { id: `eq.${couponId}`, select: "*" },
    body: { is_active: Boolean(isActive) }
  });
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: "coupon_toggled", entityType: "coupon", entityId: couponId, newData: { is_active: Boolean(isActive) } });
  return rows[0] || null;
}

export async function saveAdminBanner(payload = {}) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t banner.");
  const bannerId = payload.id || null;
  const title = String(payload.title || "").trim();
  const imageUrl = String(payload.imageUrl || payload.image_url || "").trim();
  if (!title || !imageUrl) throw new Error("Tieu de va anh banner la bat buoc.");
  const body = {
    title,
    image_url: imageUrl,
    link_url: String(payload.linkUrl || payload.link_url || "").trim() || null,
    placement: String(payload.placement || "home").trim() || "home",
    sort_order: toNumber(payload.sortOrder || payload.sort_order, 0),
    is_active: Boolean(payload.isActive),
    start_at: normalizeDateTime(payload.startAt),
    end_at: normalizeDateTime(payload.endAt)
  };
  const rows = bannerId
    ? await restWrite("banners", { method: "PATCH", query: { id: `eq.${bannerId}`, select: "*" }, body })
    : await restWrite("banners", { method: "POST", query: { select: "*" }, body });
  const banner = rows[0];
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: bannerId ? "banner_updated" : "banner_created", entityType: "banner", entityId: banner?.id || bannerId });
  return banner;
}

export async function toggleAdminBanner(bannerId, isActive) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t banner.");
  const rows = await restWrite("banners", {
    method: "PATCH",
    query: { id: `eq.${bannerId}`, select: "*" },
    body: { is_active: Boolean(isActive) }
  });
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: "banner_toggled", entityType: "banner", entityId: bannerId, newData: { is_active: Boolean(isActive) } });
  return rows[0] || null;
}

export async function saveAdminCmsPage(payload = {}) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t trang CMS.");
  const pageId = payload.id || null;
  const title = String(payload.title || "").trim();
  const slug = normalizeSlug(payload.slug || title);
  if (!title || !slug) throw new Error("Tieu de va slug cua trang CMS la bat buoc.");
  const isPublished = Boolean(payload.isPublished);
  const body = {
    slug,
    title,
    content: String(payload.content || "").trim() || null,
    meta_title: String(payload.metaTitle || "").trim() || null,
    meta_description: String(payload.metaDescription || "").trim() || null,
    is_published: isPublished,
    published_at: isPublished ? (payload.publishedAt || new Date().toISOString()) : null,
    updated_by: auth.user.id
  };
  const rows = pageId
    ? await restWrite("cms_pages", { method: "PATCH", query: { id: `eq.${pageId}`, select: "*" }, body })
    : await restWrite("cms_pages", { method: "POST", query: { select: "*" }, body: { ...body, created_by: auth.user.id } });
  const page = rows[0];
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: pageId ? "cms_page_updated" : "cms_page_created", entityType: "cms_page", entityId: page?.id || pageId, newData: { is_published: isPublished } });
  return page;
}

export async function toggleAdminCmsPage(pageId, isPublished) {
  const auth = requireManagement(await getAuthContext(), "B?n kh?ng c? quy?n c?p nh?t trang CMS.");
  const rows = await restWrite("cms_pages", {
    method: "PATCH",
    query: { id: `eq.${pageId}`, select: "*" },
    body: {
      is_published: Boolean(isPublished),
      published_at: isPublished ? new Date().toISOString() : null,
      updated_by: auth.user.id
    }
  });
  invalidateSiteCatalogCache();
  await createActivityLog({ actorId: auth.user.id, action: "cms_page_toggled", entityType: "cms_page", entityId: pageId, newData: { is_published: Boolean(isPublished) } });
  return rows[0] || null;
}

