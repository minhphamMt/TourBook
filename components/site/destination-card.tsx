import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import type { DestinationSpotlight } from "@/lib/site-data"

export function DestinationCard({ destination }: { destination: DestinationSpotlight }) {
  return (
    <Link
      href={`/tours?destination=${destination.location.slug}`}
      className="group relative block overflow-hidden rounded-[2rem] border border-white/70 bg-slate-900 text-white shadow-[0_24px_70px_rgba(25,27,36,0.16)]"
    >
      <div className="relative h-72">
        <Image src={destination.featuredImage} alt={destination.location.name} fill className="object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-white/70">Điểm đến hàng đầu</div>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h3 className="text-3xl font-black tracking-tight">{destination.location.name}</h3>
            <p className="mt-2 text-sm text-white/75">{destination.totalTours} hành trình đang mở bán</p>
          </div>
          <span className="flex size-12 items-center justify-center rounded-full bg-white/14 transition group-hover:bg-white/20">
            <ArrowUpRight className="size-5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
