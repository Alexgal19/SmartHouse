/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

import createWithIntl from 'next-intl/plugin';

const withIntl = createWithIntl('./src/i18n.ts');

export default withIntl(nextConfig);
