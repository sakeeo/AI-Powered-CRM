import type { Metadata } from "next";
import { LandingPage } from "@/modules/landing/components/landing-page";

// Halaman publik (tanpa login) sekaligus index. Pengguna yang sudah login dialihkan ke /dashboard oleh proxy.
export const metadata: Metadata = {
  title: { absolute: "Kerabat CRM — CRM white label di server Anda sendiri" },
  description:
    "Kerabat CRM: CRM white label yang dipasang di server atau VPS milik Anda. Data pelanggan tetap di bawah kendali Anda, tampil dengan brand Anda, dilengkapi AI.",
};

export default function Page() {
  return <LandingPage />;
}
