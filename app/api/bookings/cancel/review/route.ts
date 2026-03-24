import { NextResponse } from "next/server"

import {
  canResolveCancellationRequest,
  getApprovedRefundPaymentStatus,
  getRejectedCancellationStatus,
} from "@/lib/booking-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type ReviewCancellationPayload = {
  bookingCode?: string
  decision?: "approve" | "reject"
  note?: string
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

    const { supabase, auth } = authResult
    if (!auth.isManagement) {
      return responseError("Chỉ nhân sự quản trị mới được duyệt yêu cầu hủy booking.", 403)
    }

    const payload = (await request.json()) as ReviewCancellationPayload
    if (!payload.bookingCode || !payload.decision) {
      return responseError("Thiếu mã booking hoặc quyết định xử lý.")
    }

    const bookingResult = await supabase
      .from("bookings")
      .select("id,booking_code,user_id,booking_status,payment_status,cancel_reason")
      .eq("booking_code", payload.bookingCode)
      .maybeSingle()

    if (bookingResult.error) {
      return responseError(bookingResult.error.message, 500)
    }

    const booking = bookingResult.data
    if (!booking) {
      return responseError("Không tìm thấy booking.", 404)
    }

    if (!canResolveCancellationRequest({ bookingStatus: booking.booking_status, paymentStatus: booking.payment_status })) {
      return responseError("Booking này hiện không ở trạng thái chờ duyệt hủy.")
    }

    const timestamp = new Date().toISOString()
    const latestPaymentResult = await supabase
      .from("payments")
      .select("id,amount,status")
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latestPaymentResult.error) {
      return responseError(latestPaymentResult.error.message, 500)
    }

    const payment = latestPaymentResult.data

    if (payload.decision === "approve") {
      const nextPaymentStatus = getApprovedRefundPaymentStatus(booking.payment_status)
      const bookingUpdate = await supabase
        .from("bookings")
        .update({
          booking_status: "cancelled",
          payment_status: nextPaymentStatus,
          cancelled_at: timestamp,
          expires_at: null,
        })
        .eq("id", booking.id)

      if (bookingUpdate.error) {
        return responseError(bookingUpdate.error.message, 500)
      }

      if (payment?.id && ["paid", "partially_paid"].includes(booking.payment_status)) {
        const paymentStatus = nextPaymentStatus === "partially_refunded" ? "partially_refunded" : "refunded"

        const paymentUpdate = await supabase
          .from("payments")
          .update({
            status: paymentStatus,
            raw_response: {
              result: paymentStatus,
              processed_at: timestamp,
              source: "admin-cancel-review",
            },
          })
          .eq("id", payment.id)

        if (paymentUpdate.error) {
          return responseError(paymentUpdate.error.message, 500)
        }

        await supabase.from("payment_events").insert({
          payment_id: payment.id,
          event_name: "refund_processed",
          payload: {
            booking_code: booking.booking_code,
            refund_status: paymentStatus,
          },
          status: "processed",
          processed_at: timestamp,
        })

        await supabase.from("refunds").insert({
          payment_id: payment.id,
          amount: payment.amount,
          reason: payload.note?.trim() || booking.cancel_reason || "Yêu cầu hủy booking đã được duyệt.",
          status: "refunded",
          requested_by: booking.user_id,
          approved_by: auth.user.id,
          refunded_at: timestamp,
        })
      }

      await supabase.from("booking_events").insert({
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "cancellation_approved",
        note: payload.note?.trim() || "Yêu cầu hủy booking đã được duyệt.",
        event_data: {
          previous_payment_status: booking.payment_status,
          new_payment_status: nextPaymentStatus,
          actor_role: auth.primaryRole,
        },
      })

      if (booking.user_id) {
        await supabase.from("notifications").insert({
          user_id: booking.user_id,
          title: "Yêu cầu hủy đã được duyệt",
          content: `Booking ${booking.booking_code} đã được duyệt hủy thành công.`,
          notification_type: "booking",
          reference_type: "booking",
          reference_id: booking.id,
        })
      }

      return NextResponse.json({
        ok: true,
        bookingCode: booking.booking_code,
        bookingStatus: "cancelled",
        paymentStatus: nextPaymentStatus,
      })
    }

    const restoredStatus = getRejectedCancellationStatus(booking.payment_status)
    const bookingUpdate = await supabase
      .from("bookings")
      .update({
        booking_status: restoredStatus,
        cancelled_at: null,
      })
      .eq("id", booking.id)

    if (bookingUpdate.error) {
      return responseError(bookingUpdate.error.message, 500)
    }

    await supabase.from("booking_events").insert({
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "cancellation_rejected",
      note: payload.note?.trim() || "Yêu cầu hủy booking đã bị từ chối.",
      event_data: {
        restored_status: restoredStatus,
        payment_status: booking.payment_status,
        actor_role: auth.primaryRole,
      },
    })

    if (booking.user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        title: "Yêu cầu hủy chưa được chấp thuận",
        content: `Booking ${booking.booking_code} vẫn được giữ ở trạng thái ${restoredStatus}.`,
        notification_type: "booking",
        reference_type: "booking",
        reference_id: booking.id,
      })
    }

    return NextResponse.json({
      ok: true,
      bookingCode: booking.booking_code,
      bookingStatus: restoredStatus,
      paymentStatus: booking.payment_status,
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể xử lý yêu cầu hủy booking.", 500)
  }
}
