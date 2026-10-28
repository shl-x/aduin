/**
 * src/lib/constants/status.ts
 *
 * Label tampilan dan varian Badge untuk status aduan (ARCHITECTURE.md §3).
 */

export const COMPLAINT_STATUSES = [
  "pending",
  "triage_failed",
  "triaged",
  "in_progress",
  "needs_review",
  "ai_verified",
  "closed",
] as const;

export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const STATUS_LABELS: Record<ComplaintStatus, string> = {
  pending: "Menunggu triase",
  triage_failed: "Gagal ditriase",
  triaged: "Sudah ditriase",
  in_progress: "Dikerjakan dinas",
  needs_review: "Perlu ditinjau",
  ai_verified: "Menunggu konfirmasi warga",
  closed: "Selesai",
};

export const STATUS_BADGE_VARIANT: Record<
  ComplaintStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  triage_failed: "destructive",
  triaged: "secondary",
  in_progress: "default",
  needs_review: "destructive",
  ai_verified: "secondary",
  closed: "outline",
};
