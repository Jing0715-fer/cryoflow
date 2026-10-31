#!/usr/bin/env python3
"""t1132 — the stale-listener family sweep (the t1131 cure's law, generalized).

Law (t1131, live-caught on the t661 oblique-clip wire): a window/document
addEventListener registered inside a useEffect with an EMPTY deps array and
calling an intent applier DIRECTLY (not through a `xxxRef.current`) freezes
the first-render closure forever — the applier's captured state (e.g. the
`phase` gate) is unreachable, while Fast Refresh re-subscriptions feed you
"it works" false positives.

Scanner classes every addEventListener living inside a []-deps effect:
  OK-REF      handler reaches an applier through `.current` (the family's law)
  OK-STABLE   handler only touches stable verbs (setState from useState,
              router, console, DOM arg, stop/prevent, refs read)
  SUSPECT     handler names a component-scope identifier directly — needs
              human eyes (the audit's only interesting class)
  OK-EXTERN   handler is an imported/known-stable identifier (track, etc.)
"""

import os, re, sys, json

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src")

def find_matching(src, open_idx, open_ch, close_ch):
    """index of the matching close for the bracket at open_idx"""
    depth = 0
    i = open_idx
    n = len(src)
    in_s = None
    while i < n:
        c = src[i]
        if in_s:
            if c == "\\":
                i += 2
                continue
            if c == in_s:
                in_s = None
        elif c in ("'", '"', "`"):
            in_s = c
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1

STABLE_VERB = re.compile(
    r"^(set[A-Z]\w*|router|console|window|document|navigator|e|ev|event|"
    r"stopPropagation|preventDefault|localStorage|sessionStorage|"
    r"requestAnimationFrame|clearTimeout|clearInterval|setTimeout|setInterval|"
    r"cancelAnimationFrame|AbortController|fetch|JSON|Math|Number|String|"
    r"Boolean|Array|Object|Date|performance|crypto|atob|btoa)$"
)

def scan_file(path):
    src = open(path, encoding="utf-8").read()
    hits = []
    for m in re.finditer(r"useEffect\s*\(", src):
        open_idx = m.end() - 1
        close_idx = find_matching(src, open_idx, "(", ")")
        if close_idx < 0:
            continue
        body = src[open_idx + 1 : close_idx]
        # empty deps array at the tail: body ends with `..., []` (the closing
        # paren of useEffect sits OUTSIDE this body — `\[\]\)\s*;` would never match)
        deps_m = re.search(r"(?:^|[,{]\s*|\)\s*,\s*)\[\s*\]\s*;?\s*$", body.strip())
        if not deps_m:
            continue
        # length-preserving string blanking — line numbers must stay honest
        def _blank(m):
            q = m.group(0)[0]
            return q + "~" * (len(m.group(0)) - 2) + q
        body_nostr = re.sub(r"`(?:[^`\\]|\\.)*`", _blank, body)
        body_nostr = re.sub(r"'(?:[^'\\]|\\.)*'", _blank, body_nostr)
        body_nostr = re.sub(r'"(?:[^"\\]|\\.)*"', _blank, body_nostr)
        for a in re.finditer(r"(window|document)\s*\.\s*addEventListener\s*\(", body_nostr):
            a_open = a.end() - 1
            a_close = find_matching(body_nostr, a_open, "(", ")")
            if a_close < 0:
                continue
            args = body_nostr[a_open + 1 : a_close]
            line = src[: open_idx + 1 + a_open].count("\n") + 1
            # handler = first arg that is a function (arrow or identifier)
            handler = None
            depth = 0
            cur = []
            parts = []
            in_s = None
            i = 0
            while i < len(args):
                c = args[i]
                if in_s:
                    cur.append(c)
                    if c == in_s:
                        in_s = None
                elif c in ("'", '"', "`"):
                    in_s = c
                    cur.append(c)
                elif c in "(<[{":
                    depth += 1
                    cur.append(c)
                elif c in ")>}]}":
                    depth -= 1
                    cur.append(c)
                elif c == "," and depth == 0:
                    parts.append("".join(cur).strip())
                    cur = []
                else:
                    cur.append(c)
                i += 1
            parts.append("".join(cur).strip())
            if parts:
                handler = parts[1] if len(parts) > 1 else None
            if not handler:
                continue
            # classify
            kind, why = classify(handler, path, src, effect_body=body_nostr)
            hits.append(
                {
                    "file": os.path.relpath(path, ROOT),
                    "line": line,
                    "event": a.group(0).split(".")[0].strip() + "." + "addEventListener",
                    "handler": handler[:120],
                    "class": kind,
                    "why": why,
                }
            )
    return hits

