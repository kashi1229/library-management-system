import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The project lives inside a larger git repo, so pin the workspace root to
  // stop Turbopack from walking up and reading the parent's lockfile.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
