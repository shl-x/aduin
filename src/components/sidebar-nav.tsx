"use client";

/**
 * src/components/sidebar-nav.tsx
 *
 * Sidebar navigasi utama Aduin.
 * Link yang ditampilkan berbeda bergantung role pengguna.
 *
 * Untuk M0, role disimpan di localStorage (state sementara) agar DoD
 * "sidebar menampilkan link berbeda bergantung role" bisa diverifikasi
 * tanpa Supabase Auth.
 *
 * M1 akan mengganti localStorage dengan sesi Supabase.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  MessageSquare,
  LayoutDashboard,
  Map,
  Bell,
  ClipboardList,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// ---------------------------------------------------------------------------
// Tipe
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

const ROLE_LABELS: Record<UserRole, string> = {
  warga: "Warga",
  operator: "Operator",
  petugas_opd: "Petugas OPD",
  pimpinan: "Pimpinan",
};

const ALL_ROLES: UserRole[] = ["warga", "operator", "petugas_opd", "pimpinan"];

// ---------------------------------------------------------------------------
// Komponen
// ---------------------------------------------------------------------------

export function SidebarNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>(() => {
    // Muat role dari localStorage saat mount (hanya di M0 — nanti diganti Auth)
    if (typeof window === "undefined") return "operator";
    const stored = localStorage.getItem("aduin_demo_role") as UserRole | null;
    return stored && ALL_ROLES.includes(stored) ? stored : "operator";
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function handleRoleChange(newRole: UserRole) {
    setRole(newRole);
    localStorage.setItem("aduin_demo_role", newRole);
    setDropdownOpen(false);
  }

  const navItems = NAV_ITEMS[role];

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

      {/* Role switcher (demo M0) */}
      <div className="px-3 py-3 relative">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
          Role saat ini
        </p>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center justify-between w-full rounded-md px-3 py-2 text-sm font-medium bg-muted hover:bg-accent transition-colors"
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
        >
          <span>{ROLE_LABELS[role]}</span>
          <ChevronDown size={14} className={cn(dropdownOpen && "rotate-180 transition-transform")} />
        </button>

        {dropdownOpen && (
          <ul
            role="listbox"
            className="absolute left-3 right-3 z-50 mt-1 rounded-md border bg-popover shadow-md text-sm overflow-hidden"
          >
            {ALL_ROLES.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  role="option"
                  aria-selected={r === role}
                  onClick={() => handleRoleChange(r)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-accent transition-colors",
                    r === role && "font-semibold text-primary"
                  )}
                >
                  {ROLE_LABELS[r]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* Navigasi per role */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer kecil */}
      <div className="px-4 py-3 text-[10px] text-muted-foreground border-t">
        Hackathon IBM · Aduin v0
      </div>
    </aside>
  );
}
