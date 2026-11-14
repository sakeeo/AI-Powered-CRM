import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { actAs, addUserWithRole, makeOrg } from "../helpers/auth";
import { resetDb, testPrisma } from "../helpers/db";

const { redis } = await import("@/lib/redis");
const { getTenantContext } = await import("@/lib/context");
const leadActions = await import("@/modules/leads/server/actions");
const { convertLeadService, getConversionSuggestions } =
  await import("@/modules/leads/server/conversion");
const contactActions = await import("@/modules/contacts/server/actions");
const companyActions = await import("@/modules/companies/server/actions");
const dealActions = await import("@/modules/deals/server/actions");
const dup = await import("@/modules/duplicates/server/actions");
const { normalizePhone } = await import("@/lib/phone");

const idOf = (r: unknown) => (r as { data: { id: string } }).data.id;
const dataOf = <T>(r: unknown) => (r as { data: T }).data;
const ctxNow = async () => (await getTenantContext())!;

async function qualifiedLead(over: Record<string, unknown> = {}) {
  const id = idOf(
    await leadActions.createLead({
      name: "Andi Konversi",
      email: "andi@konversi.com",
      phone: "0812-3456-7890",
      companyName: "PT Konversi",
      needs: "Sistem ERP",
      budget: "5000000",
      ...over,
    }),
  );
  await leadActions.setLeadStatus({ id, status: "qualified" });
  return id;
}

beforeEach(resetDb);
afterAll(async () => {
  await redis.quit();
  await testPrisma.$disconnect();
});

describe("normalisasi telepon", () => {
  it("menyamakan format lokal & internasional", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("(0812) 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
  });
});

describe("deteksi duplikat (hanya peringatan)", () => {
  it("lead: email, telepon (beda format), nama+perusahaan terdeteksi; tidak ada auto-merge", async () => {
    await makeOrg("Org A");
    const first = idOf(
      await leadActions.createLead({
        name: "Budi",
        email: "Budi@X.com",
        phone: "0812 111 2222",
        companyName: "PT X",
      }),
    );
    const byEmail = dataOf<{ id: string; reasons: string[] }[]>(
      await dup.checkDuplicates({ entity: "lead", name: "Lain", email: "budi@x.com" }),
    );
    expect(byEmail.map((m) => m.id)).toEqual([first]);
    expect(byEmail[0].reasons).toEqual(["email"]);
    const byPhone = dataOf<{ id: string }[]>(
      await dup.checkDuplicates({ entity: "lead", name: "Lain", phone: "+62 812-111-2222" }),
    );
    expect(byPhone.map((m) => m.id)).toEqual([first]);
    const byName = dataOf<{ reasons: string[] }[]>(
      await dup.checkDuplicates({ entity: "lead", name: "budi", companyName: "pt x" }),
    );
    expect(byName[0].reasons).toEqual(["name_company"]);
    // nama saja tanpa perusahaan bukan duplikat
    expect(dataOf<unknown[]>(await dup.checkDuplicates({ entity: "lead", name: "Budi" }))).toEqual(
      [],
    );
    // excludeId mengabaikan record sendiri
    expect(
      dataOf<unknown[]>(
        await dup.checkDuplicates({ entity: "lead", email: "budi@x.com", excludeId: first }),
      ),
    ).toEqual([]);
    // tidak ada yang digabung/dihapus otomatis
    await leadActions.createLead({ name: "Budi Dua", email: "budi@x.com" });
    expect(await testPrisma.lead.count({ where: { archivedAt: null, mergedIntoId: null } })).toBe(
      2,
    );
  });

  it("contact: email, telepon, nama+company yang sama; company: nama/domain", async () => {
    await makeOrg("Org A");
    const co = idOf(
      await companyActions.createCompany({
        name: "PT Maju",
        website: "https://www.maju.co.id/about",
      }),
    );
    const c1 = idOf(
      await contactActions.createContact({
        name: "Sari",
        email: "sari@maju.co.id",
        phone: "0811 222 333",
        companyIds: [co],
      }),
    );
    expect(
      dataOf<{ id: string }[]>(
        await dup.checkDuplicates({ entity: "contact", email: "SARI@maju.co.id" }),
      ).map((m) => m.id),
    ).toEqual([c1]);
    expect(
      dataOf<{ id: string }[]>(
        await dup.checkDuplicates({ entity: "contact", phone: "+62811222333" }),
      ).map((m) => m.id),
    ).toEqual([c1]);
    expect(
      dataOf<{ id: string }[]>(
        await dup.checkDuplicates({ entity: "contact", name: "sari", companyIds: [co] }),
      ).map((m) => m.id),
    ).toEqual([c1]);
    expect(
      dataOf<unknown[]>(await dup.checkDuplicates({ entity: "contact", name: "sari" })),
    ).toEqual([]);
    expect(
      dataOf<{ id: string }[]>(
        await dup.checkDuplicates({ entity: "company", name: "pt maju" }),
      ).map((m) => m.id),
    ).toEqual([co]);
    expect(
      dataOf<{ id: string }[]>(
        await dup.checkDuplicates({ entity: "company", name: "Lain", website: "maju.co.id" }),
      ).map((m) => m.id),
    ).toEqual([co]);
  });

  it("tidak membocorkan record yang tak boleh dilihat (rep) maupun milik tenant lain", async () => {
    const a = await makeOrg("Org A");
    await leadActions.createLead({ name: "Rahasia", email: "rahasia@x.com" });
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(
      dataOf<unknown[]>(await dup.checkDuplicates({ entity: "lead", email: "rahasia@x.com" })),
    ).toEqual([]);
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(
      dataOf<unknown[]>(await dup.checkDuplicates({ entity: "lead", email: "rahasia@x.com" })),
    ).toEqual([]);
  });
});

