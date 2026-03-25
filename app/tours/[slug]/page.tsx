import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Clock3, Map, MapPin, ShieldCheck, Star } from "lucide-react"

import { ReviewCard } from "@/components/site/review-card"
import { SectionHeading } from "@/components/site/section-heading"
import { StatusPill } from "@/components/site/status-pill"
import { WishlistButton } from "@/components/site/wishlist-button"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatLongDate, formatShortDate } from "@/lib/format"
import { getTourBySlug } from "@/lib/site-data"

export const dynamic = "force-dynamic"

export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tour = await getTourBySlug(slug)

  if (!tour) {
    notFound()
  }

  const primarySchedule = tour.schedules.find((schedule) => schedule.status === "open") || tour.schedules[0]

  return (
    <div className="pb-12">
      <section className="page-container pt-10">
        <div className="mb-5 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/" className="transition hover:text-slate-700">Trang chủ</Link>
          <span>/</span>
          <Link href="/tours" className="transition hover:text-slate-700">Tours</Link>
          <span>/</span>
          <span className="text-primary">{tour.name}</span>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-balance text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">{tour.name}</h1>
            <div className="mt-5 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Star className="size-4 fill-orange-400 text-orange-400" />
                <span className="font-bold text-slate-950">{tour.ratingAverage ? tour.ratingAverage.toFixed(1) : "Mới"}</span>
                <span>({tour.reviewCount} đánh giá)</span>
              </div>
              <div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" />{tour.durationLabel}</div>
              <div className="flex items-center gap-2"><MapPin className="size-4 text-primary" />{tour.destinationLabel}</div>
            </div>
          </div>
          <div className="surface-panel flex flex-wrap items-center gap-4 p-5">
            <div>
              <div className="text-sm text-slate-400">Giá từ</div>
              <div className="mt-2 text-4xl font-black tracking-tight text-primary">{formatCurrency(tour.startingPrice)}</div>
              <div className="mt-1 text-sm text-slate-500">/khách</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <WishlistButton tourId={tour.id} variant="pill" />
              <Button asChild className="rounded-full bg-primary px-6 text-white hover:bg-blue-700">
                <Link href={`/checkout?tour=${tour.slug}${primarySchedule ? `&schedule=${primarySchedule.id}` : ""}&adults=2&children=0&infants=0`}>
                  Đặt ngay
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="page-container mt-10 grid gap-4 md:grid-cols-4 md:grid-rows-2 md:[grid-auto-rows:minmax(0,1fr)]">
        {tour.gallery.slice(0, 4).map((image, index) => (
          <div
            key={image.id}
            className={`relative overflow-hidden rounded-[2rem] border border-white/70 shadow-[0_24px_70px_rgba(25,27,36,0.12)] ${index === 0 ? "md:col-span-2 md:row-span-2 min-h-[22rem]" : "min-h-[12rem]"}`}
          >
            <Image src={image.image_url} alt={image.alt_text || tour.name} fill className="object-cover" />
          </div>
        ))}
      </section>

      <section className="page-container mt-14 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-12">
          <div>
            <SectionHeading eyebrow="Tổng quan chuyến đi" title="Những gì bạn nhận được trong hành trình này" description={tour.shortDescription} />
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Khách sạn", tour.includedItems[0] || "Khách sạn chọn lọc"],
                ["Ăn uống", tour.includedItems[1] || "Các bữa theo lịch trình"],
                ["Di chuyển", tour.includedItems[2] || "Xe đưa đón / transfer"],
                ["Hỗ trợ", tour.includedItems[3] || "Hướng dẫn viên và hotline"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[1.6rem] bg-[#eff2ff] p-5">
                  <div className="text-sm font-semibold text-slate-900">{label}</div>
                  <div className="mt-3 text-sm leading-7 text-slate-500">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel p-8">
            <SectionHeading eyebrow="Lịch trình" title="Lịch trình chi tiết" />
            <div className="mt-10 space-y-7">
              {tour.itinerary.map((day, index) => (
                <div key={day.id} className="flex gap-5">
                  <div className="relative flex flex-col items-center">
                    <div className="flex size-11 items-center justify-center rounded-full bg-primary font-bold text-white shadow-lg shadow-blue-600/25">{index + 1}</div>
                    {index < tour.itinerary.length - 1 ? <div className="mt-3 h-full w-px bg-slate-200" /> : null}
                  </div>
                  <div className="pb-3">
                    <h3 className="text-xl font-black tracking-tight text-slate-950">{day.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{day.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {day.meals?.map((meal) => (
                        <span key={meal} className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{meal}</span>
                      ))}
                      {day.accommodation ? <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{day.accommodation}</span> : null}
                      {day.transportation ? <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold">{day.transportation}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel overflow-hidden p-8">
            <SectionHeading eyebrow="Lộ trình" title="Lộ trình chuyến đi" description="Theo dõi những điểm dừng nổi bật trong suốt hành trình của bạn." />
            <div className="mt-8 overflow-hidden rounded-[2rem] bg-sky-50">
              <div className="soft-grid relative flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-sky-50 via-white to-sky-100">
                <div className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-[0_20px_60px_rgba(25,27,36,0.12)]">
                  <Map className="mr-2 inline size-4 text-primary" />
                  {tour.destinations.map((item) => item.name).join(" • ")}
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionHeading eyebrow="Reviews" title="Đánh giá từ khách hàng" />
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              {tour.reviews.length ? tour.reviews.slice(0, 4).map((review) => <ReviewCard key={review.id} review={review} />) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="surface-panel p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm text-slate-400">Giá từ</div>
                <div className="mt-2 text-4xl font-black tracking-tight text-primary">{formatCurrency(tour.startingPrice)}</div>
              </div>
              <StatusPill status={primarySchedule?.status || "open"} />
            </div>

            {primarySchedule ? (
              <div className="mt-6 space-y-4 rounded-[1.8rem] bg-slate-50 p-5 text-sm text-slate-600">
                <div className="flex items-start justify-between gap-4">
                  <span>Ngày khởi hành</span>
                  <span className="font-semibold text-slate-950">{formatLongDate(primarySchedule.departureDate)}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>Điểm hẹn</span>
                  <span className="max-w-[12rem] text-right font-semibold text-slate-950">{primarySchedule.meetingPoint}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>Số chỗ còn lại</span>
                  <span className="font-semibold text-slate-950">{primarySchedule.availableSlots} / {primarySchedule.capacity}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span>Giá người lớn</span>
                  <span className="font-semibold text-slate-950">{formatCurrency(primarySchedule.prices.find((item) => item.travelerType === "adult")?.salePrice ?? primarySchedule.prices.find((item) => item.travelerType === "adult")?.price ?? 0)}</span>
                </div>
                {primarySchedule.cutoffAt ? (
                  <div className="flex items-start justify-between gap-4">
                    <span>Hạn giữ chỗ</span>
                    <span className="font-semibold text-slate-950">{formatLongDate(primarySchedule.cutoffAt)}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 grid gap-3">
              <Button asChild className="h-12 rounded-full bg-primary text-white hover:bg-blue-700">
                <Link href={`/checkout?tour=${tour.slug}${primarySchedule ? `&schedule=${primarySchedule.id}` : ""}&adults=2&children=0&infants=0`}>
                  Đặt ngay
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full">
                <Link href={`/tours?destination=${tour.destinations[0]?.slug || ""}`}>Xem tour tương tự</Link>
              </Button>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-[1.5rem] bg-blue-50 px-4 py-4 text-sm text-slate-600">
              <ShieldCheck className="size-5 text-primary" />
              <span>Bạn có thể xem trước thông tin đặt chỗ, sau đó đăng nhập để hoàn tất booking và lưu hành trình.</span>
            </div>
          </div>

          <div className="surface-panel p-6">
            <div className="text-xl font-black tracking-tight text-slate-950">Lịch khởi hành</div>
            <div className="mt-5 space-y-3">
              {tour.schedules.slice(0, 4).map((schedule) => (
                <div key={schedule.id} className="rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-950">{formatShortDate(schedule.departureDate)}</div>
                      <div className="text-sm text-slate-500">Còn {schedule.availableSlots} chỗ</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">{formatCurrency(schedule.basePrice)}</div>
                      <div className="text-xs text-slate-400">/khách</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  )
}

