import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const dbInfo = await prisma.$queryRaw<
      Array<{ current_database: string; current_schema: string; server_addr: string | null }>
    >`
      SELECT
        current_database() as current_database,
        current_schema() as current_schema,
        inet_server_addr()::text as server_addr
    `;

    const nullCount = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*)::bigint as cnt
      FROM "Job"
      WHERE "companyName" IS NULL
    `;

    const sampleNulls = await prisma.$queryRaw<Array<{ id: string; companyName: string | null }>>`
      SELECT id, "companyName"
      FROM "Job"
      WHERE "companyName" IS NULL
      LIMIT 5
    `;

    return NextResponse.json({
      ok: true,
      dbInfo: dbInfo?.[0] ?? null,
      nullCompanyNameCount: Number(nullCount?.[0]?.cnt ?? 0),
      sampleNulls,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown" },
      { status: 500 }
    );
  }
}