/**
 * src/app/aduan/[id]/page.tsx
 *
 * Detail aduan — satu halaman kanonik untuk operator dan petugas_opd
 * (ARCHITECTURE.md §7 hanya mendaftar satu path `/aduan/[id]`, bukan dua
 * salinan per route group — dua page.tsx yang resolve ke path URL yang sama
 * dari route group berbeda akan gagal di-build oleh Next.js App Router).
 *
 * Menampilkan: penanda perjalanan aduan, laporan warga, kartu "Keputusan AI"
 * beserta alasannya, rencana koordinasi OPD (M4 — tombol "Buat Rencana Koordinasi" untuk operator,
 * tombol status tugas untuk petugas_opd), verifikasi penyelesaian (M5 —
 * foto sebelum/sesudah, hasil AI, tinjauan operator, unggah bukti petugas),
 * riwayat override, dan form override (khusus operator).
 */
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TriageOverrideForm } from "@/components/triage-override-form";
import { CoordinationPlan } from "@/components/coordination-plan";
import { GeneratePlanButton } from "@/components/generate-plan-button";
import { VerificationCard } from "@/components/verification-card";
import { createClient } from "@/lib/supabase/client";
import { getSessionProfile } from "@/lib/supabase/server";
import { getCoordinationPlan, type CoordinationPlanView } from "@/lib/services/coordination";
import { getVerificationHistory, type VerificationHistory } from "@/lib/services/verification";
import { CATEGORIES } from "@/lib/constants/categories";
import { StatusStamp } from "@/components/status-stamp";
import { UrgencyBar } from "@/components/urgency-bar";
import { ticketId } from "@/components/page-header";

export const metadata: Metadata = { title: "Detail Aduan" };

const HANDLING_PATH_LABELS: Record<string, string> = {
  quick_fix: "Bisa langsung dikerjakan",
  bertahap: "Bertahap",
  butuh_data: "Butuh data lanjutan",
};

/** Perjalanan aduan (pola step indicator): indeks langkah yang sedang berjalan per status. */
const JOURNEY = ["Diterima", "Dicek AI", "Dikoordinasi", "Dikerjakan dinas", "Dikonfirmasi warga"];
const JOURNEY_STEP: Record<string, number> = {
  pending: 1,
  triage_failed: 1,
  triaged: 2,
  in_progress: 3,
  needs_review: 3,
  ai_verified: 4,
  closed: 5,
};

