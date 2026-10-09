"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/* ------------------------------------------------------------------ */
/* Companion windows (t501)                                             */
/* ------------------------------------------------------------------ */

/**
 * A "companion window" is a persistent floating tool the user keeps open
 * beside their work — the AI assistant is the first citizen. Radix MODAL
 * dialogs claim the whole document: they set body{pointer-events:none},
 * arm a FocusScope that yanks focus back into the dialog on every focusin,
 * lock scroll (react-remove-scroll) and aria-hide everything outside. A
 * companion floating "above" such a dialog is therefore DEAD regardless of
 * its z-index — the user's ticket said it plainly: the job params page's
 * mask covered the AI assistant, and clicking the assistant dismissed the
 * page. The only honest fix is to yield modality: while ANY companion
 * window is registered, dialogs render NON-modal (no mask, no focus trap,
 * no pointer-events siege), and outside interactions that START inside a
 * companion never dismiss a dialog. Focus/typing/dragging in the companion
 * work; the dialog stays open — both surfaces live at once.
 *
 * The contract is one DOM attribute: a companion window marks its root
 * with [data-companion-window] and registers itself through
 * useCompanionWindow() while open.
 */
const COMPANION_WINDOW_SELECTOR = "[data-companion-window]"

/** t501 — summon doors: elements (the header's AI-assistant button) that
 * must stay clickable while a MODAL dialog is open and whose clicks must
 * never dismiss that dialog. The mask sits BELOW the header strip (z-[39]
 * vs z-40), so the door is bright and alive; this selector is the other
 * half — the dismissal guard honors it. */
const DIALOG_LIVE_SELECTOR = "[data-dialog-live]"

/** t503 — sibling surfaces: the companion contract made MULTIPLE Radix
 * surfaces live at once (a dialog + the assistant, a dialog opened FROM
 * the assistant, a settings dialog over an inspector…). Radix's
 * DismissableLayer was built for a single-modal world: focus that moves
 * into ANOTHER surface fires this one's onFocusOutside and dismisses it
 * (live repro: opening AI settings from the assistant auto-focuses a
 * button inside the fresh dialog — the focusin landed "outside" the job
 * inspector and killed it). In a multi-window world, interacting with one
 * surface belongs to THAT surface: clicks and focus inside any sibling
 * surface never dismiss this one. Same class of exemption as companion
 * windows; sheets ride along (mobile detail sheets share the contract). */
const SIBLING_SURFACE_SELECTOR =
  '[data-slot="dialog-content"], [data-slot="alert-dialog-content"], [data-slot="sheet-content"]'

type CompanionWindowsContextValue = {
  /** How many companion windows are currently open (drives the yield). */
  count: number
  /** Stable register() — returns the unregister for the effect cleanup. */
  register: () => () => void
}

const CompanionWindowsContext =
  React.createContext<CompanionWindowsContextValue | null>(null)

const NOOP = () => {}

function CompanionWindowsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [count, setCount] = React.useState(0)
  // STABLE by design: consumers memo/effect on this function's identity, so
  // a count change must never mint a new one (it uses functional updates).
  const register = React.useCallback(() => {
    setCount((c) => c + 1)
    let active = true
    return () => {
      if (!active) return
      active = false
      setCount((c) => Math.max(0, c - 1))
    }
  }, [])
  const value = React.useMemo(() => ({ count, register }), [count, register])
  return (
    <CompanionWindowsContext.Provider value={value}>
      {children}
    </CompanionWindowsContext.Provider>
  )
}

/** For companion windows: call it inside an effect that lives while the
 * window is open. Without a provider above (tests, stories) it no-ops and
 * dialogs keep their default modality. */
function useCompanionWindow(): () => void {
  const ctx = React.useContext(CompanionWindowsContext)
  return ctx ? ctx.register : NOOP
}

