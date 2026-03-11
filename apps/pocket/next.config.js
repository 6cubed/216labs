/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent bundling WebGPU-only packages on the server
      const existing = Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)
      config.externals = [...existing, '@mlc-ai/web-llm']
    }
    return config
  },
}

module.exports = nextConfig
