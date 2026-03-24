"use client"

import Link from "next/link"
import { Globe, Mail, Phone, Shield } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"

const roleLabels = {
  customer: "Khách hàng",
  staff: "Staff",
  admin: "Admin",
  super_admin: "Super Admin",
} as const

export function SiteFooter() {
  const { isManagement, primaryRole, user } = useAuth()
  const bookingHref = user ? "/checkout" : "/login?redirect=%2Fcheckout"

  if (isManagement) {
    return (
      <footer className="mt-24 border-t border-slate-200/40 bg-[#f4f3fd]/90 backdrop-blur-xl">
        <div className="page-container flex flex-col gap-6 py-10 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-heading text-2xl font-black tracking-tight text-slate-950">The Horizon Ops</div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              Tài khoản {roleLabels[primaryRole]} đang ở chế độ quản trị nội bộ. Các route public được khóa và toàn bộ điều hướng sẽ giữ bạn trong khu vận hành `/admin`.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-blue-100 bg-blue-50/80 px-5 py-4 text-sm font-semibold text-primary">
            <div className="flex items-center gap-2">
              <Shield className="size-4" />
              Chế độ nội bộ đang bật
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200/50 px-4 py-6 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          © 2026 The Horizon Operations. All rights reserved.
        </div>
      </footer>
    )
  }

  return (
    <footer className="mt-24 border-t border-slate-200/40 bg-[#f4f3fd]/90 backdrop-blur-xl">
      <div className="page-container grid gap-10 py-16 md:grid-cols-4">
        <div className="space-y-4">
          <div className="font-heading text-2xl font-black tracking-tight text-slate-950">The Horizon</div>
          <p className="max-w-xs text-sm leading-7 text-slate-500">
            Khám phá thế giới qua một góc nhìn tinh tế hơn, với những hành trình được tuyển chọn cho cả cảm hứng và trải nghiệm thực tế.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <Globe className="size-4" />
            <Mail className="size-4" />
            <Phone className="size-4" />
          </div>
        </div>

        <div>
          <h3 className="mb-6 font-heading text-xs font-bold uppercase tracking-[0.26em] text-slate-500">Khám phá</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <Link href="/destinations" className="block transition hover:text-primary">Tất cả điểm đến</Link>
            <Link href="/tours" className="block transition hover:text-primary">Tours du lịch</Link>
            <Link href="/reviews" className="block transition hover:text-primary">Đánh giá khách hàng</Link>
            <Link href={bookingHref} className="block transition hover:text-primary">Đặt tour ngay</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-6 font-heading text-xs font-bold uppercase tracking-[0.26em] text-slate-500">Thông tin</h3>
          <div className="space-y-3 text-sm text-slate-600">
            <Link href="/about-us" className="block transition hover:text-primary">Về chúng tôi</Link>
            <Link href="/privacy-policy" className="block transition hover:text-primary">Chính sách bảo mật</Link>
            <Link href="/terms-and-conditions" className="block transition hover:text-primary">Điều khoản dịch vụ</Link>
            <Link href="/account" className="block transition hover:text-primary">Tài khoản</Link>
          </div>
        </div>

        <div>
          <h3 className="mb-6 font-heading text-xs font-bold uppercase tracking-[0.26em] text-slate-500">Kết nối với chúng tôi</h3>
          <div className="flex gap-3">
            {["fb", "ig", "yt"].map((item) => (
              <span
                key={item}
                className="flex size-10 items-center justify-center rounded-full bg-white text-xs font-bold uppercase text-primary shadow-sm"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6 rounded-[1.5rem] bg-[#dae5ff] p-5 shadow-[0_18px_40px_rgba(0,80,203,0.08)]">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Hotline 24/7</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-950">1900 1234</div>
            <p className="mt-2 text-sm leading-6 text-slate-500">Hỗ trợ tư vấn lịch trình, thanh toán, đổi lịch và các yêu cầu sau chuyến đi.</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200/50 px-4 py-6 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
        © 2026 The Horizon Perspective. All rights reserved.
      </div>
    </footer>
  )
}
