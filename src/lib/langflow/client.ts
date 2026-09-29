/**
 * src/lib/langflow/client.ts
 *
 * Satu-satunya titik panggil Langflow dari aplikasi.
 * JANGAN import file ini di Client Components — hanya boleh dari:
 *   - Route Handlers (src/app/api/*)
 *   - Server Components
 *   - Script server-side (seed, precompute)
 *
 * Alur runFlow(): cek ai_cache → panggil Langflow → parse tahan banting →
 * validasi Zod → simpan ke ai_cache → kembalikan hasil typed.
 * Urutan ini mengikuti docs/LANGFLOW_FLOWS.md §"Catatan Implementasi untuk client.ts".
 */

import { createHash } from "crypto";
import type { ZodType } from "zod";
import { getFlowId, LANGFLOW_FLOW_LABELS, type FlowName } from "./flows";
import { createClient as createSupabaseAdminClient } from "@/lib/supabase/client";
import {
  clarifyOutputSchema,
  triageOutputSchema,
  type ClarifyOutput,
  type TriageOutput,
} from "./schemas";

const BASE_URL = process.env.LANGFLOW_BASE_URL ?? "http://127.0.0.1:7860";
const API_KEY = process.env.LANGFLOW_API_KEY ?? "";
const DEFAULT_TIMEOUT_MS = 15_000;

export class LangflowParseError extends Error {
  constructor(public rawText: string) {
    super(`Gagal mem-parse output Langflow sebagai JSON: ${rawText.slice(0, 200)}`);
    this.name = "LangflowParseError";
  }
}

/**
 * Menjalankan flow Langflow dengan cache, parsing tahan banting, dan
 * validasi Zod. Melempar error jika gagal di tahap manapun — pemanggil
 * (mis. runClarify/runTriage) bertanggung jawab menangkapnya dan
 * menerapkan fallback yang sesuai.
 */
export async function runFlow<T>(
  flowName: FlowName,
  inputValue: unknown,
  schema: ZodType<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const serializedInput = JSON.stringify(inputValue);
  const inputHash = hashInput(serializedInput);
  const cacheKey = LANGFLOW_FLOW_LABELS[flowName];

  const cached = await getCachedResult(cacheKey, inputHash, schema);
  if (cached) return cached;

  const rawText = await callLangflow(flowName, serializedInput, timeoutMs);
  if (rawText === null) {
    throw new Error(`Flow "${flowName}" gagal dipanggil (timeout/HTTP error).`);
  }

  const parsed = parseJsonOutput(rawText);
  if (parsed === null) {
    throw new LangflowParseError(rawText);
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(
      `Flow "${flowName}" — output tidak lolos validasi Zod: ${validated.error.message}`
    );
  }

  await cacheResult(cacheKey, inputHash, validated.data);
  return validated.data;
}

/**
 * Flow 1 — aduin-clarify. Mengecek kelengkapan aduan sebelum disimpan.
 * @returns hasil typed, atau `null` jika Langflow gagal / output invalid.
 */
