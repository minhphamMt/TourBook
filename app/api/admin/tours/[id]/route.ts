import { NextResponse } from "next/server"
import { requireRequestAuth } from "@/lib/request-auth"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) return authResult.response

    const { auth: { isManagement }, supabase } = authResult
    if (!isManagement) {
      return NextResponse.json({ error: "Không có quyền thực hiện hành động này" }, { status: 403 })
    }

    const body = await request.json()

    // 1. Update basic tour info
    const now = new Date().toISOString()
    
    // Determine update payload
    const updatePayload: any = {
      name: body.name,
      short_description: body.short_description,
      description: body.description,
      duration_days: body.duration_days,
      duration_nights: body.duration_nights,
      is_featured: body.is_featured,
      status: body.status,
      updated_at: now
    }

    // Only set published_at if publishing for the first time
    if (body.status === "published") {
      updatePayload.published_at = now
    }

    const { data: tourData, error: tourError } = await supabase
      .from("tours")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (tourError) throw tourError

    // 2. Update Itinerary
    if (body.itinerary) {
      await supabase.from("tour_itinerary_days").delete().eq("tour_id", id)
      
      if (body.itinerary.length > 0) {
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
    }

    // 3. Update Cover Image
    if (body.cover_image) {
      await supabase.from("tour_images").update({ is_cover: false }).eq("tour_id", id)
      
      const { data: existingImg } = await supabase
        .from("tour_images")
        .select("id")
        .eq("tour_id", id)
        .eq("image_url", body.cover_image)
        .single()

      if (existingImg) {
        await supabase.from("tour_images").update({ is_cover: true }).eq("id", existingImg.id)
      } else {
        await supabase.from("tour_images").insert({
          tour_id: id,
          image_url: body.cover_image,
          is_cover: true,
          sort_order: 0
        })
      }
    }

    // 4. Handle Pricing Update
    if (body.starting_price) {
      const { data: scheduleData } = await supabase
        .from("departure_schedules")
        .select("id")
        .eq("tour_id", id)
        .limit(1)
        .single()

      if (scheduleData) {
        // Update price tier
        await supabase
          .from("schedule_price_tiers")
          .upsert({
            schedule_id: scheduleData.id,
            traveler_type: 'adult',
            price: body.starting_price,
            sale_price: body.sale_price || null,
          }, { onConflict: 'schedule_id,traveler_type' })
        
        // Also update the schedule date if provided
        if (body.departure_date) {
            const departureDate = new Date(body.departure_date)
            const returnDate = new Date(departureDate)
            returnDate.setDate(departureDate.getDate() + (body.duration_days - 1))
            
            await supabase.from("departure_schedules").update({
                departure_date: departureDate.toISOString().split('T')[0],
                return_date: returnDate.toISOString().split('T')[0]
            }).eq("id", scheduleData.id)
        }
      } else {
        // Create new default schedule
        const departureDate = body.departure_date ? new Date(body.departure_date) : new Date()
        const returnDate = new Date(departureDate)
        returnDate.setDate(departureDate.getDate() + (body.duration_days - 1))
        
        const { data: newSched } = await supabase
          .from("departure_schedules")
          .insert({
            tour_id: id,
            departure_date: departureDate.toISOString().split('T')[0],
            return_date: returnDate.toISOString().split('T')[0],
            capacity: 99,
            status: 'open',
          })
          .select("id")
          .single()

        if (newSched) {
          await supabase.from("schedule_price_tiers").insert({
            schedule_id: newSched.id,
            traveler_type: 'adult',
            price: body.starting_price,
            sale_price: body.sale_price || null,
          })
        }
      }
    }

    return NextResponse.json({ tour: tourData })
  } catch (err: any) {
    console.error("API Error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResult = await requireRequestAuth(request)
    if (!authResult.ok) return authResult.response

    const { auth: { isManagement }, supabase } = authResult
    if (!isManagement) {
      return NextResponse.json({ error: "Không có quyền thực hiện hành động này" }, { status: 403 })
    }

    const { count, error: countError } = await supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("tour_id", id)

    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 })
    if (count && count > 0) return NextResponse.json({ error: "Không thể xóa tour đã có đơn đặt hàng" }, { status: 400 })

    const { error } = await supabase.from("tours").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
