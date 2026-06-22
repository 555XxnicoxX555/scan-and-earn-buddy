# Skills Catalog

Este catalogo ordena las skills disponibles para trabajar la plantilla Sumi. No mueve carpetas ni cambia nombres, porque eso podria romper la forma en que Codex las descubre; solo define cuando usar cada una y que revisar antes de aplicarlas.

## Regla base

- Antes de instalar una skill nueva, pasarla por `skill-vetter`.
- Antes de usar una skill en una tarea, leer su `SKILL.md`.
- No ejecutar comandos copiados de una skill sin revisar si tocan secretos, credenciales, red, sistema o borrado de archivos.
- Para esta plantilla, priorizar skills de UI/UX, microinteracciones, performance y assets visuales. Las skills de backend, Docker o servicios externos quedan para tareas especificas.

## UI, UX y diseno profesional

| Skill | Uso recomendado | Estado |
|---|---|---|
| `ui-ux-pro-max` | Revision de UX, jerarquia visual, accesibilidad, arquitectura de interfaz y pulido profesional. | Recomendada con advertencia |
| `premium-dashboard-design` | Paneles administrativos, dashboards, tablas, metricas y componentes densos. | Recomendada |
| `tailwind-patterns` | Patrones visuales si el proyecto usa Tailwind. | Condicional |
| `svg-cropper` | Ajuste y recorte de SVGs, especialmente banderas, logos e iconos. | Recomendada |

## Animacion e interacciones

| Skill | Uso recomendado | Estado |
|---|---|---|
| `animejs` | Microinteracciones simples, transiciones y feedback visual ligero. | Recomendada |
| `gsap-core` | Animaciones avanzadas con GSAP si se decide sumar esa dependencia. | Condicional |
| `gsap-timeline` | Secuencias animadas complejas. | Condicional |
| `gsap-scrolltrigger` | Efectos vinculados al scroll. | Condicional |
| `gsap-plugins` | Revision de plugins GSAP antes de agregarlos. | Condicional |
| `gsap-performance` | Auditoria de performance para animaciones. | Recomendada si hay animaciones pesadas |
| `gsap-frameworks` | Integracion de GSAP con frameworks. | Condicional |
| `gsap-react` | Solo si la plantilla migra a React. | No prioritaria |
| `gsap-utils` | Utilidades de GSAP para patrones repetidos. | Condicional |
| `scroll-experience` | Experiencias inmersivas de scroll. | Revisar antes de usar |
| `hyperframes` | Ideas para motion/video/experiencias visuales. | Revisar antes de usar |
| `remotion-best-practices` | Videos programaticos o contenido renderizado. | No prioritaria |

## Frontend, calidad y performance

| Skill | Uso recomendado | Estado |
|---|---|---|
| `app-performance-optimization` | Mejoras de carga, rendimiento y experiencia percibida. | Recomendada |
| `tanstack-query-best-practices` | Solo si se conecta la app a datos remotos con TanStack Query. | No prioritaria |
| `typescript-expert` | Si el proyecto migra a TypeScript o hay tipado complejo. | Revisar comandos antes de usar |
| `clean-code` | Criterios generales de mantenibilidad. | Recomendada |

## Seguridad, datos y servicios externos

| Skill | Uso recomendado | Estado |
|---|---|---|
| `api-security-best-practices` | Autenticacion, autorizacion y APIs si se agrega backend. | Revisar antes de usar |
| `supabase-custom-emails` | Emails de Supabase si se activa registro real por Supabase. | Revisar antes de usar |
| `fathom-integration` | Analitica con Fathom. | No prioritaria |
| `docker-expert` | Contenedores y despliegues Docker. | No prioritaria |

## Contenido, negocio y reportes

| Skill | Uso recomendado | Estado |
|---|---|---|
| `marketing-skills-collection` | Copy, marketing, tono comercial y contenido para negocio. | Recomendada |
| `reportes` | Reportes internos o documentacion de avance. | Recomendada |

## Candidatas externas auditadas

Estas skills aparecen en `npx skills find` y fueron inspeccionadas con `npx skills use` para leer su `SKILL.md` antes de instalarlas. No estan instaladas todavia.

| Skill externa | Para que serviria | Veredicto | Prioridad |
|---|---|---|
| `mblode/agent-skills@ui-animation` | Animaciones de interfaz, hover, easing, transiciones, gestos y revision de motion. | SAFE | Alta |
| `ulpi-io/skills@frontend-design-ui-ux` | Briefs UX/UI, flujos, estados, componentes, tokens y handoff para implementacion. | SAFE | Alta |
| `vercel-labs/open-agents@web-animation-design` | Motion web basado en timing, easing, performance y accesibilidad. | SAFE | Alta |
| `dylantarre/animation-principles@micro-interactions` | Microinteracciones puntuales para botones, toggles, validacion y loading. | SAFE | Media |
| `samhvw8/dot-claude@ui-design-system` | Design systems con Tailwind, Radix y shadcn/ui. | WARNING | Media si migramos a React/Tailwind |
| `tencentcloudbase/skills@ui-design` | Direccion visual, layout, tipografia, paleta y prototipos. | WARNING | Media |
| `github/awesome-copilot@gsap-framer-scroll-animation` | Scroll animations con GSAP, Framer Motion y recetas tecnicas. | WARNING | Media si sumamos GSAP o React |
| `hoodini/ai-agents-skills@ux-design-systems` | Tokens, componentes, theming y consistencia visual. | SAFE | Baja, algo generica |
| `mindrally/skills@framer-motion` | Framer Motion para React. | Pendiente | Baja ahora |

## Instalacion sugerida

Para la plantilla Sumi actual, que sigue estatica con Vite, CSS y JS:

1. Instalar primero `mblode/agent-skills@ui-animation` para revisar hover, feedback, transiciones y microinteracciones sin forzar cambio de stack.
2. Instalar despues `ulpi-io/skills@frontend-design-ui-ux` si queremos dejar briefs y criterios UX mas formales antes de implementar cambios.
3. Mantener `vercel-labs/open-agents@web-animation-design` como alternativa si queremos una guia de motion mas conservadora y de fuente mas conocida.
4. Posponer skills de Framer, Tailwind, Radix, shadcn o GSAP hasta decidir que esa dependencia entra en la plantilla.

## Flujo recomendado para Sumi

1. Para una revision visual de la plantilla: usar `ui-ux-pro-max`, luego `app-performance-optimization` si hay cambios de carga o imagenes.
2. Para iconos, banderas y assets SVG: usar `svg-cropper` y revisar manualmente hover, estados activos y tamanos.
3. Para animaciones: empezar con CSS o `animejs`; usar GSAP solo si el movimiento justifica la dependencia.
4. Para registro, datos o Supabase: mantener la plantilla estatica hasta validar el flujo; usar skills de seguridad antes de conectar base de datos real.
5. Antes de mostrar a un cliente: revisar desktop en ancho tipo telefono, mobile real, detalle de producto, panel editor, idiomas, iconos y hover de todo lo clickeable.
