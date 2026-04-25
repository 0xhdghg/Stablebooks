import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

export default function createNextConfig(phase) {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    // Railway builds on Linux, where standalone output works as intended.
    // Keep Windows local builds green because standalone tracing can fail with
    // EPERM symlink errors outside developer-mode/admin setups.
    output: process.platform === "win32" ? undefined : "standalone",
    // Keep development and production build artifacts isolated so `next dev`
    // cannot poison a later `next start` runtime with incompatible chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  };

  return nextConfig;
}
