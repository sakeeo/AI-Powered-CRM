import type { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { forTenant } from "@/lib/tenant";
import {
  detectLeadInflowDrop,
  detectVipDrops,
  detectWinRateDrop,
  weekKey,
  type Anomaly,
  type PartyActivity,
} from "@/modules/intelligence/anomalies";

const DAY = 86_400_000;
/** Peran yang menerima notifikasi anomali tingkat organisasi / salinan anomali pelanggan. */
const NOTIFY_ROLES = ["owner", "admin", "sales_manager"];

/**
 * Kumpulkan anomali satu organisasi. Hanya MEMBACA data bisnis; menulis hanya `insight_alerts` dan `notifications`.
 */
export async function detectOrgAnomalies(organizationId: string, now = new Date()) {
  const db = forTenant(prisma, organizationId);
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { defaultCurrency: true },
  });
  const t = (days: number) => new Date(now.getTime() - days * DAY);

  // --- Customer VIP: total pembelian + interaksi (30 hari terakhir vs 90 hari sebelumnya) ---
  const won = await db.deal.findMany({
    where: { status: "won", deletedAt: null, currency: org.defaultCurrency },
    select: { id: true, value: true, companyId: true, contactId: true },
    take: 20_000,
  });
  const partyOfDeal = new Map<string, string>();
  const partyTotals = new Map<string, { type: "company" | "contact"; id: string; total: number }>();
  for (const d of won) {
    // Satu deal dihitung pada company-nya bila ada, jika tidak pada contact-nya (selaras daftar customer).
    const type = d.companyId ? "company" : d.contactId ? "contact" : null;
    if (!type) continue;
    const id = (d.companyId ?? d.contactId)!;
    const key = `${type}:${id}`;
    partyOfDeal.set(d.id, key);
    const cur = partyTotals.get(key) ?? { type, id, total: 0 };
    cur.total += Number(d.value);
    partyTotals.set(key, cur);
  }
  const activities = await db.activity.findMany({
    where: { status: "done", createdAt: { gte: t(120) } },
    select: { companyId: true, contactId: true, dealId: true, completedAt: true, createdAt: true },
    take: 50_000,
  });
  const messages = await db.message.findMany({
    where: { createdAt: { gte: t(120) }, conversation: { contactId: { not: null } } },
    select: { createdAt: true, conversation: { select: { contactId: true } } },
    take: 50_000,
  });
  const counts = new Map<string, { recent: number; baseline: number }>();
  const bump = (key: string, at: Date) => {
    const c = counts.get(key) ?? { recent: 0, baseline: 0 };
    if (at >= t(30)) c.recent++;
    else c.baseline++;
    counts.set(key, c);
  };
  for (const a of activities) {
    const at = a.completedAt ?? a.createdAt;
    const keys = new Set<string>();
    if (a.companyId) keys.add(`company:${a.companyId}`);
    if (a.contactId) keys.add(`contact:${a.contactId}`);
    if (a.dealId && partyOfDeal.has(a.dealId)) keys.add(partyOfDeal.get(a.dealId)!);
    for (const k of keys) bump(k, at);
  }
  for (const m of messages) bump(`contact:${m.conversation.contactId}`, m.createdAt);

  const ids = [...partyTotals.values()];
  const [companies, contacts] = await Promise.all([
    db.company.findMany({
      where: {
        id: { in: ids.filter((p) => p.type === "company").map((p) => p.id) },
        deletedAt: null,
      },
      select: { id: true, name: true, ownerId: true },
    }),
    db.contact.findMany({
      where: {
        id: { in: ids.filter((p) => p.type === "contact").map((p) => p.id) },
        deletedAt: null,
      },
      select: { id: true, name: true, ownerId: true },
    }),
  ]);
  const info = new Map([
    ...companies.map((c) => [`company:${c.id}`, c] as const),
    ...contacts.map((c) => [`contact:${c.id}`, c] as const),
  ]);
  const parties: PartyActivity[] = ids.flatMap((p) => {
    const i = info.get(`${p.type}:${p.id}`);
    if (!i) return [];
    const c = counts.get(`${p.type}:${p.id}`) ?? { recent: 0, baseline: 0 };
    return [
      {
        type: p.type,
        id: p.id,
        name: i.name,
        ownerId: i.ownerId,
        total: p.total,
        recent: c.recent,
        baseline90: c.baseline,
      },
    ];
  });

  // --- Win rate & aliran lead ---
  const closedIn = (from: Date, to: Date, status: string) =>
    db.deal.count({ where: { status, deletedAt: null, closedAt: { gte: from, lt: to } } });
  const [rw, rl, pw, pl, leadRecent, leadPrior] = await Promise.all([
    closedIn(t(30), now, "won"),
    closedIn(t(30), now, "lost"),
    closedIn(t(120), t(30), "won"),
    closedIn(t(120), t(30), "lost"),
    db.lead.count({ where: { createdAt: { gte: t(14) } } }),
    db.lead.count({ where: { createdAt: { gte: t(70), lt: t(14) } } }),
  ]);

  const anomalies: Anomaly[] = [
    ...detectVipDrops(parties),
    ...[
      detectWinRateDrop({ recentWon: rw, recentLost: rl, priorWon: pw, priorLost: pl }),
      detectLeadInflowDrop({ recent14: leadRecent, prior56: leadPrior }),
    ].filter((x): x is Anomaly => !!x),
  ];
  return anomalies;
}

