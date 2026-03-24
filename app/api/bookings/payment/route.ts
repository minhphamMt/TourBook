import { NextResponse } from "next/server"

import { canMarkBookingPaid } from "@/lib/booking-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type PaymentPayload = {
  bookingCode?: string
}

function responseError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const payload = (await request.json()) as PaymentPayload
    if (!payload.bookingCode) {
      return responseError("Thiếu mã booking.")
    }

    const { supabase, auth } = authResult
    const bookingResult = await supabase
      .from("bookings")
      .select("id,booking_code,user_id,total_amount,currency,booking_status,payment_status,confirmed_at")
      .eq("booking_code", payload.bookingCode)
      .maybeSingle()

    if (bookingResult.error) {
      return responseError(bookingResult.error.message, 500)
    }

    const booking = bookingResult.data
    if (!booking) {
      return responseError("Không tìm thấy booking.", 404)
    }

    if (!auth.isManagement && booking.user_id !== auth.user.id) {
      return responseError("Bạn không có quyền cập nhật thanh toán cho booking này.", 403)
    }

    if (!canMarkBookingPaid({
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
    })) {
      return responseError("Booking này không còn hợp lệ để xác nhận thanh toán.")
    }

    const paymentResult = await supabase
      .from("payments")
      .select("id,status,provider_name,payment_method_id")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (paymentResult.error) {
      return responseError(paymentResult.error.message, 500)
    }

    const payment = paymentResult.data
    if (!payment) {
      return responseError("Booking chưa có bản ghi thanh toán.", 404)
    }

    if (["paid", "failed", "cancelled", "expired", "refunded", "partially_refunded"].includes(payment.status)) {
      return responseError("Bản ghi thanh toán này không thể chuyển sang trạng thái đã thanh toán.")
    }

    const timestamp = new Date().toISOString()
    const paymentUpdate = await supabase
      .from("payments")
      .update({
        status: "paid",
        paid_at: timestamp,
        failed_at: null,
        failure_reason: null,
        provider_payment_id: payment.id,
        transaction_code: `TXN-${booking.booking_code}`,
        raw_response: {
          result: "success",
          paid_at: timestamp,
          source: auth.isManagement ? "admin-console" : "booking-page",
        },
      })
      .eq("id", payment.id)

    if (paymentUpdate.error) {
      return responseError(paymentUpdate.error.message, 500)
    }

    const nextBookingStatus = booking.booking_status === "completed" ? "completed" : "confirmed"
    const bookingUpdate = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        booking_status: nextBookingStatus,
        confirmed_at: booking.confirmed_at || timestamp,
        expires_at: null,
      })
      .eq("id", booking.id)

    if (bookingUpdate.error) {
      return responseError(bookingUpdate.error.message, 500)
    }

    await supabase.from("payment_events").insert({
      payment_id: payment.id,
      event_name: "payment_succeeded",
      payload: {
        booking_code: booking.booking_code,
        source: auth.isManagement ? "admin-console" : "booking-page",
      },
      status: "processed",
      processed_at: timestamp,
    })

    await supabase.from("booking_events").insert({
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "payment_completed",
      note: auth.isManagement
        ? "Thanh toán đã được xác nhận thủ công từ khu quản trị."
        : "Khách hàng đã hoàn tất thanh toán từ trang booking.",
      event_data: {
        source: "tourbook-web",
        actor_role: auth.primaryRole,
      },
    })

    if (booking.user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        title: "Thanh toán thành công",
        content: `Booking ${booking.booking_code} đã được ghi nhận thanh toán thành công.`,
        notification_type: "payment",
        reference_type: "booking",
        reference_id: booking.id,
      })
    }

    return NextResponse.json({
      ok: true,
      bookingCode: booking.booking_code,
      bookingStatus: nextBookingStatus,
      paymentStatus: "paid",
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể xử lý thanh toán.", 500)
  }
}
