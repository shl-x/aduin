/**
 * src/app/(opd)/tugas/page.tsx
 *
 * Portal tugas petugas OPD (M4). Menampilkan sub-tugas milik OPD pengguna
 * yang sedang login, dikelompokkan per status (belum mulai / proses /
 * selesai), dengan filter ?status=. Tugas yang ketergantungannya belum
 * selesai ditandai "Menunggu" dan tombol mulainya dinonaktifkan.
 *
 * M5: seksi "Bukti Penyelesaian" — aduan yang melibatkan OPD ini dan sudah
 * di tahap penyelesaian. Tombol "Unggah Bukti Penyelesaian" hanya aktif jika
 * SEMUA tugas aduan (lintas OPD) sudah selesai.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardList, Clock, ExternalLink, MessageSquareWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusStamp, TaskStatusStamp } from "@/components/status-stamp";
import { PageHeader, ticketId } from "@/components/page-header";
import { TaskStatusControl } from "@/components/task-status-control";
import { CompletionUpload } from "@/components/completion-upload";
import { createClient } from "@/lib/supabase/client";
import { getSessionProfile } from "@/lib/supabase/server";
import { getTasksForOpd, type OpdTaskView } from "@/lib/services/coordination";
import {
  getCompletionCandidatesForOpd,
  isPlanComplete,
  type CompletionCandidate,
} from "@/lib/services/verification";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/constants/tasks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tugas Saya" };

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4 text-muted-foreground">
      <ClipboardList size={40} strokeWidth={1.4} aria-hidden />
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm mt-1">{description}</p>
      </div>
    </div>
  );
}

function TaskItem({ task }: { task: OpdTaskView }) {
  return (
    <li className="rounded-md border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            <span className="font-mono text-muted-foreground">#{task.sequence}</span> {task.title}
          </p>
          {task.complaint && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{ticketId(task.complaint.id)}</span> ·{" "}
              {task.complaint.region_name ?? "Wilayah tidak diketahui"} ·{" "}
              <span className="font-mono">
              {new Date(task.updated_at).toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.waiting && (
            <Badge variant="outline">
              <Clock aria-hidden />
              Menunggu
            </Badge>
          )}
          <TaskStatusStamp status={task.status} size="sm" />
        </div>
      </div>

      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

      {task.complaint && (
        <p className="text-xs rounded-md bg-muted px-2.5 py-2 text-muted-foreground line-clamp-2">
          Aduan: {task.complaint.text}
        </p>
      )}

      {task.depends_on.length > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
          <ArrowRight className="size-3" aria-hidden />
          Bergantung pada:{" "}
          {task.depends_on.map((d, i) => (
            <span key={d.id}>
              <span className="font-mono">#{d.sequence}</span> {d.title} ({[d.opd_short_name, TASK_STATUS_LABELS[d.status]].filter(Boolean).join(" — ")})
              {i < task.depends_on.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <TaskStatusControl taskId={task.id} status={task.status} waiting={task.waiting} />
        {task.complaint && (
          <Link
            href={`/aduan/${task.complaint.id}`}
            className="text-sm font-medium text-primary inline-flex min-h-9 items-center gap-1 hover:underline"
          >
            Lihat detail aduan
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  );
}

function CompletionItem({ item }: { item: CompletionCandidate }) {
  const complete = isPlanComplete(item.progress);
  return (
    <li className="rounded-md border bg-surface p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm line-clamp-2">{item.text}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {item.region_name ?? "Wilayah tidak diketahui"} · <span className="font-mono">{item.progress.done}/{item.progress.total}</span> tugas
            selesai
          </p>
        </div>
        <StatusStamp status={item.status} size="sm" className="shrink-0" />
      </div>

      {item.status === "in_progress" && item.return_note && (
        <p className="text-xs rounded-md bg-warning/5 border border-warning p-2 flex gap-1.5">
          <MessageSquareWarning className="size-3.5 shrink-0 text-warning-text mt-0.5" aria-hidden />
          <span>
            Dikembalikan oleh {item.return_note.source === "operator" ? "operator" : "warga"}:{" "}
            {item.return_note.note}
          </span>
        </p>
      )}

      {item.status !== "in_progress" && item.latest_verification && (
        <p className="text-xs text-muted-foreground">Hasil AI: {item.latest_verification.ai_reason}</p>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap">
        {item.status === "in_progress" ? (
          <CompletionUpload
            complaintId={item.id}
            enabled={complete}
            disabledReason="Aktif setelah semua tugas pada aduan ini (termasuk milik OPD lain) selesai."
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            {item.status === "needs_review"
              ? "Menunggu tinjauan operator."
              : "Menunggu konfirmasi warga."}
          </p>
        )}
        <Link
          href={`/aduan/${item.id}`}
          className="text-sm font-medium text-primary inline-flex min-h-9 items-center gap-1 hover:underline"
        >
          Lihat detail aduan
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
    </li>
  );
}

export default async function TugasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeFilter = TASK_STATUSES.includes(status as TaskStatus) ? (status as TaskStatus) : null;
  const profile = await getSessionProfile();

  const header = (
    <PageHeader
      eyebrow="Petugas OPD"
      title="Tugas saya"
      description="Tugas dari rencana koordinasi yang ditujukan ke dinas Anda. Kerjakan yang bisa dimulai, lalu kirim foto bukti setelah semua tugas selesai."
    />
  );

  if (!profile || profile.role !== "petugas_opd" || !profile.opd_id) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <CardContent>
            <EmptyState
              title="Halaman khusus petugas OPD"
              description={
                profile?.role === "petugas_opd"
                  ? "Akun Anda belum terhubung ke OPD mana pun. Hubungi administrator."
                  : "Masuk sebagai petugas OPD untuk melihat daftar tugas."
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = createClient();
  let tasks: OpdTaskView[] = [];
  let loadError: string | null = null;
  let candidates: CompletionCandidate[] = [];
  let candidatesError: string | null = null;
  const [tasksResult, candidatesResult] = await Promise.allSettled([
    getTasksForOpd(supabase, profile.opd_id),
    getCompletionCandidatesForOpd(supabase, profile.opd_id),
  ]);
  if (tasksResult.status === "fulfilled") tasks = tasksResult.value;
  else loadError = tasksResult.reason instanceof Error ? tasksResult.reason.message : "Gagal memuat tugas.";
  if (candidatesResult.status === "fulfilled") candidates = candidatesResult.value;
  else
    candidatesError =
      candidatesResult.reason instanceof Error
        ? candidatesResult.reason.message
        : "Gagal memuat aduan tahap penyelesaian.";

  const groups = TASK_STATUSES.filter((s) => !activeFilter || s === activeFilter).map((s) => ({
    status: s,
    tasks: tasks
      .filter((t) => t.status === s)
      // Tugas yang bisa langsung dikerjakan tampil di atas yang masih menunggu.
      .sort((a, b) => Number(a.waiting) - Number(b.waiting)),
  }));

  const filters: { label: string; value: TaskStatus | null }[] = [
    { label: "Semua", value: null },
    ...TASK_STATUSES.map((s) => ({ label: TASK_STATUS_LABELS[s], value: s })),
  ];

  return (
    <div className="space-y-6">
      {header}

      {(candidatesError || candidates.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bukti Penyelesaian <span className="font-mono text-muted-foreground">{candidates.length}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {candidatesError ? (
              <p role="alert" className="text-sm text-danger-text py-4 text-center">
                Gagal memuat aduan tahap penyelesaian: {candidatesError}
              </p>
            ) : (
              <ul className="space-y-3">
                {candidates.map((item) => (
                  <CompletionItem key={item.id} item={item} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => {
          const count = f.value ? tasks.filter((t) => t.status === f.value).length : tasks.length;
          return (
            <Link
              key={f.label}
              href={f.value ? `/tugas?status=${f.value}` : "/tugas"}
              aria-current={activeFilter === f.value ? "true" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors duration-150",
                activeFilter === f.value ? "bg-primary text-primary-foreground border-primary" : "bg-surface hover:bg-muted"
              )}
            >
              {f.label} <span className="font-mono">{count}</span>
            </Link>
          );
        })}
      </div>

      {loadError ? (
        <Card>
          <CardContent>
            <p role="alert" className="text-sm text-danger-text py-8 text-center">Gagal memuat tugas: {loadError}</p>
          </CardContent>
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="Belum ada tugas"
              description="Tugas akan muncul di sini setelah aduan ditriase dan diarahkan ke OPD Anda."
            />
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => (
          <Card key={group.status}>
            <CardHeader>
              <CardTitle className="text-base">
                {TASK_STATUS_LABELS[group.status]} <span className="font-mono text-muted-foreground">{group.tasks.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {group.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Tidak ada tugas berstatus {TASK_STATUS_LABELS[group.status].toLowerCase()}.
                </p>
              ) : (
                <ul className="space-y-3">
                  {group.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