/** True when the event originated inside a registered companion window,
 * a live summon door (same exemption, smaller surface), or a SIBLING
 * surface (t503 — another dialog/sheet layer that shares the screen).
 * Radix's outside handlers receive the custom event dispatched ON the
 * original target, so .target is the real pointerdown/focus/keydown spot.
 *
 * `self` — the CURRENT dialog's own content node (t530). The sibling
 * selector matches [data-slot="dialog-content"] — which is ALSO this
 * dialog itself. Without the self check, a keydown whose target lives
 * inside the dialog's own content (the normal state: Radix parks focus
 * in the content, and the shortcuts dialog's filter input is focused
 * on open) marks the dialog's OWN Escape as "from a sibling" and the
 * guard swallows it — the dialog could never be Esc-closed while its
 * content had focus (t246's "Esc closes the dialog" went real-fail on
 * exactly this). Sibling means OTHER; self is exempt. */
function isFromLiveZone(event: Event, self?: Element | null): boolean {
  // t814 — retarget-proofing: Radix's OUTSIDE events (pointerdown-outside,
  // focus-outside, interact-outside) are CustomEvents dispatched ON THE
  // LAYER NODE, so their `target` is the layer itself — never the
  // pointer's destination. A guard that reads `event.target` asks the
  // layer where the click landed and hears "me" every time: the live-zone
  // match can never fire, and the door's click dismissed the dialog (the
  // flip world's witness: a modal-born storage dialog closed when the AI
  // summon door was clicked, while the door — kept hittable by the t501
  // z-law — opened the companion: dismissal from the focus-outside path,
  // whose custom event also points at the layer). The pointer's truth
  // lives in `detail.originalEvent.target`; the keydown path (a NATIVE
  // event, no detail) keeps reading `event.target` and is untouched.
  const src = (event as { detail?: { originalEvent?: Event } }).detail
    ?.originalEvent?.target
  const target = src ?? event.target
  if (!(target instanceof Element)) return false
  const zone = target.closest(
    `${COMPANION_WINDOW_SELECTOR}, ${DIALOG_LIVE_SELECTOR}, ${SIBLING_SURFACE_SELECTOR}`
  )
  if (zone == null) return false
  // the zone is ME (or a dialog I live inside): my own keypress must
  // still dismiss me — hand it back to Radix unprevented.
  if (self && self.contains(zone)) return false
  return true
}

/**
 * The outside guards: chain after the caller's own handler, then keep the
 * dialog OPEN when the interaction belongs to a companion window. Radix
 * DismissableLayer dismisses on outside pointerdown/interact unless the
 * custom event is defaultPrevented — preventing here is the whole trick.
 * Esc gets the same treatment, one layer deeper: Radix hears Escape on
 * document CAPTURE, so a companion's own Esc handler (bubble phase) could
 * never stop it — but onEscapeKeyDown runs inside the capture listener
 * BEFORE the dismissal check, and preventing it when the FOCUSED element
 * (the keydown target) lives in a companion hands the keypress to the
 * companion's own handler instead: Esc peels the companion, not the
 * dialog under it.
 *
 * t534 — the escape guard NO LONGER rides this composer. Passing a ref
 * into a function called during render is unprovable to the ref lint
 * (react-hooks/refs — it cannot know the composer only reads the ref at
 * keydown time), so the escape self-exemption composes INLINE at its prop
 * (the same shape as the click-to-front handler below): an arrow passed
 * directly as the event handler IS an event handler, and its ref read is
 * self-evidently event-time. The three OUTSIDE guards keep the composer —
 * their targets are outside by definition, no self exemption needed.
 */
function companionGuard<E extends Event>(
  handler: ((event: E) => void) | undefined
): (event: E) => void {
  return (event) => {
    handler?.(event)
    if (!event.defaultPrevented && isFromLiveZone(event)) {
      event.preventDefault()
    }
  }
}

