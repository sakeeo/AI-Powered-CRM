import {
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  Check,
  ChartColumn,
  CheckCircle2,
  DatabaseBackup,
  FileText,
  Handshake,
  KanbanSquare,
  KeyRound,
  MessageCircle,
  MessagesSquare,
  Palette,
  Radar,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChatPreview } from "@/modules/landing/components/chat-preview";
import { ServerPreview } from "@/modules/landing/components/server-preview";

const LOGIN = "/login";
/** Dua CTA: uji coba (masuk ke aplikasi) dan jadwalkan meeting (WhatsApp). */
const TRIAL_LABEL = "Uji Coba Gratis";
const MEETING_LABEL = "Jadwalkan Meeting";
/** WhatsApp bisnis (085119308345 → format internasional 62…) dengan pesan pembuka. */
const waLink = (text: string) => `https://wa.me/6285119308345?text=${encodeURIComponent(text)}`;
const WHATSAPP_URL = waLink("Halo, saya tertarik dengan Kerabat CRM dan ingin berdiskusi.");
/** CTA utama: menjadwalkan meeting lewat WhatsApp. */
const MEETING_URL = waLink(
  "Halo, saya ingin menjadwalkan meeting untuk membahas Kerabat CRM. Kapan waktu yang tersedia?",
);
const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Nilai jual utama: CRM dipasang di server klien (data milik klien) dengan brand klien. */
const OWNERSHIP = [
  {
    icon: Server,
    title: "Data tetap di server Anda",
    text: "Kerabat CRM dipasang di server atau VPS milik perusahaan Anda. Data pelanggan tidak disimpan di server pihak lain.",
  },
  {
    icon: Palette,
    title: "Tampil dengan brand Anda",
    text: "Aplikasi white label: nama, logo, warna, dan domain mengikuti brand perusahaan Anda.",
  },
  {
    icon: ShieldCheck,
    title: "Akses terkendali",
    text: "HTTPS otomatis, hak akses per peran, audit log, dan API key connector disimpan terenkripsi.",
  },
  {
    icon: DatabaseBackup,
    title: "Backup terenkripsi",
    text: "Backup database terenkripsi dengan prosedur pemulihan yang sudah diuji. Anda yang memegang kuncinya.",
  },
] as const;

const COMPARE = [
  ["Lokasi data", "Di server penyedia", "Di server atau VPS milik Anda"],
  ["Tampilan", "Brand penyedia", "Nama, logo & warna brand Anda"],
  ["Penyesuaian", "Terbatas pada fitur bawaan", "Disesuaikan dengan proses bisnis Anda"],
  ["Penyedia AI", "Ditentukan penyedia", "API key & penyedia pilihan Anda"],
] as const;

const FEATURES = [
  {
    icon: Sparkles,
    title: "Tanya CRM dengan bahasa sehari-hari",
    text: "Tanyakan “Berapa deal Won tahun ini?” dan dapatkan tabel jawabannya langsung. Angka dihitung dari database, bukan dikarang AI.",
  },
  {
    icon: Radar,
    title: "Skor lead & rekomendasi follow-up",
    text: "Lihat lead mana yang paling siap ditindaklanjuti, lewat kanal apa, dan kapan waktu terbaik menghubunginya.",
  },
  {
    icon: KanbanSquare,
    title: "Pipeline Kanban",
    text: "Seret deal antar stage, pantau nilai pipeline dan nilai tertimbang probabilitas per stage dalam satu baris.",
  },
  {
    icon: MessagesSquare,
    title: "Inbox WhatsApp & email",
    text: "Percakapan pelanggan dari WhatsApp, email, dan kanal lain terkumpul di satu inbox, lengkap dengan pembagian PIC.",
  },
  {
    icon: FileText,
    title: "Quotation & persetujuan",
    text: "Buat penawaran dari katalog produk, atur alur persetujuan, dan simpan riwayat versinya.",
  },
  {
    icon: ChartColumn,
    title: "Laporan & dashboard",
    text: "Dashboard ringkas, Report Builder, dan laporan terjadwal untuk memantau performa tim penjualan.",
  },
] as const;

