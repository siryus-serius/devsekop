import type { NextConfig } from "next";

/**
 * Security headers statis (REQ-01). CSP dinamis (nonce) diatur di src/middleware.ts.
 * TLS 1.2+ diterminasi di edge/load balancer (Vercel, Cloudflare, Nginx);
 * HSTS memaksa browser selalu memakai HTTPS.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["qrcode"],
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
    // Middleware mem-buffer body request; harus > MAX_UPLOAD_BYTES (10MB) + overhead multipart.
    middlewareClientMaxBodySize: "12mb",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
