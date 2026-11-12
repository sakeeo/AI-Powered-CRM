import "dotenv/config";
import { Worker, type ConnectionOptions } from "bullmq";
import { logger } from "@/lib/logger";
import { deliverMail, type MailJob } from "@/lib/mailer";
import { createQueueConnection, getQueue, QUEUES } from "@/lib/queue";
import { runAutomations, scanAutomationTriggers, type AutomationEvent } from "@/lib/automation";
import { deliverOutbound, type OutboundJob } from "@/lib/outbound-webhooks";
import { pushActivity, syncAllGoogle, type CalendarJob } from "@/lib/google";
import { scanQuotations, scanReminders } from "@/lib/reminders";

/**
 * Proses worker terpisah dari aplikasi web: `npm run worker`.
 * - mail: kirim email lewat connector tenant (retry exponential backoff diatur saat job ditambahkan).
 * - reminders: pemindaian tiap menit untuk task segera jatuh tempo / terlambat.
 */
export function startWorkers() {
  const connection = createQueueConnection() as unknown as ConnectionOptions;
  const mail = new Worker<MailJob>(QUEUES.mail, (job) => deliverMail(job.data), {
    connection,
    concurrency: 5,
  });
  const reminders = new Worker(
    QUEUES.reminders,
    async () => {
      const now = new Date();
      await scanReminders(now);
      await scanQuotations(now);
      await scanAutomationTriggers(now);
    },
    {
      connection,
      concurrency: 1,
    },
  );
  const automation = new Worker<AutomationEvent>(
    QUEUES.automation,
    (job) => runAutomations(job.data),
    {
      connection,
      concurrency: 3,
    },
  );
  const outbound = new Worker<OutboundJob>(
    QUEUES.outbound,
    (job) => deliverOutbound(job.data, { final: job.attemptsMade + 1 >= (job.opts.attempts ?? 1) }),
    { connection, concurrency: 5 },
  );
  const calendar = new Worker<CalendarJob>(
    QUEUES.calendar,
    (job) => pushActivity(job.data.integrationId, job.data.activityId),
    { connection, concurrency: 3 },
  );
  const googleSync = new Worker(QUEUES.googleSync, () => syncAllGoogle(), {
    connection,
    concurrency: 1,
  });
  for (const w of [mail, reminders, automation, outbound, calendar, googleSync]) {
    w.on("failed", (job, err) =>
      logger.error(
        { queue: w.name, jobId: job?.id, attempt: job?.attemptsMade, err: err.message },
        "Job gagal",
      ),
    );
    w.on("error", (err) => logger.error({ queue: w.name, err: err.message }, "Worker error"));
  }
  return { workers: [mail, reminders, automation, outbound, calendar, googleSync], connection };
}

async function main() {
  const { workers } = startWorkers();
  await getQueue(QUEUES.reminders).upsertJobScheduler(
    "reminder-scan",
    { every: 60_000 },
    { name: "scan", opts: { removeOnComplete: true, removeOnFail: 100 } },
  );
  await getQueue(QUEUES.googleSync).upsertJobScheduler(
    "google-sync",
    { every: 5 * 60_000 },
    { name: "sync", opts: { removeOnComplete: true, removeOnFail: 100 } },
  );
  logger.info("Worker berjalan (mail, reminders, automation, outbound, calendar, google)");
  const stop = async () => {
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1]?.endsWith("worker/index.ts")) {
  main().catch((err) => {
    logger.error({ err }, "Worker gagal start");
    process.exit(1);
  });
}
