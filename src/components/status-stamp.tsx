/**
 * src/components/status-stamp.tsx
 *
 * Status aduan dan sub-tugas sebagai tag: kata sifat sentence case di atas
 * latar tint lembut, tidak bisa diklik (pola GOV.UK Tag). Warna per status
 * konsisten di seluruh aplikasi (CSS .stamp di globals.css).
 */

import { STATUS_LABELS, type ComplaintStatus } from "@/lib/constants/status";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/constants/tasks";
import { cn } from "@/lib/utils";

export type StampTone = "accent" | "danger" | "warning" | "success" | "primary" | "ink" | "muted";

/** Oranye (accent) hanya untuk aduan baru yang butuh perhatian. */
export const STATUS_TONE: Record<ComplaintStatus, StampTone> = {
  pending: "accent",
  triage_failed: "danger",
  triaged: "primary",
  in_progress: "ink",
  needs_review: "warning",
  ai_verified: "success",
  closed: "muted",
};

export const TASK_STATUS_TONE: Record<TaskStatus, StampTone> = {
  belum_mulai: "muted",
  proses: "primary",
  selesai: "success",
};

interface StampProps {
  tone: StampTone;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-[13px]",
  lg: "px-3 py-1.5 text-sm",
} as const;

export function Stamp({ tone, children, size = "md", className }: StampProps) {
  return (
    <span
      data-tone={tone}
      className={cn("stamp", SIZE_CLASS[size], className)}
    >
      {children}
    </span>
  );
}

export function StatusStamp({
  status,
  ...rest
}: { status: string } & Omit<StampProps, "tone" | "children">) {
  const known = status in STATUS_LABELS;
  return (
    <Stamp tone={known ? STATUS_TONE[status as ComplaintStatus] : "muted"} {...rest}>
      {known ? STATUS_LABELS[status as ComplaintStatus] : status}
    </Stamp>
  );
}

export function TaskStatusStamp({
  status,
  ...rest
}: { status: string } & Omit<StampProps, "tone" | "children">) {
  const known = status in TASK_STATUS_LABELS;
  return (
    <Stamp tone={known ? TASK_STATUS_TONE[status as TaskStatus] : "muted"} {...rest}>
      {known ? TASK_STATUS_LABELS[status as TaskStatus] : status}
    </Stamp>
  );
}
