#!/bin/bash
# t1038 live ride v5 — the honest return on camera: the forget re-opens the
# sibling's offer (no remount), + the carry/forget toasts' camera catch.
#
# v4 lessons (the rides' honest catches, compounded):
#   v1: the post-commit Fast Refresh churn ate the first leg's clicks (the
#       watchdog law F5 — UI verdicts during churn are provisional).
#   v2/v3: coordinate clicks land on the overlay mid-repaint (the embed's
#       constant re-renders move the buttons — the click's stale coordinates
#       hit the backdrop and interact-outside closes the stack). THE CURE:
#       el.click() — the DOM synthetic click, no coordinates, no overlay.
#       The View-in-3D button has NO aria-label (its name is text content).
#   v3: the dev-server watchdog recycled mid-ride (the next-server RSS
#       crossed 2.6GB — the census compiles' bill) and the reload dissolved
#       the stack. THE CURE: the warm-route ride law (t1034 F6) — pay the
#       compile on the fresh recycle first, then ride; the .next cache
#       survives the controlled recycle, so post-recycle opens are hits.
#   all: every act state-verifies; the stack rebuilds itself when found
#       dead (build_stack is re-entrant).
set -u
cd /home/z/my-project
SHOTS=shots-qa
step() { echo; echo "== $1 =="; }
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }
census() { ev 'JSON.stringify(Array.from(document.querySelectorAll("[role=slider]")).map(el=>(el.getAttribute("aria-label")||"").match(/along the (\w) axis/)?el.getAttribute("aria-label").match(/along the (\w) axis/)[1]+":"+el.getAttribute("aria-valuenow"):"sigma:"+el.getAttribute("aria-valuenow")))'; }
toasthunt() {
  local label="$1"
  local T=""
  for i in $(seq 1 15); do
    T=$(ev 'JSON.stringify({vp:!!document.querySelector("ol.fixed"),toasts:Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,100))})' | tail -1)
    if echo "$T" | grep -qE 'Clip carried|Clip forgotten|3D cut carried|3D cut forgotten'; then
      echo "  TOAST CAUGHT ($label, poll $i): $T"
      return 0
    fi
    sleep 0.35
  done
  echo "  toast missed ($label): $T"
  return 1
}
closeall() {
  for i in 1 2 3 4 5; do
    D=$(ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"')
    [ "$D" = "false" ] && return 0
    agent-browser press Escape >/dev/null 2>&1
    sleep 2
  done
  return 0
}
wait_js() {
  local js="$1" timeout="${2:-30}"
  for w in $(seq 1 $((timeout / 2))); do
    N=$(ev "$js" | tr -d '"')
    [ "$N" = "true" ] && return 0
    sleep 2
  done
  return 1
}
embed_ready_js='JSON.stringify(!!document.querySelector("button[aria-label=\"Toggle box clipping\"]")&&!!document.querySelector("[aria-label=\"Isosurface contour level in sigma\"]"))'

# build_stack — (re)establish inspector → quick-look → 3D dialog with the
# embed panel ready. Re-entrant: checks each tier before acting.
build_stack() {
  local round="$1"
  # tier check: the embed already standing?
  if [ "$(ev "$embed_ready_js" | tr -d '"')" = "true" ]; then
    echo "  [round $round] the embed panel already standing"
    return 0
  fi
  # the inspector
  if ! ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true; then
    agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
    sleep 3
  fi
  if ! ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true; then
    echo "  [round $round] the inspector would not open"
    return 1
  fi
  # the results' settle gate: the Enlarge button's existence (the aria-label
  # FIRST — the textContent-or-aria-label precedence lie cost v4 its FATAL:
  # the card's textContent is the filename + size, the Enlarge word lives
  # only in the aria-label)
  if ! wait_js 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog] button")).some(b=>/Enlarge run_half1/.test(b.getAttribute("aria-label")||"")))' 40; then
    echo "  [round $round] the Enlarge button never rendered"
    return 1
  fi
  # the quick-look (el.click — no coordinates, no overlay)
  ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/Enlarge run_half1/.test(b.getAttribute("aria-label")||""))?.click(); "ok"' >/dev/null 2>&1
  sleep 2
  if ! ev 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog] button")).some(b=>/View in 3D/.test(b.textContent||"")))' | tr -d '"' | grep -q true; then
    echo "  [round $round] the quick-look did not open"
    return 1
  fi
  # View in 3D — by TEXT (the button has no aria-label — the v3 lesson)
  ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
  if ! wait_js "$embed_ready_js" 90; then
    echo "  [round $round] the embed panel never became ready"
    return 1
  fi
  echo "  [round $round] the embed panel is ready (toggle + sigma)"
  return 0
}
# ensure_stack — rebuild up to 3 rounds
ensure_stack() {
  for r in 1 2 3; do
    build_stack "$r" && return 0
    closeall
    sleep 2
  done
  return 1
}

