import Link from "next/link"
import { ArrowRight, CalendarDays, ShieldCheck } from "lucide-react"

import { BookingWizard } from "@/components/site/booking-wizard"
import { Button } from "@/components/ui/button"
import { getBookingReferenceData, getSiteCatalog } from "@/lib/site-data"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export const dynamic = "force-dynamic"

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams
  const tourSlug = readParam(query.tour) || undefined
  const scheduleId = readParam(query.schedule) || undefined
  const adults = Math.max(1, Number(readParam(query.adults) || 2))
  const children = Math.max(0, Number(readParam(query.children) || 0))
  const infants = Math.max(0, Number(readParam(query.infants) || 0))

  const [{ tour, paymentMethods, coupons }, catalog] = await Promise.all([
    getBookingReferenceData(tourSlug),
    getSiteCatalog(),
  ])

  const selectedTour = tour || catalog.featuredTours[0] || catalog.tours[0]

  if (!selectedTour) {
    return (
      <div className="page-container py-14">
        <div className="surface-panel p-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Chưa có tour để checkout</h1>
          <p className="mt-3 text-slate-500">Hiện chưa có tour phù hợp để tiếp tục đặt chỗ. Bạn có thể quay lại danh sách tour để chọn hành trình khác.</p>
          <Button asChild className="mt-6 rounded-full bg-primary text-white hover:bg-blue-700">
            <Link href="/tours">Mở danh sách tours</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container py-12">
      <section className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-4xl">
          <div className="eyebrow">Checkout</div>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">Hoàn tất đặt chỗ của bạn</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-500">
            Kiểm tra lại thông tin hành trình, chọn phương thức thanh toán phù hợp và hoàn tất đặt chỗ chỉ trong vài bước.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline" className="rounded-full px-5">
            <Link href={`/tours/${selectedTour.slug}`}>Quay lại chi tiết tour</Link>
          </Button>
          <Button asChild className="rounded-full bg-primary px-5 text-white hover:bg-blue-700">
            <Link href="/account">
              Tài khoản
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        {[
          ["1", "Thông tin khách hàng", "Xác nhận người liên hệ và hành khách"],
          ["2", "Thanh toán", "Chọn phương thức và mã ưu đãi"],
          ["3", "Xác nhận", "Kiểm tra lần cuối trước khi tạo booking"],
        ].map(([step, label, caption], index) => (
          <div key={step} className="surface-panel flex items-center gap-4 p-5">
            <div className={`flex size-11 items-center justify-center rounded-full font-bold ${index === 0 ? "bg-primary text-white" : "bg-slate-100 text-slate-500"}`}>{step}</div>
            <div>
              <div className="font-bold text-slate-950">{label}</div>
              <div className="text-sm text-slate-500">{caption}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="surface-panel flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <div className="font-bold text-slate-950">Tour đã chọn</div>
            <div className="text-sm text-slate-500">{selectedTour.name}</div>
          </div>
        </div>
        <div className="surface-panel flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-50 text-secondary">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <div className="font-bold text-slate-950">Phương thức sẵn sàng</div>
            <div className="text-sm text-slate-500">{paymentMethods.length} lựa chọn thanh toán</div>
          </div>
        </div>
        <div className="surface-panel flex items-center gap-4 p-5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">%</div>
          <div>
            <div className="font-bold text-slate-950">Coupon khả dụng</div>
            <div className="text-sm text-slate-500">{coupons.length} ưu đãi có thể áp dụng</div>
          </div>
        </div>
      </div>

      <BookingWizard
        tour={selectedTour}
        scheduleId={scheduleId}
        initialAdults={adults}
        initialChildren={children}
        initialInfants={infants}
        paymentMethods={paymentMethods}
        coupons={coupons}
      />
    </div>
  )
}

