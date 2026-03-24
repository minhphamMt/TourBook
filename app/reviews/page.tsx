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
        description="Các review card này đọc từ `reviews`, `review_replies` và `profiles`. Chúng cũng được tái sử dụng ở trang chi tiết tour để bảo đảm cảm giác nhất quán trên toàn bộ hệ thống."
      />

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <Star className="size-5 fill-current" />
            <span className="font-bold">Điểm trung bình</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{averageRating.toFixed(1)}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Tổng hợp từ các booking đã hoàn thành và được duyệt hiển thị.</p>
        </div>
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <MessageSquareHeart className="size-5" />
            <span className="font-bold">Tổng reviews</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{latestReviews.length}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Mỗi review được gắn với booking thật trong schema, rất hợp để làm testimonial và trust block.</p>
        </div>
        <div className="surface-panel p-6">
          <div className="flex items-center gap-3 text-primary">
            <Star className="size-5 fill-current" />
            <span className="font-bold">Feedback có phản hồi</span>
          </div>
          <div className="mt-4 text-4xl font-black tracking-tight text-slate-950">{latestReviews.filter((review) => review.reply).length}</div>
          <p className="mt-2 text-sm leading-7 text-slate-500">Rất phù hợp để dựng block moderation và social proof ở cả public site lẫn admin dashboard.</p>
        </div>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {latestReviews.length ? latestReviews.map((review) => <ReviewCard key={review.id} review={review} />) : null}
      </div>

      {!latestReviews.length ? (
        <div className="mt-12">
          <EmptyState title="Chưa có review được duyệt" description="Hãy seed thêm dữ liệu reviews hoặc tạo review mới từ account page sau khi booking hoàn thành." />
        </div>
      ) : null}
    </div>
  )
}
