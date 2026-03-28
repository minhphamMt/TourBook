import { isManagementRoute, isRoute, normalizeInternalHref, routePath } from "./routes.js";

const SUPABASE_URL = "https://axcjsngarcpffovehqwp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FSJTz6qG4FgtdVrdEbAh7Q_ORWJcJa4";
const STORAGE_PREFIX = "tourbook.static";
const SESSION_KEY = `${STORAGE_PREFIX}.session`;
const PROFILE_KEY = `${STORAGE_PREFIX}.profiles`;
const BOOKING_KEY = `${STORAGE_PREFIX}.bookings`;
const CATALOG_TTL = 30000;
const MANAGEMENT_ROLES = ["staff", "admin", "super_admin"];

let catalogCache = { data: null, expiresAt: 0 };

function inferRolesFromIdentity(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("super_admin") || normalized.includes("superadmin")) return ["super_admin"];
  if (normalized.includes("admin")) return ["admin"];
  if (normalized.includes("staff")) return ["staff"];
  return ["customer"];
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, item));
      return;
    }
    search.append(key, value);
  });
  return search.toString();
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function compactText(value, fallback = "Ðang c?p nh?t") {
  return String(value || "").trim() || fallback;
}

function splitRichText(value) {
  return String(value || "")
    .split(/\n|,|\.|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase();
}

function formatCurrency(value, currency = "VND") {
  if (value == null || Number.isNaN(Number(value))) return "Liên h?";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
}

function formatShortDate(value) {
  if (!value) return "Chua có l?ch";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatLongDate(value) {
  if (!value) return "Chua c?p nh?t";
  return new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Chua c?p nh?t";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDuration(days, nights) {
  return `${days} ngày ${nights} dêm`;
}

function statusLabel(status) {
  const map = {
    pending: "T?m gi? ch?",
    awaiting_payment: "Ch? thanh toán",
    confirmed: "Ðã xác nh?n",
    completed: "Ðã hoàn thành",
    cancel_requested: "Ch? h?y",
    cancelled: "Ðã h?y",
    unpaid: "Chua thanh toán",
    partially_paid: "Ðã c?c",
    paid: "Ðã thanh toán",
    failed: "Th?t b?i",
    refunded: "Ðã hoàn ti?n",
    partially_refunded: "Hoàn ti?n m?t ph?n",
    open: "Ðang m?",
    sold_out: "H?t ch?",
    closed: "Ðã dóng",
    hidden: "Ðã ?n",
    approved: "Ðã duy?t",
    in_progress: "Ðang x? lý",
    resolved: "Ðã x? lý"
  };
  return map[status] || String(status || "");
}

function normalizeRoles(roles = []) {
  const priority = ["super_admin", "admin", "staff", "customer"];
  return unique(roles.map((role) => String(role || "").toLowerCase())).sort((left, right) => priority.indexOf(left) - priority.indexOf(right));
}

function getPrimaryRole(roles = []) {
  return normalizeRoles(roles)[0] || "customer";
}

function hasManagementRole(roles = []) {
  return normalizeRoles(roles).some((role) => MANAGEMENT_ROLES.includes(role));
}

function resolvePostLoginPath(roles = [], redirectTo) {
  if (hasManagementRole(roles)) return routePath("admin");
  if (redirectTo && isManagementRoute(redirectTo)) return routePath("account");
  return normalizeInternalHref(redirectTo) || routePath("account");
}

function getEffectivePrice(price) {
  return price?.salePrice ?? price?.price ?? 0;
}

function computeSubtotal(counts, prices) {
  const map = new Map(prices.map((price) => [price.travelerType, getEffectivePrice(price)]));
  return (toNumber(counts?.adults) * (map.get("adult") || 0)) + (toNumber(counts?.children) * (map.get("child") || 0)) + (toNumber(counts?.infants) * (map.get("infant") || 0));
}

function computeCouponDiscount(subtotal, coupon) {
  if (!coupon?.isActive) return 0;
  const raw = coupon.discountType === "percentage" ? subtotal * (toNumber(coupon.discountValue) / 100) : toNumber(coupon.discountValue);
  return Math.max(0, Math.round(coupon.maxDiscountAmount == null ? raw : Math.min(raw, toNumber(coupon.maxDiscountAmount))));
}

function readStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readStoredSession() {
  return readStorage(SESSION_KEY, null);
}

function saveStoredSession(session) {
  writeStorage(SESSION_KEY, session);
}

function readProfiles() {
  return readStorage(PROFILE_KEY, {});
}

function saveProfiles(value) {
  writeStorage(PROFILE_KEY, value);
}

function readBookings() {
  return readStorage(BOOKING_KEY, []);
}

function saveBookings(value) {
  writeStorage(BOOKING_KEY, value);
}

function ensureProfile(user, overrides = {}) {
  if (!user?.id) return null;
  const profiles = readProfiles();
  const current = profiles[user.id] || {};
  const roles = current.roles || inferRolesFromIdentity(user.email || current.email || "");
  const next = {
    id: user.id,
    email: user.email || current.email || "",
    full_name: current.full_name || user.user_metadata?.full_name || "",
    phone: current.phone || "",
    avatar_url: current.avatar_url || "",
    address: current.address || "",
    customer_level: current.customer_level || "guest",
    status: current.status || "active",
    roles,
    wishlistTourIds: current.wishlistTourIds || [],
    ...overrides
  };
  profiles[user.id] = next;
  saveProfiles(profiles);
  return next;
}

async function parseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || data?.error_description || data?.error || `Yêu c?u th?t b?i (${response.status})`);
  }
  return data;
}

