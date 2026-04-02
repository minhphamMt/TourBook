import { CATALOG_TTL } from "../config.js";
import {
  average,
  buildInFilter,
  compactText,
  computeCouponDiscount,
  computeSubtotal,
  formatDuration,
  getAuthContext,
  getEffectivePrice,
  isCouponEligible,
  normalizeSearch,
  safeSelect,
  splitRichText,
  toNumber
} from "./core.js";

let catalogCache = { data: null, expiresAt: 0 };

export function invalidateSiteCatalogCache() {
  catalogCache = { data: null, expiresAt: 0 };
}

function isWithinWindow(startAt, endAt, now = new Date()) {
  if (startAt && new Date(startAt).getTime() > now.getTime()) return false;
  if (endAt && new Date(endAt).getTime() < now.getTime()) return false;
  return true;
}

function getLocationTrail(location, locationMap) {
  const trail = [];
  let cursor = location;
  let guard = 0;

  while (cursor && guard < 12) {
    trail.unshift(cursor);
    cursor = locationMap.get(cursor.parent_id) || null;
    guard += 1;
  }

  return trail;
}

function inferVietnamRegion(locationName) {
  const normalized = normalizeSearch(locationName);
  const north = ["ha noi", "ha long", "vinh ha long", "ninh binh", "sa pa"];
  const central = ["da nang", "hoi an", "hue"];
  const south = ["ho chi minh city", "tp ho chi minh", "nha trang", "phu quoc"];

  if (north.some((item) => normalized.includes(item))) {
    return {
      label: "Miền Bắc",
      slug: "mien-bac",
      description: "Những hành trình nổi bật ở phía Bắc với cảnh quan núi rừng, di sản và thành phố lịch sử."
    };
  }

  if (central.some((item) => normalized.includes(item))) {
    return {
      label: "Miền Trung",
      slug: "mien-trung",
      description: "Các điểm đến giàu chất biển, văn hóa và nhịp nghỉ dưỡng đặc trưng miền Trung."
    };
  }

  if (south.some((item) => normalized.includes(item))) {
    return {
      label: "Miền Nam",
      slug: "mien-nam",
      description: "Nhóm hành trình phía Nam thiên về biển đảo, nghỉ dưỡng và city break năng động."
    };
  }

  return {
    label: "Việt Nam",
    slug: "viet-nam",
    description: "Các điểm đến công khai đang mở tại Việt Nam."
  };
}

function getLocationMeta(location, locationMap) {
  const trail = getLocationTrail(location, locationMap);
  const parent = trail.length > 1 ? trail[trail.length - 2] : null;
  const country = trail.find((item) => item.location_type === "country") || null;
  const broadRegion = trail.find((item) => ["continent", "region"].includes(item.location_type)) || null;
  const isVietnam = normalizeSearch(country?.name || "") === "vietnam" || normalizeSearch(country?.name || "") === "viet nam";
  const domesticRegion = isVietnam ? inferVietnamRegion(location.name) : null;

  return {
    trail,
    parent,
    country,
    broadRegion,
    regionLabel: broadRegion?.name || domesticRegion?.label || country?.name || parent?.name || location.name,
    regionSlug: broadRegion?.slug || domesticRegion?.slug || country?.slug || parent?.slug || location.slug,
    regionDescription:
      compactText(
        broadRegion?.description || domesticRegion?.description || country?.description || parent?.description,
        `Các hành trình nổi bật quanh ${location.name}.`
      ),
    countryLabel: country?.name || parent?.name || location.name
  };
}

function sortToursByPopular(left, right) {
  return (
    right.popularityScore - left.popularityScore ||
    right.reviewCount - left.reviewCount ||
    Number(right.isFeatured) - Number(left.isFeatured) ||
    String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""))
  );
}