describe("merge manual", () => {
  it("contact: memindahkan company & deal, mengisi field kosong, menggabung catatan, arsip yang digabung", async () => {
    await makeOrg("Org A");
    const co1 = idOf(await companyActions.createCompany({ name: "PT Satu" }));
    const co2 = idOf(await companyActions.createCompany({ name: "PT Dua" }));
    const keep = idOf(
      await contactActions.createContact({ name: "Budi", notes: "Catatan A", companyIds: [co1] }),
    );
    const dupId = idOf(
      await contactActions.createContact({
        name: "Budi S",
        email: "budi@x.com",
        phone: "0812 000 111",
        notes: "Catatan B",
        companyIds: [co1, co2],
      }),
    );
    const deal = idOf(await dealActions.createDeal({ title: "Deal Dup", contactId: dupId }));

    expect((await dup.mergeContacts({ keepId: keep, mergeId: dupId, fillEmpty: true })).ok).toBe(
      true,
    );
    const kept = await testPrisma.contact.findUniqueOrThrow({
      where: { id: keep },
      include: { companies: true },
    });
    expect(kept.email).toBe("budi@x.com");
    expect(kept.phoneNormalized).toBe("62812000111");
    expect(kept.notes).toContain("Catatan A");
    expect(kept.notes).toContain("Catatan B");
    expect(kept.companies.map((c) => c.companyId).sort()).toEqual([co1, co2].sort());
    expect((await testPrisma.deal.findUniqueOrThrow({ where: { id: deal } })).contactId).toBe(keep);
    const gone = await testPrisma.contact.findUniqueOrThrow({ where: { id: dupId } });
    expect(gone.deletedAt).not.toBeNull();
    expect(gone.mergedIntoId).toBe(keep);
    expect(await testPrisma.auditLog.count({ where: { action: "contact.merged" } })).toBe(1);
  });

  it("validasi: record sama ditolak; izin Sales Rep dipatuhi; lead terkonversi tak bisa digabung", async () => {
    const { orgId } = await makeOrg("Org A");
    const c1 = idOf(await contactActions.createContact({ name: "Kontak Owner 1" }));
    const c2 = idOf(await contactActions.createContact({ name: "Kontak Owner 2" }));
    expect(await dup.mergeContacts({ keepId: c1, mergeId: c1, fillEmpty: true })).toMatchObject({
      ok: false,
    });
    const rep = await addUserWithRole(orgId, "sales_rep", "Rep");
    actAs(rep);
    expect(await dup.mergeContacts({ keepId: c1, mergeId: c2, fillEmpty: true })).toEqual({
      ok: false,
      error: "Akses ditolak",
    });
  });

  it("lead: arsipkan yang digabung, isi field kosong; terkonversi ditolak; company: pindahkan contact", async () => {
    const { owner } = await makeOrg("Org A");
    void owner;
    const keep = idOf(await leadActions.createLead({ name: "Lead Keep" }));
    const dupLead = idOf(
      await leadActions.createLead({ name: "Lead Dup", email: "dup@x.com", needs: "Butuh CRM" }),
    );
    expect((await dup.mergeLeads({ keepId: keep, mergeId: dupLead, fillEmpty: true })).ok).toBe(
      true,
    );
    const k = await testPrisma.lead.findUniqueOrThrow({ where: { id: keep } });
    expect(k.email).toBe("dup@x.com");
    expect(k.needs).toBe("Butuh CRM");
    expect((await testPrisma.lead.findUniqueOrThrow({ where: { id: dupLead } })).mergedIntoId).toBe(
      keep,
    );

    const conv = await qualifiedLead({ email: "conv@x.com", phone: "0899 123 4567" });
    const other = idOf(await leadActions.createLead({ name: "Lead Lain" }));
    await convertLeadService(
      { ...(await ctxNow()), ip: null, userAgent: null },
      {
        leadId: conv,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      },
    );
    expect(await dup.mergeLeads({ keepId: other, mergeId: conv, fillEmpty: true })).toMatchObject({
      ok: false,
    });

    const co1 = idOf(await companyActions.createCompany({ name: "PT Keep" }));
    const co2 = idOf(await companyActions.createCompany({ name: "PT Dup", website: "dup.com" }));
    const ct = idOf(
      await contactActions.createContact({ name: "Orang PT Dup", companyIds: [co2] }),
    );
    expect((await dup.mergeCompanies({ keepId: co1, mergeId: co2, fillEmpty: true })).ok).toBe(
      true,
    );
    expect(
      (await testPrisma.contactCompany.findFirstOrThrow({ where: { contactId: ct } })).companyId,
    ).toBe(co1);
    expect((await testPrisma.company.findUniqueOrThrow({ where: { id: co1 } })).website).toBe(
      "dup.com",
    );
  });
});

