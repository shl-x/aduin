"use client";

/**
 * src/components/sidebar-active-link.tsx
 *
 * Wrapper tipis di atas <Link> yang menambahkan gaya "aktif" berdasarkan
 * pathname saat ini. Dipakai di menu header (MainNav).
 *
 * Dipisah menjadi Client Component agar MainNav tetap Server Component
 * (tidak ada "use client"), sehingga dapat menerima role dari Server tanpa
 * menyebabkan hydration mismatch.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  href: string;
  children: React.ReactNode;
  /** Awalan path lain yang juga menandai link ini aktif. */
  also?: string[];
}

export function SidebarActiveLink({ href, children, also = [] }: Props) {
  const pathname = usePathname();
  const isActive = [href, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "inline-flex min-h-11 items-center rounded-lg px-3.5 text-[15px] whitespace-nowrap transition-colors duration-150",
        isActive
          ? "bg-primary-soft font-bold text-link"
          : "font-semibold text-ink-2 hover:bg-muted hover:text-ink"
      )}
    >
      {children}
    </Link>
  );
}
