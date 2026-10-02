# LANGFLOW_FLOWS — Kontrak Input/Output Setiap Flow Aduin

> Dokumen ini adalah **sumber kebenaran tunggal** untuk semua flow Langflow di proyek Aduin.
> Developer harus membaca dokumen ini sebelum mengimplementasikan `src/lib/langflow/schemas.ts`,
> `src/lib/langflow/flows.ts`, dan `src/lib/langflow/client.ts`.
>
> **Jangan mengubah file di `langflow/flows/` secara manual** — file tersebut adalah export JSON dari Langflow.

---

## Catatan Model Granite

> ⚠️ **Ketersediaan model bergantung pada akun dan region watsonx.ai.** Developer wajib mengecek
> daftar model yang tersedia di komponen **IBM watsonx.ai** Langflow sebelum membangun flow.
> Model ID **tidak** di-hardcode di kode Next.js — hanya dikonfigurasi di dalam flow Langflow.

| Peran | Model ID | Catatan |
|-------|----------|---------|
| LLM default (clarify, triage, opd-agent, alert-summary) | `ibm/granite-4-h-small` | Cek ketersediaan di akun |
| Alternatif LLM (jika `granite-4-h-small` tidak tersedia) | `ibm/granite-3-3-8b-instruct` | Fallback manual |
| Vision (aduin-verify) | `ibm/granite-vision-3-3-2b` | Untuk analisis foto |
| Embedding (aduin-embed) | `ibm/granite-embedding-278m-multilingual` | 768 dimensi |

---

## Daftar Flow

| Nama Flow | Dipanggil Dari | Tujuan Singkat |
|-----------|---------------|----------------|
| `aduin-clarify` | `POST /api/complaints` | Cek kelengkapan aduan; tanya balik jika kurang |
| `aduin-triage` | `POST /api/triage/[id]` | Kategorisasi + OPD + urgensi + alasan |
| `aduin-embed` | `POST /api/triage/[id]` (setelah triage) | Buat embedding vektor teks aduan |
| `aduin-opd-agent` | `POST /api/coordination/[id]` | Buat rencana koordinasi lintas OPD |
| `aduin-verify` | `POST /api/verify/[id]` | Verifikasi foto hasil pengerjaan |
| `aduin-alert-summary` | `POST /api/alert/check` (setelah z-score terpicu) | Ringkasan + rekomendasi OPD untuk alert lonjakan |

---

## Referensi Cepat: Kategori Baku

Semua nilai kategori di seluruh sistem menggunakan **slug** berikut. Flow `aduin-triage` wajib memilih dari daftar ini.

| Slug | Label Tampilan | OPD Default |
|------|---------------|-------------|
| `infrastruktur_jalan` | Infrastruktur Jalan | Dinas PU |
| `kesehatan_diare` | Kesehatan & Sanitasi | Dinas Kesehatan |
| `pengelolaan_sampah` | Pengelolaan Sampah | Dinas Lingkungan Hidup |
| `banjir_drainase` | Banjir/Drainase | Dinas PU |
| `air_bersih_pdam` | Air Bersih/PDAM | PDAM |
| `pendidikan` | Pendidikan | Dinas Pendidikan |
| `pkl_tata_ruang` | PKL/Tata Ruang | Satpol PP |

## Referensi Cepat: Daftar OPD Seed

Flow `aduin-triage` dan `aduin-opd-agent` wajib memilih `opd_short_name` dari daftar ini.

| `short_name` | Nama Lengkap |
|-------------|-------------|
| `DPU` | Dinas Pekerjaan Umum |
| `Dinkes` | Dinas Kesehatan |
| `DLH` | Dinas Lingkungan Hidup |
| `PDAM` | Perusahaan Daerah Air Minum |
| `Disdik` | Dinas Pendidikan |
| `Satpol` | Satuan Polisi Pamong Praja |
| `BPKAD` | Badan Pengelola Keuangan dan Aset Daerah |

---

## Aturan Output Umum

Semua flow yang menghasilkan JSON **wajib** mengikuti aturan berikut:

1. **Kembalikan JSON saja** — tanpa teks pengantar, tanpa komentar, tanpa markdown code fence (tidak ada ` ```json ` atau ` ``` `).
2. Jika model menambahkan teks di luar JSON, `client.ts` akan mencoba strip fence dan ekstrak objek JSON pertama, tetapi ini tidak dijamin berhasil.
3. Temperature **0.0–0.2** untuk semua flow yang menghasilkan JSON terstruktur (kecuali `aduin-alert-summary` yang boleh 0.3 untuk ringkasan naratif).
4. Parsing response di `client.ts` mengikuti urutan: parse JSON langsung → strip ` ```json ``` ` → cari substring `{...}` pertama → lempar error.

### Variabel Prompt: Satu Variabel `{input_json}`

**Semua flow menggunakan satu variabel prompt tunggal: `{input_json}`**, yang disambungkan langsung dari output komponen **Chat Input**. Tidak ada variabel terpisah seperti `{complaint_text}`, `{region_name}`, dst. Prompt menginstruksikan model untuk membaca field yang dibutuhkan dari JSON string dalam `{input_json}`.

### Aturan Escaping Kurung Kurawal di File Prompt

Komponen Prompt Langflow memperlakukan `{nama}` sebagai variabel dan akan gagal jika menemukan `{...}` yang tidak terdaftar sebagai variabel.

**Aturan:**
- **`{input_json}`** — satu-satunya variabel; tulis dengan kurung tunggal.
- **Semua kurung kurawal literal** (contoh format JSON di dalam prompt) — escape menjadi `{{` dan `}}`.

Contoh di dalam template prompt:
```
# SALAH — akan dianggap variabel oleh Langflow
{"status": "complete", "question": null}

# BENAR — escaped
{{"status": "complete", "question": null}}
```

Aturan ini berlaku di semua file `langflow/prompts/*.md`.

---

## Flow 1 — `aduin-clarify`

### Tujuan

Menentukan apakah teks aduan warga sudah cukup lengkap untuk diproses (ada lokasi dan deskripsi masalah). Jika kurang, menghasilkan satu pertanyaan lanjutan dalam Bahasa Indonesia yang ramah.

Dipanggil dari: `POST /api/complaints` — **sebelum** aduan disimpan ke database.

### Format Input

Next.js mengirim satu JSON string sebagai `input_value` ke `POST /api/v1/run/{flowId}`:

