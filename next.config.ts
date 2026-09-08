import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfmake", "@prisma/client", "imapflow", "mailparser"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./fonts/**/*", "./public/logo.png"],
  },
};

export default nextConfig;
