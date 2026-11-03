"use client";

/**
 * CryoFlow — MRC thumbnail <img> with shimmer skeleton, load/error states.
 * Dark canvas behind the map (cryo-EM density is bright-on-black).
 */

import { ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function MrcImage({
  src,
  alt,
  className,
  onLoaded,
}: {
  src: string;
  alt: string;
  className?: string;
  /** t289 — fired once the bytes actually arrived (remote tiles use it to
   *  learn their SSH fetch landed and refresh the outputs listing). */
  onLoaded?: () => void;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  // t665 — bounded retry for TRANSIENT kills: a 4096² tile render is the
  // box's heaviest request, and a mid-burst connection reset used to be
  // FINAL (an img never refires onError) — the tile said "unavailable"
  // forever for a wound that heals in seconds. Two retries on a
  // backing-off timer, the shimmer keeps meaning "rendering"; a dead URL
  // (404/400) just burns the same two attempts and lands in the same
  // honest error state. The cache-busting attempt param makes the retry
  // a real request; the server's stat cache makes it cheap.
  const [attempt, setAttempt] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const imgSrc = attempt > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;
  const onError = () => {
    if (attempt < 2) {
      timerRef.current = setTimeout(() => setAttempt((a) => a + 1), 1500 + attempt * 1500);
    } else {
      setStatus("error");
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-zinc-950",
        status === "loaded" ? "border-border" : "border-border/60",
        className
      )}
    >
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" aria-hidden="true">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" />
          <ImageIcon className="relative h-5 w-5 text-zinc-700" />
          <span className="relative text-[9px] font-medium uppercase tracking-widest text-zinc-600">
            rendering
          </span>
        </div>
      )}
      {status === "error" ? (
        <div className="flex h-full min-h-20 w-full flex-col items-center justify-center gap-1.5 bg-zinc-900 text-zinc-500">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px]">unavailable</span>
        </div>
      ) : (
        <img
          key={attempt}
          src={imgSrc}
          alt={alt}
          loading="lazy"
          onLoad={() => {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            setStatus("loaded");
            onLoaded?.();
          }}
          onError={onError}
          className={cn(
            "block h-auto w-full transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
