/** @type {import('next').NextConfig} */

const mainCsp = [
    "default-src 'self'",
    // Next.js App Router requires 'unsafe-inline' for hydration scripts
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // data: for pending photo uploads; drive.google.com for control card thumbnails
    "img-src 'self' data: https://drive.google.com",
    // Firebase Auth + Firestore + Realtime DB + FCM
    "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
].join('; ');

// Service worker needs importScripts from Firebase CDN — separate, stricter policy
const swCsp = [
    "default-src 'self'",
    "script-src 'self' https://www.gstatic.com",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app wss://*.firebasedatabase.app",
].join('; ');

const nextConfig = {
    async headers() {
        return [
            {
                // Main CSP first — SW rule below overrides it for the SW path
                source: '/(.*)',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
                    { key: 'Content-Security-Policy', value: mainCsp },
                ],
            },
            {
                // Must be after /(.*) so it wins the CSP header for the SW file
                source: '/firebase-messaging-sw.js',
                headers: [
                    { key: 'Content-Security-Policy', value: swCsp },
                ],
            },
        ];
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
        allowedOrigins: ["*.cloudworkstations.dev", "localhost", "studio-6821761262-fdf39--studio-6821761262-fdf39.europe-west4.hosted.app"],
    }
};

export default nextConfig;
