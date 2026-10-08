/**
 * CryoFlow — the journal kind's shared face (Task 720).
 *
 * Seven journal kinds, one vocabulary: this module is the SINGLE source
 * for the kind → { icon, verb, tone } mapping. Two faces speak it —
 * the inspector's per-job Timeline spine (Task 718) and the dashboard's
 * journal digest (Task 720, the cross-job shopwindow). A vocabulary
 * shared by two faces that lives in one of them is a vocabulary the
 * other face copies — and a copied vocabulary drifts (one face says
 * "Auto-started" while the other settles for "Auto start"). Hence this
 * file: the mapping lives here, both faces import it, and a probe pins
 * the definition count at one.
 *
 * Lives in the components layer, not lib/: the icons are React element
 * types and lib/job-journal.ts keeps its purity law (no React there).
 * This file adds nothing but the mapping — no hooks, no JSX, no DOM.
 */

import type { ElementType } from "react";
import {
  AlertTriangle,
  Check,
  Pencil,
  Play,
  SlidersHorizontal,
  StickyNote,
  Zap,
} from "lucide-react";
import type { JobJournalKind } from "@/lib/job-journal";

export const JOURNAL_KIND_FACE: Record<
  JobJournalKind,
  { icon: ElementType; verb: string; tone?: "bad" | "good" }
> = {
  run: { icon: Play, verb: "Run started" },
  kicked: { icon: Zap, verb: "Auto-started" },
  completed: { icon: Check, verb: "Completed", tone: "good" },
  failed: { icon: AlertTriangle, verb: "Failed", tone: "bad" },
  params: { icon: SlidersHorizontal, verb: "Params changed" },
  note: { icon: StickyNote, verb: "Note saved" },
  renamed: { icon: Pencil, verb: "Renamed" },
};
