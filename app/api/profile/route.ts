import { NextResponse } from "next/server"

import { requireRequestAuth } from "@/lib/request-auth"

type ProfilePayload = {
  fullName?: string
  phone?: string
  address?: string
  avatarUrl?: string
}

export async function PATCH(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) {
      return authResult.response
    }

    const payload = (await request.json()) as ProfilePayload
    const { supabase, auth } = authResult
    const updateResult = await supabase
      .from("profiles")
      .update({
        full_name: payload.fullName?.trim() || null,
        phone: payload.phone?.trim() || null,
        address: payload.address?.trim() || null,
        avatar_url: payload.avatarUrl?.trim() || null,
      })
      .eq("id", auth.user.id)
      .select("id,full_name,email,phone,avatar_url,address,customer_level")
      .single()

    if (updateResult.error) {
      return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, profile: updateResult.data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể cập nhật profile." }, { status: 500 })
  }
}
