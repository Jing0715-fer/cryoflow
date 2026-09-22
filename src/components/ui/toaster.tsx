"use client"

import * as React from "react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

/**
 * Task 174 — the swipe exit changes direction with PLACEMENT. The toast
 * viewport jumps placement at the sm: breakpoint (top-0 full-width below
 * it, bottom-right above — see ToastViewport in ui/toast.tsx), and a
 * gesture contract has to follow the same line: a toast that entered
 * from the top edge leaves UP (the finger pushes it back out the way it
 * came), a corner toast leaves RIGHT (Radix's own default). This is a
 * JS prop on the Provider, so it is a matchMedia read — not CSS — and
 * the breakpoint (640) is the sm: the placement classes already use,
 * NOT useIsMobile's 768: between 640 and 767 the toast sits bottom-right
 * and must still swipe right.
 */
function useToastSwipeDirection(): "up" | "right" {
  const [dir, setDir] = React.useState<"up" | "right">("right")
  React.useEffect(() => {
    const mql = window.matchMedia("(min-width: 640px)")
    const onChange = () => setDir(mql.matches ? "right" : "up")
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])
  return dir
}

export function Toaster() {
  const { toasts } = useToast()
  const swipeDirection = useToastSwipeDirection()

  return (
    <ToastProvider swipeDirection={swipeDirection}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
