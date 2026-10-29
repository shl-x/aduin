---
description: Warga melapor seperti chat biasa. Bot bertanya balik kalau laporan kurang jelas.
icon: comments
---

# Lapor lewat chat

**Halaman:** `/lapor` · **Peran:** Warga · **Flow AI:** `aduin-clarify`

Di prototipe ini, kanal WhatsApp disimulasikan sebagai jendela chat. Warga cukup menulis keluhannya, boleh dengan bahasa Indonesia informal, Jawa, atau Madura.

{% stepper %}
{% step %}
### Tulis aduan

Warga mengetik keluhan. Lokasi (desa atau kecamatan) dan foto bersifat opsional.

<figure><img src="../.gitbook/assets/lapor-kosong.jpg" alt="Halaman lapor kosong"><figcaption><p>Halaman lapor dan daftar "Aduan saya" di sebelah kanan.</p></figcaption></figure>
{% endstep %}

{% step %}
### Bot bertanya balik

Flow `aduin-clarify` menilai kelengkapan aduan. Kalau lokasi atau masalahnya belum jelas, bot mengajukan **satu** pertanyaan balik.

<figure><img src="../.gitbook/assets/lapor-klarifikasi.jpg" alt="Bot bertanya balik"><figcaption><p>"Pak jalan sini rusak parah" belum menyebut lokasi, jadi bot bertanya di mana persisnya.</p></figcaption></figure>
{% endstep %}

{% step %}
### Aduan tercatat

Setelah lengkap, aduan disimpan dan langsung [ditriase](triase.md). Warga melihat ringkasan: kategori, dinas tujuan, dan tingkat mendesak.

<figure><img src="../.gitbook/assets/lapor-terkirim.jpg" alt="Aduan tercatat"><figcaption><p>Balasan bot setelah aduan tercatat dan diproses AI.</p></figcaption></figure>
{% endstep %}
{% endstepper %}

## Konfirmasi penyelesaian

Kartu di kolom **Aduan saya** menampilkan aduan yang menunggu jawaban warga. Setelah petugas mengunggah bukti dan AI memverifikasinya, warga memilih **Ya, sudah beres** atau **Belum beres**. Aduan hanya bisa ditutup dari sini.
