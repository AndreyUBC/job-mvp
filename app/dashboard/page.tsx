import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";


type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  // Next.js 16: cookies() is async
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get("session_user")?.value;

  if (!sessionUserId) redirect("/login");
  const sp = searchParams ? await searchParams : undefined;

  // Read filters from query string
  const q = first(sp?.q).trim();
const company = first(sp?.company).trim();
const location = first(sp?.location).trim();
const source = first(sp?.source).trim();

  console.log("DASHBOARD FILTERS:", { q, company, location, source });

  // ✅ Build Prisma where clause (simple + no extra arrays)
  const where: Prisma.JobWhereInput | undefined =
    q || company || location || source
      ? {
          AND: [
            q
              ? {
                  OR: [
                    { title: { contains: q, mode: "insensitive" } },
                    { company: { contains: q, mode: "insensitive" } },
                    { location: { contains: q, mode: "insensitive" } },
                    { snippet: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {},
            company
              ? { company: { contains: company, mode: "insensitive" } }
              : {},
            location
              ? { location: { contains: location, mode: "insensitive" } }
              : {},
            source ? { source: { name: source } } : {},
          ],
        }
      : undefined;

  // Pull jobs
  const jobs = await prisma.job.findMany({
    where,
    orderBy: { lastSeenAt: "desc" },
    take: 50,
    include: { source: true },
  });

  // Dropdown options
  const sources = await prisma.source.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const qs = (p: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) {
      if (v.trim()) sp.set(k, v.trim());
    }
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  const clearHref = "/dashboard";

  return (
    <main
      style={{
        padding: 24,
        maxWidth: 980,
        margin: "0 auto",
        fontFamily: "system-ui",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Job Dashboard</h1>
          <div style={{ opacity: 0.7, marginTop: 6 }}>Latest 50 jobs</div>
        </div>

        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #333",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </form>
      </div>

      <div style={{ height: 16 }} />

      {/* Filters */}
      <form
        method="get"
        action="/dashboard"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 220px",
          gap: 12,
          padding: 16,
          border: "1px solid #333",
          borderRadius: 12,
        }}
      >
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Title, company, location, snippet…"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Company</span>
          <input
            name="company"
            defaultValue={company}
            placeholder="e.g. DoorDash"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Location</span>
          <input
            name="location"
            defaultValue={location}
            placeholder="e.g. Vancouver"
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Source</span>
          
          <select
            name="source"
            defaultValue={source}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
          >
            <option value="">All</option>
            {sources.map((s: (typeof sources)[number]) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="submit"
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Apply
          </button>

          <a
            href={clearHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: "transparent",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            Clear
          </a>
        </div>
      </form>

      <div style={{ height: 12 }} />

      <div style={{ opacity: 0.75, fontSize: 14 }}>
        Showing <b>{jobs.length}</b> result(s)
        {(q || company || location || source) && (
          <>
            {" "}
            for{" "}
            <code>
              {qs({ q, company, location, source }).slice(1) || "filters"}
            </code>
          </>
        )}
      </div>

      <div style={{ height: 12 }} />

      {/* Jobs */}
      <div style={{ display: "grid", gap: 12 }}>
        {jobs.map((j: (typeof jobs)[number]) => (
          <div
            key={j.id}
            style={{
              padding: 14,
              border: "1px solid #333",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {j.title}
                </div>

                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {j.company} · {j.location}
                </div>

                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 6 }}>
                  Source: {j.source?.name ?? "—"} · Last seen:{" "}
                  {new Date(j.lastSeenAt).toLocaleString()}
                </div>
              </div>

              <a
                href={j.url}
                target="_blank"
                rel="noreferrer"
                style={{ alignSelf: "center", textDecoration: "none" }}
              >
                View posting →
              </a>
            </div>

            {j.snippet ? (
              <div style={{ marginTop: 10, opacity: 0.85 }}>{j.snippet}</div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}