function Dialog({
  modal,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const companions = React.useContext(CompanionWindowsContext)
  const companionOpen = (companions?.count ?? 0) > 0
  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      /* YIELD, don't toggle: while a companion window is open, dialogs drop
       * to non-modal — the mask, focus trap, scroll lock and pointer-events
       * siege all vanish, and Radix itself stops rendering the overlay. An
       * explicit `modal` from the caller always wins (AlertDialog is a
       * separate primitive and stays deliberately, fully modal). The flip
       * re-renders open dialogs mid-flight: Radix swaps its content
       * implementation, which remounts the subtree — surface state lifted
       * above DialogContent (inspector tab, gallery filters) survives, leaf
       * effects just refetch once, the price of two windows living at once. */
      modal={modal ?? !companionOpen}
      {...props}
    />
  )
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      /* t501 — z-[39], one notch BELOW the app's chrome strips (header,
       * canvas selection toolbar, orchestration strip — all z-40): the
       * mask dims the canvas (z-30 and under) but the TOOL STRIP stays
       * bright and live, so the header's AI-assistant door keeps working
       * while a modal dialog is open (the header carries pointer-events-auto
       * against the modal body-wide siege). The dialog content itself stays
       * z-50, above every chrome strip. */
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[39] bg-black/50",
        className
      )}
      {...props}
    />
  )
}

/* ------------------------------------------------------------------ */
/* t792 — the untriggered-dialog family's shared return-address layer  */
/* ------------------------------------------------------------------ */

/**
 * t792 — the fourth family of the focus-relay law. The census: 36 files
 * render a controlled Radix Dialog (open={...}) and only 4 carry a
 * DialogTrigger — the other 32 open imperatively from buttons that often
 * live in OTHER components (header state, chart affordances, gallery
 * cells). Radix's close chain hands the keyboard back to
 * context.triggerRef — null for every untriggered dialog — so
 * `triggerRef.current?.focus()` is a no-op and focus falls to BODY on
 * EVERY exit (measured live twice on the frozen bundle: storage dialog
 * Escape -> BODY, diagnostics dialog Escape -> BODY; the same disease
 * the class gallery's lightbox was born with — born without a trigger —
 * now at census scale).
 *
 * The cure is ONE layer, not 32 wirings. A document-level focusin capture
 * keeps the RETURN ADDRESS — the last opener-like element focused outside
 * every dialog surface — and DialogContent injects a default
 * onCloseAutoFocus that spends it on close. Callers who pass their OWN
 * onCloseAutoFocus (the cured households: canvas t789, job-card t789,
 * class-gallery t791, mol-viewer) replace the default wholesale because
 * {...props} spreads after the injection — bespoke chains stay verbatim.
 *
 * The laws the layer inherits:
 * - the t791 witness stand-down: a focusin that lands OUTSIDE every open
 *   dialog while one is open is a voluntary exit — the pocket is
 *   disarmed (null), never answered with a focus steal. (Side gift: the
 *   browser's own focus of a click-outside target survives the close.)
 * - the t788 order law: the pocket is cleared BEFORE the focus moves.
 * - the t774 contract: the restore passes preventScroll: true.
 * - the nested walk-back: a restored address that lives inside a LIVING
 *   dialog surface stays as that surface's return address, so chained
 *   closes hand focus back through both doors.
 */
type DialogFocusLayer = {
  /** The return address: last opener-like focus outside dialog surfaces. */
  pocket: HTMLElement | null
}

/** t813 — the OPEN-SURFACE truth, read from the DOM. The t792 counter
 * (a mount/unmount balance on the DialogContent WRAPPER) was born blind:
 * the wrapper's hooks run whenever its parent renders the element — the
 * catalog's type cards and the canvas's job cards keep ~50 of them
 * mounted at boot — so the count sat at 50 forever, the stand-down branch
 * always fired, the pocket NEVER armed, and every close of the staged
 * era landed BODY (the flip day's great audit finding, witnessed live:
 * openCount 50 at boot with zero dialogs ever opened, 50 open, 50
 * closed — the counter never moved). The DOM is the truth: a surface is
 * open when its content node says data-state="open". */
