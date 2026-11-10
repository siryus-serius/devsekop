import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["qrcode"],
  poweredByHeader: false,
};

export default nextConfig;
