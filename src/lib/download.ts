/**
 * Shared blob-download helper — the clipboard's honest fallback and the
 * explicit "save to disk" path, for every export surface in the app.
 *
 * There were TWO private twins of this function (hpc-queue-sim.tsx and
 * pipeline-analytics.tsx) before Task 191 collected them: whatever two
 * consumers derive independently, a third will fork. Every new export
 * surface MUST import this — never re-derive the anchor dance.
 *
 * Implementation notes:
 *  - the anchor must be attached to the document before click() for
 *    Firefox; it is removed immediately after.
 *  - revokeObjectURL happens on a timeout because Chrome ignores an
 *    immediate revoke (the download would be cancelled mid-flight).
 */
export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8"
): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke on a later tick — an immediate revoke truncates the download
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * t233: the copy-or-fallback ladder — ONE father. Task 232 built this
 * ladder twice by hand (the report's md door and its new CSV door were
 * structurally identical try/catch twins); Task 191's own law says
 * whatever two consumers derive independently, a third will fork. The
 * ladder lives beside its fallback: try the clipboard, name the copy;
 * on denial fall through to downloadText and name the degradation.
 * Returns the receipt the caller should flash — the caller owns the
 * wording, the ladder owns the MECHANISM.
 */
export async function copyOrFallback(
  text: string,
  filename: string,
  mime: string,
  copyReceipt: string,
  fallbackReceipt: string
): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return copyReceipt;
  } catch {
    downloadText(filename, text, mime);
    return fallbackReceipt;
  }
}
