// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Listening on 0.0.0.0 makes the dev server reachable from any device on the
// local network (smartphone, tablet, other PCs) using the host's LAN IP, e.g.
// http://192.168.0.10:8080
export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
    },
    preview: {
      host: "0.0.0.0",
    },
  },
});
