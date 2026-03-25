"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Heart } from "lucide-react"
import { useState, type MouseEvent } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import { useWishlist } from "@/components/providers/wishlist-provider"

type Props = {
  tourId: string
  variant?: "icon" | "pill"
  className?: string
}

export function WishlistButton({ tourId, variant = "icon", className = "" }: Props) {
  const { user } = useAuth()
  const { savedIds, toggle, ready } = useWishlist()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  const isSaved = savedIds.has(tourId)
  const redirectTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`
  const loginHref = `/login?redirect=${encodeURIComponent(redirectTo)}`

  if (!ready) return null

  if (!user) {
    return (
      <Link
        href={loginHref}
        title="Đăng nhập để lưu tour yêu thích"
        className={`group inline-flex items-center gap-2 transition ${variant === "pill" ? "rounded-full bg-white/88 px-4 py-2 text-sm font-semibold text-slate-700 shadow hover:bg-white" : ""} ${className}`}
      >
        <Heart className={`size-5 text-slate-400 transition group-hover:text-rose-500 ${variant === "pill" ? "size-4" : ""}`} />
        {variant === "pill" ? <span>Lưu tour</span> : null}
      </Link>
    )
  }

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (loading) return

    setLoading(true)
    await toggle(tourId)
    setLoading(false)
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title={isSaved ? "Bỏ khỏi danh sách yêu thích" : "Lưu vào danh sách yêu thích"}
        className={`group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition
          ${isSaved
            ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
            : "bg-white/88 text-slate-700 shadow hover:bg-white hover:text-rose-500"
          }
          ${loading ? "opacity-60" : ""}
          ${className}`}
      >
        <Heart
          className={`size-4 transition-transform ${isSaved ? "fill-rose-500 text-rose-500" : ""} ${loading ? "" : "group-hover:scale-110"}`}
        />
        <span>{isSaved ? "Đã lưu" : "Lưu tour"}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={isSaved ? "Bỏ khỏi danh sách yêu thích" : "Lưu vào danh sách yêu thích"}
      className={`group inline-flex size-9 items-center justify-center rounded-full shadow-md transition
        ${isSaved
          ? "bg-rose-500 text-white hover:bg-rose-600"
          : "bg-white/90 text-slate-400 hover:bg-white hover:text-rose-500"
        }
        ${loading ? "pointer-events-none opacity-60" : ""}
        ${className}`}
    >
      <Heart
        className={`size-[18px] transition-all duration-200
          ${isSaved ? "fill-current scale-110" : "group-hover:scale-110"}
          ${loading ? "animate-pulse" : ""}`}
      />
    </button>
  )
}

