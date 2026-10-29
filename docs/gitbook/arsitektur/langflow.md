---
description: Enam flow Langflow yang menjalankan semua AI di Aduin.
icon: robot
---

# Flow AI di Langflow

Semua flow menerima satu string JSON lewat **Chat Input** dan mengembalikan JSON lewat **Chat Output**. Endpoint watsonx.ai: `https://jp-tok.ml.cloud.ibm.com`.

| Flow | Fungsi | Model | Param |
| --- | --- | --- | --- |
| `aduin-clarify` | Menilai kelengkapan aduan; kalau kurang, membuat satu pertanyaan balik | `mistralai/mistral-small-3-1-24b-instruct-2503` | temp 0.1, 1000 token |
| `aduin-triage` | Kategori, OPD, urgensi, dampak, jalur, alasan | `mistralai/mistral-small-3-1-24b-instruct-2503` | temp 0, 400 token |
| `aduin-embed` | Embedding teks aduan untuk clustering | `ibm/granite-embedding-278m-multilingual` (768 dimensi) | — |
| `aduin-opd-agent` | Rencana sub-tugas lintas OPD dan ketergantungannya | `mistralai/mistral-small-3-1-24b-instruct-2503` | temp 0.1, 800 token |
| `aduin-verify` | Membandingkan foto sebelum/sesudah | `mistralai/mistral-small-3-1-24b-instruct-2503` (vision) | temp 0, 300 token |
| `aduin-alert-summary` | Ringkasan lonjakan dan rekomendasi OPD | `mistralai/mistral-small-3-1-24b-instruct-2503` | temp 0.3, 400 token |

{% hint style="info" %}
**Kenapa Mistral, bukan Granite?** Model Granite untuk teks dan vision tidak tersedia di region Tokyo pada akun watsonx.ai yang dipakai. Embedding tetap memakai Granite multilingual karena aduan warga bercampur bahasa Indonesia, Jawa, dan Madura.
{% endhint %}

## Contoh kontrak: `aduin-triage`

{% tabs %}
{% tab title="Input" %}
```json
{
  "complaint_text": "Jalan di depan SD Negeri 1 Bantaran berlubang besar, sudah seminggu belum diperbaiki, berbahaya untuk anak sekolah.",
  "region_name": "Bantaran",
  "photo_url": null
}
```
{% endtab %}

{% tab title="Output" %}
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
{% endtab %}

{% tab title="Skema Zod" %}
```typescript
export const triageOutputSchema = z.object({
  category: z.enum(CATEGORY_SLUGS),
  opd_short_name: z.enum(OPD_SHORT_NAMES),
  urgency: z.number().int().min(1).max(5),
  impact: z.enum(["rendah", "sedang", "tinggi"]),
  handling_path: z.enum(["quick_fix", "bertahap", "butuh_data"]),
  reason: z.string().min(10),
});
```
{% endtab %}
{% endtabs %}

## Dua custom component Python

* **Aduin Embed JSON**: mengambil `complaint_text`, memanggil handle Embeddings, dan mengembalikan `{"embedding": [...], "model_version": "..."}`.
* **Aduin Verify Vision**: mengunduh foto dari bucket `aduan-photos`, mengubahnya ke base64, lalu memanggil `ModelInference.chat` milik `ibm_watsonx_ai` dengan pesan multimodal. Dari jawaban model, hanya blok `{...}` yang diambil.

Kontrak lengkap semua flow, prompt, dan test case Playground ada di `docs/LANGFLOW_FLOWS.md` di repositori.
