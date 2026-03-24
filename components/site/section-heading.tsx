import { cn } from "@/lib/utils"

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("max-w-3xl", className)}>
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-8 text-slate-500 sm:text-lg">{description}</p> : null}
    </div>
  )
}
