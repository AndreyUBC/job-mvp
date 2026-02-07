import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

const JOB_URL =
  "https://career4.successfactors.com/career?career%5fns=job%5flisting&company=WestJet&navBarLevel=JOB%5fSEARCH&rcm%5fsite%5flocale=en%5fUS&career_job_req_id=101399&selected_lang=en_US&jobAlertController_jobAlertId=&jobAlertController_jobAlertName=&browserTimeZone=America/Vancouver&_s.crb=NbwcpE6BLso%2fWP4kPUJVbseLEGapw53H4OEX0NF9O9Y%3d";

export async function POST(req: NextRequest) {
  try {
    const res = await fetch(JOB_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch SuccessFactors page", status: res.status },
        { status: 500 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const h1 = $("h1").first().text().trim();
    const title =
      h1
        .replace(/^Career Opportunities:\s*/i, "")
        .replace(/\(\d+\)\s*$/, "")
        .trim() || "Untitled";

    const text = $.text();

    const idMatch =
      text.match(/Requisition ID\s*([0-9]{4,})/i) || text.match(/\((\d{4,})\)/);
    const externalId = idMatch?.[1] ?? "101399";

    let location = "Unknown";
    const locMatch = text.match(
      /Requisition ID\s*\d+\s*-\s*Posted[\s\S]*?-\s*([^-\n]+?)\s*-\s*WestJet/i
    );
    if (locMatch?.[1]) location = locMatch[1].trim();

    let snippet: string | null = null;
    const overviewIdx = text.toLowerCase().indexOf("overview");
    if (overviewIdx >= 0) {
      snippet = text
        .slice(overviewIdx, overviewIdx + 600)
        .replace(/\s+/g, " ")
        .trim();
    } else {
      snippet = text.slice(0, 600).replace(/\s+/g, " ").trim();
    }
    if (snippet && snippet.length > 500) snippet = snippet.slice(0, 500);

    const source = await prisma.source.upsert({
      where: { name: "WestJet (SuccessFactors)" },
      update: { lastRunAt: new Date() },
      create: {
        name: "WestJet (SuccessFactors)",
        type: "SUCCESSFACTORS",
        orgIdentifier: "WestJet",
        lastRunAt: new Date(),
      },
    });

    await prisma.job.upsert({
      where: {
        sourceId_externalId: {
          sourceId: source.id,
          externalId: String(externalId),
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        sourceId: source.id,
        externalId: String(externalId),
        title,
        company: "WestJet",
        location,
        url: JOB_URL,
        snippet,
      },
    });

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "Ingestion failed", message }, { status: 500 });
  }
}