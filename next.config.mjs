/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [{
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            ],
        }];
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
        allowedOrigins: ["*.cloudworkstations.dev", "localhost", "studio-6821761262-fdf39--studio-6821761262-fdf39.europe-west4.hosted.app"],
    }
};

export default nextConfig;
