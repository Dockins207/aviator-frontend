/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_BACKEND_URL: 'http://192.168.0.12:8000',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://192.168.0.12:8000/api/:path*'
      }
    ];
  },
  // Optional: CORS configuration if needed
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: 'http://192.168.0.10:3000' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ]
      }
    ];
  },
  webpack: (config, { isServer }) => {
    // Disable performance hints
    config.performance = {
      hints: false
    };

    // Optimize caching strategy
    config.cache = {
      type: 'filesystem',
      compression: 'gzip',
      maxMemoryGenerations: 2
    };

    // Improve module concatenation and tree shaking
    config.optimization = {
      ...config.optimization,
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 10,
        maxAsyncRequests: 10,
        minSize: 20000,
        maxSize: 250000,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
    };

    return config;
  },
  
  // Reduce build output verbosity
  typescript: {
    ignoreBuildErrors: true
  },
};

module.exports = nextConfig;
