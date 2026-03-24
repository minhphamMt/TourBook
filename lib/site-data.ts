import { average, compactText, formatDuration, normalizeSearch, splitRichText } from "@/lib/format"
import { computeCouponDiscount, computeSubtotal, type CouponLike, type SchedulePrice, type TravelerCounts } from "@/lib/pricing"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

type RawTour = {
  id: string
  slug: string
  name: string
  short_description: string | null
  description: string | null
  departure_location_id: string | null
  duration_days: number
  duration_nights: number
  base_currency: string
  is_featured: boolean
  included_text: string | null
  excluded_text: string | null
  terms_text: string | null
  important_notes: string | null
  cancellation_policy_id: string | null
  status: string
  published_at: string | null
}

type RawImage = {
  id: string
  tour_id: string
  image_url: string
  alt_text: string | null
  is_cover: boolean
  sort_order: number
}

type RawDestination = {
  id: string
  tour_id: string
  location_id: string
  sort_order: number
  is_primary: boolean
}

type RawLocation = {
  id: string
  parent_id: string | null
  name: string
  slug: string
  location_type: string
  description: string | null
  image_url: string | null
  is_active: boolean
  sort_order: number
}

type RawCategory = {
  id: string
  name: string
  slug: string
}

type RawTourCategory = {
  id: string
  tour_id: string
  category_id: string
}

type RawTag = {
  id: string
  name: string
  slug: string
}

type RawTourTag = {
  id: string
  tour_id: string
  tag_id: string
}

type RawSchedule = {
  id: string
  tour_id: string
  departure_date: string
  return_date: string
  meeting_point: string | null
  meeting_at: string | null
  capacity: number
  cutoff_at: string | null
  status: string
  currency: string
  notes: string | null
}

type RawAvailability = {
  schedule_id: string
  tour_id: string
  capacity: number
  reserved_slots: number
  available_slots: number
}

type RawPriceTier = {
  id: string
  schedule_id: string
  traveler_type: "adult" | "child" | "infant"
  age_from: number | null
  age_to: number | null
  price: number
  sale_price: number | null
  currency: string
}

type RawItinerary = {
  id: string
  tour_id: string
  day_number: number
  title: string
  description: string | null
  meals: string[] | null
  accommodation: string | null
  transportation: string | null
}

type RawReview = {
  id: string
  tour_id: string
  booking_id: string
  user_id: string | null
  rating: number
  comment: string | null
  status: string
  created_at: string
}

type RawReviewReply = {
  id: string
  review_id: string
  replied_by: string | null
  reply_text: string
  created_at: string
}

type RawProfile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string | null
  customer_level: string | null
}

type RawBanner = {
  id: string
  title: string
  image_url: string
  link_url: string | null
  placement: string
  sort_order: number
  is_active: boolean
  start_at: string | null
  end_at: string | null
}

type RawCmsPage = {
  id: string
  slug: string
  title: string
  content: string | null
  meta_title: string | null
  meta_description: string | null
  is_published: boolean
}

type RawCoupon = {
  id: string
  code: string
  name: string
  description: string | null
  discount_type: "percentage" | "fixed_amount"
  discount_value: number
  min_order_amount: number
  max_discount_amount: number | null
  start_at: string | null
  end_at: string | null
  is_active: boolean
}

type RawCouponTour = { coupon_id: string; tour_id: string }
type RawCouponCategory = { coupon_id: string; category_id: string }

type RawPaymentMethod = {
  id: string
  code: string
  name: string
  method_type: string
  provider_name: string | null
  description: string | null
}

type RawPolicy = {
  id: string
  name: string
  description: string | null
  rules_jsonb: Array<{ days_before: number; refund_percent: number }> | null
}

export type TourSchedule = {
  id: string
  departureDate: string
  returnDate: string
  meetingPoint: string
  meetingAt: string | null
  capacity: number
  availableSlots: number
  reservedSlots: number
  cutoffAt: string | null
  status: string
  currency: string
  notes: string
  prices: SchedulePrice[]
  basePrice: number
}

