/**
 * src/components/sidebar-nav.tsx
 *
 * Sidebar navigasi utama Aduin.
 * Link yang ditampilkan berbeda bergantung role pengguna.
 *
 * Role diterima sebagai prop dari layout.tsx (Server Component) yang membaca
 * sesi Supabase lewat cookie — satu-satunya sumber kebenaran.
 * Tidak ada localStorage atau client state untuk role.
 */

import {
  MessageSquare,
  LayoutDashboard,
  Map,
  Bell,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { SidebarActiveLink } from "@/components/sidebar-active-link";

// ---------------------------------------------------------------------------
// Tipe (diekspor agar dipakai di server.ts dan role-switcher)
// ---------------------------------------------------------------------------

export type UserRole = "warga" | "operator" | "petugas_opd" | "pimpinan";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Peta navigasi per role
// ---------------------------------------------------------------------------

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  warga: [
    {
      href: "/lapor",
      label: "Laporkan Aduan",
      icon: <MessageSquare size={16} />,
    },
  ],
  operator: [
    {
      href: "/dashboard",
      label: "Daftar Aduan",
      icon: <LayoutDashboard size={16} />,
    },
    { href: "/peta", label: "Peta Hotspot", icon: <Map size={16} /> },
    {
      href: "/alert",
      label: "Peringatan Dini",
      icon: <Bell size={16} />,
    },
  ],
  petugas_opd: [
    {
      href: "/tugas",
      label: "Tugas Saya",
      icon: <ClipboardList size={16} />,
    },
  ],
  pimpinan: [
    {
      href: "/ringkasan",
      label: "Ringkasan Kinerja",
      icon: <BarChart3 size={16} />,
    },
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  warga: "Warga",
  operator: "Operator",
  petugas_opd: "Petugas OPD",
  pimpinan: "Pimpinan",
};

// ---------------------------------------------------------------------------
// Komponen (Server Component — tidak ada "use client")
// ---------------------------------------------------------------------------

interface SidebarNavProps {
  role: UserRole | null;
}

export function SidebarNav({ role }: SidebarNavProps) {
  const navItems = role ? NAV_ITEMS[role] : [];
  const roleLabel = role ? ROLE_LABELS[role] : "Pilih role";

  return (
    <aside className="flex flex-col w-56 shrink-0 border-r bg-card h-screen sticky top-0 overflow-y-auto">
      {/* Logo / branding */}
      <div className="px-4 py-5">
        <span className="font-bold text-lg tracking-tight text-primary">
          Aduin
        </span>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          Aduin aja, sisanya kami yang urus.
        </p>
      </div>

      <Separator />

      {/* Role aktif (read-only — penggantian role lewat RoleSwitcher di header) */}
      <div className="px-3 py-3">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
          Role saat ini
        </p>
        <div className="flex items-center rounded-md px-3 py-2 text-sm font-medium bg-muted">
          <span>{roleLabel}</span>
        </div>
      </div>

      <Separator />

      {/* Navigasi per role */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Login untuk melihat menu.
          </p>
        ) : (
          navItems.map((item) => (
            <SidebarActiveLink key={item.href} href={item.href}>
              {item.icon}
              {item.label}
            </SidebarActiveLink>
          ))
        )}
      </nav>

      {/* Footer kecil */}
      <div className="px-4 py-3 text-[10px] text-muted-foreground border-t">
        Hackathon IBM · Aduin v0
      </div>
    </aside>
  );
}
