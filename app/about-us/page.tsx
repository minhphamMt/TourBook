import { notFound } from "next/navigation"

import { getCmsPageBySlug } from "@/lib/site-data"

export const dynamic = "force-dynamic"

export default async function AboutUsPage() {
  const page = await getCmsPageBySlug("about-us")
  if (!page) notFound()

  return (
    <div className="page-container py-12">
      <div className="surface-panel p-8 sm:p-10">
        <div className="eyebrow">About</div>
        <h1 className="mt-3 text-5xl font-black tracking-tight text-slate-950 sm:text-6xl">{page.title}</h1>
        <p className="mt-6 max-w-4xl text-lg leading-9 text-slate-600">{page.content}</p>
      </div>
    </div>
  )
}
