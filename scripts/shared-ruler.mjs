#!/usr/bin/env node
/**
 * shared-ruler.mjs — the census's ONE name computation (t864): the t861
 * pattern applied to the ruler itself. Before this module SEVEN instruments
 * each carried an inline copy of the name computation inside their MEASURE
 * eval-strings — t843/t844/t846/t857/t860/t862 rode the five-mechanism
 * chain, and t863 had grown label[for] (the t863 window's own ruler fix:
 * the param form's <Label htmlFor> inputs were slandered "unnamed" by a
 * ruler that did not follow the HTML spec's own naming mechanism). Six
 * instruments were measuring with a ruler older than the family's best.
 *
 * The law: the ruler grows ONCE, every instrument rides the growth.
 *
 * The canonical chain (most-semantic first, the HTML spec's own order):
 *     aria-label -> aria-labelledby (resolved) -> label[for] -> textContent
 *     -> img alt -> input value/placeholder
 *
 * The growth is name-monotone: label[for] sits BEFORE the value fallbacks
 * and can only NAME a control the old ruler fell through on (or rename one
 * to its label instead of its value — a name STRING change, never a
 * named->unnamed flip), so every older receipt's zero-unnamed claim stays
 * true under the shared ruler. Where a receipt's full-object identity
 * flips false on a same-key ride because a name string grew richer, that
 * is the honest arm 2′ shape (the lens widened, the scalar stayed).
 *
 * NAMEOF is a JS SOURCE STRING — every MEASURE embeds it via string
 * concatenation inside an agent-browser eval — so the module's contract is
 * CHECKED, not assumed: the self-test syntax-builds it, asserts the
 * embeddability contract (no backtick, no ${ — it must live inside any
 * quoting), asserts the mechanism order, and behavior-tests every branch
 * of the chain against a DOM shim (offline, deterministic).
 *
 * Carriers (the census ruler family): t843 (cheap pair), t844 (fragile
 * pair), t846 (maintenance sweep), t857 (ledger probe), t860 (variance
 * probe), t862 (overlay tier), t863 (job panel). t186's nameOf is a job-id
 * Map, not this ruler — not a carrier.
 *
 * Self-test: node scripts/shared-ruler.mjs  (deterministic, offline)
 */

/** NAMEOF — the canonical nameOf, as embeddable JS source. Declares
 * `const nameOf = (el) => {...};` — instruments concatenate it at the top
 * of their MEASURE IIFE. Must contain no backtick and no ${ (the
 * embeddability contract — it rides inside single-quoted strings and
 * shell-escaped evals alike). */
export const NAMEOF = `const nameOf = (el) => { const al = el.getAttribute("aria-label"); if (al && al.trim()) return al.trim(); const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\\s+/).map((id) => { const d = document.getElementById(id); return d ? (d.textContent || "").trim() : ""; }).join(" ").trim(); if (t) return t; } if (el.id) { const lf = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (lf && (lf.textContent || "").trim()) return lf.textContent.trim(); } const tc = (el.textContent || "").trim(); if (tc) return tc; if (el.tagName === "IMG") { const a = el.getAttribute("alt"); if (a !== null && a.trim()) return a.trim(); } if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) { const v = (el.value || "").trim(); if (v) return v; const p = (el.getAttribute("placeholder") || "").trim(); if (p) return p; } return ""; };`;

/** NAMEOF_LAW — the family's one-sentence ruler law (rides every carrier's
 * receipt as `ruler`, the LEDGER_LAW pattern). */
export const NAMEOF_LAW =
  "the census's ONE name computation: aria-label -> aria-labelledby resolved -> " +
  "label[for] -> textContent -> img alt -> input value/placeholder — the ruler grows " +
  "once, every instrument rides the growth (t864, the t861 pattern); " +
  "name-monotone: the shared ruler's names are a superset of any older inline copy's";

/** buildNameOf — build the live function for offline use (the self-test's
 * own harness; carriers eval NAMEOF in the browser instead). Throws on
 * a syntactically broken source — the embeddability contract's syntax half.
 * The returned wrapper installs the doc/CSS shims around EACH call: the
 * function body resolves `document` and `CSS` at call time (a browser eval
 * has them as globals; Node's offline harness must supply them). */
export function buildNameOf(doc, css) {
  const fn = new Function(`${NAMEOF}\nreturn nameOf;`)();
  return (el) => {
    const prevDoc = globalThis.document;
    const prevCss = globalThis.CSS;
    globalThis.document = doc;
    globalThis.CSS = css;
    try {
      return fn(el);
    } finally {
      globalThis.document = prevDoc;
      globalThis.CSS = prevCss;
    }
  };
}

