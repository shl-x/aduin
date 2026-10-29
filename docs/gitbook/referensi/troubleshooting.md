---
description: Masalah yang pernah ditemui dan cara mengatasinya.
icon: screwdriver-wrench
---

# Troubleshooting

<details>

<summary>Script seed gagal: URL Supabase atau key kosong</summary>

`npx tsx` tidak membaca `.env.local` secara otomatis. Selalu jalankan dengan:

```bash
npx tsx --env-file=.env.local <script>
```

</details>

<details>

<summary>Dibuka lewat alamat IP, halaman tampil tapi tombol tidak berfungsi</summary>

Server dev Next.js memblokir aset `/_next/*` dari origin selain `localhost` (*Blocked cross-origin request … allowedDevOrigins*). Buka lewat `http://localhost:3000`, tambahkan `allowedDevOrigins` di `next.config.ts`, atau pakai `npm run build && npm run start`.

</details>

<details>

<summary>Model Granite tidak muncul atau gagal dipanggil</summary>

Model Granite teks dan vision tidak tersedia di region Tokyo pada akun yang dipakai. Gunakan `mistralai/mistral-small-3-1-24b-instruct-2503` untuk LLM dan vision, serta `ibm/granite-embedding-278m-multilingual` untuk embedding. Pakai komponen IBM watsonx.ai langsung, jangan *Model Providers* atau komponen *Agent*.

</details>

<details>

<summary>Komponen Prompt Langflow menolak template: "unclosed tag"</summary>

`{nama}` dianggap variabel. Kurung kurawal literal harus ditulis `{{ }}` dan setiap `{{` harus berpasangan dengan `}}`. Tulis instruksi seperti "awali dengan kurung kurawal buka" dengan kata-kata.

</details>

<details>

<summary>Login akun demo gagal padahal seed sukses</summary>

Ada karakter `$` di `DEMO_SEED_PASSWORD`. Next.js mengekspansinya sebagai variabel, sedangkan `tsx --env-file` membacanya apa adanya. Pakai password tanpa `$`, lalu jalankan ulang seed.

</details>

<details>

<summary>Triase selalu triage_failed</summary>

Langflow mati atau Flow ID salah. Cek `curl http://localhost:7860/health` dan `LANGFLOW_FLOW_TRIAGE_ID`. Kalau Langflow membalas `401 Unauthorized`, buat ulang `LANGFLOW_API_KEY`.

</details>

<details>

<summary>Alert Sumberasih tidak muncul</summary>

Timeline seed sudah lewat 24 jam. Jalankan `supabase/seed/refresh-demo-timeline.ts` atau Reset Demo.

</details>

<details>

<summary>Verifikasi foto selalu "Perlu ditinjau"</summary>

Flow `aduin-verify` gagal. Cek kredensial di komponen Aduin Verify Vision, pastikan bucket `aduan-photos` publik, dan pastikan Langflow menyala.

</details>
