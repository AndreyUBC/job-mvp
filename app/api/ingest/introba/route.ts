import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // Workday tenant + site from your URL
    const tenant = "gi";
    const host = "gi.wd1.myworkdayjobs.com";
    const site = "Global_Infrastructure";
    const locale = "en-US";

    const sourceName = "Introba (Workday)";
    const companyLabel = "Introba";

    const apiUrl = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;

    const source = await prisma.source.upsert({
      where: { name: sourceName },
      update: { lastRunAt: new Date() },
      create: {
        name: sourceName,
        type: "WORKDAY",
        orgIdentifier: `${tenant}/${site}`,
        lastRunAt: new Date(),
      },
    });

    let fetchedTotal = 0;
    let processedTotal = 0;

    const limit = 20;
    let offset = 0;

    // pull multiple pages (cap to avoid infinite loops)
    for (let page = 0; page < 50; page++) {
      const body = {
        appliedFacets: {},
        limit,
        offset,
        searchText: "", // keep empty for "all jobs"
      };

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: `https://${host}`,
          Referer: `https://${host}/${locale}/${site}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: "Workday fetch failed", status: res.status },
          { status: 500 }
        );
      }

      const data: any = await res.json();

      // Workday typically returns an array here; key name can vary slightly by tenant
      const postings: any[] =
        data.jobPostings ?? data.jobs ?? data.postings ?? [];

      fetchedTotal += postings.length;

      if (!postings.length) break;

      for (const j of postings) {
        const externalId = String(
          j.bulletFields?.find?.((x: any) => x.id === "jobId")?.value ??
            j.jobId ??
            j.id ??
            j.externalPath ??
            ""
        );
        if (!externalId) continue;

        const title = String(j.title ?? j.jobTitle ?? "Untitled");

        // Workday commonly gives `externalPath` for the posting page
        const externalPath = String(j.externalPath ?? "");
        const url = externalPath
          ? `https://${host}/${locale}/${site}${externalPath.startsWith("/") ? "" : "/"}${externalPath}`
          : `https://${host}/${locale}/${site}`;

        // location can appear in different fields depending on tenant config
        const location =
          String(j.locationsText ?? j.location ?? j.primaryLocation ?? "Unknown");

        await prisma.job.upsert({
          where: {
            sourceId_externalId: {
              sourceId: source.id,
              externalId,
            },
          },
          update: { lastSeenAt: new Date() },
          create: {
            sourceId: source.id,
            externalId,
            title,
            company: companyLabel,
            location,
            url,
            snippet: null,
          },
        });

        processedTotal++;
      }

      offset += limit;
    }

    // Redirect back to dashboard (like your other ingest routes)
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Ingestion failed", message }, { status: 500 });
  }
}