"use client"

import Link from "next/link"
import Image from "next/image"
import { startTransition, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, CreditCard, Lock, ShieldCheck, UserRoundCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatCurrency, formatLongDate, statusLabel } from "@/lib/format"
import { computeCouponDiscount, computeSubtotal } from "@/lib/pricing"
import type { CouponPreview, PaymentMethod, TourSummary } from "@/lib/site-data"
import { useAuth } from "@/components/providers/auth-provider"

type TravelerForm = {
  fullName: string
  email: string
  phone: string
  dateOfBirth: string
  gender: string
  travelerType: "adult" | "child" | "infant"
  idNumber: string
  nationality: string
  specialRequest: string
}

function createTravelers(adults: number, children: number, infants: number, previous: TravelerForm[] = []) {
  const next: TravelerForm[] = []
  const sequence: Array<TravelerForm["travelerType"]> = [
    ...Array.from({ length: adults }, () => "adult" as const),
    ...Array.from({ length: children }, () => "child" as const),
    ...Array.from({ length: infants }, () => "infant" as const),
  ]

  sequence.forEach((travelerType, index) => {
    next.push(
      previous[index] || {
        fullName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        gender: "other",
        travelerType,
        idNumber: "",
        nationality: "Việt Nam",
        specialRequest: "",
      }
    )
    next[index].travelerType = travelerType
  })

  return next
}