```json
{
  "input_value": "{\"complaint_text\": \"...\", \"region_name\": \"...\"}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `complaint_text` | `string` | Teks aduan mentah dari warga |
| `region_name` | `string \| null` | Nama desa/kecamatan jika sudah dipilih dari dropdown; `null` jika belum |

**Contoh `input_value` yang di-serialize:**

```json
{
  "complaint_text": "Pak jalan di sini rusak parah",
  "region_name": null
}
```

### Format Output

`client.ts` membaca dari `outputs[0].outputs[0].results.message.text` dan mem-parse sebagai JSON.

**Skema output:**

```typescript
{
  status: "complete" | "incomplete";
  question: string | null;  // null jika status = "complete"
}
```

**Contoh output — aduan lengkap:**

```json
{
  "status": "complete",
  "question": null
}
```

**Contoh output — aduan kurang lengkap:**

```json
{
  "status": "incomplete",
  "question": "Di jalan atau desa mana tepatnya kerusakan ini terjadi?"
}
```

**Zod schema (`src/lib/langflow/schemas.ts`):**

```typescript
export const clarifyOutputSchema = z.object({
  status: z.enum(["complete", "incomplete"]),
  question: z.string().nullable(),
});
export type ClarifyOutput = z.infer<typeof clarifyOutputSchema>;
```

### Susunan Komponen Langflow

```
Chat Input
    │  (JSON string — nilai input_value dari Next.js)
    ▼
Prompt
    │  Template: lihat langflow/prompts/clarify.md
    │  Variabel: {input_json}   ← disambung dari Chat Input
    ▼
IBM watsonx.ai (LLM)
    │  Model: ibm/granite-4-h-small
    │  (alt: ibm/granite-3-3-8b-instruct)
    │  Temperature: 0.0
    │  Max tokens: 200
    ▼