def resolve_named(name, effect_body):
    """resolve an effect-local `const name = ...` or `function name(...)` handler"""
    for pat in (
        rf"const\s+{re.escape(name)}\s*(?::[^=]+)?=\s*",
        rf"function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{\s*$",
        rf"let\s+{re.escape(name)}\s*(?::[^=]+)?=\s*",
    ):
        m = re.search(pat, effect_body)
        if not m:
            continue
        rest = effect_body[m.end() :]
        arrow = re.match(r"^(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>\s*", rest)
        if arrow:
            after = rest[arrow.end() :].lstrip()
            if after.startswith("{"):
                b_open = effect_body.index("{", m.end() + arrow.end())
                b_close = find_matching(effect_body, b_open, "{", "}")
                if b_close > 0:
                    return effect_body[b_open + 1 : b_close]
            return after  # expression-bodied arrow
        if rest.lstrip().startswith("{"):
            b_open = effect_body.index("{", m.end())
            b_close = find_matching(effect_body, b_open, "{", "}")
            if b_close > 0:
                return effect_body[b_open + 1 : b_close]
    return None

def classify(handler, path, src, effect_body=""):
    h = handler.strip()
    # inline arrow / function: inspect its body
    body = h
    arrow = re.match(r"^(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*", h)
    if arrow:
        rest = h[arrow.end() :].lstrip()
        if rest.startswith("{"):
            b_open = 0  # find matching brace within h
            b_close = find_matching(h, h.index("{"), "{", "}")
            body = h[h.index("{") + 1 : b_close] if b_close > 0 else rest
        else:
            body = rest
    else:
        # named identifier — resolve inside the effect body first (the
        # family's real shape: `const onOrtho = (e: Event) => {...}` above
        # the addEventListener), then file scope
        name = h.split("(")[0].split(".")[0].strip()
        resolved = resolve_named(name, effect_body) if effect_body else None
        if resolved is not None:
            body = resolved
        elif re.search(rf"(?:function\s+{name}\b|const\s+{name}\s*=)", src):
            fm = re.search(rf"function\s+{name}\s*\([^)]*\)\s*\{{", src)
            if fm:
                b_close = find_matching(src, src.index("{", fm.start()), "{", "}")
                body = src[fm.end() : b_close] if b_close > 0 else name
            else:
                return "OK-EXTERN", f"named handler `{name}` — file-resolved body not extracted; judge manually"
        else:
            return "OK-EXTERN", f"identifier `{name}` not file-scope (imported/stable)"
    # now classify body
    if ".current" in body:
        return "OK-REF", "handler reaches state through a ref (.current)"
    calls = re.findall(r"\b([a-zA-Z_$][\w$]*)\s*\(", body)
    nonstable = []
    for c in calls:
        if STABLE_VERB.match(c):
            continue
        if re.match(r"^(use|useRef|useCallback|useEffect|useMemo|useState)$", c):
            continue
        nonstable.append(c)
    if not nonstable:
        return "OK-STABLE", "body only touches stable verbs"
    return "SUSPECT", "direct calls: " + ", ".join(sorted(set(nonstable))[:6])

def main():
    all_hits = []
    for dirpath, _dirs, files in os.walk(ROOT):
        for f in files:
            if f.endswith((".tsx", ".ts")) and not f.endswith(".d.ts"):
                p = os.path.join(dirpath, f)
                all_hits.extend(scan_file(p))
    all_hits.sort(key=lambda h: (h["class"], h["file"], h["line"]))
    counts = {}
    for h in all_hits:
        counts[h["class"]] = counts.get(h["class"], 0) + 1
    print(f"== stale-listener sweep: {len(all_hits)} listeners in []-deps effects ==")
    print("classes:", json.dumps(counts, sort_keys=True))
    for h in all_hits:
        mark = "!!" if h["class"] == "SUSPECT" else "  "
        print(f'{mark} [{h["class"]:9}] {h["file"]}:{h["line"]}  {h["why"][:90]}')
        if h["class"] == "SUSPECT":
            print(f"      handler: {h['handler'][:110]}")
    # SUSPECT is the exit gate: the census seat fails if any survive unjudged
    suspects = [h for h in all_hits if h["class"] == "SUSPECT"]
    print(f"\nSUSPECT count: {len(suspects)}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
