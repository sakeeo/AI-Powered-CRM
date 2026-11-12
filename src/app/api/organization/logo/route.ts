import { NextResponse, type NextRequest } from "next/server";
import { writeAudit } from "@/lib/audit";
import { assertCan } from "@/lib/authz";
import { getTenantContext } from "@/lib/context";
import { AppError, handleRouteError, UnauthorizedError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { deleteTenantObject, getTenantObject, putTenantObject } from "@/lib/storage";

const MAX_BYTES = 1024 * 1024; // 1 MB
/** SVG sengaja tidak diizinkan (dapat memuat skrip). */
const TYPES: Record<string, { ext: string; mime: string }> = {
  png: { ext: "png", mime: "image/png" },
  jpg: { ext: "jpg", mime: "image/jpeg" },
  webp: { ext: "webp", mime: "image/webp" },
};

/** Deteksi tipe dari byte awal (bukan dari nama/Content-Type kiriman klien). */
function sniff(b: Uint8Array) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return TYPES.png;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return TYPES.jpg;
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return TYPES.webp;
  return null;
}

/** Logo organisasi aktif (hanya anggota organisasi tersebut). */
export async function GET() {
  try {
    const ctx = await getTenantContext();
    if (!ctx) throw UnauthorizedError();
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { logo: true },
    });
    if (!org?.logo) return new NextResponse(null, { status: 404 });
    const path = org.logo.slice(ctx.organizationId.length + 1);
    const ext = path.split(".").pop() ?? "png";
    const body = await getTenantObject(ctx.organizationId, path);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": TYPES[ext]?.mime ?? "image/png",
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return handleRouteError(error, { scope: "organization.logo.get" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) throw UnauthorizedError();
    assertCan(ctx, "update", "Organization");
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("File logo wajib dipilih", 400);
    if (file.size === 0) throw new AppError("File kosong", 400);
    if (file.size > MAX_BYTES) throw new AppError("Ukuran logo maksimal 1 MB", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniff(bytes);
    if (!type) throw new AppError("Format logo harus PNG, JPG, atau WebP", 400);

    const before = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { logo: true },
    });
    const key = await putTenantObject(
      ctx.organizationId,
      `branding/logo.${type.ext}`,
      bytes,
      type.mime,
    );
    if (before?.logo && before.logo !== key) {
      await deleteTenantObject(
        ctx.organizationId,
        before.logo.slice(ctx.organizationId.length + 1),
      ).catch(() => {});
    }
    const org = await prisma.organization.update({
      where: { id: ctx.organizationId },
      data: { logo: key },
      select: { updatedAt: true },
    });
    await writeAudit(ctx, {
      action: "organization.logo_updated",
      entityType: "Organization",
      entityId: ctx.organizationId,
      after: { logo: key, size: file.size },
    });
    return NextResponse.json({
      ok: true,
      url: `/api/organization/logo?v=${org.updatedAt.getTime()}`,
    });
  } catch (error) {
    return handleRouteError(error, { scope: "organization.logo.post" });
  }
}

export async function DELETE() {
  try {
    const ctx = await getTenantContext();
    if (!ctx) throw UnauthorizedError();
    assertCan(ctx, "update", "Organization");
    const org = await prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { logo: true },
    });
    if (org?.logo) {
      await deleteTenantObject(
        ctx.organizationId,
        org.logo.slice(ctx.organizationId.length + 1),
      ).catch(() => {});
      await prisma.organization.update({ where: { id: ctx.organizationId }, data: { logo: null } });
      await writeAudit(ctx, {
        action: "organization.logo_removed",
        entityType: "Organization",
        entityId: ctx.organizationId,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, { scope: "organization.logo.delete" });
  }
}
