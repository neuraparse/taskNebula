import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable standalone output for optimized Docker deployment
  // This creates a minimal production build with only necessary files
  output: 'standalone',
  transpilePackages: ['@tasknebula/types'],
  serverExternalPackages: ['@tasknebula/db', 'postgres', 'drizzle-orm'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // React Compiler 1.0 — auto-memoizes components/hooks to cut re-renders.
    // Requires babel-plugin-react-compiler (installed as devDependency).
    reactCompiler: true,
    // NOTE: `experimental.ppr` is intentionally NOT set. Next.js 15.1.11
    // (stable) rejects the PPR flag — it only works on the canary channel.
    // The dashboard and my-issues pages already render their static shell
    // via a top-level <Suspense fallback>, so once we upgrade to a Next
    // version that ships PPR on stable (16.x or canary), flipping
    // `ppr: 'incremental'` here will start prerendering those shells.
    // See: https://nextjs.org/docs/messages/ppr-preview
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Enable compression
  compress: true,
};

export default nextConfig;