Chat Output
```

### Fallback

Jika flow gagal (timeout, HTTP error, Zod invalid):
- Kembalikan `{ status: "complete", question: null }` sebagai fallback default.
- Aduan tetap disimpan (sistem tidak boleh memblokir intake karena AI gagal).
- Log error di server, **jangan tampilkan detail error ke warga**.

### Test Cases Playground

**TC-1: Aduan jelas dengan lokasi**
- Input: `{"complaint_text": "Jalan di depan SD Negeri 1 Bantaran, Desa Bantaran, rusak berlubang sudah seminggu", "region_name": "Bantaran"}`
- Output yang diharapkan: `{"status": "complete", "question": null}`

**TC-2: Aduan tanpa lokasi**
- Input: `{"complaint_text": "Pak jalan sini rusak parah banget", "region_name": null}`
- Output yang diharapkan: `{"status": "incomplete", "question": "Di jalan atau desa mana tepatnya kerusakan jalan ini terjadi?"}`

**TC-3: Aduan tanpa deskripsi masalah**
- Input: `{"complaint_text": "Ada masalah di Desa Sumberasih", "region_name": "Sumberasih"}`
- Output yang diharapkan: `{"status": "incomplete", "question": "Masalah apa yang Bapak/Ibu alami di Desa Sumberasih? Mohon ceritakan lebih detail."}`

---

## Flow 2 — `aduin-triage`

### Tujuan

Mengategorikan aduan ke dalam satu dari tujuh kategori baku, menentukan OPD tujuan, tingkat urgensi (1–5), estimasi dampak, jalur penanganan, dan alasan keputusan dalam Bahasa Indonesia.

Dipanggil dari: `POST /api/triage/[id]` — setelah aduan disimpan ke tabel `complaints`.

### Format Input

```json
{
  "input_value": "{\"complaint_text\": \"...\", \"region_name\": \"...\", \"photo_url\": null}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `complaint_text` | `string` | Teks aduan asli |
| `region_name` | `string` | Nama desa/kecamatan dari `regions.name` |
| `photo_url` | `string \| null` | URL foto aduan (opsional; tidak dianalisis oleh flow ini) |

**Contoh:**

```json
{
  "complaint_text": "Jalan di depan SD Negeri 1 Bantaran berlubang besar, sudah seminggu belum diperbaiki, berbahaya untuk anak sekolah.",
  "region_name": "Bantaran",
  "photo_url": null
}
```

### Format Output

**Skema output:**

```typescript
{
  category: CategorySlug;       // salah satu dari 7 slug baku
  opd_short_name: OpdShortName; // salah satu dari 7 short_name OPD
  urgency: 1 | 2 | 3 | 4 | 5;
  impact: "rendah" | "sedang" | "tinggi";
  handling_path: "quick_fix" | "bertahap" | "butuh_data";
  reason: string;               // Bahasa Indonesia, maks ~100 kata
}
```

**Contoh output:**

```json
{
  "category": "infrastruktur_jalan",
  "opd_short_name": "DPU",
  "urgency": 4,
  "impact": "tinggi",
  "handling_path": "bertahap",
  "reason": "Kerusakan jalan aktif di area sekolah dasar; perbaikan membutuhkan survei dan penganggaran terlebih dahulu karena skala kerusakan yang dilaporkan cukup besar."
}
```

**Zod schema:**

```typescript
const CATEGORY_SLUGS = [
  "infrastruktur_jalan", "kesehatan_diare", "pengelolaan_sampah",
  "banjir_drainase", "air_bersih_pdam", "pendidikan", "pkl_tata_ruang",
] as const;

const OPD_SHORT_NAMES = [
  "DPU", "Dinkes", "DLH", "PDAM", "Disdik", "Satpol",
] as const;

export const triageOutputSchema = z.object({
  category: z.enum(CATEGORY_SLUGS),
  opd_short_name: z.enum(OPD_SHORT_NAMES),
  urgency: z.number().int().min(1).max(5),
  impact: z.enum(["rendah", "sedang", "tinggi"]),
  handling_path: z.enum(["quick_fix", "bertahap", "butuh_data"]),
  reason: z.string().min(10),
});
export type TriageOutput = z.infer<typeof triageOutputSchema>;
```

> `opd_short_name` digunakan oleh `POST /api/triage/[id]` untuk melakukan lookup `SELECT id FROM opd WHERE short_name = $1` dan mengisi `triage_results.opd_id` serta `complaints.effective_opd_id`.

**Definisi `handling_path`:**

| Nilai | Arti |
|-------|------|
| `quick_fix` | Masalah sederhana; bisa diselesaikan dalam 1 kunjungan tanpa perlu survei/anggaran khusus |
| `bertahap` | Perlu survei, perencanaan, atau alokasi anggaran; multi-langkah |
| `butuh_data` | Informasi yang ada tidak cukup untuk menentukan jalur; perlu investigasi lapangan terlebih dahulu |

### Susunan Komponen Langflow

```
Chat Input
    │
    ▼
Prompt
    │  Template: lihat langflow/prompts/triage.md
    │  Variabel: {input_json}   ← disambung dari Chat Input
    │  (prompt menyertakan daftar lengkap slug + OPD)
    ▼
IBM watsonx.ai (LLM)
    │  Model: ibm/granite-4-h-small
    │  (alt: ibm/granite-3-3-8b-instruct)
    │  Temperature: 0.0
    │  Max tokens: 300
    ▼
Chat Output
```

### Fallback

- Timeout (> 15 detik) atau HTTP error → `complaints.status = 'triage_failed'`
- Zod validation gagal → `status = 'triage_failed'`; simpan `raw_response` ke `triage_results.raw_response` untuk debugging
- Operator dapat re-triage manual dari UI setelah kegagalan

### Test Cases Playground

**TC-1: Jalan rusak area sekolah**
- Input: `{"complaint_text": "Jalan di depan SDN 1 Bantaran berlubang besar sudah seminggu, anak-anak sekolah berbahaya", "region_name": "Bantaran", "photo_url": null}`
- Output yang diharapkan:
  ```json
  {"category": "infrastruktur_jalan", "opd_short_name": "DPU", "urgency": 4, "impact": "tinggi", "handling_path": "bertahap", "reason": "..."}
  ```

**TC-2: Keluhan air keruh dan diare**
- Input: `{"complaint_text": "Sudah 3 hari air PDAM keruh, anak-anak di kampung banyak yang diare", "region_name": "Sumberasih", "photo_url": null}`
- Output yang diharapkan:
  ```json
  {"category": "kesehatan_diare", "opd_short_name": "Dinkes", "urgency": 5, "impact": "tinggi", "handling_path": "butuh_data", "reason": "..."}
  ```

**TC-3: Sampah menumpuk di pasar**
- Input: `{"complaint_text": "Sampah di belakang pasar Dringu sudah 4 hari tidak diangkut, bau menyengat", "region_name": "Dringu", "photo_url": null}`
- Output yang diharapkan:
  ```json
  {"category": "pengelolaan_sampah", "opd_short_name": "DLH", "urgency": 3, "impact": "sedang", "handling_path": "quick_fix", "reason": "..."}
  ```

**TC-4: Aduan ambigu (butuh data)**
- Input: `{"complaint_text": "Ada masalah di Desa Wonomerto, tolong ditangani", "region_name": "Wonomerto", "photo_url": null}`
- Output yang diharapkan: `handling_path = "butuh_data"`, alasan menjelaskan kurangnya detail

---

## Flow 3 — `aduin-embed`

### Tujuan

Menghasilkan vektor embedding 768 dimensi untuk teks aduan menggunakan model `ibm/granite-embedding-278m-multilingual`. Vektor ini disimpan di `complaint_embeddings` dan digunakan oleh algoritma clustering (§5.1 ARCHITECTURE.md).

Dipanggil dari: `POST /api/triage/[id]` — setelah triage berhasil, sebelum clustering.

> **Catatan model:** `ibm/granite-embedding-278m-multilingual` tidak memakai konvensi awalan `"query: "`/`"passage: "` seperti model keluarga e5 (`multilingual-e5-large`). Teks dikirim apa adanya ke `embed_query()` tanpa prefiks tambahan.

### Format Input

```json
{
  "input_value": "{\"complaint_text\": \"...\"}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `complaint_text` | `string` | Teks aduan asli |

**Contoh:**

```json
{
  "complaint_text": "Jalan di depan SD Negeri 1 Bantaran berlubang besar, berbahaya untuk anak sekolah."
}
```

### Format Output

**Skema output:**

```typescript
{
  embedding: number[];   // array 768 float
  model_version: string; // "ibm/granite-embedding-278m-multilingual"
}
```

**Contoh output:**

```json
{
  "embedding": [0.0234, -0.1823, 0.0541, "...765 nilai lainnya..."],
  "model_version": "ibm/granite-embedding-278m-multilingual"
}
```

**Zod schema:**

```typescript
export const embedOutputSchema = z.object({
  embedding: z.array(z.number()).length(768),
  model_version: z.string(),
});
export type EmbedOutput = z.infer<typeof embedOutputSchema>;
```

> Jika model/dimensi embedding berubah, update `EMBEDDING_DIMENSION` di `.env.local`, jalankan migrasi DB untuk mengubah dimensi kolom `vector()`, dan re-embed semua aduan existing (`supabase/seed/embed-seed.ts` idempoten untuk aduan seed; aduan non-seed perlu re-embed manual).

### Susunan Komponen Langflow

Flow ini memakai komponen bawaan **IBM watsonx.ai Embeddings** untuk memanggil watsonx.ai (bukan `httpx`/IAM token manual) dan satu Custom Component Python tipis yang hanya mengekstrak `complaint_text` dari JSON input dan memformat hasilnya kembali sebagai JSON.

```
Chat Input
    │  (JSON string dengan complaint_text)
    ├──────────────────────────────────────┐
    ▼                                       ▼
IBM watsonx.ai Embeddings          (teks JSON diteruskan apa adanya)
    │  Model: ibm/granite-embedding-278m-multilingual
    │  Kredensial: Global Variables WATSONX_API_KEY / WATSONX_PROJECT_ID
    │  Endpoint: https://jp-tok.ml.cloud.ibm.com
    │  Output: handle "Embeddings" (bukan vektor langsung)
    │
    ▼ (handle Embeddings)
Custom Component Python — Aduin Embed JSON
    │  1. Parse complaint_text dari input JSON (fallback ke teks mentah jika parse gagal)
    │  2. Panggil embedding_model.embed_query(text) — embedding_model adalah handle
    │     dari komponen IBM watsonx.ai Embeddings di atas
    │  3. Kembalikan JSON {"embedding": [...], "model_version": "..."} sebagai Message
    ▼
Chat Output
```

**Custom Component Python — Kode Lengkap (persis seperti yang dipakai di Langflow):**

```python
import json

from langflow.custom import Component
from langflow.io import HandleInput, MessageTextInput, Output
from langflow.schema.message import Message


class AduinEmbedJSON(Component):
    display_name = "Aduin Embed JSON"
    description = "Mengubah teks aduan menjadi vektor embedding dalam format JSON."
    icon = "binary"

    inputs = [
        HandleInput(
            name="embedding_model",
            display_name="Embedding Model",
            input_types=["Embeddings"],
            required=True,
        ),
        MessageTextInput(
            name="input_text",
            display_name="Input JSON",
            required=True,
        ),
    ]

    outputs = [
        Output(display_name="JSON", name="json_output", method="build_output"),
    ]

    def build_output(self) -> Message:
        raw = self.input_text
        try:
            text = json.loads(raw).get("complaint_text", raw)
        except (json.JSONDecodeError, AttributeError):
            text = raw

        vector = self.embedding_model.embed_query(text)
        result = {
            "embedding": [float(x) for x in vector],
            "model_version": "ibm/granite-embedding-278m-multilingual",
        }
        self.status = f"{len(vector)} dimensi"
        return Message(text=json.dumps(result))
```

> **Wiring di Langflow UI:**
> 1. Tambahkan komponen **IBM watsonx.ai Embeddings**, set `Model Name` = `ibm/granite-embedding-278m-multilingual`, `watsonx API Endpoint` sesuai region akun, `Watsonx API Key` dan `watsonx Project_ID` merujuk ke Global Variables `WATSONX_API_KEY`/`WATSONX_PROJECT_ID`.
> 2. Tambahkan Custom Component di atas, sambungkan output **Embedding Model** dari komponen watsonx.ai ke input **Embedding Model** (`embedding_model`) Custom Component.
> 3. Sambungkan **Chat Input** → input **Input JSON** (`input_text`) Custom Component.
> 4. Sambungkan output **JSON** (`json_output`) Custom Component → **Chat Output**.

### Fallback

- Jika flow gagal → embedding tidak disimpan; aduan tetap di status `triaged` (embedding tidak blocking).
- Clustering tidak dijalankan jika embedding tidak tersedia.
- Log error di server; operator dapat memicu ulang embedding secara manual (opsional, di luar scope MVP).

### Test Cases Playground

**TC-1: Teks pendek**
- Input: `{"complaint_text": "Jalan rusak di Bantaran"}`
- Output yang diharapkan: `{"embedding": [...768 nilai float...], "model_version": "ibm/granite-embedding-278m-multilingual"}`
- Validasi: `embedding.length === 768`, semua nilai adalah number

**TC-2: Teks panjang dengan bahasa campuran**
- Input: `{"complaint_text": "Banjir ndak surut-surut, wis rong dino iki banyu mlebu omah, tolong Pak segera ditangani sebelum lebih parah di Desa Pabean"}`
- Output yang diharapkan: embedding valid 768 dimensi
- Validasi: semua nilai adalah float, tidak ada NaN atau Infinity

**TC-3: Dua aduan serupa (jalan rusak)**
- Input A: `{"complaint_text": "Jalan di depan SDN 1 Bantaran berlubang besar sudah seminggu"}`
- Input B: `{"complaint_text": "Lubang jalan di Jl. Raya Bantaran km 3 sangat berbahaya"}`
- Validasi: cosine similarity antar embedding A dan B tinggi (≥ `CLUSTER_SIMILARITY_THRESHOLD` = 0.75) — keduanya soal jalan rusak di lokasi berdekatan

**TC-4: Dua aduan kategori berbeda**
- Input A: `{"complaint_text": "Jalan di depan SDN 1 Bantaran berlubang besar sudah seminggu"}`
- Input C: `{"complaint_text": "Sudah 3 hari air PDAM keruh, anak-anak di kampung banyak yang diare"}`
- Validasi: cosine similarity antar embedding A dan C rendah (di bawah threshold) — kategori berbeda (jalan vs kesehatan)

---

## Flow 4 — `aduin-opd-agent`

### Tujuan

Menghasilkan rencana koordinasi lintas OPD: daftar sub-tugas, OPD penanggung jawab per sub-tugas, urutan eksekusi, dan ketergantungan antar sub-tugas. Digunakan ketika operator menekan "Buat Rencana Koordinasi" pada aduan yang sudah di-triage.

Dipanggil dari: `POST /api/coordination/[id]`

### Format Input

```json
{
  "input_value": "{\"complaint_text\": \"...\", \"region_name\": \"...\", \"triage\": {...}}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `complaint_text` | `string` | Teks aduan asli |
| `region_name` | `string` | Nama desa/kecamatan |
| `triage` | `object` | Hasil triage: `{category, opd_short_name, urgency, impact, handling_path, reason}` |

**Contoh:**

```json
{
  "complaint_text": "Jalan di depan SDN 1 Bantaran berlubang besar, berbahaya untuk anak sekolah.",
  "region_name": "Bantaran",
  "triage": {
    "category": "infrastruktur_jalan",
    "opd_short_name": "DPU",
    "urgency": 4,
    "impact": "tinggi",
    "handling_path": "bertahap",
    "reason": "Kerusakan jalan aktif di area sekolah; perlu survei dan penganggaran."
  }
}
```

### Format Output

**Skema output:**

```typescript
{
  summary: string;
  tasks: Array<{
    sequence: number;
    title: string;
    description: string;
    opd_short_name: OpdShortName;
    depends_on: number[];
  }>;
}
```

**Contoh output:**

```json
{
  "summary": "Perbaikan jalan di depan SDN 1 Bantaran memerlukan tiga tahap: survei kondisi oleh Dinas PU, alokasi anggaran darurat oleh BPKAD, dan pelaksanaan perbaikan fisik oleh Dinas PU.",
  "tasks": [
    {
      "sequence": 1,
      "title": "Survei Kerusakan Jalan",
      "description": "Lakukan survei lapangan untuk mendokumentasikan skala kerusakan, perkiraan volume material, dan estimasi biaya perbaikan.",
      "opd_short_name": "DPU",
      "depends_on": []
    },
    {
      "sequence": 2,
      "title": "Alokasi Anggaran Darurat",
      "description": "Proses pengajuan dan persetujuan anggaran darurat berdasarkan hasil survei Dinas PU.",
      "opd_short_name": "BPKAD",
      "depends_on": [1]
    },
    {
      "sequence": 3,
      "title": "Perbaikan Fisik Jalan",
      "description": "Lakukan perbaikan fisik jalan berlubang setelah anggaran disetujui. Pasang rambu peringatan selama pengerjaan.",
      "opd_short_name": "DPU",
      "depends_on": [2]
    }
  ]
}
```

**Zod schema (dengan validasi `depends_on`):**

```typescript
const taskSchema = z.object({
  sequence: z.number().int().min(1),
  title: z.string().min(3),
  description: z.string(),
  opd_short_name: z.enum(["DPU", "Dinkes", "DLH", "PDAM", "Disdik", "Satpol", "BPKAD"]),
  depends_on: z.array(z.number().int().min(1)),
});

export const opdAgentOutputSchema = z
  .object({
    summary: z.string().min(10),
    tasks: z.array(taskSchema).min(1),
  })
  .superRefine((val, ctx) => {
    const sequences = new Set(val.tasks.map((t) => t.sequence));

    // Pastikan sequence unik
    if (sequences.size !== val.tasks.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Setiap task harus memiliki sequence yang unik.",
      });
      return;
    }

    for (const task of val.tasks) {
      for (const dep of task.depends_on) {
        // Setiap depends_on harus merujuk ke sequence yang ada
        if (!sequences.has(dep)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Task sequence ${task.sequence}: depends_on merujuk ke sequence ${dep} yang tidak ada.`,
          });
        }
        // depends_on hanya boleh merujuk ke sequence yang lebih kecil (tidak boleh maju/melingkar)
        if (dep >= task.sequence) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Task sequence ${task.sequence}: depends_on ${dep} harus lebih kecil dari sequence task itu sendiri.`,
          });
        }
      }
    }

    // Deteksi ketergantungan melingkar via DFS
    const adjList = new Map<number, number[]>();
    for (const task of val.tasks) {
      adjList.set(task.sequence, task.depends_on);
    }

    function hasCycle(
      node: number,
      visited: Set<number>,
      stack: Set<number>
    ): boolean {
      visited.add(node);
      stack.add(node);
      for (const dep of adjList.get(node) ?? []) {
        if (!visited.has(dep)) {
          if (hasCycle(dep, visited, stack)) return true;
        } else if (stack.has(dep)) {
          return true;
        }
      }
      stack.delete(node);
      return false;
    }

    const visited = new Set<number>();
    const stack = new Set<number>();
    for (const seq of sequences) {
      if (!visited.has(seq)) {
        if (hasCycle(seq, visited, stack)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Terdeteksi ketergantungan melingkar (circular dependency) antar tasks.",
          });
          break;
        }
      }
    }
  });

export type OpdAgentOutput = z.infer<typeof opdAgentOutputSchema>;
```

