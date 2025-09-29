import type { NextConfig } from "next";

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
    domains: [
      "res.cloudinary.com",       // Cloudinary
      "cdn.cypressresorts.com",   // CDN
      "cypressbooking.vercel.app" // app host 
    ],
  },
};

export default nextConfig;