/* ---------- self-test (offline, deterministic) ---------- */
if (process.argv[1] && process.argv[1].endsWith("shared-ruler.mjs")) {
  let bad = 0;
  const expect = (name, cond) => {
    if (!cond) {
      bad++;
      console.error(`  ✗ ${name}`);
    } else console.log(`  ✓ ${name}`);
  };

  /* -- the DOM shim -- */
  const mkDoc = (byId, labelFor) => ({
    getElementById: (id) => (id in byId ? byId[id] : null),
    querySelector: (sel) => {
      const m = sel.match(/^label\[for="(.*)"\]$/);
      return m && labelFor[m[1]] ? labelFor[m[1]] : null;
    },
  });
  const cssShim = { escape: (s) => s };
  const mkEl = (o) => ({
    getAttribute: (a) => (o.attrs && a in o.attrs ? o.attrs[a] : null),
    id: o.id ?? "",
    textContent: o.text ?? "",
    tagName: o.tag ?? "DIV",
    value: o.value ?? "",
  });

  const nameOf = buildNameOf(mkDoc(
    { lbl1: mkEl({ text: "From the labelledby" }), lbl2: mkEl({ text: "and its second id" }) },
    { inName: mkEl({ text: "Param label", tag: "LABEL" }) },
  ), cssShim);

  // 1 aria-label wins over everything
  expect("aria-label wins over textContent and label[for]",
    nameOf(mkEl({ attrs: { "aria-label": " The aria name " }, text: "btn text", id: "inName" })) === "The aria name");
  // 2 aria-labelledby resolves a single id
  expect("aria-labelledby resolves one id",
    nameOf(mkEl({ attrs: { "aria-labelledby": "lbl1" }, text: "ignored" })) === "From the labelledby");
  // 3 aria-labelledby joins multiple ids, skips the missing ones (the
  // join inserts one space PER TOKEN — a missing id leaves a blank token,
  // so the joined name carries a double space; the chain's real contract)
  expect("aria-labelledby joins ids, skips missing",
    nameOf(mkEl({ attrs: { "aria-labelledby": "lbl1 ghost lbl2" } })) === "From the labelledby  and its second id");
  // 4 labelledby resolving to empty text falls through
  expect("labelledby with empty text falls through",
    nameOf(mkEl({ attrs: { "aria-labelledby": "ghost" }, text: "own text" })) === "own text");
  // 5 label[for] names an input before the value fallbacks (the t863 growth)
  expect("label[for] names the param input (the t863 growth)",
    nameOf(mkEl({ tag: "INPUT", id: "inName", value: "3", attrs: { placeholder: "ph" } })) === "Param label");
  // 6 no id -> label[for] never consulted
  expect("no id skips label[for], value fallback",
    nameOf(mkEl({ tag: "INPUT", value: "3" })) === "3");
  // 7 label[for] with empty label text falls through to value
  expect("empty label[for] text falls through to value",
    nameOf(mkEl({ tag: "INPUT", id: "ghostId", value: "7" })) === "7");
  // 8 textContent fallback for a plain div
  expect("textContent fallback", nameOf(mkEl({ text: "  Plain div  " })) === "Plain div");
  // 9 img alt only when textContent empty; alt="" stays unnamed
  expect("img alt names an image",
    nameOf(mkEl({ tag: "IMG", attrs: { alt: "micrograph" } })) === "micrograph");
  expect("img alt empty -> unnamed (falls through, not INPUT)",
    nameOf(mkEl({ tag: "IMG", attrs: { alt: "  " }, text: "" })) === "");
  // 10 input value wins over placeholder; placeholder when value empty
  expect("input value beats placeholder",
    nameOf(mkEl({ tag: "INPUT", value: "v", attrs: { placeholder: "p" } })) === "v");
  expect("input placeholder when value empty",
    nameOf(mkEl({ tag: "INPUT", attrs: { placeholder: "p" } })) === "p");
  // 11 nothing at all -> ""
  expect("nothing at all -> empty string", nameOf(mkEl({})) === "");
  // 12 the embeddability contract: no backtick, no ${ in the source
  expect("NAMEOF contains no backtick and no ${",
    !NAMEOF.includes("`") && !NAMEOF.includes("${"));
  // 13 the mechanism order — the canonical chain, verbatim
  const at = (s) => NAMEOF.indexOf(s);
  expect("mechanism order: aria-label < aria-labelledby < label[for] < textContent < IMG < placeholder",
    at('getAttribute("aria-label")') > -1 &&
    at('getAttribute("aria-label")') < at('getAttribute("aria-labelledby")') &&
    at('getAttribute("aria-labelledby")') < at('label[for="') &&
    at('label[for="') < at('el.textContent || ""') &&
    at('el.textContent || ""') < at('"IMG"') &&
    at('"IMG"') < at('getAttribute("placeholder")'));

  console.log(bad === 0 ? "shared-ruler self-test: all green" : `shared-ruler self-test: ${bad} RED`);
  process.exit(bad ? 1 : 0);
}
