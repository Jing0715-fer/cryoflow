"use client"

import * as React from "react"
import * as ToastPrimitives from "@/lib/radix-toast-vendor.mjs"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

// t825 — the stack's breathing room: gap-2 joins the viewport. Under
// TOAST_LIMIT=1 the viewport never held two cards, so the class was
// dead weight; with a depth-3 stack, flush cards read as one broken
// block — the gap is what lets the eye count the stack.
const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        // Task 175 note: `text-destructive-foreground` was a DEAD class
        // until the @theme mapping landed this round (see globals.css) —
        // the label inherited --foreground and read 2.9:1 in light /
        // 2.4:1 in dark. The mapping + the dark token unification are
        // the fix; the variant itself needed no class change.
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  // Task 151 — action widens from ToastActionElement to React.ReactNode:
  // a failed job's news carries TWO bridges (View + Retry) side by side,
  // which needs a wrapper div. The Toaster renders {action} itself, so
  // the Root never needs the prop — it is destructured OUT of the spread
  // below instead of being passed through and type-checked against
  // Radix's ReactElement expectation.
  Omit<React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root>, "action"> &
  VariantProps<typeof toastVariants> &
  { action?: React.ReactNode }
>(({ className, variant, action: _action, duration, children, ...props }, ref) => {
  void _action; // rendered by the Toaster, not by the Root
  // t826 — the hourglass feeds on the toast's OWN duration. duration is
  // destructured out only to size the bar (and handed back to the Root
  // explicitly — the vendor's ToastImpl reads durationProp first,
  // falling back to the Provider's 5e3 default); the var stays honest
  // per-card if a caller ever passes a custom duration. The vendor's
  // startTimer skips 0 and Infinity — an immortal card gets NO bar: a
  // clock that never runs must not be drawn running.
  const effectiveDuration = duration ?? 5000
  const hasTimer = effectiveDuration !== 0 && effectiveDuration !== Infinity
  return (
    <ToastPrimitives.Root
      ref={ref}
      duration={duration}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    >
      {hasTimer && (
        <ToastHourglass
          style={{ "--toast-life": `${effectiveDuration}ms` } as React.CSSProperties}
        />
      )}
      {children}
    </ToastPrimitives.Root>
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

// t826 — the hourglass: the card's remaining life, drawn as a hairline
// along the card's bottom edge. Radix's close timer is the ONLY authority
// on a toast's lifespan, but it is invisible — the t825 patrol watched
// toasts die exactly on schedule and could only take the vendor's word
// for WHEN. The bar draws the timer's own arc (scaleX 1→0 across
// --toast-life), and its freeze rides the vendor's own pause state: the
// mirror in ui/toaster.tsx paints data-timers-paused on the viewport
// from the vendor's OWN toast.viewportPause/Resume events, and the CSS
// rule in globals.css pauses the animation under that attribute — no
// second timer, no drift by construction. The drain flows toward the
// exit corner (origin-right — the slide-out-to-right-full direction),
// so the remaining sliver points at where the card will leave.
// motion-reduce hides the bar: an affordance whose only channel is
// motion should not pretend under reduced motion (the vendor's close
// timer itself is NOT motion — the card still dies on schedule; only
// the drawing goes).
const ToastHourglass = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "toast-hourglass pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-right motion-reduce:hidden",
      "bg-foreground/20 group-[.destructive]:bg-white/40",
      className
    )}
    {...props}
  />
))
ToastHourglass.displayName = "ToastHourglass"

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      // Task 174 — the toast's touch exit. Two grains from the diag:
      // ① opacity-0 + group-hover kept the close FOREVER INVISIBLE on
      //    touch (no hover, no focus — pointer-events were live but the
      //    affordance was a ghost); hover-none: reveals it there, the
      //    same input-modality contract the rest of the app already
      //    speaks (sidebar, project rows, gallery tiles).
      // ② the painted target was 24×24 (p-1 + 16px X) — the ::before
      //    hit-slop grows the TAPPABLE area to 44×44 without moving a
      //    painted pixel; the slop rides the toast body's top-right
      //    corner (text ends well left of it) and the viewport's p-4
      //    padding band above/right, covering nothing interactive.
      // ③ Task 175 — the destructive X. text-red-300 on the destructive
      //    bg measured 2.49:1 in light and 1.50:1 in dark (the dark token
      //    was a BRIGHTER red — red ink on brighter red). red-200 keeps
      //    the tint language and clears the 3:1 UI bar in both themes
      //    (~3.3:1) now that the surface is one red in both themes.
      //    t646 — the surface's hue moved to rose (--destructive now
      //    rides rose-600), so the on-surface accent rungs follow the
      //    family: rose-200/rose-50/rose-400 at the SAME lightness rungs
      //    — contrast verdicts unchanged, hue wheel unified.
      "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 hover-none:opacity-100 before:absolute before:-inset-2.5 before:content-[''] group-[.destructive]:text-danger-200 group-[.destructive]:hover:text-danger-50 group-[.destructive]:focus:ring-danger-400 group-[.destructive]:focus:ring-offset-danger-600",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold [&+div]:text-xs", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    // group-[.destructive]:opacity-100 (Task 175): the template's 90%
    // opacity blends the ink toward the red bg and the description lands
    // at ~4.3:1 — under the 4.5 bar for small text. Full opacity on the
    // destructive surface measures ~4.55:1; other variants keep 90.
    className={cn("text-sm opacity-90 group-[.destructive]:opacity-100", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastHourglass,
}