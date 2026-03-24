"use client"

import { startTransition, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, LifeBuoy, MessageSquareQuote, XCircle } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { StatusPill } from "@/components/site/status-pill"
import { Button } from "@/components/ui/button"
import {
  canCustomerReplyTicket,
  canCustomerReviewBooking,
  getReviewStatusDescription,
  getSupportStatusDescription,
  isTicketActive,
} from "@/lib/customer-care-logic"
import { canMarkBookingPaid, getCancellationMode } from "@/lib/booking-logic"
import { formatCurrency, normalizeSearch } from "@/lib/format"

type BookingActionTicket = {
  id: string
  ticket_code: string
  subject: string
  status: string
}

type BookingActionReview = {
  id: string
  rating: number
  comment: string | null
  status: string
  replyText?: string | null
} | null

export function BookingActions({
  bookingId,
  bookingCode,
  bookingStatus,
  paymentStatus,
  totalAmount,
  review,
  tickets,
}: {
  bookingId: string
  bookingCode: string
  bookingStatus: string
  paymentStatus: string
  totalAmount: number
  review: BookingActionReview
  tickets: BookingActionTicket[]
}) {
  const router = useRouter()
  const { session, user } = useAuth()
  const [cancelReason, setCancelReason] = useState("")
  const [ticketSubject, setTicketSubject] = useState(`Hỗ trợ booking ${bookingCode}`)
  const [ticketMessage, setTicketMessage] = useState("")
  const [rating, setRating] = useState(review?.rating || 5)
  const [comment, setComment] = useState(review?.comment || "")
  const [status, setStatus] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const authenticatedJsonHeaders: Record<string, string> = session?.access_token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }
    : { "Content-Type": "application/json" }
  const canUseAuthenticatedActions = !!user && !!session?.access_token
  const canPay = canUseAuthenticatedActions && canMarkBookingPaid({ bookingStatus, paymentStatus })
  const cancellationMode = getCancellationMode({ bookingStatus, paymentStatus })
  const canCancel = canUseAuthenticatedActions && cancellationMode !== "blocked"
  const canReview = canUseAuthenticatedActions && canCustomerReviewBooking(bookingStatus)
  const activeTicket = useMemo(() => tickets.find((ticket) => isTicketActive(ticket.status)) || null, [tickets])
  const latestTicket = tickets[0] || null

  useEffect(() => {
    setRating(review?.rating || 5)
    setComment(review?.comment || "")
  }, [review?.comment, review?.id, review?.rating])

  useEffect(() => {
    setTicketSubject(activeTicket?.subject || `Hỗ trợ booking ${bookingCode}`)
  }, [activeTicket?.id, activeTicket?.subject, bookingCode])

  const cancelDescription = useMemo(() => {
    if (bookingStatus === "cancel_requested") {
      return "Booking này đang chờ đội ngũ vận hành duyệt yêu cầu hủy. Trong lúc đó hệ thống sẽ khóa các thao tác thanh toán mới."
    }

    if (cancellationMode === "request_approval") {
      return "Booking đã ghi nhận thanh toán hoặc tiền cọc. Yêu cầu của bạn sẽ chuyển sang trạng thái chờ duyệt hủy."
    }

    if (cancellationMode === "direct_cancel") {
      return "Booking chưa ghi nhận thanh toán, nên bạn có thể hủy ngay mà không cần chờ duyệt."
    }

    return "Booking này không còn hợp lệ để hủy thêm ở thời điểm hiện tại."
  }, [bookingStatus, cancellationMode])

  const supportDescription = useMemo(() => {
    if (activeTicket) {
      return `Ticket ${activeTicket.ticket_code} đang hoạt động. Nội dung mới của bạn sẽ được nối tiếp vào cùng ticket để đội ngũ hỗ trợ xử lý liên tục.`
    }

    if (latestTicket) {
      return `Ticket gần nhất là ${latestTicket.ticket_code}. ${getSupportStatusDescription(latestTicket.status)}`
    }

    return "Bạn có thể mở ticket hỗ trợ cho booking này. Ticket đầu tiên sẽ vào trạng thái mở để đội ngũ The Horizon tiếp nhận."
  }, [activeTicket, latestTicket])

  const runAction = async (callback: () => Promise<Response>, successMessage: string) => {
    setIsWorking(true)
    setStatus(null)

    try {
      const response = await callback()
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Action failed")
      }

      setStatus(successMessage)
      setTicketMessage("")
      startTransition(() => {
        router.refresh()
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Đã xảy ra lỗi.")
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="surface-panel p-6">
        <div className="text-xl font-black tracking-tight text-slate-950">Tác vụ booking</div>

        {status ? (
          <div className={`mt-5 rounded-[1.5rem] px-4 py-4 text-sm ${["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {status}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.6rem] bg-slate-50 p-5">
            <div className="flex items-center gap-3 font-bold text-slate-950">
              <CreditCard className="size-4 text-sky-600" />
              Thanh toán booking
            </div>
            <div className="mt-4 text-2xl font-black tracking-tight text-sky-700">{formatCurrency(totalAmount)}</div>
            <Button
              disabled={!canPay || isWorking}
              onClick={() => runAction(() => fetch("/api/bookings/payment", {
                method: "POST",
                headers: authenticatedJsonHeaders,
                body: JSON.stringify({ bookingCode }),
              }), "Đã cập nhật thanh toán thành công.")}
              className="mt-4 w-full rounded-full bg-sky-600 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canPay ? "Thanh toán ngay" : "Không thể thanh toán"}
            </Button>
          </div>

          <div className="rounded-[1.6rem] bg-slate-50 p-5">
            <div className="flex items-center gap-3 font-bold text-slate-950">
              <XCircle className="size-4 text-orange-500" />
              Hủy booking
            </div>
            <div className="mt-2 text-sm leading-7 text-slate-500">{cancelDescription}</div>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Lý do hủy booking"
              className="mt-4 min-h-24 w-full rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
            <Button
              disabled={!canCancel || isWorking}
              onClick={() => runAction(() => fetch("/api/bookings/cancel", {
                method: "POST",
                headers: authenticatedJsonHeaders,
                body: JSON.stringify({ bookingCode, reason: cancelReason }),
              }), cancellationMode === "request_approval" ? "Đã gửi yêu cầu hủy booking." : "Booking đã được hủy.")}
              className="mt-4 w-full rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bookingStatus === "cancel_requested"
                ? "Đang chờ duyệt hủy"
                : cancellationMode === "request_approval"
                  ? "Gửi yêu cầu hủy"
                  : cancellationMode === "direct_cancel"
                    ? "Hủy booking ngay"
                    : "Không thể hủy"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-slate-950">
            <LifeBuoy className="size-5 text-sky-600" />
            <div className="text-xl font-black tracking-tight">Hỗ trợ booking</div>
          </div>
          <div className="mt-2 text-sm text-slate-500">{supportDescription}</div>

          {activeTicket ? (
            <div className="mt-4 flex items-center gap-3 rounded-[1.4rem] bg-sky-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-bold text-slate-950">{activeTicket.ticket_code}</span>
              <StatusPill status={activeTicket.status} />
            </div>
          ) : latestTicket ? (
            <div className="mt-4 flex items-center gap-3 rounded-[1.4rem] bg-slate-100 px-4 py-3 text-sm text-slate-600">
              <span className="font-bold text-slate-950">{latestTicket.ticket_code}</span>
              <StatusPill status={latestTicket.status} />
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            <input
              value={ticketSubject}
              onChange={(event) => setTicketSubject(event.target.value)}
              disabled={!!activeTicket}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-4 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Chủ đề ticket"
            />
            <textarea
              value={ticketMessage}
              onChange={(event) => setTicketMessage(event.target.value)}
              className="min-h-28 w-full rounded-[1.4rem] border border-slate-200 bg-slate-100/80 px-4 py-4 text-sm outline-none"
              placeholder={activeTicket ? "Bổ sung thêm thông tin cho ticket hiện tại" : "Nội dung cần hỗ trợ"}
            />
            <Button
              disabled={!canUseAuthenticatedActions || !ticketMessage.trim() || isWorking || (!!activeTicket && !canCustomerReplyTicket(activeTicket.status))}
              onClick={() => runAction(
                () => fetch(activeTicket ? "/api/support-tickets/reply" : "/api/support-tickets", {
                  method: "POST",
                  headers: authenticatedJsonHeaders,
                  body: JSON.stringify(activeTicket ? { ticketId: activeTicket.id, message: ticketMessage } : { bookingId, subject: ticketSubject, message: ticketMessage }),
                }),
                activeTicket ? `Đã gửi thêm phản hồi vào ticket ${activeTicket.ticket_code}.` : "Đã tạo ticket hỗ trợ mới."
              )}
              className="rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {activeTicket ? "Gửi bổ sung vào ticket hiện tại" : "Mở ticket hỗ trợ"}
            </Button>
          </div>
        </div>

        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-slate-950">
            <MessageSquareQuote className="size-5 text-orange-500" />
            <div className="text-xl font-black tracking-tight">Đánh giá sau chuyến đi</div>
          </div>

          {review ? (
            <div className="mt-4 rounded-[1.4rem] bg-orange-50 px-4 py-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={review.status} />
                <span className="font-bold text-slate-950">{review.rating}/5</span>
              </div>
              <div className="mt-3">{getReviewStatusDescription(review.status)}</div>
              {review.replyText ? (
                <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3 text-slate-600">
                  <div className="font-bold text-slate-950">Phản hồi từ The Horizon</div>
                  <div className="mt-2 leading-7">{review.replyText}</div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${rating === value ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {value} sao
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="min-h-28 w-full rounded-[1.4rem] border border-slate-200 bg-slate-100/80 px-4 py-4 text-sm outline-none" placeholder="Chia sẻ trải nghiệm của bạn..." />
            <Button
              disabled={!canReview || isWorking}
              onClick={() => runAction(() => fetch("/api/reviews", {
                method: "POST",
                headers: authenticatedJsonHeaders,
                body: JSON.stringify({ bookingId, rating, comment }),
              }), review ? "Đã cập nhật review, hệ thống sẽ duyệt lại nội dung mới." : "Đã gửi review, đang chờ duyệt.")}
              className="rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {canReview ? (review ? "Cập nhật review" : "Gửi review") : "Chưa thể đánh giá"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
