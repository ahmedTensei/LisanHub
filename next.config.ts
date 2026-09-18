import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Profile pictures travel through a server action (2 MB limit in src/modules/account/schemas.ts).
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};

export default withNextIntl(nextConfig);
