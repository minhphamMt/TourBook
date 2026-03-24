"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Home, LogOut, UserRound } from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/components/providers/auth-provider"
import {
  accountMenuItems,
  isAccountPathActive,
} from "@/components/site/account/account-config"
import { cn } from "@/lib/utils"

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { initialized, profile, user, primaryRole, signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const initials = useMemo(() => {
    const source = profile?.full_name || user?.email || "U"
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
  }, [profile?.full_name, user?.email])

  const onSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await signOut()
      router.replace("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }



  if (!initialized) {
    return <div className="page-container py-12"><div className="surface-panel p-8 text-slate-500">Đang tải tài khoản...</div></div>
  }

  if (!user) {
    return (
      <div className="page-container py-12">
        <div className="surface-panel p-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Bạn chưa đăng nhập</h1>
          <p className="mt-3 text-slate-500">Đăng nhập để xem tài khoản cá nhân của bạn.</p>
          <Link href="/login?redirect=/account" className="mt-6 inline-flex rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    )
  }

  const roleLabel = primaryRole === "customer" ? "Khách hàng" : primaryRole

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white shadow-lg shadow-blue-600/20">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name || "User"} className="h-full w-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-heading text-xl font-black tracking-tight text-slate-950">{profile?.full_name || user.email}</div>
              <div className="truncate text-sm text-slate-500">{roleLabel}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-5">
          <nav className="space-y-2">
            {accountMenuItems.map((item) => {
              const active = isAccountPathActive(pathname, item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold transition",
                    active
                      ? "bg-blue-50 text-primary shadow-[0_10px_24px_rgba(0,80,203,0.10)]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                  )}
                >
                  <span className={cn("flex size-9 items-center justify-center rounded-xl", active ? "bg-primary text-white" : "bg-slate-100 text-slate-500")}>
                    <Icon className="size-4.5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-slate-200 px-4 py-4">
          <button
            type="button"
            onClick={onSignOut}
            disabled={isSigningOut}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <LogOut className="size-4.5" />
            </span>
            <span>{isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}</span>
          </button>
        </div>
      </aside>

      <div className="pl-[280px]">
        <header className="sticky top-0 z-30 flex min-h-[64px] items-center justify-end border-b border-slate-200 bg-white/92 px-8 backdrop-blur-xl">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Home className="size-4" />
            Trang chủ
          </Link>
        </header>

        <main className="px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
