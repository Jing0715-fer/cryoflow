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
  Box,
  Boxes,
  Brain,
  Brush,
  CircleDot,
  Combine,
  Crop,
  Crosshair,
  Dna,
  EyeOff,
  Focus,
  FolderInput,
  FolderOpen,
  Gauge,
  Gem,
  LayoutGrid,
  Layers,
  ListFilter,
  Merge,
  Move3d,
  Network,
  Scissors,
  Search,
  Sparkles,
  Terminal,
  Wand2,
  Waves,
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
    case "Search":
      return <Search className={className} aria-hidden="true" />;
    case "Crop":
      return <Crop className={className} aria-hidden="true" />;
    case "ListFilter":
      return <ListFilter className={className} aria-hidden="true" />;
    case "LayoutGrid":
      return <LayoutGrid className={className} aria-hidden="true" />;
    case "Layers":
      return <Layers className={className} aria-hidden="true" />;
    case "Boxes":
      return <Boxes className={className} aria-hidden="true" />;
    case "Gem":
      return <Gem className={className} aria-hidden="true" />;
    case "Combine":
      return <Combine className={className} aria-hidden="true" />;
    case "CircleDot":
      return <CircleDot className={className} aria-hidden="true" />;
    case "Merge":
      return <Merge className={className} aria-hidden="true" />;
    case "Scissors":
      return <Scissors className={className} aria-hidden="true" />;
    case "Sparkles":
      return <Sparkles className={className} aria-hidden="true" />;
    case "Gauge":
      return <Gauge className={className} aria-hidden="true" />;
    case "Wand2":
      return <Wand2 className={className} aria-hidden="true" />;
    case "Focus":
      return <Focus className={className} aria-hidden="true" />;
    case "Waves":
      return <Waves className={className} aria-hidden="true" />;
    case "Dna":
      return <Dna className={className} aria-hidden="true" />;
    case "FolderOpen":
      return <FolderOpen className={className} aria-hidden="true" />;
    case "Move3d":
      return <Move3d className={className} aria-hidden="true" />;
    case "Box":
      return <Box className={className} aria-hidden="true" />;
    case "EyeOff":
      return <EyeOff className={className} aria-hidden="true" />;
    case "Terminal":
      return <Terminal className={className} aria-hidden="true" />;
    case "Brush":
      return <Brush className={className} aria-hidden="true" />;
    case "DynaMight":
      // deep-learning picker — no lucide icon of that name
      return <Brain className={className} aria-hidden="true" />;
    case "ModelAngelo":
      // deep-learning model building
      return <Network className={className} aria-hidden="true" />;
    default:
      return <Boxes className={className} aria-hidden="true" />;
  }
}
