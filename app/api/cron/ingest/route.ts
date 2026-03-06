import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Allow Vercel cron runner OR manual calls with Bearer token
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  const auth = req.headers.get("authorization");
  const isManual = secret && auth === `Bearer ${secret}`;

  if (!isVercelCron && !isManual) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL("/api/ingest/all", req.url);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      accept: "application/json",
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