/**
 * src/lib/services/complaint-status.ts
 *
 * Penjaga state machine status aduan (ARCHITECTURE.md §3). Setiap route
 * handler yang mengubah complaints.status lewat transitionComplaintStatus()
 * agar transisi ilegal — terutama ke `closed` selain dari `ai_verified` —
 * selalu ditolak di server.
 */

import type { createClient } from "@/lib/supabase/client";
import type { ComplaintStatus } from "@/lib/constants/status";

type AdminClient = ReturnType<typeof createClient>;

export const ALLOWED_TRANSITIONS: Record<ComplaintStatus, readonly ComplaintStatus[]> = {
  pending: ["triaged", "triage_failed"],
  triage_failed: ["triaged", "triage_failed"],
  triaged: ["in_progress"],
  in_progress: ["ai_verified", "needs_review"],
  needs_review: ["ai_verified", "in_progress"],
  ai_verified: ["closed", "in_progress"],
  closed: [],
};

export function canTransition(from: string, to: ComplaintStatus): boolean {
  return (ALLOWED_TRANSITIONS[from as ComplaintStatus] ?? []).includes(to);
}

export type TransitionResult =
  | { ok: true }
  | { ok: false; httpStatus: 404 | 409 | 422 | 500; error: string };

/**
 * Mengubah status aduan dari `from` ke `to` jika diizinkan state machine.
 * Update bersyarat (`status = from`) mencegah race: jika status sudah
 * berubah sejak dibaca, hasilnya 409 dan tidak ada yang ditulis.
 */
export async function transitionComplaintStatus(
  supabase: AdminClient,
  complaintId: string,
  from: string,
  to: ComplaintStatus,
  extra: Record<string, unknown> = {}
): Promise<TransitionResult> {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      httpStatus: 422,
      error: `Transisi status aduan dari "${from}" ke "${to}" tidak diizinkan.`,
    };
  }

  const { data, error } = await supabase
    .from("complaints")
    .update({ status: to, updated_at: new Date().toISOString(), ...extra })
    .eq("id", complaintId)
    .eq("status", from)
    .select("id");

  if (error) {
    console.error(`[status] Gagal mengubah status aduan ${complaintId} ke ${to}:`, error.message);
    return { ok: false, httpStatus: 500, error: "Gagal menyimpan status aduan." };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      httpStatus: 409,
      error: "Status aduan sudah berubah. Muat ulang halaman lalu coba lagi.",
    };
  }
  return { ok: true };
}
