export function canCustomerReviewBooking(bookingStatus: string) {
  return bookingStatus === "completed"
}

export function isTicketActive(status: string) {
  return ["open", "in_progress", "resolved"].includes(status)
}

export function canCustomerReplyTicket(status: string) {
  return isTicketActive(status)
}

export function canStaffReplyTicket(status: string) {
  return status !== "closed"
}

export function getTicketStatusAfterCustomerReply(status: string) {
  if (status === "resolved") {
    return "open"
  }

  return status
}

export function getTicketStatusAfterStaffReply(status: string) {
  if (status === "open") {
    return "in_progress"
  }

  return status
}

export function getAllowedStaffTicketTransitions(status: string) {
  switch (status) {
    case "open":
      return ["in_progress", "resolved", "closed"]
    case "in_progress":
      return ["open", "resolved", "closed"]
    case "resolved":
      return ["open", "in_progress", "closed"]
    case "closed":
      return ["open"]
    default:
      return []
  }
}

export function getReviewStatusDescription(status: string) {
  if (status === "approved") {
    return "Review của bạn đã được duyệt và đang hiển thị trên hệ thống."
  }

  if (status === "hidden") {
    return "Review hiện đang bị ẩn khỏi giao diện công khai. Bạn có thể chỉnh sửa lại để gửi duyệt lần nữa."
  }

  return "Review đang chờ đội ngũ The Horizon kiểm duyệt trước khi hiển thị."
}

export function getSupportStatusDescription(status: string) {
  if (status === "in_progress") {
    return "Đội ngũ hỗ trợ đang xử lý ticket này."
  }

  if (status === "resolved") {
    return "Ticket đã được xử lý. Nếu cần bổ sung thông tin, khách hàng có thể phản hồi để mở lại."
  }

  if (status === "closed") {
    return "Ticket đã đóng và không nhận thêm tin nhắn. Cần mở lại ticket hoặc tạo yêu cầu mới để tiếp tục trao đổi."
  }

  return "Ticket đã được ghi nhận và đang chờ nhân sự tiếp nhận."
}
