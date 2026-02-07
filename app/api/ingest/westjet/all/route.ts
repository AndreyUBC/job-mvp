import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";

const LISTING_URL =
  "https://career4.successfactors.com/career?career_ns=job_listing&company=WestJet&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&selected_lang=en_US";

function jobUrlForId(id: string) {
  // This version usually works without needing the long _s.crb token.
  return `https://career4.successfactors.com/career?career_ns=job_listing&company=WestJet&navBarLevel=JOB_SEARCH&rcm_site_locale=en_US&selected_lang=en_US&career_job_req_id=${encodeURIComponent(
    id
  )}`;
}

export async function POST(req: NextRequest) {
  try {
    // Source record
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

    // 1) Fetch listing page
    const listRes = await fetch(LISTING_URL, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    if (!listRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch listing page", status: listRes.status },
        { status: 500 }
      );
    }

    const listingHtml = await listRes.text();

    // 2) Extract job req IDs from HTML (regex is reliable here)
    const ids = new Set<string>();
    const re = /career_job_req_id=([0-9]{4,})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(listingHtml)) !== null) {
      ids.add(m[1]);
    }

    const jobIds = Array.from(ids);

    // If nothing found, stop early with a helpful error
    if (jobIds.length === 0) {
      return NextResponse.json(
        { error: "No job IDs found on listing page" },
        { status: 500 }
      );
    }

    let processed = 0;
    let failed = 0;

    // 3) For each job ID, fetch job page and parse basic fields
    for (const id of jobIds) {
      try {
        const url = jobUrlForId(id);
        const jobRes = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
        });
        if (!jobRes.ok) {
          failed++;
          continue;
        }

        const html = await jobRes.text();
        const $ = cheerio.load(html);

        // Title typically in first H1
        const h1 = $("h1").first().text().trim();
        const title =
          h1
            .replace(/^Career Opportunities:\s*/i, "")
            .replace(/\(\d+\)\s*$/, "")
            .trim() || `Job ${id}`;

        const text = $.text();

        // Attempt location extraction (often shown near requisition line)
        let location = "Unknown";
        const locMatch = text.match(
          /Requisition ID\s*\d+\s*-\s*Posted[\s\S]*?-\s*([^-\n]+?)\s*-\s*WestJet/i
        );
        if (locMatch?.[1]) location = locMatch[1].trim();

        // Snippet
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

        await prisma.job.upsert({
          where: {
            sourceId_externalId: {
              sourceId: source.id,
              externalId: id,
            },
          },
          update: { lastSeenAt: new Date(), url },
          create: {
            sourceId: source.id,
            externalId: id,
            title,
            company: "WestJet",
            location,
            url,
            snippet,
          },
        });

        processed++;
      } catch {
        failed++;
      }
    }

    // Redirect back (like your other ingestors)
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Ingestion failed", message },
      { status: 500 }
    );
  }
}