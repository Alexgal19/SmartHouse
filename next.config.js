/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: [
      'https://9000-firebase-studio-1759406863592.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev',
      'https://9002-firebase-studio-1759406863592.cluster-55m56i2mgjalcvl276gecmncu6.cloudworkstations.dev',
    ],
  },
  serverActions: {
    bodySizeLimit: '5mb',
  },
};

module.exports = nextConfig;
