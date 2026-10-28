"use client";

/**
 * src/components/dashboard-filters.tsx
 *
 * Filter kategori untuk antrian kerja /dashboard (tahap dipilih lewat tab).
 * Menyimpan pilihan di query string (?category=) supaya halaman tetap
 * Server Component dan bisa di-refresh/dibagikan sebagai URL.
 */

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants/categories";

const ALL = "__all__";

// Label dirender eksplisit lewat children-function Select.Value — tanpa ini
// Base UI bisa menampilkan nilai mentah ("__all__") sebelum popup dibuka.
const CATEGORY_ITEMS: Record<string, string> = {
  [ALL]: "Semua kategori",
  ...Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.label])),
};

export function DashboardFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? ALL;

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={category} onValueChange={(v) => updateParam("category", v)}>
        <SelectTrigger className="h-11 w-full sm:w-60" aria-label="Filter kategori">
          <SelectValue>{(v: string | null) => CATEGORY_ITEMS[v ?? ALL] ?? "Semua kategori"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Semua kategori</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c.slug} value={c.slug}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
