import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getQueue, QUEUES } from "@/lib/queue";
import { forTenant } from "@/lib/tenant";
import { dateInTz } from "@/lib/timezone";
import { TRIGGER_ENTITY, type Trigger } from "@/modules/automation/constants";
import { actionSchema, type AutomationAction } from "@/modules/automation/schemas";

/**
 * Mesin workflow automation (plan 2.2). Berjalan di proses worker (lintas tenant → organizationId
 * selalu eksplisit lewat forTenant). Jaminan keamanan:
 *  - Idempotensi: (ruleId, eventKey) unik di DB → satu event tidak pernah dieksekusi dua kali per rule,
 *    sekalipun job diantre ulang atau dua worker berjalan.
 *  - Batas laju per rule per jam; kelebihan dicatat `rate_limited` (tanpa menjalankan aksi).
 *  - Aksi terbatas (assign owner, buat task, notifikasi) dan tidak memicu trigger lain → tidak ada loop.
 *  - Penerima/assignee wajib anggota aktif organisasi yang sama. Tidak ada aksi AI otonom.
 */
export type AutomationEvent = {
  organizationId: string;
  trigger: Trigger;
  entityId: string;
  /** Kunci unik kejadian, mis. `deal_won:<id>:<closedAt>`. */
  eventKey: string;
};

type Db = ReturnType<typeof forTenant>;

type EntityCtx = {
  type: "lead" | "deal" | "activity" | "quotation";
  id: string;
  label: string;
  ownerId: string | null;
  link: string;
  links: { leadId?: string; dealId?: string; contactId?: string; companyId?: string };
};

async function loadEntity(db: Db, event: AutomationEvent): Promise<EntityCtx | null> {
  const type = TRIGGER_ENTITY[event.trigger];
  const id = event.entityId;
  if (type === "lead") {
    const r = await db.lead.findFirst({ where: { id } });
    return (
      r && {
        type,
        id,
        label: r.name,
        ownerId: r.ownerId,
        link: `/leads/${id}`,
        links: { leadId: id },
      }
    );
  }
  if (type === "deal") {
    const r = await db.deal.findFirst({ where: { id, deletedAt: null } });
    return (
      r && {
        type,
        id,
        label: r.title,
        ownerId: r.ownerId,
        link: `/deals/${id}`,
        links: {
          dealId: id,
          contactId: r.contactId ?? undefined,
          companyId: r.companyId ?? undefined,
        },
      }
    );
  }
  if (type === "activity") {
    const r = await db.activity.findFirst({ where: { id } });
    return (
      r && {
        type,
        id,
        label: r.subject,
        ownerId: r.ownerId,
        link: "/activities",
        links: {
          leadId: r.leadId ?? undefined,
          dealId: r.dealId ?? undefined,
          contactId: r.contactId ?? undefined,
          companyId: r.companyId ?? undefined,
        },
      }
    );
  }
  const r = await db.quotation.findFirst({ where: { id, deletedAt: null } });
  return (
    r && {
      type,
      id,
      label: r.number,
      ownerId: r.ownerId,
      link: `/quotations/${id}`,
      links: {
        dealId: r.dealId ?? undefined,
        contactId: r.contactId ?? undefined,
        companyId: r.companyId ?? undefined,
      },
    }
  );
}

const fill = (tpl: string, e: EntityCtx) => tpl.replaceAll("{{name}}", e.label).slice(0, 500);

async function activeMember(db: Db, userId: string) {
  return !!(await db.member.findFirst({ where: { userId, active: true }, select: { id: true } }));
}

type ActionResult = { type: string; ok: boolean; message: string };

