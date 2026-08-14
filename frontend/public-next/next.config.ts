import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["191.252.208.234", "127.0.0.1", "localhost"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
