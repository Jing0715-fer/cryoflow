"use client";

/**
 * CryoFlow — MRC thumbnail <img> with shimmer skeleton, load/error states.
 * Dark canvas behind the map (cryo-EM density is bright-on-black).
 */

import { ImageIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function MrcImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border bg-zinc-950",
        status === "loaded" ? "border-border" : "border-border/60",
        className
      )}
    >
      {status === "loading" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900" aria-hidden="true" />
      )}
      {status === "error" ? (
        <div className="flex h-full min-h-20 w-full flex-col items-center justify-center gap-1.5 bg-zinc-900 text-zinc-500">
          <ImageIcon className="h-5 w-5" aria-hidden="true" />
          <span className="text-[10px]">unavailable</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={cn(
            "block h-auto w-full transition-opacity duration-300",
            status === "loaded" ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
