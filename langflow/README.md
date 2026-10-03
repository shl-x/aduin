# Langflow — Panduan Setup Aduin

Dokumen ini menjelaskan cara menjalankan Langflow secara lokal, menghubungkannya ke
IBM watsonx.ai, membuat API key, mengambil Flow ID untuk `.env.local`, dan mengekspor
flow ke direktori `langflow/flows/`.

---

## Prasyarat

| Kebutuhan | Versi Minimum | Keterangan |
|-----------|--------------|-----------|
| Python | 3.10+ | Langflow berjalan di Python |
| `pip` atau `uv` | — | Package manager Python |
| Port 7860 | — | Port default Langflow (dapat diubah) |
| Akun IBM watsonx.ai | — | Untuk API key dan Project ID |

> **Catatan Docker:** Langflow juga tersedia sebagai Docker image. Lihat bagian
> [Menjalankan dengan Docker](#menjalankan-dengan-docker) di bawah.

---

## Menjalankan Langflow

### Opsi 1 — Instalasi via pip

```bash
# Buat virtual environment (direkomendasikan)
python -m venv .venv
source .venv/bin/activate          # macOS/Linux
# .venv\Scripts\activate           # Windows PowerShell

# Install Langflow
pip install langflow

# Jalankan
langflow run
```

Langflow akan tersedia di: **http://localhost:7860**

### Opsi 2 — Instalasi via uv (lebih cepat)

```bash
uv pip install langflow
langflow run
```

### Menjalankan dengan Docker

```bash
docker run -p 7860:7860 langflowai/langflow:latest
```

Untuk menyimpan data (flow, variabel) secara persisten, mount volume:

```bash
docker run -p 7860:7860 \
  -v $(pwd)/langflow-data:/app/langflow \
  langflowai/langflow:latest
```

### Mengubah Port

```bash
langflow run --port 7861
```

Jika port diubah, perbarui `LANGFLOW_BASE_URL` di `.env.local`:

```env
LANGFLOW_BASE_URL=http://localhost:7861
```

---

## Membuat Global Variables watsonx.ai

Global Variables digunakan agar credential IBM watsonx.ai tidak tersimpan di dalam
file JSON flow (yang di-commit ke repo). Setiap komponen IBM watsonx.ai di Langflow
akan merujuk ke Global Variables ini.

### Langkah-langkah

1. Buka Langflow di browser: **http://localhost:7860**
2. Klik ikon **Settings** (⚙) di sidebar kiri.
3. Pilih **Global Variables**.
4. Klik **+ Add Variable** untuk setiap variabel berikut:

| Nama Variabel | Nilai | Tipe |
|--------------|-------|------|
| `WATSONX_API_KEY` | API key IBM watsonx.ai Anda | `Credential` |
| `WATSONX_PROJECT_ID` | Project ID dari IBM watsonx.ai | `Generic` |
| `WATSONX_URL` | URL endpoint watsonx.ai — Aduin memakai region Tokyo: `https://jp-tok.ml.cloud.ibm.com` | `Generic` |

> **Cara mendapatkan nilai:**
> - **API key:** Masuk ke [IBM Cloud](https://cloud.ibm.com) → Manage → Access (IAM) → API keys → Create.
> - **Project ID:** Buka [watsonx.ai](https://dataplatform.cloud.ibm.com) → pilih project → Settings → General → Project ID.
> - **URL:** Bergantung region. Contoh: `https://us-south.ml.cloud.ibm.com` (Dallas), `https://eu-de.ml.cloud.ibm.com` (Frankfurt).

5. Setelah Global Variables dibuat, buka komponen **IBM watsonx.ai** di setiap flow
   dan pilih Global Variable yang sesuai di field credential/API key.

---

## Membuat API Key Langflow

API key Langflow dibutuhkan oleh Next.js untuk memanggil endpoint Langflow dari server.

### Langkah-langkah

1. Buka Langflow di browser: **http://localhost:7860**
2. Klik ikon **Settings** (⚙) di sidebar kiri.
3. Pilih **API Keys**.
4. Klik **+ Add New** → beri nama (contoh: `aduin-dev`).
5. Salin API key yang muncul — **key hanya ditampilkan sekali**.
6. Tambahkan ke file `.env.local` di root proyek Next.js:

```env
LANGFLOW_API_KEY=<api-key-yang-disalin>
```

> API key ini digunakan sebagai header `x-api-key` di setiap request ke Langflow.
> **Jangan commit `.env.local` ke repo.**

---

## Mengambil Flow ID untuk `.env.local`

Setiap flow Langflow memiliki UUID unik yang harus diisi ke `.env.local`.

### Langkah-langkah

1. Buat atau buka flow di Langflow (misal: `aduin-triage`).
2. Perhatikan URL browser:
   ```
   http://localhost:7860/flow/<flow-uuid>
   ```
3. Salin UUID dari URL tersebut.
4. Tambahkan ke `.env.local` dengan nama variabel yang sesuai:

| Flow | Variabel di `.env.local` |
|------|--------------------------|
| `aduin-clarify` | `LANGFLOW_FLOW_CLARIFY_ID` |
| `aduin-triage` | `LANGFLOW_FLOW_TRIAGE_ID` |
| `aduin-embed` | `LANGFLOW_FLOW_EMBED_ID` |
| `aduin-opd-agent` | `LANGFLOW_FLOW_OPD_AGENT_ID` |
| `aduin-verify` | `LANGFLOW_FLOW_VERIFY_ID` |
| `aduin-alert-summary` | `LANGFLOW_FLOW_ALERT_SUMMARY_ID` |

**Contoh `.env.local` setelah semua flow dibuat:**

```env
LANGFLOW_BASE_URL=http://localhost:7860
LANGFLOW_API_KEY=sk-...

LANGFLOW_FLOW_CLARIFY_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
LANGFLOW_FLOW_TRIAGE_ID=b2c3d4e5-f6a7-8901-bcde-f12345678901
LANGFLOW_FLOW_EMBED_ID=c3d4e5f6-a7b8-9012-cdef-123456789012
LANGFLOW_FLOW_OPD_AGENT_ID=d4e5f6a7-b8c9-0123-defa-234567890123
LANGFLOW_FLOW_VERIFY_ID=e5f6a7b8-c9d0-1234-efab-345678901234
LANGFLOW_FLOW_ALERT_SUMMARY_ID=f6a7b8c9-d0e1-2345-fabc-456789012345
```

### Alternatif: Salin dari halaman API flow

1. Buka flow di Langflow.
2. Klik tombol **API** (ikon `</>`) di toolbar atas.
3. Flow ID terlihat di contoh URL: `POST /api/v1/run/<flow-id>`.

---

## Export Flow ke `langflow/flows/`

File di direktori `langflow/flows/` adalah **export JSON dari Langflow** yang di-commit
ke repo untuk keperluan version control dan reproduksi. **Jangan edit file-file ini secara manual.**

### Langkah-langkah Export

1. Buka flow yang ingin diexport di Langflow.
2. Klik menu **⋮** (tiga titik) di pojok kanan atas → pilih **Export**.
3. Simpan file JSON dengan nama yang sesuai ke direktori `langflow/flows/`:

| Flow | Nama File |
|------|-----------|
| `aduin-clarify` | `langflow/flows/aduin-clarify.json` |
| `aduin-triage` | `langflow/flows/aduin-triage.json` |
| `aduin-embed` | `langflow/flows/aduin-embed.json` |
| `aduin-opd-agent` | `langflow/flows/aduin-opd-agent.json` |
| `aduin-verify` | `langflow/flows/aduin-verify.json` |
| `aduin-alert-summary` | `langflow/flows/aduin-alert-summary.json` |

4. Commit file JSON ke repo.

### Import Flow dari Repo

Untuk mengembalikan flow dari file JSON yang sudah di-commit:

1. Buka Langflow.
2. Klik **+ New Flow** → pilih **Import**.
3. Pilih file JSON dari `langflow/flows/`.
4. Setelah diimport, pastikan Flow ID di URL masih sama dengan yang ada di `.env.local`.
   Jika berbeda (Langflow membuat UUID baru saat import), perbarui `.env.local`.

> **Catatan:** Global Variables (WATSONX_API_KEY, dll.) tidak ikut ter-export di file JSON
> karena bertipe `Credential`. Setelah import, hubungkan kembali Global Variables ke
> komponen IBM watsonx.ai di setiap flow.

---

## Verifikasi Setup

Setelah semua langkah di atas, jalankan pengecekan cepat:

```bash
# Cek Langflow berjalan
curl http://localhost:7860/health

# Cek flow bisa dipanggil (ganti <flow-id> dengan ID aduin-triage)
curl -X POST "http://localhost:7860/api/v1/run/<flow-id>" \
  -H "Content-Type: application/json" \
  -H "x-api-key: <LANGFLOW_API_KEY>" \
  -d '{
    "input_value": "{\"complaint_text\": \"Jalan rusak di Bantaran\", \"region_name\": \"Bantaran\", \"photo_url\": null}",
    "input_type": "chat",
    "output_type": "chat",
    "tweaks": {}
  }'
```

Respons yang berhasil akan berisi JSON triage di field:
`outputs[0].outputs[0].results.message.text`

---

## Peringatan: Kurung Kurawal di Template Prompt

Komponen **Prompt Template** Langflow memperlakukan `{nama}` sebagai variabel. Contoh JSON
literal di dalam prompt harus di-escape menjadi `{{` dan `}}`, **dan setiap `{{` harus punya
pasangan `}}`**. Kurung kurawal ganda yang tidak berpasangan — misalnya kalimat penutup
"Awali jawaban dengan karakter {{" — membuat template ditolak dengan error **"unclosed tag"**.

Karena itu, instruksi penutup prompt sebaiknya ditulis **dengan kata-kata**, bukan simbol:

```
Karakter pertama jawabanmu harus kurung kurawal buka, dan karakter terakhirnya harus kurung kurawal tutup.
```

Contoh penerapannya ada di `langflow/prompts/alert-summary.md`.

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| `401 Unauthorized` saat memanggil flow | Cek `LANGFLOW_API_KEY` di `.env.local` sudah benar |
| `404 Not Found` untuk flow ID | Pastikan UUID di `.env.local` cocok dengan URL flow di Langflow |
| Model watsonx.ai tidak muncul di dropdown | Cek `WATSONX_API_KEY` dan `WATSONX_PROJECT_ID` di Global Variables |
| Output bukan JSON valid | Cek prompt — model mungkin menambahkan teks di luar JSON; naikkan instruksi di prompt |
| Embedding dimensi tidak cocok | Pastikan model di komponen IBM watsonx.ai Embeddings adalah `ibm/granite-embedding-278m-multilingual` (768 dim), sesuai kolom `vector(768)` dan `EMBEDDING_DIMENSION` |
| Flow timeout | Naikkan `LANGFLOW_ALERT_TIMEOUT_MS` di `.env.local`; cek koneksi ke watsonx.ai |
