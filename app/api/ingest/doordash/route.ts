import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOARD = "doordashcanada";
const API_URL = `https://boards-api.greenhouse.io/v1/boards/${BOARD}/jobs`;

export async function POST(_req: NextRequest) {
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

    // Ensure source exists
    const source = await prisma.source.upsert({
      where: { name: "DoorDash Canada" },
      update: {},
      create: {
        name: "DoorDash Canada",
        type: "GREENHOUSE",
        orgIdentifier: BOARD,
      },
    });

    let created = 0;

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
        },
        create: {
          sourceId: source.id,
          externalId: String(job.id),
          title: job.title,
          company: "DoorDash",
          location: job.location?.name ?? "Unknown",
          url: job.absolute_url,
          snippet: job.content
            ? String(job.content).slice(0, 500)
            : null,
        },
      });

      created++;
    }

    return NextResponse.redirect(new URL("/dashboard", _req.url));
    
  } catch (e) {
    return NextResponse.json(
      { error: "Ingestion failed" },
      { status: 500 }
    );
  }
}