export default async function AduanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();
  const profile = await getSessionProfile();
  const role = profile?.role ?? null;

  const { data: complaint } = await supabase
    .from("complaints")
    .select(
      "id, text, status, reported_at, photo_before_url, photo_after_url, label_manual, region:region_id(name), opd:effective_opd_id(short_name, name), effective_category"
    )
    .eq("id", id)
    .maybeSingle();

  if (!complaint) notFound();

  const { data: triageResults } = await supabase
    .from("triage_results")
    .select("category, urgency, impact, handling_path, reason, created_at")
    .eq("complaint_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const triage = triageResults?.[0] ?? null;

  const { data: overrides } = await supabase
    .from("triage_overrides")
    .select("field_overridden, old_value, new_value, note, created_at")
    .eq("complaint_id", id)
    .order("created_at", { ascending: false });

  let plan: CoordinationPlanView | null = null;
  let planError: string | null = null;
  try {
    plan = await getCoordinationPlan(supabase, id);
  } catch (err) {
    planError = err instanceof Error ? err.message : "Gagal memuat rencana koordinasi.";
  }
  const planStarted = plan?.tasks.some((t) => t.status !== "belum_mulai") ?? false;
  const planComplete = !!plan && plan.tasks.length > 0 && plan.tasks.every((t) => t.status === "selesai");
  const viewerHasTask =
    role === "petugas_opd" && !!profile?.opd_id && !!plan?.tasks.some((t) => t.opd?.id === profile.opd_id);

  let verificationHistory: VerificationHistory | null = null;
  let verificationError: string | null = null;
  try {
    verificationHistory = (await getVerificationHistory(supabase, [id])).get(id) ?? null;
  } catch (err) {
    verificationError = err instanceof Error ? err.message : "Gagal memuat verifikasi.";
  }
  const showVerification =
    ["in_progress", "needs_review", "ai_verified", "closed"].includes(complaint.status) ||
    !!complaint.photo_after_url ||
    (verificationHistory?.verifications.length ?? 0) > 0;

  const region = complaint.region as unknown as { name: string } | null;
  const opd = complaint.opd as unknown as { short_name: string; name: string } | null;
  const categoryLabel =
    CATEGORIES.find((c) => c.slug === complaint.effective_category)?.label ??
    complaint.effective_category ??
    "Belum ditriase";

  const currentStep = JOURNEY_STEP[complaint.status] ?? 0;

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted-foreground">
              Aduan <span className="text-ink">{ticketId(id)}</span> · {region?.name ?? "Wilayah tidak diketahui"} ·{" "}
              <time dateTime={complaint.reported_at}>
                {new Date(complaint.reported_at).toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight">{categoryLabel}</h1>
          </div>
          <div className="flex flex-col items-end gap-2 pt-1">
            <StatusStamp status={complaint.status} size="lg" />
            {overrides && overrides.length > 0 && <Badge variant="outline">Dikoreksi operator</Badge>}
          </div>
        </div>

        <ol
          aria-label={`Perjalanan aduan, langkah ${Math.min(currentStep + 1, JOURNEY.length)} dari ${JOURNEY.length}`}
          className="grid grid-cols-2 gap-2 sm:grid-cols-5"
        >
          {JOURNEY.map((label, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex flex-col gap-1 border-t-[5px] pt-2.5 ${done ? "border-strong" : current ? "border-primary" : "border-line"}`}
              >
                <span className={`text-[13px] font-bold ${done ? "text-ink-2" : current ? "text-link" : "text-muted-foreground"}`}>
                  {done ? "Selesai" : current ? "Sekarang" : "Berikutnya"}
                </span>
                <span className="text-[15px] font-bold">{label}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px] space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-extrabold">Laporan dari warga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[17px] leading-relaxed whitespace-pre-line">&ldquo;{complaint.text}&rdquo;</p>
              {complaint.photo_before_url && (
                <div className="relative w-full max-w-lg aspect-video rounded-lg overflow-hidden">
                  <Image
                    src={complaint.photo_before_url}
                    alt="Foto dari warga"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-extrabold">Rencana penanganan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {planError ? (
                <p role="alert" className="text-sm text-danger-text">Gagal memuat rencana koordinasi: {planError}</p>
              ) : (
                <CoordinationPlan
                  plan={plan}
                  viewerOpdId={role === "petugas_opd" ? (profile?.opd_id ?? null) : null}
                />
              )}

              {role === "operator" && (
                <>
                  <Separator />
                  {complaint.status === "triaged" && !planStarted ? (
                    <GeneratePlanButton
                      complaintId={id}
                      hasAiPlan={plan?.plan_type === "ai_generated"}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {planStarted
                        ? "Rencana tidak bisa diganti karena petugas OPD sudah mulai mengerjakan tugas."
                        : "Rencana koordinasi AI hanya bisa dibuat untuk aduan berstatus \"Sudah ditriase\"."}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {showVerification && (
            <VerificationCard
              complaint={{
                id,
                status: complaint.status,
                photo_before_url: complaint.photo_before_url,
                photo_after_url: complaint.photo_after_url,
              }}
              history={verificationHistory}
              historyError={verificationError}
              role={role}
              viewerHasTask={viewerHasTask}
              planComplete={planComplete}
            />
          )}

          {overrides && overrides.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">Riwayat koreksi</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overrides.map((o, i) => (
                  <div key={i} className="text-[15px]">
                    <p>
                      <span className="font-bold">{o.field_overridden}</span>: {o.old_value || "—"} →{" "}
                      {o.new_value}
                    </p>
                    {o.note && <p className="text-muted-foreground text-sm mt-0.5">{o.note}</p>}
                    <p className="text-muted-foreground font-mono text-xs">
                      {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    {i < overrides.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="min-w-0 flex-[1_1_360px] space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-extrabold">Keputusan AI</CardTitle>
            </CardHeader>
            <CardContent>
              {!triage ? (
                <p className="text-sm text-muted-foreground">
                  {complaint.status === "triage_failed"
                    ? "AI gagal memproses aduan ini (Langflow timeout atau error). Tentukan kategori dan dinas lewat koreksi di bawah."
                    : "AI belum selesai memproses aduan ini."}
                </p>
              ) : (
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2.5 text-[15px]">
                  <dt className="text-muted-foreground">Kategori</dt>
                  <dd className="font-bold">{CATEGORIES.find((c) => c.slug === triage.category)?.label ?? triage.category}</dd>
                  <dt className="text-muted-foreground">Dinas</dt>
                  <dd className="font-bold">{opd ? `${opd.short_name} · ${opd.name}` : "—"}</dd>
                  <dt className="text-muted-foreground">Mendesak</dt>
                  <dd><UrgencyBar value={triage.urgency} size="md" /></dd>
                  <dt className="text-muted-foreground">Dampak</dt>
                  <dd className="font-bold capitalize">{triage.impact}</dd>
                  <dt className="text-muted-foreground">Penanganan</dt>
                  <dd className="font-bold">{HANDLING_PATH_LABELS[triage.handling_path] ?? triage.handling_path}</dd>
                  <dt className="col-span-2 mt-2 text-[13px] font-bold text-ink-2">Kenapa AI memutuskan ini</dt>
                  <dd className="col-span-2 rounded-lg bg-muted px-4 py-3 leading-relaxed text-foreground">{triage.reason}</dd>
                </dl>
              )}
            </CardContent>
          </Card>

          {role === "operator" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-extrabold">Koreksi keputusan AI</CardTitle>
                <p className="text-sm text-muted-foreground">Setiap koreksi tercatat di riwayat aduan.</p>
              </CardHeader>
              <CardContent>
                <TriageOverrideForm complaintId={id} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
