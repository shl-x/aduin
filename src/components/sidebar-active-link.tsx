"use client";

/**
 * src/components/sidebar-active-link.tsx
 *
 * Wrapper tipis di atas <Link> yang menambahkan gaya "aktif" berdasarkan
 * pathname saat ini.
 *
 * Dipisah menjadi Client Component agar SidebarNav tetap Server Component
 * (tidak ada "use client"), sehingga dapat menerima role dari Server tanpa
 * menyebabkan hydration mismatch.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Props {
  href: string;
  children: React.ReactNode;
}

export function SidebarActiveLink({ href, children }: Props) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </Link>
  );
}