function buildDestinationGroups(destinations) {
  const groups = destinations.reduce((map, destination) => {
    const key = destination.regionSlug || destination.regionLabel || destination.location.slug;
    const bucket = map.get(key) || {
      key,
      label: destination.regionLabel,
      description: destination.regionDescription,
      countryLabel: destination.countryLabel,
      destinations: []
    };

    bucket.destinations.push(destination);
    map.set(key, bucket);
    return map;
  }, new Map());

  return Array.from(groups.values())
    .map((group) => {
      const totalTours = group.destinations.reduce((sum, item) => sum + item.totalTours, 0);
      const totalOpenSchedules = group.destinations.reduce((sum, item) => sum + item.openScheduleCount, 0);
      const pricedDestinations = group.destinations.map((item) => item.startingPrice).filter((value) => value > 0);
      return {
        ...group,
        destinations: [...group.destinations].sort((left, right) => right.totalTours - left.totalTours || left.location.sort_order - right.location.sort_order),
        totalTours,
        destinationCount: group.destinations.length,
        totalOpenSchedules,
        startingPrice: pricedDestinations.length ? Math.min(...pricedDestinations) : 0
      };
    })
    .sort((left, right) => right.totalTours - left.totalTours || left.label.localeCompare(right.label));
}

function buildRatingBreakdown(reviews = []) {
  const buckets = new Map(
    [5, 4, 3, 2, 1].map((rating) => [rating, 0])
  );

  reviews.forEach((review) => {
    const rating = Math.min(5, Math.max(1, Math.round(toNumber(review?.rating, 0))));
    buckets.set(rating, (buckets.get(rating) || 0) + 1);
  });

  const total = reviews.length;
  return Array.from(buckets.entries()).map(([rating, count]) => ({
    rating,
    count,
    percent: total ? Math.round((count / total) * 100) : 0
  }));
}

function buildReviewSummary(reviews = []) {
  const totalReviews = reviews.length;
  const averageRating = totalReviews
    ? Number(average(reviews.map((item) => toNumber(item.rating, 0))).toFixed(1))
    : 0;
  const ratingBreakdown = buildRatingBreakdown(reviews);
  const positiveReviewCount = reviews.filter((item) => toNumber(item.rating, 0) >= 4).length;

  return {
    totalReviews,
    averageRating,
    ratingBreakdown,
    replyCount: reviews.filter((item) => Boolean(item.reply)).length,
    recommendedPercent: totalReviews ? Math.round((positiveReviewCount / totalReviews) * 100) : 0
  };
}