async function authRequest(path, { method = "GET", body, token } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${SUPABASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return parseResponse(response);
}

async function restSelect(table, query = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${Object.keys(query).length ? `?${buildQuery(query)}` : ""}`;
  const token = readStoredSession()?.access_token || SUPABASE_ANON_KEY;
  const response = await fetch(url, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  return parseResponse(response);
}

async function safeSelect(table, query = {}) {
  try {
    return await restSelect(table, query);
  } catch {
    return [];
  }
}

export async function signIn(email, password) {
  const payload = await authRequest("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  saveStoredSession(payload);
  ensureProfile(payload.user || { id: crypto.randomUUID(), email });
  return payload;
}

export async function signUp({ fullName, email, password }) {
  const payload = await authRequest("/auth/v1/signup", { method: "POST", body: { email, password, data: { full_name: fullName } } });
  if (payload?.user) ensureProfile(payload.user, { full_name: fullName || payload.user.user_metadata?.full_name || "" });
  if (payload?.access_token) saveStoredSession(payload);
  return payload;
}

export async function signOut() {
  const token = readStoredSession()?.access_token;
  try {
    if (token) await authRequest("/auth/v1/logout", { method: "POST", token });
  } catch {
    // noop
  }
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
}

export async function getCurrentUser() {
  const session = readStoredSession();
  if (!session?.user) return null;
  ensureProfile(session.user);
  return session.user;
}

async function resolveRolesForUser(user, fallbackRoles = []) {
  if (!user?.id) return normalizeRoles(fallbackRoles.length ? fallbackRoles : inferRolesFromIdentity(user?.email));
  const [roleRows, assignments] = await Promise.all([
    safeSelect("roles", { select: "id,name" }),
    safeSelect("user_roles", { select: "user_id,role_id", user_id: `eq.${user.id}` })
  ]);
  const roleMap = new Map(roleRows.map((item) => [item.id, String(item.name || "").toLowerCase()]));
  const resolvedRoles = assignments.map((item) => roleMap.get(item.role_id)).filter(Boolean);
  return normalizeRoles(resolvedRoles.length ? resolvedRoles : (fallbackRoles.length ? fallbackRoles : inferRolesFromIdentity(user.email)));
}

export async function getAuthContext() {
  const user = await getCurrentUser();
  if (!user) {
    return { session: null, user: null, profile: null, roles: [], primaryRole: "customer", isManagement: false };
  }
  const profile = ensureProfile(user);
  const roles = await resolveRolesForUser(user, normalizeRoles(profile.roles || inferRolesFromIdentity(user.email)));
  const nextProfile = JSON.stringify(normalizeRoles(profile.roles || [])) === JSON.stringify(roles) ? profile : ensureProfile(user, { roles });
  return { session: readStoredSession(), user, profile: nextProfile, roles, primaryRole: getPrimaryRole(roles), isManagement: hasManagementRole(roles) };
}
function stableViewerCount(seed) {
  let hash = 0;
  for (const char of String(seed || "")) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return 8 + (hash % 19);
}

function buildCatalog(raw) {
  const locationMap = new Map(raw.locations.map((item) => [item.id, item]));
  const categoryMap = new Map(raw.categories.map((item) => [item.id, item]));
  const replyMap = new Map(raw.reviewReplies.map((item) => [item.review_id, item]));
  const profileMap = new Map(raw.profiles.map((item) => [item.id, item]));
  const imageGroups = raw.images.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const destinationGroups = raw.destinations.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const categoryGroups = raw.tourCategories.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    const category = categoryMap.get(item.category_id);
    if (category) {
      list.push(category);
    }
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const scheduleGroups = raw.schedules.reduce((map, item) => {
    const list = map.get(item.tour_id) || [];
    list.push(item);
    map.set(item.tour_id, list);
    return map;
  }, new Map());
  const priceGroups = raw.priceTiers.reduce((map, item) => {
    const list = map.get(item.schedule_id) || [];
    list.push({ travelerType: item.traveler_type, price: toNumber(item.price), salePrice: item.sale_price == null ? null : toNumber(item.sale_price) });
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
      comment: compactText(review.comment, "Khách hàng không d? l?i n?i dung."),
      status: review.status,
      createdAt: review.created_at,
      authorName: author?.full_name || author?.email || "Khách dã d?t tour",
      reply: reply ? { id: reply.id, text: reply.reply_text, createdAt: reply.created_at, authorName: "TourBook" } : null
    });
    map.set(review.tour_id, list);
    return map;
  }, new Map());

  const tours = raw.tours.map((tour) => {
    const destinations = (destinationGroups.get(tour.id) || []).map((item) => locationMap.get(item.location_id)).filter(Boolean);
    const schedules = (scheduleGroups.get(tour.id) || []).map((item) => {
      const prices = priceGroups.get(item.id) || [];
      const basePrice = prices.length ? Math.min(...prices.map((price) => getEffectivePrice(price)).filter((value) => value > 0)) : 0;
      return {
        id: item.id,
        departureDate: item.departure_date,
        returnDate: item.return_date,
        meetingPoint: compactText(item.meeting_point, "C?p nh?t sau"),
        capacity: toNumber(item.capacity, 20),
        availableSlots: toNumber(item.capacity, 20),
        status: item.status || "open",
        currency: item.currency || tour.base_currency || "VND",
        prices,
        basePrice
      };
    }).sort((left, right) => String(left.departureDate).localeCompare(String(right.departureDate)));
    const reviews = reviewGroups.get(tour.id) || [];
    const startingPrice = schedules.length ? Math.min(...schedules.map((item) => item.basePrice).filter((value) => value > 0)) : 0;
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
      isFeatured: Boolean(tour.is_featured),
      destinations,
      destinationLabel: destinations[0]?.name || "Ðang c?p nh?t",
      categories: categoryGroups.get(tour.id) || [],
      coverImage: (imageGroups.get(tour.id) || []).find((item) => item.is_cover)?.image_url || (imageGroups.get(tour.id) || [])[0]?.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      gallery: imageGroups.get(tour.id) || [],
      schedules,
      itinerary: (itineraryGroups.get(tour.id) || []).sort((left, right) => toNumber(left.day_number) - toNumber(right.day_number)),
      includedItems: splitRichText(tour.included_text),
      excludedItems: splitRichText(tour.excluded_text),
      termsItems: splitRichText(tour.terms_text),
      noteItems: splitRichText(tour.important_notes),
      ratingAverage: Number(average(reviews.map((item) => item.rating)).toFixed(1)) || 0,
      reviewCount: reviews.length,
      reviews,
      startingPrice,
      nextDeparture: schedules[0]?.departureDate || null,
      viewerCount: stableViewerCount(tour.id)
    };
  });

  const destinations = Array.from(new Map(tours.flatMap((tour) => (tour.destinations.length ? tour.destinations : []).map((location) => [location.id, location]))).values()).map((location) => {
    const locationTours = tours.filter((tour) => tour.destinations.some((item) => item.id === location.id));
    return {
      location,
      tours: locationTours.slice(0, 4),
      totalTours: locationTours.length,
      featuredImage: locationTours[0]?.coverImage || location.image_url || "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80"
    };
  }).sort((left, right) => right.totalTours - left.totalTours);

  const latestReviews = tours.flatMap((tour) => tour.reviews.map((review) => ({ ...review, tourName: tour.name, tourSlug: tour.slug }))).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
  const paymentMethods = raw.paymentMethods.map((item) => ({ id: item.id, code: item.code, name: item.name, methodType: item.method_type, providerName: item.provider_name, description: compactText(item.description, `${item.name} thanh toán`) }));
  const coupons = raw.coupons.map((item) => ({ id: item.id, code: item.code, name: item.name, description: compactText(item.description, "Khuy?n m?i uu dãi"), discountType: item.discount_type, discountValue: toNumber(item.discount_value), minOrderAmount: toNumber(item.min_order_amount), maxDiscountAmount: item.max_discount_amount == null ? null : toNumber(item.max_discount_amount), isActive: Boolean(item.is_active), startAt: item.start_at, endAt: item.end_at }));
  const cmsPages = raw.cmsPages.map((item) => ({ id: item.id, slug: item.slug, title: item.title, content: compactText(item.content), metaTitle: item.meta_title || item.title, metaDescription: item.meta_description || compactText(item.content), isPublished: Boolean(item.is_published), publishedAt: item.published_at, createdBy: item.created_by, updatedBy: item.updated_by }));
  const banners = raw.banners;

  return {
    tours,
    destinations,
    featuredTours: tours.filter((tour) => tour.isFeatured).slice(0, 6).length ? tours.filter((tour) => tour.isFeatured).slice(0, 6) : tours.slice(0, 6),
    latestReviews,
    paymentMethods,
    coupons,
    cmsPages,
    banners,
    categories: raw.categories
  };
}

async function getSiteCatalog({ force = false } = {}) {
  if (!force && catalogCache.data && catalogCache.expiresAt > Date.now()) return catalogCache.data;
  const [tours, images, destinations, locations, categories, tourCategories, schedules, priceTiers, itinerary, reviews, reviewReplies, profiles, banners, cmsPages, paymentMethods, coupons] = await Promise.all([
    safeSelect("tours", { select: "*", status: "eq.published", order: "published_at.desc" }),
    safeSelect("tour_images", { select: "*", order: "sort_order.asc" }),
    safeSelect("tour_destinations", { select: "*", order: "sort_order.asc" }),
    safeSelect("locations", { select: "*", order: "sort_order.asc" }),
    safeSelect("categories", { select: "id,name,slug", order: "name.asc" }),
    safeSelect("tour_categories", { select: "tour_id,category_id" }),
    safeSelect("departure_schedules", { select: "*", order: "departure_date.asc" }),
    safeSelect("schedule_price_tiers", { select: "*" }),
    safeSelect("tour_itinerary_days", { select: "*", order: "day_number.asc" }),
    safeSelect("reviews", { select: "*", status: "eq.approved", order: "created_at.desc" }),
    safeSelect("review_replies", { select: "*" }),
    safeSelect("profiles", { select: "id,full_name,avatar_url,email,customer_level" }),
    safeSelect("banners", { select: "*", order: "sort_order.asc" }),
    safeSelect("cms_pages", { select: "*", order: "updated_at.desc" }),
    safeSelect("payment_methods", { select: "id,code,name,method_type,provider_name,description", is_active: "eq.true" }),
    safeSelect("coupons", { select: "*", is_active: "eq.true" })
  ]);
  catalogCache = { data: buildCatalog({ tours, images, destinations, locations, categories, tourCategories, schedules, priceTiers, itinerary, reviews, reviewReplies, profiles, banners, cmsPages, paymentMethods, coupons }), expiresAt: Date.now() + CATALOG_TTL };
  return catalogCache.data;
}

function getLocalApprovedReviews(catalog) {
  return readBookings().filter((booking) => booking.review?.status === "approved").map((booking) => {
    const tour = catalog.tours.find((item) => item.id === booking.tour_id);
    return { ...booking.review, tourId: booking.tour_id, tourName: tour?.name || booking.snapshot_jsonb?.tour_name || "Tour", tourSlug: tour?.slug || null };
  });
}

function hydrateBooking(booking, catalog) {
  return { ...booking, tour: catalog.tours.find((item) => item.id === booking.tour_id) || null, travelers: booking.travelers || [], lines: booking.lines || [], payments: booking.payments || [], events: booking.events || [], tickets: booking.tickets || [], review: booking.review || null };
}

export async function getHomepageData() {
  const catalog = await getSiteCatalog();
  return { heroBanner: catalog.banners[0] || null, secondaryBanners: catalog.banners.slice(1, 3), featuredTours: catalog.featuredTours, destinations: catalog.destinations.slice(0, 6), reviews: [...getLocalApprovedReviews(catalog), ...catalog.latestReviews].slice(0, 4), coupons: catalog.coupons.slice(0, 3) };
}

export async function getToursPageData(filters = {}) {
  const catalog = await getSiteCatalog();
  const query = normalizeSearch(filters.query);
  const tours = catalog.tours.filter((tour) => {
    const matchQuery = !query || [tour.name, tour.shortDescription, tour.destinationLabel, tour.description].some((value) => normalizeSearch(value).includes(query));
    const matchCategory = !filters.category || tour.categories.some((category) => category.slug === filters.category);
    const matchDestination = !filters.destination || tour.destinations.some((destination) => destination.slug === filters.destination);
    const matchDuration = !filters.duration || (filters.duration === "1-3" ? tour.durationDays <= 3 : filters.duration === "4-7" ? tour.durationDays >= 4 && tour.durationDays <= 7 : filters.duration === "8-14" ? tour.durationDays >= 8 && tour.durationDays <= 14 : tour.durationDays > 14);
    return matchQuery && matchCategory && matchDestination && matchDuration;
  }).sort((left, right) => (filters.sort === "price-asc" ? left.startingPrice - right.startingPrice : filters.sort === "price-desc" ? right.startingPrice - left.startingPrice : filters.sort === "rating" ? right.ratingAverage - left.ratingAverage : Number(right.isFeatured) - Number(left.isFeatured)));
  return { tours, categories: catalog.categories, destinations: catalog.destinations };
}

export async function getDestinationsData() {
  return (await getSiteCatalog()).destinations;
}

export async function getReviewsPageData() {
  const catalog = await getSiteCatalog();
  return [...getLocalApprovedReviews(catalog), ...catalog.latestReviews].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

export async function getTourBySlug(slug) {
  const catalog = await getSiteCatalog();
  const tour = catalog.tours.find((item) => item.slug === slug) || null;
  if (!tour) return null;
  const reviews = [...getLocalApprovedReviews(catalog).filter((item) => item.tourId === tour.id), ...tour.reviews];
  return { ...tour, reviews, reviewCount: reviews.length, ratingAverage: Number(average(reviews.map((item) => item.rating)).toFixed(1)) || tour.ratingAverage };
}

export async function getCmsPageBySlug(slug) {
  return (await getSiteCatalog()).cmsPages.find((item) => item.slug === slug) || null;
}

export async function toggleWishlist(tourId) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? luu wishlist.");
  const wishlist = new Set(auth.profile?.wishlistTourIds || []);
  wishlist.has(tourId) ? wishlist.delete(tourId) : wishlist.add(tourId);
  ensureProfile(auth.user, { wishlistTourIds: Array.from(wishlist) });
  return { active: wishlist.has(tourId) };
}
export async function getBookingReferenceData(slug) {
  const catalog = await getSiteCatalog();
  const tour = catalog.tours.find((item) => item.slug === slug) || null;
  return {
    tour,
    paymentMethods: catalog.paymentMethods.length ? catalog.paymentMethods : [{ id: "pm-demo", code: "bank_transfer", name: "Chuy?n kho?n", methodType: "bank_transfer", providerName: "TourBook", description: "Thanh toán demo" }],
    coupons: catalog.coupons
  };
}

export function getCouponPreviewForTour(coupons, tour, counts, scheduleId) {
  const schedule = tour?.schedules.find((item) => item.id === scheduleId) || tour?.schedules[0] || null;
  if (!tour || !schedule) return [];
  const subtotal = computeSubtotal(counts, schedule.prices);
  return coupons.map((coupon) => ({ coupon, discountAmount: computeCouponDiscount(subtotal, coupon) }));
}

export async function createBooking(payload) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? d?t tour.");
  const { tour, paymentMethods, coupons } = await getBookingReferenceData(payload.tourSlug || "");
  if (!tour) throw new Error("Không tìm th?y tour.");
  const schedule = tour.schedules.find((item) => item.id === payload.scheduleId) || tour.schedules[0];
  if (!schedule) throw new Error("Không tìm th?y l?ch kh?i hành.");
  const subtotal = computeSubtotal(payload.counts, schedule.prices);
  const couponPreview = payload.couponCode ? getCouponPreviewForTour(coupons, tour, payload.counts, schedule.id).find((item) => item.coupon.code.toLowerCase() === String(payload.couponCode).trim().toLowerCase()) : null;
  const discountAmount = couponPreview?.discountAmount || 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const priceMap = new Map(schedule.prices.map((price) => [price.travelerType, getEffectivePrice(price)]));
  const paymentMethod = paymentMethods.find((item) => item.code === payload.paymentMethodCode) || paymentMethods[0];
  const now = new Date().toISOString();
  const code = `TB${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
  const booking = {
    id: crypto.randomUUID(),
    booking_code: code,
    user_id: auth.user.id,
    tour_id: tour.id,
    schedule_id: schedule.id,
    booking_status: paymentMethod?.methodType === "cash" ? "confirmed" : "awaiting_payment",
    payment_status: paymentMethod?.methodType === "cash" ? "unpaid" : "pending",
    total_amount: totalAmount,
    currency: schedule.currency,
    contact_name: payload.contact.fullName,
    contact_email: payload.contact.email,
    contact_phone: payload.contact.phone,
    customer_note: payload.customerNote || null,
    created_at: now,
    updated_at: now,
    snapshot_jsonb: { tour_name: tour.name, destination_label: tour.destinationLabel, departure_date: schedule.departureDate, selected_payment_method: paymentMethod?.name || "Demo" },
    travelers: (payload.travelers || []).map((traveler) => ({ id: crypto.randomUUID(), full_name: traveler.fullName, traveler_type: traveler.travelerType, nationality: traveler.nationality || null, phone: traveler.phone || null, email: traveler.email || null, price_amount: priceMap.get(traveler.travelerType) || 0 })),
    lines: [
      ...(toNumber(payload.counts?.adults) ? [{ id: crypto.randomUUID(), label: "Ngu?i l?n", quantity: toNumber(payload.counts.adults), total_amount: toNumber(payload.counts.adults) * (priceMap.get("adult") || 0) }] : []),
      ...(toNumber(payload.counts?.children) ? [{ id: crypto.randomUUID(), label: "Tr? em", quantity: toNumber(payload.counts.children), total_amount: toNumber(payload.counts.children) * (priceMap.get("child") || 0) }] : []),
      ...(toNumber(payload.counts?.infants) ? [{ id: crypto.randomUUID(), label: "Em bé", quantity: toNumber(payload.counts.infants), total_amount: toNumber(payload.counts.infants) * (priceMap.get("infant") || 0) }] : []),
      ...(discountAmount ? [{ id: crypto.randomUUID(), label: `Gi?m giá ${couponPreview.coupon.code}`, quantity: 1, total_amount: -discountAmount }] : [])
    ],
    payments: [{ id: crypto.randomUUID(), status: paymentMethod?.methodType === "cash" ? "unpaid" : "pending", amount: totalAmount, currency: schedule.currency, provider_name: paymentMethod?.providerName || paymentMethod?.name || "Demo", created_at: now }],
    events: [{ id: crypto.randomUUID(), event_type: "booking_created", note: "T?o booking t? giao di?n static.", created_at: now }],
    tickets: [],
    review: null
  };
  const bookings = readBookings();
  bookings.unshift(booking);
  saveBookings(bookings);
  ensureProfile(auth.user, { full_name: auth.profile?.full_name || payload.contact.fullName, phone: auth.profile?.phone || payload.contact.phone });
  return booking;
}

export async function getBookingByCode(code) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? xem booking.");
  const booking = readBookings().find((item) => item.booking_code === code);
  if (!booking) throw new Error("Không tìm th?y booking.");
  if (!auth.isManagement && booking.user_id !== auth.user.id) throw new Error("B?n không có quy?n xem booking này.");
  return hydrateBooking(booking, await getSiteCatalog());
}

export async function payBooking(code) {
  const booking = readBookings().find((item) => item.booking_code === code);
  if (!booking) throw new Error("Không tìm th?y booking.");
  booking.booking_status = "confirmed";
  booking.payment_status = "paid";
  booking.updated_at = new Date().toISOString();
  if (booking.payments[0]) booking.payments[0].status = "paid";
  booking.events.unshift({ id: crypto.randomUUID(), event_type: "payment_paid", note: "Ðánh d?u booking dã thanh toán.", created_at: booking.updated_at });
  saveBookings(readBookings().map((item) => item.id === booking.id ? booking : item));
  return booking;
}

export async function cancelBooking(code, reason) {
  const booking = readBookings().find((item) => item.booking_code === code);
  if (!booking) throw new Error("Không tìm th?y booking.");
  booking.booking_status = ["paid", "partially_paid"].includes(booking.payment_status) ? "cancel_requested" : "cancelled";
  booking.updated_at = new Date().toISOString();
  booking.events.unshift({ id: crypto.randomUUID(), event_type: booking.booking_status === "cancel_requested" ? "cancellation_requested" : "booking_cancelled", note: compactText(reason, "Khách hàng ch? d?ng h?y."), created_at: booking.updated_at });
  saveBookings(readBookings().map((item) => item.id === booking.id ? booking : item));
  return booking;
}

export async function createSupportTicket({ bookingId, subject, message }) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? t?o ticket.");
  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === bookingId);
  if (!booking) throw new Error("Không tìm th?y booking.");
  const now = new Date().toISOString();
  const ticket = { id: crypto.randomUUID(), ticket_code: `TK${Date.now().toString().slice(-6)}`, subject: subject || `H? tr? booking ${booking.booking_code}`, status: "open", created_at: now, messages: [{ id: crypto.randomUUID(), sender_type: "customer", message: message || "Khách hàng t?o ticket m?i.", created_at: now }] };
  booking.tickets.unshift(ticket);
  booking.updated_at = now;
  saveBookings(bookings);
  return ticket;
}

