import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Compass, MapPinned } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getSiteCatalog } from "@/lib/site-data"

export const dynamic = "force-dynamic"

export default async function DestinationsPage() {
  const { destinations } = await getSiteCatalog()

  return (
    <div className="page-container py-12">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <div className="eyebrow">Destinations</div>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">Bản đồ cảm hứng cho mọi hành trình</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-500">
            Khám phá những điểm đến nổi bật và bắt đầu chuyến đi từ nơi truyền cảm hứng cho bạn nhất.
          </p>
        </div>
        <div className="surface-panel soft-grid grid gap-4 p-6 sm:grid-cols-3">
          {[
            ["Điểm đến", `${destinations.length}+`],
            ["Tour liên kết", `${destinations.reduce((sum, item) => sum + item.totalTours, 0)}`],
            ["Trạng thái", "Đang mở bán"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[1.6rem] bg-white/85 p-5 text-center shadow-[0_16px_40px_rgba(25,27,36,0.06)]">
              <div className="text-sm text-slate-400">{label}</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-6 xl:grid-cols-3">
        {destinations.map((destination) => (
          <Link
            key={destination.location.id}
            href={`/tours?destination=${destination.location.slug}`}
            className="group relative min-h-[320px] overflow-hidden rounded-[2rem]"
          >
            <Image src={destination.featuredImage} alt={destination.location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/15 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4 text-white">
              <div>
                <div className="text-3xl font-black tracking-tight">{destination.location.name}</div>
                <div className="mt-2 text-sm text-white/80">{destination.totalTours} hành trình đang mở bán</div>
              </div>
              <span className="flex size-12 items-center justify-center rounded-full bg-white/12 transition group-hover:bg-white/18">
                <ArrowRight className="size-5" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="surface-panel mt-16 grid gap-8 p-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <div>
          <div className="eyebrow">Explore</div>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Tìm tour theo vùng và phong cách chuyến đi</h2>
          <p className="mt-4 text-base leading-8 text-slate-500">
            Chọn điểm đến theo sở thích, nhịp nghỉ dưỡng và kiểu trải nghiệm bạn đang tìm kiếm.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="rounded-full bg-primary px-5 text-white hover:bg-blue-700">
              <Link href="/tours">
                Xem tất cả tours
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link href="/reviews">Xem reviews</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.8rem] bg-blue-50 p-6">
            <Compass className="size-7 text-primary" />
            <div className="mt-5 text-2xl font-black tracking-tight text-slate-950">Chọn theo vibe</div>
            <p className="mt-3 text-sm leading-7 text-slate-500">Từ nghỉ dưỡng sang trọng, du lịch gia đình đến những chuyến đi giàu trải nghiệm văn hóa, bạn đều có thể bắt đầu thật nhanh.</p>
          </div>
          <div className="rounded-[1.8rem] bg-orange-50 p-6">
            <MapPinned className="size-7 text-secondary" />
            <div className="mt-5 text-2xl font-black tracking-tight text-slate-950">Từ cảm hứng sang booking</div>
            <p className="mt-3 text-sm leading-7 text-slate-500">Mỗi điểm đến đều dẫn bạn đến danh sách tour phù hợp để dễ dàng chọn và đặt chỗ.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

