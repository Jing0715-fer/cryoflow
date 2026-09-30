/**
 * CryoFlow — the map walk's shared constants (t501).
 *
 * The session report's landscape walk picked these numbers for its own
 * probes; the agent's landscape read (get_map_landscape, t501) walks
 * the SAME roster with the SAME cap and the SAME notion of a main map.
 * Constants with two consumers live in ONE place (twins fork, imports
 * don't) — and this place must stay IMPORT-FREE (the report dialog is
 * a client component; a constant lib that drags in node fs would break
 * the browser bundle). Server consumers who need the actual listing
 * drink from lib/relion/outputs-list.ts instead.
 */

/** What counts as a walk's MAIN map: RELION's half-map-zero full maps
 *  (half0 — the combined full map of a refinement) and the postprocess
 *  sharpened map. A candidate's volume family is sorted so a main map
 *  leads; overlays (half pairs, class maps) follow. */
export const MAIN_MAP_RE = /half0|postprocess\.mrc$/i;

/** The landscape walk's roster cap — the paper's own budget (t211): a
 *  session with more completed candidates than this walks only the
 *  newest 24. The tool obeys the same cap so agent and paper never
 *  disagree about who was visited. */
export const MAP_BRIEF_CAP = 24;

/** Which job TYPES can plausibly own a volume (t155): the walk's queue
 *  puts these candidates FIRST (refine3d / class3d / postprocess /
 *  multibody), so the cap lands on real map owners before it ever
 *  touches the never-volume tail. The agent's landscape read (t501)
 *  walks the SAME queue — a landscape question answered from a
 *  different order is a landscape lied about. */
export const VOLUME_CAPABLE_RE = /refine3d|class3d|postprocess|multibody/i;
