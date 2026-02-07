import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    // NAC uses Lever
    const companySlug = "nacsworld";
    const sourceName = "NAC (Lever)";
    const companyLabel = "NAC";

    const apiUrl = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      return NextResponse.json(
        { error: "NAC Lever board not found" },
        { status: 404 }
      );
    }

    const jobs = (await res.json()) as any[];

    const source = await prisma.source.upsert({
      where: { name: sourceName },
      update: { lastRunAt: new Date() },
      create: {
        name: sourceName,
        type: "LEVER",
        orgIdentifier: companySlug,
        lastRunAt: new Date(),
      },
    });

    for (const job of jobs) {
      const externalId = String(job.id ?? "");
      if (!externalId) continue;

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
          title: job.text ?? "Untitled",
          company: companyLabel,
          location: job.categories?.location ?? "Unknown",
          url: job.hostedUrl ?? "",
          snippet: job.description
            ? String(job.description).slice(0, 500)
            : null,
        },
      });
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Ingestion failed", message },
      { status: 500 }
    );
  }
}