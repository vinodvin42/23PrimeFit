import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@23primefit/ui-tokens"],
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
