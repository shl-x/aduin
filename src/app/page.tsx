/**
 * src/app/page.tsx
 *
 * Beranda Aduin ("Meja Kerja"): tagline, contoh percakapan warga dengan Aduin,
 * empat langkah U.R.U.S, dan daftar "Masuk sebagai" per role demo.
 */
import { DemoRoleEntry } from "@/components/demo-role-entry";

const STEPS = [
  { no: "01", letter: "U", rest: "rai aduan", text: "AI memeriksa kelengkapan, bertanya balik bila kurang, lalu menentukan kategori, dinas, dan tingkat mendesak beserta alasannya." },
  { no: "02", letter: "R", rest: "angkai pola", text: "Aduan serupa yang berdekatan dikelompokkan di peta. Lonjakan di satu desa memicu peringatan dini." },
  { no: "03", letter: "U", rest: "rutkan penanganan", text: "AI menyusun tugas antardinas: siapa mengerjakan apa, dan tugas mana yang harus menunggu." },
  { no: "04", letter: "S", rest: "ahkan penyelesaian", text: "Foto sebelum dan sesudah dinilai AI. Aduan baru ditutup setelah warga mengonfirmasi." },
];

export default function HomePage() {
  return (
    <div className="space-y-16 py-2 md:py-6">
      <section aria-labelledby="judul-hero" className="flex flex-wrap items-center gap-12">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-5">
          <p className="text-sm font-bold text-muted-foreground">Prototipe · IBM Hackathon 2026 · Kabupaten Probolinggo</p>
          <h1 id="judul-hero" className="text-5xl font-extrabold leading-[1.05] tracking-[-0.035em] md:text-[56px]">
            Aduin aja,
            <br />
            sisanya kami yang urus.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-ink-2">
            Warga melapor lewat WhatsApp. Aduin memilah aduan, mengumpulkan laporan yang sama, membagi tugas ke
            dinas yang tepat, dan baru menutup aduan setelah warga sendiri bilang masalahnya beres. Seluruh AI
            berjalan di IBM watsonx.ai melalui Langflow.
          </p>
        </div>

        <div
          role="group"
          aria-label="Contoh percakapan warga dengan Aduin"
          className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5 rounded-2xl border bg-surface p-6"
        >
          <p className="text-[13px] font-bold text-muted-foreground">Contoh di WhatsApp</p>
          <p className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
            Pak jalan sini rusak parah
          </p>
          <p className="max-w-[80%] self-start rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-[15px] leading-relaxed">
            Bapak/Ibu, di mana persis lokasi jalan yang rusak tersebut?
          </p>
          <p className="max-w-[80%] self-end rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-[15px] leading-relaxed text-primary-foreground">
            Depan SDN 1 Bantaran, lubangnya besar dan dalam.
          </p>
          <div className="w-[86%] self-start space-y-2 rounded-2xl rounded-bl-sm bg-muted px-4 py-3.5">
            <p className="text-[15px] font-bold">Aduan Anda sudah tercatat.</p>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Diteruskan ke <strong className="text-ink">DPU</strong>. Tingkat mendesak{" "}
              <strong className="text-accent-text">tinggi</strong>. Kami kabari lagi setelah dinas selesai bekerja.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="judul-cara" className="space-y-6">
        <h2 id="judul-cara" className="text-[28px] font-extrabold tracking-tight">Empat langkah U.R.U.S</h2>
        <ol className="grid grid-cols-1 border-t-2 border-strong sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.no} className="flex flex-col gap-2 pt-5 pr-6 pb-2">
              <span className="font-mono text-sm text-muted-foreground">{s.no}</span>
              <h3 className="text-xl font-extrabold">
                <span className="text-link">{s.letter}</span>
                {s.rest}
              </h3>
              <p className="text-[15px] leading-relaxed text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="peran" aria-labelledby="masuk-sebagai" className="flex flex-wrap gap-x-12 gap-y-8">
        <div className="min-w-0 flex-[1_1_300px]">
          <h2 id="masuk-sebagai" className="text-[28px] font-extrabold tracking-tight">Masuk sebagai</h2>
          <p className="mt-2.5 text-base leading-relaxed text-ink-2">
            Mode demo: pilih peran untuk melihat Aduin dari sisi orang itu. Tidak perlu kata sandi.
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_620px]">
          <DemoRoleEntry />
        </div>
      </section>
    </div>
  );
}
