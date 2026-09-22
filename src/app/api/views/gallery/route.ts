import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* Saved-views gallery — every 3D view bookmark across ALL projects     */
/* ------------------------------------------------------------------ */
// The dashboard's "Saved views" wall: a hunt for the perfect viewing
// angle is work product, and work product deserves a shelf that spans
// projects. This is a READ-ONLY aggregate — mutations stay on the
// per-job camera-bookmarks route, which owns the strict whitelist. Here
// entries only need enough shape to render a card (id/name/ts/thumb/view);
// anything malformed is skipped, and a corrupt row never sinks the rest.

interface GalleryBookmark {
  id: string;
  name: string;
  ts: number;
  thumb?: string;
  view?: Record<string, unknown>;
}

const MAX_JOBS = 8; // newest-updated rows only — the wall stays a glance

export async function GET() {
  try {
    const rows = await db.bookmarkSession.findMany({
      orderBy: { updatedAt: "desc" },
      take: MAX_JOBS,
      include: {
        job: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    const views: Array<{
      projectId: string | null;
      projectName: string | null;
      jobId: string;
      jobName: string;
      jobType: string;
      jobStatus: string;
      updatedAt: string;
      bookmarks: GalleryBookmark[];
    }> = [];

    for (const row of rows) {
      let bookmarks: GalleryBookmark[] = [];
      try {
        const parsed: unknown = JSON.parse(row.data);
        if (Array.isArray(parsed)) {
          for (const raw of parsed.slice(0, 8)) {
            if (!raw || typeof raw !== "object") continue;
            const b = raw as Record<string, unknown>;
            if (typeof b.id !== "string" || !b.id) continue;
            if (typeof b.name !== "string" || !b.name) continue;
            const entry: GalleryBookmark = {
              id: b.id.slice(0, 64),
              name: b.name.slice(0, 80),
              ts: typeof b.ts === "number" && Number.isFinite(b.ts) ? b.ts : 0,
            };
            if (
              typeof b.thumb === "string" &&
              b.thumb.length <= 48_000 &&
              b.thumb.startsWith("data:image/")
            ) {
              entry.thumb = b.thumb;
            }
            if (b.view && typeof b.view === "object" && !Array.isArray(b.view)) {
              entry.view = b.view as Record<string, unknown>;
            }
            bookmarks.push(entry);
          }
        }
      } catch {
        continue; // corrupt row — skip it, keep the wall alive
      }
      if (bookmarks.length === 0) continue;
      views.push({
        projectId: row.job.project?.id ?? null,
        projectName: row.job.project?.name ?? null,
        jobId: row.job.id,
        jobName: row.job.name,
        jobType: row.job.type,
        jobStatus: row.job.status,
        updatedAt: row.updatedAt.toISOString(),
        bookmarks,
      });
    }

    return NextResponse.json({ views });
  } catch {
    return NextResponse.json({ views: [], error: "read failed" }, { status: 500 });
  }
}
