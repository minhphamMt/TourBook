import { NextResponse } from "next/server"

import { requireRequestAuth } from "@/lib/request-auth"

type WishlistPayload = {
  tourId?: string
}

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const payload = (await request.json()) as WishlistPayload
    if (!payload.tourId) {
      return NextResponse.json({ error: "Thiếu tourId." }, { status: 400 })
    }

    const { supabase, auth } = authResult
    const existingResult = await supabase
      .from("wishlist")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("tour_id", payload.tourId)
      .maybeSingle()

    if (existingResult.error) {
      return NextResponse.json({ error: existingResult.error.message }, { status: 500 })
    }

    if (existingResult.data) {
      const deleteResult = await supabase.from("wishlist").delete().eq("id", existingResult.data.id)
      if (deleteResult.error) {
        return NextResponse.json({ error: deleteResult.error.message }, { status: 500 })
      }

      return NextResponse.json({ ok: true, active: false })
    }

    const insertResult = await supabase.from("wishlist").insert({
      user_id: auth.user.id,
      tour_id: payload.tourId,
    })

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, active: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật wishlist." }, { status: 500 })
  }
}
