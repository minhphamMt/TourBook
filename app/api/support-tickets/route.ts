import { NextResponse } from "next/server"

import { isTicketActive } from "@/lib/customer-care-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type TicketPayload = {
  bookingId?: string | null
  subject?: string
  message?: string
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const payload = (await request.json()) as TicketPayload
    if (!payload.subject?.trim() || !payload.message?.trim()) {
      return NextResponse.json({ error: "Thiếu thông tin ticket." }, { status: 400 })
    }

    const { supabase, auth } = authResult

    if (payload.bookingId) {
      const bookingResult = await supabase
        .from("bookings")
        .select("id,user_id")
        .eq("id", payload.bookingId)
        .maybeSingle()

      if (bookingResult.error) {
        return NextResponse.json({ error: bookingResult.error.message }, { status: 500 })
      }

      if (!bookingResult.data || (!auth.isManagement && bookingResult.data.user_id !== auth.user.id)) {
        return NextResponse.json({ error: "Bạn không có quyền mở ticket cho booking này." }, { status: 403 })
      }

      const existingTicketResult = await supabase
        .from("support_tickets")
        .select("id,ticket_code,status")
        .eq("booking_id", payload.bookingId)
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })

      if (existingTicketResult.error) {
        return NextResponse.json({ error: existingTicketResult.error.message }, { status: 500 })
      }

      const activeTicket = (existingTicketResult.data || []).find((ticket) => isTicketActive(ticket.status))
      if (activeTicket) {
        return NextResponse.json(
          {
            error: `Booking này đang có ticket ${activeTicket.ticket_code} ở trạng thái ${activeTicket.status}. Hãy tiếp tục ticket hiện có thay vì mở ticket mới.`,
            ticket: activeTicket,
          },
          { status: 409 }
        )
      }
    }

    const ticketResult = await supabase
      .from("support_tickets")
      .insert({
        user_id: auth.user.id,
        booking_id: payload.bookingId || null,
        subject: payload.subject.trim(),
        status: "open",
        priority: payload.bookingId ? "normal" : "low",
      })
      .select("id,ticket_code,subject,status")
      .single()

    if (ticketResult.error || !ticketResult.data) {
      return NextResponse.json({ error: ticketResult.error?.message || "Không thể tạo support ticket." }, { status: 500 })
    }

    const messageResult = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticketResult.data.id,
      sender_id: auth.user.id,
      sender_type: auth.isManagement ? "staff" : "customer",
      message: payload.message.trim(),
      attachments_jsonb: [],
    })

    if (messageResult.error) {
      return NextResponse.json({ error: messageResult.error.message }, { status: 500 })
    }

    await supabase.from("notifications").insert({
      user_id: auth.user.id,
      title: "Ticket hỗ trợ đã được tạo",
      content: `Ticket ${ticketResult.data.ticket_code} đã được ghi nhận.`,
      notification_type: "ticket",
      reference_type: "support_ticket",
      reference_id: ticketResult.data.id,
    })

    return NextResponse.json({ ok: true, ticket: ticketResult.data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể tạo support ticket." }, { status: 500 })
  }
}