/**
 * Pindai satu organisasi: simpan anomali baru (idempoten per subjek per pekan) + notifikasi in-app.
 * Tidak ada aksi otonom: tidak membuat task, tidak mengubah deal/customer/lead.
 */
export async function scanOrgInsights(organizationId: string, now = new Date()) {
  const db = forTenant(prisma, organizationId);
  const anomalies = await detectOrgAnomalies(organizationId, now);
  if (anomalies.length === 0) return { detected: 0, created: 0, notified: 0 };
  const wk = weekKey(now);
  const created = await db.insightAlert.createManyAndReturn({
    data: anomalies.map((a) => ({
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
      subjectType: a.subject?.type ?? null,
      subjectId: a.subject?.id ?? null,
      ownerId: a.subject?.ownerId ?? null,
      dedupeKey: `${a.key}:${wk}`,
      data: a.data as Prisma.InputJsonValue,
      detectedAt: now,
    })) as never,
    skipDuplicates: true,
    select: {
      id: true,
      kind: true,
      title: true,
      detail: true,
      subjectType: true,
      subjectId: true,
      ownerId: true,
      dedupeKey: true,
    },
  });
  if (created.length === 0) return { detected: anomalies.length, created: 0, notified: 0 };

  const members = await prisma.member.findMany({
    where: { organizationId, active: true },
    select: { userId: true, role: true },
  });
  const managers = members.filter((m) => NOTIFY_ROLES.includes(m.role)).map((m) => m.userId);
  const active = new Set(members.map((m) => m.userId));
  const prefs = await prisma.notificationPreference.findMany({ where: { organizationId } });
  const pref = new Map(prefs.map((p) => [p.userId, p]));
  const rows: Prisma.NotificationCreateManyInput[] = [];
  for (const a of created) {
    const to = new Set(managers);
    if (a.ownerId && active.has(a.ownerId)) to.add(a.ownerId);
    for (const userId of to)
      rows.push({
        organizationId,
        userId,
        type: "insight_anomaly",
        title: a.title,
        body: a.detail,
        link:
          a.subjectType && a.subjectId
            ? `/customers/${a.subjectType}/${a.subjectId}`
            : "/intelligence",
        dedupeKey: `insight:${a.dedupeKey}`,
        readAt: (pref.get(userId)?.inApp ?? true) ? null : now,
      });
  }
  const n = await prisma.notification.createMany({ data: rows, skipDuplicates: true });
  return { detected: anomalies.length, created: created.length, notified: n.count };
}

/** Dipanggil worker: pindai semua organisasi (error satu organisasi tidak menghentikan yang lain). */
export async function scanAllInsights(now = new Date()) {
  const orgs = await prisma.organization.findMany({
    where: { deletedAt: null },
    select: { id: true },
  });
  let created = 0;
  for (const o of orgs) {
    try {
      created += (await scanOrgInsights(o.id, now)).created;
    } catch (err) {
      logger.error({ err, organizationId: o.id }, "Pemindaian insight gagal");
    }
  }
  logger.info({ orgs: orgs.length, created }, "Insight dipindai");
  return { orgs: orgs.length, created };
}
