"use client"

import { startTransition, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useAuth } from "@/components/providers/auth-provider"
import { SiteFooter } from "@/components/site/site-footer"
import { SiteHeader } from "@/components/site/site-header"

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { initialized, user, isManagement } = useAuth()

  const adminRoute = isAdminRoute(pathname)
  const shouldRedirectToAdmin = initialized && !!user && isManagement && !adminRoute
  const shouldRedirectFromAdmin = initialized && adminRoute && (!user || !isManagement)

  useEffect(() => {
    if (shouldRedirectToAdmin) {
      startTransition(() => {
        router.replace("/admin")
      })
      return
    }

    if (shouldRedirectFromAdmin) {
      startTransition(() => {
        router.replace(user ? "/account" : "/login?redirect=/admin")
      })
    }
  }, [router, shouldRedirectFromAdmin, shouldRedirectToAdmin, user])

  const redirectNotice = shouldRedirectToAdmin
    ? "Tài khoản quản trị đang được chuyển vào khu vận hành nội bộ."
    : shouldRedirectFromAdmin
      ? "Trang admin chỉ mở cho staff, admin hoặc super_admin."
      : null

  if (adminRoute) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
        {redirectNotice ? (
          <div className="flex min-h-screen items-center justify-center px-6">
            <div className="w-full max-w-2xl rounded-[2rem] border border-white/80 bg-white/88 p-8 text-sm leading-7 text-slate-500 shadow-[0_24px_70px_rgba(25,27,36,0.08)] backdrop-blur-xl">
              {redirectNotice}
            </div>
          </div>
        ) : (
          children
        )}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {redirectNotice ? (
          <div className="page-container py-16">
            <div className="surface-panel p-8 text-sm leading-7 text-slate-500">{redirectNotice}</div>
          </div>
        ) : (
          children
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
