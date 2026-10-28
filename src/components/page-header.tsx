/**
 * src/components/page-header.tsx
 *
 * Kepala halaman "Meja Kerja": konteks kecil (unit/peran) di atas judul besar,
 * deskripsi singkat dalam bahasa kerja, dan slot aksi di kanan.
 */

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0 max-w-3xl">
        <p className="text-[15px] text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Label kecil untuk judul bagian/kartu. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[13px] font-bold text-muted-foreground", className)}>
      {children}
    </p>
  );
}

/** Format ID tiket pendek dari UUID, mis. "#3F2A9C". */
export function ticketId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
