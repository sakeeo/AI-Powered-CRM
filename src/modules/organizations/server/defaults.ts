import { prisma } from "@/lib/prisma";
import { DEFAULT_LEAD_SOURCES } from "@/modules/leads/constants";

/**
 * Data bawaan untuk organisasi baru (idempoten). Plan berikutnya menambahkan pipeline default.
 * Dipanggil saat onboarding; query terkait juga memanggil versi "ensure" untuk organisasi lama.
 */
export async function seedOrganizationDefaults(organizationId: string) {
  await prisma.leadSource.createMany({
    data: DEFAULT_LEAD_SOURCES.map((s) => ({
      organizationId,
      name: s.name,
      isSystem: !!s.isSystem,
    })),
    skipDuplicates: true,
  });
}
