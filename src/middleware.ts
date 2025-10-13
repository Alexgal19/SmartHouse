import createMiddleware from 'next-intl/middleware';
 
const locales = ['pl', 'en', 'uk', 'es'];

export default createMiddleware({
  // A list of all locales that are supported
  locales: locales,
 
  // Used when no locale matches
  defaultLocale: 'pl'
});
 
export const config = {
  // Match only internationalized pathnames
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // Match all pathnames within the locales defined above
    '/(pl|en|uk|es)/:path*'
  ]
};
