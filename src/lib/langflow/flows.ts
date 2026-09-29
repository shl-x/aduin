/**
 * src/lib/langflow/flows.ts
 *
 * Peta nama flow ke environment variable Flow ID.
 * Flow ID adalah UUID yang muncul di URL Langflow setelah flow dibuat.
 *
 * Tambahkan entri baru di sini setiap kali flow baru dibuat di Langflow UI.
 */

export const FLOW_NAMES = {
  clarify: "clarify",
  triage: "triage",
  embed: "embed",
  opdAgent: "opdAgent",
  verify: "verify",
  alertSummary: "alertSummary",
} as const;

export type FlowName = keyof typeof FLOW_NAMES;

/**
 * Mengembalikan Flow ID dari environment variable.
 * Melempar error jika variabel belum diisi — artinya flow belum dibuat di Langflow.
 */
export function getFlowId(name: FlowName): string {
  const envMap: Record<FlowName, string> = {
    clarify: process.env.LANGFLOW_FLOW_CLARIFY_ID ?? "",
    triage: process.env.LANGFLOW_FLOW_TRIAGE_ID ?? "",
    embed: process.env.LANGFLOW_FLOW_EMBED_ID ?? "",
    opdAgent: process.env.LANGFLOW_FLOW_OPD_AGENT_ID ?? "",
    verify: process.env.LANGFLOW_FLOW_VERIFY_ID ?? "",
    alertSummary: process.env.LANGFLOW_FLOW_ALERT_SUMMARY_ID ?? "",
  };

  const id = envMap[name];
  if (!id) {
    throw new Error(
      `Flow ID untuk "${name}" belum dikonfigurasi. ` +
        `Pastikan variabel LANGFLOW_FLOW_${name.toUpperCase()}_ID ada di .env.local.`
    );
  }
  return id;
}
