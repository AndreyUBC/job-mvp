import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const nullJobs = await prisma.$queryRaw`
    SELECT id, company, "companyName" FROM "Job" WHERE "companyName" IS NULL LIMIT 5
  `;
  const nullSources = await prisma.$queryRaw`
    SELECT id, name, "companyName" FROM "Source" WHERE "companyName" IS NULL LIMIT 5
  `;
  const jobCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Job"`;
  const sourceCount = await prisma.$queryRaw`SELECT COUNT(*) FROM "Source"`;
  
  return NextResponse.json({ nullJobs, nullSources, jobCount, sourceCount });
}
