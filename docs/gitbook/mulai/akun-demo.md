---
description: Enam akun demo, cara berganti peran, dan cara mengembalikan data demo.
icon: user-group
---

# Akun demo dan Reset Demo

## Akun demo

Saat `NEXT_PUBLIC_DEMO_MODE=true`, kamu bisa masuk lewat tombol di beranda `/` atau berganti peran lewat **RoleSwitcher** di header. Tidak perlu mengetik password.

| Email | Peran | Halaman utama |
| --- | --- | --- |
| `warga@demo.aduin` | Warga | `/lapor` |
| `operator@demo.aduin` | Operator | `/dashboard` |
| `pu@demo.aduin` | Petugas OPD (DPU) | `/tugas` |
| `dinkes@demo.aduin` | Petugas OPD (Dinkes) | `/tugas` |
| `bpkad@demo.aduin` | Petugas OPD (BPKAD) | `/tugas` |
| `pimpinan@demo.aduin` | Pimpinan | `/ringkasan` |

Semua akun memakai password dari `DEMO_SEED_PASSWORD`.

## Reset Demo

{% tabs %}
{% tab title="Dari aplikasi" %}
1. Masuk sebagai **Operator**.
2. Buka `/dashboard`, lalu klik **Reset Demo**.
3. Klik **Ya, reset** dan tunggu sekitar satu menit.

Aduan seed dan hasil AI dipulihkan dari snapshot, aduan latihan dihapus, timeline digeser ke waktu sekarang, dan early warning dijalankan ulang. Pesan hasilnya menyebut apakah alert Sumberasih aktif.
{% endtab %}

{% tab title="Dari terminal" %}
```bash
npx tsx --env-file=.env.local supabase/seed/index.ts
```

Sebelum demo, kamu juga bisa menggeser timeline saja tanpa menghapus data:

```bash
npx tsx --env-file=.env.local supabase/seed/refresh-demo-timeline.ts
```
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Tombol Reset Demo hanya muncul untuk operator dan hanya jika `NEXT_PUBLIC_DEMO_MODE=true`.
{% endhint %}
