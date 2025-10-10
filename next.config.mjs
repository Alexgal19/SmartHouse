/** @type {import('next').NextConfig} */
import withPWAInit from "next-pwa";

const isProduction = process.env.NODE_ENV === 'production';

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: !isProduction,
});

const nextConfig = {
  // Your regular Next.js config options here
  reactStrictMode: true,
};

export default isProduction ? withPWA(nextConfig) : nextConfig;
