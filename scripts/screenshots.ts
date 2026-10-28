/**
 * scripts/screenshots.ts
 *
 * Mengambil 14 screenshot untuk proposal (docs/proposal/screenshots/) dengan
 * Playwright, mengikuti alur demo dari Reset Demo sampai konfirmasi warga.
 * Peran diganti lewat tombol RoleSwitcher di header (tanpa mengetik password).
 *
 *   npx tsx scripts/screenshots.ts            # semua langkah
 *   npx tsx scripts/screenshots.ts --no-reset # lewati Reset Demo di awal
 *
 * Syarat: aplikasi di http://localhost:3000 (NEXT_PUBLIC_DEMO_MODE=true) dan
 * Langflow menyala. Foto demo (jalan-sebelum.jpg, jalan-sesudah-v2.jpg)
 * diunduh dari bucket publik `aduan-photos`.
 */

import { config } from "dotenv";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

config({ path: ".env.local", quiet: true });

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join("docs", "proposal", "screenshots");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const ADUAN_JALAN =
  "Jalan di depan SDN 1 Bantaran berlubang besar dan dalam, sudah dua minggu tidak diperbaiki. " +
  "Anak-anak sekolah dan pengendara motor sering hampir jatuh, apalagi kalau hujan lubangnya tergenang.";

type RoleLabel = "Warga" | "Operator" | "DPU" | "Dinkes" | "BPKAD" | "Pimpinan";

const results: { file: string; ok: boolean; note?: string }[] = [];

// ---------------------------------------------------------------------------
// Utilitas
// ---------------------------------------------------------------------------

/** Sembunyikan indikator dev Next.js dan kursor teks agar tangkapan bersih. */
const CLEAN_CSS = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
  * { caret-color: transparent !important; }
  header.sticky { background: var(--surface) !important; }
