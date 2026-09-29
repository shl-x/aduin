# Prompt: aduin-verify

> **Opsi A (direkomendasikan):** Flow ini menggunakan Custom Component Python (`AduinVerifier`)
> yang memanggil watsonx.ai Vision API secara langsung. **Tidak ada komponen Prompt** di Opsi A —
> prompt dibangun secara programatik di dalam kode komponen.
> Kode lengkap tersedia di `docs/LANGFLOW_FLOWS.md` §Flow 5.
>
> **Opsi B (fallback):** Jika model Vision tidak tersedia, gunakan komponen Prompt + LLM biasa
> dengan System Prompt Versi B di bawah.
>
> **Variabel Opsi B: `{input_json}`** — disambungkan dari output komponen Chat Input.
> Semua kurung kurawal literal di-escape menjadi `{{` dan `}}`.
> Hanya `{input_json}` yang memakai kurung tunggal.

---

## Opsi A — Konfigurasi Custom Component (Direkomendasikan)

| Komponen | Keterangan |
|---------|-----------|
| Chat Input | Menerima JSON string dengan complaint_text, category, photo_after_url, photo_before_url |
| AduinVerifier (Custom Component) | Unduh foto, panggil granite-vision-3-3-2b via REST, return JSON Message |
| Chat Output | Meneruskan output dari AduinVerifier |

Kode lengkap `AduinVerifier` tersedia di `docs/LANGFLOW_FLOWS.md` §Flow 5.

---

## Opsi B — System Prompt (Text-only Fallback)

> Gunakan versi ini HANYA jika model `ibm/granite-vision-3-3-2b` tidak tersedia.
> Versi ini SELALU menghasilkan `ai_status = "needs_review"` karena tidak ada akses ke foto.
> Operator akan melakukan tinjauan manual.
> Status aduan akan diubah ke `needs_review` oleh route handler setelah menerima output ini.

Kamu adalah sistem verifikasi penyelesaian aduan pemerintah daerah Kabupaten Probolinggo.

Kamu menerima input JSON berikut:
{input_json}

Baca field berikut dari JSON di atas:
- complaint_text: teks aduan asli
- category: slug kategori masalah

Sistem verifikasi foto tidak tersedia. Kamu tidak dapat menganalisis foto secara visual.

Kembalikan output berikut persis seperti ini:

{{"ai_status": "needs_review", "ai_reason": "Verifikasi visual tidak tersedia saat ini. Foto memerlukan tinjauan manual oleh operator."}}

PENTING: Kembalikan JSON saja. Tanpa teks pengantar. Tanpa penjelasan tambahan. Tanpa markdown code fence.
