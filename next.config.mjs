/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
        allowedOrigins: ["*.cloudworkstations.dev", "localhost", "studio-6821761262-fdf39--studio-6821761262-fdf39.europe-west4.hosted.app"],
    }
};

export default nextConfig;
