import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Task 645 — the chip vocabulary.
 *
 * Before this primitive the same visual object — a small pill of
 * metadata, a filter toggle, a verdict stamp — was hand-written in
 * seven dialects across ~20 files: 9/10/10.5/11px × px-2/px-2.5/px-1.5
 * × rounded-full/rounded-md/bare × font-medium/font-semibold × two
 * focus-ring generations × two press scales. The skeleton looked
 * alike everywhere and matched nowhere twice.
 *
 * The primitive owns the skeleton (radius, padding, type size, weight,
 * tabular numerals, icon slot, canonical focus ring, press feedback);
 * the call site owns placement and tint (margin, gap, conditional
 * color). A className override is a documented design decision — the
 * sweep at each site carries its reason inline.
 *
 * Sizes (the type scale's chip rows, cf. ui/kbd.tsx: 9px = Kbd):
 *   xs    9px  — shrunken chips in tight card corners
 *   sm    10px — static metadata readouts beside chart titles
 *   md    11px — the canonical toggle / filter chip
 *   lg    11px — large result-header tabs and readout pills
 *   stamp 10px — squared verdict / receipt stamps
 */
const chipVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap tabular-nums [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      size: {
        xs: "rounded-full px-1.5 py-px text-[9px] font-medium leading-none",
        sm: "rounded-full px-1.5 py-px text-[10px] font-medium",
        md: "rounded-full px-2 py-0.5 text-[11px] font-medium",
        lg: "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        /* squared stamp — no weight of its own: both verdict-stamp
           sites render inherited weight on purpose */
        stamp: "rounded-md px-1.5 py-0.5 text-[10px]",
      },
      tone: {
        /* outlined pill — hairline border, transparent wash; the tint
           (if any) comes from the call site's conditional classes */
        outline: "border bg-transparent",
        /* borderless muted wash — purely static readouts */
        muted: "border-transparent bg-muted/60 text-muted-foreground",
      },
      interactive: {
        /* t586 canonical ring + press feedback — one generation of
           focus, one press scale, everywhere; transition-all so the
           press scale glides instead of snapping */
        true: "cursor-pointer transition-all focus-visible:outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:active:scale-[0.96]",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "outline",
      interactive: false,
    },
  }
)

function Chip({
  className,
  size,
  tone,
  interactive,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof chipVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="chip"
      className={cn(chipVariants({ size, tone, interactive }), className)}
      {...props}
    />
  )
}

export { Chip, chipVariants }
