import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfmake", "@prisma/client"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./fonts/**/*"],
  },
};

export default nextConfig;
