"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Compass, LogOut, Search, Shield, UserCircle2 } from "lucide-react"
import { FormEvent, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"

const navItems = [
  { href: "/destinations", label: "Destinations" },
  { href: "/tours", label: "Tours" },
  { href: "/reviews", label: "Reviews" },
]

const roleLabels = {
  customer: "Khách hàng",
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super Admin",
} as const

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { initialized, user, profile, isManagement, primaryRole, signOut } = useAuth()
  const [search, setSearch] = useState("")
  const [isSigningOut, setIsSigningOut] = useState(false)

  const initials = useMemo(() => {
    const source = profile?.full_name || user?.email || "TH"
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("")
  }, [profile?.full_name, user?.email])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set("q", search.trim())
    router.push(`/tours${params.toString() ? `?${params.toString()}` : ""}`)
  }

  const onSignOut = async () => {
    if (isSigningOut) {
      return
    }

    setIsSigningOut(true)
    try {
      await signOut()
      router.replace("/")
      router.refresh()
    } finally {
      setIsSigningOut(false)
    }
  }

  const dashboardHref = isManagement ? "/admin" : "/account"

  return (
    <header className="sticky top-0 z-50 border-b border-white/60 bg-white/76 backdrop-blur-2xl supports-[backdrop-filter]:bg-white/68">
      <div className="page-container flex items-center gap-4 py-4">
        <Link href={isManagement ? "/admin" : "/"} className="flex items-center gap-3 text-primary transition hover:opacity-90">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-blue-600/20">
            <Compass className="size-5" />
          </span>
          <span className="font-heading text-2xl font-extrabold tracking-tight">The Horizon</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-500 md:ml-8 md:flex">
          {isManagement ? (
            <Link
              href="/admin"
              className={cn(
                "relative font-heading tracking-tight transition-colors hover:text-primary",
                (pathname === "/admin" || pathname.startsWith("/admin/")) && "text-primary"
              )}
            >
              Admin Console
              {pathname === "/admin" || pathname.startsWith("/admin/") ? <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-primary" /> : null}
            </Link>
          ) : (
            navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative font-heading tracking-tight transition-colors hover:text-primary",
                  pathname === item.href && "text-primary"
                )}
              >
                {item.label}
                {pathname === item.href ? <span className="absolute inset-x-0 -bottom-3 h-0.5 rounded-full bg-primary" /> : null}
              </Link>
            ))
          )}
        </nav>

        {!isManagement ? (
          <form onSubmit={onSubmit} className="ml-auto hidden min-w-0 flex-1 items-center justify-end lg:flex">
            <label className="flex w-full max-w-xs items-center gap-3 rounded-full border border-slate-200/70 bg-[#eff0fd] px-4 py-3 text-sm text-slate-500 shadow-inner shadow-white/60">
              <Search className="size-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm kiếm hành trình..."
                className="w-full bg-transparent outline-none placeholder:text-slate-400"
              />
            </label>
          </form>
        ) : (
          <div className="ml-auto hidden rounded-full border border-blue-100 bg-blue-50/90 px-4 py-2 text-sm font-semibold text-primary lg:flex lg:items-center lg:gap-2">
            <Shield className="size-4" />
            {roleLabels[primaryRole]} - khu quản trị nội bộ
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          {!initialized ? (
            <div className="size-10 animate-pulse rounded-full bg-slate-200" />
          ) : user ? (
            <>
              <Button asChild variant="ghost" className="rounded-full px-3 text-primary">
                <Link href={dashboardHref}>{isManagement ? "Quản trị" : "Tài khoản"}</Link>
              </Button>
              <button
                type="button"
                onClick={onSignOut}
                disabled={isSigningOut}
                className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex sm:items-center sm:gap-2"
              >
                <LogOut className="size-4" />
                {isSigningOut ? "Đang đăng xuất..." : "Đăng xuất"}
              </button>
              <Link
                href={dashboardHref}
                className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-slate-900 text-sm font-bold text-white shadow-lg shadow-slate-900/10"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.full_name || "Tài khoản"} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </Link>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="rounded-full px-4 text-primary hover:text-primary">
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild className="hidden rounded-full bg-primary px-5 text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 sm:inline-flex">
                <Link href="/login?redirect=%2Fcheckout">Đặt tour</Link>
              </Button>
              <Link href="/login" className="sm:hidden">
                <UserCircle2 className="size-9 text-primary" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

