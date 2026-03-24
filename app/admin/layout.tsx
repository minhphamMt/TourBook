import { AdminShell } from "@/components/site/admin/admin-shell"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
