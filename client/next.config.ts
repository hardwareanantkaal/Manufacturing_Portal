import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This app is nested inside the admin portal's own Next.js project, which
  // also has a lockfile. Without this, Turbopack auto-infers the OUTER
  // portal/ folder as the workspace root and picks up its files (its real
  // proxy.ts, its own @/ aliases) instead of this app's own.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
