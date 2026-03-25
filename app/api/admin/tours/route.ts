import { NextResponse } from "next/server"

import { requireRequestAuth } from "@/lib/request-auth"
import { getSupabaseServerClient } from "@/lib/supabase/server-client"

export async function POST(request: Request) {
  try {
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) return authResult.response

    const { auth: { isManagement }, supabase } = authResult

    if (!isManagement) {
      return NextResponse.json({ error: "Không có quyền thực hiện hành động này" }, { status: 403 })
    }

    const body = await request.json()
    const name = body.name?.trim() || "Tour mới"
    const duration_days = parseInt(body.duration_days) || 1
    const duration_nights = parseInt(body.duration_nights) || 0
    const status = body.status || "draft"

    const timestamp = Date.now().toString().slice(-4)
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${timestamp}`

    // 1. Insert skeleton tour
    const now = new Date().toISOString()
    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .insert({
        name,
        slug,
        status,
        is_featured: body.is_featured || false,
        short_description: body.short_description || "Dưới đây là một hành trình thú vị...",
        description: body.description || "Đang cập nhật nội dung...",
        duration_days,
        duration_nights,
        published_at: status === "published" ? now : null,
        created_at: now,
        updated_at: now,
      })
      .select("id, name, status, is_featured")
      .single()

    if (tourError) {
      return NextResponse.json({ error: `Lỗi tạo tour: ${tourError.message}` }, { status: 500 })
    }

    const id = tourData.id

    // 2. Insert Itinerary
    if (body.itinerary && body.itinerary.length > 0) {
      const { error: itinError } = await supabase
        .from("tour_itinerary_days")
        .insert(body.itinerary.map((day: any) => ({
          tour_id: id,
          day_number: day.day_number,
          title: day.title,
          description: day.description,
          meals: day.meals,
          accommodation: day.accommodation,
          transportation: day.transportation
        })))
      
      if (itinError) throw itinError
    }

    // 3. Insert Cover Image
    if (body.cover_image) {
      await supabase.from("tour_images").insert({
        tour_id: id,
        image_url: body.cover_image,
        is_cover: true,
        sort_order: 0
      })
    } else {
      // Default placeholder if none provided
      await supabase.from("tour_images").insert({
        tour_id: id,
        image_url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop",
        is_cover: true,
        sort_order: 0
      })
    }

    // 4. Handle Pricing (Create default schedule and price tier)
    if (body.starting_price) {
      const departureDate = body.departure_date ? new Date(body.departure_date) : new Date()
      const returnDate = new Date(departureDate)
      returnDate.setDate(departureDate.getDate() + (duration_days - 1))

      const { data: scheduleData, error: scheduleError } = await supabase
        .from("departure_schedules")
        .insert({
          tour_id: id,
          departure_date: departureDate.toISOString().split('T')[0],
          return_date: returnDate.toISOString().split('T')[0],
          capacity: 99,
          status: 'open',
          meeting_point: "Liên hệ Hotline để được tư vấn điểm đón",
        })
        .select("id")
        .single()

      if (!scheduleError && scheduleData) {
        await supabase.from("schedule_price_tiers").insert({
          schedule_id: scheduleData.id,
          traveler_type: 'adult',
          price: body.starting_price,
          sale_price: body.sale_price || null,
        })
      }
    }

    return NextResponse.json({ tour: tourData }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
