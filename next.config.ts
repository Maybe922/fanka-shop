import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile higher up the tree (e.g. in $HOME)
  // would otherwise be inferred as the root and break file tracing on deploy.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
