import Link from "next/link"
import { ArrowRight, Search, SlidersHorizontal, Sparkles } from "lucide-react"

import { EmptyState } from "@/components/site/empty-state"
import { TourCard } from "@/components/site/tour-card"
import { Button } from "@/components/ui/button"
import { filterTours, getToursPageData } from "@/lib/site-data"

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export const dynamic = "force-dynamic"

export default async function ToursPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams
  const q = readParam(query.q) || ""
  const category = readParam(query.category) || ""
  const destination = readParam(query.destination) || ""
  const duration = readParam(query.duration) || ""
  const sort = readParam(query.sort) || "featured"
  const minPrice = Number(readParam(query.min) || "")
  const maxPrice = Number(readParam(query.max) || "")

  const { tours, categories, destinations } = await getToursPageData()
  const filteredTours = filterTours(tours, {
    query: q,
    category: category || undefined,
    destination: destination || undefined,
    duration: duration || undefined,
    minPrice: Number.isFinite(minPrice) && minPrice > 0 ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
    sort,
  })

  return (
    <div className="page-container py-12">
      <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="eyebrow">Tours</div>
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">Khám phá thế giới</h1>
          <p className="mt-4 text-lg leading-8 text-slate-500">
            Tìm kiếm những hành trình độc đáo được thiết kế cho cả cảm hứng khám phá lẫn nhu cầu đặt chỗ thực tế.
          </p>
        </div>
        <Button asChild variant="ghost" className="w-fit rounded-full px-4 text-primary">
          <Link href="/destinations">
            Xem destinations
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="surface-panel h-fit p-6 lg:sticky lg:top-28">
          <div className="mb-6 flex items-center gap-3 text-slate-950">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <SlidersHorizontal className="size-5" />
            </div>
            <div>
              <div className="text-xl font-black tracking-tight">Bộ lọc tìm kiếm</div>
              <div className="text-sm text-slate-500">Tinh chỉnh theo giá, điểm đến và thời lượng.</div>
            </div>
          </div>

          <form className="space-y-6">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Từ khóa</span>
              <div className="flex items-center gap-3 rounded-[1.2rem] bg-slate-100 px-4 py-3 text-sm text-slate-500">
                <Search className="size-4 text-slate-400" />
                <input name="q" defaultValue={q} placeholder="Ví dụ: Hạ Long, luxury, family..." className="w-full bg-transparent outline-none placeholder:text-slate-400" />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Điểm đến</span>
              <select name="destination" defaultValue={destination} className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none">
                <option value="">Tất cả điểm đến</option>
                {destinations.map((item) => (
                  <option key={item.location.id} value={item.location.slug}>
                    {item.location.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Loại tour</span>
              <select name="category" defaultValue={category} className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none">
                <option value="">Tất cả loại tour</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Giá từ</span>
                <input name="min" defaultValue={readParam(query.min) || ""} type="number" min="0" step="500000" className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Đến</span>
                <input name="max" defaultValue={readParam(query.max) || ""} type="number" min="0" step="500000" className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none" />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Thời gian</span>
              <select name="duration" defaultValue={duration} className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none">
                <option value="">Mọi thời lượng</option>
                <option value="1-3">1-3 ngày</option>
                <option value="4-7">4-7 ngày</option>
                <option value="8-14">8-14 ngày</option>
                <option value="14+">Trên 14 ngày</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Sắp xếp</span>
              <select name="sort" defaultValue={sort} className="h-12 w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 text-sm outline-none">
                <option value="featured">Nổi bật nhất</option>
                <option value="departure">Khởi hành sớm nhất</option>
                <option value="price-asc">Giá tăng dần</option>
                <option value="price-desc">Giá giảm dần</option>
                <option value="rating">Đánh giá cao nhất</option>
              </select>
            </label>

            <div className="flex gap-3">
              <Button className="flex-1 rounded-full bg-primary py-6 text-white hover:bg-blue-700">Áp dụng</Button>
              <Button asChild variant="outline" className="rounded-full px-5 py-6">
                <Link href="/tours">Đặt lại</Link>
              </Button>
            </div>
          </form>
        </aside>

        <section className="space-y-6">
          <div className="surface-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-sm text-slate-500">Kết quả tìm thấy</div>
              <div className="mt-2 text-3xl font-black tracking-tight text-slate-950">{filteredTours.length} hành trình phù hợp</div>
              <div className="mt-2 text-sm text-slate-500">
                {q ? `Từ khóa: “${q}”` : "Đang hiển thị toàn bộ danh sách tour công khai"}
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-500">
              <Sparkles className="size-4 text-primary" />
              Filter theo query string để dễ chia sẻ và test UI.
            </div>
          </div>

          {filteredTours.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredTours.map((tour) => (
                <TourCard key={tour.id} tour={tour} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Không tìm thấy tour phù hợp"
              description="Thử đổi từ khóa, khoảng giá hoặc loại tour. Bộ lọc hiện đang đọc trực tiếp từ query string của URL."
            />
          )}
        </section>
      </div>
    </div>
  )
}
