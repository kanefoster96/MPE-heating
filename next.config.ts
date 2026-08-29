import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /blog was renamed to /help — keep old links/bookmarks working.
  async redirects() {
    return [
      { source: "/blog", destination: "/help", permanent: true },
      { source: "/blog/:slug", destination: "/help/:slug", permanent: true },
    ];
  },
};

export default nextConfig;
