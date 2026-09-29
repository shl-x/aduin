# Plan: Perbarui Dokumen untuk watsonx.ai Region Tokyo (jp-tok)

## Ringkasan

Model Granite untuk teks dan vision **tidak tersedia** di region Tokyo (jp-tok) di akun watsonx.ai yang digunakan. Semua referensi ke model-model tersebut harus diganti di seluruh dokumen dan kode prompt Langflow. Lingkup perubahan terbatas pada:

- `docs/ARCHITECTURE.md`
- `docs/LANGFLOW_FLOWS.md`
- `docs/TASKS.md`
- `langflow/prompts/` (semua 6 file)
- `langflow/README.md`

**Tidak ada perubahan ke kode Next.js** — model ID tidak di-hardcode di kode Next.js (hanya dikonfigurasi di dalam flow Langflow), dan Zod schema untuk embed akan diperbarui sebagai bagian dari pembaruan `LANGFLOW_FLOWS.md` (di file docs, bukan di src/).

---

## Fakta Referensi

| Peran | Model Lama | Model Baru |
|-------|-----------|-----------|
| LLM default (clarify, triage, opd-agent, alert-summary) | `ibm/granite-4-h-small` | `mistralai/mistral-small-3-1-24b-instruct-2503` |
| Alternatif LLM | `ibm/granite-3-3-8b-instruct` | `meta-llama/llama-3-3-70b-instruct` |
| Vision (aduin-verify) | `ibm/granite-vision-3-3-2b` | `mistralai/mistral-small-3-1-24b-instruct-2503` (mendukung input gambar) |
| Embedding (aduin-embed) | `intfloat/multilingual-e5-large` (1024 dim) | `ibm/granite-embedding-278m-multilingual` (768 dim) |

**Catatan Langflow:** Versi 1.12.2. Jangan gunakan fitur "Model Providers" (selalu mencoba validasi dengan granite-4-h-small). Pakai komponen IBM watsonx.ai dari bundle IBM secara langsung.

**Endpoint:** `https://jp-tok.ml.cloud.ibm.com`

**Awalan teks:** Hapus konvensi `passage: ` — itu khusus model e5, tidak relevan untuk `granite-embedding-278m-multilingual`.

---

## Sub-Tasks

### ST-1 — Perbarui `docs/LANGFLOW_FLOWS.md`

**Intent:** Ganti semua referensi model lama dengan model baru, perbarui kode Custom Component Python untuk `aduin-embed` dan `aduin-verify`, perbarui Zod schema embed ke `length(768)`, dan hapus konvensi awalan `passage: `.

**Expected Outcomes:**
- Tabel "Catatan Model Granite" (sekarang "Catatan Model AI") menampilkan model baru.
- Bagian Flow 3 (`aduin-embed`): dimensi 768, model `ibm/granite-embedding-278m-multilingual`, tidak ada awalan `passage: `, Zod schema `length(768)`, kode Python diperbarui.
- Bagian Flow 5 (`aduin-verify`) Opsi A: model diubah ke `mistralai/mistral-small-3-1-24b-instruct-2503`, deskripsi komponen diperbarui, `model_id` di payload Python diperbarui, Opsi B juga diperbarui (hapus referensi granite).
- Semua diagram susunan komponen flow 1, 2, 4, 6 menampilkan model baru dan alternatif baru.
- Tidak ada sisa referensi ke `granite-4-h-small`, `granite-3-3-8b-instruct`, `granite-vision-3-3-2b`, `multilingual-e5-large`.
- Catatan tambahan: model IBM Granite yang digunakan di stack adalah `granite-embedding-278m-multilingual`.

