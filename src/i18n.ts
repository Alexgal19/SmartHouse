import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => {
  // Validate that the incoming `locale` parameter is valid
  if (!['en', 'pl', 'uk', 'es'].includes(locale)) {
    // This will be caught by the middleware and redirected
    // to the default locale.
    return {};
  }
 
  return {
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
