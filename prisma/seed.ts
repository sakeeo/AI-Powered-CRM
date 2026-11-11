import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Company", slug: "demo" },
  });
  console.log(`Seed OK — organisasi demo: ${org.name} (${org.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
