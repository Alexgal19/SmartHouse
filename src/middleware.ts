import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle authentication redirects while preserving the original URL.
 * 
 * When an unauthenticated user tries to access /dashboard (e.g. from a push notification),
 * this middleware redirects them to /login?callbackUrl=<original-url> so that after
 * successful login, they are redirected back to the original page with all query params intact.
 */
export function middleware(request: NextRequest) {
    const sessionCookie = request.cookies.get('smarthouse-session');

    // If the user has no session cookie and is trying to access /dashboard,
    // redirect to login with callbackUrl preserving the original URL
    if (!sessionCookie) {
        const originalUrl = request.nextUrl.pathname + request.nextUrl.search;
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', originalUrl);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

// Only run middleware on /dashboard routes
export const config = {
    matcher: '/dashboard/:path*',
};
