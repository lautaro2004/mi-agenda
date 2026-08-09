import type { NextConfig } from "next";
import type { webpack } from "next/dist/compiled/webpack/webpack";

const ignoreNodeSchemePlugin: webpack.WebpackPluginInstance = {
  apply(compiler: webpack.Compiler) {
    compiler.hooks.normalModuleFactory.tap("IgnoreNodeScheme", (factory: webpack.Module) => {
      factory.hooks.beforeResolve.tap("IgnoreNodeScheme", (resolveData: { request: string }) => {
        if (resolveData.request.startsWith("node:")) return false;
      });
    });
  },
};

const nextConfig: NextConfig = {
  serverExternalPackages: ["baileys", "pino", "@prisma/client"],
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === "edge") {
      // instrumentation.ts must be able to compile for the Edge runtime (Next
      // requires this even though its register() body is guarded to only run
      // under Node — `next dev`'s on-demand compiler does not prune the Edge
      // instrumentation entry the way `next build` does, so it always tries
      // to bundle whatever instrumentation.ts reaches, dynamic imports
      // included). baileys and pg are Node-only and never actually execute
      // on Edge, but still need a stub so the Edge compile can resolve them.
      config.resolve.alias = {
        ...config.resolve.alias,
        baileys: false,
        pg: false,
      };
      config.plugins.push(ignoreNodeSchemePlugin);
    }
    return config;
  },
};

export default nextConfig;
