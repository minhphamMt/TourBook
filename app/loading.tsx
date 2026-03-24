export default function Loading() {
  return (
    <div className="page-container py-16">
      <div className="surface-panel animate-pulse p-8">
        <div className="h-4 w-28 rounded-full bg-slate-200" />
        <div className="mt-6 h-12 w-2/3 rounded-2xl bg-slate-200" />
        <div className="mt-4 h-4 w-full rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-5/6 rounded-full bg-slate-200" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="h-40 rounded-[2rem] bg-slate-200" />
          <div className="h-40 rounded-[2rem] bg-slate-200" />
          <div className="h-40 rounded-[2rem] bg-slate-200" />
        </div>
      </div>
    </div>
  )
}