`;

async function settle(page: Page, extraMs = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  await page.addStyleTag({ content: CLEAN_CSS }).catch(() => {});
  // Animasi Recharts/transisi CSS.
  await page.waitForTimeout(extraMs);
}

async function goto(page: Page, url: string) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await settle(page);
}

/** Gulir sehingga elemen berada ~offset px dari atas viewport (di bawah header sticky). */
async function scrollTo(page: Page, target: Locator, offset = 110) {
  await target.first().waitFor({ state: "visible", timeout: 30_000 });
  const handle = await target.first().elementHandle();
  await page.evaluate(
    ([el, off]) => {
      const top = (el as Element).getBoundingClientRect().top + window.scrollY - (off as number);
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" as ScrollBehavior });
    },
    [handle, offset] as const
  );
  await page.waitForTimeout(400);
}

async function shot(page: Page, file: string) {
  await page.addStyleTag({ content: CLEAN_CSS }).catch(() => {});
  await page.screenshot({ path: path.join(OUT_DIR, file) });
  results.push({ file, ok: true });
  console.log(`✓ ${file}`);
}

async function step(file: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    const note = err instanceof Error ? err.message.split("\n")[0] : String(err);
    results.push({ file, ok: false, note });
    console.error(`✗ ${file}: ${note}`);
  }
}

/** Ganti peran lewat tombol RoleSwitcher di header halaman yang sedang dibuka. */
async function switchRole(page: Page, label: RoleLabel) {
  if (!page.url().startsWith(BASE)) await goto(page, "/");
  const group = page.getByRole("group", { name: "Masuk sebagai akun demo" });
  const button = group.getByRole("button", { name: label, exact: true });
  await button.waitFor({ state: "visible", timeout: 30_000 });
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/demo/login") && r.request().method() === "POST", {
      timeout: 60_000,
    }),
    button.click(),
  ]);
  if (!res.ok()) throw new Error(`Login demo ${label} gagal (HTTP ${res.status()})`);
  await page.waitForTimeout(800);
}

async function resetDemo(page: Page) {
  await switchRole(page, "Operator");
  await goto(page, "/dashboard");
  await page.getByRole("button", { name: "Reset Demo" }).click();
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/seed/reset"), { timeout: 300_000 }),
    page.getByRole("button", { name: "Ya, reset" }).click(),
  ]);
  const body = await res.json().catch(() => null);
  if (!res.ok()) throw new Error(`Reset Demo gagal: ${body?.error ?? res.status()}`);
  console.log(
    `• Reset Demo: ${body?.seeded} aduan seed, alert diare ${body?.diare_alert ? "aktif" : "TIDAK ada"}`
  );
  await settle(page);
}

async function downloadPhoto(name: string): Promise<string> {
  if (!SUPABASE_URL) throw new Error("NEXT_PUBLIC_SUPABASE_URL tidak ada di .env.local");
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/aduan-photos/${name}`);
  if (!res.ok) throw new Error(`Foto demo ${name} tidak ditemukan (HTTP ${res.status})`);
  const file = path.join(os.tmpdir(), `aduin-${Date.now()}-${name}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/** Kirim satu pesan di simulator WhatsApp dan tunggu balasan bot. */
async function sendChat(page: Page, text: string) {
  const box = page.getByRole("textbox", { name: "Tulis aduan" });
  await box.fill(text);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/complaints") && r.request().method() === "POST", {
      timeout: 180_000,
    }),
    box.press("Enter"),
  ]);
  const body = await res.json().catch(() => null);
  await page.getByText("Aduin sedang memproses…").waitFor({ state: "detached", timeout: 30_000 });
  await settle(page, 800);
  return body as { needsClarification?: boolean; question?: string; complaintId?: string; status?: string } | null;
}

// ---------------------------------------------------------------------------
// Alur utama
// ---------------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const skipReset = process.argv.includes("--no-reset");

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("theme", "light");
    } catch {}
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  let complaintId: string | null = null;

  await step("01-landing.png", async () => {
    await goto(page, "/");
    await shot(page, "01-landing.png");
  });

  if (!skipReset) await resetDemo(page);

  await step("02-klarifikasi-bot.png", async () => {
    await switchRole(page, "Warga");
    await goto(page, "/lapor");
    const body = await sendChat(page, "Pak jalan sini rusak parah");
    if (!body?.needsClarification) throw new Error("Bot tidak bertanya balik (aduan langsung dianggap lengkap)");
    await shot(page, "02-klarifikasi-bot.png");
  });

  await step("03-aduan-terkirim.png", async () => {
    await goto(page, "/lapor"); // percakapan baru
    await page.getByRole("combobox", { name: "Lokasi aduan" }).click();
    await page.getByRole("option", { name: /^Bantaran — Kec\. Bantaran$/ }).click();
    const before = await downloadPhoto("jalan-sebelum.jpg");
    await page.locator('input[type="file"]').first().setInputFiles(before);
    await page.getByRole("button", { name: /Ganti foto/ }).waitFor({ timeout: 60_000 });
    let body = await sendChat(page, ADUAN_JALAN);
    if (body?.needsClarification) {
      body = await sendChat(page, "Lokasinya persis di depan gerbang SDN 1 Bantaran, Desa Bantaran.");
    }
    if (!body?.complaintId) throw new Error("Aduan tidak tersimpan");
    complaintId = body.complaintId;
    if (body.status !== "triaged") throw new Error(`Aduan tersimpan tetapi status ${body.status}`);
    await page.getByText("Aduan Anda sudah tercatat").first().waitFor();
    await shot(page, "03-aduan-terkirim.png");
  });

  await step("04-daftar-aduan.png", async () => {
    await switchRole(page, "Operator");
    await goto(page, "/dashboard");
    await shot(page, "04-daftar-aduan.png");
  });

  await step("05-detail-triage.png", async () => {
    if (!complaintId) throw new Error("Tidak ada aduan dari langkah 03");
    await goto(page, `/aduan/${complaintId}`);
    await scrollTo(page, page.getByText("Laporan dari warga", { exact: true }));
    await shot(page, "05-detail-triage.png");
  });

  await step("06-override.png", async () => {
    if (!complaintId) throw new Error("Tidak ada aduan dari langkah 03");
    const card = page.getByText("Koreksi keputusan AI", { exact: true });
    await scrollTo(page, card, 260);
    await page.getByRole("combobox", { name: "Bagian yang dikoreksi" }).click();
    await page.getByRole("option", { name: "Jalur Penanganan" }).click();
    await page.getByPlaceholder("Alasan koreksi (opsional)").fill(
      "Lubang cukup ditambal sementara oleh tim reaksi cepat DPU sebelum perbaikan permanen."
    );
    await page.getByRole("combobox", { name: "Nilai baru" }).click();
    await page.getByRole("option", { name: "Quick Fix" }).waitFor();
    await page.waitForTimeout(500);
    await shot(page, "06-override.png");
    await page.keyboard.press("Escape"); // tidak disimpan
  });

  await step("07-rencana-koordinasi.png", async () => {
    if (!complaintId) throw new Error("Tidak ada aduan dari langkah 03");
    await goto(page, `/aduan/${complaintId}`); // buang isian override
    const btn = page.getByRole("button", { name: "Buat Rencana Koordinasi" });
    await scrollTo(page, page.getByText("Rencana penanganan", { exact: true }));
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/coordination/${complaintId}`), { timeout: 180_000 }),
      btn.click(),
    ]);
    if (!res.ok()) {
      const b = await res.json().catch(() => null);
      throw new Error(`Rencana koordinasi gagal: ${b?.error ?? res.status()}`);
    }
    await page.getByRole("button", { name: "Buat Ulang Rencana Koordinasi" }).waitFor({ timeout: 30_000 });
    await settle(page);
    await scrollTo(page, page.getByText("Rencana penanganan", { exact: true }));
    await shot(page, "07-rencana-koordinasi.png");
  });

  await step("08-peta-hotspot.png", async () => {
    await goto(page, "/peta");
    const markers = page.locator(".leaflet-overlay-pane path.leaflet-interactive");
    await markers.first().waitFor({ state: "attached" });
    // Titik terpadat (cluster Bantaran) → zoom dengan double-click di titik tersebut.
    const densest = async () =>
      page.evaluate(() => {
        const pts = Array.from(document.querySelectorAll(".leaflet-overlay-pane path.leaflet-interactive"))
          .map((p) => p.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.width < 30) // CircleMarker, bukan lingkaran kecamatan
          .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }));
        let best = pts[0];
        let bestN = -1;
        for (const p of pts) {
          const n = pts.filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 40).length;
          if (n > bestN) [best, bestN] = [p, n];
        }
        return best;
      });
    for (let i = 0; i < 4; i++) {
      const p = await densest();
      await page.mouse.dblclick(p.x, p.y);
      await page.waitForTimeout(900);
    }
    await settle(page, 1500);
    // Buka popup marker yang anggota cluster Bantaran, paling dekat pusat peta.
    const candidates = await page.evaluate(() => {
      const map = document.querySelector(".leaflet-container")!.getBoundingClientRect();
      const cx = map.x + map.width / 2;
      const cy = map.y + map.height / 2;
      return Array.from(document.querySelectorAll(".leaflet-overlay-pane path.leaflet-interactive"))
        .map((p) => p.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.width < 30 && r.y > map.y + 40 && r.y < map.bottom - 40)
        .map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 }))
        .sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
    });
    let opened = false;
    for (const c of candidates.slice(0, 25)) {
      await page.mouse.click(c.x, c.y);
      await page.waitForTimeout(500);
      const popup = page.locator(".leaflet-popup-content");
      const txt = (await popup.count()) ? await popup.innerText() : "";
      if (/Cluster:/.test(txt) && /Bantaran/.test(txt)) {
        opened = true;
        break;
      }
    }
    if (!opened) throw new Error("Tidak menemukan marker cluster Bantaran");
    await page.waitForTimeout(800);
    await shot(page, "08-peta-hotspot.png");
  });

  await step("09-peringatan-dini.png", async () => {
    await goto(page, "/alert");
    await page.getByText(/Sumberasih/).first().waitFor();
    await shot(page, "09-peringatan-dini.png");
  });

  await step("10-tugas-opd.png", async () => {
    await switchRole(page, "DPU");
    await goto(page, "/tugas");
    await scrollTo(page, page.getByText(/^Belum mulai \d+$/i));
    await shot(page, "10-tugas-opd.png");
  });

  // Selesaikan semua sub-tugas aduan langkah 03 lewat portal tugas, lalu unggah
  // foto bukti — supaya langkah 11 dan 12 memperlihatkan foto sebelum/sesudah.
  let verified = false;
  let verifyNote = "Tidak ada aduan dari langkah 03";
  if (complaintId) {
    try {
      const accounts: RoleLabel[] = ["DPU", "BPKAD", "Dinkes"];
      for (let round = 0; round < 6; round++) {
        let clicks = 0;
        for (const acct of accounts) {
          await switchRole(page, acct);
          await goto(page, "/tugas");
          for (let i = 0; i < 10; i++) {
            const btn = page
              .locator("li")
              .filter({ hasText: `Aduan: ${ADUAN_JALAN.slice(0, 60)}` })
              .getByRole("button", { name: /^(Mulai Kerjakan|Tandai Selesai)$/ })
              .and(page.locator(":not([disabled])"));
            if ((await btn.count()) === 0) break;
            const [res] = await Promise.all([
              page.waitForResponse((r) => r.url().includes("/api/tasks/") && r.request().method() === "PATCH"),
              btn.first().click(),
            ]);
            if (!res.ok()) throw new Error(`Gagal memperbarui tugas sebagai ${acct}`);
            clicks++;
            // Muat ulang agar tombol mencerminkan status terbaru (hindari klik ganda).
            await goto(page, "/tugas");
          }
        }
        if (clicks === 0) break;
      }
      // Unggah foto bukti sebagai OPD yang memegang aduan ini (dicoba berurutan).
      const after = await downloadPhoto("jalan-sesudah-v2.jpg");
      let uploaded = false;
      for (const acct of accounts) {
        await switchRole(page, acct);
        await goto(page, "/tugas");
        const item = page.locator("li").filter({ hasText: ADUAN_JALAN.slice(0, 60) }).filter({
          has: page.getByRole("button", { name: "Unggah Bukti Penyelesaian" }),
        });
        if ((await item.count()) === 0) continue;
        await item.first().locator('input[type="file"]').setInputFiles(after);
        const upload = item.first().getByRole("button", { name: "Unggah Bukti Penyelesaian" });
        if (await upload.isDisabled()) throw new Error("Tombol unggah bukti belum aktif (ada tugas belum selesai)");
        const [res] = await Promise.all([
          page.waitForResponse((r) => r.url().includes(`/api/verify/${complaintId}`) && r.request().method() === "POST", {
            timeout: 240_000,
          }),
          upload.click(),
        ]);
        const b = await res.json().catch(() => null);
        if (!res.ok()) throw new Error(`Verifikasi foto gagal: ${b?.error ?? res.status()}`);
        uploaded = true;
        verified = true;
        console.log(`• Verifikasi foto: ${JSON.stringify(b?.status ?? b?.ai_status ?? b).slice(0, 120)}`);
        break;
      }
      if (!uploaded) verifyNote = "Kartu Bukti Penyelesaian tidak ditemukan untuk akun DPU/BPKAD/Dinkes";
    } catch (err) {
      verifyNote = err instanceof Error ? err.message.split("\n")[0] : String(err);
    }
  }

  await step("11-verifikasi-foto.png", async () => {
    if (!verified || !complaintId) throw new Error(verifyNote);
    await switchRole(page, "Operator");
    await goto(page, `/aduan/${complaintId}`);
    const cardTitle = page.getByText(/^(Verifikasi Penyelesaian|Bukti Penyelesaian)$/);
    await scrollTo(page, cardTitle);
    await shot(page, "11-verifikasi-foto.png");
  });

  await step("12-konfirmasi-warga.png", async () => {
    await switchRole(page, "Warga");
    await goto(page, "/lapor");
    const btn = page.getByRole("button", { name: "Ya, sudah beres" });
    await btn.first().waitFor();
    await scrollTo(page, page.getByText("Aduan Saya", { exact: true }));
    await shot(page, "12-konfirmasi-warga.png");
  });

  await step("13-dashboard-pimpinan.png", async () => {
    await switchRole(page, "Pimpinan");
    await goto(page, "/ringkasan");
    await settle(page, 2500);
    await shot(page, "13-dashboard-pimpinan.png");
  });

  await step("14-mode-gelap.png", async () => {
    await switchRole(page, "Operator");
    await page.evaluate(() => localStorage.setItem("theme", "dark"));
    await context.addInitScript(() => {
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await goto(page, "/dashboard");
    await shot(page, "14-mode-gelap.png");
  });

  await browser.close();

  console.log("\nRingkasan:");
  for (const r of results) console.log(`${r.ok ? "OK   " : "GAGAL"} ${r.file}${r.note ? ` — ${r.note}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
