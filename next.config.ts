import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

/** Directory containing this config file (the real app root on disk). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg"],
  // Hosting layouts like ~/nodeapps/<app>/ often have an extra package-lock.json
  // under ~/nodeapps/. Next would infer that parent as root and look for .next there.
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [
      {
        source: "/codex",
        destination: "/codex/core/races",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
