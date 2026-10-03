"use client";

/**
 * src/components/role-switcher.tsx
 *
 * Login-instan antar-akun demo.
 * Hanya dirender saat NEXT_PUBLIC_DEMO_MODE=true.
 *
 * Login dilakukan lewat POST /api/demo/login — password demo hanya pernah
 * dibaca di server, tidak pernah dikirim ke atau ada di browser. Setelah
 * endpoint memasang cookie sesi, panggil router.refresh() agar Server
 * Components merender ulang dengan sesi baru (role baru) tanpa full reload.
 * Tidak membaca localStorage. Role aktif diterima sebagai prop dari server.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/components/sidebar-nav";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface DemoRoleConfig {
  key: string;
  label: string;
  role: UserRole;
}

const DEMO_ROLES: DemoRoleConfig[] = [
  { key: "warga",    label: "Warga",    role: "warga" },
  { key: "operator", label: "Operator", role: "operator" },
  { key: "pu",       label: "DPU",      role: "petugas_opd" },
  { key: "dinkes",   label: "Dinkes",   role: "petugas_opd" },
  { key: "bpkad",    label: "BPKAD",    role: "petugas_opd" },
  { key: "pimpinan", label: "Pimpinan", role: "pimpinan" },
];

interface RoleSwitcherProps {
  currentRole: UserRole | null;
}

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!DEMO_MODE) return null;

  async function switchTo(key: string) {
    setLoading(key);
    setError(null);

    const res = await fetch("/api/demo/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Login gagal.");
      setLoading(null);
      return;
    }

    // router.refresh() meminta server merender ulang layout dengan sesi baru.
    // Lebih cepat dari window.location.reload() karena tidak reload seluruh halaman.
    router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
      <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
        Mode demo
      </span>
      <div
        role="group"
        aria-label="Masuk sebagai akun demo"
        className="flex w-full min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg border bg-muted p-0.5 sm:w-auto"
      >
        {DEMO_ROLES.map((demo) => {
          const isActive = currentRole === demo.role &&
            // untuk petugas_opd ada 2 akun; biarkan keduanya aktif jika role cocok
            true;
          return (
            <Button
              key={demo.key}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              disabled={loading !== null}
              aria-pressed={isActive}
              onClick={() => switchTo(demo.key)}
              className={cn(
                "h-8 flex-1 px-1.5 text-xs sm:flex-none sm:px-2.5",
                isActive ? "font-semibold" : "text-muted-foreground hover:bg-surface"
              )}
            >
              {loading === demo.key ? (
                <span className="animate-pulse">Masuk…</span>
              ) : (
                demo.label
              )}
            </Button>
          );
        })}
      </div>
      {error && (
        <span role="alert" className="text-xs text-danger-text">{error}</span>
      )}
    </div>
  );
}
