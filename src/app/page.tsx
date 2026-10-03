/**
 * src/app/page.tsx
 *
 * Landing page Aduin: logo, tagline, penjelasan singkat alur, dan tombol
 * masuk per role demo.
 */
import { BellRing, ClipboardCheck, MapPinned, MessageSquareText, Network, Sparkles } from "lucide-react";
import { DemoRoleEntry } from "@/components/demo-role-entry";
import { AduinLogo } from "@/components/brand/AduinLogo";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  { icon: MessageSquareText, title: "Lapor semudah chat", text: "Warga mengadu lewat simulator WhatsApp; AI menanyakan balik jika detail kurang." },
  { icon: Sparkles, title: "Triage AI yang bisa dijelaskan", text: "Kategori, OPD tujuan, urgensi, dan alasannya — operator tetap bisa mengoreksi." },
  { icon: MapPinned, title: "Peta hotspot", text: "Aduan serupa yang berdekatan otomatis dikelompokkan menjadi cluster." },
  { icon: BellRing, title: "Peringatan dini", text: "Lonjakan aduan dideteksi dengan z-score dan diringkas AI untuk pimpinan." },
  { icon: Network, title: "Koordinasi lintas OPD", text: "AI menyusun sub-tugas berurutan beserta ketergantungannya." },
  { icon: ClipboardCheck, title: "Verifikasi penyelesaian", text: "Foto bukti dinilai AI, lalu warga mengonfirmasi sebelum aduan ditutup." },
];

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-12 py-2 md:py-6">
      <section className="relative rounded-xl border bg-surface px-6 py-10 md:px-12 md:py-14">
        <ThemeToggle className="absolute right-4 top-4" />
        <div className="flex flex-col items-center text-center gap-6">
          <AduinLogo variant="stacked" size={112} />
          <p className="text-xl sm:text-2xl font-semibold text-ink">Aduin aja, sisanya kami yang urus.</p>
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Otak analitik di balik kanal pengaduan masyarakat pemerintah daerah. Setiap aduan ditriase
            AI, dipetakan, dipantau lonjakannya, dikoordinasikan ke OPD yang tepat, dan baru dianggap
            selesai setelah buktinya diverifikasi dan warga mengonfirmasi. Seluruh AI berjalan di IBM
            watsonx.ai melalui Langflow.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Kabupaten Probolinggo · Prototipe Hackathon IBM
          </p>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="masuk-sebagai">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Mode demo</p>
          <h2 id="masuk-sebagai" className="text-xl font-bold">Masuk sebagai</h2>
        </div>
        <DemoRoleEntry />
      </section>

      <section className="space-y-4" aria-labelledby="apa-yang-dikerjakan">
        <h2 id="apa-yang-dikerjakan" className="text-xl font-bold">Apa yang dikerjakan Aduin</h2>
        <ul className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3 bg-surface p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                <f.icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
