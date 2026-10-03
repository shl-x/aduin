/**
 * src/components/sidebar-nav.tsx
 *
 * Sidebar navigasi utama Aduin — "konsol" biru tua di kedua mode.
 * Link yang ditampilkan berbeda bergantung role pengguna.
 *
 * Role diterima sebagai prop dari layout.tsx (Server Component) yang membaca
 * sesi Supabase lewat cookie — satu-satunya sumber kebenaran.
 * Tidak ada localStorage atau client state untuk role.
 *
 * Di bawah breakpoint md, sidebar diganti strip navigasi horizontal
 * (MobileNav) agar konten tetap selebar layar.
 */

import Link from "next/link";
import {
  MessageSquare,
  LayoutDashboard,
  Map,
  Bell,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { SidebarActiveLink } from "@/components/sidebar-active-link";
import { AduinLogo } from "@/components/brand/AduinLogo";

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
      icon: <MessageSquare size={16} aria-hidden />,
    },
  ],
  operator: [
    {
      href: "/dashboard",
      label: "Daftar Aduan",
      icon: <LayoutDashboard size={16} aria-hidden />,
    },
    { href: "/peta", label: "Peta Hotspot", icon: <Map size={16} aria-hidden /> },
    {
      href: "/alert",
      label: "Peringatan Dini",
      icon: <Bell size={16} aria-hidden />,
    },
  ],
  petugas_opd: [
    {
      href: "/tugas",
      label: "Tugas Saya",
      icon: <ClipboardList size={16} aria-hidden />,
    },
  ],
  pimpinan: [
    {
      href: "/ringkasan",
      label: "Ringkasan Kinerja",
      icon: <BarChart3 size={16} aria-hidden />,
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
  const roleLabel = role ? ROLE_LABELS[role] : "Belum masuk";

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-white/10 bg-console text-console-ink h-screen sticky top-0 overflow-y-auto">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <Link href="/" className="inline-flex rounded-md" aria-label="Aduin — beranda">
          <AduinLogo variant="horizontal" tone="console" size={28} title="" />
        </Link>
        <p className="text-[11px] text-console-muted mt-2 leading-snug">
          Aduin aja, sisanya kami yang urus.
        </p>
      </div>

      {/* Role aktif (read-only — penggantian role lewat RoleSwitcher di header) */}
      <div className="px-3 pb-3">
        <div className="rounded-md border border-white/10 px-3 py-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-console-muted">
            Role aktif
          </p>
          <p className="text-sm font-semibold mt-0.5">{roleLabel}</p>
        </div>
      </div>

      {/* Navigasi per role */}
      <nav aria-label="Navigasi utama" className="flex-1 px-3 py-2 space-y-1">
        <p className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-console-muted">
          Menu
        </p>
        {navItems.length === 0 ? (
          <p className="px-3 py-2 text-xs text-console-muted">
            Pilih role demo untuk melihat menu.
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
      <div className="px-5 py-4 border-t border-white/10 font-mono text-[10px] uppercase tracking-[0.12em] text-console-muted">
        Kab. Probolinggo · Hackathon IBM
      </div>
    </aside>
  );
}

/** Strip navigasi untuk layar sempit (< md). */
export function MobileNav({ role }: SidebarNavProps) {
  const navItems = role ? NAV_ITEMS[role] : [];
  if (navItems.length === 0) return null;

  return (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden flex gap-1 overflow-x-auto bg-console px-3 py-2"
    >
      {navItems.map((item) => (
        <SidebarActiveLink key={item.href} href={item.href} compact>
          {item.icon}
          {item.label}
        </SidebarActiveLink>
      ))}
    </nav>
  );
}
