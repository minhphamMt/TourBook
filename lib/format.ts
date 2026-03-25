export function formatCurrency(value: number | null | undefined, currency = "VND") {
  if (value == null || Number.isNaN(value)) {
    return "Liên hệ"
  }

  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatShortDate(value: string | Date | null | undefined) {
  if (!value) return "Chưa có lịch"

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value))
}

export function formatLongDate(value: string | Date | null | undefined) {
  if (!value) return "Chưa cập nhật"

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "Chưa cập nhật"

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatDuration(days: number, nights: number) {
  return `${days} ngày ${nights} đêm`
}

export function slugToLabel(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function average(numbers: number[]) {
  if (!numbers.length) return 0
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

export function compactText(value: string | null | undefined, fallback = "Đang cập nhật") {
  return value?.trim() || fallback
}

export function splitRichText(value: string | null | undefined) {
  if (!value) return []

  return value
    .split(/\n|,|\.|;/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeSearch(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .toLowerCase()
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Tạm giữ chỗ",
    awaiting_payment: "Chờ thanh toán",
    confirmed: "Đã xác nhận",
    completed: "Đã hoàn thành",
    cancel_requested: "Chờ hủy",
    cancelled: "Đã hủy",
    expired: "Hết hạn",
    unpaid: "Chưa thanh toán",
    partially_paid: "Đã cọc",
    paid: "Đã thanh toán",
    failed: "Thất bại",
    refunded: "Đã hoàn tiền",
    partially_refunded: "Hoàn tiền một phần",
    open: "Đang mở",
    sold_out: "Hết chỗ",
    closed: "Đã đóng",
    hidden: "Đã ẩn",
    approved: "Đã duyệt",
  }

  return map[status] || slugToLabel(status)
}
