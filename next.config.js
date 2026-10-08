// CSP (pakai nonce per request) diatur di proxy.ts, bukan di sini.

/** @type {import('next').NextConfig} */
const nextConfig = {
  // App memakai <img> biasa (tidak pakai next/image). Optimizer dimatikan supaya /_next/image
  // tidak bisa dipakai orang lain untuk menghabiskan kuota Image Optimization Vercel.
  images: {
    unoptimized: true,
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