const STEPS = [
  {
    icon: Handshake,
    title: "Diskusikan kebutuhan",
    text: "Ceritakan proses penjualan, brand, dan skala tim Anda. Metode kerja sama disesuaikan dengan kebutuhan Anda.",
  },
  {
    icon: Server,
    title: "Pasang di server Anda",
    text: "Kerabat CRM dipasang di server atau VPS milik Anda dengan domain, nama, logo, dan warna brand Anda.",
  },
  {
    icon: Rocket,
    title: "Tim mulai bekerja",
    text: "Undang tim, impor data lead, hubungkan WhatsApp & email, lalu pantau setiap lead hingga konversi.",
  },
] as const;

const FAQ = [
  {
    q: "Apakah aplikasi bisa dijalankan di server sendiri?",
    a: "Bisa. Kerabat CRM dapat dipasang di server atau VPS milik Anda, sehingga data pelanggan tetap berada di bawah kendali perusahaan Anda.",
  },
  {
    q: "Apa maksud Kerabat CRM adalah aplikasi white label?",
    a: "Kerabat CRM bisa dipakai dengan nama, logo, dan warna brand Anda sendiri, sehingga tampil sebagai aplikasi milik perusahaan Anda di depan tim maupun pelanggan.",
  },
  {
    q: "Apakah aplikasi bisa disesuaikan dengan proses bisnis saya?",
    a: "Bisa. Tahap pipeline, sumber lead, field tambahan, tag, peran pengguna, dan aturan otomatisasi dapat diatur sesuai cara kerja tim Anda. Kebutuhan yang lebih khusus dapat dikembangkan bersama.",
  },
  {
    q: "Bagaimana metode kerja samanya?",
    a: "Metode kerja sama fleksibel dan dapat dibicarakan sesuai skala, kebutuhan, dan anggaran bisnis Anda. Hubungi kami untuk mendiskusikan pilihan yang paling cocok.",
  },
  {
    q: "Apakah AI bisa mengubah data saya?",
    a: "Tidak. Tanya CRM hanya membaca data. AI menerjemahkan pertanyaan menjadi kueri baca-saja, angka berasal dari database, dan hanya mencakup data yang boleh Anda lihat.",
  },
  {
    q: "Penyedia AI apa yang didukung?",
    a: "Anda memakai API key sendiri. Tersedia Gemini, OpenAI, Anthropic, DeepSeek, dan OpenRouter, sehingga Anda tidak terkunci pada satu penyedia.",
  },
  {
    q: "Bagaimana dengan data pelanggan yang sudah ada?",
    a: "Impor lead dari file CSV. Baris yang tidak valid dilaporkan, sedangkan baris yang valid tetap masuk.",
  },
] as const;

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Kerabat CRM — beranda">
      <span aria-hidden className="bg-loud grid size-9 place-items-center rounded-2xl text-white">
        <BrainCircuit className="size-5" />
      </span>
      <span className="text-lg font-bold">Kerabat CRM</span>
    </Link>
  );
}

/**
 * Pasangan CTA di atas latar hijau (primary): "Uji Coba Gratis" (utama, tombol krem → login)
 * dan "Jadwalkan Meeting" (sekunder, garis tepi → WhatsApp).
 */
function CtaPairOnDark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Button
        asChild
        size="lg"
        className="bg-card text-primary hover:bg-card/90 h-12 px-8 text-base"
      >
        <Link href={LOGIN}>
          {TRIAL_LABEL} <ArrowRight />
        </Link>
      </Button>
      <Button
        asChild
        size="lg"
        variant="ghost"
        className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground h-12 border px-6 text-base"
      >
        <a href={MEETING_URL} {...EXTERNAL}>
          <CalendarCheck /> {MEETING_LABEL}
        </a>
      </Button>
    </div>
  );
}

