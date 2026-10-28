/**
 * src/app/(operator)/dashboard/page.tsx
 * Antrian kerja operator ("Meja Kerja"). Aduan dikelompokkan per tahap
 * penanganan (?tahap=1..5) dengan jumlah di setiap tab, dan setiap baris
 * menyebut langkah berikutnya. Filter kategori (?category=) dan wilayah
 * (?region=, dari tautan "Lihat aduan terkait" di /alert) tetap berlaku.
 * Server Component — data di-query langsung berdasarkan query string.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, LayoutDashboard, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardFilters } from "@/components/dashboard-filters";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { getSessionRole } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/client";
import { getActiveAlerts, type ActiveAlert } from "@/lib/analytics/early-warning";
import { CATEGORIES } from "@/lib/constants/categories";
import { PageHeader, ticketId } from "@/components/page-header";
import { UrgencyBar } from "@/components/urgency-bar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Antrian kerja" };

interface Stage {
  no: number;
  label: string;
  statuses: string[];
  explain: string;
}

const STAGES: Stage[] = [
  { no: 1, label: "Perlu dicek manusia", statuses: ["pending", "triage_failed", "needs_review"], explain: "AI belum selesai, gagal memproses, atau ragu menilai foto bukti. Butuh keputusan Anda." },
  { no: 2, label: "Siap dikoordinasi", statuses: ["triaged"], explain: "AI sudah menentukan kategori dan dinas. Periksa alasannya, lalu buat rencana penanganan." },
  { no: 3, label: "Dikerjakan dinas", statuses: ["in_progress"], explain: "Petugas OPD sedang bekerja. Pantau tugas yang macet." },
  { no: 4, label: "Tunggu konfirmasi warga", statuses: ["ai_verified"], explain: "Foto bukti lolos pemeriksaan AI. Warga belum menjawab apakah masalahnya beres." },
  { no: 5, label: "Selesai", statuses: ["closed"], explain: "Ditutup setelah warga mengonfirmasi. Data ini masuk ke ringkasan pimpinan." },
];

const WHY_TRIAGED: Record<string, string> = {
  quick_fix: "Bisa langsung dikerjakan",
  bertahap: "Penanganan bertahap",
  butuh_data: "Butuh data lanjutan",
};

interface ComplaintRow {
  id: string;
  text: string;
  status: string;
  effective_category: string | null;
  reported_at: string;
  region: { name: string } | null;
  opd: { short_name: string } | null;
  triage_results: { urgency: number; handling_path: string; created_at: string }[] | null;
}

function latestTriage(rows: ComplaintRow["triage_results"]) {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** Langkah berikutnya untuk satu aduan: label tombol + alasan singkat. */
function nextStep(c: ComplaintRow, handlingPath: string | undefined): { action: string; why: string } {
  switch (c.status) {
    case "pending":
      return { action: "Buka aduan", why: "AI sedang memproses" };
    case "triage_failed":
      return { action: "Triase manual", why: "AI gagal memproses" };
    case "needs_review":
      return { action: "Tinjau foto bukti", why: "AI ragu dengan foto" };
    case "triaged":
      return { action: "Buat rencana koordinasi", why: WHY_TRIAGED[handlingPath ?? ""] ?? "Sudah ditriase" };
    case "in_progress":
      return { action: "Pantau progres", why: c.opd ? `Dikerjakan ${c.opd.short_name}` : "Dikerjakan dinas" };
    case "ai_verified":
      return { action: "Lihat bukti", why: "Belum dijawab warga" };
    default:
      return { action: "Lihat riwayat", why: "Sudah ditutup" };
  }
}

