/**
 * src/components/status-stamp.tsx
 *
 * Status aduan dan sub-tugas sebagai "stempel": teks kapital IBM Plex Mono,
 * bingkai 1.5px, sudut 4px. Warna per status konsisten di seluruh aplikasi
 * (CSS .stamp di globals.css). `tilted` memiringkan -1deg — hanya dipakai di
 * halaman detail aduan.
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
  tilted?: boolean;
  className?: string;
}

const SIZE_CLASS = {
  sm: "px-1.5 py-1 text-[10px]",
  md: "px-2 py-1.5 text-[11px]",
  lg: "px-3 py-2 text-xs",
} as const;

export function Stamp({ tone, children, size = "md", tilted = false, className }: StampProps) {
  return (
    <span
      data-tone={tone}
      className={cn("stamp", SIZE_CLASS[size], tilted && "-rotate-1", className)}
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
