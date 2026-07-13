import { cpSync, renameSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const root = process.cwd();
const dist = join(root, "dist");
const onboardingDist = join(root, "dist-onboarding");

await build({
  root,
  base: "./",
  build: {
    outDir: dist,
    emptyOutDir: true
  }
});

cpSync(join(root, "assets"), join(dist, "assets"), { recursive: true });
cpSync(join(root, "businesses"), join(dist, "businesses"), { recursive: true });

await build({
  root,
  base: "./",
  build: {
    outDir: onboardingDist,
    emptyOutDir: true,
    rollupOptions: {
      input: join(root, "onboarding.html")
    }
  }
});

renameSync(join(onboardingDist, "onboarding.html"), join(onboardingDist, "index.html"));
cpSync(join(root, "onboarding.vercel.json"), join(onboardingDist, "vercel.json"));
