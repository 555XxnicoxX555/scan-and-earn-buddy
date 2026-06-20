---
name: svg-cropper
description: "Precision SVG viewBox and spacing adjustments. Use when Codex needs to crop, pad, or shift SVG logos and interface assets from natural-language requests such as moving artwork left/right, adding whitespace, or trimming empty space."
---

# SVG Cropper

Usa esta skill para realizar ajustes quirurgicos en logotipos SVG basandote en peticiones de lenguaje natural, por ejemplo "30px a la izquierda".

## Inicializacion

Antes de ajustar un SVG, verifica que exista `svg-cropper/cropper.js`. Si no existe, crea la carpeta de trabajo que corresponda dentro del proyecto actual y agrega:

1. `svg-cropper/originals/` para SVGs fuente.
2. `svg-cropper/edited/` para salidas editadas.
3. `svg-cropper/cropper.js` como motor de ajuste de `viewBox`.

## Flujo De Trabajo

1. Interpreta si el usuario quiere mover contenido (`shift`), agregar espacio (`pad`) o recortar espacio (`crop`).
2. Ejecuta `node svg-cropper/cropper.js [ARCHIVO.svg] [OPCIONES]`.
3. Guarda la nueva version en `edited/`.
4. Integra la ruta nueva en la web solo si el usuario pidio actualizar el proyecto.
5. Verifica visualmente la alineacion cuando el SVG afecte UI, logo o marca.

## Diccionario De Comandos

| Peticion del usuario | Comando | Efecto visual |
| :--- | :--- | :--- |
| "30px a la izquierda" | `--shift-left 30` | El logo se mueve HACIA la izquierda. |
| "30px a la derecha" | `--shift-right 30` | El logo se mueve HACIA la derecha. |
| "Anade 20px arriba" | `--pad-top 20` | Se crea espacio en blanco nuevo arriba. |
| "Quita 10px a la derecha" | `--crop-right 10` | Se recorta el aire de la derecha. |

## Instrucciones

1. Cuando el usuario pida un cambio especifico, determina si es `shift`, `pad` o `crop`.
2. Ejecuta el comando con `cropper.js`.
3. Usa el archivo resultante de `edited/` para actualizar la web si corresponde.
4. Si el usuario pide acumular cambios, puedes usar el archivo editado como nuevo original para el siguiente ajuste.
