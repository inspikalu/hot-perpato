import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/presentation",
        destination: "https://youtu.be/YOUR_VIDEO_ID",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
