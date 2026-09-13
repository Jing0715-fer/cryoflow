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
      {children}
    </SheetContent>
  )
}
