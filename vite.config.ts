// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import path from "node:path";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        // Stub three.js / r3f / drei in the SSR bundle. These are only used by
        // the Simulation Lab (ssr:false under _authenticated) and pulling them
        // into the nitro SSR transform OOMs the build.
        name: "stub-three-in-ssr",
        enforce: "pre",
        resolveId(id, _importer, opts) {
          if (!opts?.ssr) return null;
          if (id === "three" || id.startsWith("three/") ||
              id.startsWith("@react-three/")) {
            return "\0virtual:empty-three";
          }
          return null;
        },
        load(id) {
          if (id === "\0virtual:empty-three") {
            return `const noop = () => null;
const proxy = new Proxy(function () {}, {
  get: () => proxy,
  apply: () => proxy,
  construct: () => ({}),
});
export default proxy;
export { proxy as Canvas, proxy as useFrame, proxy as useThree, proxy as OrbitControls, proxy as Grid, proxy as Stats, proxy as Html, proxy as Text };`;
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        // parse5 v7 imports "entities/decode" — only the nested entities@6 inside parse5 has that subpath
        "entities/decode": path.resolve(__dirname, "node_modules/parse5/node_modules/entities/dist/esm/decode.js"),
        "entities/escape": path.resolve(__dirname, "node_modules/parse5/node_modules/entities/dist/esm/escape.js"),
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
