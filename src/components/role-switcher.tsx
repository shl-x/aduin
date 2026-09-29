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
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
        Demo:
      </span>
      {DEMO_ROLES.map((demo) => {
        const isActive = currentRole === demo.role &&
          // untuk petugas_opd ada 2 akun; biarkan keduanya aktif jika role cocok
          true;
        return (
          <Button
            key={demo.key}
            variant={isActive ? "default" : "outline"}
            size="sm"
            disabled={loading !== null}
            onClick={() => switchTo(demo.key)}
            className={cn("h-7 px-2.5 text-xs", isActive && "font-semibold")}
          >
            {loading === demo.key ? (
              <span className="animate-pulse">Masuk…</span>
            ) : (
              demo.label
            )}
          </Button>
        );
      })}
      {error && (
        <span className="text-xs text-destructive ml-1">{error}</span>
      )}
    </div>
  );
}
