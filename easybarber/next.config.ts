import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Without this, the client router treats every dynamic route
    // (which is all of them here — every page reads the session via
    // cookies) as uncacheable, so clicking between sidebar tabs
    // re-fetches and re-renders the *shared* (app) layout — the auth
    // check plus the profile/company lookup for the sidebar — on
    // every single click, not just the page content. 30s lets the
    // router reuse that shared layout across navigations instead.
    // Mutations are unaffected: every write action already calls
    // revalidatePath(), which forces a fresh fetch regardless of this
    // window.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