function openSurfaceExists(): boolean {
  return (
    document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
    ) != null
  )
}

let gDialogFocusLayer: DialogFocusLayer | null = null
// t813 — the eager build: the layer's listener must beat the world's
// FIRST opener focusin, not the first dialog mount (the lazy build left
// every session's first close without a return address). Client-only —
// the guard inside getDialogFocusLayer keeps SSR honest.
if (typeof document !== "undefined") getDialogFocusLayer()
/** An element that can legitimately receive a focus hand-back: the
 * census openers are buttons, links, form fields and role=button or
 * tabindex cards (the canvas card dialect). */
function isOpenerLike(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return (
    tag === "BUTTON" ||
    tag === "A" ||
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    el.getAttribute("role") === "button" ||
    el.hasAttribute("tabindex")
  )
}

/** True when the element lives inside a dialog surface whose host dialog
 * is CLOSING (data-state="closed" during exit) — restoring focus into a
 * dying subtree is a steal, not a hand-back. Living surfaces (the nested
 * walk-back) pass through. */
function isInsideClosingDialog(el: Element): boolean {
  return (
    el.closest(
      '[data-slot="dialog-content"][data-state="closed"], [data-slot="alert-dialog-content"][data-state="closed"], [data-slot="sheet-content"][data-state="closed"]'
    ) != null
  )
}

/** The layer singleton + its one document listener, built EAGERLY on the
 * client (the t813 flip-day lesson: the lazy build — first DialogContent
 * mount asks for it — meant the page's FIRST opener focusin landed before
 * any listener existed, the pocket never armed, and the first close of
 * every session fell to BODY; witnessed live on the flip world twice).
 * The module loads with the app shell, so the listener beats the world's
 * first opener. */
function getDialogFocusLayer(): DialogFocusLayer | null {
  if (gDialogFocusLayer || typeof document === "undefined") return gDialogFocusLayer
  const layer: DialogFocusLayer = { pocket: null }
  gDialogFocusLayer = layer
  document.addEventListener(
    "focusin",
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      // Focus inside a dialog surface belongs to that surface — Radix
      // parks focus on content/buttons at open and every Tab after; none
      // of it is an opener address.
      if (target.closest(SIBLING_SURFACE_SELECTOR)) return
      // t796 — the live zones are not the outside world: focus landing in
      // a companion window (typing in the AI assistant) or on a summon
      // door (the header's AI button) while a dialog is open is a GLANCE,
      // not a voluntary exit — the t501 contract makes companion
      // interactions exempt from the outside world's judgments ("focus,
      // typing, dragging in the companion work"), and the return address
      // must survive the glance, or Escape lands nobody: the pocket is
      // already spent, the family's BODY disease reborn through the
      // companion door. With no dialog open the zones keep their idle
      // right — an opener-like zone control (the companion textarea, the
      // AI button) arms the pocket, so a dialog opened FROM the assistant
      // hands back to the assistant. Sibling surfaces stay above: their
      // focus belongs to that surface and never arms — a dialog opened
      // from a dialog is the nested walk-back's business.
      if (target.closest(`${COMPANION_WINDOW_SELECTOR}, ${DIALOG_LIVE_SELECTOR}`)) {
        if (!openSurfaceExists() && isOpenerLike(target)) layer.pocket = target
        return
      }
      // t791 witness law: focus landing outside every dialog surface
      // while one is open is a voluntary exit — stand down, don't steal.
      // t813 — but the dying dialog's OWN blur must not stand the pocket
      // down: Radix's exit blurs the content to BODY before
      // onCloseAutoFocus runs, and a BODY focusin is machinery noise,
      // not a voluntary exit — the disarm answers only an opener-like
      // choice (a real element focused while the dialog lived). Witnessed
      // live on the flip world: the storage dialog's Escape landed BODY —
      // the pocket was spent by the exit's own blur before the hand-back
      // could spend it.
      if (openSurfaceExists()) {
        if (isOpenerLike(target)) layer.pocket = null
        return
      }
      if (isOpenerLike(target)) layer.pocket = target
    },
    true
  )
  return layer
}

