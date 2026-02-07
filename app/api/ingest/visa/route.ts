import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const company = "Visa";
    const sourceName = "Visa (SmartRecruiters)";

    const source = await prisma.source.upsert({
      where: { name: sourceName },
      update: { lastRunAt: new Date() },
      create: {
        name: sourceName,
        type: "SMARTRECRUITERS",
        orgIdentifier: company,
        lastRunAt: new Date(),
      },
    });

    let fetched = 0;
    let processed = 0;

    // SmartRecruiters paginates with offset/limit
    const limit = 100;

    for (let offset = 0; offset < 5000; offset += limit) {
      const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings?offset=${offset}&limit=${limit}`;

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: "Failed to fetch SmartRecruiters postings", status: res.status },
          { status: 500 }
        );
      }

      const data: any = await res.json();
      const jobs: any[] = data.content ?? [];

      fetched += jobs.length;

      if (jobs.length === 0) break;

      for (const j of jobs) {
        const externalId = String(j.id);
        const title = String(j.name ?? "Untitled");

        // Build a stable public job URL
        // Many entries have a publicUrl in the API; if not, we use the UUID style
        const jobUrl =
          j.publicUrl ??
          (j.uuid
            ? `https://jobs.smartrecruiters.com/${company}/${j.uuid}`
            : `https://jobs.smartrecruiters.com/${company}`);

        const location =
          j.location?.city ||
          j.location?.region ||
          j.location?.country ||
          "Unknown";

        await prisma.job.upsert({
          where: {
            sourceId_externalId: {
              sourceId: source.id,
              externalId,
            },
          },
          update: {
            title,
            company,
            location,
            url: jobUrl,
            lastSeenAt: new Date(),
          },
          create: {
            sourceId: source.id,
            externalId,
            title,
            company,
            location,
            url: jobUrl,
            snippet: null,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        processed++;
      }

      // If API tells totalFound, stop once we pass it
      const totalFound = typeof data.totalFound === "number" ? data.totalFound : null;
      if (totalFound !== null && offset + limit >= totalFound) break;
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Ingestion failed", message }, { status: 500 });
  }
}