async function runAction(
  db: Db,
  rule: { id: string; runCount: number },
  event: AutomationEvent,
  index: number,
  action: AutomationAction,
  entity: EntityCtx,
  now: Date,
): Promise<ActionResult> {
  const recipientOf = (who: string) => (who === "owner" ? entity.ownerId : who);

  if (action.type === "assign_owner") {
    if (entity.type !== "lead" && entity.type !== "deal")
      return { type: action.type, ok: false, message: "Entitas tidak dapat ditugaskan" };
    if (action.onlyIfUnassigned && entity.ownerId)
      return { type: action.type, ok: true, message: "Dilewati: sudah memiliki owner" };
    const pick = action.userIds[rule.runCount % action.userIds.length];
    if (!(await activeMember(db, pick)))
      return { type: action.type, ok: false, message: "Pengguna bukan anggota aktif" };
    if (entity.type === "lead")
      await db.lead.update({ where: { id: entity.id }, data: { ownerId: pick } });
    else await db.deal.update({ where: { id: entity.id }, data: { ownerId: pick } });
    entity.ownerId = pick;
    return { type: action.type, ok: true, message: `Owner → ${pick}` };
  }

  if (action.type === "create_task") {
    const assignee = recipientOf(action.assignTo);
    if (!assignee) return { type: action.type, ok: true, message: "Dilewati: tidak ada penerima" };
    if (!(await activeMember(db, assignee)))
      return { type: action.type, ok: false, message: "Assignee bukan anggota aktif" };
    await db.activity.create({
      data: {
        type: "task",
        subject: fill(action.subject, entity).slice(0, 160),
        status: "open",
        dueAt: new Date(now.getTime() + action.dueInDays * 86_400_000),
        ownerId: assignee,
        createdBy: null,
        ...entity.links,
      } as never,
    });
    return { type: action.type, ok: true, message: "Task dibuat" };
  }

  const to = recipientOf(action.to);
  if (!to) return { type: action.type, ok: true, message: "Dilewati: tidak ada penerima" };
  if (!(await activeMember(db, to)))
    return { type: action.type, ok: false, message: "Penerima bukan anggota aktif" };
  await db.notification.createMany({
    data: [
      {
        userId: to,
        type: "automation",
        title: fill(action.title, entity).slice(0, 160),
        body: action.body ? fill(action.body, entity) : null,
        link: entity.link,
        dedupeKey: `auto:${rule.id}:${event.eventKey}:${index}`,
      },
    ] as never,
    skipDuplicates: true,
  });
  return { type: action.type, ok: true, message: "Notifikasi dikirim" };
}

const isUnique = (e: unknown) => (e as { code?: string })?.code === "P2002";