function buildCatalog(raw) {
  const locationMap = new Map(raw.locations.map((item) => [item.id, item]));
  const categoryMap = new Map(raw.categories.map((item) => [item.id, item]));
  const replyMap = new Map(raw.reviewReplies.map((item) => [item.review_id, item]));
  const profileMap = new Map(raw.profiles.map((item) => [item.id, item]));
  const cancellationPolicyMap = new Map(
    raw.cancellationPolicies.map((item) => [
      item.id,
      {
        id: item.id,
        name: item.name,
        description: compactText(item.description, "Chinh sach huy tour dang duoc cap nhat."),
        rules: Array.isArray(item.rules_jsonb)
          ? item.rules_jsonb
              .map((rule) => ({
                daysBefore: toNumber(rule.days_before, 0),
                refundPercent: toNumber(rule.refund_percent, 0)
              }))
              .sort((left, right) => right.daysBefore - left.daysBefore)
          : []
      }
    ])
  );
  const couponTourMap = raw.couponTours.reduce((map, item) => {
    const list = map.get(item.coupon_id) || [];
    list.push(item.tour_id);
    map.set(item.coupon_id, list);
    return map;
  }, new Map());
  const couponCategoryMap = raw.couponCategories.reduce((map, item) => {
    const list = map.get(item.coupon_id) || [];
    list.push(item.category_id);
    map.set(item.coupon_id, list);
    return map;
  }, new Map());
  const imageGroups = raw.images.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const tourDestinationGroups = raw.destinations.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const categoryGroups = raw.tourCategories.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    const category = categoryMap.get(item.category_id);
    if (category) list.push(category);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const availabilityMap = new Map((raw.scheduleAvailability || []).map((item) => [item.schedule_id, item]));
  const scheduleGroups = raw.schedules.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const priceGroups = raw.priceTiers.reduce((map, item) => {
    const list = map.get(item.schedule_id) || [];
    list.push({
      travelerType: item.traveler_type,
      price: toNumber(item.price),
      salePrice: item.sale_price == null ? null : toNumber(item.sale_price)
    });
    map.set(item.schedule_id, list);
    return map;
  }, new Map());
  const itineraryGroups = raw.itinerary.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const reviewGroups = raw.reviews.reduce((map, review) => {
    const list = map.get(review.tour_id) || [];
    const author = profileMap.get(review.user_id) || null;
    const reply = replyMap.get(review.id) || null;
    list.push({
      id: review.id,
      tourId: review.tour_id,
      bookingId: review.booking_id,
      rating: toNumber(review.rating, 5),
      comment: compactText(review.comment, "Khách hàng chưa để lại nội dung."),
      status: review.status,
      createdAt: review.created_at,
      authorName: author?.full_name || author?.email || "Khách đã đặt tour",
      reply: reply
        ? {
            id: reply.id,
            text: reply.reply_text,
            createdAt: reply.created_at,
            authorName: "TourBook"
          }
        : null
    });
    map.set(review.tour_id, list);
    return map;
  }, new Map());

  const tours = raw.tours.map((tour) => {
    const destinations = (tourDestinationGroups.get(tour.id) || [])
      .map((item) => locationMap.get(item.location_id))
      .filter(Boolean)
      .map((location) => {
        const meta = getLocationMeta(location, locationMap);
        return {
          ...location,
          parentName: meta.parent?.name || null,
          regionLabel: meta.regionLabel,
          regionSlug: meta.regionSlug,
          regionDescription: meta.regionDescription,
          countryLabel: meta.countryLabel,
          ancestorTrail: meta.trail.map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            locationType: item.location_type
          }))
        };
      });
    const categories = categoryGroups.get(tour.id) || [];
    const schedules = (scheduleGroups.get(tour.id) || [])
      .map((item) => {
        const prices = priceGroups.get(item.id) || [];
        const effectivePrices = prices.map((price) => getEffectivePrice(price)).filter((value) => value > 0);
        const basePrice = effectivePrices.length ? Math.min(...effectivePrices) : 0;
        const availability = availabilityMap.get(item.id);
        const capacity = toNumber(availability?.capacity ?? item.capacity, 0);
        const availableSlots = toNumber(availability?.available_slots ?? item.capacity, 0);
        const reservedSlots = toNumber(availability?.reserved_slots ?? 0, 0);
        const rawStatus = item.status || "open";
        const displayStatus = rawStatus === "open" && availableSlots <= 0 ? "sold_out" : rawStatus;
        return {
          id: item.id,
          tourId: item.tour_id,
          departureDate: item.departure_date,
          returnDate: item.return_date,
          meetingPoint: compactText(item.meeting_point, "Cap nhat sau"),
          meetingAt: item.meeting_at || null,
          cutoffAt: item.cutoff_at || null,
          notes: compactText(item.notes, ""),
          capacity,
          availableSlots,
          reservedSlots,
          status: rawStatus,
          displayStatus,
          isBookable: displayStatus === "open" && availableSlots > 0,
          currency: item.currency || tour.base_currency || "VND",
          prices,
          basePrice
        };
      })
      .sort((left, right) => String(left.departureDate).localeCompare(String(right.departureDate)));
    const reviews = reviewGroups.get(tour.id) || [];
    const reviewSummary = buildReviewSummary(reviews);
    const departureLocationRaw = locationMap.get(tour.departure_location_id) || null;
    const departureLocationMeta = departureLocationRaw ? getLocationMeta(departureLocationRaw, locationMap) : null;
    const departureLocation = departureLocationRaw
      ? {
          ...departureLocationRaw,
          regionLabel: departureLocationMeta?.regionLabel || departureLocationRaw.name,
          regionSlug: departureLocationMeta?.regionSlug || departureLocationRaw.slug,
          countryLabel: departureLocationMeta?.countryLabel || departureLocationRaw.name,
          ancestorTrail: (departureLocationMeta?.trail || []).map((item) => ({
            id: item.id,
            name: item.name,
            slug: item.slug,
            locationType: item.location_type
          }))
        }
      : null;
    const cancellationPolicy = cancellationPolicyMap.get(tour.cancellation_policy_id) || null;
    const positivePrices = schedules.map((item) => item.basePrice).filter((value) => value > 0);
    const startingPrice = positivePrices.length ? Math.min(...positivePrices) : 0;
    const openScheduleCount = schedules.filter((schedule) => schedule.displayStatus === "open").length;
    const reservedSlotCount = schedules.reduce((sum, schedule) => sum + toNumber(schedule.reservedSlots), 0);
    const availableSlotCount = schedules.reduce((sum, schedule) => sum + toNumber(schedule.availableSlots), 0);
    const nextSchedule = schedules.find((schedule) => schedule.isBookable) || schedules.find((schedule) => !["completed", "cancelled"].includes(schedule.displayStatus)) || schedules[0] || null;
    return {
      id: tour.id,
      slug: tour.slug,
      name: tour.name,
      shortDescription: compactText(tour.short_description),
      description: compactText(tour.description),
      durationDays: toNumber(tour.duration_days),
      durationNights: toNumber(tour.duration_nights),
      durationLabel: formatDuration(toNumber(tour.duration_days), toNumber(tour.duration_nights)),
      baseCurrency: tour.base_currency || "VND",
      publishedAt: tour.published_at || tour.created_at || null,
      isFeatured: Boolean(tour.is_featured),
      destinations,
      destinationLabel: destinations[0]?.name || "Đang cập nhật",
      regionLabel: destinations[0]?.regionLabel || destinations[0]?.countryLabel || "Đang cập nhật",
      categories,
      departureLocation,
      cancellationPolicy,
      coverImage:
        (imageGroups.get(tour.id) || []).find((item) => item.is_cover)?.image_url ||
        (imageGroups.get(tour.id) || [])[0]?.image_url ||
        null,
      gallery: imageGroups.get(tour.id) || [],
      schedules,
      itinerary: (itineraryGroups.get(tour.id) || []).sort((left, right) => toNumber(left.day_number) - toNumber(right.day_number)),
      includedItems: splitRichText(tour.included_text),
      excludedItems: splitRichText(tour.excluded_text),
      termsItems: splitRichText(tour.terms_text),
      noteItems: splitRichText(tour.important_notes),
      ratingAverage: reviewSummary.averageRating,
      reviewCount: reviewSummary.totalReviews,
      ratingBreakdown: reviewSummary.ratingBreakdown,
      recommendedPercent: reviewSummary.recommendedPercent,
      replyCount: reviewSummary.replyCount,
      reviews,
      startingPrice,
      nextDeparture: nextSchedule?.departureDate || null,
      openScheduleCount,
      reservedSlotCount,
      availableSlotCount,
      popularityScore: reservedSlotCount * 10 + reviews.length * 3 + openScheduleCount + Number(Boolean(tour.is_featured))
    };
  });

  const destinations = Array.from(
    new Map(
      tours.flatMap((tour) =>
        (tour.destinations.length ? tour.destinations : []).map((location) => [location.id, location])
      )
    ).values()
  )
    .map((location) => {
      const locationTours = tours.filter((tour) => tour.destinations.some((item) => item.id === location.id));
      const prices = locationTours.map((tour) => tour.startingPrice).filter((value) => value > 0);
      return {
        location,
        tours: locationTours.slice(0, 4),
        totalTours: locationTours.length,
        startingPrice: prices.length ? Math.min(...prices) : 0,
        reviewCount: locationTours.reduce((sum, tour) => sum + tour.reviewCount, 0),
        openScheduleCount: locationTours.reduce((sum, tour) => sum + tour.openScheduleCount, 0),
        featuredImage:
          locationTours[0]?.coverImage ||
          location.image_url ||
          null,
        regionLabel: location.regionLabel,
        regionSlug: location.regionSlug,
        regionDescription: location.regionDescription,
        countryLabel: location.countryLabel
      };
    })
    .sort((left, right) => right.totalTours - left.totalTours || left.location.sort_order - right.location.sort_order);

  const destinationGroups = buildDestinationGroups(destinations);
  const latestReviews = tours
    .flatMap((tour) =>
      tour.reviews.map((review) => ({
        ...review,
        tourName: tour.name,
        tourSlug: tour.slug,
        tourDestinationLabel: tour.destinationLabel
      }))
    )
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const topReviewedTours = [...tours]
    .filter((tour) => tour.reviewCount > 0)
    .sort((left, right) => right.reviewCount - left.reviewCount || right.ratingAverage - left.ratingAverage || sortToursByPopular(left, right))
    .slice(0, 6);
  const reviewSummary = buildReviewSummary(latestReviews);

  const paymentMethods = raw.paymentMethods.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    methodType: item.method_type,
    providerName: item.provider_name,
    description: compactText(item.description, `${item.name} thanh toán`),
    settings: item.settings_jsonb || {}
  }));

  const coupons = raw.coupons.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: compactText(item.description, "Khuyến mãi ưu đãi"),
    discountType: item.discount_type,
    discountValue: toNumber(item.discount_value),
    minOrderAmount: toNumber(item.min_order_amount),
    maxDiscountAmount: item.max_discount_amount == null ? null : toNumber(item.max_discount_amount),
    usageLimit: item.usage_limit == null ? null : toNumber(item.usage_limit),
    usagePerUserLimit: item.usage_per_user_limit == null ? null : toNumber(item.usage_per_user_limit),
    usedCount: toNumber(item.used_count),
    isActive: Boolean(item.is_active),
    startAt: item.start_at,
    endAt: item.end_at,
    tourIds: couponTourMap.get(item.id) || [],
    categoryIds: couponCategoryMap.get(item.id) || []
  }));

  const cmsPages = raw.cmsPages.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    content: compactText(item.content),
    metaTitle: item.meta_title || item.title,
    metaDescription: item.meta_description || compactText(item.content),
    isPublished: Boolean(item.is_published),
    publishedAt: item.published_at,
    createdBy: item.created_by,
    updatedBy: item.updated_by,
    updatedAt: item.updated_at
  }));

  return {
    tours,
    destinations,
    destinationGroups,
    featuredTours: [...tours].sort(sortToursByPopular).slice(0, 6),
    latestReviews,
    topReviewedTours,
    reviewSummary,
    paymentMethods,
    coupons,
    cmsPages,
    banners: raw.banners,
    categories: raw.categories
  };
}

