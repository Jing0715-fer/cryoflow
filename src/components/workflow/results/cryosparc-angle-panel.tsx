"use client";

/**
 * CryoFlow — fetches /api/jobs/[id]/angdist and renders the cryoSPARC-style
 * Mollweide panel for 3D refinement/classification jobs. Self-hides when the
 * API has no binned data yet (mirrors AngularDistributionChart behaviour).
 */

import { useEffect, useState } from "react";
import { CryoSparcAnglePlot, type CryoAngleData } from "./cryosparc-angle-plot";

interface AngDistResponse {
  iteration: number | null;
  total: number;
  anisotropy: number;
  symmetry: string | null;
  starFile: string | null;
  fib?: {
    bins: CryoAngleData["bins"];
    maxBin: number;
    rotHist: number[];
    tiltHist: number[];
    anisotropy: number;
  };
}

export function CryoSparcAnglePanel({
  jobId,
  running,
  className,
}: {
  jobId: string;
  running?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<AngDistResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/angdist`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as AngDistResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    };
    void load();
    if (!running) return () => { cancelled = true; };
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, running]);

  if (error && !data) return null; // enhancement — stays silent on failure
  if (!data || !data.fib || data.total === 0 || data.fib.bins.length === 0) return null;

  return (
    <CryoSparcAnglePlot
      className={className}
      data={data.fib}
      total={data.total}
      symmetry={data.symmetry}
      iterationLabel={data.iteration != null ? `it ${data.iteration}` : "final"}
      running={running}
    />
  );
}
