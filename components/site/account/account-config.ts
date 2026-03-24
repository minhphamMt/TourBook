import type { LucideIcon } from "lucide-react"
import {
  Bell,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  MapPinned,
  Ticket,
  UserRound,
} from "lucide-react"

export type AccountSectionKey =
  | "overview"
  | "profile"
  | "bookings"
  | "wishlist"
  | "travelers"
  | "notifications"
  | "support"

export type AccountMenuItem = {
  key: AccountSectionKey
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export const accountMenuItems: AccountMenuItem[] = [
  {
    key: "overview",
    href: "/account",
    label: "Tổng quan",
    description: "Thống kê booking, chi tiêu và tóm tắt tài khoản.",
    icon: LayoutDashboard,
  },
  {
    key: "profile",
    href: "/account/profile",
    label: "Thông tin cá nhân",
    description: "Cập nhật họ tên, điện thoại, địa chỉ và avatar.",
    icon: UserRound,
  },
  {
    key: "bookings",
    href: "/account/bookings",
    label: "Bookings",
    description: "Theo dõi trạng thái đơn đặt chỗ của bạn.",
    icon: Ticket,
  },
  {
    key: "wishlist",
    href: "/account/wishlist",
    label: "Yêu thích",
    description: "Tour đã lưu trong danh sách yêu thích.",
    icon: Heart,
  },
  {
    key: "travelers",
    href: "/account/travelers",
    label: "Hành khách",
    description: "Hồ sơ hành khách đã lưu để đặt tour nhanh hơn.",
    icon: MapPinned,
  },
  {
    key: "notifications",
    href: "/account/notifications",
    label: "Thông báo",
    description: "Thông báo mới nhất từ hệ thống.",
    icon: Bell,
  },
  {
    key: "support",
    href: "/account/support",
    label: "Hỗ trợ",
    description: "Tạo và theo dõi yêu cầu hỗ trợ.",
    icon: LifeBuoy,
  },
]

export function isAccountPathActive(pathname: string, href: string) {
  if (href === "/account") {
    return pathname === "/account" || pathname === "/account/overview"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getAccountMenuItem(section: AccountSectionKey) {
  return accountMenuItems.find((item) => item.key === section)
}
