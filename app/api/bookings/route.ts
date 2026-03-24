import { NextResponse } from "next/server"

import { computeCouponDiscount, computeSubtotal } from "@/lib/pricing"
import { getSiteCatalog } from "@/lib/site-data"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

type TravelerInput = {
  fullName: string
  email?: string
  phone?: string
  dateOfBirth?: string
  gender?: string
  travelerType: "adult" | "child" | "infant"
  idNumber?: string
  nationality?: string
  specialRequest?: string
}

type BookingPayload = {
  userId?: string | null
  tourId?: string
  tourSlug?: string
  scheduleId?: string
  paymentMethodCode?: string
  couponCode?: string | null
  counts?: {
    adults?: number
    children?: number
    infants?: number
  }
  contact?: {
    fullName?: string
    email?: string
    phone?: string
  }
  customerNote?: string
  travelers?: TravelerInput[]
}

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization")
    const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null

    if (!accessToken) {
      return badRequest("Bạn cần đăng nhập để đặt tour.", 401)
    }

    const payload = (await request.json()) as BookingPayload
    const counts = {
      adults: Math.max(0, Number(payload.counts?.adults || 0)),
      children: Math.max(0, Number(payload.counts?.children || 0)),
      infants: Math.max(0, Number(payload.counts?.infants || 0)),
    }

    const totalTravelers = counts.adults + counts.children + counts.infants
    if (!payload.scheduleId || (!payload.tourId && !payload.tourSlug)) {
      return badRequest("Thiếu thông tin tour hoặc lịch khởi hành.")
    }

    if (!payload.paymentMethodCode) {
      return badRequest("Vui lòng chọn phương thức thanh toán.")
    }

    if (!payload.contact?.fullName || !payload.contact.email || !payload.contact.phone) {
      return badRequest("Thông tin liên hệ chưa đầy đủ.")
    }

    if (totalTravelers <= 0) {
      return badRequest("Booking phải có ít nhất 1 hành khách.")
    }

    const travelers = payload.travelers || []
    if (travelers.length !== totalTravelers || travelers.some((traveler) => !traveler.fullName?.trim())) {
      return badRequest("Danh sách hành khách chưa hợp lệ.")
    }

    const supabase = getSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return badRequest("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để đặt tour.", 401)
    }

    if (payload.userId && payload.userId !== user.id) {
      return badRequest("Phiên đăng nhập không hợp lệ cho thao tác tạo booking.", 403)
    }

    const catalog = await getSiteCatalog()
    const tour = catalog.tours.find((item) => item.id === payload.tourId || item.slug === payload.tourSlug)
    if (!tour) {
      return badRequest("Không tìm thấy tour.", 404)
    }

    const schedule = tour.schedules.find((item) => item.id === payload.scheduleId)
    if (!schedule) {
      return badRequest("Không tìm thấy lịch khởi hành.", 404)
    }

    if (schedule.status !== "open") {
      return badRequest("Lịch khởi hành này đang không mở booking.")
    }

    if (schedule.availableSlots < totalTravelers) {
      return badRequest("Số chỗ còn lại không đủ cho booking này.")
    }

    const subtotal = computeSubtotal(counts, schedule.prices)
    if (subtotal <= 0) {
      return badRequest("Không tính được tổng tiền cho booking.")
    }

    const scopedCoupons = catalog.coupons.filter((coupon) => {
      const matchesTour = !coupon.scopedTourIds.length || coupon.scopedTourIds.includes(tour.id)
      const matchesCategory =
        !coupon.scopedCategoryIds.length ||
        tour.categories.some((category) => coupon.scopedCategoryIds.includes(category.id))

      return matchesTour && matchesCategory
    })

    const coupon = payload.couponCode
      ? scopedCoupons.find((item) => item.code.toLowerCase() === payload.couponCode?.trim().toLowerCase()) || null
      : null

    if (payload.couponCode && !coupon) {
      return badRequest("Coupon không hợp lệ hoặc không áp dụng cho tour này.")
    }

    const discountAmount = coupon ? computeCouponDiscount(subtotal, coupon) : 0
    const totalAmount = Math.max(0, subtotal - discountAmount)

    const paymentMethodResult = await supabase
      .from("payment_methods")
      .select("id,code,method_type,name,provider_name")
      .eq("code", payload.paymentMethodCode)
      .maybeSingle()

    if (paymentMethodResult.error) {
      return badRequest(paymentMethodResult.error.message, 500)
    }

    if (!paymentMethodResult.data) {
      return badRequest("Phương thức thanh toán không tồn tại.")
    }

    const holdMinutesResult = await supabase
      .from("system_settings")
      .select("setting_value")
      .eq("setting_key", "booking_hold_minutes")
      .maybeSingle()

    const rawHoldValue = holdMinutesResult.data?.setting_value
    const holdMinutes = Number(typeof rawHoldValue === "number" ? rawHoldValue : rawHoldValue || 30) || 30
    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

    const bookingStatus = paymentMethodResult.data.method_type === "cash" ? "confirmed" : "awaiting_payment"
    const paymentStatus = paymentMethodResult.data.method_type === "cash" ? "unpaid" : "pending"
    const confirmedAt = bookingStatus === "confirmed" ? new Date().toISOString() : null

    const snapshot = {
      tour_name: tour.name,
      tour_slug: tour.slug,
      destination_label: tour.destinationLabel,
      departure_date: schedule.departureDate,
      return_date: schedule.returnDate,
      meeting_point: schedule.meetingPoint,
      pricing: schedule.prices,
      selected_payment_method: paymentMethodResult.data.code,
    }

    const bookingInsert = await supabase
      .from("bookings")
      .insert({
        user_id: user.id,
        tour_id: tour.id,
        schedule_id: schedule.id,
        contact_name: payload.contact.fullName.trim(),
        contact_phone: payload.contact.phone.trim(),
        contact_email: payload.contact.email.trim(),
        adult_count: counts.adults,
        child_count: counts.children,
        infant_count: counts.infants,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        tax_amount: 0,
        service_fee_amount: 0,
        total_amount: totalAmount,
        currency: schedule.currency,
        booking_status: bookingStatus,
        payment_status: paymentStatus,
        expires_at: paymentStatus === "pending" ? expiresAt : null,
        confirmed_at: confirmedAt,
        customer_note: payload.customerNote?.trim() || null,
        snapshot_jsonb: snapshot,
      })
      .select("id,booking_code")
      .single()

    if (bookingInsert.error || !bookingInsert.data) {
      return badRequest(bookingInsert.error?.message || "Không thể tạo booking.", 500)
    }

    const priceLookup = new Map(
      schedule.prices.map((price) => [price.travelerType, price.salePrice ?? price.price])
    )

    const travelerRows = travelers.map((traveler) => ({
      booking_id: bookingInsert.data.id,
      full_name: traveler.fullName.trim(),
      phone: traveler.phone?.trim() || null,
      email: traveler.email?.trim() || null,
      date_of_birth: traveler.dateOfBirth || null,
      gender: traveler.gender === "male" || traveler.gender === "female" || traveler.gender === "other" ? traveler.gender : null,
      id_number: traveler.idNumber?.trim() || null,
      nationality: traveler.nationality?.trim() || null,
      traveler_type: traveler.travelerType,
      price_amount: priceLookup.get(traveler.travelerType) || 0,
      special_request: traveler.specialRequest?.trim() || null,
    }))

    const travelerInsert = await supabase.from("booking_travelers").insert(travelerRows)
    if (travelerInsert.error) {
      return badRequest(travelerInsert.error.message, 500)
    }

    const priceLines = [
      counts.adults > 0
        ? {
            booking_id: bookingInsert.data.id,
            line_type: "fare",
            label: "Adult fare",
            quantity: counts.adults,
            unit_amount: priceLookup.get("adult") || 0,
            total_amount: (priceLookup.get("adult") || 0) * counts.adults,
            metadata_jsonb: { traveler_type: "adult" },
          }
        : null,
      counts.children > 0
        ? {
            booking_id: bookingInsert.data.id,
            line_type: "fare",
            label: "Child fare",
            quantity: counts.children,
            unit_amount: priceLookup.get("child") || 0,
            total_amount: (priceLookup.get("child") || 0) * counts.children,
            metadata_jsonb: { traveler_type: "child" },
          }
        : null,
      counts.infants > 0
        ? {
            booking_id: bookingInsert.data.id,
            line_type: "fare",
            label: "Infant fare",
            quantity: counts.infants,
            unit_amount: priceLookup.get("infant") || 0,
            total_amount: (priceLookup.get("infant") || 0) * counts.infants,
            metadata_jsonb: { traveler_type: "infant" },
          }
        : null,
      coupon && discountAmount > 0
        ? {
            booking_id: bookingInsert.data.id,
            line_type: "coupon",
            label: coupon.code,
            quantity: 1,
            unit_amount: discountAmount,
            total_amount: discountAmount,
            metadata_jsonb: { coupon_id: coupon.id },
          }
        : null,
    ].filter(Boolean)

    if (priceLines.length) {
      const priceLineInsert = await supabase.from("booking_price_lines").insert(priceLines)
      if (priceLineInsert.error) {
        return badRequest(priceLineInsert.error.message, 500)
      }
    }

    if (coupon && discountAmount > 0) {
      const couponUsageInsert = await supabase.from("coupon_usages").insert({
        coupon_id: coupon.id,
        booking_id: bookingInsert.data.id,
        user_id: user.id,
        discount_amount: discountAmount,
      })

      if (couponUsageInsert.error) {
        return badRequest(couponUsageInsert.error.message, 500)
      }

      const couponCountResult = await supabase
        .from("coupons")
        .select("used_count")
        .eq("id", coupon.id)
        .maybeSingle()

      const nextUsedCount = (couponCountResult.data?.used_count || 0) + 1
      await supabase.from("coupons").update({ used_count: nextUsedCount }).eq("id", coupon.id)
    }

    const paymentInsert = await supabase.from("payments").insert({
      booking_id: bookingInsert.data.id,
      payment_method_id: paymentMethodResult.data.id,
      provider_name: paymentMethodResult.data.provider_name || paymentMethodResult.data.name,
      provider_order_id: `ORDER-${bookingInsert.data.booking_code}`,
      transaction_code: `PENDING-${bookingInsert.data.booking_code}`,
      amount: totalAmount,
      currency: schedule.currency,
      status: "pending",
      raw_response: {
        source: "tourbook-web",
        payment_method: paymentMethodResult.data.code,
      },
    })

    if (paymentInsert.error) {
      return badRequest(paymentInsert.error.message, 500)
    }

    await supabase.from("booking_events").insert({
      booking_id: bookingInsert.data.id,
      actor_id: user.id,
      event_type: "booking_created",
      note: "Booking created from checkout flow.",
      event_data: {
        payment_method: paymentMethodResult.data.code,
        coupon_code: coupon?.code || null,
        travelers: totalTravelers,
      },
    })

    await supabase.from("notifications").insert({
      user_id: user.id,
      title: "Booking đã được tạo",
      content: `Booking ${bookingInsert.data.booking_code} đã được tạo thành công.`,
      notification_type: "booking",
      reference_type: "booking",
      reference_id: bookingInsert.data.id,
    })

    return NextResponse.json({
      ok: true,
      bookingId: bookingInsert.data.id,
      bookingCode: bookingInsert.data.booking_code,
      totalAmount,
      bookingStatus,
      paymentStatus,
    })
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.", 500)
  }
}