/** Jalankan semua rule aktif untuk satu event. Aman dipanggil berulang untuk event yang sama. */
export async function runAutomations(event: AutomationEvent, now = new Date()) {
  const db = forTenant(prisma, event.organizationId);
  const rules = await db.automationRule.findMany({
    where: { trigger: event.trigger, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  const out = { executed: 0, skipped: 0, rateLimited: 0, failed: 0 };
  if (!rules.length) return out;
  const entity = await loadEntity(db, event);

  for (const rule of rules) {
    // Batas laju: hitung eksekusi nyata dalam 1 jam terakhir.
    const recent = await db.automationRun.count({
      where: {
        ruleId: rule.id,
        status: { not: "rate_limited" },
        createdAt: { gte: new Date(now.getTime() - 3_600_000) },
      },
    });
    if (recent >= rule.maxPerHour) {
      const bucket = Math.floor(now.getTime() / 3_600_000);
      try {
        await db.automationRun.create({
          data: {
            ruleId: rule.id,
            trigger: event.trigger,
            entityType: TRIGGER_ENTITY[event.trigger],
            entityId: event.entityId,
            eventKey: `rl:${event.eventKey}:${bucket}`,
            status: "rate_limited",
            error: `Melebihi batas ${rule.maxPerHour} eksekusi/jam`,
          } as never,
        });
      } catch (e) {
        if (!isUnique(e)) throw e;
      }
      out.rateLimited++;
      continue;
    }

    // Klaim event: insert unik = kunci idempotensi.
    let runId: string;
    try {
      const run = await db.automationRun.create({
        data: {
          ruleId: rule.id,
          trigger: event.trigger,
          entityType: TRIGGER_ENTITY[event.trigger],
          entityId: event.entityId,
          eventKey: event.eventKey,
          status: "running",
        } as never,
      });
      runId = run.id;
    } catch (e) {
      if (isUnique(e)) {
        out.skipped++;
        continue;
      }
      throw e;
    }

    const results: ActionResult[] = [];
    let error: string | null = null;
    try {
      if (!entity) throw new Error("Data pemicu tidak ditemukan");
      const actions = (rule.actions as unknown[]).map((a) => actionSchema.parse(a));
      for (const [i, action] of actions.entries()) {
        const res = await runAction(db, rule, event, i, action, entity, now);
        results.push(res);
        if (!res.ok) {
          error = res.message;
          break;
        }
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Kesalahan tak dikenal";
    }
    await db.automationRun.update({
      where: { id: runId },
      data: {
        status: error ? "failed" : "success",
        results: results as unknown as Prisma.InputJsonValue,
        error,
      },
    });
    if (error) {
      out.failed++;
      logger.warn({ ruleId: rule.id, error }, "Automation gagal");
    } else {
      out.executed++;
      await db.automationRule.update({
        where: { id: rule.id },
        data: { runCount: { increment: 1 } },
      });
    }
  }
  return out;
}

/**
 * Antre event bisnis ke worker. Dipanggil dari aksi (lead dibuat, deal Won) SETELAH data tersimpan;
 * kegagalan antrean tidak pernah menggagalkan operasi bisnis. Hanya mengantre bila ada rule aktif.
 * `jobId` deterministik → BullMQ sendiri membuang job duplikat (lapis kedua selain kunci DB).
 */
export async function emitAutomationEvent(
  db: {
    automationRule: {
      count: (a: { where: { trigger: string; isActive: boolean } }) => Promise<number>;
    };
  },
  event: AutomationEvent,
) {
  try {
    if (!(await db.automationRule.count({ where: { trigger: event.trigger, isActive: true } })))
      return;
    await getQueue(QUEUES.automation).add("event", event, {
      jobId: `${event.organizationId}-${event.trigger}-${event.eventKey}`.replaceAll(":", "-"),
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    });
  } catch (err) {
    logger.error({ err, trigger: event.trigger }, "Gagal mengantre event automation");
  }
}

const SCAN_WINDOW_MS = 7 * 86_400_000;
const QUOTATION_WARN_DAYS = 3;

/** Pemindaian trigger berbasis waktu: task jatuh tempo & quotation mendekati kedaluwarsa. */
export async function scanAutomationTriggers(now = new Date()) {
  const orgs = await prisma.automationRule.findMany({
    where: { isActive: true, trigger: { in: ["task_due", "quotation_expiring"] } },
    select: { organizationId: true, trigger: true },
    distinct: ["organizationId", "trigger"],
  });
  let events = 0;
  for (const { organizationId, trigger } of orgs) {
    if (trigger === "task_due") {
      const tasks = await prisma.activity.findMany({
        where: {
          organizationId,
          type: "task",
          status: "open",
          dueAt: { lte: now, gt: new Date(now.getTime() - SCAN_WINDOW_MS) },
        },
        select: { id: true, dueAt: true },
        take: 500,
      });
      for (const t of tasks) {
        await runAutomations(
          {
            organizationId,
            trigger: "task_due",
            entityId: t.id,
            eventKey: `task_due:${t.id}:${t.dueAt!.getTime()}`,
          },
          now,
        );
        events++;
      }
    } else {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const today = dateInTz(now, org?.timezone ?? "UTC");
      const quotes = await prisma.quotation.findMany({
        where: { organizationId, status: "sent", deletedAt: null },
        select: { id: true, validUntil: true },
        take: 500,
      });
      for (const q of quotes) {
        const until = q.validUntil.toISOString().slice(0, 10);
        const daysLeft = Math.round((Date.parse(until) - Date.parse(today)) / 86_400_000);
        if (daysLeft < 0 || daysLeft > QUOTATION_WARN_DAYS) continue;
        await runAutomations(
          {
            organizationId,
            trigger: "quotation_expiring",
            entityId: q.id,
            eventKey: `quotation_expiring:${q.id}:${until}`,
          },
          now,
        );
        events++;
      }
    }
  }
  return { events };
}
