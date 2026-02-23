import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOARD = "doordashcanada";
const SOURCE_NAME = "DoorDash Canada"; // must be UNIQUE per route
const COMPANY_NAME = "DoorDash"; // what shows in the UI
const API_URL = `https://boards-api.greenhouse.io/v1/boards/${BOARD}/jobs`;

export async function POST(req: NextRequest) {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch Greenhouse jobs" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const jobs = data.jobs ?? [];

    // Ensure source exists (unique per route via SOURCE_NAME)
    const source = await prisma.source.upsert({
      where: { name: SOURCE_NAME },
      update: {
        type: "GREENHOUSE",
        orgIdentifier: BOARD,
      },
      create: {
        name: SOURCE_NAME,
        type: "GREENHOUSE",
        orgIdentifier: BOARD,
      },
    });

    for (const job of jobs) {
      await prisma.job.upsert({
        where: {
          sourceId_externalId: {
            sourceId: source.id,
            externalId: String(job.id),
          },
        },
        update: {
          lastSeenAt: new Date(),
          // optional: update these too in case they change
          title: job.title,
          company: COMPANY_NAME,
          location: job.location?.name ?? "Unknown",
          url: job.absolute_url,
          snippet: job.content ? String(job.content).slice(0, 500) : null,
        },
        create: {
          sourceId: source.id,
          externalId: String(job.id),
          title: job.title,
          company: COMPANY_NAME,
          location: job.location?.name ?? "Unknown",
          url: job.absolute_url,
          snippet: job.content ? String(job.content).slice(0, 500) : null,
        },
      });
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    console.error("Ingestion failed:", e);
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}