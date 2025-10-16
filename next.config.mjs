/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This is required for Firebase Studio to work correctly.
    allowedDevOrigins: [
      '6000-firebase-studio-1759406863592.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
