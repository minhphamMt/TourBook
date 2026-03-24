import { NextResponse } from "next/server"

import { canCustomerReviewBooking } from "@/lib/customer-care-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type ReviewPayload = {
  bookingId?: string
  rating?: number
  comment?: string
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const payload = (await request.json()) as ReviewPayload
    const rating = Number(payload.rating || 0)

    if (!payload.bookingId || !rating) {
      return NextResponse.json({ error: "Thiếu bookingId hoặc rating." }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Rating phải nằm trong khoảng 1 đến 5." }, { status: 400 })
    }

    const { supabase, auth } = authResult
    const bookingResult = await supabase
      .from("bookings")
      .select("id,tour_id,user_id,booking_status,booking_code")
      .eq("id", payload.bookingId)
      .maybeSingle()

    if (bookingResult.error) {
      return NextResponse.json({ error: bookingResult.error.message }, { status: 500 })
    }

    const booking = bookingResult.data
    if (!booking) {
      return NextResponse.json({ error: "Không tìm thấy booking." }, { status: 404 })
    }

    if (booking.user_id !== auth.user.id) {
      return NextResponse.json({ error: "Bạn không có quyền review booking này." }, { status: 403 })
    }

    if (!canCustomerReviewBooking(booking.booking_status)) {
      return NextResponse.json({ error: "Chỉ booking đã hoàn thành mới được review." }, { status: 400 })
    }

    const existingResult = await supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle()

    if (existingResult.error) {
      return NextResponse.json({ error: existingResult.error.message }, { status: 500 })
    }

    if (existingResult.data) {
      const updateResult = await supabase
        .from("reviews")
        .update({
          rating,
          comment: payload.comment?.trim() || null,
          status: "pending",
        })
        .eq("id", existingResult.data.id)
        .select("id,status")
        .single()

      if (updateResult.error) {
        return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
      }

      await supabase.from("review_replies").delete().eq("review_id", existingResult.data.id)

      return NextResponse.json({ ok: true, review: updateResult.data, mode: "updated" })
    }

    const insertResult = await supabase
      .from("reviews")
      .insert({
        booking_id: booking.id,
        tour_id: booking.tour_id,
        user_id: auth.user.id,
        rating,
        comment: payload.comment?.trim() || null,
        status: "pending",
      })
      .select("id,status")
      .single()

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, review: insertResult.data, mode: "created" })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể gửi review." }, { status: 500 })
  }
}