**Todo List:**
- [ ] Ganti tabel model di bagian "Catatan Model Granite" (ganti judul dan semua 4 baris).
- [ ] Perbarui diagram komponen Flow 1 (`aduin-clarify`): ganti model + alt.
- [ ] Perbarui diagram komponen Flow 2 (`aduin-triage`): ganti model + alt.
- [ ] Perbarui bagian tujuan Flow 3: ganti model + dimensi.
- [ ] Perbarui Format Output Flow 3: dimensi 1024 → 768, model_version.
- [ ] Perbarui Zod schema Flow 3: `length(1024)` → `length(768)`.
- [ ] Perbarui kode Python `AduinEmbedder`: hapus langkah awalan `passage: `, ganti model ID, perbarui komentar deskripsi.
- [ ] Perbarui catatan verifikasi setelah kode Python embed.
- [ ] Perbarui test cases Flow 3: dimensi 1024 → 768 dan model_version.
- [ ] Perbarui komentar Opsi B Flow 5 (header file prompts): hapus referensi granite-vision.
- [ ] Perbarui diagram Opsi A Flow 5 (langkah 5): ganti model vision.
- [ ] Perbarui deskripsi kelas Python `AduinVerifier`: ganti granite-vision.
- [ ] Perbarui `model_id` di payload Python `AduinVerifier` (baris 1124).
- [ ] Perbarui diagram Opsi B Flow 5: ganti model LLM.
- [ ] Perbarui diagram komponen Flow 4 (`aduin-opd-agent`): ganti model + alt.
- [ ] Perbarui diagram komponen Flow 6 (`aduin-alert-summary`): ganti model + alt.
- [ ] Tambahkan catatan di bagian atas: model IBM Granite yang digunakan = `granite-embedding-278m-multilingual`.

**Relevant Context:**
- `docs/LANGFLOW_FLOWS.md` baris 17–23 (tabel model)
- baris 191–198 (diagram clarify)
- baris 332–339 (diagram triage)
- baris 380–441 (embed: tujuan, output, schema)
- baris 461–570 (kode Python AduinEmbedder)
- baris 577–592 (test cases embed)
- baris 930–1177 (Opsi A verify + kode Python AduinVerifier)
- baris 1178–1197 (Opsi B verify)
- baris 791–798 (diagram opd-agent)
- baris 1336–1343 (diagram alert-summary)

**Status:** [ ] pending

---

### ST-2 — Perbarui `docs/ARCHITECTURE.md`

**Intent:** Perbarui referensi model embedding di tabel `complaint_embeddings`, catatan rekomendasi model, environment variable `EMBEDDING_DIMENSION`, dan label node Watsonx di diagram arsitektur.

**Expected Outcomes:**
- Baris `model_version` di tabel §4.4 menyebut `granite-embedding-278m-multilingual` sebagai contoh.
- Blok rekomendasi model di §4.4 diperbarui: hapus `multilingual-e5-large` dan `paraphrase-multilingual-mpnet-base-v2`; sebut `ibm/granite-embedding-278m-multilingual` (768 dim) sebagai model yang digunakan.
- `EMBEDDING_DIMENSION=1024` → `EMBEDDING_DIMENSION=768` di §9 (blok env).
- Komentar di bawah `EMBEDDING_DIMENSION` diperbarui.
- Node `WX` di diagram arsitektur: label "Granite LLM / Embedding Model" → "LLM / Embedding Model" (karena LLM bukan Granite lagi).

**Todo List:**
- [ ] Perbarui contoh `model_version` di tabel §4.4 (baris 246).
- [ ] Perbarui blok rekomendasi model di bawah tabel §4.4 (baris 251).
- [ ] Perbarui `EMBEDDING_DIMENSION=1024` → `768` di §9 (baris 787).
- [ ] Perbarui komentar di bawah `EMBEDDING_DIMENSION` di §9 (baris 788–789).
- [ ] Perbarui label node `WX` di diagram mermaid §1 (baris 39).

**Relevant Context:**
- `docs/ARCHITECTURE.md` baris 39, 245–252, 787–790

**Status:** [ ] pending

---

### ST-3 — Perbarui `docs/TASKS.md`

**Intent:** Ganti semua referensi model lama di checklist milestone (M2, M3, M4, M5, M6) dengan model baru yang tersedia di Tokyo.

**Expected Outcomes:**
- M2 Langflow: instruksi flow clarify dan triage menyebut `mistralai/mistral-small-3-1-24b-instruct-2503`.
- M3 Langflow: instruksi flow embed menyebut `ibm/granite-embedding-278m-multilingual` dan dimensi 768 (bukan `multilingual-e5-large` dan 1024).
- M3 Kode: validasi schema menyebut 768 angka float.
- M3 DoD: cek tabel `complaint_embeddings` berisi array 768 angka.
- M4 Langflow: instruksi flow opd-agent menyebut `mistralai/mistral-small-3-1-24b-instruct-2503`.
- M5 Langflow: instruksi flow verify menyebut model baru (Opsi A: `mistralai/mistral-small-3-1-24b-instruct-2503`; hapus referensi `granite-vision-3-3-2b`).
- M6 Langflow: instruksi flow alert-summary menyebut `mistralai/mistral-small-3-1-24b-instruct-2503`.

