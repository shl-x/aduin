/**
 * src/lib/constants/tasks.ts
 *
 * Label tampilan dan varian Badge untuk status sub-tugas koordinasi
 * (tasks.status — ARCHITECTURE.md §4.9).
 */

export const TASK_STATUSES = ["belum_mulai", "proses", "selesai"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  belum_mulai: "Belum Mulai",
  proses: "Proses",
  selesai: "Selesai",
};

export const TASK_STATUS_BADGE_VARIANT: Record<
  TaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  belum_mulai: "outline",
  proses: "default",
  selesai: "secondary",
};
