import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** Session valid (diverifikasi ke database) atau null. Memakai request headers → dinamis. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Guard server-side untuk halaman privat; pengalihan optimistik ada di src/proxy.ts. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
