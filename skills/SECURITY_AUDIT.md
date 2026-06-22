# Skills Security Audit

Auditoria hecha con criterio de `skill-vetter` sobre las skills locales del repo. Resultado general: no se encontro una skill que deba bloquearse por completo, pero casi todas tienen deuda de metadata (`version` y `author` ausentes). Las advertencias mas importantes son ejemplos de comandos o secretos dentro de documentacion.

## Leyenda

- `SAFE`: sin red flags accionables; puede tener metadata incompleta.
- `WARNING`: usable, pero revisar instrucciones antes de ejecutar comandos.
- `REVIEW`: usar solo cuando la tarea lo justifique; contiene ejemplos con secretos, red, shell o superficie amplia.
- `BLOCK`: no usar ni instalar. No hay skills en este estado.

## Resultado por skill

| Skill | Veredicto | Motivo |
|---|---|---|
| `animejs` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `api-security-best-practices` | WARNING | Menciona `.env`, `JWT_SECRET` y manejo de secretos como parte de ejemplos de seguridad. Esperado para la tematica, pero requiere cuidado. |
| `app-performance-optimization` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `clean-code` | SAFE | Sin red flags accionables; algunos falsos positivos por vocabulario tecnico. Metadata incompleta. |
| `docker-expert` | REVIEW | Incluye ejemplos con `curl`, healthchecks y gestion de secretos. Usar solo para tareas Docker. |
| `fathom-integration` | REVIEW | Trata tokens y secretos de Fathom. No usar salvo integracion de analitica. |
| `gsap-core` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-frameworks` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-performance` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-plugins` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-react` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-scrolltrigger` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-timeline` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `gsap-utils` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `hyperframes` | REVIEW | Archivos de referencia incluyen servidor local, `curl` y ejemplos de APIs externas. Revisar antes de usar. |
| `marketing-skills-collection` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `premium-dashboard-design` | SAFE | Red flags detectados son falsos positivos por "design tokens". Metadata incompleta. |
| `remotion-best-practices` | REVIEW | Referencias incluyen `.env`, Mapbox token y `ELEVENLABS_API_KEY`. Usar solo en tareas de video/render. |
| `reportes` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `scroll-experience` | WARNING | Fuente externa y metadata incompleta; revisar antes de aplicar patrones grandes de scroll. |
| `supabase-custom-emails` | REVIEW | Incluye `RESEND_API_KEY`, tokens y hooks de email. Esperado para Supabase, pero sensible. |
| `svg-cropper` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `tailwind-patterns` | SAFE | Falsos positivos por "tokens" de diseno. Metadata incompleta. |
| `tanstack-query-best-practices` | SAFE | Sin red flags accionables. Metadata incompleta. |
| `typescript-expert` | WARNING | Incluye ejemplo `rm -rf node_modules/.cache .tsbuildinfo`; no ejecutar comandos de borrado sin revisar rutas. |
| `ui-ux-pro-max` | WARNING | Incluye comando Linux con `sudo apt update && sudo apt install python3`; no ejecutarlo sin necesidad real. |

## Hallazgos transversales

- Falta metadata formal (`version` y `author`) en las skills locales revisadas.
- No se detecto codigo con ejecucion automatica maliciosa en `SKILL.md`.
- Hay red flags por documentacion con secretos o comandos de red, sobre todo en skills de Docker, Supabase, Fathom, Hyperframes y Remotion.
- El comando `npx skills check` intento revisar actualizaciones, pero fallo al consultar/actualizar algunas fuentes externas (`find-skills`, `skill-vetter` y repositorios eliminados). No se cambiaron skills locales por ese intento.

## Politica local recomendada

- No instalar skills nuevas automaticamente desde busqueda: primero vetting, despues decision.
- No ejecutar comandos destructivos de una skill sin resolver rutas absolutas y verificar alcance.
- No pegar secretos reales en archivos de skills ni en ejemplos versionados.
- Mantener `skills/CATALOG.md` actualizado cuando se instale, retire o cambie una skill.

## Candidatas externas auditadas

Estas candidatas fueron leidas con `npx skills use <paquete@skill>` sin instalarlas globalmente.

| Skill externa | Veredicto | Motivo |
|---|---|---|
| `mblode/agent-skills@ui-animation` | SAFE | Buen foco en CSS transitions, easing, performance, `prefers-reduced-motion` y revision de animaciones. No se detectaron red flags criticas. |
| `ulpi-io/skills@frontend-design-ui-ux` | SAFE | Tiene `version`, descripcion clara y flujo de UX/spec. Pide herramientas de lectura/escritura como parte del handoff, pero no trae comandos peligrosos. |
| `vercel-labs/open-agents@web-animation-design` | SAFE | Fuente mas confiable, contenido centrado en motion, accesibilidad y performance. No se detectaron red flags criticas. |
| `dylantarre/animation-principles@micro-interactions` | SAFE | Skill pequena y concreta para feedback visual. Sin comandos de shell ni referencias sensibles. |
| `samhvw8/dot-claude@ui-design-system` | WARNING | Buen contenido para Tailwind/Radix/shadcn, pero trae referencias amplias y assets de fuentes. Mejor usar solo si migramos a ese stack. |
| `tencentcloudbase/skills@ui-design` | WARNING | Incluye URLs externas de fallback y reglas muy opinadas que pueden chocar con nuestra paleta/stack. No es bloqueo, pero requiere criterio. |
| `github/awesome-copilot@gsap-framer-scroll-animation` | WARNING | Buena fuente, pero recomienda instalar `gsap`, `motion` o `framer-motion`; usar solo si aceptamos esas dependencias. |
| `hoodini/ai-agents-skills@ux-design-systems` | SAFE | Contenido simple sobre tokens y theming. No se detectaron comandos peligrosos, aunque es menos especifica que otras opciones. |
| `mindrally/skills@framer-motion` | Pendiente | Fue encontrada, pero no auditada en detalle porque Framer Motion no aplica a la plantilla estatica actual. |
