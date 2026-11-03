"use client";

/**
 * FleetTrendCard — t1056: the fleet ledger's THIRD mouth (the dashboard
 * glance). The ring's story now has three mouths and one well:
 *   · the storage dialog's strip (t1055) — the ring inside the ledger;
 *   · the AI's breath (t1054/t1055) — "is my cluster usage growing?"
 *     answered in chat;
 *   · THIS card — the active project's cluster bytes and their trend,
 *     at a glance on the Dashboard, without opening anything.
 *
 * The ARITHMETIC (bar heights, per-bar titles, the delta's voices) is
 * the one-voice well's (fleet-trend.ts, t1056) — this card drinks the
 * same cup the dialog's strip drinks; twins fork, imports don't.
 *
 * Honesty surfaces (the family's laws, kept):
 *   · the honest empty — a project with no remote runs dissolves the
 *     card entirely (connections empty → return null), never an empty
 *     shell pretending a fleet exists;
 *   · the sidecar-served read is stamped ("measured Xm ago" / "never
 *     measured") — the card never pretends its cluster numbers are
 *     fresh; Measure now buys live probes (budgeted server-side) and
 *     grows the ring, so the voice then speaks the delta;
 *   · unanswered workdirs wear an amber chip ("N unanswered") — a
 *     partial ledger says so;
 *   · the bars stay decoration (aria-hidden) and the paragraph is the
 *     voice (the t1055 aria law — the 173/151 world does not move);
 *   · two bands at a glance; the door names the rest (the t510 pane
 *     law — a cap nobody sees is a cap that isn't there);
 *   · a failed read stays a section-local courtesy line with a retry —
 *     the ledger is an addition, never a gate on the dashboard; the
 *     line's words are the well's (t1116 — fleetReadFailureLine), so
 *     the sentence is owned once and the attribution never wraps
 *     itself (THE DOUBLED WORD, filmed live this window, is buried by
 *     shape: the failure rides a typed FleetFailure, not a string);
 *   · a failed Measure now SPEAKS (t1116 — the amber note, the second
 *     filmed scar): the silence was a lie — the user clicked, the
 *     attempt died, and the band said nothing; the note names the
 *     attempt, attributes the death, and states what the band keeps
 *     showing (the last honest numbers — the t1109 law's UI face).
 */

