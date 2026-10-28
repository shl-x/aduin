"use client";

/**
 * src/components/demo-role-entry.tsx
 *
 * Daftar "Masuk sebagai …" per akun demo di beranda (seluruh baris bisa diklik). Login lewat
 * POST /api/demo/login (password tidak pernah sampai ke browser), lalu
 * diarahkan ke halaman utama role tersebut.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const ROLES = [
  { key: "warga", title: "Warga", description: "Lapor lewat simulator WhatsApp dan konfirmasi penyelesaian.", home: "/lapor" },
  { key: "operator", title: "Operator", description: "Pantau aduan, peta hotspot, peringatan dini, dan koordinasi OPD.", home: "/dashboard" },
  { key: "pu", title: "Petugas DPU", description: "Kerjakan tugas Dinas PU dan unggah bukti penyelesaian.", home: "/tugas" },
  { key: "dinkes", title: "Petugas Dinkes", description: "Kerjakan tugas Dinas Kesehatan.", home: "/tugas" },
  { key: "bpkad", title: "Petugas BPKAD", description: "Selesaikan tugas alokasi anggaran darurat.", home: "/tugas" },
  { key: "pimpinan", title: "Pimpinan", description: "Lihat KPI, tren, dan kinerja OPD.", home: "/ringkasan" },
] as const;

export function DemoRoleEntry() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!DEMO_MODE) {
    return (
      <p className="text-sm text-muted-foreground">
        Mode demo tidak aktif. Setel <code>NEXT_PUBLIC_DEMO_MODE=true</code> untuk masuk dengan akun demo.
      </p>
    );
  }

  async function enter(key: string, home: string) {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Gagal masuk. Coba lagi.");
        setLoading(null);
        return;
      }
      router.push(home);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="border-t">
        {ROLES.map((r) => (
          <li key={r.key} className="border-b">
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => enter(r.key, r.home)}
              className="flex min-h-16 w-full flex-wrap items-center gap-x-6 gap-y-1 px-1 py-3.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
            >
              <span className="flex-[0_0_180px] text-[17px] font-extrabold">{r.title}</span>
              <span className="flex-[1_1_260px] text-[15px] leading-relaxed text-ink-2">{r.description}</span>
              {loading === r.key ? (
                <Loader2 className="size-5 animate-spin text-link" aria-label="Masuk…" />
              ) : (
                <ArrowRight className="size-5 text-link" aria-hidden />
              )}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
    </div>
  );
}