/** The default close hand-back injected by DialogContent: spend the
 * pocket once, in the t788 order (clear BEFORE focus), guarded against
 * dead openers and dying subtrees. Always preventDefault so Radix's own
 * default (triggerRef?.focus() — a null no-op for untriggered dialogs)
 * is skipped deterministically in BOTH the modal and non-modal chains.
 *
 * t793 — EXPORTED: the alert-dialog and sheet bridges ride the SAME
 * DialogPrimitive.Content close chain (radix's react-alert-dialog renders
 * DialogPrimitive.Content with role="alertdialog"; ui/sheet.tsx aliases
 * react-dialog as SheetPrimitive), so the same handler is their default
 * too — one layer, three bridges, zero second brains. */
export function returnFocusToOpener(event: Event): void {
  const layer = getDialogFocusLayer()
  const pocket = layer?.pocket ?? null
  // t813 — spend-or-yield: preventDefault only when the layer actually
  // has an address to spend. An empty pocket (the arming holes this file
  // no longer has — but a belt needs braces) previously ATE Radix's own
  // trigger refocus and the close landed BODY. Yielding lets Radix's
  // native trigger hand-back answer; the layer only ever ADDS addresses
  // (the imperative openers Radix cannot see), it never removes the
  // native one.
  if (!pocket || !pocket.isConnected || !isOpenerLike(pocket)) return
  if (isInsideClosingDialog(pocket)) return
  // t814 — the remount discrimination: the yield's modal→non-modal swap
  // fires the FocusScope's unmount auto-focus TOO (the old node detaches
  // while the dialog itself LIVES — a surface is still data-state="open"
  // in the DOM). Spending there hands the trigger the keyboard one frame
  // before the remount's own onMountAutoFocus pulls it back into the
  // content, and the pocket is empty when the REAL close comes (witnessed
  // live: the Escape after a yield landed BODY). A real close has no open
  // surface left; a remount has one. And the pocket is cleared only at
  // the spend (the t788 order law governs the SPEND, not the entry — the
  // first cut cleared at entry and the remount's own event emptied the
  // pocket before its discrimination could speak).
  if (openSurfaceExists()) return
  layer && (layer.pocket = null)
  event.preventDefault()
  pocket.focus({ preventScroll: true })
  // The nested walk-back: a restored address inside a LIVING dialog
  // surface remains that surface's return address for its own close.
  if (layer && pocket.closest(SIBLING_SURFACE_SELECTOR)) layer.pocket = pocket
}

/** t793 — the surface-registration half of the layer, EXPORTED for the
 * sibling bridges (ui/alert-dialog.tsx, ui/sheet.tsx): every mounted
 * dialog-family surface counts itself while open, driving the voluntary-
 * exit stand-down. The t792 word-forms live here and nowhere else —
 * one brain, three consumers. */
