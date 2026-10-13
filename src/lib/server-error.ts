/**
 * CryoFlow — the error envelope's SERVER-side birthplace (t960).
 *
 * The t959 audit found the server plane honest at the SHAPE level: one
 * refusal dialect, `NextResponse.json({ error }, { status })`, 357 sites.
 * This module finishes the law at the STRING level: the same audit's
 * remaining disease was 78 catch-alls that caught a real error, logged
 * it, and then told the client "Internal server error" — the door HAD
 * the reason in scope and threw it away. The family already spoke the
 * honest idiom in 19 files (`e instanceof Error ? e.message : "<op>
 * failed"`); the catch-alls were the split dialect.
 *
 * serverErrorReply is the one birthplace for the unexpected-failure
 * reply: it logs with the caller's tag (log parity — the old
 * `console.error("GET /api/x failed:", error)` format is preserved
 * exactly), then speaks the envelope — the error's own message when it
 * has one, `<tag> failed` the honest fallback when it doesn't. The
 * status rides the response STRUCTURALLY (the same law httpErrorFrom
 * reads on the client side): one builder server-side, one reader
 * client-side, and no door ever says "Internal server error" again.
 *
 * serverErrorMessage is the same voice for doors whose contract needs
 * a richer payload (the degrade-gracefully shape: `{ sources: [],
 * error }` at 200) — the reason rides in the field, the status stays
 * whatever the contract pinned.
 */
import { NextResponse } from "next/server";

export function serverErrorMessage(tag: string, error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message : `${tag} failed`;
}

export function serverErrorReply(tag: string, error: unknown): NextResponse {
  console.error(`${tag} failed:`, error);
  return NextResponse.json({ error: serverErrorMessage(tag, error) }, { status: 500 });
}

/**
 * badJsonReply — the one birthplace for the malformed-body refusal
 * (t973, the message-quality round's FOURTH pass). Six doors spoke
 * "invalid JSON body" / "Invalid JSON body." / "Invalid JSON body" —
 * three spellings of the same sentence, every one of them a binding-less
 * catch that swallowed the SyntaxError silently. This birthplace binds,
 * LOGS the parse error under the caller's tag (the swallow is extinct —
 * the reason is in the server log for the first time), and speaks ONE
 * spelling by construction. The 400 stays 400: refusing a body is the
 * door's honest word, not a failure — the detail rides the log, the
 * client hears the class sentence.
 */
export function badJsonReply(tag: string, error: unknown): NextResponse {
  console.error(`${tag} refused its body:`, error);
  return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
}
