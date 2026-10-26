


import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack ve yerel emülatör ağ izinleri için evrensel ayar:
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/_next/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;

