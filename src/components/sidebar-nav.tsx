/**
 * src/components/sidebar-nav.tsx
 *
 * Menu utama Aduin di header atas ("Meja Kerja"). Link yang ditampilkan
 * berbeda bergantung role pengguna. Nama file dipertahankan karena tipe
 * UserRole dan ROLE_LABELS diimpor dari sini oleh modul lain.
 *
 * Role diterima sebagai prop dari layout.tsx (Server Component) yang membaca
 * sesi Supabase lewat cookie — satu-satunya sumber kebenaran.
 * Tidak ada localStorage atau client state untuk role.
 */

import { SidebarActiveLink } from "@/components/sidebar-active-link";

// ---------------------------------------------------------------------------
// Tipe (diekspor agar dipakai di server.ts dan role-switcher)
// ---------------------------------------------------------------------------

export type UserRole = "warga" | "operator" | "petugas_opd" | "pimpinan";

interface NavItem {
  href: string;
  label: string;
  /** Path lain yang juga menandai link ini aktif (mis. detail aduan). */
  also?: string[];
}

// ---------------------------------------------------------------------------
// Peta navigasi per role
// ---------------------------------------------------------------------------

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  warga: [{ href: "/lapor", label: "Lapor dan aduan saya" }],
  operator: [
    { href: "/dashboard", label: "Antrian kerja", also: ["/aduan"] },
    { href: "/peta", label: "Peta" },
    { href: "/alert", label: "Peringatan" },
  ],
  petugas_opd: [{ href: "/tugas", label: "Tugas saya", also: ["/aduan"] }],
  pimpinan: [{ href: "/ringkasan", label: "Ringkasan kinerja" }],
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

interface MainNavProps {
  role: UserRole | null;
  /** Jumlah peringatan dini aktif, ditampilkan di link "Peringatan". */
  alertCount?: number;
}

export function MainNav({ role, alertCount = 0 }: MainNavProps) {
  const navItems = role ? NAV_ITEMS[role] : [];
  if (navItems.length === 0) return null;

  return (
    <nav aria-label="Menu utama" className="flex min-w-0 flex-wrap gap-1">
      {navItems.map((item) => (
        <SidebarActiveLink key={item.href} href={item.href} also={item.also}>
          {item.label}
          {item.href === "/alert" && alertCount > 0 && (
            <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-strong px-1.5 text-xs font-extrabold leading-5 text-surface">
              {alertCount}
              <span className="sr-only"> aktif</span>
            </span>
          )}
        </SidebarActiveLink>
      ))}
    </nav>
  );
}