export function useDialogFocusSurface(): void {
  // t813 — retired: the registration counted RENDERED WRAPPERS, not open
  // surfaces (50 at boot, never moving — the layer's stand-down branch
  // always fired and the pocket never armed). The DOM truth
  // (openSurfaceExists) answers the stand-down at event time; the spend
  // lives in returnFocusToOpener on Radix's own close event. The export
  // stays for the three bridge callers (alert-dialog, sheet, dialog) —
  // one brain, no second counter to resurrect.
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  onEscapeKeyDown,
  onPointerDownCapture,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const companions = React.useContext(CompanionWindowsContext)
  const companionOpen = (companions?.count ?? 0) > 0
  // t530 — this dialog's OWN content node, for the escape guard's self
  // exemption: the sibling-surface selector also matches this very node,
  // and without the exemption a keydown whose target lives inside the
  // content (Radix parks focus on content/buttons at open) swallows its
  // own Escape.
  const selfRef = React.useRef<HTMLDivElement | null>(null)
  // t798 — the flip's scroll memory. Opening or closing a companion
  // window flips this dialog between Radix's modal and non-modal content
  // implementations, which REMOUNTS the whole subtree (the t501-documented
  // flip price — witnessed live twice: the focus reset via the remount's
  // onMountAutoFocus, and the scroll reset: a runs list scrolled deep
  // snapped back to 0 on BOTH flip directions). The remount honors state
  // lifted above the content and refetches leaf effects, but the reader's
  // PLACE is neither — it is the scroll sibling of the focus-relay law,
  // and this memory is how the dialog keeps it. A capture-phase, passive
  // scroll listener on the content node records every inner region's
  // position as it moves (the memory is always current, no timing games
  // with the dying subtree); on each flip-in the layout effect hands
  // every region its place back — synchronously before paint, then once
  // more on the next frame because the flip's leaf refetch can reflow
  // the heights after the first paint. Fresh opens have no memory (the
  // ref dies with the instance), so the top-of-page start stays honest.
  const scrollMemoryRef = React.useRef<number[] | null>(null)
  useDialogFocusSurface()
  React.useLayoutEffect(() => {
    const root = selfRef.current
    if (!root) return
    const collectScrollables = () =>
      Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
        (el) =>
          el.scrollHeight > el.clientHeight + 4 &&
          /(auto|scroll)/.test(getComputedStyle(el).overflowY)
      )
    // apply returns true when the memory is fully consumed (every entry
    // either landed or is irrelevant); false while the flip's remounted
    // subtree is still growing — the leaf refetch re-creates the scrollable
    // regions ASYNCHRONOUSLY (a network round trip can land many frames
    // after the first paint), and a restore that races it loses: the
    // t813 flip-day witness (the storage runs list deep-scrolled to 293
    // snapped to 0 across the companion flip-in and NEVER came back —
    // the old two-beat restore, sync + one frame, fired before the
    // refetch's region existed). The cure is the patient ladder: apply
    // again every frame until every remembered position reads back, or
    // ~90 frames (~1.5s) cap the wait. Fresh opens carry no memory and
    // never enter the ladder at all.
    const apply = () => {
      const memory = scrollMemoryRef.current
      if (!memory) return true
      const scrollables = collectScrollables()
      let pending = scrollables.length < memory.length
      scrollables.forEach((el, i) => {
        if (memory[i] !== undefined) {
          el.scrollTop = memory[i]
          if (el.scrollTop !== memory[i]) pending = true
        }
      })
      return !pending
    }
    apply()
    let ladderRaf = 0
    let frames = 0
    const tick = () => {
      frames += 1
      if (apply() || frames > 90) return
      ladderRaf = requestAnimationFrame(tick)
    }
    ladderRaf = requestAnimationFrame(tick)
    const onScroll = () => {
      scrollMemoryRef.current = collectScrollables().map((el) => el.scrollTop)
    }
    root.addEventListener("scroll", onScroll, { capture: true, passive: true })
    return () => {
      cancelAnimationFrame(ladderRaf)
      root.removeEventListener("scroll", onScroll, { capture: true })
    }
  }, [companionOpen])
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={selfRef}
        data-slot="dialog-content"
        className={cn(
          // t383 — max-h + overflow: on short viewports (the hosted preview
          // panel measures ~577px) a tall dialog centered by the
          // top-50%/translate(-50%,-50%) trick bleeds off BOTH edges and the
          // cut-off footer buttons (Create pipeline, Save…) are un-clickable
          // with no way to scroll — "the button does nothing". Cap the height
          // at the viewport and scroll inside; content that fits is
          // unaffected, and per-dialog className still overrides via twMerge.
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg grid-cols-[minmax(0,1fr)]",
          // t501 — while a companion window is open this dialog renders
          // NON-modal: the dimming mask is gone, and the bright background
          // behind needs a heavier shadow for the sheet to still read as
          // the elevated surface it is.
          companionOpen && "shadow-2xl",
          className
        )}
        /* t501 — the companion guards: interactions that start inside a
         * registered floating window (the AI assistant) must never dismiss
         * this dialog — clicking/typing/dragging over THERE is not
         * "clicking outside" in the user's world. Composed AFTER the
         * caller's own handlers so their judgments (and preventDefaults)
         * always get first say. */
        onPointerDownOutside={companionGuard(onPointerDownOutside)}
        onInteractOutside={companionGuard(onInteractOutside)}
        onFocusOutside={companionGuard(onFocusOutside)}
        /* t530/t534 — the self exemption rides ONLY the escape guard: escape
         * targets can be inside this dialog (focused content), while the
         * outside guards' targets are outside by definition. Composed inline
         * (not via companionGuard) so the ref read lives in a lambda that is
         * ITSELF the prop handler — event-time execution is provable, and
         * the render-phase pass-a-ref lint tripwire is structurally avoided. */
        onEscapeKeyDown={(event) => {
          onEscapeKeyDown?.(event)
          if (!event.defaultPrevented && isFromLiveZone(event, selfRef.current)) {
            event.preventDefault()
          }
        }}
        /* t503 — click-to-front, the dialog's half of the window law:
         * while a companion window is open this dialog is a LIVE surface,
         * and the last-touched window leads. The assistant re-asserts
         * itself on every dialog mount (its own observer) and on every
         * summon (the seq door); this handler gives the dialog the same
         * right on interaction — a pointerdown anywhere on it moves its
         * content node (a direct body child — Radix portals the shared
         * Dialog with no wrapper) to the END of body, above the companion.
         * DOM moves never remount, so leaf state (tab, scroll, inputs)
         * survives untouched. A no-op when already last. */
        onPointerDownCapture={(e) => {
          onPointerDownCapture?.(e)
          if (e.defaultPrevented) return
          if (!companionOpen) return
          const el = e.currentTarget
          if (
            el instanceof HTMLElement &&
            el.isConnected &&
            el.parentElement === document.body &&
            document.body.lastElementChild !== el
          ) {
            document.body.appendChild(el)
          }
        }}
        /* t792 — the family's default close hand-back: spend the shared
         * return-address pocket. {...props} spreads AFTER this line, so a
         * caller's own onCloseAutoFocus (the cured households: canvas
         * t789, job-card t789, class-gallery t791, mol-viewer) replaces
         * this wholesale — the bespoke chains stay verbatim. */
        onCloseAutoFocus={returnFocusToOpener}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

