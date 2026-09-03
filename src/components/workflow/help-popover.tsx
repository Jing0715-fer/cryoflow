"use client";

import * as React from "react";
import { HelpCircle, MousePointer2, Link2, Play, ZoomIn, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

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
    text: "Run a job from the details panel — progress is simulated server-side.",
  },
  {
    icon: <ZoomIn className="size-3.5 text-primary" />,
    text: "Zoom with the floating controls; press ESC to cancel a connection or deselect.",
  },
  {
    icon: <Trash2 className="size-3.5 text-primary" />,
    text: "Delete jobs from the danger zone — incoming edges are removed too.",
  },
];

export function HelpPopover() {
  const [open, setOpen] = React.useState(false);

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
      </PopoverContent>
    </Popover>
  );
}
