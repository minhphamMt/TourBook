import { NextResponse } from "next/server"

import { canCustomerReplyTicket, getTicketStatusAfterCustomerReply } from "@/lib/customer-care-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type ReplyTicketPayload = {
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

    const { supabase, auth } = authResult
    if (auth.isManagement) {
      return responseError("Nhân sự quản trị hãy dùng luồng xử lý ticket trong trang admin.", 403)
    }

    const payload = (await request.json()) as ReplyTicketPayload
    const message = payload.message?.trim() || ""

    if (!payload.ticketId || !message) {
      return responseError("Thiếu ticketId hoặc nội dung phản hồi.")
    }

    const ticketResult = await supabase
      .from("support_tickets")
      .select("id,ticket_code,user_id,status,assigned_to")
      .eq("id", payload.ticketId)
      .maybeSingle()

    if (ticketResult.error) {
      return responseError(ticketResult.error.message, 500)
    }

    const ticket = ticketResult.data
    if (!ticket) {
      return responseError("Không tìm thấy ticket hỗ trợ.", 404)
    }

    if (ticket.user_id !== auth.user.id) {
      return responseError("Bạn không có quyền phản hồi ticket này.", 403)
    }

    if (!canCustomerReplyTicket(ticket.status) && ticket.status !== "closed") {
      return responseError("Ticket này không còn mở để tiếp tục trao đổi.")
    }

    const finalStatus = getTicketStatusAfterCustomerReply(ticket.status)

    if (finalStatus !== ticket.status) {
      const updateResult = await supabase
        .from("support_tickets")
        .update({
          status: finalStatus,
          closed_at: null,
          assigned_to: null,
        })
        .eq("id", ticket.id)

      if (updateResult.error) {
        return responseError(updateResult.error.message, 500)
      }
    }

    const messageResult = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: auth.user.id,
      sender_type: "customer",
      message,
      attachments_jsonb: [],
    })

    if (messageResult.error) {
      return responseError(messageResult.error.message, 500)
    }

    if (ticket.assigned_to) {
      await supabase.from("notifications").insert({
        user_id: ticket.assigned_to,
        title: finalStatus === "open" && ticket.status !== "open" ? "Ticket cần xử lý lại" : "Ticket có phản hồi mới",
        content: `Khách hàng vừa phản hồi thêm vào ticket ${ticket.ticket_code}.`,
        notification_type: "ticket",
        reference_type: "support_ticket",
        reference_id: ticket.id,
      })
    }

    return NextResponse.json({
      ok: true,
      ticketId: ticket.id,
      status: finalStatus,
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể phản hồi ticket.", 500)
  }
}
