import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.$queryRaw`
    SELECT id, company, "companyName" 
    FROM "Job" 
    WHERE "companyName" IS NULL 
    LIMIT 5
  `;
  return NextResponse.json({ nullJobs: jobs });
}
