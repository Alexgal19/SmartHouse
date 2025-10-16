/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    allowedDevOrigins: ["*.cloudworkstations.dev"],
  },
};

export default nextConfig;