export type TourReview = {
  id: string
  bookingId: string
  rating: number
  comment: string
  createdAt: string
  authorName: string
  authorAvatar: string | null
  authorTier: string
  reply: {
    text: string
    createdAt: string
    authorName: string
  } | null
}

export type TourSummary = {
  id: string
  slug: string
  name: string
  shortDescription: string
  description: string
  durationDays: number
  durationNights: number
  durationLabel: string
  baseCurrency: string
  isFeatured: boolean
  departureLocation: RawLocation | null
  destinations: RawLocation[]
  destinationLabel: string
  categories: RawCategory[]
  tags: RawTag[]
  coverImage: string
  gallery: RawImage[]
  schedules: TourSchedule[]
  itinerary: RawItinerary[]
  includedItems: string[]
  excludedItems: string[]
  termsItems: string[]
  noteItems: string[]
  ratingAverage: number
  reviewCount: number
  reviews: TourReview[]
  startingPrice: number
  nextDeparture: string | null
  cancellationPolicy: RawPolicy | null
  viewerCount: number
}

export type DestinationSpotlight = {
  location: RawLocation
  tours: TourSummary[]
  totalTours: number
  featuredImage: string
}

export type PaymentMethod = {
  id: string
  code: string
  name: string
  methodType: string
  providerName: string | null
  description: string
}

export type CouponPreview = CouponLike & {
  id: string
  name: string
  description: string
  scopedTourIds: string[]
  scopedCategoryIds: string[]
}

export type CmsPageData = {
  id: string
  slug: string
  title: string
  content: string
  metaTitle: string
  metaDescription: string
}

export type SiteCatalog = {
  tours: TourSummary[]
  banners: RawBanner[]
  destinations: DestinationSpotlight[]
  featuredTours: TourSummary[]
  latestReviews: TourReview[]
  paymentMethods: PaymentMethod[]
  coupons: CouponPreview[]
  cmsPages: CmsPageData[]
}

