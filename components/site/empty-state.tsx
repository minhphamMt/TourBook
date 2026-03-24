import { Compass } from "lucide-react"

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-sky-50 text-sky-600">
        <Compass className="size-7" />
      </div>
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500">{description}</p>
    </div>
  )
}
