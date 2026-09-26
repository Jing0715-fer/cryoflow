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