> **Catatan:** Karena `depends_on` wajib merujuk ke sequence yang lebih kecil, ketergantungan melingkar secara teori sudah dicegah oleh constraint `dep < task.sequence`. Namun DFS tetap dijalankan sebagai lapisan keamanan tambahan.

### Susunan Komponen Langflow

Flow ini **tidak** memakai komponen **Agent**. Komponen Agent di Langflow 1.12 bergantung pada fitur *Model Providers* yang gagal di region Tokyo (`jp-tok`), sehingga flow disusun sebagai rantai LLM biasa — sama seperti flow triage. Penalaran multi-langkah cukup ditangani lewat instruksi di prompt.

```
Chat Input
    │
    ▼
Prompt Template
    │  Template: lihat langflow/prompts/opd-agent.md
    │  Variabel: {input_json}   ← disambung dari Chat Input
    ▼
IBM watsonx.ai
    │  Model: ibm/granite-4-h-small
    │  Endpoint: https://jp-tok.ml.cloud.ibm.com
    │  Temperature: 0.1
    │  Max tokens: 800
    ▼
Chat Output
```

> Output bisa sampai 800 token, jadi `runOpdAgent()` di `client.ts` memakai timeout 60 detik (flow lain 15 detik).

### Fallback

- Jika flow gagal → tampilkan pesan error di UI: *"Gagal membuat rencana koordinasi. Silakan coba lagi."*
- Aduan tidak hilang; rencana sederhana (1 task ke `effective_opd_id`) yang dibuat otomatis saat triage tetap aktif.
- Rencana `ai_generated` hanya menggantikan rencana sederhana setelah berhasil.
- Penggantian dilakukan atomik oleh fungsi Postgres `replace_coordination_plan` (`supabase/migrations/0003_coordination_rpc.sql`): hapus plan lama (tasks & dependencies ikut terhapus lewat cascade), lalu insert plan + tasks + dependencies baru. Jika satu langkah gagal, seluruh perubahan di-rollback.
- Input `triage` yang dikirim adalah triage **efektif**: kategori & OPD dari `complaints.effective_*` (sudah memperhitungkan override), `handling_path` dari override terbaru jika ada.