export async function replySupportTicket({ ticketId, message }) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? ph?n h?i ticket.");
  const bookings = readBookings();
  const now = new Date().toISOString();
  for (const booking of bookings) {
    const ticket = (booking.tickets || []).find((item) => item.id === ticketId);
    if (!ticket) continue;
    ticket.messages.push({ id: crypto.randomUUID(), sender_type: auth.isManagement ? "staff" : "customer", message: message || "Ph?n h?i ticket", created_at: now });
    ticket.status = auth.isManagement ? ticket.status : ticket.status === "resolved" ? "open" : ticket.status;
    booking.updated_at = now;
    saveBookings(bookings);
    return ticket;
  }
  throw new Error("Không tìm th?y ticket.");
}

export async function submitReview({ bookingId, rating, comment }) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? dánh giá.");
  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === bookingId);
  if (!booking) throw new Error("Không tìm th?y booking.");
  booking.review = { id: booking.review?.id || crypto.randomUUID(), rating: toNumber(rating, 5), comment: compactText(comment), status: "pending", createdAt: booking.review?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), authorName: auth.profile?.full_name || auth.user.email || "Khách TourBook", reply: booking.review?.reply || null };
  saveBookings(bookings);
  return booking.review;
}

export async function getAccountDashboard() {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? xem tài kho?n.");
  const catalog = await getSiteCatalog();
  const bookings = readBookings().filter((item) => item.user_id === auth.user.id).map((item) => hydrateBooking(item, catalog));
  const wishlistIds = auth.profile?.wishlistTourIds || [];
  const notifications = bookings.flatMap((booking) => (booking.events || []).map((event) => ({ id: event.id, title: statusLabel(event.event_type), content: event.note || booking.booking_code, created_at: event.created_at })));
  return { user: auth.user, profile: auth.profile, roles: auth.roles, primaryRole: auth.primaryRole, bookings, wishlistTours: catalog.tours.filter((tour) => wishlistIds.includes(tour.id)), notifications, tickets: bookings.flatMap((booking) => booking.tickets || []), savedTravelers: bookings.flatMap((booking) => booking.travelers || []) };
}

