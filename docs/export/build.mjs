/**
 * docs/export/build.mjs
 *
 * Membuat PDF reviewer dari README.md dan docs/DEMO_SCRIPT.md tanpa mengubah
 * file Markdown aslinya:
 *   1. Salin ke docs/export/*-reviewer.md lalu sanitasi (URL Supabase, UUID,
 *      token/kunci, nilai rahasia .env.local, link relatif → teks biasa).
 *   2. Render diagram Mermaid menjadi PNG (@mermaid-js/mermaid-cli via npx).
 *   3. Tambahkan halaman sampul, lalu buat PDF A4 (md-to-pdf via npx) dengan
 *      pdf.css dan nomor halaman di footer.
 *   4. Pastikan tidak ada nilai rahasia .env.local di salinan maupun PDF.
 *
 * Tidak ada dependency yang ditambahkan ke package.json.
 * Chrome tidak diunduh: Puppeteer memakai Chrome/Edge yang sudah terpasang
 * (atau PUPPETEER_EXECUTABLE_PATH).
 *
 * Jalankan dari root repo:  node docs/export/build.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs/export");
const ASSETS = path.join(OUT, "assets");
const TMP = mkdtempSync(path.join(tmpdir(), "aduin-export-"));
const TAGLINE = "Aduin aja, sisanya kami yang urus.";
const TODAY = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date());

const DOCS = [
  {
    source: "README.md",
    copy: "README-reviewer.md",
    pdf: "Aduin-README.pdf",
    title: "Aduin — Dokumentasi Teknis",
  },
  {
    source: "docs/DEMO_SCRIPT.md",
    copy: "DEMO_SCRIPT-reviewer.md",
    pdf: "Aduin-Demo-Script.pdf",
    title: "Aduin — Naskah Demo",
  },
];

// ---------------------------------------------------------------------------
// Browser untuk Puppeteer
// ---------------------------------------------------------------------------

function findBrowser() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("Chrome/Edge tidak ditemukan. Setel PUPPETEER_EXECUTABLE_PATH.");
  return found;
}

const BROWSER = findBrowser();
const npxEnv = { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "true", PUPPETEER_EXECUTABLE_PATH: BROWSER };

function npx(args) {
  execSync(`npx -y ${args}`, { stdio: "inherit", env: npxEnv, cwd: ROOT });
}

// ---------------------------------------------------------------------------
// Nilai .env.local
// ---------------------------------------------------------------------------

function parseEnv(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2").trim();
  }
  return out;
}

const envLocal = parseEnv(path.join(ROOT, ".env.local"));
const envExample = parseEnv(path.join(ROOT, ".env.example"));

/** Nilai .env.local yang bukan default publik di .env.example dianggap rahasia. */
const secretEntries = Object.entries(envLocal).filter(
  ([key, value]) => value.length >= 4 && envExample[key] !== value
);
const publicEntries = Object.entries(envLocal).filter(
  ([key, value]) => value.length > 0 && envExample[key] === value
);

// ---------------------------------------------------------------------------
// Sanitasi
// ---------------------------------------------------------------------------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const RULES = [
  {
    name: "Nilai rahasia .env.local (persis)",
    apply: (s) => {
      let n = 0;
      for (const [, value] of secretEntries) {
        s = s.replace(new RegExp(escapeRe(value), "g"), () => (n++, "<disamarkan>"));
      }
      return [s, n];
    },
  },
  {
    name: "URL project Supabase → https://<project>.supabase.co",
    re: /https:\/\/[a-z0-9]{8,}\.supabase\.co/g,
    to: "https://<project>.supabase.co",
  },
  {
    name: "UUID (flow ID Langflow, Project ID watsonx, dll.) → <uuid>",
    re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    to: "<uuid>",
  },
  { name: "JWT (anon / service role key) → <jwt>", re: /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, to: "<jwt>" },
  {
    // Huruf besar + huruf kecil + angka sekaligus (pola API key), agar nama model
    // seperti mistral-small-3-1-24b-instruct-2503 tidak ikut tersamarkan.
    name: "Token/kunci panjang (≥ 32 karakter) → <disamarkan>",
    re: /(?<![\w/.-])(?=[\w-]*[A-Z])(?=[\w-]*[a-z])(?=[\w-]*\d)[A-Za-z0-9_-]{32,}(?![\w/.-])/g,
    to: "<disamarkan>",
  },
  {
    name: "Baris VAR=nilai rahasia di blok kode → VAR=<placeholder>",
    re: /^((?:NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|LANGFLOW_API_KEY|LANGFLOW_FLOW_[A-Z_]+_ID|DEMO_SEED_PASSWORD|WATSONX_API_KEY|WATSONX_PROJECT_ID)\s*=\s*)(?!<)(\S+)$/gm,
    to: "$1<placeholder>",
  },
  {
    name: "Link relatif repo → teks biasa (tidak bisa diklik di PDF)",
    re: /\[([^\]]+)\]\((?!https?:|#|mailto:)[^)]+\)/g,
    to: "$1",
  },
];

function sanitize(text) {
  const report = [];
  for (const rule of RULES) {
    let count = 0;
    if (rule.apply) {
      [text, count] = rule.apply(text);
    } else {
      text = text.replace(rule.re, (...args) => {
        count++;
        return args[0].replace(new RegExp(rule.re.source, rule.re.flags.replace("g", "")), rule.to);
      });
    }
    report.push({ aturan: rule.name, jumlah: count });
  }
  return [text, report];
}

// ---------------------------------------------------------------------------
// Mermaid → PNG
// ---------------------------------------------------------------------------

