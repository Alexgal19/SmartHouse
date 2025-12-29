
/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverActions: {
            bodySizeLimit: '50mb',
        },
    },
    eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
    },
    typescript: {
        // !! WARN !!
        // Dangerously allow production builds to successfully complete even if
        // your project has type errors.
        // !! WARN !!
        ignoreBuildErrors: true,
    },
    env: {
        WEBPUSH_PUBLIC_KEY: process.env.WEBPUSH_PUBLIC_KEY,
        WEBPUSH_PRIVATE_KEY: process.env.WEBPUSH_PRIVATE_KEY,
        WEBPUSH_SUBJECT: process.env.WEBPUSH_SUBJECT,
    }
};

module.exports = nextConfig;
