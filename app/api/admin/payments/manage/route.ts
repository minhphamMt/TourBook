import { NextResponse } from "next/server"

import { canConfirmPaymentRecord, canExpirePaymentRecord } from "@/lib/booking-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type ManagePaymentPayload = {
  paymentId?: string
  action?: "mark_paid" | "mark_expired"
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
      return responseError("Chỉ nhân sự quản trị mới được xử lý payment.", 403)
    }

    const payload = (await request.json()) as ManagePaymentPayload
    if (!payload.paymentId || !payload.action) {
      return responseError("Thiếu payment hoặc thao tác cần xử lý.")
    }

    const paymentResult = await supabase
      .from("payments")
      .select("id,booking_id,provider_name,provider_payment_id,transaction_code,status,amount,requested_at,paid_at,failed_at")
      .eq("id", payload.paymentId)
      .maybeSingle()

    if (paymentResult.error) {
      return responseError(paymentResult.error.message, 500)
    }

    const payment = paymentResult.data
    if (!payment) {
      return responseError("Không tìm thấy payment record.", 404)
    }

    const bookingResult = await supabase
      .from("bookings")
      .select("id,booking_code,user_id,booking_status,payment_status,confirmed_at,expires_at")
      .eq("id", payment.booking_id)
      .maybeSingle()

    if (bookingResult.error) {
      return responseError(bookingResult.error.message, 500)
    }

    const booking = bookingResult.data
    if (!booking) {
      return responseError("Payment này không còn booking đi kèm.", 404)
    }

    const timestamp = new Date().toISOString()

    if (payload.action === "mark_paid") {
      if (!canConfirmPaymentRecord({
        bookingStatus: booking.booking_status,
        paymentStatus: booking.payment_status,
        paymentRecordStatus: payment.status,
      })) {
        return responseError("Payment này hiện không hợp lệ để xác nhận đã thu.")
      }

      const paymentUpdate = await supabase
        .from("payments")
        .update({
          status: "paid",
          paid_at: timestamp,
          failed_at: null,
          failure_reason: null,
          provider_payment_id: payment.provider_payment_id || payment.id,
          transaction_code: payment.transaction_code || `TXN-${booking.booking_code}`,
          raw_response: {
            result: "success",
            paid_at: timestamp,
            source: "admin-payments-console",
            note: payload.note?.trim() || null,
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
          source: "admin-payments-console",
          actor_role: auth.primaryRole,
        },
        status: "processed",
        processed_at: timestamp,
      })

      await supabase.from("booking_events").insert({
        booking_id: booking.id,
        actor_id: auth.user.id,
        event_type: "payment_completed",
        note: payload.note?.trim() || "Thanh toán đã được xác nhận từ tab Payments.",
        event_data: {
          source: "tourbook-admin",
          actor_role: auth.primaryRole,
          payment_id: payment.id,
        },
      })

      if (booking.user_id) {
        await supabase.from("notifications").insert({
          user_id: booking.user_id,
          title: "Thanh toán đã được ghi nhận",
          content: `Booking ${booking.booking_code} đã được xác nhận thanh toán thành công.`,
          notification_type: "payment",
          reference_type: "booking",
          reference_id: booking.id,
        })
      }

      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        bookingCode: booking.booking_code,
        paymentRecordStatus: "paid",
        bookingStatus: nextBookingStatus,
        bookingPaymentStatus: "paid",
      })
    }

    if (!canExpirePaymentRecord({
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
      paymentRecordStatus: payment.status,
    })) {
      return responseError("Payment request này chưa phù hợp để đánh dấu hết hạn.")
    }

    const paymentUpdate = await supabase
      .from("payments")
      .update({
        status: "expired",
        failed_at: timestamp,
        failure_reason: payload.note?.trim() || "Payment request đã hết hạn xử lý.",
        raw_response: {
          result: "expired",
          expired_at: timestamp,
          source: "admin-payments-console",
        },
      })
      .eq("id", payment.id)

    if (paymentUpdate.error) {
      return responseError(paymentUpdate.error.message, 500)
    }

    const bookingUpdate = await supabase
      .from("bookings")
      .update({
        booking_status: "expired",
        payment_status: "failed",
        expires_at: booking.expires_at || timestamp,
      })
      .eq("id", booking.id)

    if (bookingUpdate.error) {
      return responseError(bookingUpdate.error.message, 500)
    }

    await supabase.from("payment_events").insert({
      payment_id: payment.id,
      event_name: "payment_expired",
      payload: {
        booking_code: booking.booking_code,
        source: "admin-payments-console",
        actor_role: auth.primaryRole,
      },
      status: "processed",
      processed_at: timestamp,
    })

    await supabase.from("booking_events").insert({
      booking_id: booking.id,
      actor_id: auth.user.id,
      event_type: "booking_expired",
      note: payload.note?.trim() || "Booking hết hạn do payment request chưa được hoàn tất.",
      event_data: {
        source: "tourbook-admin",
        actor_role: auth.primaryRole,
        payment_id: payment.id,
      },
    })

    if (booking.user_id) {
      await supabase.from("notifications").insert({
        user_id: booking.user_id,
        title: "Booking đã hết hạn thanh toán",
        content: `Booking ${booking.booking_code} đã hết hạn vì chưa hoàn tất thanh toán đúng thời gian giữ chỗ.`,
        notification_type: "booking",
        reference_type: "booking",
        reference_id: booking.id,
      })
    }

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      bookingCode: booking.booking_code,
      paymentRecordStatus: "expired",
      bookingStatus: "expired",
      bookingPaymentStatus: "failed",
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể xử lý payment.", 500)
  }
}
