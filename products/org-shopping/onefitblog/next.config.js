/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@216labs/errors"],
}

module.exports = nextConfig
