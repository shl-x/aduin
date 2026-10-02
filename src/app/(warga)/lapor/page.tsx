/**
 * src/app/(warga)/lapor/page.tsx
 * Simulator WhatsApp — Server Component: fetch daftar desa untuk dropdown,
 * lalu render LaporChat (Client Component) yang menangani percakapan.
 *
 * M5: di bawah chat, warga melihat "Aduan Saya" beserta statusnya; aduan
 * berstatus ai_verified menunggu konfirmasi / penolakan warga.
 */
import { createClient } from "@/lib/supabase/client";
import { getSessionProfile } from "@/lib/supabase/server";
import { LaporChat } from "@/components/lapor-chat";
import { AduanSaya, type MyComplaint } from "@/components/aduan-saya";
import { CATEGORIES } from "@/lib/constants/categories";
import { getVerificationHistory } from "@/lib/services/verification";

async function loadMyComplaints(
  supabase: ReturnType<typeof createClient>,
  reporterId: string
): Promise<MyComplaint[]> {
  const { data, error } = await supabase
    .from("complaints")
    .select(
      "id, text, status, reported_at, effective_category, photo_before_url, photo_after_url, region:region_id(name)"
    )
    .eq("reporter_id", reporterId)
    .order("reported_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const verifiedIds = rows.filter((c) => c.status === "ai_verified").map((c) => c.id);
  const history = await getVerificationHistory(supabase, verifiedIds);

  return rows.map((c) => {
    const region = c.region as unknown as { name: string } | null;
    return {
      id: c.id,
      text: c.text,
      status: c.status,
      reported_at: c.reported_at,
      category_label: CATEGORIES.find((cat) => cat.slug === c.effective_category)?.label ?? null,
      region_name: region?.name ?? null,
      photo_before_url: c.photo_before_url,
      photo_after_url: c.photo_after_url,
      ai_reason: history.get(c.id)?.verifications[0]?.ai_reason ?? null,
    };
  });
}

export default async function LaporPage() {
  const supabase = createClient();
  const profile = await getSessionProfile();

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

  let myComplaints: MyComplaint[] = [];
  let myComplaintsError: string | null = null;
  if (profile?.role === "warga") {
    try {
      myComplaints = await loadMyComplaints(supabase, profile.id);
    } catch (err) {
      myComplaintsError = err instanceof Error ? err.message : "Gagal memuat aduan.";
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laporkan Aduan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sampaikan keluhan atau aduan Anda kepada pemerintah daerah.
        </p>
      </div>

      <LaporChat regions={regionOptions} />

      {profile?.role === "warga" && (
        <AduanSaya complaints={myComplaints} loadError={myComplaintsError} />
      )}
    </div>
  );
}
