import Image from "next/image"
import Link from "next/link"
import { CalendarDays, MapPin, Star, Users } from "lucide-react"

import type { TourSummary } from "@/lib/site-data"
import { formatCurrency, formatShortDate } from "@/lib/format"
import { Button } from "@/components/ui/button"

export function TourCard({ tour, featured = false }: { tour: TourSummary; featured?: boolean }) {
  const nextSchedule = tour.schedules.find((schedule) => schedule.status === "open") || tour.schedules[0]

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/70 bg-white/86 shadow-[0_24px_70px_rgba(25,27,36,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_32px_90px_rgba(0,80,203,0.14)]">
      <Link href={`/tours/${tour.slug}`} className="block">
        <div className="relative aspect-[5/4] overflow-hidden">
          <Image
            src={tour.coverImage}
            alt={tour.name}
            fill
            className="object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/0 to-transparent" />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {tour.isFeatured ? <span className="rounded-full bg-white/88 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Phổ biến</span> : null}
            {tour.tags[0] ? <span className="rounded-full bg-slate-950/65 px-3 py-1 text-[11px] font-semibold text-white">{tour.tags[0].name}</span> : null}
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm text-white/80">
                <MapPin className="size-4" />
                <span>{tour.destinationLabel}</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight">{tour.name}</h3>
            </div>
            <div className="rounded-full bg-white/92 px-3 py-2 text-sm font-bold text-slate-950 shadow-lg">
              {tour.ratingAverage ? tour.ratingAverage.toFixed(1) : "Mới"}
            </div>
          </div>
        </div>
      </Link>

      <div className="space-y-5 p-6">
        <p className="line-clamp-2 text-sm leading-7 text-slate-500">{tour.shortDescription}</p>

        <div className="grid grid-cols-2 gap-3 text-sm text-slate-500">
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100/80 px-3 py-3">
            <CalendarDays className="size-4 text-primary" />
            <span>{tour.durationLabel}</span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-100/80 px-3 py-3">
            <Users className="size-4 text-primary" />
            <span>{tour.viewerCount} người đang xem</span>
          </div>
        </div>

        {nextSchedule ? (
          <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/90 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Khởi hành tiếp theo</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-slate-950">{formatShortDate(nextSchedule.departureDate)}</div>
                <div className="text-sm text-slate-500">Còn {nextSchedule.availableSlots} chỗ khả dụng</div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Giá từ</div>
                <div className="text-2xl font-black tracking-tight text-primary">{formatCurrency(tour.startingPrice)}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Star className="size-4 fill-orange-400 text-orange-400" />
            <span>{tour.reviewCount ? `${tour.reviewCount} đánh giá` : "Chưa có đánh giá"}</span>
          </div>
          <Button asChild className={featured ? "rounded-full bg-secondary px-5 text-white hover:bg-orange-600" : "rounded-full bg-primary px-5 text-white hover:bg-blue-700"}>
            <Link href={`/tours/${tour.slug}`}>Đặt ngay</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
