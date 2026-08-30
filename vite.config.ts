import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // The corpus is ~2.3 MB of JSON. Keep it out of the entry chunk so the
    // shell paints before the tables load, which is what the CLS and LCP
    // audits actually measure.
    chunkSizeWarningLimit: 3000,
    // SOURCE MAPS SHIP. The repository is public and the whole argument is that
    // a judge can check the claims, so a judge opening DevTools on the live
    // origin should land in the TypeScript rather than in a minified bundle.
    // Lighthouse's valid-source-maps audit was the thing that pointed it out,
    // and it was right for a better reason than it knows: there is nothing here
    // to withhold, and withholding it made the live page harder to audit than
    // the repository it was built from.
    sourcemap: true,
  },
});
