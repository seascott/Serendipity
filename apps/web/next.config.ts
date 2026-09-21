import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@serendipity/domain", "@serendipity/api", "@serendipity/tokens", "@serendipity/catalog"],
};

export default nextConfig;
