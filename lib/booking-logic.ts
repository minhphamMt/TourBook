type BookingFlowState = {
  bookingStatus: string
  paymentStatus: string
}

const payableBookingStatuses = ["pending", "awaiting_payment", "confirmed"]
const payablePaymentStatuses = ["unpaid", "pending", "partially_paid"]
const customerCancelableStatuses = ["pending", "awaiting_payment", "confirmed"]
const recognizedSpendStatuses = ["confirmed", "completed"]
const settledPaymentStatuses = ["paid", "partially_paid"]

export function canMarkBookingPaid({ bookingStatus, paymentStatus }: BookingFlowState) {
  return payableBookingStatuses.includes(bookingStatus) && payablePaymentStatuses.includes(paymentStatus)
}

export function getCancellationMode({ bookingStatus, paymentStatus }: BookingFlowState) {
  if (!customerCancelableStatuses.includes(bookingStatus) || bookingStatus === "cancel_requested") {
    return "blocked" as const
  }

  if (["paid", "partially_paid"].includes(paymentStatus)) {
    return "request_approval" as const
  }

  return "direct_cancel" as const
}

export function canResolveCancellationRequest({ bookingStatus }: BookingFlowState) {
  return bookingStatus === "cancel_requested"
}

export function getRejectedCancellationStatus(paymentStatus: string) {
  if (["paid", "partially_paid"].includes(paymentStatus)) {
    return "confirmed"
  }

  if (paymentStatus === "pending") {
    return "awaiting_payment"
  }

  return "pending"
}

export function getApprovedRefundPaymentStatus(paymentStatus: string) {
  if (paymentStatus === "paid") {
    return "refunded"
  }

  if (paymentStatus === "partially_paid") {
    return "partially_refunded"
  }

  return paymentStatus
}

export function countsAsOpenBooking({ bookingStatus }: BookingFlowState) {
  return ["pending", "awaiting_payment", "confirmed"].includes(bookingStatus)
}

export function countsAsRecognizedSpend({ bookingStatus, paymentStatus }: BookingFlowState) {
  return recognizedSpendStatuses.includes(bookingStatus) && settledPaymentStatuses.includes(paymentStatus)
}
