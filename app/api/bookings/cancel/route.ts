import { NextResponse } from "next/server"

import { getCancellationMode } from "@/lib/booking-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type CancelPayload = {
  bookingCode?: string
  reason?: string
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

    const payload = (await request.json()) as CancelPayload
    if (!payload.bookingCode) {
      return responseError("Thiếu mã booking.")
    }

    const { supabase, auth } = authResult
    const bookingResult = await supabase
      .from("bookings")
      .select("id,booking_code,user_id,booking_status,payment_status")
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
      return responseError("Bạn không có quyền hủy booking này.", 403)
    }

    if (booking.booking_status === "cancel_requested") {
      return responseError("Booking này đang chờ đội ngũ duyệt yêu cầu hủy.")
    }

    if (["cancelled", "completed", "expired"].includes(booking.booking_status)) {
      return responseError("Booking này không thể hủy ở thời điểm hiện tại.")
    }

    const cancellationMode = getCancellationMode({
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
    })

    if (cancellationMode === "blocked") {
      return responseError("Booking này không còn hợp lệ để hủy.")
    }

    const timestamp = new Date().toISOString()
    const nextStatus = cancellationMode === "request_approval" ? "cancel_requested" : "cancelled"
    const nextPaymentStatus =
      nextStatus === "cancelled" && booking.payment_status === "pending"
        ? "failed"
        : booking.payment_status

    const updateResult = await supabase
      .from("bookings")
      .update({
        booking_status: nextStatus,
        cancelled_at: nextStatus === "cancelled" ? timestamp : null,
        cancel_reason: payload.reason?.trim() || null,
        payment_status: nextPaymentStatus,
        expires_at: null,
      })
      .eq("id", booking.id)

    if (updateResult.error) {
      return responseError(updateResult.error.message, 500)
    }

    if (nextStatus === "cancelled" && booking.payment_status === "pending") {
      const paymentResult = await supabase
        .from("payments")
        .select("id,status")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (paymentResult.data?.id && paymentResult.data.status === "pending") {
        await supabase
          .from("payments")
          .update({
            status: "cancelled",
            failed_at: timestamp,
            failure_reason: "Booking đã bị hủy trước khi hoàn tất thanh toán.",
          })
          .eq("id", paymentResult.data.id)

        await supabase.from("payment_events").insert({
          payment_id: paymentResult.data.id,
          event_name: "payment_cancelled",
          payload: {
            booking_code: booking.booking_code,
            source: "booking-cancel-api",
          },
          status: "processed",
          processed_at: timestamp,
        })
      }
    }

    await supabase.from("booking_events").insert({
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: nextStatus === "cancel_requested" ? "cancel_requested" : "booking_cancelled",
      note: payload.reason?.trim() || "Customer requested cancellation from website.",
      event_data: {
        payment_status: booking.payment_status,
        actor_role: auth.primaryRole,
      },
    })

    if (booking.user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        title: nextStatus === "cancel_requested" ? "Yêu cầu hủy booking đã được ghi nhận" : "Booking đã hủy",
        content:
          nextStatus === "cancel_requested"
            ? `Booking ${booking.booking_code} đã được chuyển sang trạng thái chờ duyệt hủy.`
            : `Booking ${booking.booking_code} đã được hủy thành công.`,
        notification_type: "booking",
        reference_type: "booking",
        reference_id: booking.id,
      })
    }

    return NextResponse.json({
      ok: true,
      bookingCode: booking.booking_code,
      bookingStatus: nextStatus,
      paymentStatus: nextPaymentStatus,
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể hủy booking.", 500)
  }
}
