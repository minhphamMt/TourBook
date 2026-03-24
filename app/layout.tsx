import type { Metadata } from "next"
import { Manrope, Plus_Jakarta_Sans } from "next/font/google"

import "./globals.css"
import { AppShell } from "@/components/providers/app-shell"
import { AuthProvider } from "@/components/providers/auth-provider"

const heading = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin", "vietnamese"],
})

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
})

export const metadata: Metadata = {
  metadataBase: new URL("https://thehorizon.local"),
  title: {
    default: "The Horizon | Nền tảng đặt tour du lịch hiện đại",
    template: "%s | The Horizon",
  },
  description:
    "The Horizon là giao diện booking tour du lịch hiện đại, kết nối Next.js, Supabase và bộ dữ liệu tour đã được seed sẵn.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className={`${heading.variable} ${body.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
