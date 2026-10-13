/**
 * CryoFlow — the error envelope's client-side reader (t959).
 *
 * The envelope audit's verdict: the API routes speak ONE refusal dialect
 * — every refusal is `NextResponse.json({ error }, { status })` (357
 * sites, zero missing statuses); the bare-text/binary responses are all
 * success payloads guarded by earlier `{ error }` returns; the one
 * `{ message }` outlier is the root ping's 200 body, not a refusal.
 * The server plane is honest. The CLIENT plane was not: nine fetch
 * sites discarded the envelope and threw `route said 400` / `HTTP 400`,
 * so a door that named its reason ("Text preview is for log/text
 * files") still reached the user as a status number — the refusal's
 * honesty died at the last hop.
 *
 * httpErrorFrom is the one birthplace for that last hop: the envelope
 * text is the message when the door spoke, `HTTP <status>` is the
 * honest fallback when it didn't, and the status rides the error
 * STRUCTURALLY (`err.status`) so no consumer ever has to string-match
 * the message — the shape of the text stops being load-bearing
 * (classifyFetchFailure keeps the string fallback for legacy throwers,
 * but status-native classification is the law).
 */
export async function httpErrorFrom(res: Response): Promise<Error & { status?: number }> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  const err = new Error(body?.error ?? `HTTP ${res.status}`) as Error & { status?: number };
  err.status = res.status;
  return err;
}
