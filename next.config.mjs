/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Multi-tenant domain configuration
   * This enables support for:
   * - Free subdomains: abc.dineboss.app
   * - Custom domains: example.com
   */

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },

  // Redirects (keep minimal - most routing handled by middleware)
  async redirects() {
    return [
      // Redirect www to non-www on main domain
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.dineboss.app',
          },
        ],
        destination: 'https://dineboss.app/:path*',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
