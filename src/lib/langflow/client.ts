/**
 * src/lib/langflow/client.ts
 *
 * Satu-satunya titik panggil Langflow dari aplikasi.
 * JANGAN import file ini di Client Components — hanya boleh dari:
 *   - Route Handlers (src/app/api/*)
 *   - Server Components
 *   - Script server-side (seed, precompute)
 */

import { getFlowId, type FlowName } from "./flows";

const BASE_URL = process.env.LANGFLOW_BASE_URL ?? "http://127.0.0.1:7860";
const API_KEY = process.env.LANGFLOW_API_KEY ?? "";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface LangflowOutput {
  /** Teks mentah dari output node terakhir flow */
  text: string;
}

/**
 * Menjalankan flow Langflow dan mengembalikan teks output mentah.
 *
 * @param flowName  - Kunci flow dari FLOW_NAMES
 * @param inputValue - Teks / JSON yang dikirim ke Chat Input node
 * @param timeoutMs  - Timeout dalam milidetik (default 15 000)
 * @returns LangflowOutput atau null jika flow gagal / timeout
 */
export async function runFlow(
  flowName: FlowName,
  inputValue: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<LangflowOutput | null> {
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
      console.error(
        `[Langflow] Flow "${flowName}" gagal: HTTP ${response.status}`
      );
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const text = extractText(data);
    if (text === null) {
      console.error(`[Langflow] Flow "${flowName}" — output tidak dapat diparsing`);
      return null;
    }
    return { text };
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
 * Memeriksa apakah Langflow lokal dapat dijangkau.
 * Digunakan dari healthCheck() yang bisa dipanggil dari browser dev tools
 * via API Route (bukan langsung dari client).
 *
 * @returns true jika Langflow merespons, false jika tidak.
 */
export async function healthCheck(): Promise<boolean> {
  const url = `${BASE_URL}/api/v1/flows`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(API_KEY ? { "x-api-key": API_KEY } : {}),
      },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mengekstrak teks output dari respons Langflow yang bisa bersarang.
 * Langflow membungkus output dalam struktur bertingkat; fungsi ini
 * mencari string pertama di jalur yang umum.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(data: any): string | null {
  // Jalur 1: outputs[0].outputs[0].results.message.text
  try {
    const text: unknown =
      data?.outputs?.[0]?.outputs?.[0]?.results?.message?.text;
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch {
    // lanjutkan ke jalur berikutnya
  }

  // Jalur 2: outputs[0].outputs[0].messages[0].message
  try {
    const msg: unknown =
      data?.outputs?.[0]?.outputs?.[0]?.messages?.[0]?.message;
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

/**
 * Mengekstrak JSON dari teks yang mungkin dibungkus markdown code fence.
 * Contoh input: "```json\n{...}\n```"
 *
 * @returns Objek yang di-parse atau null jika gagal
 */
export function parseJsonOutput(text: string): unknown | null {
  // Hapus markdown code fence jika ada
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