const puppeteerConfig = path.join(TMP, "puppeteer.json");
writeFileSync(puppeteerConfig, JSON.stringify({ executablePath: BROWSER, args: ["--no-sandbox"] }));
// Font besar + jarak rapat agar teks diagram tetap terbaca setelah diperkecil selebar halaman A4.
const mermaidConfig = path.join(TMP, "mermaid.json");
writeFileSync(
  mermaidConfig,
  JSON.stringify({
    theme: "neutral",
    themeVariables: { fontSize: "24px", fontFamily: "Segoe UI, Arial, sans-serif" },
    flowchart: { nodeSpacing: 24, rankSpacing: 36, padding: 10, subGraphTitleMargin: { top: 10, bottom: 14 } },
  })
);

let diagramIndex = 0;
function renderMermaid(text, stem) {
  return text.replace(/```mermaid\r?\n([\s\S]*?)```/g, (_, code) => {
    diagramIndex++;
    const name = `${stem}-diagram-${diagramIndex}.png`;
    const input = path.join(TMP, `${stem}-${diagramIndex}.mmd`);
    writeFileSync(input, code);
    mkdirSync(ASSETS, { recursive: true });
    npx(
      `-p @mermaid-js/mermaid-cli@11 mmdc -i "${input}" -o "${path.join(ASSETS, name)}" ` +
        `-b white -s 3 -w 1400 -c "${mermaidConfig}" -p "${puppeteerConfig}"`
    );
    return `<div class="diagram"><img src="assets/${name}" alt="Diagram arsitektur Aduin"></div>\n`;
  });
}

/**
 * Kode pendek di sel tabel (mis. `/aduan/[id]`) tidak boleh terpotong di tengah;
 * kode panjang (nama model, path) tetap boleh membungkus agar tabel tidak melebar.
 */
function keepShortCodeTogether(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split("\n")
    .map((line) =>
      line.startsWith("|")
        ? line.replace(/`([^`|]{1,24})`/g, (_, code) => `<code class="nowrap">${esc(code)}</code>`)
        : line
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Sampul + PDF
// ---------------------------------------------------------------------------

function cover(title) {
  return [
    '<div class="cover">',
    '<p class="cover-kicker">Prototipe Hackathon IBM</p>',
    `<h1 class="cover-title">${title}</h1>`,
    `<p class="cover-tagline">“${TAGLINE}”</p>`,
    `<p class="cover-meta">${TODAY}</p>`,
    "</div>",
    "",
    "",
  ].join("\n");
}

const FOOTER =
  '<div style="width:100%;font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#59636e;' +
  'padding:0 16mm;display:flex;justify-content:space-between;">' +
  '<span>Aduin — Prototipe Hackathon IBM</span>' +
  '<span>Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></span></div>';

function buildPdf(mdFile, pdfFile) {
  const config = path.join(TMP, `${path.basename(pdfFile, ".pdf")}.config.json`);
  writeFileSync(
    config,
    JSON.stringify({
      basedir: OUT,
      dest: pdfFile,
      stylesheet: [path.join(OUT, "pdf.css")],
      body_class: ["markdown-body"],
      launch_options: { executablePath: BROWSER, args: ["--no-sandbox"] },
      pdf_options: {
        format: "A4",
        printBackground: true,
        margin: { top: "18mm", right: "16mm", bottom: "20mm", left: "16mm" },
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: FOOTER,
      },
    })
  );
  npx(`md-to-pdf@5 "${mdFile}" --config-file "${config}"`);
}

function countPages(pdfFile) {
  const raw = readFileSync(pdfFile).toString("latin1");
  const counts = [...raw.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((m) => Number(m[1]));
  if (counts.length) return Math.max(...counts);
  return (raw.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });
console.log(`Browser: ${BROWSER}`);
console.log(
  `.env.local: ${Object.keys(envLocal).length} variabel — ${secretEntries.length} dianggap rahasia, ` +
    `${publicEntries.length} sama dengan default publik .env.example (${publicEntries.map(([k]) => k).join(", ")})\n`
);

const summary = [];
for (const doc of DOCS) {
  const original = readFileSync(path.join(ROOT, doc.source), "utf-8");
  const [clean, report] = sanitize(original);
  const stem = path.basename(doc.copy, ".md");
  const withDiagrams = keepShortCodeTogether(renderMermaid(clean, stem));
  const mdPath = path.join(OUT, doc.copy);
  writeFileSync(mdPath, cover(doc.title) + withDiagrams);

  console.log(`\n== Sanitasi ${doc.source} → docs/export/${doc.copy}`);
  console.table(report);

  const pdfPath = path.join(OUT, doc.pdf);
  buildPdf(mdPath, pdfPath);
  summary.push({ pdf: `docs/export/${doc.pdf}`, halaman: countPages(pdfPath), mdPath, pdfPath });
}

// Pemeriksaan akhir: tidak ada nilai rahasia .env.local di salinan maupun PDF.
console.log("\n== Pemeriksaan nilai .env.local");
let leaks = 0;
for (const { mdPath, pdfPath } of summary) {
  const md = readFileSync(mdPath, "utf-8");
  const pdf = readFileSync(pdfPath).toString("latin1");
  for (const [key, value] of secretEntries) {
    if (md.includes(value) || pdf.includes(value)) {
      leaks++;
      console.log(`  ✗ ${path.basename(mdPath)}: nilai ${key} ditemukan`);
    }
  }
}
console.log(
  leaks === 0
    ? `  ✓ Tidak ada dari ${secretEntries.length} nilai rahasia .env.local yang muncul di salinan .md maupun PDF.`
    : `  ✗ ${leaks} kebocoran — periksa aturan sanitasi.`
);

console.log("\n== Hasil");
console.table(summary.map(({ pdf, halaman }) => ({ pdf, halaman })));
if (leaks > 0) process.exitCode = 1;
