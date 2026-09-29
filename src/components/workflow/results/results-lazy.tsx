"use client";
/**
 * t391 — the lazy results barrel.
 *
 * The inspector's result surfaces (charts, galleries, browsers) are modal
 * tab content — nobody sees them until a job is inspected AND a tab is
 * opened. Carrying their whole graph (the recharts family, the particle
 * browser, the pick maps) inside the eager home compile was the difference
 * between the 4GB box surviving the dev boot or not: the eager "/" compile
 * peaked at ~3.4GB with them, and every subsequent route compile died on
 * the residual baseline. Through this barrel each surface is its own chunk
 * that compiles on first use — the user's Windows machine also stops
 * downloading charts it may never open.
 *
 * Every export keeps its exact name and props (dynamic() forwards them);
 * the only visible change is a one-frame loading shimmer inside a modal
 * tab, which is where a loading shimmer belongs.
 */
import dynamic from "next/dynamic";

const chartLoading = () => (
  <div className="flex min-h-[160px] items-center justify-center text-[11px] text-muted-foreground">
    Loading chart…
  </div>
);
const panelLoading = () => (
  <div className="flex min-h-[220px] items-center justify-center text-[11px] text-muted-foreground">
    Loading…
  </div>
);

export const ResolutionChart = dynamic(
  () => import("./resolution-chart").then((m) => m.ResolutionChart),
  { ssr: false, loading: chartLoading }
);
export const FscChart = dynamic(
  () => import("./fsc-chart").then((m) => m.FscChart),
  { ssr: false, loading: chartLoading }
);
export const CtfQualityChart = dynamic(
  () => import("./ctf-quality-chart").then((m) => m.CtfQualityChart),
  { ssr: false, loading: chartLoading }
);
export const MotionDriftChart = dynamic(
  () => import("./motion-drift-chart").then((m) => m.MotionDriftChart),
  { ssr: false, loading: chartLoading }
);
export const MicrographQcBoard = dynamic(
  () => import("./micrograph-qc-board").then((m) => m.MicrographQcBoard),
  { ssr: false, loading: chartLoading }
);
export const ClassDistributionChart = dynamic(
  () => import("./class-distribution-chart").then((m) => m.ClassDistributionChart),
  { ssr: false, loading: chartLoading }
);
export const AngularDistributionChart = dynamic(
  () => import("./angular-distribution-chart").then((m) => m.AngularDistributionChart),
  { ssr: false, loading: chartLoading }
);
export const CryoSparcAnglePanel = dynamic(
  () => import("./cryosparc-angle-panel").then((m) => m.CryoSparcAnglePanel),
  { ssr: false, loading: panelLoading }
);
export const RebalanceReport = dynamic(
  () => import("./rebalance-report").then((m) => m.RebalanceReport),
  { ssr: false, loading: panelLoading }
);
export const ImportGallery = dynamic(
  () => import("./import-gallery").then((m) => m.ImportGallery),
  { ssr: false, loading: panelLoading }
);
export const PicksMap = dynamic(
  () => import("./picks-map").then((m) => m.PicksMap),
  { ssr: false, loading: panelLoading }
);
export const ParticleBrowser = dynamic(
  () => import("./particle-browser").then((m) => m.ParticleBrowser),
  { ssr: false, loading: panelLoading }
);
export const GuinierChart = dynamic(
  () => import("./guinier-chart").then((m) => m.GuinierChart),
  { ssr: false, loading: chartLoading }
);
export const TopazTrainingChart = dynamic(
  () => import("./topaz-training-chart").then((m) => m.TopazTrainingChart),
  { ssr: false, loading: chartLoading }
);
// t439+t440+t453 — the run A/B doors ride their own chunk (recharts scatter +
// the compare brain stay out of the eager graph until a door opens);
// one face, three domains (CTF / Motion / Class), all exported under stable names
export const CtfCompareEntry = dynamic(
  () => import("./run-compare-dialog").then((m) => m.CtfCompareEntry),
  { ssr: false, loading: panelLoading }
);
export const MotionCompareEntry = dynamic(
  () => import("./run-compare-dialog").then((m) => m.MotionCompareEntry),
  { ssr: false, loading: panelLoading }
);
export const ClassCompareEntry = dynamic(
  () => import("./run-compare-dialog").then((m) => m.ClassCompareEntry),
  { ssr: false, loading: panelLoading }
);
// t454 — the fourth question, its own face: one run vs its OWN rounds
export const ClassConvergenceEntry = dynamic(
  () => import("./class-convergence-dialog").then((m) => m.ClassConvergenceEntry),
  { ssr: false, loading: panelLoading }
);
// t456 — the fifth question, its own face: one refinement vs its OWN arc
export const ResolutionArcEntry = dynamic(
  () => import("./resolution-arc-dialog").then((m) => m.ResolutionArcEntry),
  { ssr: false, loading: panelLoading }
);
// t457 — the sixth question, its own face: one postprocess's honesty read
export const PostprocessVerdictEntry = dynamic(
  () =>
    import("./postprocess-verdict-dialog").then((m) => m.PostprocessVerdictEntry),
  { ssr: false, loading: panelLoading }
);
// t461 — the chain's own face: the particle funnel ("where did my
// particles go?") — not a pair, the whole line, receipts as a ledger
export const ParticleFunnelEntry = dynamic(
  () =>
    import("./particle-funnel-dialog").then((m) => m.ParticleFunnelEntry),
  { ssr: false, loading: panelLoading }
);