function isCouponAvailableForTour(coupon, tour) {
  if (!coupon || !tour) return false;
  const matchesTour = !coupon.tourIds?.length || coupon.tourIds.includes(tour.id);
  const categoryIds = (tour.categories || []).map((category) => category.id);
  const matchesCategory = !coupon.categoryIds?.length || coupon.categoryIds.some((id) => categoryIds.includes(id));
  return matchesTour && matchesCategory;
}

async function getSiteCatalog({ force = false } = {}) {
  if (!force && catalogCache.data && catalogCache.expiresAt > Date.now()) return catalogCache.data;

  const [
    tours,
    images,
    destinations,
    locations,
    categories,
    tourCategories,
    schedules,
    scheduleAvailability,
    priceTiers,
    itinerary,
    reviews,
    reviewReplies,
    profiles,
    cancellationPolicies,
    banners,
    cmsPages,
    paymentMethods,
    coupons,
    couponTours,
    couponCategories
  ] = await Promise.all([
    safeSelect("tours", { select: "*", status: "eq.published", order: "published_at.desc" }),
    safeSelect("tour_images", { select: "*", order: "sort_order.asc" }),
    safeSelect("tour_destinations", { select: "*", order: "sort_order.asc" }),
    safeSelect("locations", { select: "*", is_active: "eq.true", order: "sort_order.asc" }),
    safeSelect("categories", { select: "id,name,slug", is_active: "eq.true", order: "name.asc" }),
    safeSelect("tour_categories", { select: "tour_id,category_id" }),
    safeSelect("departure_schedules", { select: "*", order: "departure_date.asc" }),
    safeSelect("schedule_availability", { select: "schedule_id,tour_id,departure_date,return_date,capacity,reserved_slots,available_slots" }),
    safeSelect("schedule_price_tiers", { select: "*" }),
    safeSelect("tour_itinerary_days", { select: "*", order: "day_number.asc" }),
    safeSelect("reviews", { select: "*", status: "eq.approved", order: "created_at.desc" }),
    safeSelect("review_replies", { select: "*" }),
    safeSelect("profiles", { select: "id,full_name,avatar_url,email,customer_level" }),
    safeSelect("cancellation_policies", { select: "*", is_active: "eq.true", order: "name.asc" }),
    safeSelect("banners", { select: "*", order: "sort_order.asc" }),
    safeSelect("cms_pages", { select: "*", order: "updated_at.desc" }),
    safeSelect("payment_methods", { select: "*", is_active: "eq.true", order: "name.asc" }),
    safeSelect("coupons", { select: "*", is_active: "eq.true", order: "created_at.desc" }),
    safeSelect("coupon_tours", { select: "coupon_id,tour_id" }),
    safeSelect("coupon_categories", { select: "coupon_id,category_id" })
  ]);

  catalogCache = {
    data: buildCatalog({
      tours,
      images,
      destinations,
      locations,
      categories,
      tourCategories,
      schedules,
      scheduleAvailability,
      priceTiers,
      itinerary,
      reviews,
      reviewReplies,
      profiles,
      cancellationPolicies,
      banners,
      cmsPages,
      paymentMethods,
      coupons,
      couponTours,
      couponCategories
    }),
    expiresAt: Date.now() + CATALOG_TTL
  };

  return catalogCache.data;
}