import * as React from "react";
import { AlertTriangle, HardDrive, Loader2, RefreshCw, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/lib/store";
import { fmtBytes } from "@/lib/relion/disk-usage";
import { fleetTrendSpec, fleetTrendSpanVoice, fleetTrendMirrorHop, fleetTrendCeilingFace, fleetTrendHoleSummary, fleetTrendHoleCount, fleetTrendGapTitle, fleetUnansweredVoice, fleetUnmirroredRuns, fleetReadFailureLine, fleetMeasureFailureLine, FLEET_MEASURED_EVENT, FLEET_DIAG_FOCUS_EVENT, FLEET_TREND_RING_CAP, type FleetFailure } from "@/lib/remote/fleet-trend";

/** the stamp dialect — the dialog's graveAge words, one mouth (the
 *  trend voices reference this same arithmetic; the words must match). */
function stampAgo(measuredAt: string): string {
  const ms = Date.now() - new Date(measuredAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

/** the route's response contract, mirrored client-side (the family
 *  keeps route types out of client imports — same shape as the
 *  storage dialog's local FleetConnectionRow). */
interface FleetCardJob {
  jobId: string;
  jobName: string;
  remoteBytes: number | null;
  // t1100 — the type catches up with what the ledger has served since
  // its birth: the run's mirror-dir presence (the walk's own word) —
  // the unmirrored naming's raw material.
  localExists: boolean;
}
interface FleetCardConnection {
  connectionId: string | null;
  connectionName: string;
  host: string | null;
  jobs: FleetCardJob[];
  remoteBytesTotal: number | null;
  localBytesTotal: number;
  syncCeilingBytes: number | null;
  measured: number;
  unmeasured: number;
  /** ≥1 probe answered — the connection spoke (the lib's own words;
   *  t1082 — the mirror grows the field the route always served). */
  reachable: boolean;
  // t1100 — the walk's spokenness rides the row (the ledger's own
  // stamp): false = the mirror faces are unverified, and the card's
  // faces say so instead of wearing a zero the walk never earned.
  mirrorWalkSpoke: boolean;
  measuredAt: string | null;
  // t1098 — the type catches up with what the ledger has served since
  // t1095: the ring's rows carry the SECOND CHANNEL's word beside the
  // cluster bytes (optional — channel-young points lack the key).
  history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];
}
interface FleetCardBody {
  connections: FleetCardConnection[];
  measuredAt: string | null;
  incomplete: boolean;
  generatedAt: string;
}

/** bands at a glance; the door names the rest (the t510 pane law) */
const FLEET_CARD_CONN_CAP = 2;

export function FleetTrendCard() {
  const projectId = useWorkflowStore((s) => s.project?.id ?? null);
  const [body, setBody] = React.useState<FleetCardBody | null>(null);
  const [error, setError] = React.useState<FleetFailure | null>(null);
  const [measureError, setMeasureError] = React.useState<FleetFailure | null>(null);
  const [measuring, setMeasuring] = React.useState(false);
  // AN14 — THE READ GETS ITS OWN FACE: the Retry door was quiet today —
  // the read flew with no face at all (the door stayed enabled, the icon
  // stayed still, the word stayed "Retry"), a second click while the
  // first read hung would fly another read (the seq-gate refuses its
  // verdict, but the door LOOKED idle). The reading flag is the read
  // flight's OWN — the same ownership the measuring flag earned in
  // t1121: a refused paint cannot stick the door disabled.
  const [reading, setReading] = React.useState(false);
  const [showAllConns, setShowAllConns] = React.useState(false);

  // AN12 — THE FLEET READ OWNS ITS BOARD (t1121): the t1120 law across
  // the family. Every load takes a sequence number at REQUEST time; only
  // the newest requested load paints (a superseded verdict is refused at
  // the door: stale bytes never overwrite a fresh body, a stale failure
  // never erases fresh contents, a ghost load from a dead question
  // paints nothing — the bell rides inside the gate with its verdict).
  const seqRef = React.useRef(0);
  const load = React.useCallback(
    async (measure: boolean): Promise<void> => {
      if (!projectId) return;
      const seq = ++seqRef.current;
      if (measure) setMeasuring(true);
      else setReading(true); // AN14 — the read flight raises its own face
      try {
        const res = await fetch(
          `/api/projects/${projectId}/fleet-ledger${measure ? "?measure=1" : ""}`
        );
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok || (json as { error?: string } | null)?.error) {
          // t1116 — the failure rides its SHAPE: the server's own word
          // (or the bare status when the body was unreadable) travels
          // as { kind: "server", raw } — the attribution well speaks
          // it verbatim, the template never wraps a sentence again.
          const failure: FleetFailure = {
            kind: "server",
            raw: (json as { error?: string } | null)?.error ?? `HTTP ${res.status}`,
          };
          if (seq !== seqRef.current) return; // a superseded verdict is refused
          if (measure) setMeasureError(failure);
          else {
            setError(failure);
            setBody(null);
          }
          return;
        }
        if (seq !== seqRef.current) return; // the newest load owns the board — the bell with it
        setBody(json as FleetCardBody);
        setError(null);
        setMeasureError(null);
        // t1057 — the family bell: this seat just bought a live measure;
        // every cached mouth (the KPI band's spark) re-pours so nobody
        // drinks a stale cup in silence. The bell rides INSIDE the gate:
        // a refused verdict delivers nothing — the seat spoke no fresh
        // word, so the family hears none.
        if (measure) window.dispatchEvent(new CustomEvent(FLEET_MEASURED_EVENT));
      } catch {
        // t1116 — the unanswered face: the fetch itself threw (the
        // server never spoke). The sentence is GONE from this seat —
        // the shape says which face failed; the attribution well owns
        // the words (the doubled word's grave).
        const failure: FleetFailure = { kind: "unanswered" };
        if (seq !== seqRef.current) return; // the catch repeats the gate
        if (measure) setMeasureError(failure);
        else {
          setError(failure);
          setBody(null);
        }
      } finally {
        // the measuring flag is the measure flight's OWN — the door admits
        // exactly one measure (disabled mid-flight), so its own finally
        // lifts the face even when a newer read refused the paint: the
        // flight really ended; the flag is the door's, not the board's.
        if (measure) setMeasuring(false);
        // AN14 — the read's flag is the read flight's OWN, the same law:
        // the finally lifts it unconditionally — a superseded read's
        // refused paint must never stick the Retry door disabled.
        else setReading(false);
      }
    },
    [projectId]
  );

  React.useEffect(() => {
    setBody(null);
    setError(null);
    setMeasureError(null);
    setShowAllConns(false);
    if (projectId) void load(false);
  }, [projectId, load]);

  // the honest empty: no answer yet, or a project with no remote runs —
  // the card dissolves and the dashboard's rhythm is untouched
  if (!body || body.connections.length === 0) {
    if (body || !error) return null;
    // a failed FIRST read is a courtesy line, never a gate
    return (
      <section
        aria-label="Fleet storage — read failed"
        data-testid="fleet-card-error"
        className="rounded-xl border border-dashed px-4 py-3 text-[11px] text-muted-foreground"
      >
        <p>{fleetReadFailureLine(error)}</p>
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 gap-1 text-[11px]"
          onClick={() => void load(false)}
          disabled={reading}
          aria-busy={reading}
          aria-label={
            reading
              ? "Re-reading the fleet ledger — every connection asked again…"
              : "Retry reading the fleet ledger"
          }
          data-testid="fleet-card-retry"
        >
          <RefreshCw
            className={reading ? "size-3 animate-spin" : "size-3"}
            aria-hidden="true"
          />
          {reading ? "Re-reading…" : "Retry"}
        </Button>
      </section>
    );
  }

  const stamp = body.measuredAt ? stampAgo(body.measuredAt) : "never measured";
  const shownConns = showAllConns ? body.connections : body.connections.slice(0, FLEET_CARD_CONN_CAP);
  const hiddenConns = body.connections.length - shownConns.length;
  // t1068 — the honest COUNT third voice: some was never the word for
  // zero answered. The aggregate measured/total across the bands names
  // the scale (every · some · silent when all answered).
  const aggMeasured = body.connections.reduce((s, c) => s + c.measured, 0);
  const aggJobs = body.connections.reduce((s, c) => s + c.jobs.length, 0);
  const unansweredHeader = body.incomplete && body.measuredAt ? `${fleetUnansweredVoice(aggMeasured, aggJobs)} · ` : "";

  return (
    <section
      aria-label="Fleet storage — cluster disk usage and its trend for the active project"
      data-testid="fleet-card"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <HardDrive className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Fleet storage</h2>
        <span
          className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          title={
            body.measuredAt
              ? `The cluster side is only as young as its last SSH probe — measured ${stamp}.\nMeasure now refreshes it.`
              : "The cluster side has never been probed — Measure now speaks the first number."
          }
        >
          {unansweredHeader}
          measured {stamp}
        </span>
        <span className="text-[11px] text-muted-foreground">
          what this project&apos;s runs hold on the connected clusters
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-7 gap-1 text-[11px]"
          data-testid="fleet-card-measure"
          onClick={() => void load(true)}
          disabled={measuring}
          aria-busy={measuring}
          aria-label={
            measuring
              ? "Measuring the cluster — every workdir asked over SSH, one at a time"
              : "Measure the cluster now — ask every workdir its size over SSH"
          }
          title="Probes every workdir over SSH (budgeted, sequential) and grows the trend ring — the strip's voice then speaks the delta."
        >
          {measuring ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-3" aria-hidden="true" />
          )}
          Measure now
        </Button>
      </div>

      {/* t1116 — THE MEASURE-FAILURE NOTE (the second filmed scar's
          cure): a failed Measure now SPEAKS, section-local, in the
          family's warning voice (the unanswered chip's amber face, the
          aria-live politeness the error strips keep). The band below
          stays the last honest read — the note never replaces it, it
          names the attempt that died. */}
      {measureError ? (
        <p
          data-testid="fleet-card-measure-error"
          aria-live="polite"
          className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 px-2 py-1 text-[11px] font-medium text-warning"
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          {fleetMeasureFailureLine(measureError)}
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        {shownConns.map((conn) => {
          const key = conn.connectionId ?? "orphan";
          // t1084 — the ceiling's share, ONE arithmetic per zoom (the
          // aria, the title and the new visible line drink the same
          // const — the triple inline fork retires): a zero ceiling is
          // an unreadable policy, the never-divide law treats it as
          // unknown (the whaleLine law's sibling).
          const ceilingBytes =
            conn.syncCeilingBytes != null && conn.syncCeilingBytes > 0 ? conn.syncCeilingBytes : null;
          const ceilingShare =
            ceilingBytes != null ? ((conn.localBytesTotal / ceilingBytes) * 100).toFixed(0) : null;
          // t1098 — THE CEILING'S TEMPORAL FACE: the mirrors' arc across
          // the ring, mapped into the share's own dialect (the well's
          // fleetTrendCeilingFace — ONE walk with the span voice). The
          // face only rides an answered ceiling (no ceiling, no share,
          // no weather) — the silence laws live in the well.
          const ceilingFace = ceilingBytes != null ? fleetTrendCeilingFace({ history: conn.history }) : null;
          // t1100 — THE UNMIRRORED NAMING, the card's seat: the count from
          // the ONE well over the row's own localExists flags; the fork
          // checks the WALK'S SPOKENNESS first (the ledger row's stamp) —
          // a walk that never spoke leaves the mirror faces unverified
          // (the dash, the silent bar, the silent strip) and the badge
          // stays home. The all-absent face names the empty mirror side
          // instead of a zero with a false subject; the some-absent badge
          // names the runs whose bytes live on the cluster alone.
          const unmirrored = fleetUnmirroredRuns(conn.jobs);
          const mirrorsSpoke = conn.mirrorWalkSpoke;
          const allAbsent = mirrorsSpoke && conn.jobs.length > 0 && unmirrored === conn.jobs.length;
          // the present's own mirror word fed to the strip's hop: a walk
          // that never spoke has no word (null — the well's guards silence
          // the hop); the all-absent vanishing keeps its word (the hop's
          // own presence guard lets only a DOWN speak).
          const presentMirrorWord = mirrorsSpoke ? conn.localBytesTotal : null;
          // t1085 — the policy's delta, ONE arithmetic (the same const
          // shape the dialog's policy line hoisted: clamp at zero, a
          // null or empty cluster side weighs nothing against the
          // mirrors — the never-divide law's shape).
          const deltaOnly =
            conn.remoteBytesTotal != null && conn.remoteBytesTotal > 0
              ? Math.max(conn.remoteBytesTotal - conn.localBytesTotal, 0)
              : 0;
          return (
            <div
              key={key}
              data-testid={`fleet-card-band-${key}`}
              className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* t1082 — THE DOT'S PARITY: the reachable fact (the
                    connection spoke — ≥1 probe answered) wears the
                    dialog's status dot here too: the same size-2 face,
                    the same two titles — one voice, two zooms (the
                    t1079 law's next catch: the hunt found the dialog's
                    leading dot with no card sibling, the Server icon
                    silent in both worlds). The icon stays the card's
                    own cluster mark; the dot is the health voice. */}
                <span
                  aria-hidden="true"
                  className={`inline-block size-2 rounded-full ${conn.reachable ? "bg-success-500" : "bg-warning/60"}`}
                  title={
                    conn.reachable
                      ? "The cluster answered at least one workdir probe at the last measurement"
                      : "No workdir answered at the last measurement — the connection may be down, or never measured"
                  }
                />
                <Server className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs font-semibold">{conn.connectionName}</p>
                {conn.host && (
                  <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {conn.host}
                  </span>
                )}
                {conn.unmeasured > 0 && (
                  <span
                    className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning"
                    title={`${conn.unmeasured} of ${conn.jobs.length} workdirs went unanswered at the last measure (an honest hole, never a zero)`}
                  >
                    {conn.unmeasured} unanswered
                  </span>
                )}
                {/* t1100 — THE UNMIRRORED BADGE: runs whose local mirror
                    directory is absent — their bytes live on the cluster
                    alone. The walk's spokenness gates it (an unverified
                    count is never named); today's all-mirrored world
                    renders nothing (the baselines hold). */}
                {mirrorsSpoke && unmirrored > 0 && (
                  <span
                    className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning"
                    title={`${unmirrored} of ${conn.jobs.length} runs have no local mirror directory — their bytes live on the cluster alone`}
                  >
                    {unmirrored} unmirrored
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {conn.measured}/{conn.jobs.length} workdirs answered
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <div
                  title={`The cluster side: ${conn.measured} workdir${conn.measured === 1 ? "" : "s"} answered \u2018du\u2019 over SSH${conn.unmeasured > 0 ? `; ${conn.unmeasured} went unanswered (an honest hole, never a zero)` : ""}. These are the bytes the cluster holds for this project's runs — heavy stacks included, whatever the sync policy leaves there.`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    The cluster holds
                  </p>
                  {/* t1067 — nothing answered reads the honest dash, never
                      a fake zero: the band title above carries the count
                      (N workdirs answered, the rest honest holes). */}
                  <p className="text-base font-semibold tabular-nums tracking-tight">
                    {conn.remoteBytesTotal == null ? "—" : fmtBytes(conn.remoteBytesTotal)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    across {conn.jobs.length} workdir{conn.jobs.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div
                  title={
                    ceilingBytes != null
                      ? `The mirror side: what this project's runs keep on THIS disk, read fresh from the walk.\nThe sync ceiling (${fmtBytes(ceilingBytes)}) is this connection's cap on what one run may bring home — mirrors at ${ceilingShare}% of it.`
                      : "The mirror side: what this project's runs keep on THIS disk, read fresh from the walk.\n(The connection's sync ceiling is unknown from here.)"
                  }
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Mirrors hold here
                  </p>
                  {/* t1100 — the mirror cell's honest faces: a walk that
                      never spoke reads the dash (the t1067 law's mirror
                      seat — unknown, never a zero); an all-absent walk
                      names the empty side (no false subject on a zero);
                      the spoken walk reads its total as before. */}
                  <p className="text-base font-semibold tabular-nums tracking-tight">
                    {!mirrorsSpoke ? "—" : allAbsent ? "no mirrors yet" : fmtBytes(conn.localBytesTotal)}
                  </p>
                  {ceilingBytes != null && mirrorsSpoke && (
                    <>
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`Mirrors at ${ceilingShare}% of the ${fmtBytes(ceilingBytes)} sync ceiling`}
                      >
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{
                            width: `${Math.min((conn.localBytesTotal / ceilingBytes) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      {/* t1084 — THE CEILING'S SHARE: the number the eye
                          could only weigh against the track now speaks
                          in visible text — the aria's own words, the
                          share line under the bar (the dialog's cell
                          wears the same sentence at its own size); the
                          unknown case says nothing (the title's note is
                          the unknown's home). */}
                      <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                        at {ceilingShare}% of the {fmtBytes(ceilingBytes)} ceiling
                        {/* t1098 — THE CEILING'S TEMPORAL FACE: the share
                            line borrows the mirror channel's arc and
                            speaks it in the share's own dialect — the
                            window is NAMED ("across the reach") so the
                            present's share and the reach's shape ride
                            one line, each naming its time. The silence
                            laws ride the arc's guards — no channel, no
                            weather. */}
                        {ceilingFace ? ` · ${ceilingFace}` : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* t1085 — THE POLICY'S VOICE: the delta the key-files
                  policy creates (cluster-side minus mirror-side) spoke
                  on the dialog's policy line and in the AI band's
                  clause, but never on the card's glance — the eye saw
                  two totals and was left to subtract them itself (the
                  t1084 share's own shape, one family over). The line
                  drinks the dialog's sentence grammar and its title
                  byte-equal; the shared story is one voice, and each
                  zoom's door tail is its own (the dialog fetches from
                  its run's Results — the card's ledger lives one click
                  away in the storage overview, its footer's own
                  delegation words). The null case waits honestly (an
                  honest hole, never a zero); the never-divide law
                  holds via the hoisted const. */}
              <p
                className="mt-2 text-[10px] text-muted-foreground"
                title="The arithmetic of the sync policy: cluster-side minus mirror-side. Under the key-files policy the heavy stacks stay on the cluster and only text metadata rides home — this gap is those stacks."
              >
                {conn.remoteBytesTotal == null ? (
                  <>
                    The cluster never answered at the last measure — the policy
                    line waits for an answered one (an honest hole, never a
                    zero).
                  </>
                ) : !conn.mirrorWalkSpoke ? (
                  <>
                    The mirror side is unreadable — the local walk failed, so
                    the policy line waits for a spoken walk (an honest unknown,
                    never a zero).
                  </>
                ) : conn.remoteBytesTotal > conn.localBytesTotal ? (
                  <>
                    {fmtBytes(deltaOnly)} lives only on the cluster — the
                    key-files policy keeps the heavy stacks there; the full
                    ledger lives in the storage overview&apos;s Cluster ledger.
                  </>
                ) : (
                  <>
                    The mirrors hold at least as much as the cluster — runs
                    from before the key-files policy brought their stacks
                    home.
                  </>
                )}
              </p>

              {/* the trend strip — the ring's voice, the SAME spec the
                  dialog's strip drinks (one well, three mouths) */}
              {conn.measuredAt ? (
                <FleetCardTrendStrip
                  connectionId={key}
                  history={conn.history}
                  currentBytes={conn.remoteBytesTotal}
                  currentAt={conn.measuredAt}
                  currentMirrorBytes={presentMirrorWord}
                  allMirrorsAbsent={allAbsent}
                />
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Never measured — Measure now asks the cluster for the first
                  number; the trend begins there.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {hiddenConns > 0 && (
        <button
          type="button"
          className="mt-2 text-[11px] font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => setShowAllConns(true)}
          title={`Bands ${FLEET_CARD_CONN_CAP + 1}–${body.connections.length} — every connection's ledger lives in the storage overview's Cluster ledger`}
        >
          +{hiddenConns} more connection{hiddenConns === 1 ? "" : "s"} — open
          them here
        </button>
      )}

      <p className="mt-2.5 text-[10px] text-muted-foreground/70">
        The full ledger — every workdir, both sides, the whale named — lives
        in the storage overview&apos;s Cluster ledger.
      </p>
    </section>
  );
}

/** the strip proper: the spec's bars (decoration) + the voice
 *  (the paragraph) — the dialog's line dialect at dashboard size. */
function FleetCardTrendStrip(props: {
  connectionId: string;
  // t1098 — the row type carries the channel (the ledger's own shape).
  history: { at: string; bytes: number | null; mirrorBytes?: number | null }[];
  currentBytes: number | null;
  currentAt: string;
  /** t1096 — the present's own mirror word (the connection row's
   *  localBytesTotal): the SECOND CHANNEL's hop drinks it against the
   *  ring's newest remembered mirror word. Optional — a mouth that
   *  cannot see the mirrors stays silent (the well guards). t1100 — a
   *  walk that never spoke feeds null (no word at all). */
  currentMirrorBytes?: number | null;
  /** t1100 — THE PRESENCE GUARD's pass-through: no run on this
   *  connection has a mirror directory right now, so the hop may speak
   *  only a DOWN (a real vanishing) — the well's own guard. */
  allMirrorsAbsent?: boolean;
}) {
  const spec = fleetTrendSpec({
    history: props.history,
    currentBytes: props.currentBytes,
    currentAt: props.currentAt,
    fmtBytes,
    stampAgo,
  });
  // t1063 — the reach caption: the ring's span sentence (how far back
  // the memory goes, what changed across it) rides the hairline as the
  // group's hover title — the well's ONE voice, the OPS spark's shape.
  const reach = fleetTrendSpanVoice({ history: props.history, fmtBytes, stampAgo });
  // t1068 — the hole summary: the silences named in visible text (the
  // paragraph is the semantics carrier — the stubs hover titles never
  // reach a screen reader). The well speaks the count; one silence
  // brings its pair.
  const holes = fleetTrendHoleSummary({ history: props.history, currentBytes: props.currentBytes, fmtBytes, stampAgo });
  // t1096 — the SECOND CHANNEL's hop: the mirrors' own per-measure
  // delta (the present's walk word against the ring's newest remembered
  // mirror word — the SAME arithmetic the cluster's hop drinks, mapped
  // through the channel). A missing word on either end silences it —
  // the sentence only ever rides an answered pair.
  const mirrorHop = fleetTrendMirrorHop({ history: props.history, currentMirrorBytes: props.currentMirrorBytes ?? null, allMirrorsAbsent: props.allMirrorsAbsent, fmtBytes, stampAgo });
  // t1070 — the gap's count: the same walk the summary drinks (ONE
  // arithmetic), read as a NUMBER for the boundary stub's composition
  // guard (the plural only — the singular's pair already lives in the
  // stub's own title; the helper's law).
  const holeCount = fleetTrendHoleCount({ history: props.history, currentBytes: props.currentBytes });
  // t1063 — the bars speak the HOP dialect (the well's withHopKinds
  // walk; the OPS spark led in t1062, the strips follow): up = warning
  // amber (usage growing — the watch color), down = running teal
  // (cleanup — the healthy color), flat = primary. The current bar
  // keeps its identity ring; hover brightens per color; motion-reduce
  // keeps it all still. The live ring is flat — the colors await
  // diverging data honestly.
  const hopClass = (bar: (typeof spec.bars)[number]) => {
    if (bar.kind === "current") {
      if (bar.hopKind === "up")
        return "w-3 rounded-sm bg-warning-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-warning-500";
      if (bar.hopKind === "down")
        return "w-3 rounded-sm bg-running-500/80 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-running-500";
      return "w-3 rounded-sm bg-primary/70 ring-1 ring-primary/40 transition-colors motion-reduce:transition-none hover:bg-primary";
    }
    if (bar.hopKind === "up")
      return "w-3 rounded-sm bg-warning-500/70 transition-colors motion-reduce:transition-none hover:bg-warning-500";
    if (bar.hopKind === "down")
      return "w-3 rounded-sm bg-running-500/70 transition-colors motion-reduce:transition-none hover:bg-running-500";
    return "w-3 rounded-sm bg-primary/30 transition-colors motion-reduce:transition-none hover:bg-primary/60";
  };
  return (
    <div
      className="mt-2.5 rounded-md border border-border/50 bg-muted/20 px-2.5 py-2"
      data-testid={`fleet-card-trend-${props.connectionId}`}
    >
      {/* t1058 — the strip grows its details: the bars sit ON a baseline
          hairline (a floor to read heights against), each answered bar
          brightens under the pointer (motion-reduce keeps it still),
          and the ring's length speaks from the spec's ONE home — the
          count nobody sees is a count that isn't there. The chip is a
          readout, not a button; the bars stay decoration (the voice
          paragraph below carries the semantics — the aria law holds).
          t1063 — the hairline's hover title is the reach sentence (the
          span voice) and the bars speak the hop colors. */}
      <div className="flex items-end justify-between gap-2">
        <div
          className="flex items-end gap-1 border-b border-border/50 pb-px"
          aria-hidden="true"
          title={reach ?? undefined}
        >
          {spec.bars.map((bar, i) =>
            bar.kind === "hole" ? (
              <span
                key={`${bar.at}-${i}`}
                className={
                  // t1064 — the trailing hole (the newest ring point
                  // — the air is NOW) draws a denser edge; the mid-ring
                  // holes keep their muted dash. The air speaks no
                  // up/down — the hop colors never touch a stub. t1067
                  // — the ENTRY EDGE is the one exception with a home:
                  // the edge belongs to the answered neighbor that ran
                  // into the silence (the well hands edgeInto), the
                  // stub itself stays muted and dashed.
                  (bar.trailing
                    ? "inline-block size-3 rounded-sm border border-dashed border-muted-foreground/70 bg-muted/40"
                    : "inline-block size-3 rounded-sm border border-dashed border-muted-foreground/50") +
                  (bar.edgeInto === "up"
                    ? " border-l-2 border-l-warning-500/70"
                    : bar.edgeInto === "down"
                      ? " border-l-2 border-l-running-500/70"
                      : "")
                }
                title={
                  // t1070 — the GAP's mouth: a boundary stub (the gap
                  // between the last answered bar and the first stub)
                  // carries the memory's WHOLE silence story on hover —
                  // the plural's count + newest-age (the helper's law;
                  // the singular's pair already lives in bar.title, the
                  // mid-run dashes keep their own pairs). Whichever gap
                  // you touch, the memory answers in full.
                  fleetTrendGapTitle({ bar, holeCount, summary: holes }) ?? bar.title
                }
              />
            ) : (
              <span
                key={`${bar.at}-${i}`}
                className={hopClass(bar)}
                style={{ height: bar.heightPx }}
                title={bar.title}
              />
            )
          )}
        </div>
        {/* t1061 — the chip joins the loop: a click rings the focus bell
            and System diagnostics opens AT the fleet memory section (the
            header owns the hop — the seat only names the door, the same
            reverse-hop handshake the palette's doors speak). Keyboard
            gets the focus ring, the pointer the brighten; motion-reduce
            keeps it still. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(FLEET_DIAG_FOCUS_EVENT))}
          className="shrink-0 rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          title={`The trend ring remembers the last ${FLEET_TREND_RING_CAP} measures — the current measurement joins it on the next push, and the oldest rolls off as new ones arrive.\nA click opens System diagnostics at the fleet memory section.`}
          aria-label={`Ring ${spec.ringCount} of ${FLEET_TREND_RING_CAP} remembered measures — open the fleet memory section in System diagnostics`}
          data-testid={`fleet-card-ring-${props.connectionId}`}
        >
          ring {spec.ringCount}/{FLEET_TREND_RING_CAP}
        </button>
      </div>
      {/* t1066 — the paragraph drinks the REACH (the span voice): the
          strip speaks its whole story in visible text now — the delta
          (what changed since the last measure) AND the span (how far
          back the memory goes, what changed across it). The sentence
          was already computed for the hairline hover; the paragraph is
          the strip semantics carrier (the aria law), so the story
          belongs here too — the ninth and tenth mouths of the well.
          The join is the two-case lesson applied: the well sentence
          lands its own stop, so a bare space serves. t1068 — the hole
          summary is the ELEVENTH mouth. t1075 — the TOOLTIP'S
          PARAGRAPH SHAPE comes to the rendered prose (the t1074
          serve's second home): the two stories stand as two
          paragraphs — the memory's BYTES story (delta + span) first,
          the silences' story second; the summary lands its own
          paragraph and the aria law gains a real paragraph boundary
          where the tail-join buried it. The guard is the summary's
          own: no silences, no second paragraph — the bytes' story
          stands alone, one paragraph as before. */}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{spec.voice}{reach ? ` ${reach}` : ""}{mirrorHop ? ` ${mirrorHop}` : ""}</p>
      {holes ? (
        /* t1077 — the NOTCH: the second voice's leading edge takes a 2px
           hairline (muted/30) with an 8px inset — a quiet typographic
           mark where the silences' story begins; the bytes' voice stands
           unnotched, the fold probe holds the final say. */
        <p className="mt-1 border-l-2 border-l-muted-foreground/30 pl-2 text-[11px] text-muted-foreground">{holes}</p>
      ) : null}
    </div>
  );
}
