import { NextResponse, type NextRequest } from "next/server";
import { getTenantContext } from "@/lib/context";
import { buildAuthUrl, googleConfigured, signState } from "@/lib/google";

/** Mulai OAuth Google untuk pengguna yang sedang login (state bertanda tangan, berlaku 10 menit). */
export async function GET(req: NextRequest) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", req.url));
  if (!googleConfigured())
    return NextResponse.redirect(new URL("/settings/integrations?google=unconfigured", req.url));
  const withEmail = req.nextUrl.searchParams.get("email") === "1";
  const state = signState({ u: ctx.userId, o: ctx.organizationId, e: withEmail });
  return NextResponse.redirect(buildAuthUrl(state, withEmail));
}