function SectionHeading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold text-balance">{title}</h2>
      {text && <p className="text-muted-foreground mt-3 text-pretty">{text}</p>}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="bg-background/90 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand />
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-sm lg:flex">
            {[
              ["#server-sendiri", "Server sendiri"],
              ["#fitur", "Fitur"],
              ["#ai-aman", "AI yang aman"],
              ["#cara-kerja", "Cara kerja"],
              ["#faq", "FAQ"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-muted-foreground hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <a href={MEETING_URL} {...EXTERNAL}>
                <CalendarCheck /> {MEETING_LABEL}
              </a>
            </Button>
            <Button asChild>
              <Link href={LOGIN}>{TRIAL_LABEL}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero: nilai jual utama = CRM di server sendiri, dengan brand sendiri */}
        <section className="bg-primary text-primary-foreground relative overflow-hidden">
          <div
            aria-hidden
            className="bg-loud/90 pointer-events-none absolute -top-32 -left-32 size-80 rounded-full"
          />
          <div
            aria-hidden
            className="border-loud/50 pointer-events-none absolute -right-28 -bottom-44 size-[420px] rounded-full border-2"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <div>
              <p className="bg-primary-foreground/10 mb-5 inline-flex items-center gap-2 rounded-3xl px-4 py-1.5 text-xs font-medium">
                <Server className="size-3.5" /> CRM white label · dipasang di server Anda
              </p>
              <h1 className="text-4xl leading-tight font-bold text-balance sm:text-5xl">
                CRM milik Anda sendiri. Di server Anda, dengan brand Anda.
              </h1>
              <p className="text-primary-foreground/85 mt-5 max-w-xl text-lg text-pretty">
                Kerabat CRM dipasang di server atau VPS milik perusahaan Anda, sehingga data
                pelanggan tetap di bawah kendali Anda. Pantau setiap lead hingga konversi, lengkap
                dengan AI.
              </p>
              <CtaPairOnDark className="mt-8" />
              <ul className="text-primary-foreground/85 mt-8 space-y-2 text-sm">
                {[
                  "Data pelanggan tersimpan di server milik Anda",
                  "Nama, logo, warna & domain mengikuti brand Anda",
                  "AI yang hanya membaca data, dengan API key milik Anda",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <ServerPreview />
          </div>
        </section>

        {/* Server sendiri: pilar kepemilikan + perbandingan */}
        <section id="server-sendiri" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Data Anda, server Anda, brand Anda"
              text="Bukan sekadar berlangganan aplikasi orang lain. Kerabat CRM menjadi sistem milik perusahaan Anda sendiri."
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {OWNERSHIP.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="bg-card shadow-card rounded-md p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <span className="bg-primary text-primary-foreground mb-4 grid size-11 place-items-center rounded-full">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm text-pretty">{text}</p>
                </li>
              ))}
            </ul>

            <div className="bg-card shadow-card mx-auto mt-12 max-w-4xl overflow-x-auto rounded-md">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">
                  Perbandingan CRM SaaS pada umumnya dengan Kerabat CRM
                </caption>
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="px-5 py-4 font-medium" />
                    <th scope="col" className="text-muted-foreground px-5 py-4 font-medium">
                      CRM SaaS pada umumnya
                    </th>
                    <th scope="col" className="text-primary px-5 py-4 font-semibold">
                      Kerabat CRM
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map(([aspect, saas, ours]) => (
                    <tr key={aspect} className="border-b last:border-0">
                      <th scope="row" className="px-5 py-4 font-medium">
                        {aspect}
                      </th>
                      <td className="text-muted-foreground px-5 py-4">
                        <span className="flex items-center gap-2">
                          <X className="size-4 shrink-0" aria-hidden /> {saas}
                        </span>
                      </td>
                      <td className="bg-secondary/50 px-5 py-4 font-medium">
                        <span className="flex items-center gap-2">
                          <Check className="text-tone-green-ink size-4 shrink-0" aria-hidden />{" "}
                          {ours}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" className="bg-card scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Pantau setiap lead hingga konversi"
              text="Dari lead pertama masuk sampai deal tertutup, semuanya terhubung dalam satu aplikasi."
            />
            <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li
                  key={title}
                  className="bg-background rounded-md p-6 transition-transform duration-200 hover:-translate-y-1"
                >
                  <span className="bg-secondary text-secondary-foreground mb-4 grid size-11 place-items-center rounded-full">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm text-pretty">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* AI yang aman */}
        <section id="ai-aman" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-balance">AI yang tidak mengarang angka</h2>
              <p className="text-muted-foreground mt-3 text-pretty">
                Tanyakan data penjualan dengan bahasa sehari-hari. AI hanya membantu memahami
                pertanyaan; hitungannya tetap dilakukan database di server Anda.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  ["Hanya membaca", "AI tidak pernah menulis, mengubah, atau menghapus data."],
                  [
                    "Angka dari database",
                    "Jawaban dihitung dari data nyata dan hanya mencakup data yang boleh Anda lihat.",
                  ],
                  [
                    "Transparan",
                    "Setiap jawaban menampilkan cara pertanyaan dipahami, sehingga mudah diperiksa.",
                  ],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-3">
                    <CheckCircle2 className="text-tone-green-ink mt-0.5 size-5 shrink-0" />
                    <div>
                      <p className="font-semibold">{t}</p>
                      <p className="text-muted-foreground text-sm">{d}</p>
                    </div>
                  </li>
                ))}
                <li className="flex gap-3">
                  <KeyRound className="text-tone-green-ink mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="font-semibold">API key milik Anda</p>
                    <p className="text-muted-foreground text-sm">
                      Pilih Gemini, OpenAI, Anthropic, DeepSeek, atau OpenRouter.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            <ChatPreview />
          </div>
        </section>

        {/* Cara kerja sama */}
        <section id="cara-kerja" className="bg-card scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading
              title="Mulai dalam tiga langkah"
              text="Metode kerja sama fleksibel, disesuaikan dengan skala dan kebutuhan bisnis Anda."
            />
            <ol className="mt-12 grid gap-8 md:grid-cols-3">
              {STEPS.map(({ icon: Icon, title, text }, i) => (
                <li key={title}>
                  <div className="flex items-center gap-3">
                    <span className="bg-primary text-primary-foreground grid size-11 place-items-center rounded-full text-sm font-bold">
                      {i + 1}
                    </span>
                    <Icon className="text-loud size-6" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-2 text-sm text-pretty">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-bold">Pertanyaan yang sering diajukan</h2>
            <div className="bg-card mt-10 divide-y rounded-md border">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span
                      aria-hidden
                      className="text-muted-foreground text-xl leading-none transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm text-pretty">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA penutup */}
        <section className="bg-primary text-primary-foreground relative overflow-hidden">
          <div
            aria-hidden
            className="bg-loud/90 pointer-events-none absolute -right-24 -bottom-24 size-64 rounded-full"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
            <h2 className="text-3xl font-bold text-balance">
              Siap punya CRM sendiri, di server Anda sendiri?
            </h2>
            <p className="text-primary-foreground/85 mt-3">
              Data tetap milik Anda. Pantau setiap lead hingga konversi.
            </p>
            <CtaPairOnDark className="mt-8 justify-center" />
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm sm:flex-row sm:px-6">
          <Brand />
          <p className="text-muted-foreground">CRM white label di server Anda sendiri.</p>
          <div className="text-muted-foreground flex gap-5">
            <Link href={LOGIN} className="hover:text-foreground">
              Uji coba gratis
            </Link>
            <a href={MEETING_URL} {...EXTERNAL} className="hover:text-foreground">
              Jadwalkan meeting
            </a>
          </div>
        </div>
        <p className="text-muted-foreground mx-auto mt-6 max-w-6xl border-t px-4 pt-6 text-center text-xs sm:px-6">
          Powered by{" "}
          <a
            href="https://kebarakkoding.id"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground font-medium hover:underline"
          >
            kebarakkoding.id
          </a>
        </p>
      </footer>

      {/* Tombol WhatsApp mengambang */}
      <a
        href={WHATSAPP_URL}
        {...EXTERNAL}
        aria-label="Chat via WhatsApp"
        className="bg-tone-green shadow-popover fixed right-4 bottom-4 z-40 inline-flex h-14 items-center gap-2 rounded-full px-4 font-medium text-white transition-transform duration-200 hover:-translate-y-0.5 sm:right-6 sm:bottom-6 sm:px-5"
      >
        <MessageCircle className="size-6" />
        <span className="hidden sm:inline">Chat WhatsApp</span>
      </a>
    </div>
  );
}
