import { MessageSquareHeart, Star } from "lucide-react"

import { EmptyState } from "@/components/site/empty-state"
import { ReviewCard } from "@/components/site/review-card"
import { SectionHeading } from "@/components/site/section-heading"
import { getSiteCatalog } from "@/lib/site-data"

export const dynamic = "force-dynamic"

export default async function ReviewsPage() {
  const { latestReviews } = await getSiteCatalog()
  const averageRating = latestReviews.length
    ? latestReviews.reduce((sum, review) => sum + review.rating, 0) / latestReviews.length
    : 0

  return (
    <div className="page-container py-12">
      <SectionHeading
        eyebrow="Reviews"
        title="Cảm nhận thực tế từ khách đã đặt tour"
        description="Những đánh giá mới nhất từ du khách sau hành trình cùng The Horizon."
      />

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <Star className="size-5 fill-current" />
            <span className="font-bold">Điểm trung bình</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{averageRating.toFixed(1)}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Tổng hợp từ những phản hồi đã được hiển thị công khai.</p>
        </div>
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <MessageSquareHeart className="size-5" />
            <span className="font-bold">Tổng reviews</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{latestReviews.length}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Ngày càng nhiều du khách chia sẻ cảm nhận sau chuyến đi của mình.</p>
        </div>
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <Star className="size-5 fill-current" />
            <span className="font-bold">Feedback có phản hồi</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{latestReviews.filter((review) => review.reply).length}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Những phản hồi từ đội ngũ giúp hành trình chăm sóc khách hàng luôn liền mạch.</p>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {latestReviews.length ? latestReviews.map((review) => <ReviewCard key={review.id} review={review} />) : null}
      </div>

      {!latestReviews.length ? (
        <div className="mt-12">
          <EmptyState title="Chưa có review được duyệt" description="Hiện chưa có đánh giá công khai. Hãy quay lại sau để xem những chia sẻ mới nhất." />
        </div>
      ) : null}
    </div>
  )
}