### Test Cases Playground

**TC-1: Aduan jalan berlubang — handling_path bertahap**
- Input: gunakan contoh di atas
- Output yang diharapkan: minimal 2 tasks dengan `depends_on` yang logis; semua `opd_short_name` valid; tidak ada sequence duplikat; tidak ada depends_on yang merujuk sequence yang tidak ada

**TC-2: Aduan air keruh + diare — lintas OPD**
- Input:
  ```json
  {
    "complaint_text": "Air PDAM keruh 3 hari, banyak warga Sumberasih terkena diare",
    "region_name": "Sumberasih",
    "triage": {"category": "kesehatan_diare", "opd_short_name": "Dinkes", "urgency": 5, "impact": "tinggi", "handling_path": "butuh_data", "reason": "Perlu investigasi sumber masalah."}
  }
  ```
- Output yang diharapkan: tasks menyertakan Dinkes (investigasi) DAN PDAM (cek kualitas air)

**TC-3: Aduan sampah sederhana — quick fix**
- Input:
  ```json
  {
    "complaint_text": "Sampah di TPS Dringu 4 hari tidak diangkut",
    "region_name": "Dringu",
    "triage": {"category": "pengelolaan_sampah", "opd_short_name": "DLH", "urgency": 3, "impact": "sedang", "handling_path": "quick_fix", "reason": "Cukup jadwalkan pengangkutan."}
  }
  ```
- Output yang diharapkan: 1 task ke `DLH`, `depends_on: []`

---

## Flow 5 — `aduin-verify`

### Tujuan

Memverifikasi apakah foto hasil pengerjaan menunjukkan bahwa masalah yang dilaporkan sudah diselesaikan. Menghasilkan status verifikasi AI dan alasan singkat.

Dipanggil dari: `POST /api/verify/[id]` — setelah petugas OPD mengunggah foto ke Supabase Storage.

### Cara Mengirim Foto

Foto dikirim sebagai **URL publik Supabase Storage** dalam field `photo_after_url`. Custom Component mengunduh foto dari URL ini langsung di dalam Langflow.

> **Format URL Supabase Storage:**
> ```
> https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>/<filename>
> ```
> Pastikan bucket dibuat dengan kebijakan `public` agar URL dapat diakses oleh Langflow tanpa autentikasi.

**Jika foto "sebelum" tidak tersedia (`photo_before_url = null`):** Flow menilai foto "sesudah" berdasarkan deskripsi aduan dan kategori saja.

### Format Input

```json
{
  "input_value": "{\"complaint_text\": \"...\", \"category\": \"...\", \"photo_after_url\": \"...\", \"photo_before_url\": null}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `complaint_text` | `string` | Teks aduan asli |
| `category` | `string` | Slug kategori dari `effective_category` |
| `photo_after_url` | `string` | URL publik foto sesudah di Supabase Storage |
| `photo_before_url` | `string \| null` | URL publik foto sebelum; `null` jika tidak ada |

**Contoh:**

```json
{
  "complaint_text": "Jalan di depan SDN 1 Bantaran berlubang besar, berbahaya untuk anak sekolah.",
  "category": "infrastruktur_jalan",
  "photo_after_url": "https://abc.supabase.co/storage/v1/object/public/photos/after/complaint-123.jpg",
  "photo_before_url": null
}
```

### Format Output

**Skema output:**

```typescript
{
  ai_status: "ai_verified" | "needs_review";
  ai_reason: string;  // Bahasa Indonesia, penjelasan singkat keputusan AI
}
```

**Contoh output — terverifikasi:**

```json
{
  "ai_status": "ai_verified",
  "ai_reason": "Permukaan jalan tampak telah diperbaiki dengan aspal baru. Tidak ada lubang yang terlihat di area yang sebelumnya dilaporkan rusak."
}
```

**Contoh output — perlu review:**

```json
{
  "ai_status": "needs_review",
  "ai_reason": "Foto tidak menunjukkan area jalan yang dilaporkan berlubang secara jelas. Sudut pengambilan foto terlalu jauh untuk memastikan perbaikan sudah dilakukan."
}
```

**Zod schema:**

```typescript
export const verifyOutputSchema = z.object({
  ai_status: z.enum(["ai_verified", "needs_review"]),
  ai_reason: z.string().min(10),
});
export type VerifyOutput = z.infer<typeof verifyOutputSchema>;
```

### Susunan Komponen Langflow

#### Opsi A — Custom Component Vision (Direkomendasikan)

Flow ini menggunakan **dua komponen saja**: Chat Input dan satu Custom Component Python yang memanggil watsonx.ai Vision API secara langsung menggunakan kredensial dari Global Variables.

```
Chat Input
    │  (JSON string dengan URL foto)
    ▼
