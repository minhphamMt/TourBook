type BookingFlowState = {
  bookingStatus: string
  paymentStatus: string
}

type PaymentFlowState = BookingFlowState & {
  paymentRecordStatus: string
}

const payableBookingStatuses = ["pending", "awaiting_payment", "confirmed"]
const payablePaymentStatuses = ["unpaid", "pending", "partially_paid"]
const customerCancelableStatuses = ["pending", "awaiting_payment", "confirmed"]
const recognizedSpendStatuses = ["confirmed", "completed"]
const settledPaymentStatuses = ["paid", "partially_paid"]
const actionablePaymentRecordStatuses = ["pending", "authorized"]
const closedPaymentRecordStatuses = ["paid", "failed", "cancelled", "expired", "refunded", "partially_refunded"]

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

export function needsBookingPaymentFollowUp({ bookingStatus, paymentStatus }: BookingFlowState) {
  return countsAsOpenBooking({ bookingStatus, paymentStatus }) && payablePaymentStatuses.includes(paymentStatus)
}

export function countsAsRecognizedSpend({ bookingStatus, paymentStatus }: BookingFlowState) {
  return recognizedSpendStatuses.includes(bookingStatus) && settledPaymentStatuses.includes(paymentStatus)
}

export function canConfirmPaymentRecord({ bookingStatus, paymentStatus, paymentRecordStatus }: PaymentFlowState) {
  return canMarkBookingPaid({ bookingStatus, paymentStatus }) && actionablePaymentRecordStatuses.includes(paymentRecordStatus)
}

export function canExpirePaymentRecord({ bookingStatus, paymentStatus, paymentRecordStatus }: PaymentFlowState) {
  return ["pending", "awaiting_payment"].includes(bookingStatus)
    && paymentStatus === "pending"
    && actionablePaymentRecordStatuses.includes(paymentRecordStatus)
}

export function needsPaymentOpsFollowUp({ bookingStatus, paymentStatus, paymentRecordStatus }: PaymentFlowState) {
  return canConfirmPaymentRecord({ bookingStatus, paymentStatus, paymentRecordStatus })
    || canExpirePaymentRecord({ bookingStatus, paymentStatus, paymentRecordStatus })
}

export function isClosedPaymentRecord(paymentRecordStatus: string) {
  return closedPaymentRecordStatuses.includes(paymentRecordStatus)
}
