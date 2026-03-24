import { statusLabel } from "@/lib/format"
import { cn } from "@/lib/utils"

const statusClasses: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  awaiting_payment: "bg-orange-100 text-orange-700",
  confirmed: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancel_requested: "bg-rose-100 text-rose-700",
  cancelled: "bg-slate-200 text-slate-600",
  expired: "bg-slate-200 text-slate-600",
  paid: "bg-emerald-100 text-emerald-700",
  unpaid: "bg-slate-200 text-slate-600",
  partially_paid: "bg-amber-100 text-amber-700",
  refunded: "bg-indigo-100 text-indigo-700",
  partially_refunded: "bg-violet-100 text-violet-700",
  failed: "bg-rose-100 text-rose-700",
  approved: "bg-emerald-100 text-emerald-700",
  open: "bg-orange-100 text-orange-700",
  in_progress: "bg-sky-100 text-sky-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-slate-200 text-slate-600",
  hidden: "bg-slate-200 text-slate-600",
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        statusClasses[status] || "bg-slate-100 text-slate-700",
        className
      )}
    >
      {statusLabel(status)}
    </span>
  )
}