Custom Component Python — AduinVerifier
    │  1. Parse input JSON (complaint_text, category, photo_after_url, photo_before_url)
    │  2. Unduh foto_after (dan foto_before jika ada) dari URL Supabase Storage
    │  3. Encode ke base64
    │  4. Buat prompt verifikasi sesuai kategori
    │  5. Panggil ibm/granite-vision-3-3-2b di watsonx.ai REST API
    │  6. Parse respons dan kembalikan JSON {"ai_status", "ai_reason"} sebagai Message
    ▼
Chat Output
```

**Custom Component Python — Kode Lengkap:**

```python
"""
aduin-verify Custom Component (Opsi A — Vision)
Memanggil IBM watsonx.ai Granite Vision secara langsung via REST API.
Kredensial diambil dari Global Variables Langflow (environment variables).

Dependensi yang harus tersedia di environment Langflow:
  - httpx (biasanya sudah tersedia di Langflow)

Verifikasi sebelum deploy:
  - Endpoint generate_text untuk model Vision mungkin berbeda; cek dokumentasi
    IBM watsonx.ai terbaru jika status 404 atau 400.
  - Format payload messages (role/content) sesuai IBM watsonx.ai Chat API.
"""

from langflow.custom import Component
from langflow.io import MessageTextInput, Output
from langflow.schema.message import Message
import base64
import json
import os
import httpx


CATEGORY_GUIDANCE: dict[str, str] = {
    "infrastruktur_jalan": (
        "Apakah permukaan jalan tampak diperbaiki? Tidak ada lubang yang terlihat?"
    ),
    "pengelolaan_sampah": (
        "Apakah area tampak bersih dari tumpukan sampah yang dilaporkan?"
    ),
    "banjir_drainase": (
        "Apakah genangan air sudah tidak ada? Apakah saluran terlihat bersih/berfungsi?"
    ),
    "kesehatan_diare": (
        "Apakah foto menunjukkan tindakan penanganan kesehatan (fogging, pengobatan, dll.)?"
    ),
    "air_bersih_pdam": (
        "Apakah foto menunjukkan perbaikan infrastruktur air atau air yang terlihat jernih?"
    ),
    "pendidikan": (
        "Apakah fasilitas pendidikan yang dilaporkan rusak tampak sudah diperbaiki?"
    ),
    "pkl_tata_ruang": (
        "Apakah area yang dilaporkan tampak tertib dan bersih dari pelanggaran?"
    ),
}


