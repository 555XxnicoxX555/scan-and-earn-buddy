import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const slug = process.argv[2] || "section-preview";
const outDir = resolve(process.argv[3] || join("..", "live-section-preview", slug));

await mkdir(join(outDir, "assets"), { recursive: true });

await writeFile(join(outDir, "index.html"), `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Live Section Preview</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <header class="preview-bar">
      <strong>Live Section Preview</strong>
      <span>Vista aislada. No modifica la app principal.</span>
    </header>
    <main class="stage">
      <section class="component" id="componentPreview">
        <p class="eyebrow">Sección aislada</p>
        <h1>Previsualización del cambio</h1>
        <p>Edita este bloque con la sección o componente real que el usuario quiere probar.</p>
        <button type="button">Acción de ejemplo</button>
      </section>
    </main>
    <script src="script.js"></script>
  </body>
</html>
`);

await writeFile(join(outDir, "styles.css"), `:root {
  --bg: #f8efe0;
  --ink: #461904;
  --line: #ffdfa5;
  --accent: #ff890a;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
.preview-bar {
  min-height: 54px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #100702;
  color: #fff4dc;
}
.preview-bar span { opacity: .72; font-size: 13px; }
.stage { min-height: calc(100vh - 54px); padding: clamp(18px, 4vw, 56px); display: grid; place-items: center; }
.component {
  width: min(900px, 100%);
  padding: clamp(22px, 4vw, 42px);
  border: 1px solid var(--line);
  border-radius: 22px;
  background: rgba(255, 249, 236, .86);
  box-shadow: 0 24px 70px rgba(70, 25, 4, .14);
}
.eyebrow { color: #80614b; font-size: 12px; font-weight: 900; letter-spacing: .16em; text-transform: uppercase; }
h1 { margin: 0; font: italic clamp(38px, 7vw, 76px)/.95 Georgia, serif; }
p { max-width: 620px; line-height: 1.55; }
button { min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--accent); color: #2a1204; font-weight: 900; cursor: pointer; }
button:focus-visible { outline: 3px solid rgba(255, 137, 10, .72); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: .001ms !important; animation-duration: .001ms !important; }
}
`);

await writeFile(join(outDir, "script.js"), `document.querySelector("button")?.addEventListener("click", () => {
  document.querySelector(".component")?.classList.toggle("is-active");
});
`);

await writeFile(join(outDir, "README.md"), `# Live Section Preview

Run a local static server:

\`\`\`powershell
cd "${outDir.replace(/\\/g, "\\\\")}"
python -m http.server 9173
\`\`\`

Open:

\`\`\`text
http://127.0.0.1:9173
\`\`\`
`);

await writeFile(join(outDir, "notes.md"), `# Implementation Notes

- Source section/component:
- Requested visual change:
- Approved changes to port:
- Main project files to edit after approval:
`);

console.log(`Created live preview scaffold at ${outDir}`);
