import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
 */
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative h-7 gap-1.5 px-2 text-[11px] before:absolute before:-inset-2 before:rounded-md before:content-['']"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}
