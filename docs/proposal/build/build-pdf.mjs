/**
 * docs/proposal/build/build-pdf.mjs
 *
 * Membangun docs/proposal/Proposal-Aduin.pdf dari proposal-aduin.md:
 *   1. diagram Mermaid → PNG (@mermaid-js/mermaid-cli lewat npx)
 *   2. halaman sampul dengan logo dari src/components/brand/AduinLogo.tsx
 *   3. markdown → PDF A4 (md-to-pdf lewat npx) dengan proposal.css
 *   4. halaman 1 diganti sampul yang dicetak tanpa footer (pdf-lib lewat npx),
 *      karena footer Chrome selalu tampil di setiap halaman
 *
 *   node docs/proposal/build/build-pdf.mjs
 *
 * Tidak ada dependency permanen: kedua alat dijalankan lewat `npx -y` dan
 * memakai Chromium milik Playwright (devDependency untuk screenshot).
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BUILD_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROPOSAL_DIR = path.dirname(BUILD_DIR);
const ROOT = path.resolve(PROPOSAL_DIR, "..", "..");
const SOURCE = path.join(PROPOSAL_DIR, "proposal-aduin.md");
// Berkas sementara di folder yang sama agar path gambar relatif tetap valid.
// Namanya harus beda dari SOURCE juga tanpa membedakan huruf besar/kecil (Windows).
const TEMP_MD = path.join(PROPOSAL_DIR, "proposal-build-tmp.md");
const TEMP_PDF = TEMP_MD.replace(/\.md$/, ".pdf"); // md-to-pdf menamai PDF dari nama markdown
if (TEMP_MD.toLowerCase() === SOURCE.toLowerCase()) throw new Error("TEMP_MD tidak boleh sama dengan SOURCE");
const OUTPUT = path.join(PROPOSAL_DIR, "Proposal-Aduin.pdf");

const COLORS = { primary: "#1F4FD1", accent: "#EA6C0A", ink: "#13235B", backdrop: "#FFFFFF" };
const chromePath = chromium.executablePath();
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(args, attempts = 2) {
  for (let i = 1; ; i++) {
    try {
      execFileSync(npx, ["-y", "--prefer-offline", ...args], {
        cwd: ROOT,
        stdio: "inherit",
        timeout: 180_000, // proses yang macet dihentikan lalu diulang
        shell: process.platform === "win32",
        env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "1", PUPPETEER_EXECUTABLE_PATH: chromePath },
      });
      return;
    } catch (err) {
      // Kadang gagal atau macet sekali (npx/Chromium); ulangi sekali.
      if (i >= attempts) throw err;
      console.warn(`Perintah gagal, mencoba lagi: ${args[0]}`);
    }
  }
}

// --- 0. Font -----------------------------------------------------------------
// Unduh Plus Jakarta Sans dari Google Fonts sekali, lalu sisipkan sebagai data URI.
// Render Chromium jadi tidak bergantung pada jaringan (sebelumnya kadang macet).
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap";
const MODERN_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
let fontCss = await (await fetch(FONT_CSS_URL, { headers: { "User-Agent": MODERN_UA } })).text();
for (const url of new Set(fontCss.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])) {
  const data = Buffer.from(await (await fetch(url)).arrayBuffer()).toString("base64");
  fontCss = fontCss.replaceAll(url, `data:font/woff2;base64,${data}`);
}
const fontCssFile = path.join(BUILD_DIR, ".fonts.css");
fs.writeFileSync(fontCssFile, fontCss);

// --- 1. Mermaid → PNG -------------------------------------------------------
let md = fs.readFileSync(SOURCE, "utf8").replace(/\r\n/g, "\n");
const puppeteerCfg = path.join(BUILD_DIR, ".puppeteer.json");
fs.writeFileSync(puppeteerCfg, JSON.stringify({ executablePath: chromePath, args: ["--no-sandbox"] }));
const mermaidCfg = path.join(BUILD_DIR, ".mermaid.json");
fs.writeFileSync(
  mermaidCfg,
  JSON.stringify({
    theme: "base",
    themeVariables: {
      fontFamily: "Plus Jakarta Sans, Segoe UI, Arial, sans-serif",
      fontSize: "15px",
      primaryColor: "#EEF2FA",
      primaryBorderColor: COLORS.primary,
      primaryTextColor: COLORS.ink,
      lineColor: COLORS.primary,
      edgeLabelBackground: "#FFFFFF",
    },
  })
);
const mermaidCss = path.join(BUILD_DIR, ".mermaid.css");
fs.writeFileSync(mermaidCss, fontCss);

let diagramIndex = 0;
md = md.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
  diagramIndex++;
  const name = `diagram-${diagramIndex}`;
  const src = path.join(BUILD_DIR, `.${name}.mmd`);
  const png = path.join(BUILD_DIR, `${name}.png`);
  fs.writeFileSync(src, code);
  run([
    "@mermaid-js/mermaid-cli@12",
    "-i", src, "-o", png,
    "-s", "3", "-b", "white",
    "-c", mermaidCfg, "-C", mermaidCss, "-p", puppeteerCfg,
  ]);
  fs.rmSync(src);
  return `<p class="diagram"><img src="build/${name}.png" alt="Diagram arsitektur Aduin"></p>\n`;
});

// --- 2. Sampul --------------------------------------------------------------
// Ambil bentuk logo langsung dari komponen brand agar selalu sama dengan aplikasi.
const logoSrc = fs.readFileSync(path.join(ROOT, "src", "components", "brand", "AduinLogo.tsx"), "utf8");
const bubble = logoSrc.match(/<path\s+d="([^"]+)"/)[1];
const check = logoSrc.match(/points="([^"]+)"/)[1];
const [, cx, cy, r] = logoSrc.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)"/);
const logoSvg = `<svg viewBox="0 0 200 200" width="150" height="150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Aduin">
  <path d="${bubble}" fill="${COLORS.primary}"/>
  <polyline points="${check}" fill="none" stroke="${COLORS.backdrop}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${COLORS.accent}" stroke="${COLORS.backdrop}" stroke-width="8"/>
</svg>`;

const titleMatch = md.match(/^# (.+)\n/m);
const title = titleMatch[1];
const [mainTitle, subTitle] = title.split(" — ");
md = md.replace(titleMatch[0], "");
const today = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

const cover = `<section class="cover">
  <div class="cover-logo">${logoSvg}<div class="wordmark"><span>Adu</span><span class="in">in</span></div></div>
  <h1 class="cover-title">${mainTitle}</h1>
  <p class="cover-subtitle">${subTitle ?? ""}</p>
  <p class="cover-tagline">Aduin aja, sisanya kami yang urus.</p>
  <p class="cover-date">${today}</p>
</section>
`;
md = cover + "\n" + md.replace(/^\s*\n/, "");
// Placeholder "[___]" jangan sampai dibaca markdown sebagai penanda miring/tebal.
md = md.replace(/\[___\]/g, "[\\_\\_\\_]");
fs.writeFileSync(TEMP_MD, md);

// --- 3. Markdown → PDF ------------------------------------------------------
const footer = `<div style="width:100%;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:8pt;color:#4A5578;padding:0 18mm;display:flex;justify-content:space-between;">
  <span>Proposal Aduin</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
const mdToPdfCfg = path.join(BUILD_DIR, ".md-to-pdf.json");
fs.writeFileSync(
  mdToPdfCfg,
  JSON.stringify({
    stylesheet: [fontCssFile, path.join(BUILD_DIR, "proposal.css")],
    basedir: PROPOSAL_DIR,
    marked_options: { headerIds: false },
    launch_options: { executablePath: chromePath, args: ["--no-sandbox"] },
    pdf_options: {
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footer,
      preferCSSPageSize: true, // margin dari @page di proposal.css
    },
  })
);
run(["md-to-pdf@5", TEMP_MD, "--config-file", mdToPdfCfg]);

// --- 4. Sampul tanpa nomor halaman ------------------------------------------
const coverPdf = path.join(BUILD_DIR, ".cover.pdf");
const browser = await chromium.launch();
const page = await browser.newPage();
const css = fontCss + fs.readFileSync(path.join(BUILD_DIR, "proposal.css"), "utf8");
await page.setContent(`<!doctype html><html lang="id"><head><meta charset="utf-8"><style>${css}</style></head><body>${cover}</body></html>`, {
  waitUntil: "networkidle",
});
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: coverPdf, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
run(["-p", "pdf-lib@1", "node", path.join(BUILD_DIR, "replace-cover.mjs"), TEMP_PDF, coverPdf, OUTPUT]);
fs.rmSync(TEMP_PDF);
fs.rmSync(coverPdf);

for (const f of [TEMP_MD, puppeteerCfg, mermaidCfg, mermaidCss, mdToPdfCfg, fontCssFile]) fs.rmSync(f, { force: true });
console.log(`PDF: ${path.relative(ROOT, OUTPUT)}`);
