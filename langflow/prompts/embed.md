# Prompt: aduin-embed

> Flow ini **tidak memakai komponen Prompt maupun LLM**, sehingga tidak ada system prompt
> dan tidak ada variabel `{input_json}`. File ini hanya mencatat konfigurasi flow.
> Kode lengkap custom component dan cara menyambungkannya ada di
> `docs/LANGFLOW_FLOWS.md` §Flow 3.

---

## Susunan Flow

| Komponen | Keterangan |
|---------|-----------|
| Chat Input | Menerima JSON string `{"complaint_text": "..."}` |
| IBM watsonx.ai Embeddings | Komponen bawaan bundle IBM; output handle **Embedding Model** |
| Aduin Embed JSON (Custom Component) | Parse `complaint_text`, panggil `embedding_model.embed_query(text)`, kembalikan JSON |
| Chat Output | Meneruskan output dari Aduin Embed JSON |

---

## Model watsonx.ai Embeddings

| Pengaturan | Nilai |
|-----------|-------|
| Model | `ibm/granite-embedding-278m-multilingual` |
| Dimensi output | 768 |
| Endpoint | `https://jp-tok.ml.cloud.ibm.com` |
| Kredensial | Global Variables `WATSONX_API_KEY`, `WATSONX_PROJECT_ID` |

Teks dikirim apa adanya — model ini tidak memerlukan awalan `query:`/`passage:`.

---

## Format Output yang Diharapkan

```json
{
  "embedding": [0.0234, -0.1823, 0.0541, "... 765 nilai lainnya ..."],
  "model_version": "ibm/granite-embedding-278m-multilingual"
}
```

Divalidasi oleh `embedOutputSchema` di `src/lib/langflow/schemas.ts`: `embedding` harus array
number dengan panjang tepat 768.

---

## Catatan

- Dimensi 768 harus konsisten dengan kolom `complaint_embeddings.embedding vector(768)`,
  `embedOutputSchema`, dan `EMBEDDING_DIMENSION` di `.env.local`. Jika model diganti, ketiganya
  harus diubah bersama dan semua aduan di-embed ulang (`supabase/seed/embed-seed.ts`).
- Model ID tidak di-hardcode di kode Next.js — hanya dikonfigurasi di dalam flow Langflow.
