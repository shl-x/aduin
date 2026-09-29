/**
 * src/app/(warga)/lapor/page.tsx
 * Simulator WhatsApp — Server Component: fetch daftar desa untuk dropdown,
 * lalu render LaporChat (Client Component) yang menangani percakapan.
 */
import { createClient } from "@/lib/supabase/client";
import { LaporChat } from "@/components/lapor-chat";

export default async function LaporPage() {
  const supabase = createClient();

  const { data: regions } = await supabase
    .from("regions")
    .select("id, name, level, parent_id")
    .order("name");

  const kecamatanNameById = new Map(
    (regions ?? []).filter((r) => r.level === "kecamatan").map((r) => [r.id, r.name])
  );

  const regionOptions = (regions ?? [])
    .filter((r) => r.level === "desa")
    .map((r) => ({
      id: r.id,
      label: `${r.name} — Kec. ${r.parent_id ? (kecamatanNameById.get(r.parent_id) ?? "?") : "?"}`,
    }));

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporkan Aduan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sampaikan keluhan atau aduan Anda kepada pemerintah daerah.
        </p>
      </div>

      <LaporChat regions={regionOptions} />
    </div>
  );
}
