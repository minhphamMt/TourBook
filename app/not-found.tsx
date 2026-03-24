import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="page-container py-20">
      <div className="surface-panel mx-auto max-w-2xl p-10 text-center">
        <div className="eyebrow justify-center">404</div>
        <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950">Không tìm thấy nội dung</h1>
        <p className="mt-5 text-lg leading-8 text-slate-500">
          Trang, tour hoặc booking bạn tìm hiện không tồn tại trong bộ dữ liệu Supabase hiện tại.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild className="rounded-full bg-primary text-white hover:bg-blue-700">
            <Link href="/">Về trang chủ</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/tours">Mở tours</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
