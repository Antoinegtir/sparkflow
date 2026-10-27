import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: path.resolve("."),
  serverExternalPackages: ["modal", "playwright", "sharp", "@grpc/grpc-js", "@grpc/proto-loader", "typescript"],
  images: { unoptimized: true },
};
export default nextConfig;
