"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useEffect, useState } from "react"
import { ArrowRight, KeyRound, ShieldCheck, Sparkles, UserRoundPlus } from "lucide-react"

import { useAuth } from "@/components/providers/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { resolvePostLoginPath } from "@/lib/roles"

const demoAccounts = [
  { role: "Khách hàng", email: "anna.nguyen@tourbook.demo", password: "Demo@123456" },
  { role: "Khách hàng", email: "minh.tran@tourbook.demo", password: "Demo@123456" },
  { role: "Vận hành", email: "thao.staff@tourbook.demo", password: "Demo@123456" },
  { role: "Admin", email: "huy.admin@tourbook.demo", password: "Demo@123456" },
]

export function LoginPanel({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter()
  const { initialized, user, roles, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(demoAccounts[0].email)
  const [password, setPassword] = useState(demoAccounts[0].password)
  const [status, setStatus] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!initialized || !user) return
    startTransition(() => {
      router.replace(resolvePostLoginPath(roles, redirectTo))
    })
  }, [initialized, redirectTo, roles, router, user])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setIsSubmitting(true)

    const result =
      mode === "signin"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, fullName.trim())

    setIsSubmitting(false)

    if (result.error) {
      setStatus(result.error)
      return
    }

    setStatus(mode === "signin" ? "Đăng nhập thành công. Đang chuyển hướng..." : "Tài khoản đã được tạo. Nếu email đã xác thực, bạn có thể đăng nhập ngay.")
    if (mode === "signup") {
      setMode("signin")
    }
  }

  return (
    <div className="page-container py-12">
      <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative overflow-hidden rounded-[2.6rem] bg-slate-950 px-6 py-8 text-white shadow-[0_30px_100px_rgba(25,27,36,0.22)] sm:px-10 sm:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.25),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.22),transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur">
              The Horizon access
            </div>
            <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-6xl">Đăng nhập để tiếp tục hành trình.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
              Đăng nhập để lưu tour yêu thích, theo dõi booking và tiếp tục hành trình của bạn một cách liền mạch.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setMode("signin")
                    setEmail(account.email)
                    setPassword(account.password)
                  }}
                  className="rounded-[1.6rem] border border-white/10 bg-white/8 p-5 text-left transition hover:border-white/20 hover:bg-white/12"
                >
                  <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-sky-300">{account.role}</div>
                  <div className="mt-3 font-bold text-white">{account.email}</div>
                  <div className="mt-2 text-sm text-white/70">Mật khẩu: {account.password}</div>
                </button>
              ))}
            </div>

            <div className="mt-8 rounded-[1.8rem] bg-white/8 p-5 text-sm leading-7 text-white/72">
              <div className="mb-2 flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="size-4 text-emerald-300" />
                Truy cập nhanh
              </div>
              Chọn nhanh một tài khoản mẫu để trải nghiệm The Horizon ngay mà không cần nhập lại thông tin đăng nhập.
            </div>
          </div>
        </section>

        <section className="surface-panel p-6 sm:p-8">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => setMode("signin")}
              className={mode === "signin" ? "rounded-full bg-primary px-5 text-white hover:bg-blue-700" : "rounded-full bg-slate-100 px-5 text-slate-600 hover:bg-slate-200"}
            >
              <KeyRound className="size-4" />
              Đăng nhập
            </Button>
            <Button
              type="button"
              onClick={() => setMode("signup")}
              className={mode === "signup" ? "rounded-full bg-secondary px-5 text-white hover:bg-orange-600" : "rounded-full bg-slate-100 px-5 text-slate-600 hover:bg-slate-200"}
            >
              <UserRoundPlus className="size-4" />
              Tạo tài khoản
            </Button>
          </div>

          <div className="mt-8">
            <div className="eyebrow">{mode === "signin" ? "Welcome back" : "New member"}</div>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950">
              {mode === "signin" ? "Đăng nhập vào The Horizon" : "Tạo tài khoản mới"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              {mode === "signin"
                ? "Sử dụng tài khoản của bạn hoặc chọn nhanh một tài khoản mẫu để tiếp tục."
                : "Tạo tài khoản mới để lưu tour yêu thích, theo dõi booking và quản lý hành trình của bạn."}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {mode === "signup" ? (
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Họ và tên</span>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-12 rounded-2xl bg-slate-100/80" placeholder="Nguyễn Văn A" />
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-2xl bg-slate-100/80" placeholder="you@example.com" />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Mật khẩu</span>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-2xl bg-slate-100/80" placeholder="Nhập mật khẩu" />
            </label>

            {status ? (
              <div className={`rounded-[1.5rem] px-4 py-4 text-sm ${status.toLowerCase().includes("thành công") || status.toLowerCase().includes("đã được tạo") ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {status}
              </div>
            ) : null}

            <Button disabled={isSubmitting} className="h-13 w-full rounded-full bg-primary text-base font-bold text-white hover:bg-blue-700">
              {isSubmitting ? "Đang xử lý..." : mode === "signin" ? "Đăng nhập" : "Tạo tài khoản"}
              <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[1.7rem] bg-slate-50 px-5 py-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
              <Sparkles className="size-4 text-secondary" />
              Sau khi đăng nhập, hệ thống sẽ đưa bạn tới đúng khu vực phù hợp với tài khoản.
            </span>
            <Link href="/tours" className="font-semibold text-primary transition hover:text-blue-700">
              Quay lại khám phá tour
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

