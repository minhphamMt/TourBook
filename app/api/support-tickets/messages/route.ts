import { NextResponse } from "next/server"

import { canCustomerReplyTicket, canStaffReplyTicket, getTicketStatusAfterCustomerReply } from "@/lib/customer-care-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type MessagePayload = {
  ticketId?: string
  message?: string
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

    const payload = (await request.json()) as MessagePayload
    const message = payload.message?.trim() || ""

    if (!payload.ticketId || !message) {
      return responseError("Thiếu thông tin phản hồi.")
    }

    const { supabase, auth } = authResult
    const ticketResult = await supabase
      .from("support_tickets")
      .select("id,status,user_id")
      .eq("id", payload.ticketId)
      .maybeSingle()

    if (ticketResult.error || !ticketResult.data) {
      return responseError("Không tìm thấy ticket.", 404)
    }

    const ticket = ticketResult.data
    if (!auth.isManagement && ticket.user_id !== auth.user.id) {
      return responseError("Không có quyền phản hồi ticket này.", 403)
    }

    if (auth.isManagement) {
      if (!canStaffReplyTicket(ticket.status)) {
        return responseError("Ticket đã đóng. Hãy mở lại trước khi gửi tin nhắn.")
      }
    } else if (!canCustomerReplyTicket(ticket.status)) {
      return responseError("Ticket này đã đóng, bạn không thể gửi thêm tin nhắn.")
    }

    const messageResult = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: auth.user.id,
      sender_type: auth.isManagement ? "staff" : "customer",
      message,
      attachments_jsonb: [],
    })

    if (messageResult.error) {
      return responseError(messageResult.error.message, 500)
    }

    if (!auth.isManagement) {
      const nextStatus = getTicketStatusAfterCustomerReply(ticket.status)
      if (nextStatus !== ticket.status) {
        await supabase
          .from("support_tickets")
          .update({
            status: nextStatus,
            closed_at: null,
            assigned_to: null,
          })
          .eq("id", ticket.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Đã xảy ra lỗi hệ thống.", 500)
  }
}