export function BookingWizard({
  tour,
  scheduleId,
  initialAdults,
  initialChildren,
  initialInfants,
  paymentMethods,
  coupons,
}: {
  tour: TourSummary
  scheduleId?: string
  initialAdults: number
  initialChildren: number
  initialInfants: number
  paymentMethods: PaymentMethod[]
  coupons: CouponPreview[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, session, profile } = useAuth()
  const [step, setStep] = useState(1)
  const [selectedScheduleId, setSelectedScheduleId] = useState(scheduleId || tour.schedules[0]?.id || "")
  const [adults, setAdults] = useState(initialAdults)
  const [children, setChildren] = useState(initialChildren)
  const [infants, setInfants] = useState(initialInfants)
  const [couponCode, setCouponCode] = useState("")
  const [paymentMethodCode, setPaymentMethodCode] = useState(paymentMethods[0]?.code || "cash")
  const [customerNote, setCustomerNote] = useState("")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contact, setContact] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "Việt Nam",
    note: "",
  })
  const [travelers, setTravelers] = useState<TravelerForm[]>(createTravelers(initialAdults, initialChildren, initialInfants))

  const schedule = useMemo(
    () => tour.schedules.find((item) => item.id === selectedScheduleId) || tour.schedules[0],
    [selectedScheduleId, tour.schedules]
  )

  const loginHref = useMemo(() => {
    const queryString = searchParams.toString()
    const redirectTarget = queryString ? `${pathname}?${queryString}` : pathname
    return `/login?redirect=${encodeURIComponent(redirectTarget)}`
  }, [pathname, searchParams])

  const authenticatedUserId = user?.id || null
  const accessToken = session?.access_token || null
  const isAuthenticated = Boolean(authenticatedUserId && accessToken)

  useEffect(() => {
    setTravelers((previous) => createTravelers(adults, children, infants, previous))
  }, [adults, children, infants])

  useEffect(() => {
    if (!profile) return
    setContact((previous) => ({
      ...previous,
      fullName: previous.fullName || profile.full_name || "",
      email: previous.email || profile.email || "",
      phone: previous.phone || profile.phone || "",
    }))
  }, [profile])

  const scopedCoupons = useMemo(
    () =>
      coupons.filter((coupon) => {
        const matchesTour = !coupon.scopedTourIds.length || coupon.scopedTourIds.includes(tour.id)
        const matchesCategory =
          !coupon.scopedCategoryIds.length ||
          tour.categories.some((category) => coupon.scopedCategoryIds.includes(category.id))
        return matchesTour && matchesCategory
      }),
    [coupons, tour.categories, tour.id]
  )

  const subtotal = schedule ? computeSubtotal({ adults, children, infants }, schedule.prices) : 0
  const appliedCoupon = scopedCoupons.find((coupon) => coupon.code.toLowerCase() === couponCode.trim().toLowerCase())
  const discountAmount = computeCouponDiscount(subtotal, appliedCoupon)
  const totalAmount = Math.max(0, subtotal - discountAmount)

  const canProceedCustomer = Boolean(contact.fullName && contact.email && contact.phone && travelers.every((traveler) => traveler.fullName))
  const canProceedPayment = Boolean(paymentMethodCode)

  const updateTraveler = (index: number, field: keyof TravelerForm, value: string) => {
    setTravelers((previous) => {
      const next = [...previous]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const onSubmit = async () => {
    if (!isAuthenticated || !accessToken || !authenticatedUserId) {
      setStatusMessage("Bạn cần đăng nhập để tạo booking.")
      return
    }

    if (!schedule) {
      setStatusMessage("Không tìm thấy lịch khởi hành phù hợp.")
      return
    }

    setIsSubmitting(true)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: authenticatedUserId,
          tourId: tour.id,
          tourSlug: tour.slug,
          scheduleId: schedule.id,
          paymentMethodCode,
          couponCode: couponCode.trim() || null,
          counts: {
            adults,
            children,
            infants,
          },
          contact: {
            fullName: contact.fullName,
            email: contact.email,
            phone: contact.phone,
          },
          customerNote: `${contact.note}${customerNote ? `\n${customerNote}` : ""}`.trim(),
          travelers,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Không thể tạo booking")
      }

      startTransition(() => {
        router.push(`/booking/${result.bookingCode}`)
      })
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Đã xảy ra lỗi khi tạo booking.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!schedule) {
    return <div className="surface-panel p-8 text-slate-500">Tour này hiện chưa có lịch khởi hành để đặt.</div>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {!isAuthenticated ? (
          <>
            <div className="surface-panel p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Lock className="size-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight text-slate-950">Đăng nhập để đặt tour</div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                    Khi chưa đăng nhập, bạn vẫn có thể xem lịch khởi hành, giá và tóm tắt đặt chỗ. Hãy đăng nhập để điền thông tin hành khách và hoàn tất booking.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="rounded-full bg-primary px-6 text-white hover:bg-blue-700">
                  <Link href={loginHref}>Đăng nhập để tiếp tục</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link href={`/tours/${tour.slug}`}>Quay lại chi tiết tour</Link>
                </Button>
              </div>
            </div>

            <div className="surface-panel p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight text-slate-950">Thông tin bạn đang xem</div>
                  <div className="text-sm text-slate-500">Bản xem trước checkout ở chế độ khách.</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.7rem] bg-slate-50 p-5 text-sm text-slate-600">
                  <div className="font-bold text-slate-950">Lịch khởi hành</div>
                  <div className="mt-3 space-y-2">
                    <div>{formatLongDate(schedule.departureDate)}</div>
                    <div>Điểm hẹn: {schedule.meetingPoint}</div>
                    <div>Trạng thái: {statusLabel(schedule.status)}</div>
                  </div>
                </div>
                <div className="rounded-[1.7rem] bg-slate-50 p-5 text-sm text-slate-600">
                  <div className="font-bold text-slate-950">Quy mô booking</div>
                  <div className="mt-3 space-y-2">
                    <div>{adults} người lớn</div>
                    <div>{children} trẻ em</div>
                    <div>{infants} em bé</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50/60 p-5 text-sm leading-7 text-slate-500">
                Sau khi đăng nhập, hệ thống sẽ tự dùng thông tin profile của bạn để điền trước liên hệ và cho phép gửi booking an toàn qua API nội bộ.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="surface-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                {[
                  [1, "Thông tin khách hàng"],
                  [2, "Thanh toán"],
                  [3, "Xác nhận"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (value === 1 || (value === 2 && canProceedCustomer) || (value === 3 && canProceedCustomer && canProceedPayment)) {
                        setStep(Number(value))
                      }
                    }}
                    className={`flex items-center gap-3 rounded-full px-4 py-2 transition ${step === value ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-white/15 font-bold">{value}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="surface-panel p-6 sm:p-8">
              {step === 1 ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <UserRoundCheck className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-tight text-slate-950">Thông tin liên hệ</div>
                      <div className="text-sm text-slate-500">Thông tin này sẽ được lưu vào booking để đội vận hành liên hệ.</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Họ và tên</label>
                      <Input value={contact.fullName} onChange={(event) => setContact((prev) => ({ ...prev, fullName: event.target.value }))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Email</label>
                      <Input type="email" value={contact.email} onChange={(event) => setContact((prev) => ({ ...prev, email: event.target.value }))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Số điện thoại</label>
                      <Input value={contact.phone} onChange={(event) => setContact((prev) => ({ ...prev, phone: event.target.value }))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Quốc tịch</label>
                      <select value={contact.country} onChange={(event) => setContact((prev) => ({ ...prev, country: event.target.value }))} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-4 text-sm outline-none">
                        <option>Việt Nam</option>
                        <option>Singapore</option>
                        <option>Thailand</option>
                        <option>South Korea</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Người lớn</span>
                      <Input type="number" min={1} value={adults} onChange={(event) => setAdults(Math.max(1, Number(event.target.value) || 1))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Trẻ em</span>
                      <Input type="number" min={0} value={children} onChange={(event) => setChildren(Math.max(0, Number(event.target.value) || 0))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Em bé</span>
                      <Input type="number" min={0} value={infants} onChange={(event) => setInfants(Math.max(0, Number(event.target.value) || 0))} className="h-12 rounded-2xl bg-slate-100/80" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Lịch khởi hành</span>
                      <select value={selectedScheduleId} onChange={(event) => setSelectedScheduleId(event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100/80 px-4 text-sm outline-none">
                        {tour.schedules.map((item) => (
                          <option key={item.id} value={item.id}>
                            {formatLongDate(item.departureDate)} - {formatCurrency(item.basePrice)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div className="text-lg font-black tracking-tight text-slate-950">Danh sách hành khách</div>
                    <div className="grid gap-4">
                      {travelers.map((traveler, index) => (
                        <div key={`${traveler.travelerType}-${index}`} className="rounded-[1.7rem] border border-slate-200 bg-slate-50/80 p-5">
                          <div className="mb-4 flex items-center justify-between gap-3">
                            <div className="font-bold text-slate-950">{index + 1}. {traveler.travelerType === "adult" ? "Người lớn" : traveler.travelerType === "child" ? "Trẻ em" : "Em bé"}</div>
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Hành khách</div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <Input placeholder="Họ và tên" value={traveler.fullName} onChange={(event) => updateTraveler(index, "fullName", event.target.value)} className="h-12 rounded-2xl bg-white" />
                            <Input placeholder="Email" value={traveler.email} onChange={(event) => updateTraveler(index, "email", event.target.value)} className="h-12 rounded-2xl bg-white" />
                            <Input placeholder="Số điện thoại" value={traveler.phone} onChange={(event) => updateTraveler(index, "phone", event.target.value)} className="h-12 rounded-2xl bg-white" />
                            <Input type="date" value={traveler.dateOfBirth} onChange={(event) => updateTraveler(index, "dateOfBirth", event.target.value)} className="h-12 rounded-2xl bg-white" />
                            <Input placeholder="CCCD/Passport" value={traveler.idNumber} onChange={(event) => updateTraveler(index, "idNumber", event.target.value)} className="h-12 rounded-2xl bg-white" />
                            <select value={traveler.gender} onChange={(event) => updateTraveler(index, "gender", event.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none">
                              <option value="male">Nam</option>
                              <option value="female">Nữ</option>
                              <option value="other">Khác</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Yêu cầu đặc biệt</label>
                    <textarea value={contact.note} onChange={(event) => setContact((prev) => ({ ...prev, note: event.target.value }))} className="min-h-32 w-full rounded-[1.6rem] border border-slate-200 bg-slate-100/80 px-4 py-4 text-sm outline-none" placeholder="Ví dụ: chế độ ăn, ghế em bé, ghi chú cho điều hành..." />
                  </div>

                  <div className="flex justify-end">
                    <Button disabled={!canProceedCustomer} onClick={() => setStep(2)} className="rounded-full bg-sky-600 px-6 py-6 text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                      Tiếp theo: Thanh toán
                    </Button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <CreditCard className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-tight text-slate-950">Thanh toán và ưu đãi</div>
                      <div className="text-sm text-slate-500">Chọn phương thức thanh toán, mã giảm giá và ghi chú xác nhận.</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethodCode(method.code)}
                        className={`rounded-[1.7rem] border p-5 text-left transition ${paymentMethodCode === method.code ? "border-sky-500 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <div className="text-sm font-extrabold uppercase tracking-[0.24em] text-slate-400">{method.providerName || method.name}</div>
                        <div className="mt-2 text-xl font-black tracking-tight text-slate-950">{method.name}</div>
                        <p className="mt-2 text-sm leading-7 text-slate-500">{method.description}</p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Mã giảm giá</label>
                      <Input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Nhập SUMMER10, FAMILY500..." className="h-12 rounded-2xl bg-slate-100/80 uppercase" />
                    </div>
                    <div className="flex items-end text-sm text-slate-500">{appliedCoupon ? `${appliedCoupon.name} - giảm ${formatCurrency(discountAmount)}` : "Mã sẽ được kiểm tra khi gửi."}</div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Ghi chú bổ sung</label>
                    <textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} className="min-h-28 w-full rounded-[1.6rem] border border-slate-200 bg-slate-100/80 px-4 py-4 text-sm outline-none" placeholder="Bổ sung thông tin xuất hóa đơn, ưu tiên phòng, ghi chú thanh toán..." />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <Button variant="outline" onClick={() => setStep(1)} className="rounded-full px-6 py-6">Quay lại</Button>
                    <Button disabled={!canProceedPayment} onClick={() => setStep(3)} className="rounded-full bg-sky-600 px-6 py-6 text-white hover:bg-sky-700">Xem xác nhận</Button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-8">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-black tracking-tight text-slate-950">Xác nhận đặt chỗ</div>
                      <div className="text-sm text-slate-500">Kiểm tra thông tin lần cuối trước khi xác nhận đặt chỗ.</div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1.7rem] bg-slate-50 p-5 text-sm text-slate-600">
                      <div className="font-bold text-slate-950">Liên hệ</div>
                      <div className="mt-3 space-y-2">
                        <div>{contact.fullName}</div>
                        <div>{contact.email}</div>
                        <div>{contact.phone}</div>
                      </div>
                    </div>
                    <div className="rounded-[1.7rem] bg-slate-50 p-5 text-sm text-slate-600">
                      <div className="font-bold text-slate-950">Thanh toán</div>
                      <div className="mt-3 space-y-2">
                        <div>{paymentMethods.find((method) => method.code === paymentMethodCode)?.name}</div>
                        <div>{appliedCoupon ? `Mã giảm giá: ${appliedCoupon.code}` : "Không áp dụng coupon"}</div>
                        <div>{travelers.length} hành khách</div>
                      </div>
                    </div>
                  </div>

                  {statusMessage ? <div className="rounded-[1.6rem] bg-rose-50 px-4 py-4 text-sm text-rose-700">{statusMessage}</div> : null}

                  <div className="flex items-center justify-between gap-4">
                    <Button variant="outline" onClick={() => setStep(2)} className="rounded-full px-6 py-6">Quay lại</Button>
                    <Button disabled={isSubmitting} onClick={onSubmit} className="rounded-full bg-orange-500 px-6 py-6 text-white hover:bg-orange-600">
                      {isSubmitting ? "Đang tạo booking..." : "Hoàn tất đặt chỗ"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>

      <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
        <div className="surface-panel overflow-hidden">
          <div className="relative aspect-[5/3]">
            <Image src={tour.coverImage} alt={tour.name} fill className="object-cover" />
          </div>
          <div className="p-6">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-sky-600">Tour đã chọn</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{tour.name}</div>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="size-4 text-sky-600" />
              {formatLongDate(schedule.departureDate)}
            </div>
            <div className="mt-3 text-sm text-slate-500">Trạng thái lịch: {statusLabel(schedule.status)}</div>
          </div>
        </div>

        <div className="surface-panel p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Tạm tính</span>
            <span className="text-sm font-semibold text-slate-950">{travelers.length} hành khách</span>
          </div>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Người lớn x {adults}</span>
              <span>{formatCurrency((schedule.prices.find((item) => item.travelerType === "adult")?.salePrice ?? schedule.prices.find((item) => item.travelerType === "adult")?.price ?? 0) * adults)}</span>
            </div>
            <div className="flex justify-between">
              <span>Trẻ em x {children}</span>
              <span>{formatCurrency((schedule.prices.find((item) => item.travelerType === "child")?.salePrice ?? schedule.prices.find((item) => item.travelerType === "child")?.price ?? 0) * children)}</span>
            </div>
            <div className="flex justify-between">
              <span>Em bé x {infants}</span>
              <span>{formatCurrency((schedule.prices.find((item) => item.travelerType === "infant")?.salePrice ?? schedule.prices.find((item) => item.travelerType === "infant")?.price ?? 0) * infants)}</span>
            </div>
            <div className="flex justify-between">
              <span>Giảm giá</span>
              <span>-{formatCurrency(discountAmount)}</span>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-slate-950">Tổng cộng</span>
              <span className="text-3xl font-black tracking-tight text-sky-700">{formatCurrency(totalAmount)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] bg-sky-50 p-6 text-sm leading-7 text-slate-600">
          <div className="mb-2 font-bold text-slate-950">Thanh toán an toàn</div>
          {!isAuthenticated
            ? "Bạn đang ở chế độ xem. Đăng nhập để hoàn tất đặt tour và lưu thông tin của bạn."
            : "Sau khi đặt chỗ, bạn có thể tiếp tục sang bước xác nhận và thanh toán một cách thuận tiện."}
        </div>
      </aside>
    </div>
  )
}

