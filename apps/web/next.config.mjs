import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

export default function createNextConfig(phase) {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    // Keep development and production build artifacts isolated so `next dev`
    // cannot poison a later `next start` runtime with incompatible chunks.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  };

  return nextConfig;
}
