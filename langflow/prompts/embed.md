# Prompt: aduin-embed

> Flow ini **tidak menggunakan komponen Prompt + LLM**. Semua logika dijalankan
> oleh satu Custom Component Python (`AduinEmbedder`) yang langsung menerima
> output dari Chat Input.
>
> File ini berisi catatan konfigurasi dan kode Custom Component yang sudah
> tersedia di `docs/LANGFLOW_FLOWS.md` §Flow 3.
>
> **Tidak ada variabel prompt** karena tidak ada komponen Prompt di flow ini.
> Custom Component membaca `{input_json}` secara programatik dari parameter `chat_input`.

---

## Konfigurasi Flow

| Komponen | Keterangan |
|---------|-----------|
| Chat Input | Menerima JSON string `{"complaint_text": "..."}` |
| AduinEmbedder (Custom Component) | Parse JSON, prepend `"passage: "`, panggil watsonx.ai Embeddings, return JSON Message |
| Chat Output | Meneruskan output dari AduinEmbedder |

---

## Model watsonx.ai Embeddings

| Pengaturan | Nilai |
|-----------|-------|
| Model | `intfloat/multilingual-e5-large` |
| Dimensi output | 1024 |
| Credentials | Global Variable `WATSONX_API_KEY`, `WATSONX_PROJECT_ID`, `WATSONX_URL` |

---

## Konvensi Awalan Teks (Wajib)

Model `multilingual-e5-large` menggunakan dua jenis awalan:
- **`passage: `** — untuk teks yang akan diindeks/dicari (digunakan di sini).
- **`query: `** — untuk teks pencarian/query (tidak digunakan di flow ini).

Awalan `passage: ` ditambahkan oleh `AduinEmbedder` secara programatik, bukan di komponen Prompt.

---

## Format Output yang Diharapkan

```json
{
  "embedding": [0.0234, -0.1823, 0.0541, "... 1021 nilai lainnya ..."],
  "model_version": "multilingual-e5-large"
}
```

Output ini divalidasi dengan Zod schema di `src/lib/langflow/schemas.ts`:
- `embedding`: array number dengan panjang tepat 1024.
- `model_version`: string (nilai tetap `"multilingual-e5-large"`).

---

## Catatan Penting

- Kode lengkap `AduinEmbedder` tersedia di `docs/LANGFLOW_FLOWS.md` §Flow 3.
- Periksa nama kelas import (`WatsonxEmbeddings` vs `IBMWatsonxAIEmbeddings`) dengan environment Langflow yang terpasang.
- Jika model diganti (misalnya ke dimensi 768), update `EMBEDDING_DIMENSION` di `.env.local`,
  jalankan migrasi DB untuk mengubah dimensi kolom `vector()`, dan re-embed semua aduan.
- Model ID tidak di-hardcode di kode Next.js. Hanya dikonfigurasi di dalam Custom Component.
- Cek ketersediaan model `intfloat/multilingual-e5-large` di akun watsonx.ai Anda.
