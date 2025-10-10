/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables are available on the server-side by default,
  // this configuration is not needed to expose them to server components/actions.
  // The 'env' key is for exposing variables to the browser, which is not what's needed here.
};

export default nextConfig;
