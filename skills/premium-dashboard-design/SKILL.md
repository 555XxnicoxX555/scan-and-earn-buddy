---
name: premium-dashboard-design
description: Diseña dashboards y secciones analíticas premium con jerarquía ejecutiva, segmentación visual clara, motion sobrio de alto nivel y consistencia con el lenguaje visual de Blu. Úsala cuando el pedido hable de verse más profesional, premium, closer dashboard, resultados más ejecutivos, entradas elegantes o animaciones coherentes.
---

# Premium Dashboard Design

Usa esta skill cuando haya que elevar una UI analítica al nivel "dashboard ejecutivo premium" sin caer en ruido visual, slop genérico ni animaciones excesivas.

## Resultado esperado

- Jerarquía visual nítida: títulos claros, métricas protagonistas, labels secundarios.
- Segmentación evidente: zonas, thresholds, estados o grupos deben leerse de un vistazo.
- Motion premium: entradas suaves, con timing elegante, preferentemente por `transform` y `opacity`.
- Consistencia: el bloque nuevo debe parecer parte del mismo sistema que los dashboards de closer/global.
- Sobriedad: menos elementos, pero cada uno con propósito.

## Skills relacionadas que debes usar como referencia

- `ui-ux-pro-max`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/ui-ux-pro-max/SKILL.md`
  Úsala para jerarquía, contraste, responsive, spacing y criterio visual general.

- `tailwind-patterns`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/tailwind-patterns/SKILL.md`
  Úsala para expresar el diseño con utilidades limpias, tokens y composición coherente.

- `gsap-core`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/gsap-core/SKILL.md`
  Úsala para entradas premium con `gsap.timeline`, `from`, `stagger` y `prefers-reduced-motion`.

- `gsap-performance`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/gsap-performance/SKILL.md`
  Úsala para evitar jank y mantener animaciones en `transform/opacity`.

- `animejs`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/animejs/SKILL.md`
  Úsala solo si el pedido requiere motion más expresivo o secuencias que no encajan mejor con GSAP ya usado en el proyecto.

- `scroll-experience`
  Ruta: `F:/Blu-Analyzer/Blu-Analyzer-s/.agents/skills/scroll-experience/SKILL.md`
  Úsala solo cuando el bloque forme parte de una narrativa scroll o una composición más inmersiva.

## Proceso

1. Identifica el bloque de referencia premium ya existente en el repo.
2. Replica su lenguaje visual antes de inventar uno nuevo.
3. Reduce el componente a sus señales importantes.
4. Haz que los estados y divisiones sean entendibles sin tooltip.
5. Añade motion de entrada corto, escalonado y elegante.
6. Verifica mobile, contraste y `prefers-reduced-motion`.

## Heurísticas visuales

- Usa fondos oscuros premium o vidrio sutil si el contexto cercano ya lo usa.
- Da color a las zonas por significado, no por decoración.
- Si hay thresholds, pinta cada tramo por separado y marca las divisiones con bordes o líneas claras.
- Si hay una marca o cursor, el badge debe explicar el estado en lenguaje ejecutivo corto.
- Evita duplicar información: si la línea ya comunica el estado, no llenes el bloque con KPIs redundantes.
- Los labels de soporte deben estar en uppercase fino o peso medio, nunca competir con la métrica principal.

## Motion

- Preferir GSAP si el repo ya lo usa en ese flujo.
- Entrada recomendada:
  - header: `y: 12-20`, `opacity: 0`
  - bloque principal: `y: 16-28`, `opacity: 0`
  - rellenos o barras: animar ancho con easing suave
  - marker/badge: entrar después del track
- Duraciones típicas:
  - 0.3s a 0.8s
- Eases recomendadas:
  - `power2.out`
  - `power3.out`
- Respetar `prefers-reduced-motion`.

## Checklist antes de cerrar

- ¿La sección se entiende en 2 segundos?
- ¿Las divisiones o thresholds son inequívocos?
- ¿El color corresponde al significado del tramo?
- ¿La animación suma percepción de calidad sin distraer?
- ¿El resultado se siente del mismo producto y no de otra app?

## Referencias

Lee [related-skills.md](./references/related-skills.md) si necesitas recordar cuándo apoyarte en cada skill relacionada.