export async function runClarify(input: {
  complaint_text: string;
  region_name: string | null;
}): Promise<ClarifyOutput | null> {
  try {
    return await runFlow("clarify", input, clarifyOutputSchema);
  } catch (err) {
    console.error("[Langflow] aduin-clarify gagal:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Flow 2 — aduin-triage. Kategorisasi + OPD + urgensi + alasan.
 * @returns hasil typed, atau `null` jika Langflow gagal / output invalid
 *          (pemanggil harus set complaints.status = 'triage_failed').
 */
export async function runTriage(input: {
  complaint_text: string;
  region_name: string;
  photo_url: string | null;
}): Promise<TriageOutput | null> {
  try {
    return await runFlow("triage", input, triageOutputSchema);
  } catch (err) {
    console.error("[Langflow] aduin-triage gagal:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Memeriksa apakah Langflow lokal dapat dijangkau.
 * Digunakan dari healthCheck() yang bisa dipanggil dari browser dev tools
 * via API Route (bukan langsung dari client).
 *
 * @returns true jika Langflow merespons, false jika tidak.
 */
export async function healthCheck(): Promise<{ ok: boolean; detail: string }> {
  // Gunakan endpoint publik /health — tidak butuh API key.
  // /api/v1/flows butuh auth dan akan return 401 jika key kosong.
  const url = `${BASE_URL}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = `HTTP ${response.status} dari ${url}`;
      console.error(`[Langflow] healthCheck gagal: ${detail}`);
      return { ok: false, detail };
    }

    // Verifikasi body mengandung { "status": "ok" }
    const body: unknown = await response.json().catch(() => null);
    const statusOk =
      typeof body === "object" &&
      body !== null &&
      (body as Record<string, unknown>)["status"] === "ok";

    if (!statusOk) {
      const detail = `Body tidak sesuai: ${JSON.stringify(body)}`;
      console.error(`[Langflow] healthCheck: ${detail}`);
      return { ok: false, detail };
    }

    return { ok: true, detail: "Langflow berjalan normal" };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const detail = isTimeout
      ? `Timeout setelah 5000ms — pastikan Langflow berjalan di ${BASE_URL}`
      : `Tidak dapat terhubung ke ${BASE_URL}: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[Langflow] healthCheck error: ${detail}`);
    return { ok: false, detail };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Cache AI (ai_cache)
// ---------------------------------------------------------------------------

function hashInput(serializedInput: string): string {
  return createHash("sha256").update(serializedInput).digest("hex");
}

async function getCachedResult<T>(
  flowLabel: string,
  inputHash: string,
  schema: ZodType<T>
): Promise<T | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("ai_cache")
      .select("output")
      .eq("flow_name", flowLabel)
      .eq("input_hash", inputHash)
      .maybeSingle();

    if (!data) return null;

    const validated = schema.safeParse(data.output);
    return validated.success ? validated.data : null;
  } catch (err) {
    console.error(`[Langflow] Gagal membaca ai_cache untuk "${flowLabel}":`, err);
    return null;
  }
}

async function cacheResult(flowLabel: string, inputHash: string, output: unknown): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("ai_cache")
      .upsert(
        { flow_name: flowLabel, input_hash: inputHash, output },
        { onConflict: "flow_name,input_hash" }
      );
  } catch (err) {
    console.error(`[Langflow] Gagal menulis ai_cache untuk "${flowLabel}":`, err);
  }
}

// ---------------------------------------------------------------------------
// Pemanggilan HTTP mentah ke Langflow
// ---------------------------------------------------------------------------

async function callLangflow(
  flowName: FlowName,
  inputValue: string,
  timeoutMs: number
): Promise<string | null> {
  let flowId: string;
  try {
    flowId = getFlowId(flowName);
  } catch {
    // Flow ID belum dikonfigurasi — kembalikan null agar fallback aktif
    return null;
  }

  const url = `${BASE_URL}/api/v1/run/${flowId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      },
      body: JSON.stringify({
        input_value: inputValue,
        output_type: "chat",
        input_type: "chat",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`[Langflow] Flow "${flowName}" gagal: HTTP ${response.status}`);
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const text = extractText(data);
    if (text === null) {
      console.error(`[Langflow] Flow "${flowName}" — output tidak dapat diparsing`);
      return null;
    }
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[Langflow] Flow "${flowName}" timeout setelah ${timeoutMs}ms`);
    } else {
      console.error(`[Langflow] Flow "${flowName}" error:`, err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mengekstrak teks output dari respons Langflow yang bisa bersarang.
 * Langflow membungkus output dalam struktur bertingkat; fungsi ini
 * mencari string pertama di jalur yang umum.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(data: any): string | null {
  // Jalur 1: outputs[0].outputs[0].results.message.text
  try {
    const text: unknown = data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {
    // lanjutkan ke jalur berikutnya
  }

  // Jalur 2: outputs[0].outputs[0].messages[0].message
  try {
    const msg: unknown = data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch {
    // lanjutkan
  }

  // Jalur 3: result langsung sebagai string
  if (typeof data?.result === "string" && data.result.trim()) {
    return data.result.trim();
  }

  return null;
}

// ---------------------------------------------------------------------------
// Parsing JSON tahan banting
// ---------------------------------------------------------------------------

function tryParseJSON(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * Urutan parsing sesuai docs/LANGFLOW_FLOWS.md:
 *   1. Parse JSON langsung
 *   2. Strip markdown code fence, parse lagi
 *   3. Cari substring `{...}` pertama, parse
 *   4. Gagal semua → null
 */
export function parseJsonOutput(text: string): unknown | null {
  const direct = tryParseJSON(text.trim());
  if (direct !== null) return direct;

  const stripped = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const fromFence = tryParseJSON(stripped);
  if (fromFence !== null) return fromFence;

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    const fromSubstring = tryParseJSON(match[0]);
    if (fromSubstring !== null) return fromSubstring;
  }

  return null;
}
