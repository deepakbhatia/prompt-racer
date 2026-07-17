import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@prompt-race/shared",
    "@prompt-race/agent",
    "@prompt-race/scoring",
    "@prompt-race/challenges",
  ],
};

export default nextConfig;
