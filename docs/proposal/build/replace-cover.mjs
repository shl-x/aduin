/**
 * docs/proposal/build/replace-cover.mjs
 *
 * Mengganti halaman pertama PDF dengan halaman sampul (tanpa footer).
 * Dijalankan oleh build-pdf.mjs lewat `npx -p pdf-lib@1 node ...`, jadi
 * pdf-lib dicari di folder node_modules sementara milik npx (dari PATH).
 *
 *   node replace-cover.mjs <isi.pdf> <sampul.pdf> <hasil.pdf>
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

async function loadPdfLib() {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir.endsWith(path.join("node_modules", ".bin"))) continue;
    const pkgDir = path.join(dir, "..", "pdf-lib");
    const pkgJson = path.join(pkgDir, "package.json");
    if (!fs.existsSync(pkgJson)) continue;
    const { main } = JSON.parse(fs.readFileSync(pkgJson, "utf8"));
    const mod = await import(pathToFileURL(path.join(pkgDir, main)).href);
    return mod.default ?? mod;
  }
  throw new Error("pdf-lib tidak ditemukan; jalankan lewat `npx -p pdf-lib@1 node ...`");
}

const { PDFDocument } = await loadPdfLib();
const [bodyPath, coverPath, outPath] = process.argv.slice(2);
const body = await PDFDocument.load(fs.readFileSync(bodyPath));
const cover = await PDFDocument.load(fs.readFileSync(coverPath));
const [coverPage] = await body.copyPages(cover, [0]);
body.removePage(0);
body.insertPage(0, coverPage);
fs.writeFileSync(outPath, await body.save());
