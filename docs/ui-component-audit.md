# Auditoria de componentes UI de Sumi

Fecha: 2026-08-28  
Alcance: interfaz publica, panel administrativo y editor.  
Fuente de referencia: catalogo local `Banco de piezas`; no se incorporan runtimes React, Base UI o Radix.

## Criterio de adaptacion

Sumi conserva HTML, CSS y JavaScript nativos. Las piezas del Banco se usan como contratos de comportamiento y composicion: tamanos, variantes, estados, semantica, foco y respuesta. Los IDs, `data-*` y listeners existentes permanecen estables.

| Familia Sumi | Pieza del Banco | Decision | Adaptacion aplicada |
|---|---|---|---|
| Botones primarios, secundarios y ghost | `shadcn-button`, `origin-ui-button` | Adaptar | Altura minima de 44 px, radio y estados comunes, `disabled`, `active`, foco y variantes destructivas sin dependencias. |
| Botones de icono | `shadcn-button` | Adaptar | Caja tactil 44 x 44, etiqueta accesible obligatoria, estados `aria-pressed` para destacar, popular y visibilidad. |
| Pills, badges y contadores | `shadcn-badge` | Adaptar | Contrato `ui-pill`, contenido envolvente y variantes visuales coherentes. |
| Filtros en pills | `origin-ui-filter-pills` | Adaptar con revision | Grupo semantico, 44 px, `aria-pressed` sincronizado y estado activo visible. No se copia el ejemplo experimental. |
| Busqueda | `discovered-shadcn-ui-input-group`, `shadcn-input` | Adaptar | Icono decorativo, nombre accesible, `type=search`, foco en el grupo y ancho fluido movil. |
| Inputs, selects y textarea | `origin-ui-input`, `discovered-shadcn-ui-native-select` | Adaptar | Se mantienen controles nativos; altura, borde, foco, labels y densidad se unifican. |
| Checkbox y switch | `origin-ui-checkbox`, `origin-ui-switch` | Adaptar parcialmente | Se mantiene `input[type=checkbox]` nativo con objetivo mayor y `accent-color`; no se incorpora Radix. |
| Tablas y listas de datos | `discovered-shadcn-ui-table` | Adaptar | Contratos `table/row/columnheader/cell`, encabezado consistente, acciones separadas y estado vacio dentro de la estructura. |
| Cards y superficies | `shadcn-card` | Adaptar | Borde, fondo y jerarquia comunes sin cambiar la composicion especializada de KPI, contenido o ajustes. |
| Tabs del editor | `shadcn-tabs`, `origin-ui-tabs` | Adaptar comportamiento | `tablist/tab`, `aria-selected`, roving `tabindex` y teclado con flechas, Home y End. Sin Base UI/Radix. |
| Vacio y error | `discovered-shadcn-ui-empty` | Adaptar | Superficie reconocible, texto centrado y estado compacto; los errores mantienen `role=alert` y retry. |
| Skeleton | `shadcn-skeleton` | Ya adaptado | Geometria reservada, contenido decorativo fuera del arbol accesible y `prefers-reduced-motion`. |
| Dialogos y drawers | `shadcn-dialog`, `origin-ui-dialog` | Conservar comportamiento actual | Sumi ya aporta `role=dialog`, `aria-modal`, restauracion de foco y focus trap. Se evita sumar runtime. |
| Toast | `shadcn-toast` | Adaptar solo contrato live-region | `role=status`, `aria-live=polite`, `aria-atomic` y estado visible/oculto. No se copia la pieza por evidencia de peso y accesibilidad incompleta. |
| Sidebar | `discovered-shadcn-ui-sidebar` | No copiar | Añade CVA, iconos y primitives innecesarios. Se conserva la navegacion nativa y se sincroniza `aria-current`. |

## Hallazgos y correcciones

### P1

