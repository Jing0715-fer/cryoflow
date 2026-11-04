import { NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";

// t709 — the reader door, on the api root too: the body is a hello, but
// the campaign's uniformity rule is one door, every handler — a surface
// that answers headerless probes here would advertise which routes
// don't. The nine-readers ledger (t707 census addendum) closes with
// this one (doctrine in http-guard.ts).
export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site API reads are not allowed" }, { status: 403 });
  }
  return NextResponse.json({ message: "Hello, world!" });
}
