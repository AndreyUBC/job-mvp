export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionUser = cookieStore.get("session_user")?.value;

  if (!sessionUser) {
    redirect("/login");
  }

  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

  const jobs = await prisma.job.findMany({
    where: q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { lastSeenAt: "desc" },
    take: 50,
  });

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>Dashboard</h1>

      <p style={{ marginTop: 8 }}>✅ Logged in</p>
      <p style={{ marginTop: 4, opacity: 0.8 }}>session_user: {sessionUser}</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <form action="/api/auth/logout" method="post">
          <button type="submit">Logout</button>
        </form>

        <form action="/api/ingest/doordash" method="post">
          <button type="submit">Ingest DoorDash Canada Jobs</button>
        </form>

        <form action="/api/ingest/doordashusa" method="post">
          <button type="submit">Ingest DoorDash USA Jobs</button>
        </form>

        <form action="/api/ingest/nac" method="post">
          <button type="submit">Ingest NAC (Lever)</button>
        </form>

        <form action="/api/ingest/introba" method="post">
          <button type="submit">Ingest Introba (Workday)</button>
        </form>

        <form action="/api/ingest/visa" method="post">
          <button type="submit">Ingest Visa (SmartRecruiters)</button>
        </form>

      </div>

      {/* Search */}
      <form action="/dashboard" method="get" style={{ marginTop: 16 }}>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title / location / company..."
          style={{ width: 380, maxWidth: "100%", padding: 8 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>
          Search
        </button>
        {q ? (
          <a href="/dashboard" style={{ marginLeft: 12 }}>
            Clear
          </a>
        ) : null}
      </form>

      <h2 style={{ marginTop: 24 }}>
        {q ? `Search results for "${q}" (top 50)` : "Latest Jobs (top 50)"}
      </h2>

      <ul style={{ marginTop: 12, paddingLeft: 18 }}>
        {jobs.map((j) => (
          <li key={j.id} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{j.title}</div>
            <div style={{ opacity: 0.8 }}>
              {j.company} — {j.location}
            </div>
            <a href={j.url} target="_blank" rel="noreferrer">
              Open posting
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}