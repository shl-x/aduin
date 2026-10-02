/**
 * src/components/coordination-plan.tsx
 *
 * Daftar sub-tugas rencana koordinasi (terurut by sequence) — OPD,
 * deskripsi, status, dan ketergantungan. Dipakai di /aduan/[id].
 * Petugas OPD mendapat tombol status untuk tugas milik OPD-nya.
 */

import { ArrowRight, Clock, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TaskStatusControl } from "@/components/task-status-control";
import { TASK_STATUS_BADGE_VARIANT, TASK_STATUS_LABELS } from "@/lib/constants/tasks";
import type { CoordinationPlanView } from "@/lib/services/coordination";

export function CoordinationPlan({
  plan,
  viewerOpdId,
}: {
  plan: CoordinationPlanView | null;
  /** opd_id petugas yang melihat — null untuk role selain petugas_opd. */
  viewerOpdId: string | null;
}) {
  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-3 text-muted-foreground">
        <ListChecks size={40} strokeWidth={1.2} />
        <div>
          <p className="font-medium text-foreground">Belum ada rencana koordinasi</p>
          <p className="text-sm mt-1">Rencana dibuat otomatis setelah aduan berhasil ditriase.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={plan.plan_type === "ai_generated" ? "default" : "outline"}>
          {plan.plan_type === "ai_generated" ? "Rencana AI" : "Rencana Sederhana"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {plan.tasks.length} sub-tugas · dibuat{" "}
          {new Date(plan.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </div>
      {plan.summary && <p className="text-sm">{plan.summary}</p>}

      <ol className="space-y-3">
        {plan.tasks.map((task) => (
          <li key={task.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {task.sequence}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.opd ? `${task.opd.short_name} — ${task.opd.name}` : "OPD tidak diketahui"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {task.waiting && (
                  <Badge variant="outline">
                    <Clock />
                    Menunggu
                  </Badge>
                )}
                <Badge variant={TASK_STATUS_BADGE_VARIANT[task.status]}>
                  {TASK_STATUS_LABELS[task.status]}
                </Badge>
              </div>
            </div>

            {task.description && <p className="text-sm text-muted-foreground pl-9">{task.description}</p>}

            {task.depends_on.length > 0 && (
              <p className="text-xs text-muted-foreground pl-9 flex items-center gap-1 flex-wrap">
                <ArrowRight className="size-3" />
                Bergantung pada:{" "}
                {task.depends_on.map((d, i) => (
                  <span key={d.id}>
                    #{d.sequence} {d.title} ({TASK_STATUS_LABELS[d.status]})
                    {i < task.depends_on.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}

            {viewerOpdId && task.opd?.id === viewerOpdId && (
              <div className="pl-9">
                <TaskStatusControl taskId={task.id} status={task.status} waiting={task.waiting} />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
