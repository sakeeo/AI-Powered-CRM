import { logger } from "@/lib/logger";
import { getQueue, QUEUES } from "@/lib/queue";
import type { CalendarJob } from "@/lib/google";

type Db = {
  googleIntegration: {
    findMany: (a: {
      where: { userId: { in: string[] }; syncCalendar: boolean; status: { not: string } };
      select: { id: true };
    }) => Promise<{ id: string }[]>;
  };
};

/**
 * Antre sinkronisasi activity → Google Calendar untuk pemilik terkait (yang punya koneksi aktif).
 * Dipanggil setelah activity dibuat/diubah/dihapus; tidak pernah menggagalkan aksi bisnis.
 */
export async function enqueueCalendarSync(
  db: Db,
  ownerIds: (string | null | undefined)[],
  activityId: string,
) {
  try {
    const users = [...new Set(ownerIds.filter((x): x is string => !!x))];
    if (!users.length) return;
    const integs = await db.googleIntegration.findMany({
      where: { userId: { in: users }, syncCalendar: true, status: { not: "revoked" } },
      select: { id: true },
    });
    for (const i of integs) {
      await getQueue(QUEUES.calendar).add(
        "push",
        { integrationId: i.id, activityId } satisfies CalendarJob,
        {
          jobId: `cal-${i.id}-${activityId}-${Date.now()}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 15_000 },
          removeOnComplete: 500,
          removeOnFail: 500,
        },
      );
    }
  } catch (err) {
    logger.error({ err, activityId }, "Gagal mengantre sinkronisasi kalender");
  }
}
