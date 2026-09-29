/**
 * src/app/aduan/[id]/page.tsx
 *
 * Detail aduan — satu halaman kanonik untuk operator dan petugas_opd
 * (ARCHITECTURE.md §7 hanya mendaftar satu path `/aduan/[id]`, bukan dua
 * salinan per route group — dua page.tsx yang resolve ke path URL yang sama
 * dari route group berbeda akan gagal di-build oleh Next.js App Router).
 *
 * Menampilkan: info aduan, kartu "Kenapa AI memutuskan ini", riwayat
 * override, dan form override (khusus operator).
 */
import Image from "next/image";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TriageOverrideForm } from "@/components/triage-override-form";
import { createClient } from "@/lib/supabase/client";
import { getSessionRole } from "@/lib/supabase/server";
import { CATEGORIES } from "@/lib/constants/categories";
import { STATUS_LABELS, STATUS_BADGE_VARIANT, type ComplaintStatus } from "@/lib/constants/status";

const HANDLING_PATH_LABELS: Record<string, string> = {
  quick_fix: "Quick Fix",
  bertahap: "Bertahap",
  butuh_data: "Butuh Data Lanjutan",
};

export default async function AduanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient();
  const role = await getSessionRole();

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

  const region = complaint.region as unknown as { name: string } | null;
  const opd = complaint.opd as unknown as { short_name: string; name: string } | null;
  const categoryLabel =
    CATEGORIES.find((c) => c.slug === complaint.effective_category)?.label ??
    complaint.effective_category ??
    "Belum ditriase";
  const statusKey = complaint.status as ComplaintStatus;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_BADGE_VARIANT[statusKey] ?? "outline"}>
              {STATUS_LABELS[statusKey] ?? complaint.status}
            </Badge>
            {overrides && overrides.length > 0 && <Badge variant="secondary">Override</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-2">{categoryLabel}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {region?.name ?? "Wilayah tidak diketahui"} ·{" "}
            {new Date(complaint.reported_at).toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Isi Aduan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm whitespace-pre-line">{complaint.text}</p>
          {complaint.photo_before_url && (
            <div className="relative w-full max-w-sm aspect-video rounded-lg overflow-hidden ring-1 ring-foreground/10">
              <Image
                src={complaint.photo_before_url}
                alt="Foto aduan"
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
          <CardTitle className="text-base">Kenapa AI memutuskan ini</CardTitle>
        </CardHeader>
        <CardContent>
          {!triage ? (
            <p className="text-sm text-muted-foreground">
              {complaint.status === "triage_failed"
                ? "Triase AI gagal untuk aduan ini (Langflow timeout/error). Coba jalankan ulang triage."
                : "Belum ada hasil triase."}
            </p>
          ) : (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Kategori</dt>
              <dd>{CATEGORIES.find((c) => c.slug === triage.category)?.label ?? triage.category}</dd>
              <dt className="text-muted-foreground">OPD</dt>
              <dd>{opd ? `${opd.short_name} — ${opd.name}` : "—"}</dd>
              <dt className="text-muted-foreground">Urgensi</dt>
              <dd>{triage.urgency}/5</dd>
              <dt className="text-muted-foreground">Dampak</dt>
              <dd className="capitalize">{triage.impact}</dd>
              <dt className="text-muted-foreground">Jalur Penanganan</dt>
              <dd>{HANDLING_PATH_LABELS[triage.handling_path] ?? triage.handling_path}</dd>
              <dt className="text-muted-foreground col-span-2 mt-1">Alasan</dt>
              <dd className="col-span-2 text-foreground">{triage.reason}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      {overrides && overrides.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riwayat Override</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overrides.map((o, i) => (
              <div key={i} className="text-sm">
                <p>
                  <span className="font-medium">{o.field_overridden}</span>: {o.old_value || "—"} →{" "}
                  {o.new_value}
                </p>
                {o.note && <p className="text-muted-foreground text-xs mt-0.5">{o.note}</p>}
                <p className="text-muted-foreground text-xs">
                  {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                {i < overrides.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {role === "operator" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Override Triase</CardTitle>
          </CardHeader>
          <CardContent>
            <TriageOverrideForm complaintId={id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
