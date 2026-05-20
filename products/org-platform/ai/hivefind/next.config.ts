import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@216labs/ui", "@216labs/errors"],
  turbopack: {
    root: path.join(__dirname, "..", "..", "..", ".."),
  },
};

export default nextConfig;
