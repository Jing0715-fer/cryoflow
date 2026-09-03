"use client";

/**
 * Client-side lucide icon registry.
 * workflow.ts refers to icons by NAME string (server-safe); <TypeIcon> is the
 * only place where lucide components are imported for job types.
 * A switch is used (not a map lookup rendered as a variable component) so
 * every JSX element references statically-declared components.
 */

import {
  Aperture,
  Boxes,
  CircleDot,
  Crosshair,
  Crop,
  FolderInput,
  Gem,
  LayoutGrid,
  Sparkles,
  Wind,
} from "lucide-react";

export function TypeIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case "FolderInput":
      return <FolderInput className={className} aria-hidden="true" />;
    case "Wind":
      return <Wind className={className} aria-hidden="true" />;
    case "Aperture":
      return <Aperture className={className} aria-hidden="true" />;
    case "Crosshair":
      return <Crosshair className={className} aria-hidden="true" />;
    case "Crop":
      return <Crop className={className} aria-hidden="true" />;
    case "LayoutGrid":
      return <LayoutGrid className={className} aria-hidden="true" />;
    case "Gem":
      return <Gem className={className} aria-hidden="true" />;
    case "Sparkles":
      return <Sparkles className={className} aria-hidden="true" />;
    case "CircleDot":
      return <CircleDot className={className} aria-hidden="true" />;
    default:
      return <Boxes className={className} aria-hidden="true" />;
  }
}
