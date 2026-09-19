/**
 * CryoFlow — browser listing ceiling (SERVER + CLIENT shared number).
 *
 * t312 — the user's word is the law: "需要能看到所有图片，不设上限" — the
 * import browser's listing may no longer stop at 400 rows while the folder
 * holds 2,054. The BROWSER and the IMPORT now enumerate the same world: one
 * ceiling (default 20,000 entries, ≈ a long cryo-EM session's whole movie
 * tree; the JSON payload stays ~3 MB), env-tunable both ways
 * (CF_BROWSER_MAX — a slow link can dial it back, a huge screening project
 * can raise it to 200,000). The dialog virtualizes the rows, so the DOM
 * never feels the size — only the transport does.
 *
 * This module is import-safe from BOTH a route and a client component
 * (a pure constant, no fs/ssh imports) — every surface that needs to SAY
 * the number (truncated notices, docs) imports the same source, so the
 * copy can never drift from the cap it describes.
 */
export const BROWSER_LIST_MAX = Math.max(
  400,
  Math.min(200_000, Number(process.env.CF_BROWSER_MAX) || 20_000)
);
