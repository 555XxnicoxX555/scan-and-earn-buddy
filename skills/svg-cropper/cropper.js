const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const filename = args[0];

if (!filename || filename === '--help') {
    console.log("Usage: node cropper.js FILENAME.svg [options]");
    console.log("Options:");
    console.log("  --shift-left   PX  (Desplaza el logo a la izquierda)");
    console.log("  --shift-right  PX  (Desplaza el logo a la derecha)");
    console.log("  --shift-up     PX  (Desplaza el logo arriba)");
    console.log("  --shift-down   PX  (Desplaza el logo abajo)");
    console.log("  --pad-left     PX  (Añade espacio a la izquierda)");
    console.log("  --pad-right    PX  (Añade espacio a la derecha)");
    console.log("  --pad-top      PX  (Añade espacio arriba)");
    console.log("  --pad-bottom   PX  (Añade espacio abajo)");
    console.log("  --crop-left    PX  (Quita espacio a la izquierda)");
    console.log("  --crop-right   PX  (Quita espacio a la derecha)");
    console.log("  --crop-top     PX  (Quita espacio arriba)");
    console.log("  --crop-bottom  PX  (Quita espacio abajo)");
    process.exit(0);
}

// Rutas compatibles con la estructura solicitada
const inputPath = path.join(__dirname, 'originals', filename);
const outputPath = path.join(__dirname, 'edited', filename);

if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    process.exit(1);
}

let svg = fs.readFileSync(inputPath, 'utf8');
const vbMatch = svg.match(/viewBox="([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)"/);
if (!vbMatch) {
    console.error("No viewBox found in SVG.");
    process.exit(1);
}

let [_, x, y, w, h] = vbMatch.map(parseFloat);

// Aplicar cambios basados en los argumentos
for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    const val = parseFloat(args[i + 1]);
    if (isNaN(val)) continue;

    switch (flag) {
        case '--shift-left': x += val; break;
        case '--shift-right': x -= val; break;
        case '--shift-up': y += val; break;
        case '--shift-down': y -= val; break;
        case '--pad-left': x -= val; w += val; break;
        case '--pad-right': w += val; break;
        case '--pad-top': y -= val; h += val; break;
        case '--pad-bottom': h += val; break;
        case '--crop-left': x += val; w -= val; break;
        case '--crop-right': w -= val; break;
        case '--crop-top': y += val; h -= val; break;
        case '--crop-bottom': h -= val; break;
    }
    i++;
}

const newVB = `viewBox="${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}"`;
svg = svg.replace(/viewBox="[^"]+"/, newVB);

fs.writeFileSync(outputPath, svg);
console.log(`[OK] Generado en 'edited/${filename}' -> ${newVB}`);
