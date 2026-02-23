import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json({ ok: false, error: "Missing CRON_SECRET" }, { status: 500 });
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // Call your existing /api/ingest/all endpoint internally
  const url = new URL("/api/ingest/all", req.url);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      // optional: forward auth if you later protect ingest/all too
      authorization: `Bearer ${secret}`,
      accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json({ ok: true, ran: true, ingest: data }, { status: res.status });
}