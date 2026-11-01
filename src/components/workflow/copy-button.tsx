"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one clipboard affordance (Task 170 — extracted from job-inspector
 * so the JobPanel's command preview speaks the same dialect): click,
 * write, flip to "Copied" for 1.4 s, flip back. Label optional — the
 * icon alone is the compact form.
 *
 * Task 171: the compact form measured 34×28 px in the mobile Sheet —
 * under the 44×44 touch-target convention. The ::before hit-slop grows
 * the TAPPABLE area to ~50×44 without moving a pixel of the visual
 * button (the slop rides over the adjacent non-interactive <pre> in
 * every consumer, so nothing interactive is shadowed).
 *
 * t871 — the door grows three ADDITIVE optional props so the AI panel's
 * header can seat the transcript-level copy door (the t428 export's
 * sibling): the source there is not a ready string but a FETCH (the
 * session of record's `?format=md` bytes — one maker, zero format
 * drift), and the seat sits in a row of interactive icon buttons where
 * the hit-slop would shadow real doors.
 *
 *   getText   async source — click awaits it, writes what it returns.
 *             A rejection means the clipboard never lies: NO flip, NO
 *             "Copied"; the consumer owns the error's voice (toast).
 *             When absent, the classic static `text` rides unchanged —
 *             every existing consumer keeps its exact behavior.
 *   disabled  the honest refusal (the send door's own calibre): a door
 *             with nothing behind it says so, it does not fail silently.
 *   className merged AFTER the base classes — a seat may quiet the hit-
 *             slop (`before:hidden`) or resize without forking families.
 */
export function CopyButton({
  text,
  label,
  iconOnly,
  getText,
  disabled,
  className,
}: {
  /** the classic static source. Optional since t871: a getText door has
   * no ready string to hold — exactly one of the two sources rides. */
  text?: string;
  label?: string;
  /** t870 — the compact door for dense surfaces (the chat turn, the
   * session row): the icon alone rides, the name goes to the accessible
   * name + the title — the ToolCard locate door's own dialect. */
  iconOnly?: boolean;
  /** t871 — async source: the bytes are fetched, not held. One maker's
   * format rides the clipboard; a failed fetch is the consumer's toast,
   * never a false "Copied". */
  getText?: () => Promise<string>;
  /** t871 — the honest refusal while there is nothing to copy. */
  disabled?: boolean;
  /** t871 — the seat's own dialect (cn-merged after the base). */
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const write = React.useCallback(() => {
    // exactly one source rides: the async fetch, else the static string.
    // Neither present = a door with nothing behind it — the types forbid
    // it, and the runtime agrees (a silent no-op, never an empty copy).
    const payload: string | Promise<string> | null = getText
      ? getText()
      : text != null
        ? Promise.resolve(text)
        : null;
    if (payload == null) return;
    void Promise.resolve(payload)
      .then((t) => navigator.clipboard.writeText(t))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
        /* no flip — a clipboard that never wrote must never say it did;
         * the consumer's getText already spoke the error's voice */
      });
  }, [getText, text]);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "relative h-7 gap-1.5 px-2 text-[11px] before:absolute before:-inset-2 before:rounded-md before:content-['']",
        className
      )}
      onClick={write}
      disabled={disabled}
      aria-label={label ?? "Copy"}
      title={iconOnly ? label ?? "Copy" : undefined}
    >
      {copied ? <Check className="size-3.5 text-success-600" /> : <Copy className="size-3.5" />}
      {label && !iconOnly ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}
