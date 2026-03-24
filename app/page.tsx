import Image from "next/image"
import Link from "next/link"
import { ArrowRight, CalendarDays, MapPin, Sparkles, Users } from "lucide-react"

import { ReviewCard } from "@/components/site/review-card"
import { SectionHeading } from "@/components/site/section-heading"
import { TourCard } from "@/components/site/tour-card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import { getHomepageData } from "@/lib/site-data"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const { heroBanner, secondaryBanners, featuredTours, destinations, reviews, coupons } = await getHomepageData()
  const heroTour = featuredTours[0]
  const destinationShowcase = destinations.slice(0, 4)

  return (
    <div className="pb-10">
      <section className="page-container pt-8 sm:pt-10">
        <div className="relative overflow-hidden rounded-[2.8rem] border border-white/70 bg-slate-950 text-white shadow-[0_40px_120px_rgba(25,27,36,0.2)]">
          <div className="absolute inset-0">
            <Image
              src={heroBanner?.image_url || heroTour?.coverImage || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80"}
              alt={heroBanner?.title || heroTour?.name || "The Horizon hero"}
              fill
              priority
              className="object-cover"
            />
            <div className="hero-glow absolute inset-0" />
          </div>

          <div className="relative px-6 py-14 sm:px-10 lg:px-14 lg:py-20">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-balance text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Khám phá thế giới theo cách của bạn
              </h1>
              <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/82 sm:text-xl">
                Trải nghiệm những hành trình độc bản, từ đỉnh núi hùng vĩ đến những bãi biển thiên đường, trên một nền tảng đặt tour hiện đại và mượt mà.
              </p>
            </div>

            <form action="/tours" className="mx-auto mt-12 grid max-w-4xl gap-3 rounded-[1.6rem] border border-white/60 bg-white/90 p-4 text-slate-900 shadow-[0_24px_80px_rgba(25,27,36,0.2)] backdrop-blur-2xl md:grid-cols-[1.2fr_1fr_1fr_auto]">
              <label className="rounded-[1.2rem] px-4 py-3 transition hover:bg-slate-50">
                <div className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Địa điểm</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="size-4 text-slate-400" />
                  <input name="q" placeholder="Bạn muốn đi đâu?" className="w-full bg-transparent outline-none placeholder:text-slate-400" />
                </div>
              </label>
              <label className="rounded-[1.2rem] px-4 py-3 transition hover:bg-slate-50">
                <div className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Thời gian</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <CalendarDays className="size-4 text-slate-400" />
                  <input name="date" type="date" className="w-full bg-transparent outline-none" />
                </div>
              </label>
              <label className="rounded-[1.2rem] px-4 py-3 transition hover:bg-slate-50">
                <div className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Hành khách</div>
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <Users className="size-4 text-slate-400" />
                  <select name="guests" className="w-full bg-transparent outline-none">
                    <option value="2">2 khách</option>
                    <option value="1">1 khách</option>
                    <option value="4">4 khách</option>
                    <option value="6">6+ khách</option>
                  </select>
                </div>
              </label>
              <Button className="h-auto rounded-[1.3rem] bg-secondary px-6 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600">
                Tìm kiếm
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/78">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 backdrop-blur">
                <Sparkles className="size-4 text-orange-300" />
                {heroTour ? `Giá từ ${formatCurrency(heroTour.startingPrice)}` : "Ưu đãi mới mỗi tuần"}
              </span>
              {secondaryBanners[0] ? (
                <Link href={secondaryBanners[0].link_url || "/tours"} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur transition hover:bg-white/14">
                  {secondaryBanners[0].title}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="page-container mt-24">
        <div className="mb-10 flex items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Xu hướng"
            title="Tour phổ biến nhất"
            description="Danh sách được lấy trực tiếp từ dữ liệu Supabase hiện có, ưu tiên các tour nổi bật, lịch mở bán tốt và trải nghiệm được đánh giá cao."
          />
          <Button asChild variant="ghost" className="hidden rounded-full px-4 text-primary md:inline-flex">
            <Link href="/tours">
              Xem tất cả
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {featuredTours.slice(0, 3).map((tour, index) => (
            <TourCard key={tour.id} tour={tour} featured={index === 2} />
          ))}
        </div>
      </section>

      <section className="page-container mt-24">
        <div className="mb-12 text-center">
          <div className="eyebrow">Điểm đến</div>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">Điểm đến hàng đầu</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-12">
          {destinationShowcase[0] ? (
            <Link
              href={`/tours?destination=${destinationShowcase[0].location.slug}`}
              className="group relative min-h-[320px] overflow-hidden rounded-[2rem] md:col-span-7"
            >
              <Image src={destinationShowcase[0].featuredImage} alt={destinationShowcase[0].location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <div className="text-3xl font-black tracking-tight">{destinationShowcase[0].location.name}</div>
                <div className="mt-1 text-sm text-white/80">{destinationShowcase[0].totalTours}+ chuyến đi khám phá</div>
              </div>
            </Link>
          ) : null}

          {destinationShowcase[1] ? (
            <Link
              href={`/tours?destination=${destinationShowcase[1].location.slug}`}
              className="group relative min-h-[320px] overflow-hidden rounded-[2rem] md:col-span-5"
            >
              <Image src={destinationShowcase[1].featuredImage} alt={destinationShowcase[1].location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white">
                <div className="text-2xl font-black tracking-tight">{destinationShowcase[1].location.name}</div>
                <div className="mt-1 text-sm text-white/80">{destinationShowcase[1].totalTours} hành trình</div>
              </div>
            </Link>
          ) : null}

          {destinationShowcase[2] ? (
            <Link
              href={`/tours?destination=${destinationShowcase[2].location.slug}`}
              className="group relative min-h-[240px] overflow-hidden rounded-[2rem] md:col-span-4"
            >
              <Image src={destinationShowcase[2].featuredImage} alt={destinationShowcase[2].location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-5 left-5 text-white">
                <div className="text-2xl font-black tracking-tight">{destinationShowcase[2].location.name}</div>
                <div className="mt-1 text-sm text-white/80">{destinationShowcase[2].totalTours} chuyến đi</div>
              </div>
            </Link>
          ) : null}

          {destinationShowcase[3] ? (
            <Link
              href={`/tours?destination=${destinationShowcase[3].location.slug}`}
              className="group relative min-h-[240px] overflow-hidden rounded-[2rem] md:col-span-8"
            >
              <Image src={destinationShowcase[3].featuredImage} alt={destinationShowcase[3].location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
              <div className="absolute bottom-5 left-5 text-white">
                <div className="text-3xl font-black tracking-tight">{destinationShowcase[3].location.name}</div>
                <div className="mt-1 text-sm text-white/80">{destinationShowcase[3].totalTours}+ lựa chọn đang mở bán</div>
              </div>
            </Link>
          ) : null}
        </div>
      </section>

      <section className="page-container mt-24 grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
        <div className="space-y-6">
          <SectionHeading
            eyebrow="Cảm nhận"
            title="Họ đã trải nghiệm, còn bạn thì sao?"
            description="Những đánh giá thực tế giúp giao diện vừa đẹp vừa có chiều sâu dữ liệu. Cùng một component này cũng được tái sử dụng ở trang chi tiết tour và trang reviews."
          />
          {reviews[0] ? <ReviewCard review={reviews[0]} /> : null}
        </div>
        <div className="surface-panel relative overflow-hidden p-3">
          <div className="absolute -left-10 top-8 size-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative aspect-[5/4] overflow-hidden rounded-[1.8rem]">
            <Image
              src={featuredTours[1]?.coverImage || featuredTours[0]?.coverImage || heroTour?.coverImage || "https://images.unsplash.com/photo-1517760444937-f6397edcbbcd?auto=format&fit=crop&w=1200&q=80"}
              alt={featuredTours[1]?.name || "The Horizon story"}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="page-container mt-24">
        <div className="relative overflow-hidden rounded-[2.6rem] bg-primary px-6 py-12 text-white shadow-[0_30px_90px_rgba(0,80,203,0.24)] sm:px-10 sm:py-16">
          <div className="absolute -left-24 bottom-0 size-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -right-20 top-0 size-72 rounded-full bg-orange-300/18 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="eyebrow !text-white/70">Ưu đãi</div>
              <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Đừng bỏ lỡ những ưu đãi độc quyền</h2>
              <p className="mt-4 text-lg leading-8 text-white/80">
                Đăng ký nhận bản tin để cập nhật những điểm đến mới nhất, lịch khởi hành sớm và mã giảm giá cho chuyến đi tiếp theo của bạn.
              </p>
            </div>
            <form className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
              <input
                type="email"
                placeholder="Email của bạn"
                className="h-14 flex-1 rounded-full border border-white/10 bg-white px-5 text-slate-900 outline-none"
              />
              <Button className="h-14 rounded-full bg-secondary px-7 text-base font-bold text-white hover:bg-orange-600">
                Đăng ký ngay
              </Button>
            </form>
          </div>
          {coupons[0] ? (
            <div className="relative mt-8 inline-flex rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm text-white/86 backdrop-blur">
              Mã ưu đãi demo: <span className="ml-2 font-bold">{coupons[0].code}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
