import { cpSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";

const root = process.cwd();
const dist = join(root, "dist");

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
