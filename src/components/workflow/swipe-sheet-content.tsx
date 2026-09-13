"use client"

import * as React from "react"
import { SheetContent } from "@/components/ui/sheet"

type SheetContentProps = React.ComponentProps<typeof SheetContent>

/**
 * SwipeSheetContent — the mobile JobPanel sheet you can swipe away
 * (Task 172). Until now the sheet exited only via Esc, outside-tap or
 * the corner X; the native one-hand gesture — flick it to the edge it
 * came from — was missing.
 *
 * Pointer events (mouse included) so probes can drive it with a plain
 * drag; `touch-pan-y` keeps REAL touch vertical scrolling native while
 * horizontal pans arrive here. The gesture arms only after horizontal
 * INTENT (dx > 14px and 1.35× the vertical drift), never over form
 * fields, so taps, scrolls and text selection stay untouched.
 *
 * During the drag the transform is written straight to the DOM node
 * (no React re-render per pointermove — the sheet subtree carries the
 * whole JobPanel). On release: past 28% of the sheet width, or a fast
 * short flick, → stay transformed and call onDismiss — Radix's exit
 * keyframes animate from the element's CURRENT computed style
 * (implicit-from), so the sheet flies out from under the finger with
 * no teleport. Otherwise it springs back in 220ms.
 *
 * Task 173 — the invitation and the echo. A gesture nobody can see is
 * a gesture nobody finds: a static grabber (top-center pill, seated in
 * the header's own padding band — zero layout, zero hit-area change)
 * says "this surface moves", and a left-edge shade whose opacity rides
 * the SAME dragged distance (--swipe-progress, written straight to the
 * node beside the transform) is the finger's live echo. Both spans are
 * decorative (aria-hidden, pointer-events-none) — they invite, they
 * never intercept. On spring-back the shade fades out over the same
 * 220ms the sheet takes to return, so nothing snaps.
 */
export function SwipeSheetContent({
  onDismiss,
  children,
  className,
  style,
  ...props
}: SheetContentProps & { onDismiss: () => void }) {
  const nodeRef = React.useRef<HTMLDivElement | null>(null)
  const gesture = React.useRef<{
    id: number
    x0: number
    y0: number
    horiz: boolean
    lastX: number
    lastT: number
    v: number
  } | null>(null)

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest("input, textarea, select, [contenteditable='true']")) return
    gesture.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      horiz: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    const el = nodeRef.current
    if (!g || !el || e.pointerId !== g.id) return
    const dx = e.clientX - g.x0
    const dy = e.clientY - g.y0
    if (!g.horiz) {
      if (dx > 14 && Math.abs(dx) > Math.abs(dy) * 1.35) {
        g.horiz = true
        try {
          el.setPointerCapture(e.pointerId)
        } catch {
          /* capture is best-effort — the sheet spans the viewport anyway */
        }
        el.style.transition = "none"
      } else {
        return
      }
    }
    const w = el.getBoundingClientRect().width || 390
    const capped = Math.min(Math.max(dx, 0), w * 0.92)
    el.style.transform = `translateX(${capped}px)`
    // the echo: drag distance → shade opacity, one CSS var write beside
    // the transform write (same ref, still zero re-renders)
    el.style.setProperty("--swipe-progress", String(Math.min(capped / w, 1)))
    const dt = e.timeStamp - g.lastT
    if (dt > 0) g.v = (e.clientX - g.lastX) / dt
    g.lastX = e.clientX
    g.lastT = e.timeStamp
  }

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    const el = nodeRef.current
    gesture.current = null
    if (!g || !el || e.pointerId !== g.id || !g.horiz) return
    const w = el.getBoundingClientRect().width || 390
    const dx = Math.max(g.lastX - g.x0, 0)
    const dismiss = dx > w * 0.28 || (dx > 48 && g.v > 0.55)
    if (dismiss) {
      // keep the dragged transform: the exit animation's implicit "from"
      // is the element's current style, so it flies out from the finger
      onDismiss()
    } else {
      el.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)"
      el.style.transform = ""
      // fade the echo over the same 220ms the sheet takes to return.
      // Drive the ROOT VAR only — wiping the cue's own inline opacity
      // would erase the React-installed var() expression with it and
      // strand the shade at computed 1 (caught live by t173's M10b).
      const cue = el.querySelector<HTMLElement>("[data-swipe-edge-cue]")
      if (cue) {
        cue.style.transition = "opacity 220ms cubic-bezier(0.32, 0.72, 0, 1)"
        el.style.setProperty("--swipe-progress", "0")
        window.setTimeout(() => {
          cue.style.transition = ""
        }, 240)
      }
      window.setTimeout(() => {
        el.style.transition = ""
      }, 240)
    }
  }

  return (
    <SheetContent
      data-panel-sheet=""
      ref={nodeRef}
      className={"touch-pan-y " + (className ?? "")}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      {...props}
    >
      {/* Task 173 — the invitation: seated in the header's p-4 padding
          band (6–10px; the name input starts at 16px), it overlaps no
          interactive control and intercepts no pointer. */}
      <span
        aria-hidden="true"
        data-swipe-grabber=""
        className="pointer-events-none absolute left-1/2 top-1.5 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-foreground/25"
      />
      {/* the echo: opacity is driven by --swipe-progress on the root —
          the shade enters from the LEFT edge (the direction the drag
          comes from as the sheet travels right). */}
      <span
        aria-hidden="true"
        data-swipe-edge-cue=""
        className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-6"
        style={{
          opacity: "var(--swipe-progress, 0)",
          background: "linear-gradient(to right, rgba(0,0,0,0.16), transparent)",
        }}
      />
      {children}
    </SheetContent>
  )
}
