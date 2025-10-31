import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
   eslint: {
    // ✅ Don't fail production builds on ESLint errors
    ignoreDuringBuilds: true,
    },
   compiler: {
      removeConsole: process.env.NODE_ENV === "production"
    },
    reactStrictMode: true,
     images: {
      // ✅ New style: allowlist external images with protocol/host/path
      remotePatterns: [
        {
          protocol: "https",
          hostname: "res.cloudinary.com",
          // tighten to your account if you want (you used /stratmachine/... in URLs)
          pathname: "/stratmachine/**",
        },
        {
          protocol: "https",
          hostname: "cdn.cypressresorts.com",
          pathname: "/**",
        },
        {
          protocol: "https",
          hostname: "cypressbooking.vercel.app",
          pathname: "/**",
        },
      ],    
  },
};

export default withBotId(nextConfig);
