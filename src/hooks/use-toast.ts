"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

// t825 — the stack: the mouth holds THREE, not one. The t822 tuition was
// this constant's live pain: the share flight toast ("Shared view
// restored…") kept dying early because ANY toast fired during its five
// seconds evicted it (LIMIT=1 — every ADD is an eviction). A depth-3
// stack makes that eviction structurally impossible at the depths the
// app actually speaks in bursts (the door's rename/duplicate/share
// chorus, the store's news flow) — a verdict now outlives the chatter
// and a poller sees its full lifetime.
const TOAST_LIMIT = 3
// t825 — the queue learns to bury. The shadcn fossil kept a dismissed
// toast in state for 1e6 ms (~16.7 minutes) so the exit animation could
// finish — harmless under LIMIT=1 (the next ADD evicted the invisible
// dead slot) but SILT under a stack: three deaths would leave three dead
// slots, and the next verdict would surface into a stack that renders
// one. 250 ms is the honest burial: the exit animation's own length
// (animate-out ≈150ms — fade-out-80 + slide-out-to-right-full,
// ui/toast.tsx) plus margin. Radix closes the toast (onOpenChange(false)
// → DISMISS → open:false), the exit animation plays, THEN the element
// leaves state — the burial is synced to the animation, not to a clock
// nobody watches.
const TOAST_REMOVE_DELAY = 250

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  // Task 151 — widened from ToastActionElement to React.ReactNode: a
  // failed job's news carries TWO bridges (View + Retry) side by side,
  // which needs a wrapper div around the pair.
  action?: React.ReactNode
}

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

type Action =
  | {
    type: ActionType["ADD_TOAST"]
    toast: ToasterToast
  }
  | {
    type: ActionType["UPDATE_TOAST"]
    toast: Partial<ToasterToast>
  }
  | {
    type: ActionType["DISMISS_TOAST"]
    toastId?: ToasterToast["id"]
  }
  | {
    type: ActionType["REMOVE_TOAST"]
    toastId?: ToasterToast["id"]
  }

interface State {
  toasts: ToasterToast[]
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      // ! Side effects ! - This could be extracted into a dismissToast() action,
      // but I'll keep it here for simplicity
      if (toastId) {
        addToRemoveQueue(toastId)
      } else {
        state.toasts.forEach((toast) => {
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
              ...t,
              open: false,
            }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = genId()

  const update = (props: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...props, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  return {
    id: id,
    dismiss,
    update,
  }
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    // t824 — close the boot gap: a toast dispatched between THIS
    // component's render (useState snapshot taken) and this effect
    // (subscription attached) updated memoryState but notified an EMPTY
    // listener set, and useState never re-reads — the toast was silently
    // lost. The live victim: the shared-view landing's malformed-bounce
    // toast, whose effect fires in the hydration commit BEFORE this
    // sibling subscription (page subtree first, layout sibling after) —
    // the link was consumed, the address bar cleaned, and the user got
    // nothing. The resync pulls any commit-window dispatch in at
    // subscribe time; when nothing moved, setState receives the same
    // reference and React bails out — the resync is free.
    setState(memoryState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }
export type { ToasterToast, ToastActionElement }