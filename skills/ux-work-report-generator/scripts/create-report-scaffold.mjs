import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const reportName = process.argv[2] || "ux-work-report";
const outDir = resolve(process.argv[3] || join("..", reportName));

await mkdir(join(outDir, "assets"), { recursive: true });

await writeFile(join(outDir, "index.html"), `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>UX Work Report</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="hero">
      <p class="eyebrow">Reporte visual</p>
      <h1>UX Work Report</h1>
      <p>Reemplaza este contenido con evidencia real del trabajo realizado.</p>
    </header>
    <main>
      <section class="card">
        <h2>Resumen ejecutivo</h2>
        <p>Objetivo, alcance, problemas detectados, mejoras e impacto.</p>
      </section>
    </main>
  </body>
</html>
`);

await writeFile(join(outDir, "styles.css"), `:root {
  --bg: #10141d;
  --panel: #171d28;
  --text: #f7efe5;
  --muted: #c7b9a4;
  --accent: #ff8a1f;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: radial-gradient(circle at 80% 0%, rgba(255,138,31,.18), transparent 30%), var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
.hero, main { width: min(1100px, calc(100% - 36px)); margin: 0 auto; }
.hero { padding: 72px 0 40px; }
.eyebrow { color: var(--accent); font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: 0; font: italic 72px/1 Georgia, serif; }
.card { margin: 24px 0; padding: 24px; border: 1px solid rgba(255,255,255,.12); border-radius: 22px; background: var(--panel); }
`);

await writeFile(join(outDir, "README.md"), `# UX Work Report

Open \`index.html\` directly or serve this folder:

\`\`\`powershell
python -m http.server 9090
\`\`\`
`);

console.log(`Created report scaffold at ${outDir}`);
