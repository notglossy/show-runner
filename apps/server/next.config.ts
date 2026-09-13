import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Native module; must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      {
        // The dashboard preview renders screens in a sandboxed (opaque-origin) iframe; fonts need CORS there.
        source: "/kiosk/fonts/:file*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