export async function updateProfile(payload) {
  const auth = await getAuthContext();
  if (!auth.user) throw new Error("B?n c?n dang nh?p d? c?p nh?t h? so.");
  return ensureProfile(auth.user, { full_name: payload.fullName || auth.profile?.full_name || "", phone: payload.phone || auth.profile?.phone || "", avatar_url: payload.avatarUrl || auth.profile?.avatar_url || "", address: payload.address || auth.profile?.address || "" });
}

export async function getAdminDashboard() {
  const auth = await getAuthContext();
  if (!auth.isManagement) throw new Error("You do not have access to the management area.");
  const catalog = await getSiteCatalog();
  const profileStore = readProfiles();
  const localProfiles = Object.values(profileStore).map((profile) => {
    const roles = normalizeRoles(profile.roles || ["customer"]);
    return { ...profile, roles, primaryRole: getPrimaryRole(roles) };
  });
  const tours = catalog.tours;
  const schedules = tours.flatMap((tour) =>
    (tour.schedules || []).map((schedule) => ({
      ...schedule,
      tourId: tour.id,
      tourName: tour.name,
      destinationLabel: tour.destinationLabel,
      coverImage: tour.coverImage
    }))
  );

  function buildLocalDashboard() {
    const bookings = readBookings().map((item) => hydrateBooking(item, catalog));
    return {
      sourceMode: "local",
      bookings,
      payments: bookings.flatMap((booking) => (booking.payments || []).map((payment) => ({ ...payment, booking }))),
      refunds: [],
      invoices: [],
      reviews: bookings
        .filter((booking) => booking.review)
        .map((booking) => ({
          ...booking.review,
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          contactName: booking.contact_name || booking.review.authorName,
          tour: booking.tour,
          authorName: booking.review.authorName
        })),
      tickets: bookings.flatMap((booking) =>
        (booking.tickets || []).map((ticket) => ({
          ...ticket,
          bookingId: booking.id,
          bookingCode: booking.booking_code,
          bookingStatus: booking.booking_status,
          customerName: booking.contact_name || profileStore[booking.user_id]?.full_name || "Customer",
          profile: profileStore[booking.user_id] || null,
          tour: booking.tour
        }))
      ),
      activityLogs: bookings.flatMap((booking) =>
        (booking.events || []).map((event) => ({
          id: event.id,
          action: event.event_type,
          entity_type: "booking",
          entity_id: booking.id,
          actor: profileStore[booking.user_id] || null,
          created_at: event.created_at
        }))
      ),
      tours,
      schedules,
      coupons: catalog.coupons.map((coupon) => ({ ...coupon, usageCount: 0, totalDiscount: 0 })),
      couponUsages: [],
      banners: catalog.banners,
      cmsPages: catalog.cmsPages,
      paymentMethods: catalog.paymentMethods,
      systemSettings: [],
      profiles: localProfiles
    };
  }

  const [
    dbProfiles,
    dbRoles,
    dbUserRoles,
    dbBookings,
    dbPayments,
    dbRefunds,
    dbInvoices,
    dbReviews,
    dbReviewReplies,
    dbTickets,
    dbTicketMessages,
    dbCouponUsages,
    dbBookingEvents,
    dbActivityLogs,
    dbSystemSettings,
    dbCoupons,
    dbBanners,
    dbCmsPages,
    dbPaymentMethods
  ] = await Promise.all([
    safeSelect("profiles", { select: "id,full_name,email,avatar_url,phone,status,customer_level,created_at,updated_at" }),
    safeSelect("roles", { select: "id,name" }),
    safeSelect("user_roles", { select: "user_id,role_id" }),
    safeSelect("bookings", { select: "id,booking_code,user_id,tour_id,schedule_id,contact_name,contact_phone,contact_email,customer_note,total_amount,currency,booking_status,payment_status,snapshot_jsonb,created_at,updated_at", order: "created_at.desc" }),
    safeSelect("payments", { select: "id,booking_id,payment_method_id,provider_name,provider_order_id,provider_payment_id,transaction_code,amount,currency,status,requested_at,paid_at,failed_at,failure_reason,created_at,updated_at", order: "created_at.desc" }),
    safeSelect("refunds", { select: "id,payment_id,amount,reason,status,requested_by,approved_by,refunded_at,created_at,updated_at", order: "created_at.desc" }),
    safeSelect("invoices", { select: "id,booking_id,invoice_number,company_name,tax_code,billing_email,billing_address,issued_at,status,created_at,updated_at", order: "created_at.desc" }),
    safeSelect("reviews", { select: "id,tour_id,booking_id,user_id,rating,comment,status,created_at,updated_at", order: "created_at.desc" }),
    safeSelect("review_replies", { select: "id,review_id,replied_by,reply_text,created_at,updated_at" }),
    safeSelect("support_tickets", { select: "id,ticket_code,user_id,booking_id,subject,status,priority,assigned_to,created_at,updated_at,closed_at", order: "created_at.desc" }),
    safeSelect("support_ticket_messages", { select: "id,ticket_id,sender_id,sender_type,message,attachments_jsonb,created_at", order: "created_at.asc" }),
    safeSelect("coupon_usages", { select: "id,coupon_id,booking_id,user_id,discount_amount,created_at", order: "created_at.desc" }),
    safeSelect("booking_events", { select: "id,booking_id,actor_id,event_type,note,event_data,created_at", order: "created_at.desc" }),
    safeSelect("activity_logs", { select: "id,actor_id,action,entity_type,entity_id,old_data,new_data,ip_address,created_at", order: "created_at.desc" }),
    safeSelect("system_settings", { select: "id,setting_key,setting_value,description,updated_by,created_at,updated_at", order: "setting_key.asc" }),
    safeSelect("coupons", { select: "*" }),
    safeSelect("banners", { select: "*", order: "sort_order.asc" }),
    safeSelect("cms_pages", { select: "*", order: "updated_at.desc" }),
    safeSelect("payment_methods", { select: "id,code,name,method_type,provider_name,description,is_active" })
  ]);

  const hasDatabaseData = [
    dbProfiles,
    dbBookings,
    dbPayments,
    dbTickets,
    dbReviews,
    dbActivityLogs,
    dbSystemSettings,
    dbCoupons
  ].some((items) => Array.isArray(items) && items.length);

  if (!hasDatabaseData) return buildLocalDashboard();

  const roleNameMap = new Map(dbRoles.map((role) => [role.id, String(role.name || "").toLowerCase()]));
  const rolesByUser = dbUserRoles.reduce((map, assignment) => {
    const roleName = roleNameMap.get(assignment.role_id);
    if (!roleName) return map;
    const list = map.get(assignment.user_id) || [];
    list.push(roleName);
    map.set(assignment.user_id, list);
    return map;
  }, new Map());

  const mergedProfiles = new Map();
  dbProfiles.forEach((profile) => mergedProfiles.set(profile.id, profile));
  localProfiles.forEach((profile) => {
    if (!mergedProfiles.has(profile.id)) mergedProfiles.set(profile.id, profile);
  });

  const profiles = Array.from(mergedProfiles.values()).map((profile) => {
    const fallbackRoles = profile.roles || profileStore[profile.id]?.roles || inferRolesFromIdentity(profile.email || "");
    const roles = normalizeRoles(rolesByUser.get(profile.id) || fallbackRoles);
    return { ...profile, roles, primaryRole: getPrimaryRole(roles) };
  });
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  const bookings = dbBookings.map((booking) => ({
    ...booking,
    tour: catalog.tours.find((tour) => tour.id === booking.tour_id) || null
  }));
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));

  const paymentMethods = (dbPaymentMethods.length ? dbPaymentMethods : catalog.paymentMethods).map((method) => ({
    ...method,
    methodType: method.methodType || method.method_type,
    providerName: method.providerName || method.provider_name,
    isActive: Boolean(method.isActive ?? method.is_active ?? true)
  }));
  const paymentMethodMap = new Map(paymentMethods.map((method) => [method.id, method]));

  const payments = dbPayments.map((payment) => ({
    ...payment,
    booking: bookingMap.get(payment.booking_id) || null,
    paymentMethod: paymentMethodMap.get(payment.payment_method_id) || null
  }));
  const paymentMap = new Map(payments.map((payment) => [payment.id, payment]));

  const refunds = dbRefunds.map((refund) => ({
    ...refund,
    payment: paymentMap.get(refund.payment_id) || null,
    requestedBy: profileMap.get(refund.requested_by) || null,
    approvedBy: profileMap.get(refund.approved_by) || null
  }));

  const invoices = dbInvoices.map((invoice) => ({
    ...invoice,
    booking: bookingMap.get(invoice.booking_id) || null
  }));

  const replyMap = new Map(dbReviewReplies.map((reply) => [reply.review_id, reply]));
  const reviews = dbReviews.map((review) => {
    const reply = replyMap.get(review.id);
    const booking = bookingMap.get(review.booking_id) || null;
    const author = profileMap.get(review.user_id) || null;
    return {
      ...review,
      bookingId: review.booking_id,
      bookingCode: booking?.booking_code || "",
      contactName: booking?.contact_name || author?.full_name || "",
      tour: catalog.tours.find((tour) => tour.id === review.tour_id) || booking?.tour || null,
      authorName: author?.full_name || author?.email || booking?.contact_name || "Customer",
      reply: reply
        ? {
            id: reply.id,
            text: reply.reply_text,
            createdAt: reply.created_at,
            authorName: profileMap.get(reply.replied_by)?.full_name || "Staff"
          }
        : null
    };
  });

  const ticketMessagesById = dbTicketMessages.reduce((map, message) => {
    const list = map.get(message.ticket_id) || [];
    list.push({ ...message, sender: profileMap.get(message.sender_id) || null });
    map.set(message.ticket_id, list);
    return map;
  }, new Map());

  const tickets = dbTickets.map((ticket) => {
    const booking = bookingMap.get(ticket.booking_id) || null;
    const profile = profileMap.get(ticket.user_id) || null;
    return {
      ...ticket,
      booking,
      bookingCode: booking?.booking_code || "",
      bookingStatus: booking?.booking_status || "",
      customerName: profile?.full_name || booking?.contact_name || "Customer",
      profile,
      tour: booking?.tour || null,
      messages: ticketMessagesById.get(ticket.id) || []
    };
  });

  const couponStats = dbCouponUsages.reduce((map, usage) => {
    const current = map.get(usage.coupon_id) || { usageCount: 0, totalDiscount: 0 };
    current.usageCount += 1;
    current.totalDiscount += Number(usage.discount_amount || 0);
    map.set(usage.coupon_id, current);
    return map;
  }, new Map());

  const coupons = (dbCoupons.length ? dbCoupons : catalog.coupons).map((coupon) => {
    const stats = couponStats.get(coupon.id) || { usageCount: 0, totalDiscount: 0 };
    return {
      ...coupon,
      description: compactText(coupon.description, "Promotion"),
      discountType: coupon.discountType || coupon.discount_type,
      discountValue: toNumber(coupon.discountValue ?? coupon.discount_value),
      minOrderAmount: toNumber(coupon.minOrderAmount ?? coupon.min_order_amount),
      maxDiscountAmount: coupon.maxDiscountAmount ?? coupon.max_discount_amount ?? null,
      isActive: Boolean(coupon.isActive ?? coupon.is_active ?? true),
      startAt: coupon.startAt || coupon.start_at || null,
      endAt: coupon.endAt || coupon.end_at || null,
      usageCount: stats.usageCount,
      totalDiscount: stats.totalDiscount
    };
  });
  const couponMap = new Map(coupons.map((coupon) => [coupon.id, coupon]));

  const couponUsages = dbCouponUsages.map((usage) => ({
    ...usage,
    booking: bookingMap.get(usage.booking_id) || null,
    customer: profileMap.get(usage.user_id) || null,
    coupon: couponMap.get(usage.coupon_id) || null
  }));

  const banners = (dbBanners.length ? dbBanners : catalog.banners).map((banner) => ({
    ...banner,
    isActive: Boolean(banner.isActive ?? banner.is_active ?? true)
  }));

  const cmsPages = (dbCmsPages.length ? dbCmsPages : catalog.cmsPages).map((page) => ({
    ...page,
    metaTitle: page.metaTitle || page.meta_title || page.title,
    metaDescription: page.metaDescription || page.meta_description || "",
    isPublished: Boolean(page.isPublished ?? page.is_published ?? false),
    publishedAt: page.publishedAt || page.published_at || null
  }));

  const systemSettings = dbSystemSettings.map((setting) => ({
    ...setting,
    updatedBy: profileMap.get(setting.updated_by) || null
  }));

  const activityLogs = (dbActivityLogs.length
    ? dbActivityLogs
    : dbBookingEvents.map((event) => ({
        id: event.id,
        actor_id: event.actor_id,
        action: event.event_type,
        entity_type: "booking",
        entity_id: event.booking_id,
        created_at: event.created_at
      }))
  ).map((entry) => ({
    ...entry,
    actor: profileMap.get(entry.actor_id) || null
  }));

  return {
    sourceMode: "database",
    bookings,
    payments,
    refunds,
    invoices,
    reviews,
    tickets,
    activityLogs,
    tours,
    schedules,
    coupons,
    couponUsages,
    banners,
    cmsPages,
    paymentMethods,
    systemSettings,
    profiles
  };
}

