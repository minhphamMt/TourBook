"use client"

import { useParams } from "next/navigation"

import {
  AccountProfile,
  AccountBookings,
  AccountWishlist,
  AccountTravelers,
  AccountNotifications,
  AccountSupport,
} from "@/components/site/account/account-sections"

const sectionComponents: Record<string, React.ComponentType> = {
  profile: AccountProfile,
  bookings: AccountBookings,
  wishlist: AccountWishlist,
  travelers: AccountTravelers,
  notifications: AccountNotifications,
  support: AccountSupport,
}

export default function AccountSectionPage() {
  const params = useParams()
  const section = params.section as string
  const Component = sectionComponents[section]

  if (!Component) {
    return (
      <div className="surface-panel p-8 text-center text-slate-500">
        Không tìm thấy mục này trong tài khoản.
      </div>
    )
  }

  return <Component />
}
