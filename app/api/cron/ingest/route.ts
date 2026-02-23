import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Missing CRON_SECRET" },
      { status: 500 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Call /api/ingest/all internally
  const url = new URL("/api/ingest/all", req.url);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      accept: "application/json",
      // only needed if you later protect /api/ingest/all
      authorization: `Bearer ${secret}`,
    },
    cache: "no-store",
  });

  let payload: any = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    payload = await res.json().catch(() => null);
  } else {
    payload = await res.text().catch(() => null);
  }

  return NextResponse.json(
    { ok: res.ok, ran: true, status: res.status, ingest: payload },
    { status: res.status }
  );
}