export async function moderateReview({ reviewId, status, replyText = "" }) {
  const bookings = readBookings();
  for (const booking of bookings) {
    if (booking.review?.id !== reviewId) continue;
    booking.review.status = status;
    booking.review.updatedAt = new Date().toISOString();
    if (replyText) booking.review.reply = { id: booking.review.reply?.id || crypto.randomUUID(), text: replyText, createdAt: booking.review.updatedAt, authorName: "TourBook" };
    saveBookings(bookings);
    return booking.review;
  }
  throw new Error("Không tìm th?y review.");
}

export async function reviewCancellation(bookingId, decision, note = "") {
  const bookings = readBookings();
  const booking = bookings.find((item) => item.id === bookingId);
  if (!booking) throw new Error("Không tìm th?y booking.");
  booking.booking_status = decision === "approve" ? "cancelled" : booking.payment_status === "paid" ? "confirmed" : "awaiting_payment";
  booking.updated_at = new Date().toISOString();
  booking.events.unshift({ id: crypto.randomUUID(), event_type: decision === "approve" ? "cancellation_approved" : "cancellation_rejected", note: note || (decision === "approve" ? "Ðã duy?t yêu c?u h?y." : "Ðã t? ch?i yêu c?u h?y."), created_at: booking.updated_at });
  saveBookings(bookings);
  return booking;
}

export async function updateTicketStatus({ ticketId, status, message = "" }) {
  const bookings = readBookings();
  for (const booking of bookings) {
    const ticket = (booking.tickets || []).find((item) => item.id === ticketId);
    if (!ticket) continue;
    ticket.status = status;
    if (message) ticket.messages.push({ id: crypto.randomUUID(), sender_type: "staff", message, created_at: new Date().toISOString() });
    saveBookings(bookings);
    return ticket;
  }
  throw new Error("Không tìm th?y ticket.");
}

export {
  SUPABASE_URL,
  compactText,
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatShortDate,
  resolvePostLoginPath,
  statusLabel
};








