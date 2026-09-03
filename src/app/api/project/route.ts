import { NextResponse } from "next/server";
import { ensureProject, toProjectDTO } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const project = await ensureProject();
    return NextResponse.json({ project: toProjectDTO(project) });
  } catch (error) {
    console.error("GET /api/project failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
