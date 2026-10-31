import path from "node:path";
import type { NextConfig } from "next";

// `npm run build:static` sets it: only the landing, exported as plain files for Firebase Hosting.
const STATIC = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(STATIC ? { output: "export" as const } : {}),
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: path.resolve("."),
  serverExternalPackages: ["modal", "playwright", "sharp", "@grpc/grpc-js", "@grpc/proto-loader", "typescript"],
  images: { unoptimized: true },
  // A project moving between the cloud and a Mac (its git bundle) goes in one request.
  experimental: { proxyClientMaxBodySize: "30mb" },
};
export default nextConfig;
