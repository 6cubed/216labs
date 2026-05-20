/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@216labs/errors"],
  async redirects() {
    return [
      {
        source: "/p/:slug",
        destination: "/read/:slug",
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/read/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
