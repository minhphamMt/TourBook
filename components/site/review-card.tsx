import Image from "next/image"
import { Star } from "lucide-react"

import { formatDateTime } from "@/lib/format"
import type { TourReview } from "@/lib/site-data"

export function ReviewCard({ review }: { review: TourReview }) {
  return (
    <article className="h-full rounded-[2rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_60px_rgba(25,27,36,0.08)] backdrop-blur-xl">
      <div className="mb-5 flex items-center gap-4">
        <div className="relative size-14 overflow-hidden rounded-full bg-slate-200">
          {review.authorAvatar ? (
            <Image src={review.authorAvatar} alt={review.authorName} fill className="object-cover" />
          ) : null}
        </div>
        <div>
          <div className="font-bold text-slate-950">{review.authorName}</div>
          <div className="text-sm text-slate-400">{formatDateTime(review.createdAt)}</div>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 text-orange-400">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className={`size-4 ${index < review.rating ? "fill-current" : "text-slate-200"}`} />
        ))}
      </div>

      <p className="text-sm leading-7 text-slate-600">&ldquo;{review.comment}&rdquo;</p>

      {review.reply ? (
        <div className="mt-5 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
          <div className="mb-2 font-semibold text-slate-900">Phản hồi từ {review.reply.authorName}</div>
          <p className="leading-7">{review.reply.text}</p>
        </div>
      ) : null}
    </article>
  )
}