**Todo List:**
- [ ] Perbarui checklist M2: model clarify (baris 87) dan triage (baris 94).
- [ ] Perbarui checklist M3 Langflow (baris 129–130): model embed + dimensi.
- [ ] Perbarui checklist M3 Kode (baris 136): dimensi 768.
- [ ] Perbarui M3 DoD (baris 147): array 768 angka.
- [ ] Perbarui checklist M4 Langflow (baris 161): model opd-agent.
- [ ] Perbarui checklist M5 Langflow (baris 193): model verify.
- [ ] Perbarui checklist M6 Langflow (baris 227): model alert-summary.

**Relevant Context:**
- `docs/TASKS.md` baris 87, 94, 129–130, 136, 147, 161, 193, 227

**Status:** [ ] pending

---

### ST-4 — Perbarui `langflow/prompts/`

**Intent:** Perbarui file konfigurasi prompt Langflow untuk mencerminkan model baru di semua flow yang terdampak.

**Expected Outcomes:**
- `langflow/prompts/embed.md`: model diganti ke `ibm/granite-embedding-278m-multilingual`, dimensi 768, bagian "Konvensi Awalan Teks" dihapus (tidak relevan untuk model Granite), format output diperbarui ke 768 nilai, catatan penting diperbarui.
- `langflow/prompts/verify.md`: Opsi A diperbarui — referensi `granite-vision-3-3-2b` diganti ke `mistralai/mistral-small-3-1-24b-instruct-2503`; Opsi B diperbarui — hapus referensi granite LLM.

**Todo List:**
- [ ] Perbarui `langflow/prompts/embed.md`: ganti model ID, dimensi 1024→768, hapus bagian "Konvensi Awalan Teks", perbarui format output JSON.
- [ ] Perbarui `langflow/prompts/verify.md`: ganti referensi model di bagian Opsi A, perbarui tabel konfigurasi.

**Relevant Context:**
- `langflow/prompts/embed.md` (seluruh file, terutama baris 28–68)
- `langflow/prompts/verify.md` (terutama baris 17–25)

**Status:** [ ] pending

---

### ST-5 — Perbarui `langflow/README.md`

**Intent:** Perbarui contoh URL endpoint watsonx.ai ke Tokyo, perbarui catatan troubleshooting embedding, dan tambahkan catatan penting tentang cara menggunakan komponen IBM watsonx.ai (bukan komponen generik, dan jangan gunakan fitur Model Providers).

**Expected Outcomes:**
- Tabel Global Variables: contoh `WATSONX_URL` diperbarui ke `https://jp-tok.ml.cloud.ibm.com`.
- Komentar "Cara mendapatkan nilai" untuk URL diperbarui menambahkan Tokyo.
- Baris troubleshooting "Embedding dimensi tidak cocok": model diperbarui ke `granite-embedding-278m-multilingual` (768 dim).
- Tambahan bagian atau catatan baru: **gunakan komponen IBM watsonx.ai dari bundle IBM** (bukan komponen Language Model generik), dan **jangan gunakan fitur Model Providers** (validasinya selalu mencoba granite-4-h-small yang tidak tersedia di Tokyo).

**Todo List:**
- [ ] Perbarui contoh `WATSONX_URL` di tabel Global Variables (baris 94).
- [ ] Tambahkan Tokyo ke daftar contoh URL di komentar "Cara mendapatkan nilai" (baris 99).
- [ ] Perbarui baris troubleshooting embedding (baris 244).
- [ ] Tambahkan bagian "Catatan Penting: Komponen watsonx.ai" sebelum atau sesudah bagian Global Variables, berisi peringatan tentang bundle IBM dan larangan Model Providers.

**Relevant Context:**
- `langflow/README.md` baris 94, 99, 244

**Status:** [ ] pending

---

## Urutan Eksekusi yang Direkomendasikan

ST-1 → ST-2 → ST-3 → ST-4 → ST-5

ST-1 adalah yang paling besar (Custom Component Python lengkap), lakukan dulu agar ST-3 dan ST-4 dapat menyinkronkan dimensi dan model ID yang sudah ditetapkan.
