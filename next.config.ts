import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // next/image's default loader proxies every image through the
    // server-rendered /_next/image endpoint, which needs a live server
    // round-trip on every request. That's incompatible with this app's
    // whole point (images must render from Cache Storage with no server
    // reachable at all), so images are served as plain static files that
    // the sync engine can cache directly by their real /menu-assets URL.
    unoptimized: true,
  },
  async headers() {
    return [
      {
        // Belt-and-suspenders alongside `updateViaCache: "none"` at
        // registration time: never let the ordinary HTTP cache serve a
        // stale copy of the service worker script itself.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
