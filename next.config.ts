import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    // 4GB box shared with a Chrome QA session — the default (6 GiB) lets the
    // Turbopack engine balloon until the kernel OOM-kills next-server mid-QA
    // (observed 4× on 2026-09-08: RSS 2.7-2.8 GB at kill time). 1400 MiB for
    // the Rust engine + 1536 MiB V8 old-space (dev-server.sh) keeps the
    // server under the ceiling; compiles get slower, not broken.
    turbopackMemoryLimit: 900,
  },
};

export default nextConfig;
