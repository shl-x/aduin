/**
 * src/app/(operator)/dashboard/page.tsx
 * Daftar aduan + filter status/kategori. Server Component — data di-query
 * langsung berdasarkan query string (?status=&category=).
 */
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardFilters } from "@/components/dashboard-filters";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/constants/categories";
import { STATUS_LABELS, STATUS_BADGE_VARIANT, type ComplaintStatus } from "@/lib/constants/status";

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
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const { status, category } = await searchParams;
  const supabase = createClient();

  let query = supabase
    .from("complaints")
    .select(
      "id, text, status, effective_category, reported_at, region:region_id(name), opd:effective_opd_id(short_name), triage_results(urgency, created_at)"
    )
    .order("reported_at", { ascending: false })
    .limit(200);

  if (status) query = query.eq("status", status);
  if (category) query = query.eq("effective_category", category);

  const { data, error } = await query;
  const complaints = (data ?? []) as unknown as ComplaintRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daftar Aduan</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Kelola dan pantau seluruh aduan yang masuk.
        </p>
      </div>

      <DashboardFilters />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Aduan {complaints.length > 0 ? `(${complaints.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive py-8 text-center">
              Gagal memuat data: {error.message}
            </p>
          ) : complaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
              <LayoutDashboard size={48} strokeWidth={1.2} />
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
                  const statusKey = c.status as ComplaintStatus;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`} className="contents">
                          <Badge variant={STATUS_BADGE_VARIANT[statusKey] ?? "outline"}>
                            {STATUS_LABELS[statusKey] ?? c.status}
                          </Badge>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`}>{categoryLabel}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`}>{c.opd?.short_name ?? "—"}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`}>{urgency ?? "—"}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`}>{c.region?.name ?? "—"}</Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/aduan/${c.id}`}>
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
