'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Home() {
  const [tours, setTours] = useState<any[]>([])

  useEffect(() => {
    const fetchTours = async () => {
      const { data, error } = await supabase
        .from('tours')
        .select('*')

      if (error) console.log(error)
      else setTours(data || [])
    }

    fetchTours()
  }, [])

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Tour List</h1>

      {tours.map((tour) => (
        <div key={tour.id}>
          {tour.name} - ${tour.price}
        </div>
      ))}
    </div>
  )
}