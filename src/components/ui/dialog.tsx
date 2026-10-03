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
  const target = event.target
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
  // content (Radix parks focus here on open) swallows its own Escape.
  const selfRef = React.useRef<HTMLDivElement | null>(null)
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
