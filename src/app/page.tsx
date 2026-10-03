/**
 * src/app/page.tsx
 *
 * Landing page Aduin: nama, tagline, penjelasan singkat alur, dan tombol
 * masuk per role demo.
 */
import { BellRing, ClipboardCheck, MapPinned, MessageSquareText, Network, Sparkles } from "lucide-react";
import { DemoRoleEntry } from "@/components/demo-role-entry";

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
    <div className="max-w-5xl mx-auto space-y-10 py-4">
      <section className="space-y-4">
        <p className="text-sm font-medium text-primary">Kabupaten Probolinggo · Prototipe hackathon IBM</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Aduin</h1>
        <p className="text-xl sm:text-2xl font-medium">Aduin aja, sisanya kami yang urus.</p>
        <p className="text-muted-foreground max-w-2xl">
          Aduin adalah otak analitik di balik kanal pengaduan masyarakat pemerintah daerah. Setiap aduan
          ditriase AI, dipetakan, dipantau lonjakannya, dikoordinasikan ke OPD yang tepat, dan baru
          dianggap selesai setelah buktinya diverifikasi dan warga mengonfirmasi. Seluruh AI berjalan di
          IBM watsonx.ai melalui Langflow.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Masuk sebagai</h2>
        <DemoRoleEntry />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Apa yang dikerjakan Aduin</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-3">
              <f.icon className="size-5 shrink-0 text-primary mt-0.5" aria-hidden />
              <div>
                <p className="font-medium text-sm">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
