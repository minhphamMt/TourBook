"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  FileClock,
  MessageSquareQuote,
  Shield,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import {
  adminRoleLabels,
  adminSectionMeta,
  canAccessAdminSection,
  getAdminMenuItem,
  getRoleCapabilitySummary,
  type AdminSectionKey,
} from "@/components/site/admin/admin-config"
import { StatusPill } from "@/components/site/status-pill"
import { Button } from "@/components/ui/button"
import { canMarkBookingPaid, canResolveCancellationRequest, countsAsRecognizedSpend } from "@/lib/booking-logic"
import { getAllowedStaffTicketTransitions, getSupportStatusDescription } from "@/lib/customer-care-logic"
import { formatCurrency, formatDateTime, normalizeSearch, statusLabel } from "@/lib/format"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type AdminBooking = {
  id: string
  booking_code: string
  total_amount: number
  booking_status: string
  payment_status: string
  created_at: string
}

type AdminPayment = {
  id: string
  booking_id: string
  provider_name: string | null
  amount: number
  status: string
  requested_at: string
}

type AdminReview = {
  id: string
  booking_id: string
  rating: number
  status: string
  comment: string | null
  created_at: string
  reply_text?: string | null
}

type AdminTicket = {
  id: string
  ticket_code: string
  subject: string
  status: string
  priority: string
  created_at: string
}

type AdminTicketMessage = {
  id: string
  ticket_id: string
  sender_type: string
  message: string
  created_at: string
}

type AdminActivity = {
  id: string
  action: string
  entity_type: string
  created_at: string
}

type AdminTour = {
  id: string
  name: string
  status: string
  is_featured: boolean
}

type SystemCounts = {
  bookings: number
  payments: number
  reviews: number
  tickets: number
  tours: number
  activities: number
}
function AdminPageHeader({
  eyebrow,
  title,
  description,
  primaryRole,
  rightSlot,
}: {
  eyebrow: string
  title: string
  description: string
  primaryRole: keyof typeof adminRoleLabels
  rightSlot?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-slate-500 sm:text-lg">{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="rounded-full border border-blue-100 bg-blue-50/90 px-5 py-3 text-sm font-semibold text-primary">Vai trò: {adminRoleLabels[primaryRole]}</div>
        <div className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600">Sidebar trái đã tách module theo từng nghiệp vụ</div>
        {rightSlot}
      </div>
    </div>
  )
}

function AdminPanel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon className="size-5 text-sky-600" />
          <div className="text-2xl font-black tracking-tight text-slate-950">{title}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function AdminMetricCard({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "primary" | "accent" }) {
  const toneClass = tone === "primary" ? "text-sky-700" : tone === "accent" ? "text-orange-500" : "text-slate-950"

  return (
    <div className="surface-panel p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className={`mt-2 text-4xl font-black tracking-tight ${toneClass}`}>{value}</div>
    </div>
  )
}

function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
      <div className="text-lg font-black tracking-tight text-slate-950">{title}</div>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">{description}</p>
    </div>
  )
}

function AdminLoadingState() {
  return <div className="surface-panel p-8 text-slate-500">Đang tải module quản trị...</div>
}

function AdminDeniedState({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface-panel p-8 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <ShieldAlert className="size-6" />
      </div>
      <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
      <p className="mx-auto mt-3 max-w-3xl text-slate-500">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild className="rounded-full bg-sky-600 text-white hover:bg-sky-700">
          <Link href="/admin">Về dashboard</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
          <Link href="/login?redirect=/admin">Đăng nhập lại</Link>
        </Button>
      </div>
    </div>
  )
}