step "1. open home + settle (the fresh recycle pays its cache-hit compiles)"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 8
ev 'JSON.stringify({jobs:(document.body.innerText.match(/\d+ jobs/)||[])[0]||null})'

step "2. build the stack: inspector → half-map quick-look → 3D embed"
ensure_stack || { echo "FATAL: the stack never stood"; exit 1; }
sleep 2

step "3. as-found: half1's OWN memory restores (the chip, no offer — own-entry-outranks)"
ev 'JSON.stringify({chip:!!document.querySelector("[data-testid=clip-lens-row]"),offer:!!document.querySelector("[data-testid=clip-lens-offer]"),clipPressed:document.querySelector("button[aria-label=\"Toggle box clipping\"]")?.getAttribute("aria-pressed")})'
census
agent-browser screenshot "$SHOTS/t1038-ride-1-own-restored.png" 2>&1 | tail -1

step "4. FORGET half1's own memory (the chip's door) — the honest-return moment"
ensure_stack >/dev/null 2>&1 || true
ev 'document.querySelector("[data-testid=clip-lens-forget]")?.click(); "ok"' >/dev/null 2>&1
sleep 1
toasthunt "forget #1"
ev 'JSON.stringify({chipGone:!document.querySelector("[data-testid=clip-lens-row]"),OFFER_RETURNED:!!document.querySelector("[data-testid=clip-lens-offer]"),offerText:document.querySelector("[data-testid=clip-lens-offer] span span")?.textContent||null,clipStillPressed:document.querySelector("button[aria-label=\"Toggle box clipping\"]")?.getAttribute("aria-pressed")})'
agent-browser screenshot "$SHOTS/t1038-ride-2-honest-return.png" 2>&1 | tail -1

step "5. APPLY the returned offer — the carry toast's camera catch"
ev 'document.querySelector("[data-testid=clip-lens-offer-apply]")?.click(); "ok"' >/dev/null 2>&1
toasthunt "carry"
sleep 1
ev 'JSON.stringify({offerGone:!document.querySelector("[data-testid=clip-lens-offer]"),chip:!!document.querySelector("[data-testid=clip-lens-row]")})'
census
agent-browser screenshot "$SHOTS/t1038-ride-3-carried.png" 2>&1 | tail -1

step "6. FORGET again — the offer returns again (the law is not a one-shot)"
ev 'document.querySelector("[data-testid=clip-lens-forget]")?.click(); "ok"' >/dev/null 2>&1
sleep 1
toasthunt "forget #2"
ev 'JSON.stringify({chipGone:!document.querySelector("[data-testid=clip-lens-row]"),OFFER_RETURNED_AGAIN:!!document.querySelector("[data-testid=clip-lens-offer]"),offerText:document.querySelector("[data-testid=clip-lens-offer] span span")?.textContent||null})'

step "7. the scene-stays truth: the clip is still ON after both forgets"
ev 'JSON.stringify({clipStillPressed:document.querySelector("button[aria-label=\"Toggle box clipping\"]")?.getAttribute("aria-pressed"),x:document.querySelector("[data-testid=clip-interval-x]")?.textContent})'

step "8. leave the world as-found: APPLY once more (half1 ends WITH its own memory)"
ev 'document.querySelector("[data-testid=clip-lens-offer-apply]")?.click(); "ok"' >/dev/null 2>&1
sleep 1
ev 'JSON.stringify({offerGone:!document.querySelector("[data-testid=clip-lens-offer]"),chip:!!document.querySelector("[data-testid=clip-lens-row]")})'
census
agent-browser screenshot "$SHOTS/t1038-ride-4-loop-closed.png" 2>&1 | tail -1

step "9. console + DB honesty"
agent-browser console 2>&1 | rg -i "^.*(error)" | rg -iv "errorboundary|error-overlay" | head -3; echo "  (empty above = console clean)"
ls -la db/cryoflow.db | awk '{print "  DB: " $5 " bytes"}'

step "10. home QA"
closeall
sleep 1
agent-browser screenshot "$SHOTS/t1038-home-qa.png" 2>&1 | tail -1

step "ride complete"