- Los controles repetidos tenian alturas de 34, 40, 42, 44 y 46 px. El contrato final fija 44 px para interacciones principales y campos del admin.
- Las pills de tono tenian estado activo solo visual. Ahora exponen `aria-pressed` y lo actualizan en cada render.
- Los tabs declaraban un `tablist`, pero la version estatica no tenia contrato completo ni navegacion por teclado. Ahora implementan el patron de tabs sin dependencia.
- Las busquedas principales dependian del placeholder como unico nombre visible para tecnologia asistiva. Ahora tienen etiquetas ocultas persistentes.
- Menu, clientes y consumos se veian como tablas, pero no exponian esa estructura. Ahora tienen roles de tabla y celdas, incluido el encabezado de acciones.

### P2

- `nav` se usaba para los filtros de Biblioteca aunque cambiaban estado local y no navegaban. Se sustituyo por un grupo de controles.
- Los toggles de destacado, popular y visibilidad no comunicaban su estado. Ahora incluyen `aria-pressed`.
- El toast no anunciaba el mensaje como una unidad atomica. Ahora conserva el mensaje completo durante el anuncio.
- Inputs y selects repetian reglas de borde, fondo y foco en varias zonas. Se normalizaron mediante una capa de componentes; las reglas especializadas de layout siguen en su lugar.

## Rendimiento

- Dependencias nuevas: ninguna.
- Requests de red nuevos: ninguno.
- JavaScript adicional: solo semantica de estado y navegacion por teclado de tabs.
- Las piezas con runtime (`Dialog`, `Select`, `Sidebar`) se rechazaron como imports porque Sumi puede resolver el contrato con controles nativos.
- La capa CSS compartida evita que las nuevas pantallas vuelvan a crear variantes incompatibles, aunque queda como mejora posterior retirar declaraciones legacy que ya son redundantes despues de la validacion visual.

## Verificacion ejecutada

- `npm run audit:ui`: PASS, 155 botones inspeccionados.
- `npm run build`: PASS en la verificacion final. Bundle principal: 439,91 kB / 119,06 kB gzip; CSS: 160,57 kB / 29,94 kB gzip. QR scanner, worker y codigo de QR permanecen en chunks diferidos.
- Browser local con remoto desactivado: las nueve secciones del admin fueron recorridas a 390 x 844; las vistas principales tambien se comprobaron a 768 x 1024 y 1440 x 900.
- No se detecto overflow horizontal del admin ni controles visibles menores a 44 px despues de corregir pills de tono y tooltip.
- Menu, Clientes y Consumos exponen tabla, filas, encabezados y celdas; Biblioteca y tonos exponen grupos y `aria-pressed`.
- Los tabs del editor cambian con flechas y mantienen un unico `aria-selected=true` y `tabindex=0`.
- La consola del recorrido termino sin errores ni warnings.
- La vista publica se comprobo a 390 x 844. El ancho basado en `100vw` se sustituyo por `100%`, eliminando 15 px de overflow en navegadores con scrollbar clasico; la superficie de busqueda mide 46 px.

El build conserva un warning conocido: `businesses/sumi/config.js` es un script clasico y Vite no lo integra al grafo de modulos. No bloquea el build ni fue introducido por esta auditoria.

## Pendientes de optimizacion mayor

- Las nuevas imagenes importadas desde el editor se sirven como WebP (maximo 1400 px, calidad 0,78) y conservan el original para descarga. Los 43 PNG legacy de `assets/menu` siguen sumando aproximadamente 48,2 MB; su conversion masiva continua separada y requiere allowlist, originales y rollback.
- `app.js` y `styles.css` siguen siendo monoliticos. La capa comun ya reduce divergencia, pero retirar reglas legacy redundantes debe hacerse despues de una comparacion visual automatizada por ruta.
- La correccion final de overflow publico fue validada en el servidor de desarrollo despues de la segunda iteracion de build; el proximo build normal la incorporara al artefacto regenerado.
