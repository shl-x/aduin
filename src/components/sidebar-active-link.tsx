"use client";

/**
 * src/components/sidebar-active-link.tsx
 *
 * Wrapper tipis di atas <Link> yang menambahkan gaya "aktif" berdasarkan
 * pathname saat ini. Dipakai di sidebar konsol (latar --console).
 *
 * Dipisah menjadi Client Component agar SidebarNav tetap Server Component
 * (tidak ada "use client"), sehingga dapat menerima role dari Server tanpa
 * menyebabkan hydration mismatch.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  href: string;
  children: React.ReactNode;
  /** Varian ringkas untuk strip navigasi mobile. */
  compact?: boolean;
}

export function SidebarActiveLink({ href, children, compact = false }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm transition-colors duration-150 whitespace-nowrap",
        compact ? "px-3 py-2 min-h-10" : "px-3 py-2.5 min-h-11",
        isActive
          ? "bg-primary text-primary-foreground font-semibold"
          : "text-console-muted hover:bg-white/8 hover:text-console-ink"
      )}
    >
      {children}
    </Link>
  );
}
