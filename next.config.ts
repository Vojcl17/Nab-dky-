import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfmake", "@prisma/client"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./fonts/**/*", "./public/logo.png"],
  },
};

export default nextConfig;
