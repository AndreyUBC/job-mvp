import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function ingestGreenhouse(
  sourceId: string,
  orgIdentifier: string,
  companyName: string
) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${orgIdentifier}/jobs`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Greenhouse fetch failed: ${orgIdentifier}`);

  const data = await res.json();
  const jobs = data.jobs ?? [];

  for (const job of jobs) {
    await prisma.job.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: String(job.id),
        },
      },
      update: {
        lastSeenAt: new Date(),
        title: job.title,
        location: job.location?.name ?? "Unknown",
        url: job.absolute_url,
        snippet: job.content ? String(job.content).slice(0, 500) : null,
        company: companyName,
      },
      create: {
        sourceId,
        externalId: String(job.id),
        title: job.title,
        company: companyName,
        location: job.location?.name ?? "Unknown",
        url: job.absolute_url,
        snippet: job.content ? String(job.content).slice(0, 500) : null,
      },
    });
  }

  return jobs.length;
}

async function ingestLever(
  sourceId: string,
  orgIdentifier: string,
  companyName: string
) {
  const url = `https://api.lever.co/v0/postings/${orgIdentifier}?mode=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Lever fetch failed: ${orgIdentifier}`);

  const jobs = await res.json(); // Lever returns array
  const arr = Array.isArray(jobs) ? jobs : [];

  for (const job of arr) {
    await prisma.job.upsert({
      where: {
        sourceId_externalId: {
          sourceId,
          externalId: String(job.id),
        },
      },
      update: {
        lastSeenAt: new Date(),
        title: job.text ?? job.title ?? "Untitled",
        location: job.categories?.location ?? job.location ?? "Unknown",
        url: job.hostedUrl ?? job.applyUrl ?? job.url ?? "",
        snippet: job.descriptionPlain
          ? String(job.descriptionPlain).slice(0, 500)
          : job.description
          ? String(job.description).slice(0, 500)
          : null,
        company: companyName,
      },
      create: {
        sourceId,
        externalId: String(job.id),
        title: job.text ?? job.title ?? "Untitled",
        company: companyName,
        location: job.categories?.location ?? job.location ?? "Unknown",
        url: job.hostedUrl ?? job.applyUrl ?? job.url ?? "",
        snippet: job.descriptionPlain
          ? String(job.descriptionPlain).slice(0, 500)
          : job.description
          ? String(job.description).slice(0, 500)
          : null,
      },
    });
  }

  return arr.length;
}

async function runAllIngest() {
  const sources = await prisma.source.findMany({
    where: { enabled: true },
    select: { id: true, type: true, orgIdentifier: true, name: true },
  });

  const results: Array<{
    name: string;
    type: string;
    count: number;
    ok: boolean;
    error?: string;
  }> = [];

  for (const s of sources) {
    try {
      let count = 0;

      if (s.type === "GREENHOUSE") {
        count = await ingestGreenhouse(s.id, s.orgIdentifier, s.name);
      } else if (s.type === "LEVER") {
        count = await ingestLever(s.id, s.orgIdentifier, s.name);
      } else {
        results.push({
          name: s.name,
          type: s.type,
          count: 0, 
          ok: false, 
          error: `Unsupported source type: ${s.type}`,
        });
        continue;
      }

      await prisma.source.update({
        where: { id: s.id },
        data: { lastRunAt: new Date() },
      });

      results.push({ name: s.name, type: s.type, count, ok: true });
    } catch (e: any) {
      results.push({
        name: s.name,
        type: s.type,
        count: 0,
        ok: false,
        error: e?.message ?? "unknown",
      });
    }
  }

  return results;
}

function wantsJson(req: NextRequest) {
  const accept = req.headers.get("accept") || "";
  // curl/jq typically sets Accept: application/json, browsers usually accept text/html
  return accept.includes("application/json");
}

// ✅ Browser friendly: GET redirects, curl can still get JSON by setting Accept header
export async function GET(req: NextRequest) {
  try {
    const results = await runAllIngest();

    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e: any) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, error: e?.message ?? "unknown" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
}

// ✅ POST works the same way (browser form submit OR curl)
export async function POST(req: NextRequest) {
  try {
    const results = await runAllIngest();

    if (wantsJson(req)) {
      return NextResponse.json({ ok: true, results });
    }

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e: any) {
    if (wantsJson(req)) {
      return NextResponse.json(
        { ok: false, error: e?.message ?? "unknown" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
}