function buildCmsExcerpt(content) {
  return String(content || "")
    .split(/\n{2,}|(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

export async function getHomepageData() {
  const catalog = await getSiteCatalog();
  const liveBanners = catalog.banners.filter((banner) => Boolean(banner.is_active) && isWithinWindow(banner.start_at, banner.end_at));
  const liveCoupons = catalog.coupons.filter((coupon) => isWithinWindow(coupon.startAt, coupon.endAt));
  const cmsSpotlight = catalog.cmsPages.find((page) => page.isPublished) || null;
  return {
    heroBanner: liveBanners[0] || null,
    secondaryBanners: liveBanners.slice(1, 4),
    featuredTours: [...catalog.featuredTours].sort(sortToursByPopular),
    destinations: catalog.destinations.slice(0, 6),
    destinationGroups: catalog.destinationGroups,
    reviews: catalog.latestReviews.slice(0, 6),
    coupons: liveCoupons.slice(0, 3),
    cmsSpotlight: cmsSpotlight
      ? {
          ...cmsSpotlight,
          excerpt: buildCmsExcerpt(cmsSpotlight.content)
        }
      : null,
    searchFacets: {
      destinations: catalog.destinations.map((destination) => ({
        slug: destination.location.slug,
        name: destination.location.name,
        regionLabel: destination.regionLabel,
        totalTours: destination.totalTours
      })),
      categories: catalog.categories
    },
    stats: {
      publishedTours: catalog.tours.length,
      activeDepartures: catalog.tours.reduce((sum, tour) => sum + tour.openScheduleCount, 0),
      destinations: catalog.destinations.length,
      approvedReviews: catalog.latestReviews.length
    }
  };
}

export async function getToursPageData(filters = {}) {
  const catalog = await getSiteCatalog();
  const query = normalizeSearch(filters.query);
  const targetDate = filters.date ? new Date(filters.date) : null;
  const travelers = Math.max(0, toNumber(filters.travelers, 0));
  const priceMin = Math.max(0, toNumber(filters.priceMin, 0));
  const priceMax = Math.max(0, toNumber(filters.priceMax, 0));
  const ratingMin = Math.max(0, Math.min(5, toNumber(filters.ratingMin, 0)));

  const tours = catalog.tours
    .filter((tour) => {
      const matchQuery = !query || [
        tour.name,
        tour.shortDescription,
        tour.destinationLabel,
        tour.regionLabel,
        tour.description,
        ...tour.categories.map((category) => category.name),
        ...tour.destinations.map((destination) => destination.name)
      ].some((value) => normalizeSearch(value).includes(query));
      const matchCategory = !filters.category || tour.categories.some((category) => category.slug === filters.category);
      const matchDestination = !filters.destination || tour.destinations.some((destination) => destination.slug === filters.destination);
      const matchDuration = !filters.duration || (
        filters.duration === "1-3" ? tour.durationDays <= 3 :
        filters.duration === "4-7" ? tour.durationDays >= 4 && tour.durationDays <= 7 :
        filters.duration === "8-14" ? tour.durationDays >= 8 && tour.durationDays <= 14 :
        tour.durationDays > 14
      );
      const matchDate = !targetDate || tour.schedules.some((schedule) => new Date(schedule.departureDate).getTime() >= targetDate.getTime());
      const matchTravelers = !travelers || tour.schedules.some((schedule) => schedule.isBookable && toNumber(schedule.availableSlots) >= travelers);
      const matchPriceMin = !priceMin || (tour.startingPrice > 0 && tour.startingPrice >= priceMin);
      const matchPriceMax = !priceMax || !tour.startingPrice || tour.startingPrice <= priceMax;
      const matchRating = !ratingMin || tour.ratingAverage >= ratingMin;
      return matchQuery && matchCategory && matchDestination && matchDuration && matchDate && matchTravelers && matchPriceMin && matchPriceMax && matchRating;
    })
    .sort((left, right) => {
      switch (filters.sort) {
        case "newest":
          return String(right.publishedAt || "").localeCompare(String(left.publishedAt || ""));
        case "rating":
          return right.ratingAverage - left.ratingAverage || right.reviewCount - left.reviewCount;
        case "price-asc":
          return left.startingPrice - right.startingPrice;
        case "price-desc":
          return right.startingPrice - left.startingPrice;
        case "popular":
        case "featured":
        default:
          return sortToursByPopular(left, right);
      }
    });

  const pricedTours = catalog.tours.map((tour) => tour.startingPrice).filter((value) => value > 0);
  return {
    tours,
    categories: catalog.categories,
    destinations: catalog.destinations,
    matchingCount: tours.length,
    totalCount: catalog.tours.length,
    priceBounds: {
      min: pricedTours.length ? Math.min(...pricedTours) : 0,
      max: pricedTours.length ? Math.max(...pricedTours) : 0
    }
  };
}

export async function getDestinationsData() {
  const catalog = await getSiteCatalog();
  return {
    groups: catalog.destinationGroups,
    totalDestinations: catalog.destinations.length,
    totalTours: catalog.destinations.reduce((sum, destination) => sum + destination.totalTours, 0),
    totalOpenSchedules: catalog.destinations.reduce((sum, destination) => sum + destination.openScheduleCount, 0)
  };
}

export async function getReviewsPageData() {
  const catalog = await getSiteCatalog();
  const reviews = [...catalog.latestReviews].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  return {
    reviews,
    averageRating: catalog.reviewSummary.averageRating,
    totalReviews: catalog.reviewSummary.totalReviews,
    ratingBreakdown: catalog.reviewSummary.ratingBreakdown,
    recommendedPercent: catalog.reviewSummary.recommendedPercent,
    replyCount: catalog.reviewSummary.replyCount,
    toursWithReviews: catalog.tours.filter((tour) => tour.reviewCount > 0).length,
    topReviewedTours: catalog.topReviewedTours
  };
}

function buildRelatedTours(baseTour, catalog) {
  const destinationIds = new Set((baseTour.destinations || []).map((item) => item.id));
  const categoryIds = new Set((baseTour.categories || []).map((item) => item.id));
  const scoredTours = catalog.tours
    .filter((tour) => tour.id !== baseTour.id)
    .map((tour) => {
      const sharedDestinationCount = (tour.destinations || []).filter((item) => destinationIds.has(item.id)).length;
      const sharedCategoryCount = (tour.categories || []).filter((item) => categoryIds.has(item.id)).length;
      const regionMatch = tour.regionLabel && tour.regionLabel === baseTour.regionLabel ? 1 : 0;
      const score = sharedDestinationCount * 5 + sharedCategoryCount * 3 + regionMatch;
      return { tour, score };
    })
    .sort((left, right) => right.score - left.score || sortToursByPopular(left.tour, right.tour));

  const strongMatches = scoredTours.filter((item) => item.score > 0).slice(0, 3).map((item) => item.tour);
  if (strongMatches.length) return strongMatches;
  return catalog.featuredTours.filter((tour) => tour.id !== baseTour.id).slice(0, 3);
}

export async function getTourBySlug(slug) {
  const catalog = await getSiteCatalog();
  const tour = catalog.tours.find((item) => item.slug === slug) || null;
  if (!tour) return null;
  const reviews = [...tour.reviews];
  const relatedTours = buildRelatedTours(tour, catalog);
  const reviewSummary = buildReviewSummary(reviews);
  return {
    ...tour,
    reviews,
    relatedTours,
    reviewCount: reviewSummary.totalReviews,
    ratingAverage: reviewSummary.averageRating || tour.ratingAverage,
    ratingBreakdown: reviewSummary.ratingBreakdown,
    recommendedPercent: reviewSummary.recommendedPercent,
    replyCount: reviewSummary.replyCount
  };
}

export async function getCmsPageBySlug(slug) {
  return (await getSiteCatalog()).cmsPages.find((item) => item.slug === slug && item.isPublished) || null;
}

export async function listCmsPages() {
  return (await getSiteCatalog()).cmsPages.filter((item) => item.isPublished);
}

function mergeCouponUsageStats(coupons, usageRows = [], userId = null) {
  const totalUsageMap = usageRows.reduce((map, row) => {
    if (!row?.coupon_id) return map;
    map.set(row.coupon_id, (map.get(row.coupon_id) || 0) + 1);
    return map;
  }, new Map());
  const userUsageMap = usageRows.reduce((map, row) => {
    if (!userId || !row?.coupon_id || row.user_id !== userId) return map;
    map.set(row.coupon_id, (map.get(row.coupon_id) || 0) + 1);
    return map;
  }, new Map());

  return coupons.map((coupon) => ({
    ...coupon,
    usedCount: totalUsageMap.get(coupon.id) || 0,
    userUsedCount: userId ? userUsageMap.get(coupon.id) || 0 : 0
  }));
}

export async function getBookingReferenceData(slug, { force = false } = {}) {
  const catalog = await getSiteCatalog({ force });
  const auth = await getAuthContext();
  const tour = catalog.tours.find((item) => item.slug === slug) || null;
  const coupons = tour ? catalog.coupons.filter((coupon) => isCouponAvailableForTour(coupon, tour)) : [];
  const couponIds = coupons.map((coupon) => coupon.id).filter(Boolean);
  const couponUsages = couponIds.length
    ? await safeSelect("coupon_usages", {
        select: "coupon_id,user_id",
        coupon_id: buildInFilter(couponIds)
      })
    : [];

  return {
    tour,
    paymentMethods: catalog.paymentMethods,
    coupons: mergeCouponUsageStats(coupons, couponUsages, auth.user?.id || null)
  };
}

export function getCouponPreviewForTour(coupons, tour, counts, scheduleId) {
  const schedule = tour?.schedules.find((item) => item.id === scheduleId) || tour?.schedules[0] || null;
  if (!tour || !schedule) return [];
  const subtotal = computeSubtotal(counts, schedule.prices);
  return coupons
    .filter((coupon) => isCouponAvailableForTour(coupon, tour))
    .map((coupon) => ({
      coupon,
      discountAmount: computeCouponDiscount(subtotal, coupon)
    }))
    .filter((item) => item.discountAmount > 0 || isCouponEligible(item.coupon, subtotal));
}

export {
  buildDestinationGroups,
  getSiteCatalog,
  isCouponAvailableForTour,
  isWithinWindow
};