describe("konversi lead", () => {
  const svc = async (input: Parameters<typeof convertLeadService>[1]) =>
    convertLeadService({ ...(await ctxNow()), ip: null, userAgent: null }, input);

  it("membuat contact + company + deal sekaligus, menautkan riwayat ke lead", async () => {
    await makeOrg("Org A");
    const leadId = await qualifiedLead();
    const res = await leadActions.convertLead({
      leadId,
      contact: { mode: "create" },
      company: { mode: "create" },
      deal: { create: true },
    });
    expect(res.ok).toBe(true);
    const { contactId, companyId, dealId } = dataOf<{
      contactId: string;
      companyId: string;
      dealId: string;
    }>(res);
    const contact = await testPrisma.contact.findUniqueOrThrow({
      where: { id: contactId },
      include: { companies: true },
    });
    expect(contact).toMatchObject({
      name: "Andi Konversi",
      email: "andi@konversi.com",
      phoneNormalized: "6281234567890",
    });
    expect(contact.companies[0]).toMatchObject({ companyId, isPrimary: true });
    expect((await testPrisma.company.findUniqueOrThrow({ where: { id: companyId } })).name).toBe(
      "PT Konversi",
    );
    const deal = await testPrisma.deal.findUniqueOrThrow({
      where: { id: dealId },
      include: { stage: true },
    });
    expect(deal).toMatchObject({
      contactId,
      companyId,
      sourceLeadId: leadId,
      status: "open",
      currency: "IDR",
    });
    expect(deal.value.toFixed(2)).toBe("5000000.00"); // budget lead → nilai deal
    expect(deal.stage.name).toBe("New Opportunity");
    const lead = await testPrisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead).toMatchObject({
      convertedContactId: contactId,
      convertedCompanyId: companyId,
      convertedDealId: dealId,
    });
    expect(lead.convertedAt).not.toBeNull();
    // tidak bisa dikonversi dua kali
    expect(
      await leadActions.convertLead({
        leadId,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
  });

  it("menautkan contact & company yang sudah ada tanpa membuat duplikat; saran pencocokan tersedia", async () => {
    await makeOrg("Org A");
    const co = idOf(await companyActions.createCompany({ name: "PT Konversi" }));
    const ct = idOf(
      await contactActions.createContact({ name: "Andi Lama", email: "andi@konversi.com" }),
    );
    const leadId = await qualifiedLead();
    const sug = await getConversionSuggestions(await ctxNow(), leadId);
    expect(sug.contacts.map((c) => c.id)).toEqual([ct]);
    expect(sug.companies.map((c) => c.id)).toEqual([co]);

    const res = await leadActions.convertLead({
      leadId,
      contact: { mode: "link", contactId: ct },
      company: { mode: "link", companyId: co },
      deal: { create: true, title: "Proyek ERP Andi", value: "9000000.50", currency: "USD" },
    });
    expect(res.ok).toBe(true);
    expect(await testPrisma.contact.count()).toBe(1);
    expect(await testPrisma.company.count()).toBe(1);
    expect(await testPrisma.contactCompany.count({ where: { contactId: ct, companyId: co } })).toBe(
      1,
    );
    const deal = await testPrisma.deal.findFirstOrThrow({});
    expect(deal).toMatchObject({
      title: "Proyek ERP Andi",
      currency: "USD",
      contactId: ct,
      companyId: co,
    });
    expect(deal.value.toFixed(2)).toBe("9000000.50");
  });

  it("aturan: harus Qualified, tidak arsip, minimal contact/company, link harus valid", async () => {
    await makeOrg("Org A");
    const fresh = idOf(await leadActions.createLead({ name: "Masih New", companyName: "PT Baru" }));
    expect(
      await leadActions.convertLead({
        leadId: fresh,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
    const q1 = await qualifiedLead({ email: "q1@x.com", phone: "0811 9999 000" });
    expect(
      await leadActions.convertLead({
        leadId: q1,
        contact: { mode: "none" },
        company: { mode: "none" },
        deal: { create: true },
      }),
    ).toMatchObject({ ok: false });
    expect(
      await leadActions.convertLead({
        leadId: q1,
        contact: { mode: "link", contactId: "00000000-0000-4000-8000-000000000000" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
    const noCompany = idOf(await leadActions.createLead({ name: "Tanpa Perusahaan" }));
    await leadActions.setLeadStatus({ id: noCompany, status: "qualified" });
    expect(
      await leadActions.convertLead({
        leadId: noCompany,
        contact: { mode: "none" },
        company: { mode: "create" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
    await leadActions.archiveLead({ id: q1 });
    expect(
      await leadActions.convertLead({
        leadId: q1,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
  });

  it("ATOMIK: gagal di tengah transaksi → tidak ada contact/company/deal tersisa dan lead tidak berubah", async () => {
    await makeOrg("Org A");
    const leadId = await qualifiedLead();
    // Menyimpan lead dengan nama perusahaan baru otomatis membuat company → hitung sebelum konversi.
    const companiesBefore = await testPrisma.company.count();
    // currency terlalu panjang lolos validasi Zod (service dipanggil langsung) tetapi ditolak database saat membuat deal,
    // SETELAH company dan contact dibuat di transaksi yang sama.
    await expect(
      svc({
        leadId,
        contact: { mode: "create" },
        company: { mode: "create" },
        deal: { create: true, currency: "TOOLONGCURRENCY" as never },
      }),
    ).rejects.toBeTruthy();
    expect(await testPrisma.contact.count()).toBe(0);
    expect(await testPrisma.company.count()).toBe(companiesBefore);
    expect(await testPrisma.deal.count()).toBe(0);
    expect(await testPrisma.contactCompany.count()).toBe(0);
    const lead = await testPrisma.lead.findUniqueOrThrow({ where: { id: leadId } });
    expect(lead.convertedAt).toBeNull();
    expect(lead.convertedContactId).toBeNull();
    // setelah gagal, konversi normal masih bisa dilakukan
    expect(
      (
        await leadActions.convertLead({
          leadId,
          contact: { mode: "create" },
          company: { mode: "none" },
          deal: { create: false },
        })
      ).ok,
    ).toBe(true);
  });

  it("izin & isolasi: rep hanya konversi leadnya; viewer tidak; tenant lain tidak bisa", async () => {
    const a = await makeOrg("Org A");
    const leadId = await qualifiedLead();
    const rep = await addUserWithRole(a.orgId, "sales_rep", "Rep");
    const viewer = await addUserWithRole(a.orgId, "viewer", "Viewer");
    actAs(rep);
    expect(
      await leadActions.convertLead({
        leadId,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
    actAs(viewer);
    expect(
      await leadActions.convertLead({
        leadId,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toEqual({ ok: false, error: "Akses ditolak" });
    const b = await makeOrg("Org B");
    actAs(b.owner);
    expect(
      await leadActions.convertLead({
        leadId,
        contact: { mode: "create" },
        company: { mode: "none" },
        deal: { create: false },
      }),
    ).toMatchObject({ ok: false });
    expect(await testPrisma.contact.count()).toBe(0);
  });
});