/**
 * Escape peels exactly ONE floating layer.
 *
 * Every Radix Dialog/AlertDialog/Popover root carries its OWN dismissable-
 * layer stack (no shared provider — verified in @radix-ui/react-dismissable-
 * layer dist: the layers Set lives in a per-root context), so when a dialog
 * floats on top of another dialog or sheet, BOTH layers see themselves as
 * the highest layer and one Escape press dismisses the whole tower.
 *
 * Consuming the key at the REACT level (onKeyDown on the content) stops the
 * native event at the React root container — before any document-level
 * Radix listener fires — and the caller closes itself through its own
 * onOpenChange. Behavior for a top-layer dialog is identical to Radix's
 * default dismissal; the layer behind simply survives.
 *
 * Usage: <DialogContent onKeyDown={onEscapeClose(() => setOpen(false))}>
 * (Nested layers resolve themselves: React dispatches to the innermost
 * handler first, so a popover/dialog consuming Escape inside this content
 * stops propagation before this content's handler runs.)
 */
export function onEscapeClose(
  close: () => void
): (e: React.KeyboardEvent) => void {
  return (e) => {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  }
}

export {
  COMPANION_WINDOW_SELECTOR,
  DIALOG_LIVE_SELECTOR,
  SIBLING_SURFACE_SELECTOR,
  CompanionWindowsProvider,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useCompanionWindow,
}