const timeFmt: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tahap?: string; category?: string; region?: string }>;
}) {
  const { tahap, category, region } = await searchParams;
  const supabase = createClient();
  const role = await getSessionRole();

  // Jumlah per status (untuk tab), dengan filter kategori/wilayah yang sama.
  // shortcut: hitung di aplikasi dari kolom status saja; ganti ke RPC COUNT bila aduan > 1000.
  let countQuery = supabase.from("complaints").select("status").limit(5000);
  if (category) countQuery = countQuery.eq("effective_category", category);
  if (region) countQuery = countQuery.eq("region_id", region);
  const { data: statusRows } = await countQuery;
  const byStatus: Record<string, number> = {};
  for (const r of statusRows ?? []) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const stageCount = (s: Stage) => s.statuses.reduce((n, st) => n + (byStatus[st] ?? 0), 0);
  const total = (statusRows ?? []).length;

  const requested = STAGES.find((s) => String(s.no) === tahap);
  const stage = requested ?? (stageCount(STAGES[0]) > 0 ? STAGES[0] : STAGES[1]);

  let query = supabase
    .from("complaints")
    .select(
      "id, text, status, effective_category, reported_at, region:region_id(name), opd:effective_opd_id(short_name), triage_results(urgency, handling_path, created_at)"
    )
    .in("status", stage.statuses)
    .order("reported_at", { ascending: false })
    .limit(200);
  if (category) query = query.eq("effective_category", category);
  if (region) query = query.eq("region_id", region);
  const { data, error } = await query;

  // Paling mendesak dulu di tahap yang butuh tindakan; sisanya terbaru dulu.
  const complaints = ((data ?? []) as unknown as ComplaintRow[])
    .map((c) => ({ c, triage: latestTriage(c.triage_results) }))
    .sort((a, b) => (stage.no <= 3 ? (b.triage?.urgency ?? 0) - (a.triage?.urgency ?? 0) : 0));

  const { data: regionRow } = region
    ? await supabase.from("regions").select("name").eq("id", region).maybeSingle()
    : { data: null };

  let alerts: ActiveAlert[] = [];
  if (role === "operator") alerts = await getActiveAlerts(supabase).catch(() => []);

  const href = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ tahap: String(stage.no), category, region, ...params })) if (v) p.set(k, v);
    return `/dashboard?${p.toString()}`;
  };
  const stage1Hint = [
    byStatus.triage_failed ? `${byStatus.triage_failed} gagal ditriase AI` : null,
    byStatus.needs_review ? `${byStatus.needs_review} foto bukti perlu ditinjau` : null,
    byStatus.pending ? `${byStatus.pending} sedang diproses AI` : null,
  ].filter(Boolean).join(", ") || "Tidak ada yang menunggu";
  const actionable = stage.no <= 2;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator · Command center"
        title="Antrian kerja"
        description={`${total} aduan tercatat. Pilih tahap untuk melihat aduan yang menunggu.`}
        actions={role === "operator" ? <ResetDemoButton /> : undefined}
      />

      {alerts[0] && (
        <section
          aria-label="Peringatan dini"
          className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-xl border-2 border-accent-strong bg-surface px-5 py-4"
        >
          <AlertTriangle className="size-7 shrink-0 text-accent-text" aria-hidden />
          <div className="min-w-0 flex-[1_1_480px]">
            <p className="text-[17px] font-bold">
              Lonjakan aduan {alerts[0].category_label} di {alerts[0].region_name ?? "wilayah tidak diketahui"}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              {alerts[0].count_24h} aduan masuk dalam 24 jam terakhir, padahal biasanya{" "}
              {alerts[0].mean_14d.toLocaleString("id-ID", { maximumFractionDigits: 1 })} per hari.
              {alerts.length > 1 && ` Ada ${alerts.length - 1} peringatan lain.`}
            </p>
          </div>
          <Link
            href="/alert"
            className="inline-flex min-h-11 items-center rounded-lg bg-strong px-5 text-[15px] font-bold text-strong-foreground hover:opacity-90"
          >
            Buka peringatan
          </Link>
        </section>
      )}

      <nav
        aria-label="Tahap penanganan"
        className="grid grid-cols-[repeat(5,minmax(170px,1fr))] overflow-x-auto rounded-xl border bg-surface"
      >
        {STAGES.map((s) => {
          const selected = s.no === stage.no;
          return (
            <Link
              key={s.no}
              href={href({ tahap: String(s.no) })}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex flex-col gap-1 border-r px-5 py-4 last:border-r-0 transition-colors",
                selected ? "bg-primary-soft shadow-[inset_0_-4px_0_var(--primary)]" : "hover:bg-muted"
              )}
            >
              <span className="text-[13px] font-bold text-muted-foreground">Tahap {s.no}</span>
              <span className="font-mono text-[34px] font-extrabold leading-tight tracking-tight">{stageCount(s)}</span>
              <span className="text-[15px] font-bold">{s.label}</span>
              <span className="text-[13px] leading-snug text-muted-foreground">
                {s.no === 1 ? stage1Hint : s.explain.split(".")[0] + "."}
              </span>
            </Link>
          );
        })}
      </nav>

      <Card className="py-0 gap-0">
        <div className="flex flex-wrap items-end gap-4 border-b px-6 py-5">
          <div className="min-w-0 flex-[1_1_320px]">
            <h2 className="text-xl font-extrabold">
              {stage.label} · {stageCount(stage)} aduan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{stage.explain}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardFilters />
            {region && (
              <Link
                href={href({ region: undefined })}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border bg-surface px-3 text-sm font-semibold hover:bg-muted"
                aria-label={`Hapus filter wilayah ${regionRow?.name ?? ""}`}
              >
                Wilayah: {regionRow?.name ?? "tidak dikenal"}
                <X className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </div>

        <CardContent className="px-0">
          {error ? (
            <p role="alert" className="text-sm text-danger-text py-8 text-center">
              Gagal memuat data: {error.message}
            </p>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <LayoutDashboard size={40} strokeWidth={1.4} aria-hidden />
              <div>
                <p className="font-bold text-foreground">Tidak ada aduan di tahap ini</p>
                <p className="text-sm mt-1">Coba tahap lain atau hapus filter.</p>
              </div>
            </div>
          ) : (
            <Table className="min-w-[960px] text-[15px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Aduan</TableHead>
                  <TableHead>Desa</TableHead>
                  <TableHead>Ditujukan ke</TableHead>
                  <TableHead>Seberapa mendesak</TableHead>
                  <TableHead className="pr-6 text-right">Langkah berikutnya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map(({ c, triage }) => {
                  const categoryLabel =
                    CATEGORIES.find((cat) => cat.slug === c.effective_category)?.label ?? "Belum dikategorikan";
                  const step = nextStep(c, triage?.handling_path);
                  return (
                    <TableRow key={c.id} className="align-top">
                      <TableCell className="max-w-[440px] whitespace-normal py-4 pl-6">
                        <Link href={`/aduan/${c.id}`} className="font-mono text-[13px] font-medium text-link hover:underline">
                          {ticketId(c.id)}
                        </Link>
                        <p className="mt-1 leading-relaxed line-clamp-2">{c.text}</p>
                        <p className="mt-1 text-[13px] text-muted-foreground">
                          Masuk {new Date(c.reported_at).toLocaleString("id-ID", timeFmt)}
                        </p>
                      </TableCell>
                      <TableCell className="py-4">{c.region?.name ?? "—"}</TableCell>
                      <TableCell className="py-4">
                        <p className="font-bold">{c.opd?.short_name ?? "Belum ada"}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{categoryLabel}</p>
                      </TableCell>
                      <TableCell className="py-4">
                        {triage ? (
                          <UrgencyBar value={triage.urgency} />
                        ) : (
                          <span className="text-[13px] font-bold text-muted-foreground">Belum dinilai</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 pr-6 text-right">
                        <Link
                          href={`/aduan/${c.id}`}
                          className={cn(
                            "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-bold whitespace-nowrap",
                            actionable
                              ? "bg-primary text-primary-foreground hover:bg-primary/85"
                              : "border border-input text-ink hover:bg-muted"
                          )}
                        >
                          {step.action}
                        </Link>
                        <p className="mt-1.5 text-[13px] text-muted-foreground">{step.why}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