class AduinVerifier(Component):
    display_name = "Aduin Verifier (Vision)"
    description = (
        "Downloads photos from Supabase Storage URLs, calls IBM watsonx.ai "
        "granite-vision-3-3-2b, returns verification JSON as Message."
    )

    inputs = [
        MessageTextInput(
            name="chat_input",
            display_name="Chat Input (JSON)",
            info=(
                'JSON string: {"complaint_text": "...", "category": "...", '
                '"photo_after_url": "...", "photo_before_url": null}'
            ),
        ),
    ]

    outputs = [
        Output(display_name="Verification JSON", name="output", method="run_verify"),
    ]

    def _download_image_b64(self, url: str) -> tuple[str, str]:
        """Unduh gambar dari URL dan kembalikan (base64_string, mime_type)."""
        resp = httpx.get(url, timeout=15.0, follow_redirects=True)
        resp.raise_for_status()
        mime = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return b64, mime

    def _build_prompt(
        self,
        complaint_text: str,
        category: str,
        has_before: bool,
    ) -> str:
        guidance = CATEGORY_GUIDANCE.get(
            category,
            "Apakah kondisi dalam foto menunjukkan bahwa masalah yang dilaporkan sudah diselesaikan?",
        )
        before_note = (
            "Foto sebelum (before) juga disertakan sebagai pembanding."
            if has_before
            else "Tidak ada foto sebelum; nilai berdasarkan deskripsi aduan dan kondisi foto sesudah."
        )
        return (
            f"Kamu adalah sistem verifikasi penyelesaian aduan pemerintah daerah.\n\n"
            f"Aduan: {complaint_text}\n"
            f"Kategori: {category}\n"
            f"{before_note}\n\n"
            f"Panduan penilaian untuk kategori ini: {guidance}\n\n"
            f"Nilai apakah foto sesudah (after) membuktikan penyelesaian masalah.\n"
            f"Kembalikan JSON saja:\n"
            f'Jika terbukti: {{"ai_status": "ai_verified", "ai_reason": "<alasan singkat Bahasa Indonesia>"}}\n'
            f'Jika tidak/ragu: {{"ai_status": "needs_review", "ai_reason": "<alasan singkat Bahasa Indonesia>"}}\n'
            f"Tanpa teks tambahan. Tanpa markdown code fence."
        )

    def run_verify(self) -> Message:
        # --- 1. Parse input ---
        raw = self.chat_input
        if hasattr(raw, "text"):
            raw = raw.text
        data = json.loads(str(raw))

        complaint_text: str = data["complaint_text"]
        category: str = data.get("category", "")
        photo_after_url: str = data["photo_after_url"]
        photo_before_url: str | None = data.get("photo_before_url")

        # --- 2. Unduh gambar ---
        after_b64, after_mime = self._download_image_b64(photo_after_url)
        has_before = photo_before_url is not None
        before_b64: str | None = None
        before_mime: str = "image/jpeg"
        if has_before:
            before_b64, before_mime = self._download_image_b64(photo_before_url)  # type: ignore[arg-type]

        # --- 3. Ambil kredensial ---
        api_key = os.environ.get("WATSONX_API_KEY", "")
        project_id = os.environ.get("WATSONX_PROJECT_ID", "")
        base_url = os.environ.get(
            "WATSONX_URL", "https://us-south.ml.cloud.ibm.com"
        ).rstrip("/")

        if not api_key or not project_id:
            raise ValueError(
                "WATSONX_API_KEY dan WATSONX_PROJECT_ID harus diset "
                "sebagai Global Variables di Langflow."
            )

        # --- 4. Dapatkan IAM token ---
        iam_resp = httpx.post(
            "https://iam.cloud.ibm.com/identity/token",
            data={
                "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                "apikey": api_key,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15.0,
        )
        iam_resp.raise_for_status()
        iam_token: str = iam_resp.json()["access_token"]

        # --- 5. Bangun pesan multimodal ---
        prompt_text = self._build_prompt(complaint_text, category, has_before)

        # Susun content array: teks + gambar sesudah (+ gambar sebelum jika ada)
        content: list[dict] = [{"type": "text", "text": prompt_text}]
        if before_b64 is not None:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:{before_mime};base64,{before_b64}",
                },
            })
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{after_mime};base64,{after_b64}",
            },
        })

        payload = {
            "model_id": "ibm/granite-vision-3-3-2b",
            "project_id": project_id,
            "messages": [{"role": "user", "content": content}],
            "parameters": {
                "max_new_tokens": 200,
                "temperature": 0.0,
            },
        }

        # --- 6. Panggil watsonx.ai Chat API ---
        wx_resp = httpx.post(
            f"{base_url}/ml/v1/text/chat?version=2024-05-31",
            json=payload,
            headers={
                "Authorization": f"Bearer {iam_token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        wx_resp.raise_for_status()
        wx_data = wx_resp.json()

        # Ekstrak teks output
        raw_text: str = wx_data["choices"][0]["message"]["content"]

        # --- 7. Parse JSON dari output model ---
        # Coba parse langsung; strip fence jika perlu
        def try_parse(s: str) -> dict | None:
            try:
                return json.loads(s)
            except json.JSONDecodeError:
                return None

        result = try_parse(raw_text)
        if result is None:
            stripped = raw_text.replace("```json", "").replace("```", "").strip()
            result = try_parse(stripped)
        if result is None:
            import re
            m = re.search(r"\{[\s\S]*\}", raw_text)
            if m:
                result = try_parse(m.group(0))
        if result is None:
            raise ValueError(f"Gagal mem-parse output Vision model: {raw_text!r}")

        return Message(text=json.dumps(result))
```

> **Catatan verifikasi wajib sebelum deploy:**
> 1. Cek endpoint yang benar untuk model Vision di dokumentasi IBM watsonx.ai terbaru (endpoint `text/chat` atau `text/generation`).
> 2. Cek format payload `messages` — IBM watsonx.ai mungkin menggunakan format yang berbeda dari OpenAI.
> 3. Pastikan bucket Supabase Storage berstatus `public` agar URL foto dapat diakses tanpa autentikasi.
> 4. Global Variables `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL` harus sudah dibuat di Langflow.

#### Opsi B — Fallback Berbasis Deskripsi Teks (jika Vision tidak tersedia)

Jika komponen `ibm/granite-vision-3-3-2b` tidak tersedia di akun atau endpoint Vision tidak dapat diakses:

```
Chat Input
    │
    ▼
Prompt
    │  Template: langflow/prompts/verify.md (Versi B — text-only)
    │  Variabel: {input_json}   ← disambung dari Chat Input
    ▼
IBM watsonx.ai (LLM)
    │  Model: ibm/granite-4-h-small
    │  Temperature: 0.0
    ▼
Chat Output
```

> Fallback text-only **selalu** menghasilkan `ai_status = "needs_review"` karena tanpa foto tidak mungkin memverifikasi secara visual. Ini adalah perilaku fail-safe yang benar.

### Fallback

Jika flow gagal (timeout, HTTP error, Zod invalid, download foto gagal):
- Simpan ke tabel `verifications` dengan `ai_status = 'needs_review'` dan `ai_reason = 'Verifikasi AI gagal; memerlukan tinjauan manual.'`
- Ubah `complaints.status` menjadi `'needs_review'` (sesuai state machine §3 ARCHITECTURE.md: `in_progress → needs_review`)
- Operator mendapat notifikasi untuk tinjauan manual
- **Jangan biarkan status tetap `in_progress` jika upload foto sudah terjadi** — `needs_review` adalah state yang benar saat AI tidak bisa memverifikasi

### Test Cases Playground

**TC-1: Foto jelas menunjukkan perbaikan jalan**
- Input:
  ```json
  {
    "complaint_text": "Jalan berlubang di SDN 1 Bantaran",
    "category": "infrastruktur_jalan",
    "photo_after_url": "https://example.com/road-fixed.jpg",
    "photo_before_url": null
  }
  ```
- Output yang diharapkan: `{"ai_status": "ai_verified", "ai_reason": "Permukaan jalan tampak sudah diperbaiki..."}`

**TC-2: Foto tidak relevan / salah objek**
- Input: foto yang diunggah menunjukkan area yang berbeda dari yang dilaporkan
- Output yang diharapkan: `{"ai_status": "needs_review", "ai_reason": "Foto tidak menunjukkan area yang dilaporkan..."}`

**TC-3: Tidak ada foto sebelum — verifikasi dari deskripsi + foto sesudah**
- Input:
  ```json
  {
    "complaint_text": "Sampah di TPS Dringu sudah 4 hari tidak diangkut",
    "category": "pengelolaan_sampah",
    "photo_after_url": "https://example.com/clean-tps.jpg",
    "photo_before_url": null
  }
  ```
- Output yang diharapkan: AI menilai apakah foto menunjukkan area bersih konsisten dengan penyelesaian laporan sampah

---

## Flow 6 — `aduin-alert-summary`

### Tujuan

Menghasilkan ringkasan situasi lonjakan aduan dalam Bahasa Indonesia dan daftar rekomendasi OPD yang relevan. Dipanggil setelah deteksi z-score berhasil memicu alert baru.

Dipanggil dari: `POST /api/alert/check` — setelah baris baru diinsert ke tabel `alerts` dengan `summary_status = 'pending_retry'`.

### Format Input

Server Next.js memformat `complaint_samples` menjadi daftar bernomor **sebelum memanggil flow**, lalu mengirim hasilnya sebagai field `complaint_samples_text` (string) di dalam `input_value`. Array `complaint_samples` tidak dikirim ke Langflow.

```json
{
  "input_value": "{\"category_label\": \"...\", \"region_name\": \"...\", \"count_24h\": 6, \"mean_14d\": 1.2, \"z_score\": 2.8, \"complaint_samples_text\": \"1. ...\n2. ...\"}",
  "input_type": "chat",
  "output_type": "chat",
  "tweaks": {}
}
```

**Struktur JSON dalam `input_value`:**

| Field | Tipe | Keterangan |
|-------|------|-----------|
| `category_label` | `string` | Label tampilan kategori (contoh: `"Kesehatan & Sanitasi"`) |
| `region_name` | `string` | Nama desa/kecamatan tempat lonjakan terjadi |
| `count_24h` | `number` | Jumlah aduan dalam 24 jam terakhir |
| `mean_14d` | `number` | Rata-rata harian baseline 14 hari |
| `z_score` | `number` | Z-score yang memicu alert |
| `complaint_samples_text` | `string` | Daftar bernomor teks aduan (maks 5), sudah diformat oleh server |

**Cara server Next.js memformat `complaint_samples_text`:**

```typescript
// Di server Next.js, sebelum memanggil runFlow():
const complaint_samples_text = samples
  .slice(0, 5)
  .map((s, i) => `${i + 1}. ${s}`)
  .join("\n");
```

**Contoh:**

```json
{
  "category_label": "Kesehatan & Sanitasi",
  "region_name": "Sumberasih",
  "count_24h": 6,
  "mean_14d": 1.2,
  "z_score": 2.8,
  "complaint_samples_text": "1. Air PDAM keruh sejak 3 hari, anak saya diare\n2. Warga RT 03 banyak yang sakit perut\n3. Sudah 5 orang di kampung saya kena diare gara-gara air\n4. Air bersih dari PDAM sudah tidak layak minum\n5. Mohon segera ditangani diare yang melanda warga Sumberasih"
}
```

### Format Output

**Skema output:**

```typescript
{
  ai_summary: string;    // Ringkasan situasi 2-4 kalimat dalam Bahasa Indonesia
  opd_list: string[];    // Array short_name OPD yang direkomendasikan
}
```

**Contoh output:**

```json
{
  "ai_summary": "Terdapat lonjakan signifikan keluhan diare dan air keruh di Desa Sumberasih dalam 24 jam terakhir (6 aduan, z-score 2.8 vs baseline 1.2/hari). Keluhan warga mengindikasikan kemungkinan masalah kualitas air bersih PDAM yang berpotensi menjadi kejadian luar biasa.",
  "opd_list": ["Dinkes", "PDAM"]
}
```

**Zod schema:**

```typescript
export const alertSummaryOutputSchema = z.object({
  ai_summary: z.string().min(20),
  opd_list: z.array(z.enum(["DPU", "Dinkes", "DLH", "PDAM", "Disdik", "Satpol", "BPKAD"])).min(1),
});
export type AlertSummaryOutput = z.infer<typeof alertSummaryOutputSchema>;
```

> `opd_list` dipetakan ke `alerts.ai_recommendations` (tipe `jsonb` — array string `short_name`).

### Susunan Komponen Langflow

```
Chat Input
    │
    ▼
Prompt
    │  Template: lihat langflow/prompts/alert-summary.md
    │  Variabel: {input_json}   ← disambung dari Chat Input
    ▼
IBM watsonx.ai (LLM)
    │  Model: ibm/granite-4-h-small
    │  (alt: ibm/granite-3-3-8b-instruct)
    │  Temperature: 0.3  (sedikit lebih tinggi untuk ringkasan naratif)
    │  Max tokens: 400
    ▼
Chat Output
```

> `complaint_samples_text` sudah berupa string bernomor dari server — prompt langsung menyisipkannya dari `{input_json}` tanpa preprocessing tambahan di Langflow.

### Fallback

- Jika flow gagal → alert tetap tersimpan di tabel `alerts` dengan `summary_status = 'pending_retry'`
- Tombol "Coba Lagi" muncul di panel alert UI
- Alert tetap ditampilkan ke operator tanpa ringkasan AI (hanya data statistik: kategori, wilayah, count, z-score)
- Data demo: alert cadangan sudah di-seed langsung ke tabel `alerts` dengan `summary_status = 'done'`

### Test Cases Playground

**TC-1: Lonjakan diare — standar**
- Input: gunakan contoh di atas
- Output yang diharapkan: ringkasan 2-4 kalimat menyebut lonjakan, wilayah, dan kemungkinan penyebab; `opd_list` mencakup `"Dinkes"` dan `"PDAM"`

**TC-2: Lonjakan jalan rusak**
- Input:
  ```json
  {
    "category_label": "Infrastruktur Jalan",
    "region_name": "Bantaran",
    "count_24h": 4,
    "mean_14d": 0.8,
    "z_score": 2.3,
    "complaint_samples_text": "1. Jalan depan sekolah berlubang makin parah\n2. Jalan rusak di Bantaran sudah renggut 2 korban\n3. Tolong perbaiki jalan Bantaran yang sudah parah\n4. Motor saya rusak karena jalan berlubang di Bantaran"
  }
  ```
- Output yang diharapkan: ringkasan menyebut risiko keselamatan; `opd_list = ["DPU"]`

**TC-3: Lonjakan banjir dengan rekomendasi lintas OPD**
- Input:
  ```json
  {
    "category_label": "Banjir/Drainase",
    "region_name": "Dringu",
    "count_24h": 5,
    "mean_14d": 0.5,
    "z_score": 3.1,
    "complaint_samples_text": "1. Banjir setinggi lutut di RT 01 Dringu\n2. Drainase mampet tidak ditangani\n3. Rumah saya terendam sejak tadi pagi\n4. Banjir di Dringu semakin parah setiap hujan\n5. Saluran air depan rumah saya penuh sampah"
  }
  ```
- Output yang diharapkan: `opd_list` mencakup `"DPU"` (drainase) dan mungkin `"DLH"` (sampah penyebab)

---

## Catatan Implementasi untuk `client.ts`

### Signature Fungsi

```typescript
// src/lib/langflow/client.ts
export async function runFlow<T>(
  flowName: FlowName,         // keyof typeof FLOW_IDS
  inputValue: unknown,        // akan di-JSON.stringify
  schema: ZodSchema<T>,
  timeoutMs?: number          // default: LANGFLOW_TIMEOUT_MS
): Promise<T>
```

### Urutan Parsing Output

```typescript
const rawText = data.outputs[0].outputs[0].results.message.text;

// 1. Coba parse langsung
let parsed = tryParseJSON(rawText);

// 2. Strip markdown fence
if (!parsed) {
  const stripped = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  parsed = tryParseJSON(stripped);
}

// 3. Cari substring JSON pertama
if (!parsed) {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (match) parsed = tryParseJSON(match[0]);
}

// 4. Lempar error → fallback
if (!parsed) throw new LangflowParseError(rawText);
```

### Flow ID Mapping

```typescript
// src/lib/langflow/flows.ts
export const FLOW_IDS = {
  clarify:      process.env.LANGFLOW_FLOW_CLARIFY_ID!,
  triage:       process.env.LANGFLOW_FLOW_TRIAGE_ID!,
  embed:        process.env.LANGFLOW_FLOW_EMBED_ID!,
  opdAgent:     process.env.LANGFLOW_FLOW_OPD_AGENT_ID!,
  verify:       process.env.LANGFLOW_FLOW_VERIFY_ID!,
  alertSummary: process.env.LANGFLOW_FLOW_ALERT_SUMMARY_ID!,
} as const;

export type FlowName = keyof typeof FLOW_IDS;
```
