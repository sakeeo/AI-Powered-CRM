import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckSquare,
  FileText,
  Handshake,
  LayoutDashboard,
  MessageCircle,
  MessageSquareHeart,
  Package,
  Plug,
  Settings,
  Target,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { title: string; href: string; icon: LucideIcon; description: string };
export type NavGroup = { label: string; items: NavItem[] };

/** Struktur navigasi mengikuti PRD §5. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Ringkasan penjualan dan tindakan yang perlu dilakukan.",
      },
      {
        title: "Leads",
        href: "/leads",
        icon: Target,
        description: "Calon pelanggan dari pertama masuk hingga dikualifikasi.",
      },
      {
        title: "Contacts",
        href: "/contacts",
        icon: UserCircle,
        description: "Individu yang berhubungan dengan bisnis Anda.",
      },
      {
        title: "Companies",
        href: "/companies",
        icon: Building2,
        description: "Perusahaan pelanggan dan prospek.",
      },
      {
        title: "Deals & Pipelines",
        href: "/deals",
        icon: Handshake,
        description: "Peluang penjualan dalam pipeline Kanban.",
      },
    ],
  },
  {
    label: "Productivity",
    items: [
      {
        title: "Activities & Tasks",
        href: "/activities",
        icon: CheckSquare,
        description: "Task, call, meeting, dan follow-up.",
      },
      {
        title: "Inbox WhatsApp",
        href: "/inbox",
        icon: MessageCircle,
        description: "Percakapan WhatsApp pelanggan dalam satu inbox.",
      },
      {
        title: "Calendar",
        href: "/calendar",
        icon: CalendarDays,
        description: "Jadwal aktivitas harian dan mingguan.",
      },
      {
        title: "Products",
        href: "/products",
        icon: Package,
        description: "Katalog produk dan layanan beserta harga.",
      },
      {
        title: "Quotations",
        href: "/quotations",
        icon: FileText,
        description: "Penawaran harga yang terhubung dengan deal.",
      },
    ],
  },
  {
    label: "Customers & Insights",
    items: [
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
        description: "Pelanggan dari deal Won beserta riwayatnya.",
      },
      {
        title: "Reports & Analytics",
        href: "/reports",
        icon: BarChart3,
        description: "Laporan performa lead, pipeline, dan penjualan.",
      },
      {
        title: "Customer Feedback",
        href: "/feedback",
        icon: MessageSquareHeart,
        description: "Feedback dan complaint pelanggan.",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        title: "Users & Teams",
        href: "/users",
        icon: Users,
        description: "Pengguna, tim, dan hak akses.",
      },
      {
        title: "Connectors",
        href: "/settings/connectors",
        icon: Plug,
        description: "AI (BYOK), webhook, WhatsApp, dan email delivery.",
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        description: "Organisasi, role, pipeline, lead source, custom fields, tags.",
      },
    ],
  },
];

/** Halaman yang tidak ada di sidebar tetapi perlu judul topbar & muncul di command palette. */
const EXTRA_PAGES: NavItem[] = [
  {
    title: "Notifikasi",
    href: "/notifications",
    icon: Bell,
    description: "Inbox notifikasi dan preferensi reminder.",
  },
];

export const ALL_NAV_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), ...EXTRA_PAGES];
