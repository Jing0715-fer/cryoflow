"use client";

import * as React from "react";
import { BookOpen, HelpCircle, MousePointer2, Link2, Play, ZoomIn, Trash2, Keyboard } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useWorkflowStore } from "@/lib/store";

const TIPS: { icon: React.ReactNode; text: string }[] = [
  {
    icon: <MousePointer2 className="size-3.5 text-primary" />,
    text: "Click a job card to inspect and edit it in the side panel.",
  },
  {
    icon: <MousePointer2 className="size-3.5 text-primary" />,
    text: "Drag cards to rearrange the workflow — position is saved automatically.",
  },
  {
    icon: <Link2 className="size-3.5 text-primary" />,
    text: "Click an output port (right edge), then a target's input port (left edge) to connect jobs.",
  },
  {
    icon: <Play className="size-3.5 text-primary" />,
    text: "Run a job from the details panel — the engine drives it live and progress updates in place.",
  },
  {
    icon: <ZoomIn className="size-3.5 text-primary" />,
    text: "Zoom with the floating controls; press ESC to cancel a connection or deselect.",
  },
  {
    icon: <Trash2 className="size-3.5 text-primary" />,
    text: "Right-click cards for the quick-action menu (run · duplicate · delete …).",
  },
];

export function HelpPopover() {
  const [open, setOpen] = React.useState(false);
  const setShortcutsOpen = useWorkflowStore((s) => s.setShortcutsOpen);
  // t482 — the popover stays the canvas quick start; the manual's full
  // weight (storage & the graveyard, the assistant, clusters, finding
  // your way) lives one CTA away in the guide dialog
  const setHelpGuideOpen = useWorkflowStore((s) => s.setHelpGuideOpen);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Help — how to use the workflow canvas"
          className="text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="size-4.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-4">
        <p className="text-sm font-medium">How to build a workflow</p>
        <ul className="mt-3 space-y-2.5">
          {TIPS.map((tip, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                {tip.icon}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {tip.text}
              </span>
            </li>
          ))}
        </ul>
        {/* the manual: the popover teaches the canvas, the guide dialog
            carries the whole product (t482) — two CTAs, two doors, one
            manual each */}
        <Button
          variant="default"
          size="sm"
          className="mt-4 w-full gap-2"
          onClick={() => {
            setOpen(false);
            setHelpGuideOpen(true);
          }}
        >
          <BookOpen className="size-3.5" aria-hidden="true" />
          Read the full guide
        </Button>
        {/* the full shortcut inventory lives in the shortcuts dialog (one
            data source, three doors: "?" key, this CTA, command palette) —
            a popover copy drifted and cramped 15 rows into w-80 */}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 w-full gap-2"
          onClick={() => {
            setOpen(false);
            setShortcutsOpen(true);
          }}
        >
          <Keyboard className="size-3.5 text-primary" aria-hidden="true" />
          View all keyboard shortcuts
          <Kbd className="ml-auto px-1.5 py-0.5 text-[10px]">?</Kbd>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
