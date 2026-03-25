"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { Bell, Heart, LifeBuoy, MapPinned, Ticket, UserRound } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { StatusPill } from "@/components/site/status-pill"
import { SupportTicketThread } from "@/components/site/support-ticket-thread"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { countsAsOpenBooking, countsAsRecognizedSpend } from "@/lib/booking-logic"
import { canCustomerReplyTicket, getSupportStatusDescription } from "@/lib/customer-care-logic"
import { formatCurrency, formatDateTime, normalizeSearch } from "@/lib/format"
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client"

type DashboardBooking = {
  id: string
  booking_code: string
  total_amount: number
  booking_status: string
  payment_status: string
  created_at: string
}

type DashboardNotification = {
  id: string
  title: string
  content: string
  is_read: boolean
  created_at: string
}

type DashboardTraveler = {
  id: string
  full_name: string
  traveler_type: string
  nationality: string | null
  phone: string | null
  email: string | null
}

type DashboardTicket = {
  id: string
  ticket_code: string
  subject: string
  status: string
  created_at: string
}

type DashboardTicketMessage = {
  id: string
  ticket_id: string
  sender_type: string
  message: string
  created_at: string
}
type WishlistTour = {
  id: string
  slug: string
  name: string
  short_description: string | null
}

function useAccountData() {
  const { initialized, session, user, profile, primaryRole, refreshProfile } = useAuth()
  const supabase = getSupabaseBrowserClient()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [bookings, setBookings] = useState<DashboardBooking[]>([])
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
  const [savedTravelers, setSavedTravelers] = useState<DashboardTraveler[]>([])
  const [tickets, setTickets] = useState<DashboardTicket[]>([])
  const [ticketMessagesByTicket, setTicketMessagesByTicket] = useState<Record<string, DashboardTicketMessage[]>>({})
  const [wishlist, setWishlist] = useState<WishlistTour[]>([])

  const loadDashboard = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setStatus(null)

    const [bookingsResult, notificationsResult, travelersResult, ticketsResult, wishlistResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,booking_code,total_amount,booking_status,payment_status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("notifications")
        .select("id,title,content,is_read,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("saved_travelers")
        .select("id,full_name,traveler_type,nationality,phone,email")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("id,ticket_code,subject,status,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("wishlist").select("tour_id").eq("user_id", user.id),
    ])

    const ticketItems = (ticketsResult.data || []) as DashboardTicket[]
    const ticketIds = ticketItems.map((ticket) => ticket.id)
    const messagesResult = ticketIds.length
      ? await supabase
          .from("support_ticket_messages")
          .select("id,ticket_id,sender_type,message,created_at")
          .in("ticket_id", ticketIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null }

    const groupedMessages = ((messagesResult.data || []) as DashboardTicketMessage[]).reduce<Record<string, DashboardTicketMessage[]>>((acc, message) => {
      const current = acc[message.ticket_id] || []
      current.push(message)
      acc[message.ticket_id] = current
      return acc
    }, {})

    const tourIds = wishlistResult.data?.map((item) => item.tour_id) || []
    const wishlistToursResult = tourIds.length
      ? await supabase.from("tours").select("id,slug,name,short_description").in("id", tourIds)
      : { data: [], error: null }

    setBookings((bookingsResult.data || []) as DashboardBooking[])
    setNotifications((notificationsResult.data || []) as DashboardNotification[])
    setSavedTravelers((travelersResult.data || []) as DashboardTraveler[])
    setTickets(ticketItems)
    setTicketMessagesByTicket(groupedMessages)
    setWishlist((wishlistToursResult.data || []) as WishlistTour[])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    if (!initialized || !user) return

    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [initialized, user, loadDashboard])

  const authenticatedJsonHeaders: Record<string, string> = session?.access_token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }
    : { "Content-Type": "application/json" }

  return {
    loading, status, setStatus,
    bookings, notifications, savedTravelers, tickets, ticketMessagesByTicket, wishlist,
    loadDashboard, supabase, user, profile, session, primaryRole, refreshProfile,
    authenticatedJsonHeaders,
  }
}
export function AccountOverview() {
  const { bookings, notifications, savedTravelers } = useAccountData()

  const stats = useMemo(() => {
    const activeBookings = bookings.filter((booking) => countsAsOpenBooking({
      bookingStatus: booking.booking_status,
      paymentStatus: booking.payment_status,
    })).length
    const totalSpend = bookings
      .filter((booking) => countsAsRecognizedSpend({
        bookingStatus: booking.booking_status,
        paymentStatus: booking.payment_status,
      }))
      .reduce((sum, booking) => sum + booking.total_amount, 0)

    return {
      activeBookings,
      totalSpend,
      unreadNotifications: notifications.filter((item) => !item.is_read).length,
      travelerProfiles: savedTravelers.length,
    }
  }, [bookings, notifications, savedTravelers])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="surface-panel p-5">
          <div className="text-sm text-slate-400">Booking đang mở</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-slate-950">{stats.activeBookings}</div>
        </div>
        <div className="surface-panel p-5">
          <div className="text-sm text-slate-400">Tổng chi tiêu</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-sky-700">{formatCurrency(stats.totalSpend)}</div>
        </div>
        <div className="surface-panel p-5">
          <div className="text-sm text-slate-400">Thông báo chưa đọc</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-slate-950">{stats.unreadNotifications}</div>
        </div>
        <div className="surface-panel p-5">
          <div className="text-sm text-slate-400">Hồ sơ hành khách</div>
          <div className="mt-2 text-4xl font-black tracking-tight text-slate-950">{stats.travelerProfiles}</div>
        </div>
      </div>

    </div>
  )
}