function ensure<T>(label: string, result: { data: T | null; error: { message: string } | null }) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`)
  }

  return result.data
}

function stableViewerCount(seed: string) {
  let hash = 0
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973
  }
  return 8 + (hash % 19)
}

function getSchedulePrices(priceTiers: RawPriceTier[], scheduleId: string): SchedulePrice[] {
  return priceTiers
    .filter((tier) => tier.schedule_id === scheduleId)
    .map((tier) => ({
      travelerType: tier.traveler_type,
      price: tier.price,
      salePrice: tier.sale_price,
    }))
}

function getBasePrice(prices: SchedulePrice[]) {
  const adult = prices.find((price) => price.travelerType === "adult")
  if (adult) return adult.salePrice ?? adult.price

  const anyPrice = prices[0]
  return anyPrice ? anyPrice.salePrice ?? anyPrice.price : 0
}

function withinActiveWindow(startAt: string | null, endAt: string | null) {
  const now = new Date()
  if (startAt && new Date(startAt) > now) return false
  if (endAt && new Date(endAt) < now) return false
  return true
}

export async function getSiteCatalog(): Promise<SiteCatalog> {
  const supabase = getSupabaseServerClient()

  const [
    toursResult,
    imagesResult,
    destinationsResult,
    locationsResult,
    categoriesResult,
    tourCategoriesResult,
    tagsResult,
    tourTagsResult,
    schedulesResult,
    availabilityResult,
    priceTiersResult,
    itineraryResult,
    reviewsResult,
    reviewRepliesResult,
    profilesResult,
    bannersResult,
    cmsPagesResult,
    paymentMethodsResult,
    couponsResult,
    couponToursResult,
    couponCategoriesResult,
    policiesResult,
  ] = await Promise.all([
    supabase.from("tours").select("*").eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("tour_images").select("*").order("sort_order"),
    supabase.from("tour_destinations").select("*").order("sort_order"),
    supabase.from("locations").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("categories").select("id,name,slug"),
    supabase.from("tour_categories").select("id,tour_id,category_id"),
    supabase.from("tags").select("id,name,slug"),
    supabase.from("tour_tags").select("id,tour_id,tag_id"),
    supabase.from("departure_schedules").select("*").order("departure_date"),
    supabase.from("schedule_availability").select("*"),
    supabase.from("schedule_price_tiers").select("*"),
    supabase.from("tour_itinerary_days").select("*").order("day_number"),
    supabase.from("reviews").select("*").eq("status", "approved").order("created_at", { ascending: false }),
    supabase.from("review_replies").select("*"),
    supabase.from("profiles").select("id,full_name,avatar_url,email,customer_level"),
    supabase.from("banners").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("cms_pages").select("id,slug,title,content,meta_title,meta_description,is_published").eq("is_published", true),
    supabase.from("payment_methods").select("id,code,name,method_type,provider_name,description").eq("is_active", true),
    supabase.from("coupons").select("id,code,name,description,discount_type,discount_value,min_order_amount,max_discount_amount,start_at,end_at,is_active").eq("is_active", true),
    supabase.from("coupon_tours").select("coupon_id,tour_id"),
    supabase.from("coupon_categories").select("coupon_id,category_id"),
    supabase.from("cancellation_policies").select("id,name,description,rules_jsonb").eq("is_active", true),
  ])

  const tours = ensure<RawTour[]>("tours", toursResult) || []
  const images = ensure<RawImage[]>("tour_images", imagesResult) || []
  const destinations = ensure<RawDestination[]>("tour_destinations", destinationsResult) || []
  const locations = ensure<RawLocation[]>("locations", locationsResult) || []
  const categories = ensure<RawCategory[]>("categories", categoriesResult) || []
  const tourCategories = ensure<RawTourCategory[]>("tour_categories", tourCategoriesResult) || []
  const tags = ensure<RawTag[]>("tags", tagsResult) || []
  const tourTags = ensure<RawTourTag[]>("tour_tags", tourTagsResult) || []
  const schedules = ensure<RawSchedule[]>("departure_schedules", schedulesResult) || []
  const availabilities = ensure<RawAvailability[]>("schedule_availability", availabilityResult) || []
  const priceTiers = ensure<RawPriceTier[]>("schedule_price_tiers", priceTiersResult) || []
  const itinerary = ensure<RawItinerary[]>("tour_itinerary_days", itineraryResult) || []
  const reviews = ensure<RawReview[]>("reviews", reviewsResult) || []
  const reviewReplies = ensure<RawReviewReply[]>("review_replies", reviewRepliesResult) || []
  const profiles = ensure<RawProfile[]>("profiles", profilesResult) || []
  const banners = (ensure<RawBanner[]>("banners", bannersResult) || []).filter((banner) => withinActiveWindow(banner.start_at, banner.end_at))
  const cmsPages = ensure<RawCmsPage[]>("cms_pages", cmsPagesResult) || []
  const paymentMethods = ensure<RawPaymentMethod[]>("payment_methods", paymentMethodsResult) || []
  const coupons = ensure<RawCoupon[]>("coupons", couponsResult) || []
  const couponTours = ensure<RawCouponTour[]>("coupon_tours", couponToursResult) || []
  const couponCategories = ensure<RawCouponCategory[]>("coupon_categories", couponCategoriesResult) || []
  const policies = ensure<RawPolicy[]>("cancellation_policies", policiesResult) || []

  const locationMap = new Map(locations.map((location) => [location.id, location]))
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]))
  const replyMap = new Map(reviewReplies.map((reply) => [reply.review_id, reply]))
  const availabilityMap = new Map(availabilities.map((availability) => [availability.schedule_id, availability]))
  const policyMap = new Map(policies.map((policy) => [policy.id, policy]))

  const tourSummaries = tours.map((tour) => {
    const tourImages = images
      .filter((image) => image.tour_id === tour.id)
      .sort((left, right) => left.sort_order - right.sort_order)

    const destinationRows = destinations
      .filter((destination) => destination.tour_id === tour.id)
      .sort((left, right) => left.sort_order - right.sort_order)

    const destinationItems = destinationRows
      .map((destination) => locationMap.get(destination.location_id))
      .filter(Boolean) as RawLocation[]

    const destinationLabel =
      destinationItems.find((item, index) => destinationRows[index]?.is_primary)?.name ||
      destinationItems[0]?.name ||
      locationMap.get(tour.departure_location_id || "")?.name ||
      "Đang cập nhật"

    const categoryItems = tourCategories
      .filter((item) => item.tour_id === tour.id)
      .map((item) => categoryMap.get(item.category_id))
      .filter(Boolean) as RawCategory[]

    const tagItems = tourTags
      .filter((item) => item.tour_id === tour.id)
      .map((item) => tagMap.get(item.tag_id))
      .filter(Boolean) as RawTag[]

    const scheduleItems = schedules
      .filter((schedule) => schedule.tour_id === tour.id)
      .map((schedule) => {
        const prices = getSchedulePrices(priceTiers, schedule.id)
        const availability = availabilityMap.get(schedule.id)

        return {
          id: schedule.id,
          departureDate: schedule.departure_date,
          returnDate: schedule.return_date,
          meetingPoint: compactText(schedule.meeting_point, "Cập nhật sau"),
          meetingAt: schedule.meeting_at,
          capacity: schedule.capacity,
          availableSlots: availability?.available_slots ?? schedule.capacity,
          reservedSlots: availability?.reserved_slots ?? 0,
          cutoffAt: schedule.cutoff_at,
          status: schedule.status,
          currency: schedule.currency,
          notes: compactText(schedule.notes, "Không có ghi chú"),
          prices,
          basePrice: getBasePrice(prices),
        }
      })
      .sort((left, right) => left.departureDate.localeCompare(right.departureDate))

    const itineraryItems = itinerary
      .filter((day) => day.tour_id === tour.id)
      .sort((left, right) => left.day_number - right.day_number)

    const reviewItems = reviews
      .filter((review) => review.tour_id === tour.id)
      .map((review) => {
        const author = review.user_id ? profileMap.get(review.user_id) : null
        const reply = replyMap.get(review.id)
        const replyAuthor = reply?.replied_by ? profileMap.get(reply.replied_by) : null

        return {
          id: review.id,
          bookingId: review.booking_id,
          rating: review.rating,
          comment: compactText(review.comment, "Khách hàng không để lại nội dung."),
          createdAt: review.created_at,
          authorName: author?.full_name || author?.email || "Khách đã đặt tour",
          authorAvatar: author?.avatar_url || null,
          authorTier: compactText(author?.customer_level, "guest"),
          reply: reply
            ? {
                text: reply.reply_text,
                createdAt: reply.created_at,
                authorName: replyAuthor?.full_name || "Tư vấn viên The Horizon",
              }
            : null,
        }
      })

    const priceCandidates = scheduleItems
      .filter((schedule) => schedule.status === "open" || schedule.status === "completed")
      .map((schedule) => schedule.basePrice)
      .filter((price) => price > 0)

    const nextOpenSchedule = scheduleItems.find((schedule) => schedule.status === "open")
    const departureLocation = tour.departure_location_id ? locationMap.get(tour.departure_location_id) || null : null

    return {
      id: tour.id,
      slug: tour.slug,
      name: tour.name,
      shortDescription: compactText(tour.short_description),
      description: compactText(tour.description),
      durationDays: tour.duration_days,
      durationNights: tour.duration_nights,
      durationLabel: `${formatDuration(tour.duration_days, tour.duration_nights)}`,
      baseCurrency: tour.base_currency,
      isFeatured: tour.is_featured,
      departureLocation,
      destinations: destinationItems,
      destinationLabel,
      categories: categoryItems,
      tags: tagItems,
      coverImage: tourImages.find((image) => image.is_cover)?.image_url || tourImages[0]?.image_url || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      gallery: tourImages,
      schedules: scheduleItems,
      itinerary: itineraryItems,
      includedItems: splitRichText(tour.included_text),
      excludedItems: splitRichText(tour.excluded_text),
      termsItems: splitRichText(tour.terms_text),
      noteItems: splitRichText(tour.important_notes),
      ratingAverage: Number(average(reviewItems.map((review) => review.rating)).toFixed(1)),
      reviewCount: reviewItems.length,
      reviews: reviewItems,
      startingPrice: priceCandidates.length ? Math.min(...priceCandidates) : 0,
      nextDeparture: nextOpenSchedule?.departureDate || null,
      cancellationPolicy: tour.cancellation_policy_id ? policyMap.get(tour.cancellation_policy_id) || null : null,
      viewerCount: stableViewerCount(tour.id),
    } satisfies TourSummary
  })

  const destinationCounters = new Map<string, TourSummary[]>()
  for (const tour of tourSummaries) {
    for (const destination of tour.destinations.length ? tour.destinations : tour.departureLocation ? [tour.departureLocation] : []) {
      const current = destinationCounters.get(destination.id) || []
      current.push(tour)
      destinationCounters.set(destination.id, current)
    }
  }

  const destinationSpotlights = Array.from(destinationCounters.entries())
    .map(([locationId, locationTours]) => {
      const location = locationMap.get(locationId)
      if (!location) return null

      const sortedTours = [...locationTours].sort((left, right) => {
        const featuredDiff = Number(right.isFeatured) - Number(left.isFeatured)
        if (featuredDiff !== 0) return featuredDiff
        return right.reviewCount - left.reviewCount
      })

      return {
        location,
        tours: sortedTours.slice(0, 4),
        totalTours: locationTours.length,
        featuredImage: sortedTours[0]?.coverImage || location.image_url || "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
      } satisfies DestinationSpotlight
    })
    .filter(Boolean)
    .sort((left, right) => (right?.totalTours || 0) - (left?.totalTours || 0)) as DestinationSpotlight[]

  const couponPreviews = coupons.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    description: compactText(coupon.description, "Khuyến mại ưu đãi"),
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    minOrderAmount: coupon.min_order_amount,
    maxDiscountAmount: coupon.max_discount_amount,
    isActive: coupon.is_active,
    startAt: coupon.start_at,
    endAt: coupon.end_at,
    scopedTourIds: couponTours.filter((item) => item.coupon_id === coupon.id).map((item) => item.tour_id),
    scopedCategoryIds: couponCategories.filter((item) => item.coupon_id === coupon.id).map((item) => item.category_id),
  }))

  const featuredTours = tourSummaries.filter((tour) => tour.isFeatured)
  const featuredOrFallbackTours = (featuredTours.length ? featuredTours : [...tourSummaries].sort((left, right) => {
    const reviewDiff = right.reviewCount - left.reviewCount
    if (reviewDiff !== 0) return reviewDiff

    const leftPrice = left.startingPrice || Number.MAX_SAFE_INTEGER
    const rightPrice = right.startingPrice || Number.MAX_SAFE_INTEGER
    return leftPrice - rightPrice
  })).slice(0, 6)

  return {
    tours: tourSummaries,
    banners,
    destinations: destinationSpotlights,
    featuredTours: featuredOrFallbackTours,
    latestReviews: [...tourSummaries]
      .flatMap((tour) => tour.reviews)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 8),
    paymentMethods: paymentMethods.map((method) => ({
      id: method.id,
      code: method.code,
      name: method.name,
      methodType: method.method_type,
      providerName: method.provider_name,
      description: compactText(method.description, `${method.name} thanh toán`),
    })),
    coupons: couponPreviews,
    cmsPages: cmsPages.map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: compactText(page.content),
      metaTitle: page.meta_title || page.title,
      metaDescription: page.meta_description || compactText(page.content),
    })),
  }
}

export async function getHomepageData() {
  const catalog = await getSiteCatalog()
  return {
    heroBanner: catalog.banners[0] || null,
    secondaryBanners: catalog.banners.slice(1, 3),
    featuredTours: catalog.featuredTours,
    destinations: catalog.destinations.slice(0, 6),
    reviews: catalog.latestReviews.slice(0, 3),
    coupons: catalog.coupons.slice(0, 2),
  }
}

export async function getToursPageData() {
  const catalog = await getSiteCatalog()
  return {
    tours: catalog.tours,
    destinations: catalog.destinations,
    categories: Array.from(new Map(catalog.tours.flatMap((tour) => tour.categories).map((category) => [category.id, category])).values()),
  }
}

export async function getTourBySlug(slug: string) {
  const catalog = await getSiteCatalog()
  return catalog.tours.find((tour) => tour.slug === slug) || null
}

export async function getBookingReferenceData(tourSlug?: string) {
  const catalog = await getSiteCatalog()
  const tour = tourSlug ? catalog.tours.find((item) => item.slug === tourSlug) || null : null

  return {
    tour,
    paymentMethods: catalog.paymentMethods,
    coupons: catalog.coupons,
  }
}

export async function getCmsPageBySlug(slug: string) {
  const catalog = await getSiteCatalog()
  return catalog.cmsPages.find((page) => page.slug === slug) || null
}

export type TourFilters = {
  query?: string
  category?: string
  destination?: string
  duration?: string
  minPrice?: number
  maxPrice?: number
  sort?: string
}

export function filterTours(tours: TourSummary[], filters: TourFilters) {
  const query = normalizeSearch(filters.query)
  const filtered = tours.filter((tour) => {
    const tourSearch = normalizeSearch([
      tour.name,
      tour.shortDescription,
      tour.destinationLabel,
      ...tour.categories.map((category) => category.name),
      ...tour.tags.map((tag) => tag.name),
    ].join(" "))

    const matchesQuery = !query || tourSearch.includes(query)
    const matchesCategory = !filters.category || tour.categories.some((category) => category.slug === filters.category)
    const matchesDestination = !filters.destination || tour.destinations.some((destination) => destination.slug === filters.destination)

    const matchesDuration =
      !filters.duration ||
      (filters.duration === "1-3" && tour.durationDays <= 3) ||
      (filters.duration === "4-7" && tour.durationDays >= 4 && tour.durationDays <= 7) ||
      (filters.duration === "8-14" && tour.durationDays >= 8 && tour.durationDays <= 14) ||
      (filters.duration === "14+" && tour.durationDays > 14)

    const matchesMin = filters.minPrice == null || tour.startingPrice >= filters.minPrice
    const matchesMax = filters.maxPrice == null || tour.startingPrice <= filters.maxPrice

    return matchesQuery && matchesCategory && matchesDestination && matchesDuration && matchesMin && matchesMax
  })

  const sorted = [...filtered]
  switch (filters.sort) {
    case "price-asc":
      sorted.sort((left, right) => left.startingPrice - right.startingPrice)
      break
    case "price-desc":
      sorted.sort((left, right) => right.startingPrice - left.startingPrice)
      break
    case "rating":
      sorted.sort((left, right) => right.ratingAverage - left.ratingAverage)
      break
    case "departure":
      sorted.sort((left, right) => (left.nextDeparture || "9999").localeCompare(right.nextDeparture || "9999"))
      break
    default:
      sorted.sort((left, right) => Number(right.isFeatured) - Number(left.isFeatured) || right.reviewCount - left.reviewCount)
      break
  }

  return sorted
}

export function getCouponPreviewForTour(coupons: CouponPreview[], tour: TourSummary, counts: TravelerCounts, scheduleId: string) {
  const schedule = tour.schedules.find((item) => item.id === scheduleId)
  if (!schedule) return []

  const subtotal = computeSubtotal(counts, schedule.prices)

  return coupons
    .filter((coupon) => {
      const appliesToTour = !coupon.scopedTourIds.length || coupon.scopedTourIds.includes(tour.id)
      const appliesToCategory =
        !coupon.scopedCategoryIds.length ||
        tour.categories.some((category) => coupon.scopedCategoryIds.includes(category.id))

      return appliesToTour && appliesToCategory
    })
    .map((coupon) => ({
      coupon,
      discountAmount: computeCouponDiscount(subtotal, coupon),
    }))
    .filter((item) => item.discountAmount > 0)
    .sort((left, right) => right.discountAmount - left.discountAmount)
}



