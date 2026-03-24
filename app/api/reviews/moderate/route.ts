import { NextResponse } from "next/server"

import { requireRequestAuth } from "@/lib/request-auth"

type ModerateReviewPayload = {
  reviewId?: string
  status?: "approved" | "hidden"
  replyText?: string
}

function responseError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const { supabase, auth } = authResult
    if (!auth.isManagement) {
      return responseError("Chỉ nhân sự quản trị mới được xử lý review.", 403)
    }

    const payload = (await request.json()) as ModerateReviewPayload
    const nextStatus = payload.status
    const replyText = payload.replyText?.trim() || ""

    if (!payload.reviewId || (!nextStatus && !replyText)) {
      return responseError("Thiếu reviewId hoặc nội dung xử lý review.")
    }

    if (nextStatus && !["approved", "hidden"].includes(nextStatus)) {
      return responseError("Trạng thái review không hợp lệ.")
    }

    const reviewResult = await supabase
      .from("reviews")
      .select("id,booking_id,tour_id,user_id,status")
      .eq("id", payload.reviewId)
      .maybeSingle()

    if (reviewResult.error) {
      return responseError(reviewResult.error.message, 500)
    }

    const review = reviewResult.data
    if (!review) {
      return responseError("Không tìm thấy review.", 404)
    }

    let finalStatus = review.status
    if (nextStatus && nextStatus !== review.status) {
      const updateResult = await supabase
        .from("reviews")
        .update({ status: nextStatus })
        .eq("id", review.id)
        .select("status")
        .single()

      if (updateResult.error || !updateResult.data) {
        return responseError(updateResult.error?.message || "Không thể cập nhật review.", 500)
      }

      finalStatus = updateResult.data.status
    }

    if (replyText) {
      const replyResult = await supabase
        .from("review_replies")
        .upsert({
          review_id: review.id,
          replied_by: auth.user.id,
          reply_text: replyText,
        }, { onConflict: "review_id" })

      if (replyResult.error) {
        return responseError(replyResult.error.message, 500)
      }
    }

    if (review.user_id) {
      let title = "Review của bạn đang được xử lý"
      let content = "Đội ngũ The Horizon đã cập nhật trạng thái review của bạn."

      if (finalStatus === "approved") {
        title = "Review đã được hiển thị"
        content = "Review của bạn đã được duyệt và hiện trên hệ thống."
      }

      if (finalStatus === "hidden") {
        title = "Review tạm ẩn khỏi hệ thống"
        content = "Review của bạn hiện chưa được hiển thị công khai. Bạn vẫn có thể cập nhật lại nội dung từ trang booking."
      }

      if (replyText) {
        content += " Đội ngũ The Horizon cũng đã để lại phản hồi cho review này."
      }

      await supabase.from("notifications").insert({
        user_id: review.user_id,
        title,
        content,
        notification_type: "review",
        reference_type: "review",
        reference_id: review.id,
      })
    }

    return NextResponse.json({
      ok: true,
      reviewId: review.id,
      status: finalStatus,
      replied: Boolean(replyText),
    })
  } catch (error) {
    return responseError(error instanceof Error ? error.message : "Không thể xử lý review.", 500)
  }
}
