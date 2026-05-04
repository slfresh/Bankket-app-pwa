import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
    /** Replaces @ducanh2912/next-pwa's default runtime list (see build log). Kitchen-first + Supabase REST + static. */
    runtimeCaching: [
      {
        urlPattern: ({ request }: { request: Request }) =>
          request.mode === "navigate" && /\/kitchen(\/|$)/.test(new URL(request.url).pathname),
        handler: "NetworkFirst",
        options: {
          cacheName: "kitchen-html",
          networkTimeoutSeconds: 3,
          expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "supabase-rest",
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\/icons\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "pwa-icons",
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\.(?:woff2|woff|ttf|otf)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "web-fonts",
          expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
    ],
  },
});

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "https://*.supabase.co";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co`,
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders =
  process.env.NODE_ENV === "production"
    ? [
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      ]
    : [];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: cspDirectives },
          ...securityHeaders,
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
