import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, Clock3, MapPin, ReceiptText, Users } from "lucide-react"

import { BookingActions } from "@/components/site/booking-actions"
import { StatusPill } from "@/components/site/status-pill"
import { Button } from "@/components/ui/button"
import { getReviewStatusDescription, getSupportStatusDescription } from "@/lib/customer-care-logic"
import { formatCurrency, formatDateTime, formatLongDate, statusLabel } from "@/lib/format"
import { getSiteCatalog } from "@/lib/site-data"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

export const dynamic = "force-dynamic"

type Params = Promise<{ code: string }>

export default async function BookingDetailPage({ params }: { params: Params }) {
  const { code } = await params
  const supabase = getSupabaseServerClient()

  const bookingResult = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_code", code)
    .maybeSingle()

  if (bookingResult.error) {
    throw new Error(bookingResult.error.message)
  }

  const booking = bookingResult.data
  if (!booking) {
    notFound()
  }

  const [catalog, travelersResult, priceLinesResult, paymentsResult, eventsResult, invoiceResult, ticketsResult, reviewResult] = await Promise.all([
    getSiteCatalog(),
    supabase.from("booking_travelers").select("*").eq("booking_id", booking.id).order("created_at"),
    supabase.from("booking_price_lines").select("*").eq("booking_id", booking.id).order("created_at"),
    supabase.from("payments").select("*").eq("booking_id", booking.id).order("created_at", { ascending: false }),
    supabase.from("booking_events").select("*").eq("booking_id", booking.id).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("booking_id", booking.id).maybeSingle(),
    supabase.from("support_tickets").select("id,ticket_code,subject,status,priority,created_at").eq("booking_id", booking.id).order("created_at", { ascending: false }),
    supabase.from("reviews").select("id,status,rating,comment").eq("booking_id", booking.id).maybeSingle(),
  ])

  const travelers = travelersResult.data || []
  const priceLines = priceLinesResult.data || []
  const payments = paymentsResult.data || []
  const events = eventsResult.data || []
  const invoice = invoiceResult.data || null
  const tickets = ticketsResult.data || []
  const review = reviewResult.data || null

  const reviewReplyResult = review
    ? await supabase.from("review_replies").select("reply_text").eq("review_id", review.id).maybeSingle()
    : { data: null, error: null }

  if (reviewReplyResult.error) {
    throw new Error(reviewReplyResult.error.message)
  }

  const reviewReply = reviewReplyResult.data || null

  const actorIds = Array.from(new Set(events.map((event) => event.actor_id).filter(Boolean))) as string[]
  const actorProfilesResult = actorIds.length
    ? await supabase.from("profiles").select("id,full_name,email").in("id", actorIds)
    : { data: [], error: null }

  const actorMap = new Map((actorProfilesResult.data || []).map((item) => [item.id, item]))
  const tour = catalog.tours.find((item) => item.id === booking.tour_id)
  const schedule = tour?.schedules.find((item) => item.id === booking.schedule_id)

  return (
    <div className="page-container py-12">
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/" className="transition hover:text-slate-700">Trang chủ</Link>
        <span>/</span>
        <Link href="/account" className="transition hover:text-slate-700">Tài khoản</Link>
        <span>/</span>
        <span className="text-sky-700">{booking.booking_code}</span>
      </div>

      <section className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="surface-panel overflow-hidden p-0">
            <div className="relative aspect-[16/6] overflow-hidden">
              <Image
                src={tour?.coverImage || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80"}
                alt={tour?.name || booking.booking_code}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={booking.booking_status} />
                  <StatusPill status={booking.payment_status} />
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">Mã đặt chỗ {booking.booking_code}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" />{schedule ? formatLongDate(schedule.departureDate) : "Đang cập nhật"}</span>
                  <span className="inline-flex items-center gap-2"><Clock3 className="size-4" />{tour?.durationLabel || "Lịch trình tour"}</span>
                  <span className="inline-flex items-center gap-2"><MapPin className="size-4" />{tour?.destinationLabel || "Đang cập nhật"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="surface-panel p-6">
              <div className="text-sm text-slate-400">Liên hệ</div>
              <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{booking.contact_name}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>{booking.contact_email}</div>
                <div>{booking.contact_phone}</div>
                <div>Tạo lúc {formatDateTime(booking.created_at)}</div>
              </div>
            </div>
            <div className="surface-panel p-6">
              <div className="text-sm text-slate-400">Tổng thanh toán</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-sky-700">{formatCurrency(booking.total_amount)}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>Tạm tính: {formatCurrency(booking.subtotal_amount)}</div>
                <div>Giảm giá: -{formatCurrency(booking.discount_amount)}</div>
                <div>Tiền tệ: {booking.currency}</div>
              </div>
            </div>
            <div className="surface-panel p-6">
              <div className="text-sm text-slate-400">Hành khách</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{booking.adult_count + booking.child_count + booking.infant_count}</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>Người lớn: {booking.adult_count}</div>
                <div>Trẻ em: {booking.child_count}</div>
                <div>Em bé: {booking.infant_count}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="surface-panel p-6">
              <div className="mb-5 flex items-center gap-3">
                <Users className="size-5 text-sky-600" />
                <div className="text-2xl font-black tracking-tight text-slate-950">Danh sách hành khách</div>
              </div>
              <div className="space-y-4">
                {travelers.map((traveler) => (
                  <div key={traveler.id} className="rounded-[1.6rem] bg-slate-50 p-5 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-slate-950">{traveler.full_name}</div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{traveler.traveler_type}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>Email: {traveler.email || "-"}</div>
                      <div>Điện thoại: {traveler.phone || "-"}</div>
                      <div>Quốc tịch: {traveler.nationality || "-"}</div>
                      <div>Giá: {formatCurrency(traveler.price_amount || 0)}</div>
                    </div>
                    {traveler.special_request ? <div className="mt-3 text-slate-500">Yêu cầu: {traveler.special_request}</div> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface-panel p-6">
              <div className="mb-5 flex items-center gap-3">
                <ReceiptText className="size-5 text-orange-500" />
                <div className="text-2xl font-black tracking-tight text-slate-950">Chi tiết giá và thanh toán</div>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                {priceLines.map((line) => (
                  <div key={line.id} className="flex items-center justify-between gap-4 rounded-[1.2rem] bg-slate-50 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-950">{line.label}</div>
                      <div className="text-xs text-slate-400">{statusLabel(line.line_type)} x {line.quantity}</div>
                    </div>
                    <div className="text-right font-semibold text-slate-950">{formatCurrency(line.total_amount)}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="text-sm text-slate-400">Thanh toán</div>
                <div className="mt-4 space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="rounded-[1.3rem] border border-slate-200 px-4 py-4 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-bold text-slate-950">{payment.provider_name || "Thanh toán"}</div>
                        <StatusPill status={payment.status} />
                      </div>
                      <div className="mt-2">Số tiền: {formatCurrency(payment.amount)}</div>
                      <div className="mt-1">Yêu cầu lúc: {formatDateTime(payment.requested_at)}</div>
                      {payment.paid_at ? <div className="mt-1">Thanh toán lúc: {formatDateTime(payment.paid_at)}</div> : null}
                    </div>
                  ))}
                </div>
              </div>

              {invoice ? (
                <div className="mt-6 rounded-[1.5rem] bg-sky-50 px-4 py-4 text-sm text-slate-600">
                  <div className="font-bold text-slate-950">Hóa đơn {invoice.invoice_number}</div>
                  <div className="mt-2">Email nhận hóa đơn: {invoice.billing_email || "-"}</div>
                  <div className="mt-1">Xuất lúc: {invoice.issued_at ? formatDateTime(invoice.issued_at) : "Đang cập nhật"}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="surface-panel p-6">
            <div className="text-2xl font-black tracking-tight text-slate-950">Lịch sử booking</div>
            <div className="mt-6 space-y-4">
              {events.map((event) => (
                <div key={event.id} className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-600">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-950">{statusLabel(event.event_type)}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{actorMap.get(event.actor_id)?.full_name || actorMap.get(event.actor_id)?.email || "Hệ thống / khách hàng"}</div>
                    </div>
                    <div className="text-xs text-slate-400">{formatDateTime(event.created_at)}</div>
                  </div>
                  {event.note ? <div className="mt-3 leading-7">{event.note}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-28 xl:self-start">
          <div className="surface-panel p-6">
            <div className="text-xl font-black tracking-tight text-slate-950">Thông tin tour</div>
            <div className="mt-4 text-sm text-slate-600">
              <div className="font-bold text-slate-950">{tour?.name || booking.snapshot_jsonb?.tour_name || "Hành trình The Horizon"}</div>
              {schedule ? (
                <div className="mt-3 space-y-2">
                  <div>Khởi hành: {formatLongDate(schedule.departureDate)}</div>
                  <div>Về: {formatLongDate(schedule.returnDate)}</div>
                  <div>Điểm hẹn: {schedule.meetingPoint}</div>
                  <div>Số chỗ còn lại tại thời điểm tải dữ liệu: {schedule.availableSlots}</div>
                </div>
              ) : null}
            </div>
            <div className="mt-6 grid gap-3">
              {tour ? (
                <Button asChild className="rounded-full bg-sky-600 text-white hover:bg-sky-700">
                  <Link href={`/tours/${tour.slug}`}>Xem lại tour</Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/account">Mở trang tài khoản</Link>
              </Button>
            </div>
          </div>

          <div className="surface-panel p-6">
            <div className="text-xl font-black tracking-tight text-slate-950">Trạng thái đánh giá</div>
            {review ? (
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill status={review.status} />
                  <span className="font-bold text-slate-950">{review.rating}/5</span>
                </div>
                <div>{getReviewStatusDescription(review.status)}</div>
                {review.comment ? <div className="rounded-[1.3rem] bg-slate-50 px-4 py-4 leading-7">{review.comment}</div> : null}
                {reviewReply?.reply_text ? (
                  <div className="rounded-[1.3rem] bg-orange-50 px-4 py-4">
                    <div className="font-bold text-slate-950">Phản hồi từ The Horizon</div>
                    <div className="mt-2 leading-7">{reviewReply.reply_text}</div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 text-sm leading-7 text-slate-500">Sau khi hành trình hoàn thành, bạn có thể gửi đánh giá tại khung thao tác bên dưới.</div>
            )}
          </div>

          {tickets.length ? (
            <div className="surface-panel p-6">
              <div className="text-xl font-black tracking-tight text-slate-950">Ticket liên quan</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-[1.4rem] bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-bold text-slate-950">{ticket.ticket_code}</div>
                      <StatusPill status={ticket.status} />
                    </div>
                    <div className="mt-2 font-medium text-slate-950">{ticket.subject}</div>
                    <div className="mt-2 leading-7 text-slate-500">{getSupportStatusDescription(ticket.status)}</div>
                    <div className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">Ưu tiên: {ticket.priority}</div>
                    <div className="mt-1 text-xs text-slate-400">Tạo lúc: {formatDateTime(ticket.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <BookingActions
            bookingId={booking.id}
            bookingCode={booking.booking_code}
            bookingStatus={booking.booking_status}
            paymentStatus={booking.payment_status}
            totalAmount={booking.total_amount}
            review={review ? {
              id: review.id,
              rating: review.rating,
              comment: review.comment,
              status: review.status,
              replyText: reviewReply?.reply_text || null,
            } : null}
            tickets={tickets.map((ticket) => ({
              id: ticket.id,
              ticket_code: ticket.ticket_code,
              subject: ticket.subject,
              status: ticket.status,
            }))}
          />
        </aside>
      </section>
    </div>
  )
}
