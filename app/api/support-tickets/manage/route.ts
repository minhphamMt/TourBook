import { NextResponse } from "next/server"

import { getAllowedStaffTicketTransitions, getTicketStatusAfterStaffReply } from "@/lib/customer-care-logic"
import { requireRequestAuth } from "@/lib/request-auth"

type ManageTicketPayload = {
  ticketId?: string
  status?: "open" | "in_progress" | "resolved" | "closed"
  priority?: string
  message?: string
}

const ALLOWED_PRIORITIES = ["low", "normal", "high", "urgent"]

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
      return responseError("Chỉ nhân sự quản trị mới được xử lý ticket hỗ trợ.", 403)
    }

    const payload = (await request.json()) as ManageTicketPayload
    const requestedStatus = payload.status
    const nextPriority = payload.priority?.trim().toLowerCase() || null
    const message = payload.message?.trim() || ""

    if (!payload.ticketId || (!requestedStatus && !nextPriority && !message)) {
      return responseError("Thiếu ticketId hoặc thông tin cập nhật ticket.")
    }

    if (requestedStatus && !["open", "in_progress", "resolved", "closed"].includes(requestedStatus)) {
      return responseError("Trạng thái ticket không hợp lệ.")
    }

    if (nextPriority && !ALLOWED_PRIORITIES.includes(nextPriority)) {
      return responseError("Mức ưu tiên ticket không hợp lệ.")
    }

    const ticketResult = await supabase
      .from("support_tickets")
      .select("id,ticket_code,user_id,status,priority,assigned_to")
      .eq("id", payload.ticketId)
      .maybeSingle()

    if (ticketResult.error) {
      return responseError(ticketResult.error.message, 500)
    }

    const ticket = ticketResult.data
    if (!ticket) {
      return responseError("Không tìm thấy ticket hỗ trợ.", 404)
    }

    const finalStatus = requestedStatus || (message ? getTicketStatusAfterStaffReply(ticket.status) : ticket.status)
    if (finalStatus !== ticket.status && !getAllowedStaffTicketTransitions(ticket.status).includes(finalStatus)) {
      return responseError("Không thể chuyển ticket sang trạng thái này từ trạng thái hiện tại.")
    }

    const timestamp = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {}

    if (finalStatus !== ticket.status) {
      updatePayload.status = finalStatus
    }

    if (finalStatus === "open") {
      updatePayload.closed_at = null
      updatePayload.assigned_to = null
    }

    if (["in_progress", "resolved", "closed"].includes(finalStatus)) {
      updatePayload.assigned_to = auth.user.id
    }

    if (finalStatus === "closed") {
      updatePayload.closed_at = timestamp
    }

    if (finalStatus !== "closed" && finalStatus !== ticket.status) {
      updatePayload.closed_at = null
    }

    if (nextPriority) {
      updatePayload.priority = nextPriority
    }

    if (Object.keys(updatePayload).length) {
      const updateResult = await supabase
        .from("support_tickets")
        .update(updatePayload)
        .eq("id", ticket.id)

      if (updateResult.error) {
        return responseError(updateResult.error.message, 500)
      }
    }

    if (message) {
      const messageResult = await supabase.from("support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_id: auth.user.id,
        sender_type: "staff",
        message,
        attachments_jsonb: [],
      })

      if (messageResult.error) {
        return responseError(messageResult.error.message, 500)
      }
    }

    if (ticket.user_id) {
      const userTitle = finalStatus === "in_progress"
        ? "Ticket đang được xử lý"
        : finalStatus === "resolved"
          ? "Ticket đã được giải quyết"
          : finalStatus === "closed"
            ? "Ticket đã được đóng"
            : finalStatus === "open" && ticket.status !== "open"
              ? "Ticket đã được mở lại"
              : "Ticket đã được cập nhật"

      const userContent = message
        ? `Ticket ${ticket.ticket_code} vừa có phản hồi mới từ đội ngũ The Horizon.`
        : `Trạng thái ticket ${ticket.ticket_code} đã được cập nhật sang ${finalStatus}.`

      await supabase.from("notifications").insert({
        user_id: ticket.user_id,
        title: userTitle,
        content: userContent,
        notification_type: "ticket",
        reference_type: "support_ticket",
        reference_id: ticket.id,
      })
    }

    return NextResponse.json({
      ok: true,
      ticketId: ticket.id,
      status: finalStatus,
      priority: nextPriority || ticket.priority,
      replied: Boolean(message),
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể xử lý ticket hỗ trợ.", 500)
  }
}
