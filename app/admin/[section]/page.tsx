import { notFound } from "next/navigation"

import { adminSectionKeys, type AdminSectionKey } from "@/components/site/admin/admin-config"
import { AdminSectionPage } from "@/components/site/admin/admin-console"

export const dynamic = "force-dynamic"

export default async function AdminSectionRoute({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!adminSectionKeys.includes(section as AdminSectionKey)) {
    notFound()
  }

  return <AdminSectionPage section={section as AdminSectionKey} />
}