export function AccountProfile() {
  const { status, setStatus, profile, refreshProfile, authenticatedJsonHeaders } = useAccountData()

  const profileFormKey = `${profile?.id || "anon"}-${profile?.full_name || ""}-${profile?.phone || ""}-${profile?.address || ""}-${profile?.avatar_url || ""}`

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: authenticatedJsonHeaders,
      body: JSON.stringify({
        fullName: formData.get("fullName"),
        phone: formData.get("phone"),
        address: formData.get("address"),
        avatarUrl: formData.get("avatarUrl"),
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      setStatus(result.error || "Không thể cập nhật profile.")
      return
    }

    await refreshProfile()
    setStatus("Đã cập nhật profile thành công.")
  }

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <UserRound className="size-5 text-sky-600" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Thông tin cá nhân</div>
      </div>

      {status ? (
        <div className={`mb-5 rounded-[1.6rem] px-4 py-4 text-sm ${["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {status}
        </div>
      ) : null}

      <form key={profileFormKey} onSubmit={handleProfileSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Họ và tên</span>
            <Input name="fullName" defaultValue={profile?.full_name || ""} className="h-12 rounded-2xl bg-slate-100/80" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Điện thoại</span>
            <Input name="phone" defaultValue={profile?.phone || ""} className="h-12 rounded-2xl bg-slate-100/80" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Địa chỉ</span>
            <Input name="address" defaultValue={profile?.address || ""} className="h-12 rounded-2xl bg-slate-100/80" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Avatar URL</span>
            <Input name="avatarUrl" defaultValue={profile?.avatar_url || ""} className="h-12 rounded-2xl bg-slate-100/80" />
          </label>
        </div>
        <div className="flex justify-end">
          <Button className="rounded-full bg-sky-600 text-white hover:bg-sky-700">Lưu thông tin</Button>
        </div>
      </form>
    </section>
  )
}

export function AccountBookings() {
  const { loading, bookings } = useAccountData()

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <Ticket className="size-5 text-orange-500" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Booking của bạn</div>
      </div>
      <div className="space-y-4">
        {loading ? (
          <div className="text-sm text-slate-500">Đang tải bookings...</div>
        ) : bookings.length ? (
          bookings.map((booking) => (
            <div key={booking.id} className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black tracking-tight text-slate-950">{booking.booking_code}</div>
                  <div className="mt-1 text-sm text-slate-500">Tạo lúc {formatDateTime(booking.created_at)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={booking.booking_status} />
                  <StatusPill status={booking.payment_status} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-lg font-black tracking-tight text-sky-700">{formatCurrency(booking.total_amount)}</div>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href={`/booking/${booking.booking_code}`}>Xem chi tiết</Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">Bạn chưa có booking nào. Hãy thử đặt tour từ trang checkout.</div>
        )}
      </div>
    </section>
  )
}

export function AccountWishlist() {
  const { status, setStatus, wishlist, loadDashboard, authenticatedJsonHeaders } = useAccountData()

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <Heart className="size-5 text-rose-500" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Danh sách yêu thích</div>
      </div>

      {status ? (
        <div className={`mb-5 rounded-[1.6rem] px-4 py-4 text-sm ${["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {status}
        </div>
      ) : null}

      <div className="space-y-4">
        {wishlist.length ? wishlist.map((tour) => (
          <div key={tour.id} className="rounded-[1.5rem] bg-slate-50 p-4">
            <div className="font-bold text-slate-950">{tour.name}</div>
            <div className="mt-2 text-sm leading-7 text-slate-500">{tour.short_description || "Tour được lưu từ danh sách yêu thích."}</div>
            <div className="mt-4 flex gap-3">
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/tours/${tour.slug}`}>Xem tour</Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={async () => {
                  const response = await fetch("/api/wishlist", {
                    method: "POST",
                    headers: authenticatedJsonHeaders,
                    body: JSON.stringify({ tourId: tour.id }),
                  })
                  const result = await response.json()
                  if (!response.ok) {
                    setStatus(result.error || "Không thể cập nhật danh sách yêu thích.")
                    return
                  }
                  setStatus("Đã cập nhật danh sách yêu thích.")
                  await loadDashboard()
                }}
              >
                Bỏ lưu
              </Button>
            </div>
          </div>
        )) : <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">Chưa có tour nào trong danh sách yêu thích.</div>}
      </div>
    </section>
  )
}

export function AccountTravelers() {
  const { status, setStatus, savedTravelers, loadDashboard, supabase, user } = useAccountData()
  const [travelerForm, setTravelerForm] = useState({
    fullName: "",
    travelerType: "adult",
    nationality: "Việt Nam",
    phone: "",
    email: "",
  })

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <MapPinned className="size-5 text-emerald-600" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Hành khách đã lưu</div>
      </div>

      {status ? (
        <div className={`mb-5 rounded-[1.6rem] px-4 py-4 text-sm ${["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {status}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Input value={travelerForm.fullName} onChange={(event) => setTravelerForm((prev) => ({ ...prev, fullName: event.target.value }))} placeholder="Họ và tên" className="h-12 rounded-2xl bg-slate-100/80" />
        <select value={travelerForm.travelerType} onChange={(event) => setTravelerForm((prev) => ({ ...prev, travelerType: event.target.value }))} className="h-12 rounded-2xl border border-slate-200 bg-slate-100/80 px-4 text-sm outline-none">
          <option value="adult">Người lớn</option>
          <option value="child">Trẻ em</option>
          <option value="infant">Em bé</option>
        </select>
        <Input value={travelerForm.phone} onChange={(event) => setTravelerForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="Điện thoại" className="h-12 rounded-2xl bg-slate-100/80" />
        <Input value={travelerForm.email} onChange={(event) => setTravelerForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" className="h-12 rounded-2xl bg-slate-100/80" />
      </div>
      <div className="mt-4 flex justify-end">
        <Button
          onClick={async () => {
            if (!user) return
            const insertResult = await supabase.from("saved_travelers").insert({
              user_id: user.id,
              full_name: travelerForm.fullName,
              traveler_type: travelerForm.travelerType,
              nationality: travelerForm.nationality,
              phone: travelerForm.phone || null,
              email: travelerForm.email || null,
            })

            if (insertResult.error) {
              setStatus(insertResult.error.message)
              return
            }

            setTravelerForm({ fullName: "", travelerType: "adult", nationality: "Việt Nam", phone: "", email: "" })
            setStatus("Đã thêm hồ sơ hành khách mới.")
            await loadDashboard()
          }}
          className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
        >
          Thêm hành khách
        </Button>
      </div>
      <div className="mt-5 space-y-3">
        {savedTravelers.map((traveler) => (
          <div key={traveler.id} className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold text-slate-950">{traveler.full_name}</div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{traveler.traveler_type}</span>
            </div>
            <div className="mt-2">{traveler.phone || traveler.email || traveler.nationality || "Chưa có thông tin bổ sung"}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AccountNotifications() {
  const { notifications } = useAccountData()

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <Bell className="size-5 text-sky-600" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Thông báo gần đây</div>
      </div>
      <div className="space-y-3">
        {notifications.length ? notifications.map((item) => (
          <div key={item.id} className="rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold text-slate-950">{item.title}</div>
              {!item.is_read ? <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Mới</span> : null}
            </div>
            <div className="mt-2 leading-7">{item.content}</div>
            <div className="mt-2 text-xs text-slate-400">{formatDateTime(item.created_at)}</div>
          </div>
        )) : <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm text-slate-500">Chưa có thông báo nào.</div>}
      </div>
    </section>
  )
}

export function AccountSupport() {
  const { status, setStatus, tickets, ticketMessagesByTicket, loadDashboard, authenticatedJsonHeaders, profile } = useAccountData()
  const [ticketForm, setTicketForm] = useState({
    subject: "",
    message: "",
  })
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null)
  const [ticketReplyDrafts, setTicketReplyDrafts] = useState<Record<string, string>>({})
  const conversationRef = useRef<HTMLDivElement | null>(null)

  const resolvedSelectedTicketId = tickets.some((ticket) => ticket.id === selectedTicketId)
    ? selectedTicketId
    : tickets[0]?.id || null

  const openTicketConversation = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId)

    if (typeof window !== "undefined" && window.innerWidth < 1280) {
      window.requestAnimationFrame(() => {
        conversationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      })
    }
  }, [])

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === resolvedSelectedTicketId) || null,
    [resolvedSelectedTicketId, tickets]
  )

  const selectedMessages = useMemo(
    () => selectedTicket
      ? (ticketMessagesByTicket[selectedTicket.id] || []).map((message) => ({
          id: message.id,
          senderType: message.sender_type,
          message: message.message,
          createdAt: message.created_at,
        }))
      : [],
    [selectedTicket, ticketMessagesByTicket]
  )

  const selectedDraft = selectedTicket ? ticketReplyDrafts[selectedTicket.id] || "" : ""
  const selectedTicketCanReply = selectedTicket ? canCustomerReplyTicket(selectedTicket.status) : false

  return (
    <section className="surface-panel p-6">
      <div className="mb-5 flex items-center gap-3">
        <LifeBuoy className="size-5 text-orange-500" />
        <div className="text-2xl font-black tracking-tight text-slate-950">Yêu cầu hỗ trợ</div>
      </div>

      {status ? (
        <div className={`mb-5 rounded-[1.6rem] px-4 py-4 text-sm ${["khong", "loi", "error", "failed"].some((keyword) => normalizeSearch(status).includes(keyword)) ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {status}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[22rem,minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-[1.8rem] bg-slate-50 p-5">
            <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">Tạo ticket mới</div>
            <div className="mt-2 text-lg font-bold text-slate-950">Mở yêu cầu mới khi cần một luồng hỗ trợ riêng.</div>
            <div className="mt-4 space-y-3">
              <Input
                value={ticketForm.subject}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Chủ đề hỗ trợ"
                className="h-12 rounded-2xl bg-white"
              />
              <textarea
                value={ticketForm.message}
                onChange={(event) => setTicketForm((prev) => ({ ...prev, message: event.target.value }))}
                className="min-h-28 w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 text-sm outline-none"
                placeholder="Bạn cần The Horizon hỗ trợ điều gì?"
              />
              <Button
                className="w-full rounded-full bg-orange-500 text-white hover:bg-orange-600"
                disabled={!ticketForm.subject.trim() || !ticketForm.message.trim()}
                onClick={async () => {
                  const response = await fetch("/api/support-tickets", {
                    method: "POST",
                    headers: authenticatedJsonHeaders,
                    body: JSON.stringify({ subject: ticketForm.subject, message: ticketForm.message }),
                  })
                  const result = await response.json()
                  if (!response.ok) {
                    setStatus(result.error || "Không thể tạo ticket.")
                    return
                  }
                  setTicketForm({ subject: "", message: "" })
                  setStatus(`Đã tạo ticket ${result.ticket.ticket_code}.`)
                  await loadDashboard()
                  openTicketConversation(result.ticket.id)
                }}
              >
                Gửi ticket mới
              </Button>
            </div>
          </div>

          <div className="rounded-[1.8rem] bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">Hộp thư hỗ trợ</div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">{tickets.length} ticket</span>
            </div>
            <div className="space-y-2">
              {tickets.length ? tickets.map((ticket) => {
                const messageList = ticketMessagesByTicket[ticket.id] || []
                const latestMessage = messageList.length ? messageList[messageList.length - 1] : null
                const isSelected = ticket.id === selectedTicket?.id

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicketConversation(ticket.id)}
                    className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${isSelected ? "border-slate-900 bg-white shadow-sm" : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-950">{ticket.ticket_code}</div>
                        <div className="mt-1 truncate text-sm text-slate-600">{ticket.subject}</div>
                      </div>
                      <StatusPill status={ticket.status} className="shrink-0" />
                    </div>
                    <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">
                      {latestMessage?.message || getSupportStatusDescription(ticket.status)}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">{formatDateTime(latestMessage?.created_at || ticket.created_at)}</div>
                  </button>
                )
              }) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Chưa có ticket nào. Khi bạn mở yêu cầu mới, cuộc trò chuyện sẽ xuất hiện ở đây.
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={conversationRef} className="rounded-[1.8rem] border border-slate-200 bg-white p-4 sm:p-5">
          {selectedTicket ? (
            <>
              <div className="border-b border-slate-100 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.24em] text-slate-400">{selectedTicket.ticket_code}</div>
                    <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{selectedTicket.subject}</h2>
                  </div>
                  <StatusPill status={selectedTicket.status} />
                </div>
                <div className="mt-3 text-sm leading-7 text-slate-500">{getSupportStatusDescription(selectedTicket.status)}</div>
              </div>

              <SupportTicketThread
                className="mt-5"
                viewerType="customer"
                messages={selectedMessages}
                customer={{
                  label: profile?.full_name || "Bạn",
                  avatarUrl: profile?.avatar_url,
                  initials: profile?.full_name || "KH",
                  toneClassName: "bg-slate-900 text-white",
                }}
                staff={{
                  label: "Hỗ trợ The Horizon",
                  initials: "TH",
                  toneClassName: "bg-orange-100 text-orange-700",
                }}
              />

              <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-700">Nhắn lại cho đội hỗ trợ</div>
                <textarea
                  value={selectedDraft}
                  onChange={(event) => setTicketReplyDrafts((current) => ({ ...current, [selectedTicket.id]: event.target.value }))}
                  placeholder={selectedTicketCanReply ? "Nhập nội dung bạn muốn bổ sung cho ticket này" : "Ticket đã đóng, không thể gửi thêm tin nhắn"}
                  disabled={!selectedTicketCanReply}
                  className="mt-3 min-h-28 w-full rounded-[1.4rem] border border-slate-200 bg-white px-4 py-4 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
                {selectedTicket.status === "closed" ? (
                  <div className="mt-3 text-sm text-amber-700">
                    Ticket này đã đóng. Bạn không thể gửi thêm tin nhắn trong luồng hiện tại.
                  </div>
                ) : selectedTicket.status === "resolved" ? (
                  <div className="mt-3 text-sm text-slate-500">
                    Phản hồi mới sẽ tự đưa ticket về trạng thái mở để đội hỗ trợ tiếp tục xử lý.
                  </div>
                ) : null}
                <div className="mt-4 flex justify-end">
                  <Button
                    className="rounded-full bg-slate-900 text-white hover:bg-slate-800"
                    disabled={!selectedTicketCanReply || !selectedDraft.trim()}
                    onClick={async () => {
                      const response = await fetch("/api/support-tickets/reply", {
                        method: "POST",
                        headers: authenticatedJsonHeaders,
                        body: JSON.stringify({ ticketId: selectedTicket.id, message: selectedDraft }),
                      })
                      const result = await response.json()
                      if (!response.ok) {
                        setStatus(result.error || "Không thể gửi phản hồi ticket.")
                        return
                      }
                      setTicketReplyDrafts((current) => ({ ...current, [selectedTicket.id]: "" }))
                      setStatus(`Đã gửi thêm phản hồi cho ticket ${selectedTicket.ticket_code}.`)
                      await loadDashboard()
                      openTicketConversation(selectedTicket.id)
                    }}
                  >
                    {selectedTicket.status === "resolved" ? "Gửi phản hồi để mở lại" : "Gửi tin nhắn"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-[28rem] items-center justify-center rounded-[1.8rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
              Chọn một ticket ở cột bên trái để xem toàn bộ cuộc trò chuyện với đội hỗ trợ.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
