import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileCog,
  FileClock,
  LayoutDashboard,
  MessageSquareQuote,
  Shield,
  Ticket,
} from "lucide-react"

import type { ManagementRole, RoleName } from "@/lib/roles"

export type AdminSectionKey =
  | "overview"
  | "bookings"
  | "payments"
  | "reviews"
  | "support"
  | "tours"
  | "activity"
  | "system"
  | "profile"

export type AdminMenuItem = {
  key: AdminSectionKey
  href: string
  label: string
  description: string
  icon: LucideIcon
  allowedRoles: ManagementRole[]
}

export type AdminMenuGroup = {
  title: string
  items: AdminMenuItem[]
}

export const adminRoleLabels: Record<RoleName, string> = {
  customer: "Khách hàng",
  staff: "Quản lý vận hành",
  admin: "Admin",
  super_admin: "Super Admin",
}

export const adminSectionKeys: AdminSectionKey[] = [
  "overview",
  "bookings",
  "payments",
  "reviews",
  "support",
  "tours",
  "activity",
  "system",
  "profile",
]

export const adminMenuGroups: AdminMenuGroup[] = [
  {
    title: "Tổng quan",
    items: [
      {
        key: "overview",
        href: "/admin",
        label: "Dashboard",
        description: "KPI nhanh và tình trạng vận hành.",
        icon: LayoutDashboard,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
    ],
  },
  {
    title: "Vận hành",
    items: [
      {
        key: "bookings",
        href: "/admin/bookings",
        label: "Bookings",
        description: "Theo dõi đơn đặt chỗ và xử lý phát sinh.",
        icon: ClipboardList,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
      {
        key: "payments",
        href: "/admin/payments",
        label: "Thanh toán",
        description: "Kiểm tra payment request và trạng thái thu tiền.",
        icon: CreditCard,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
      {
        key: "reviews",
        href: "/admin/reviews",
        label: "Đánh giá",
        description: "Duyệt review và theo dõi social proof.",
        icon: MessageSquareQuote,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
      {
        key: "support",
        href: "/admin/support",
        label: "Hỗ trợ",
        description: "Quản lý ticket, phản hồi và ưu tiên xử lý.",
        icon: Ticket,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
    ],
  },
  {
    title: "Nội dung & hệ thống",
    items: [
      {
        key: "tours",
        href: "/admin/tours",
        label: "Tours",
        description: "Kiểm soát trạng thái tour và nội dung nổi bật.",
        icon: Shield,
        allowedRoles: ["admin", "super_admin"],
      },
      {
        key: "activity",
        href: "/admin/activity",
        label: "Nhật ký",
        description: "Xem audit trail và biến động dữ liệu gần đây.",
        icon: BarChart3,
        allowedRoles: ["admin", "super_admin"],
      },
      {
        key: "system",
        href: "/admin/system",
        label: "Hệ thống",
        description: "Tổng hợp quyền, ghi chú kỹ thuật và cấu hình MVP.",
        icon: FileCog,
        allowedRoles: ["admin", "super_admin"],
      },
    ],
  },
  {
    title: "Tài khoản",
    items: [
      {
        key: "profile",
        href: "/admin/profile",
        label: "Hồ sơ",
        description: "Xem và cập nhật thông tin cá nhân của bạn.",
        icon: Shield,
        allowedRoles: ["staff", "admin", "super_admin"],
      },
    ],
  },
]

export const adminSectionMeta: Record<AdminSectionKey, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "The Horizon ops",
    title: "Bảng điều khiển quản trị",
    description: "Tách các nghiệp vụ chính thành từng module nhỏ để quản lý dễ hơn thay vì dồn tất cả vào một màn hình.",
  },
  bookings: {
    eyebrow: "Bookings",
    title: "Quản lý bookings",
    description: "Theo dõi trạng thái đơn đặt chỗ, tình trạng thanh toán và các booking cần xử lý ngay.",
  },
  payments: {
    eyebrow: "Payments",
    title: "Điều phối thanh toán",
    description: "Tập trung các giao dịch, payment request và trạng thái thu tiền ở một nơi riêng.",
  },
  reviews: {
    eyebrow: "Reviews",
    title: "Kiểm duyệt đánh giá",
    description: "Theo dõi review mới, review chờ duyệt và chất lượng phản hồi của khách hàng.",
  },
  support: {
    eyebrow: "Support",
    title: "Xử lý ticket hỗ trợ",
    description: "Ưu tiên các ticket đang mở, sắp xếp theo mức độ khẩn và theo dõi tiến độ chăm sóc khách hàng.",
  },
  tours: {
    eyebrow: "Tours",
    title: "Kiểm soát danh mục tour",
    description: "Tách riêng phần nội dung tour cho admin để đội vận hành không bị nhiễu bởi các tác vụ biên tập.",
  },
  activity: {
    eyebrow: "Activity",
    title: "Nhật ký hoạt động",
    description: "Quan sát biến động gần đây của hệ thống để kiểm thử, đối soát và truy vết thao tác.",
  },
  system: {
    eyebrow: "System",
    title: "Ghi chú hệ thống & phân quyền",
    description: "Tổng hợp role, vùng truy cập và các ghi chú kỹ thuật để tách rõ staff với admin/super_admin.",
  },
  profile: {
    eyebrow: "Account",
    title: "Thông tin cá nhân",
    description: "Cập nhật thông tin tài khoản quản trị của bạn.",
  },
}

export function canAccessAdminSection(role: RoleName, allowedRoles: ManagementRole[]) {
  return allowedRoles.includes(role as ManagementRole)
}

export function isAdminPathActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/overview"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getAdminMenuItem(section: AdminSectionKey) {
  return adminMenuGroups.flatMap((group) => group.items).find((item) => item.key === section)
}

export function getRoleCapabilitySummary(role: RoleName) {
  if (role === "staff") {
    return "Staff tập trung vào các module vận hành hằng ngày như bookings, payments, reviews và support."
  }

  if (role === "admin") {
    return "Admin có thêm quyền kiểm soát tours, nhật ký hệ thống và phần cấu hình vận hành nội bộ."
  }

  if (role === "super_admin") {
    return "Super Admin dùng cùng console với admin nhưng là lớp role cao nhất để mở rộng quyền hệ thống về sau."
  }

  return "Khách hàng không có quyền truy cập khu quản trị."
}

export const adminNotesIcon = FileClock
