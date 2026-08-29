import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The corpus is ~2.3 MB of JSON. Keep it out of the entry chunk so the
    // shell paints before the tables load, which is what the CLS and LCP
    // audits actually measure.
    chunkSizeWarningLimit: 3000,
  },
});
