/**
 * src/app/(operator)/dashboard/page.tsx
 * Daftar aduan + filter status/kategori. Server Component — data di-query
 * langsung berdasarkan query string (?status=&category=&region=).
 * ?region= (UUID desa) dipakai tautan "Lihat aduan terkait" dari /alert.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CATEGORIES } from "@/lib/constants/categories";
import { PageHeader, ticketId } from "@/components/page-header";
import { StatusStamp } from "@/components/status-stamp";
import { UrgencyBar } from "@/components/urgency-bar";

export const metadata: Metadata = { title: "Daftar Aduan" };

interface ComplaintRow {
  id: string;
  text: string;
  status: string;
  effective_category: string | null;
  reported_at: string;
  region: { name: string } | null;
  opd: { short_name: string } | null;
  triage_results: { urgency: number; created_at: string }[] | null;
}

function latestUrgency(rows: ComplaintRow["triage_results"]): number | null {
  if (!rows || rows.length === 0) return null;
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))[0].urgency;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; category?: string; region?: string }>;
}) {
  const { status, category, region } = await searchParams;
  const supabase = createClient();
  const role = await getSessionRole();

  let query = supabase
    .from("complaints")
    .select(
      "id, text, status, effective_category, reported_at, region:region_id(name), opd:effective_opd_id(short_name), triage_results(urgency, created_at)"
    )
    .order("reported_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("effective_category", category);
  if (region) query = query.eq("region_id", region);

  const { data: regionRow } = region
    ? await supabase.from("regions").select("name").eq("id", region).maybeSingle()
    : { data: null };
  const clearRegionParams = new URLSearchParams();
  if (status) clearRegionParams.set("status", status);
  if (category) clearRegionParams.set("category", category);

  const { data, error } = await query;
  const complaints = (data ?? []) as unknown as ComplaintRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operator · Command center"
        title="Daftar Aduan"
        description="Kelola dan pantau seluruh aduan yang masuk."
        actions={role === "operator" ? <ResetDemoButton /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <DashboardFilters />
        {region && (
          <Link
            href={`/dashboard?${clearRegionParams.toString()}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-surface px-3 text-xs font-medium hover:bg-muted"
            aria-label={`Hapus filter wilayah ${regionRow?.name ?? ""}`}
          >
            Wilayah: {regionRow?.name ?? "tidak dikenal"}
            <X className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-baseline gap-2 text-base">
            Aduan
            {complaints.length > 0 && (
              <span className="font-mono text-sm font-medium text-muted-foreground">{complaints.length}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="text-sm text-danger-text py-8 text-center">
              Gagal memuat data: {error.message}
            </p>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <LayoutDashboard size={40} strokeWidth={1.4} aria-hidden />
              <div>
                <p className="font-medium text-foreground">Belum ada aduan</p>
                <p className="text-sm mt-1">
                  Tidak ada aduan yang cocok dengan filter saat ini.
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>OPD</TableHead>
                  <TableHead>Urgensi</TableHead>
                  <TableHead>Wilayah</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {complaints.map((c) => {
                  const categoryLabel =
                    CATEGORIES.find((cat) => cat.slug === c.effective_category)?.label ?? "—";
                  const urgency = latestUrgency(c.triage_results);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/aduan/${c.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                          title={c.text}
                        >
                          {ticketId(c.id)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} className="inline-flex" tabIndex={-1}>
                          <StatusStamp status={c.status} size="sm" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} tabIndex={-1}>{categoryLabel}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} tabIndex={-1}>{c.opd?.short_name ?? "—"}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} tabIndex={-1}><UrgencyBar value={urgency} /></Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} tabIndex={-1}>{c.region?.name ?? "—"}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} className="font-mono text-xs text-muted-foreground" tabIndex={-1}>
                          {new Date(c.reported_at).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </Link>
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
