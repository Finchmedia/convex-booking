import { defineConfig } from "vitest/config";

// Resolve the app's "@/…" imports (tsconfig paths) so tests can load UI modules.
export default defineConfig({
  resolve: { tsconfigPaths: true },
});