export function AdminSectionPage({ section }: { section: AdminSectionKey }) {
  const { initialized, session, user, isManagement, primaryRole } = useAuth()
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [reviewReplyDrafts, setReviewReplyDrafts] = useState<Record<string, string>>({})
  const [ticketReplyDrafts, setTicketReplyDrafts] = useState<Record<string, string>>({})
  const [ticketMessagesByTicket, setTicketMessagesByTicket] = useState<Record<string, AdminTicketMessage[]>>({})
  const [activities, setActivities] = useState<AdminActivity[]>([])
  const [tours, setTours] = useState<AdminTour[]>([])
  const [systemCounts, setSystemCounts] = useState<SystemCounts>({
    bookings: 0,
    payments: 0,
    reviews: 0,
    tickets: 0,
    tours: 0,
    activities: 0,
  })
  const menuItem = getAdminMenuItem(section) || getAdminMenuItem("overview")
  const meta = adminSectionMeta[section]
  const hasSectionAccess = !!user && isManagement && !!menuItem && canAccessAdminSection(primaryRole, menuItem.allowedRoles)
  const hasErrorTone = status ? ["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) : false
  const authenticatedJsonHeaders: Record<string, string> = session?.access_token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }
    : { "Content-Type": "application/json" }

  const stats = useMemo(() => {
    const recognizedBookings = bookings.filter((booking) => countsAsRecognizedSpend({
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
    }))
    const totalRevenue = recognizedBookings.reduce((sum, booking) => sum + booking.total_amount, 0)
    const averageRating = reviews.length ? (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1) : "0.0"

    return {
      totalRevenue,
      pendingPayments: bookings.filter((booking) => canMarkBookingPaid({
        bookingStatus: booking.booking_status,
        paymentStatus: booking.payment_status,
      })).length,
      completedBookings: bookings.filter((booking) => booking.booking_status === "completed").length,
      canceledBookings: bookings.filter((booking) => booking.booking_status === "cancelled").length,
      pendingCancellationReviews: bookings.filter((booking) => booking.booking_status === "cancel_requested").length,
      pendingReviews: reviews.filter((review) => review.status === "pending").length,
      approvedReviews: reviews.filter((review) => review.status === "approved").length,
      openTickets: tickets.filter((ticket) => ["open", "in_progress"].includes(ticket.status)).length,
      highPriorityTickets: tickets.filter((ticket) => ["high", "urgent"].includes((ticket.priority || "").toLowerCase())).length,
      featuredTours: tours.filter((tour) => tour.is_featured).length,
      publishedTours: tours.filter((tour) => tour.status === "published").length,
      activityEntities: new Set(activities.map((activity) => activity.entity_type)).size,
      averageRating,
    }
  }, [activities, bookings, reviews, tickets, tours])

  const loadSectionData = useCallback(async () => {
    setLoading(true)
    setStatus(null)

    try {
      if (section === "overview") {
        const [bookingsResult, paymentsResult, reviewsResult, ticketsResult, activitiesResult, toursResult] = await Promise.all([
          supabase.from("bookings").select("id,booking_code,total_amount,booking_status,payment_status,created_at").order("created_at", { ascending: false }).limit(8),
          supabase.from("payments").select("id,booking_id,provider_name,amount,status,requested_at").order("requested_at", { ascending: false }).limit(6),
          supabase.from("reviews").select("id,booking_id,rating,status,comment,created_at").order("created_at", { ascending: false }).limit(6),
          supabase.from("support_tickets").select("id,ticket_code,subject,status,priority,created_at").order("created_at", { ascending: false }).limit(6),
          supabase.from("activity_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(6),
          supabase.from("tours").select("id,name,status,is_featured").order("published_at", { ascending: false }).limit(6),
        ])

        setBookings((bookingsResult.data || []) as AdminBooking[])
        setPayments((paymentsResult.data || []) as AdminPayment[])
        setReviews((reviewsResult.data || []) as AdminReview[])
        setTickets((ticketsResult.data || []) as AdminTicket[])
        setActivities((activitiesResult.data || []) as AdminActivity[])
        setTours((toursResult.data || []) as AdminTour[])
      }

      if (section === "bookings") {
        const { data } = await supabase
          .from("bookings")
          .select("id,booking_code,total_amount,booking_status,payment_status,created_at")
          .order("created_at", { ascending: false })
          .limit(24)
        setBookings((data || []) as AdminBooking[])
      }

      if (section === "payments") {
        const { data } = await supabase
          .from("payments")
          .select("id,booking_id,provider_name,amount,status,requested_at")
          .order("requested_at", { ascending: false })
          .limit(24)
        setPayments((data || []) as AdminPayment[])
      }

      if (section === "reviews") {
        const [reviewsResult, repliesResult] = await Promise.all([
          supabase
            .from("reviews")
            .select("id,booking_id,rating,status,comment,created_at")
            .order("created_at", { ascending: false })
            .limit(24),
          supabase.from("review_replies").select("review_id,reply_text"),
        ])

        const replyMap = new Map((repliesResult.data || []).map((reply) => [reply.review_id, reply.reply_text]))
        const reviewItems = ((reviewsResult.data || []) as AdminReview[]).map((review) => ({
          ...review,
          reply_text: replyMap.get(review.id) || null,
        }))

        setReviews(reviewItems)
        setReviewReplyDrafts(Object.fromEntries(reviewItems.map((review) => [review.id, review.reply_text || ""])))
      }

      if (section === "support") {
        const ticketsResult = await supabase
          .from("support_tickets")
          .select("id,ticket_code,subject,status,priority,created_at")
          .order("created_at", { ascending: false })
          .limit(24)

        if (ticketsResult.error) {
          throw ticketsResult.error
        }

        const ticketItems = (ticketsResult.data || []) as AdminTicket[]
        const ticketIds = ticketItems.map((ticket) => ticket.id)
        const messagesResult = ticketIds.length
          ? await supabase
              .from("support_ticket_messages")
              .select("id,ticket_id,sender_type,message,created_at")
              .in("ticket_id", ticketIds)
              .order("created_at", { ascending: true })
          : { data: [], error: null }

        if (messagesResult.error) {
          throw messagesResult.error
        }

        const groupedMessages = (messagesResult.data || []).reduce<Record<string, AdminTicketMessage[]>>((acc, message) => {
          const current = acc[message.ticket_id] || []
          current.push(message as AdminTicketMessage)
          acc[message.ticket_id] = current
          return acc
        }, {})

        setTickets(ticketItems)
        setTicketMessagesByTicket(groupedMessages)
        setTicketReplyDrafts(Object.fromEntries(ticketItems.map((ticket) => [ticket.id, ""])))
      }

      if (section === "tours") {
        const { data } = await supabase
          .from("tours")
          .select("id,name,status,is_featured")
          .order("published_at", { ascending: false })
          .limit(24)
        setTours((data || []) as AdminTour[])
      }

      if (section === "activity") {
        const { data } = await supabase
          .from("activity_logs")
          .select("id,action,entity_type,created_at")
          .order("created_at", { ascending: false })
          .limit(24)
        setActivities((data || []) as AdminActivity[])
      }

      if (section === "system") {
        const [bookingsCount, paymentsCount, reviewsCount, ticketsCount, toursCount, activitiesCount] = await Promise.all([
          supabase.from("bookings").select("id", { count: "exact", head: true }),
          supabase.from("payments").select("id", { count: "exact", head: true }),
          supabase.from("reviews").select("id", { count: "exact", head: true }),
          supabase.from("support_tickets").select("id", { count: "exact", head: true }),
          supabase.from("tours").select("id", { count: "exact", head: true }),
          supabase.from("activity_logs").select("id", { count: "exact", head: true }),
        ])

        setSystemCounts({
          bookings: bookingsCount.count || 0,
          payments: paymentsCount.count || 0,
          reviews: reviewsCount.count || 0,
          tickets: ticketsCount.count || 0,
          tours: toursCount.count || 0,
          activities: activitiesCount.count || 0,
        })
      }
    } catch (error) {
      console.error("[admin] Failed to load section", section, error)
      setStatus("Không thể tải dữ liệu cho module này. Vui lòng thử lại.")
    } finally {
      setLoading(false)
    }
  }, [section, supabase])

  useEffect(() => {
    if (!initialized || !user || !isManagement || !hasSectionAccess) {
      return
    }

    const timer = window.setTimeout(() => {
      void loadSectionData()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [hasSectionAccess, initialized, isManagement, loadSectionData, user])

  if (!initialized) {
    return <AdminLoadingState />
  }

  if (!user || !isManagement) {
    return (
      <AdminDeniedState
        title="Bạn không có quyền truy cập khu quản trị"
        description="Trang này chỉ mở cho role staff, admin hoặc super_admin. Sau khi đăng nhập đúng quyền, hệ thống sẽ tự chuyển bạn vào đúng module nội bộ."
      />
    )
  }

  if (!menuItem || !hasSectionAccess) {
    return (
      <AdminDeniedState
        title="Mục này không dành cho vai trò hiện tại"
        description="Bạn đã vào đúng khu quản trị, nhưng module này chỉ mở cho role cao hơn. Sidebar bên trái đã được tự động rút gọn theo đúng quyền để tránh nhầm lẫn."
      />
    )
  }

  const moderateReview = async (
    reviewId: string,
    payload: { status?: "approved" | "hidden"; replyText?: string },
    successMessage: string
  ) => {
    const response = await fetch("/api/reviews/moderate", {
      method: "POST",
      headers: authenticatedJsonHeaders,
      body: JSON.stringify({ reviewId, ...payload }),
    })
    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || "Không thể xử lý review.")
      return
    }
    setStatus(successMessage)
    await loadSectionData()
  }

  const manageTicket = async (
    ticketId: string,
    payload: { status?: "open" | "in_progress" | "resolved" | "closed"; message?: string },
    successMessage: string
  ) => {
    const response = await fetch("/api/support-tickets/manage", {
      method: "POST",
      headers: authenticatedJsonHeaders,
      body: JSON.stringify({ ticketId, ...payload }),
    })
    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || "Không thể cập nhật ticket hỗ trợ.")
      return
    }
    setStatus(successMessage)
    await loadSectionData()
  }
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Tổng doanh thu ghi nhận" value={formatCurrency(stats.totalRevenue)} tone="primary" />
        <AdminMetricCard label="Chờ thanh toán" value={stats.pendingPayments} />
        <AdminMetricCard label="Ticket đang mở" value={stats.openTickets} />
        <AdminMetricCard label="Review chờ duyệt" value={stats.pendingReviews} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel
          title="Booking gần đây"
          icon={Users}
          action={
            <Link href="/admin/bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-blue-700">
              Mở module booking
              <ArrowRight className="size-4" />
            </Link>
          }
        >
          <div className="space-y-4">
            {bookings.length ? bookings.map((booking) => (
              <div key={booking.id} className="rounded-[1.6rem] bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-black tracking-tight text-slate-950">{booking.booking_code}</div>
                    <div className="mt-1 text-sm text-slate-500">{formatDateTime(booking.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={booking.booking_status} />
                    <StatusPill status={booking.payment_status} />
                  </div>
                </div>
                <div className="mt-4 text-lg font-black tracking-tight text-sky-700">{formatCurrency(booking.total_amount)}</div>
              </div>
            )) : <AdminEmptyState title="Chưa có booking" description="Khi dữ liệu booking xuất hiện, phần preview này sẽ hiển thị các đơn gần nhất." />}
          </div>
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel
            title="Thanh toán cần theo dõi"
            icon={CreditCard}
            action={<Link href="/admin/payments" className="text-sm font-semibold text-primary hover:text-blue-700">Xem tất cả</Link>}
          >
            <div className="space-y-3">
              {payments.length ? payments.map((payment) => (
                <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 px-4 py-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-slate-950">{payment.provider_name || "Thanh toán"}</div>
                    <StatusPill status={payment.status} />
                  </div>
                  <div className="mt-2">{formatCurrency(payment.amount)}</div>
                  <div className="mt-1 text-xs text-slate-400">{formatDateTime(payment.requested_at)}</div>
                </div>
              )) : <AdminEmptyState title="Không có payment" description="Module thanh toán đang trống." />}
            </div>
          </AdminPanel>

          <AdminPanel title="Ghi chú vai trò" icon={FileClock}>
            <div className="rounded-[1.5rem] bg-slate-50 p-4 text-sm leading-7 text-slate-600">
              {getRoleCapabilitySummary(primaryRole)} Sidebar bên trái chỉ giữ các module bạn thật sự cần dùng để vận hành hằng ngày.
            </div>
          </AdminPanel>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <AdminPanel title="Review mới" icon={MessageSquareQuote} action={<Link href="/admin/reviews" className="text-sm font-semibold text-primary hover:text-blue-700">Đi tới reviews</Link>}>
          <div className="space-y-3">
            {reviews.length ? reviews.slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-slate-950">{review.rating}/5</div>
                  <StatusPill status={review.status} />
                </div>
                <div className="mt-2 line-clamp-3">{review.comment || "Khách hàng không để lại nhận xét."}</div>
              </div>
            )) : <AdminEmptyState title="Chưa có review" description="Review mới sẽ xuất hiện ở đây để staff theo dõi nhanh." />}
          </div>
        </AdminPanel>

        <AdminPanel title="Ticket hỗ trợ" icon={Ticket} action={<Link href="/admin/support" className="text-sm font-semibold text-primary hover:text-blue-700">Đi tới support</Link>}>
          <div className="space-y-3">
            {tickets.length ? tickets.slice(0, 4).map((ticket) => (
              <div key={ticket.id} className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-slate-950">{ticket.ticket_code}</div>
                  <StatusPill status={ticket.status} />
                </div>
                <div className="mt-2">{ticket.subject}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">Ưu tiên: {ticket.priority}</div>
              </div>
            )) : <AdminEmptyState title="Chưa có ticket" description="Module hỗ trợ đang trống dữ liệu." />}
          </div>
        </AdminPanel>

        {canAccessAdminSection(primaryRole, ["admin", "super_admin"]) ? (
          <AdminPanel title="Nhật ký gần đây" icon={BarChart3} action={<Link href="/admin/activity" className="text-sm font-semibold text-primary hover:text-blue-700">Đi tới activity</Link>}>
            <div className="space-y-3">
              {activities.length ? activities.slice(0, 4).map((activity) => (
                <div key={activity.id} className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="font-bold text-slate-950">{statusLabel(activity.action)}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{activity.entity_type}</div>
                  <div className="mt-2 text-xs text-slate-400">{formatDateTime(activity.created_at)}</div>
                </div>
              )) : <AdminEmptyState title="Chưa có hoạt động" description="Nhật ký hoạt động sẽ hiện ở đây khi admin thao tác." />}
            </div>
          </AdminPanel>
        ) : (
          <AdminPanel title="Nhịp vận hành hôm nay" icon={FileClock}>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="font-bold text-slate-950">Bookings đã hoàn thành</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-sky-700">{stats.completedBookings}</div>
              </div>
              <div className="rounded-[1.5rem] bg-slate-50 p-4">
                <div className="font-bold text-slate-950">Ticket đang mở</div>
                <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">{stats.openTickets}</div>
              </div>
            </div>
          </AdminPanel>
        )}
      </div>
    </div>
  )

  const renderBookings = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Bookings đang hiển thị" value={bookings.length} />
        <AdminMetricCard label="Có thể xác nhận thanh toán" value={stats.pendingPayments} />
        <AdminMetricCard label="Chờ duyệt hủy" value={stats.pendingCancellationReviews} />
        <AdminMetricCard label="Đã hủy" value={stats.canceledBookings} tone="accent" />
      </div>

      <AdminPanel title="Danh sách booking" icon={Users}>
        <div className="space-y-4">
          {bookings.length ? bookings.map((booking) => {
            const canMarkPaid = canMarkBookingPaid({
              bookingStatus: booking.booking_status,
              paymentStatus: booking.payment_status,
            })
            const canResolveCancel = canResolveCancellationRequest({
              bookingStatus: booking.booking_status,
              paymentStatus: booking.payment_status,
            })

            return (
              <div key={booking.id} className="rounded-[1.6rem] bg-slate-50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-black tracking-tight text-slate-950">{booking.booking_code}</div>
                    <div className="mt-1 text-sm text-slate-500">{formatDateTime(booking.created_at)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={booking.booking_status} />
                    <StatusPill status={booking.payment_status} />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-lg font-black tracking-tight text-sky-700">{formatCurrency(booking.total_amount)}</div>
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {booking.booking_code}
                    </div>
                    {canResolveCancel ? (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-full border-slate-200 bg-white"
                          onClick={async () => {
                            const response = await fetch("/api/bookings/cancel/review", {
                              method: "POST",
                              headers: authenticatedJsonHeaders,
                              body: JSON.stringify({ bookingCode: booking.booking_code, decision: "reject" }),
                            })
                            const result = await response.json()
                            if (!response.ok) {
                              setStatus(result.error || "Không thể từ chối yêu cầu hủy.")
                              return
                            }
                            setStatus(`Đã giữ lại booking ${booking.booking_code} sau khi từ chối yêu cầu hủy.`)
                            await loadSectionData()
                          }}
                        >
                          Từ chối hủy
                        </Button>
                        <Button
                          className="rounded-full bg-rose-600 text-white hover:bg-rose-700"
                          onClick={async () => {
                            const response = await fetch("/api/bookings/cancel/review", {
                              method: "POST",
                              headers: authenticatedJsonHeaders,
                              body: JSON.stringify({ bookingCode: booking.booking_code, decision: "approve" }),
                            })
                            const result = await response.json()
                            if (!response.ok) {
                              setStatus(result.error || "Không thể duyệt yêu cầu hủy.")
                              return
                            }
                            setStatus(`Đã duyệt hủy booking ${booking.booking_code}.`)
                            await loadSectionData()
                          }}
                        >
                          Duyệt hủy
                        </Button>
                      </>
                    ) : canMarkPaid ? (
                      <Button
                        className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                        onClick={async () => {
                          const response = await fetch("/api/bookings/payment", {
                            method: "POST",
                            headers: authenticatedJsonHeaders,
                            body: JSON.stringify({ bookingCode: booking.booking_code }),
                          })
                          const result = await response.json()
                          if (!response.ok) {
                            setStatus(result.error || "Không thể cập nhật thanh toán.")
                            return
                          }
                          setStatus(`Đã xác nhận thanh toán cho ${booking.booking_code}.`)
                          await loadSectionData()
                        }}
                      >
                        Đánh dấu đã thanh toán
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          }) : <AdminEmptyState title="Chưa có booking phù hợp" description="Không tìm thấy dữ liệu booking để hiển thị trong module này." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderPayments = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Số payment record" value={payments.length} />
        <AdminMetricCard label="Tổng giá trị đang hiển thị" value={formatCurrency(payments.reduce((sum, payment) => sum + payment.amount, 0))} tone="primary" />
        <AdminMetricCard label="Payment pending" value={payments.filter((payment) => payment.status === "pending").length} />
      </div>

      <AdminPanel title="Danh sách thanh toán" icon={CreditCard}>
        <div className="space-y-3">
          {payments.length ? payments.map((payment) => (
            <div key={payment.id} className="rounded-[1.5rem] border border-slate-200 px-5 py-4 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-950">{payment.provider_name || "Thanh toán"}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Booking: {payment.booking_id}</div>
                </div>
                <StatusPill status={payment.status} />
              </div>
              <div className="mt-3 text-lg font-black tracking-tight text-sky-700">{formatCurrency(payment.amount)}</div>
              <div className="mt-1 text-xs text-slate-400">{formatDateTime(payment.requested_at)}</div>
            </div>
          )) : <AdminEmptyState title="Chưa có payment" description="Dữ liệu thanh toán hiện đang trống." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderReviews = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Review đang hiển thị" value={reviews.length} />
        <AdminMetricCard label="Điểm trung bình" value={stats.averageRating} tone="primary" />
        <AdminMetricCard label="Chờ duyệt" value={stats.pendingReviews} />
      </div>

      <AdminPanel title="Danh sách review" icon={MessageSquareQuote}>
        <div className="space-y-4">
          {reviews.length ? reviews.map((review) => (
            <div key={review.id} className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-bold text-slate-950">{review.rating}/5</div>
                <StatusPill status={review.status} />
              </div>
              <div className="mt-3 leading-7">{review.comment || "Khách hàng không để lại nhận xét."}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Booking: {review.booking_id}</div>
              <div className="mt-1 text-xs text-slate-400">{formatDateTime(review.created_at)}</div>

              {review.reply_text ? (
                <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3">
                  <div className="font-bold text-slate-950">Phản hồi hiện tại</div>
                  <div className="mt-2 leading-7">{review.reply_text}</div>
                </div>
              ) : null}

              <textarea
                value={reviewReplyDrafts[review.id] ?? review.reply_text ?? ""}
                onChange={(event) => setReviewReplyDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                placeholder="Phản hồi cho khách hàng hoặc ghi chú moderation"
                className="mt-4 min-h-28 w-full rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                {review.status !== "approved" ? (
                  <Button
                    className="rounded-full bg-sky-600 text-white hover:bg-sky-700"
                    onClick={() => void moderateReview(review.id, {
                      status: "approved",
                      replyText: reviewReplyDrafts[review.id] ?? review.reply_text ?? "",
                    }, `Đã duyệt review cho booking ${review.booking_id}.`)}
                  >
                    Duyệt hiển thị
                  </Button>
                ) : null}

                {review.status !== "hidden" ? (
                  <Button
                    variant="outline"
                    className="rounded-full border-slate-200 bg-white"
                    onClick={() => void moderateReview(review.id, {
                      status: "hidden",
                      replyText: reviewReplyDrafts[review.id] ?? review.reply_text ?? "",
                    }, `Đã ẩn review của booking ${review.booking_id}.`)}
                  >
                    Ẩn review
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  className="rounded-full border-slate-200 bg-white"
                  onClick={() => void moderateReview(review.id, {
                    replyText: reviewReplyDrafts[review.id] ?? review.reply_text ?? "",
                  }, `Đã lưu phản hồi cho review của booking ${review.booking_id}.`)}
                >
                  Lưu phản hồi
                </Button>
              </div>
            </div>
          )) : <AdminEmptyState title="Chưa có review" description="Module review chưa có dữ liệu để kiểm duyệt." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderSupport = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Ticket đang hiển thị" value={tickets.length} />
        <AdminMetricCard label="Ticket đang mở" value={stats.openTickets} />
        <AdminMetricCard label="Ưu tiên cao" value={stats.highPriorityTickets} tone="accent" />
      </div>

      <AdminPanel title="Danh sách hỗ trợ" icon={Ticket}>
        <div className="space-y-4">
          {tickets.length ? tickets.map((ticket) => {
            const allowedTransitions = getAllowedStaffTicketTransitions(ticket.status)
            const recentMessages = ticketMessagesByTicket[ticket.id] || []

            return (
              <div key={ticket.id} className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold text-slate-950">{ticket.ticket_code}</div>
                    <div className="mt-1">{ticket.subject}</div>
                  </div>
                  <StatusPill status={ticket.status} />
                </div>
                <div className="mt-3 leading-7 text-slate-500">{getSupportStatusDescription(ticket.status)}</div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Mức ưu tiên: {ticket.priority}</div>
                <div className="mt-1 text-xs text-slate-400">{formatDateTime(ticket.created_at)}</div>

                {recentMessages.length ? (
                  <div className="mt-4 space-y-3 rounded-[1.2rem] bg-white px-4 py-4">
                    <div className="font-bold text-slate-950">Trao đổi gần nhất</div>
                    {recentMessages.slice(-3).map((message) => (
                      <div key={message.id} className="rounded-[1rem] bg-slate-50 px-3 py-3">
                        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                          <span>{message.sender_type === "staff" ? "Nhân sự" : "Khách hàng"}</span>
                          <span>{formatDateTime(message.created_at)}</span>
                        </div>
                        <div className="mt-2 leading-7 text-slate-600">{message.message}</div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  {allowedTransitions.map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      variant="outline"
                      className="rounded-full border-slate-200 bg-white"
                      onClick={() => void manageTicket(ticket.id, { status: nextStatus as "open" | "in_progress" | "resolved" | "closed" }, `Đã cập nhật ticket ${ticket.ticket_code} sang ${nextStatus}.`)}
                    >
                      {nextStatus === "open"
                        ? "Mở lại"
                        : nextStatus === "in_progress"
                          ? "Nhận xử lý"
                          : nextStatus === "resolved"
                            ? "Đánh dấu đã giải quyết"
                            : "Đóng ticket"}
                    </Button>
                  ))}
                </div>

                <textarea
                  value={ticketReplyDrafts[ticket.id] || ""}
                  onChange={(event) => setTicketReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))}
                  placeholder="Gửi phản hồi cho khách hàng"
                  className="mt-4 min-h-28 w-full rounded-[1.3rem] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                />
                <div className="mt-4 flex justify-end">
                  <Button
                    className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                    onClick={() => void manageTicket(ticket.id, {
                      message: ticketReplyDrafts[ticket.id] || "",
                    }, `Đã gửi phản hồi cho ticket ${ticket.ticket_code}.`)}
                  >
                    Gửi phản hồi
                  </Button>
                </div>
              </div>
            )
          }) : <AdminEmptyState title="Chưa có ticket" description="Module support đang trống dữ liệu." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderTours = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Tours đang hiển thị" value={tours.length} />
        <AdminMetricCard label="Đang published" value={stats.publishedTours} />
        <AdminMetricCard label="Tuyến nổi bật" value={stats.featuredTours} tone="primary" />
      </div>

      <AdminPanel title="Danh sách tour" icon={Shield}>
        <div className="space-y-3">
          {tours.length ? tours.map((tour) => (
            <div key={tour.id} className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="font-bold text-slate-950">{tour.name}</div>
                <StatusPill status={tour.status} />
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">{tour.is_featured ? "Tuyến nổi bật" : "Tuyến tiêu chuẩn"}</div>
            </div>
          )) : <AdminEmptyState title="Chưa có tour" description="Không có dữ liệu tour để hiển thị trong module quản lý nội dung." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderActivity = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <AdminMetricCard label="Bản ghi đang hiển thị" value={activities.length} />
        <AdminMetricCard label="Loại entity khác nhau" value={stats.activityEntities} />
        <AdminMetricCard label="Mục dành cho admin" value="Có" tone="primary" />
      </div>

      <AdminPanel title="Nhật ký hoạt động" icon={BarChart3}>
        <div className="space-y-3">
          {activities.length ? activities.map((activity) => (
            <div key={activity.id} className="rounded-[1.5rem] bg-slate-50 p-5 text-sm text-slate-600">
              <div className="font-bold text-slate-950">{statusLabel(activity.action)}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{activity.entity_type}</div>
              <div className="mt-3 text-xs text-slate-400">{formatDateTime(activity.created_at)}</div>
            </div>
          )) : <AdminEmptyState title="Chưa có activity log" description="Nhật ký hoạt động đang trống." />}
        </div>
      </AdminPanel>
    </div>
  )

  const renderSystem = () => (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AdminMetricCard label="Bookings trong DB" value={systemCounts.bookings} />
        <AdminMetricCard label="Payments trong DB" value={systemCounts.payments} />
        <AdminMetricCard label="Reviews trong DB" value={systemCounts.reviews} />
        <AdminMetricCard label="Tickets trong DB" value={systemCounts.tickets} />
        <AdminMetricCard label="Tours trong DB" value={systemCounts.tours} />
        <AdminMetricCard label="Activity logs trong DB" value={systemCounts.activities} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel title="Phân tầng vai trò" icon={Shield}>
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              <div className="font-bold text-slate-950">Staff</div>
              <div className="mt-2">Chỉ thấy dashboard, bookings, payments, reviews và support.</div>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              <div className="font-bold text-slate-950">Admin</div>
              <div className="mt-2">Thấy toàn bộ module staff cộng thêm tours, activity và system.</div>
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              <div className="font-bold text-slate-950">Super Admin</div>
              <div className="mt-2">Dùng cùng console với admin, giữ vai trò cao nhất để mở rộng quyền hệ thống về sau.</div>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel title="Ghi chú kỹ thuật" icon={FileClock}>
          <div className="space-y-4 text-sm leading-7 text-slate-600">
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              Public site hiện bị khóa cho mọi role quản trị và sẽ tự redirect về `/admin`.
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              Checkout đã yêu cầu đăng nhập trước khi tạo booking thật; guest chỉ xem được thông tin tour.
            </div>
            <div className="rounded-[1.5rem] bg-slate-50 p-4">
              Nếu sau này bật RLS chặt hơn, nên chuyển các thao tác quản trị sang server actions, RPC hoặc Edge Functions để kiểm soát quyền chính xác hơn.
            </div>
          </div>
        </AdminPanel>
      </div>
    </div>
  )

  return (
    <div>
      <AdminPageHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        primaryRole={primaryRole}
        rightSlot={
          section !== "overview" ? (
            <Button asChild variant="outline" className="rounded-full border-slate-200 bg-white">
              <Link href="/admin">Về dashboard</Link>
            </Button>
          ) : undefined
        }
      />

      {status ? (
        <div className={`mb-6 rounded-[1.6rem] px-4 py-4 text-sm ${hasErrorTone ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {status}
        </div>
      ) : null}

      {!loading ? (
        <>
          {section === "overview" ? renderOverview() : null}
          {section === "bookings" ? renderBookings() : null}
          {section === "payments" ? renderPayments() : null}
          {section === "reviews" ? renderReviews() : null}
          {section === "support" ? renderSupport() : null}
          {section === "tours" ? renderTours() : null}
          {section === "activity" ? renderActivity() : null}
          {section === "system" ? renderSystem() : null}
        </>
      ) : (
        <AdminLoadingState />
      )}
    </div>
  )
}






















