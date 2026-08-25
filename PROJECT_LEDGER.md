# Registro maestro del proyecto

> Documento custodiado por el `documenter`. Reúne únicamente hechos que tienen
> evidencia local o que fueron observados/reportados en la conversación. Los
> elementos no confirmados están marcados como supuesto, pregunta o pendiente;
> no deben tratarse como una aprobación técnica ni como un estado de despliegue.

## Identidad

- **Nombre coherente del proyecto:** Sumi.
- **Repositorio y alcance:** repositorio local en `C:\Users\Nicolás\Documents\Sumi`; remoto GitHub `N1ckas1o/scan-and-earn-buddy`, rama activa `codex/sumi-operational-hardening`. El producto contiene menú público, fidelización, panel de negocio, onboarding y funciones Supabase.
- **Supabase localmente enlazado:** el archivo `supabase/.temp/linked-project.json` todavía declara el nombre histórico `scan-and-earn-buddy` y el ref local `zkjzbmwwzcsqrryaspxo`; `supabase/config.toml` declara el mismo `project_id`. El dashboard visible ya figura como **Sumi**; queda pendiente reconciliar/actualizar la caché local antes de aplicar migraciones remotas.
- **Entornos incluidos:** desarrollo local/Vite, Supabase (base, Auth, Storage, RPC y Edge Functions), GitHub, Vercel, dominio administrado en Hostinger y el proyecto histórico en Lovable.
- **Responsable de la decisión:** el usuario; el agente raíz coordina integración, autorizaciones, mutaciones externas y entrega. El `documenter` mantiene este ledger, briefs, decisiones, hechos, supuestos, preguntas y evidencias.
- **Objetivo maestro vigente:** completar y entregar Sumi con un flujo seguro y auditable de canjes para empleados y dueños; validar y aplicar las migraciones en Supabase renombrado como Sumi; desplegar el proyecto en Vercel; conectar el dominio administrado en Hostinger; retirar Lovable sólo tras verificar una sustitución recuperable; realizar commit y push de cambios revisados; y dejar diseñado o implementado un centro de mando freelance reusable con onboarding de clientes, contexto compartido para subagentes y acceso seguro a credenciales sin secretos en texto plano.

## Checkpoint actual — 2026-08-24 (validación local actualizada)

- **Implementación local:** completada para el flujo de empleado/canjes. Incluye workspace separado, cola de solicitudes, confirmación contextual, transiciones mediante `manage_reward_redemption_status_v2` e historial/actor en la UI, junto con la migración local auditada.
- **Validación local:** `npm run audit:redemptions` pasa sus 16 invariantes, `npm run audit:ui` pasa con 153 controles/botones y `npm run build` termina correctamente (queda el warning no bloqueante del script clásico de configuración).
- **Smoke local:** `npm run smoke:ui` ahora levanta el servidor aislado en `127.0.0.1:4178` con `VITE_DISABLE_REMOTE=true`, comprueba `remoteDisabled` y `hasSupabase`, completa el flujo y cierra el listener. El bucle de microtareas de la inicialización quedó corregido marcando `loaded=true` cuando no hay Supabase; los bloqueos de fixture owner del checkpoint anterior quedan supersedidos.
- **Visor responsive de desarrollo:** existe `dev-preview.html` con modos Teléfono, Tablet y Escritorio; es una herramienta sólo de desarrollo y no se incluye en `dist`.
- **Revisión previa al commit:** no se identificaron P0 ni P1 locales; el P1 remoto queda pendiente hasta validar/aplicar la migración en Supabase. El staging de entrega excluye `skills/`, `skills-lock.json` y `graphify-out/` no relacionados.
- **Credenciales y seguimiento:** `.env` local está ignorado y fuera de tracking; no se registran sus valores.
- **Migración remota:** `supabase/migrations/20260824000100_audited_reward_redemptions.sql` sigue sin aplicarse. El preflight read-only agregado se ejecutó contra Supabase Sumi: 2 canjes `approved`, 0 actores huérfanos, 0 clientes cruzados/faltantes, 0 duplicados, 0 contextos sobre 8192 bytes y 0 claves reservadas. La revisión de grants detectó que `anon`/`authenticated` conservaban `TRUNCATE`; la migración fue corregida para revocar todos los privilegios directos y conceder sólo `SELECT` a `authenticated`.
- **Siguiente puerta:** obtener esa aprobación de identidad/preflight y ejecutar sólo la validación remota autorizada; después se podrá aplicar la migración con su evidencia y continuar con commit/push y despliegue.

### Historial de checkpoints superseded

- El checkpoint anterior registraba auditorías/build aún no ejecutados y tres intentos de smoke detenidos en la fixture de owner. Esa situación fue corregida y reemplazada por la evidencia de validación completa anterior; se conserva aquí sólo como historial, no como estado vigente.

## Checkpoint de despliegue — 2026-08-24

- **Runbook:** creado `docs/DEPLOYMENT_RUNBOOK.md`; describe la secuencia recuperable oficial y queda sin ejecutar.
- **Vercel:** `vercel.json` fija Vite, `npm run build` y salida `dist`; el objetivo operativo es importar el repositorio aprobado con root `.`. La cuenta observada sólo muestra `sumi-onboarding`: su deployment de producción está `Ready`, fue creado mediante `vercel deploy`, sirve `onboarding.sumi.business` y no tiene repositorio Git conectado. No se ha importado ni desplegado el sitio principal Sumi.
- **Variables:** `.env` local se preservó, fue retirado del tracking y permanece excluido por `.gitignore`; `.env.example` existe con placeholders para `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` y `VITE_PUBLIC_APP_URL`. No se permite `service-role` en Vercel.
- **Puerta y rollback:** primero commit aprobado, importación/build/preview y logs; después agregar `sumi.business` usando sólo los registros exactos mostrados por Vercel, reducir TTL y cambiar Hostinger. Se deben validar HTTPS/QR/Auth, registrar deployment ID y conservar rollback; Lovable permanece intacto hasta confirmación destructiva final.
- **Estado externo:** no se modificaron DNS ni se retiró Lovable. La identidad visual de Supabase sí quedó reconciliada con el proyecto Sumi, pero el preflight SQL todavía no se ejecutó por falta de aprobación. Lovable conserva el proyecto `Sumi-Test`, sincronizado desde GitHub y con cambios sin publicar; usa `proyecto-gastronomia.lovable.app` y no tiene `sumi.business` conectado como dominio personalizado.

## Baseline público read-only — 2026-08-24

> Esta observación es una referencia pública de estado y rollback, no una
> configuración objetivo ni una autorización para cambiar DNS.

- **Apex:** `sumi.business` → registro `A` `147.93.37.70`, TTL observado `1800`.
- **WWW:** `www.sumi.business` → `CNAME` a `sumi.business`, TTL observado `300`.
- **Nameservers:** `horizon.dns-parking.com` y `orbit.dns-parking.com`, con TTL aproximado observado de `86400`; no se observaron registros públicos `MX`, `TXT` ni `CAA` en esta consulta. Esto no autoriza a sustituir los nameservers completos: cualquier cutover debe limitarse a los registros web exactos que entregue Vercel.
- **HTTPS:** respuesta `200`; título `Sumi Menu Admin`; servidor observado: `LiteSpeed`.
- **Cabeceras:** la CSP observada contiene únicamente `upgrade-insecure-requests`; en la respuesta observada no se vio `Strict-Transport-Security` (HSTS) ni `Cache-Control`.
- **Bundle público:** el sitio sirve `assets/index-DqzCP29E.js` (`359320` bytes); ese bundle no contiene `manage_reward_redemption_status_v2` ni `employee-workspace`, evidencia de que producción continúa en una versión anterior al flujo local auditado.
- **Límite de la verificación:** se consultó el estado público en modo read-only; no se ingresó a Hostinger ni se modificó ningún registro DNS.
- **Uso de rollback:** conservar estos valores como baseline anterior para comparar y recuperar si el cutover falla. No copiarlos como valores objetivo de Vercel/Hostinger sin verificar primero los registros exactos que entregue el proyecto Vercel final.

## Brief vigente

### Producto Sumi

- **Problema:** permitir que un negocio gastronómico publique su menú y opere fidelización sin mezclar el acceso del dueño, del personal y del cliente, manteniendo trazabilidad de consumos, puntos y canjes.
- **Usuarios y roles:** `owner`, `manager`, `employee` y `customer` son los roles de negocio presentes en las migraciones y el frontend actual. Las migraciones también contemplan el rol de sistema `platform_operator` para el onboarding, que no es un rol operativo del negocio.
- **Resultado esperado:** panel de dueño/manager con clientes, consumos, menú, fidelización, contenido, biblioteca, QRs y ajustes; vista de empleado mínima para escanear/buscar clientes y cargar consumos; vista de cliente para consultar puntos, QR, historial y solicitar premios; canjes con estados, confirmación e historial de actores.
- **Fuera de alcance actual:** prometer analítica completa de ventas o margen sin un ledger de pedidos/POS. El brief de analítica define que el MVP sólo puede hablar de **consumos registrados en Sumi**.
- **Restricciones:** separación por `business_id`; RLS y RPC como frontera de autorización; no entregar secretos de clientes en texto plano a agentes; no retirar Lovable ni cambiar DNS antes de verificar el reemplazo; no ejecutar pruebas sin el manifiesto y la aprobación requeridos.
- **Estado del brief en este checkpoint:** la implementación local de empleado/canjes está completada; la aceptación de entrega sigue bloqueada por la aprobación del manifiesto local, la ejecución de validaciones y la aplicación remota de la migración.
- **Estado de despliegue:** el runbook oficial está documentado, pero commit, importación Vercel, preview, DNS y producción siguen pendientes de aprobación y ejecución.

### Centro de mando freelance

- **Problema:** reutilizar Astro + Keystatic + GitHub + Vercel + Codex para entregar sitios de clientes y conservar briefs, decisiones, estado, stack, URLs, assets y reglas sin exponer credenciales.
- **Resultado esperado:** un centro local/reutilizable con onboarding, tarjetas de clientes, contexto consultable por agentes, configuración por tenant y referencias a credenciales. El contexto compartido puede contener alias y metadatos, pero nunca contraseñas, tokens de servicio ni claves privadas en texto plano.
- **Artefacto vigente:** `docs/FREELANCE_COMMAND_CENTER.md` contiene la arquitectura versionada, el esquema de ficha/context pack, onboarding, broker allowlisted, política de credenciales y criterios de aceptación. Su estado declarado es “arquitectura aprobable, implementación pendiente”.
- **Decisión de seguridad:** agentes y subagentes deben operar con mínimo privilegio, sesiones autenticadas o tokens acotados/revocables cuando corresponda; las acciones privilegiadas sobre GitHub, Supabase, Vercel, Hostinger o Lovable deben quedar bajo coordinación y aprobación del agente raíz/usuario. Una simple interfaz no constituye aislamiento criptográfico si un proceso posee el mismo acceso de shell al equipo.

## Hechos verificados

| Hecho | Evidencia | Fecha |
|---|---|---|
| El repositorio está en la rama `codex/sumi-operational-hardening` y el último commit local es `a1bf1de` (`fix: preserve content visuals and filter consumption categories`). | `git status --short --branch`, `git log` y `git remote -v`. | 2026-08-24 |
| La cuenta propietaria de GitHub fue renombrada a `N1ckas1o`; el remoto local usa `https://github.com/N1ckas1o/scan-and-earn-buddy.git` y conserva permisos `ADMIN`. | Confirmación de GitHub, `gh api user`, `gh repo view` y configuración Git local. | 2026-08-25 |
| El árbol de trabajo conserva cambios de producto y documentación, pero la revisión del staging de entrega excluye explícitamente `skills/`, `skills-lock.json` y `graphify-out/` no relacionados. | `git status --short` y revisión del staging de entrega. | 2026-08-24 |
| El paquete declara comandos `build`, `audit:ui`, `smoke:ui`, `check:supabase`, comprobaciones de live sync/onboarding/cliente y preparación de cliente. | `package.json`. | 2026-08-24 |
| La configuración Vercel del sitio principal usa framework Vite, `npm run build` y `dist` como salida. | `vercel.json`. | 2026-08-24 |
| El script de build genera el sitio principal en `dist` y el artefacto de onboarding en `dist-onboarding`; el despliegue principal debe consumir `dist`. | `scripts/build.mjs`. | 2026-08-24 |
| `.env` existe localmente, fue retirado del tracking y está excluido por `.gitignore`; `.env.example` existe con placeholders de las cuatro variables públicas/configurables requeridas. | `.gitignore`, `.env.example` y estado Git local; no se registran valores de `.env`. | 2026-08-24 |
| La configuración local carga `businessId: "sumi"`, título `Sumi Menu Admin`, URL pública `https://sumi.business/` y colores/identidad de Habibi Bites; contiene también dos marcas demo. | `businesses/sumi/config.js`. | 2026-08-24 |
| La aplicación usa `owner`, `manager`, `employee` y estados de staff; `canAccessAdminView` limita al manager a Inicio, Clientes, Consumos, Menú y Fidelización. El empleado se renderiza como workspace separado sin acceso al panel completo. | `app.js`, funciones `isOwner`, `isManager`, `canAccessAdmin`, `canAccessAdminView`, `isStaff`, `renderAuthState` y `renderStaffWorkspace`. | 2026-08-24 |
| La migración de staff permite `owner`, `manager` y `employee`; `is_business_staff` incluye los tres y `is_business_manager` incluye owner/manager. | `supabase/migrations/20260702073411_staff_consumption_qr.sql` y `20260710091846_onboarding_b2b_and_manager.sql`. | 2026-08-24 |
| El cliente solicita canjes mediante `request_reward_redemption`, con validaciones de cuenta activa, premio activo/vigente, stock, nivel, puntos y una solicitud pendiente por premio; la solicitud expira a los 15 minutos. | `supabase/migrations/20260709010500_reward_redemption_request_hardening.sql` y `20260711002339_enforce_active_customer_redemptions.sql`. | 2026-08-24 |
| El entry point legacy `manage_reward_redemption_status` exige sesión y staff, conserva los estados `approved`, `redeemed` y `cancelled`, y la migración auditada lo redefine para delegar al RPC estricto; el descuento/devolución de puntos y stock quedan en la transición v2. | `supabase/migrations/20260705000200_manage_reward_redemption_status.sql` y `20260824000100_audited_reward_redemptions.sql`. | 2026-08-24 |
| **[Superseded]** El RPC anterior sólo actualizaba `reward_redemptions.status` y columnas de último cambio, sin historial append-only demostrado. | Lectura de la migración anterior antes de `20260824000100_audited_reward_redemptions.sql`. | 2026-08-24 |
| **[Superseded]** La UI anterior presentaba acciones de canje sin confirmación y sin cola propia del empleado. | Lectura de `app.js`/markup anterior antes de la implementación auditada. | 2026-08-24 |
| La documentación de `ADMIN_PANEL.md` describe el MVP antiguo como owner/customer y dice que no debe existir un tercer rol; esa afirmación quedó superada por las migraciones y el frontend que ya contemplan manager/employee. | Comparación de `ADMIN_PANEL.md` con las migraciones y `app.js`. | 2026-08-24 |
| El onboarding B2B crea tablas de invitaciones, entregas y archivos, aplica RLS a operadores de plataforma y usa un bucket privado de Storage con límites de tipo/tamaño. | `supabase/migrations/20260710091846_onboarding_b2b_and_manager.sql`. | 2026-08-24 |
| Graphify tiene una salida local con manifest, informe, salud, costo, grafo y HTML; el diagnóstico registrado informa 3.632 nodos, 4.595 relaciones válidas, sin endpoints faltantes, duplicados ni self-loops, y recuperación de los dos briefs. | `graphify-out/GRAPH_HEALTH.json`, `manifest.json`, `cost.json` y `GRAPH_REPORT.md`. | 2026-08-24 |
| El procesamiento de Graphify registrado consumió 247.799 tokens de entrada y 51.385 de salida sobre 325 archivos en el run guardado. | `graphify-out/cost.json`. | 2026-08-24 |
| El brief de analítica recomienda una sección `Estadísticas`, separada del Inicio operativo, y limita el primer lanzamiento a consumos registrados; enumera correcciones de veracidad, RPC agregado y futura separación de ledger de pedidos/POS. | `docs/ANALYTICS_BRIEF.md`, estado “borrador para revisión”. | 2026-08-24 |
| El brief de portabilidad concluye que la exportación white-label aún es semiautomática; identifica configuración por negocio, build aislado, assets por tenant, esquema versionado, export/import y prohibición de secretos/PII en el paquete. | `docs/BUSINESS_PORTABILITY.md`, estado “propuesta para revisión”. | 2026-08-24 |
| La migración `20260824000100_audited_reward_redemptions.sql` añade `reward_redemption_events`, triggers de historial inmutable, cola para staff, RPC estricto con `expected_status`, bloqueo de `requested → redeemed`, restricción de cancelación para employee, reposición de stock/puntos al cancelar y wrapper seguro para el RPC legado. | Archivo local `supabase/migrations/20260824000100_audited_reward_redemptions.sql`; aún no aplicado al proyecto remoto. | 2026-08-24 |
| La implementación local de empleado/canjes está completada: la UI consulta la cola del staff, muestra acciones de aprobar/entregar, pide confirmación con cliente/premio/puntos/acción, usa `manage_reward_redemption_status_v2` y representa historial/actor de transición. | `app.js`, funciones `loadStaffRedemptionQueue`, `renderStaffWorkspace`, `updateRedemptionStatus` y `redemptionActivityDetail`, más `index.html`/`styles.css`; auditorías estáticas, build y smoke aislado completo pasan; la migración todavía no fue aplicada remotamente. | 2026-08-24 |
| La revisión previa al commit no identificó P0 ni P1 locales; el único P1 pendiente es remoto y depende de aplicar/validar la migración en Supabase. | Revisión precommit reportada por el root y estado de la migración remota. | 2026-08-24 |
| La auditoría estática de canjes pasó sus 16 invariantes y la auditoría UI pasó 153 controles; el build principal y onboarding terminó correctamente con un warning no bloqueante sobre el script clásico de configuración. | Salidas registradas de `npm run audit:redemptions`, `npm run audit:ui` y `npm run build` del 2026-08-24. | 2026-08-24 |
| El smoke aislado actual levanta `127.0.0.1:4178` con `VITE_DISABLE_REMOTE=true`, comprueba `remoteDisabled` y `hasSupabase`, completa el flujo y cierra el listener; la inicialización sin Supabase evita el bucle de microtareas al marcar `loaded=true`. | Salida verificada de `npm run smoke:ui` y corrección local de la inicialización. | 2026-08-24 |
| El preflight agregado se ejecutó en Supabase Sumi: 2 canjes aprobados, sin actores huérfanos, clientes cruzados/faltantes, duplicados, contextos grandes ni claves reservadas. Los RPC nuevos siguen ausentes, como corresponde antes de la migración. | CSV exportado del SQL Editor y `supabase/verification/20260824000100_audited_reward_redemptions_preflight.sql`. | 2026-08-25 |
| El preflight mostró privilegios directos amplios, incluido `TRUNCATE`, para `anon` y `authenticated`; la migración fue corregida para usar `REVOKE ALL PRIVILEGES` y luego conceder únicamente `SELECT` a `authenticated`. La auditoría local volvió a pasar sus 16 invariantes. | Grants del preflight, migración corregida y salida de `npm run audit:redemptions`. | 2026-08-25 |
| El visor responsive de desarrollo permite alternar Teléfono, Tablet y Escritorio y no forma parte del artefacto de producción `dist`. | `dev-preview.html` y verificación de exclusión del build. | 2026-08-24 |
| El runbook de despliegue recuperable fue creado y todavía no se ejecutó. | `docs/DEPLOYMENT_RUNBOOK.md`; no hubo importación Vercel, deployment, cambio DNS ni retirada de Lovable en este checkpoint. | 2026-08-24 |
| El baseline público read-only observado para rollback es `sumi.business` A `147.93.37.70` TTL `1800` y `www.sumi.business` CNAME a `sumi.business` TTL `300`; HTTPS respondió `200`, con título `Sumi Menu Admin`, servidor `LiteSpeed`, CSP sólo `upgrade-insecure-requests` y sin HSTS/`Cache-Control` observados. | Verificación pública read-only del 2026-08-24; no se ingresó a Hostinger ni se modificó DNS. | 2026-08-24 |
| La consulta pública observó nameservers `horizon.dns-parking.com` y `orbit.dns-parking.com` con TTL aproximado `86400`, y no observó registros públicos `MX`, `TXT` ni `CAA`; no se deben cambiar nameservers completos y el cutover debe limitarse a registros web. | Verificación DNS read-only del 2026-08-24; no se ingresó a Hostinger ni se modificó DNS. | 2026-08-24 |
| El bundle público observado es `assets/index-DqzCP29E.js` (`359320` bytes) y no contiene `manage_reward_redemption_status_v2` ni `employee-workspace`; producción sigue sirviendo la versión anterior, no el flujo local auditado. | Inspección pública read-only del bundle servido el 2026-08-24; no se registran hashes ni se infiere proveedor adicional. | 2026-08-24 |
| Hostinger muestra como dominio registrado exacto `sumi.business`. | Verificación visual de la cuenta Hostinger durante la sesión actual. | 2026-08-24 |
| `https://sumi.business` carga actualmente `Sumi Menu Admin` y presenta selector de idioma. | Verificación de navegación en navegador durante la sesión actual. | 2026-08-24 |
| Vercel muestra únicamente el proyecto `sumi-onboarding`; su deployment de producción figura `Ready`, tiene como origen `vercel deploy`, sirve `onboarding.sumi.business` y no posee repositorio Git conectado. | Verificación read-only del overview y la sección Production Deployment de Vercel durante la sesión actual. | 2026-08-24 |
| `https://onboarding.sumi.business` carga `Onboarding \| Sumi` y exige un enlace privado para continuar. | Verificación de navegación en navegador durante la sesión actual. | 2026-08-24 |
| El dashboard visible de Supabase figura como `Sumi`. | Verificación visual del dashboard de Supabase durante la sesión actual. | 2026-08-24 |
| El repositorio público de GitHub es `N1ckas1o/scan-and-earn-buddy`, su rama por defecto es `main` y `codex/sumi-operational-hardening` está publicada en el commit local actual. | Salidas verificadas de `gh repo view`, `git push` y `git ls-remote`; no implica que la rama de trabajo haya sido fusionada. | 2026-08-25 |
| `docs/FREELANCE_COMMAND_CENTER.md` fue creado y contiene una arquitectura versionada para el centro de mando freelance, onboarding y credenciales protegidas. | Archivo local leído tras la creación. | 2026-08-24 |
| Lovable contiene el proyecto `Sumi-Test`, muestra actividad sincronizada desde GitHub y cambios sin publicar; su URL propia es `proyecto-gastronomia.lovable.app` y no tiene `sumi.business` conectado como dominio personalizado. No se retiró ni modificó. | Verificación read-only del proyecto y de Settings → Domains en Lovable durante la sesión actual. | 2026-08-24 |

## Supuestos y preguntas

| Elemento | Impacto | Estado |
|---|---|---|
| **Supuesto resuelto:** el dominio que debe conectarse es `sumi.business`. | Cambiar DNS sobre otro dominio sería una mutación equivocada. | Resuelto: Hostinger muestra exactamente `sumi.business`; aún no se modificaron registros DNS. |
| **Pregunta:** ¿el proyecto GitHub debe conservar el nombre histórico `scan-and-earn-buddy` o renombrarse también a Sumi? | Afecta URL remota, importación en Vercel y enlaces de entrega. | Pendiente del usuario/root; no inferir a partir del renombrado de Supabase. |
| **Pregunta resuelta parcialmente:** ¿la migración de canjes que agrega historial/estado estricto ya fue escrita y en qué archivo? | Sin esa evidencia no puede validarse ni aplicarse en Supabase. | Resuelto localmente: existe `supabase/migrations/20260824000100_audited_reward_redemptions.sql`; falta auditoría estática, validación y aplicación remota. |
| **Contrato local pendiente de verificación remota:** ¿qué roles pueden aprobar, entregar o cancelar cada transición? | Debe coincidir entre matriz de negocio, UI, RPC y RLS; evita falsos positivos y abusos. | La migración/UI local definen employee para aprobar/entregar y owner/manager para cancelar; falta confirmar después de apply y pruebas. |
| **Decisión local:** ¿un empleado puede marcar `redeemed` o sólo aprobar? | Cambia la máquina de estados y el riesgo de entrega/doble toque. | Implementación local permite aprobar y entregar con confirmación; employee no puede cancelar. Requiere validación remota. |
| **Pregunta:** ¿la corrección de un monto mal cargado debe requerir motivo, vista previa y/o segunda aprobación? | Afecta reversibilidad y auditoría de puntos. | La UI actual exige motivo para ajuste manual del owner; el flujo final de canjes debe documentar la regla. |
| **Supuesto:** la sustitución Vercel debe quedar verificada antes de borrar/despublicar Lovable. | Evita pérdida de servicio y facilita recuperación. | Decisión operativa vigente; `sumi-onboarding` sigue sin repo Git conectado y Lovable permanece disponible en su URL propia, sin controlar `sumi.business`. |
| **Pregunta de despliegue:** ¿cuál es el proyecto Vercel final que recibirá el repositorio Sumi? | Evita publicar sobre `sumi-onboarding` u otro tenant por error. | Pendiente de confirmación del root/usuario; el runbook exige importar con root `.` y registrar el proyecto exacto. |
| **Supuesto operativo:** los valores de Preview/Production deben usar sólo el Supabase Sumi reconciliado y la publishable key; nunca `service-role`. | Una variable equivocada puede apuntar al proyecto histórico o exponer privilegios. | Regla adoptada en `docs/DEPLOYMENT_RUNBOOK.md`; valores aún no cargados ni verificados en Vercel. |
| **Pregunta de DNS:** ¿qué registros exactos muestra Vercel para `sumi.business` en el proyecto final? | Evita adivinar A/CNAME/ALIAS o mutar otro dominio. | Pendiente: copiar y registrar sólo la salida de Vercel después de verificar el preview; Hostinger aún no fue modificado. |
| **Pregunta:** ¿qué parte del centro de mando será MVP local y qué parte quedará sólo diseñada? | Evita declarar “listo” un sistema que sólo tiene un brief. | Pendiente del root después del informe de arquitectura freelance. |
| **Supuesto de seguridad:** referencias/alias a credenciales son compartibles; secretos, cookies, contraseñas y claves privadas no. | Un agente puede necesitar contexto sin recibir material de autenticación. | Decisión adoptada; requiere diseño/implementación de broker o ejecución privilegiada del root. |
| **Pregunta:** ¿qué jurisdicción y entidades legales deben regir términos y políticas de los clientes? | El consultor legal no puede redactar documentos finales válidos sin jurisdicción y datos reales. | Fuera de la integración técnica inmediata; pendiente de brief legal. |
| **Pregunta resuelta:** ¿se permite una prueba local de solo lectura? | El manifiesto local fue aprobado y la validación aislada se ejecutó sin APIs, DB, Storage ni red externa. | Resuelta para el alcance local; la identidad/preflight remoto de Supabase aún requiere aprobación específica. |

## Matriz de autorización

| Rol | Recurso | Acción permitida | Límite organizacional | Motivo |
|---|---|---|---|---|
| `owner` | Panel, clientes, consumos, menú, premios, ajustes | Leer y administrar según RLS; corregir/cancelar consumos y ajustar puntos con motivo en el flujo existente | Sólo `business_id` con membresía owner | Responsable del negocio; `is_business_admin`/RLS |
| `manager` | Inicio, Clientes, Consumos, Menú, Fidelización | Lectura y operaciones permitidas por `is_business_manager`; no asumir acceso a ajustes, contenido, biblioteca o QRs hasta verificar | Sólo su negocio | Las migraciones amplían lectura/gestión operativa a manager; la UI limita vistas explícitamente |
| `employee` | Lookup de cliente y registro de consumo | Buscar por QR/nombre/correo y registrar consumo vía RPC; no editar perfiles ni quitar puntos libremente | Sólo clientes del `business_id` autenticado | Uso móvil de caja; `is_business_staff` y workspace separado |
| `employee` (canjes) | Solicitudes de canje | Aprobar y marcar entregado mediante cola/RPC estricto y confirmación; no cancelar | Sólo canjes del negocio | Implementación local completada; falta auditoría/pruebas autorizadas, apply y verificación remota |
| `customer` | Perfil, puntos, QR, historial, canjes | Leer/escribir sólo su perfil permitido y solicitar premios; no acreditar puntos desde el frontend | Sólo su `customer_profile` y cuenta | RLS y RPC de solicitud |
| `platform_operator` | Onboarding e invitaciones | Administrar invitaciones, submissions y archivos privados según RLS | Plataforma, no datos operativos de un negocio salvo reglas explícitas | Flujo B2B de onboarding |
| Agentes/subagentes | Contexto de proyectos | Consultar briefs, hechos, decisiones, alias y estado; proponer o editar sólo archivos asignados | Sin secretos en texto plano; mínimo privilegio; root coordina acciones externas | Separar contexto compartido de credenciales privilegiadas |

## Decisiones

| Decisión | Motivo | Alternativas | Responsable | Fecha |
|---|---|---|---|---|
| Usar **Sumi** como nombre coherente del producto y `businessId` local. | El frontend/config ya lo usa; evita seguir propagando el nombre histórico. | Mantener `scan-and-earn-buddy` en todos los sistemas. | Usuario/root | 2026-08-24 |
| Tratar el nombre externo de Supabase como **Sumi** y conservar la discrepancia de la caché local como riesgo operativo. | El dashboard visible figura como Sumi, pero `.temp/linked-project.json` aún dice `scan-and-earn-buddy`; no se debe aplicar una migración al destino equivocado. | Declararlo reconciliado sin refrescar la referencia local. | Documenter/root | 2026-08-24 |
| Mantener el flujo de puntos correctivos del owner; el empleado no puede quitar puntos a voluntad. | Reduce abuso y permite revisión de errores de monto. | Permitir reversión directa al empleado. | Usuario/root | Conversación previa; fecha exacta no registrada |
| El canje debe tener transiciones estrictas, historial inmutable de actores y confirmación antes de una acción irreversible. | Evita `requested → redeemed` accidental, doble toque y pérdida de quién aprobó/entregó. | Actualizar sólo el último status en `reward_redemptions`. | Usuario/root + implementador | Conversación previa; implementación pendiente de evidencia |
| No tocar DNS hasta tener despliegue Vercel verificado; no retirar Lovable hasta tener sustitución recuperable y aprobación de acción destructiva. | Evita dejar el dominio o servicio sin destino. | Cambiar DNS/borrar Lovable primero. | Root/usuario | 2026-08-24 |
| No entregar credenciales de clientes en texto plano a ningún agente. | Reduce exposición y privilegia sesiones/tokens revocables o broker controlado. | Guardar contraseñas en el centro de mando o pasarlas en briefs. | Usuario/root | Conversación previa |
| Analítica inicial se llama Estadísticas y se basa en consumos registrados; no se promete ventas/POS sin ledger de pedidos. | Evita métricas falsas y confundir puntos con facturación. | Presentar ticket como venta completa desde el MVP. | Usuario/root; brief en revisión | 2026-08-24 |
| La documentación anterior de `ADMIN_PANEL.md` que excluía manager/employee queda marcada como supersedida por migraciones y frontend actuales. | Preserva historia sin permitir que un documento viejo contradiga el contrato vigente. | Borrar el texto histórico. | Documenter/root | 2026-08-24 |
| Cada prueba se anuncia con manifiesto y requiere aprobación explícita, incluyendo pruebas locales de solo lectura cuando el usuario lo haya exigido. | Evita costes de API, escrituras DB/Storage, procesos persistentes y artefactos no controlados. | Ejecutar smoke/build automáticamente. | Usuario/root + execution cost guardian | Conversación previa |
| El despliegue oficial sigue una secuencia recuperable: commit aprobado → importación Vercel en root `.` con Vite/`npm run build`/`dist` → variables Preview/Production → preview y logs → dominio y DNS exactos → validación producción. | Reduce el riesgo de publicar el commit o destino equivocado y deja una puerta de rollback. | Cambiar DNS o retirar Lovable antes del preview. | Root/usuario | 2026-08-24 |
| Vercel sólo recibe `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` y `VITE_PUBLIC_APP_URL` por entorno; nunca `service-role` ni secretos equivalentes. | Mantiene privilegio mínimo y evita exponer credenciales en el bundle. | Copiar `.env` local o usar una service-role en frontend. | Root/usuario | 2026-08-24 |
| `sumi.business` se conecta usando únicamente los registros exactos mostrados por Vercel; se reduce TTL antes del cambio y Lovable se conserva hasta confirmación destructiva final. | Evita mutar DNS incorrecto y conserva recuperación. | Adivinar registros o retirar Lovable durante el cutover. | Root/usuario | 2026-08-24 |

## Criterios de aceptación

- [ ] El flujo de canjes sólo permite transiciones válidas y rechaza `requested → redeemed` sin aprobación/entrega definida.
- [ ] Una aprobación/entrega/cancelación requiere confirmación explícita en la UI, es idempotente ante doble toque y muestra cliente, premio, puntos y actor.
- [ ] La base conserva un historial append-only por transición con actor, rol, estado anterior/nuevo, fecha y motivo/contexto; no depende sólo de sobrescribir el último actor.
- [ ] Owner, manager, employee y customer tienen permisos verificables en RLS/RPC coherentes con la matriz; el employee no puede ajustar o quitar puntos arbitrariamente.
- [ ] Existe una sección de dueño/manager que permite revisar correcciones, estado y qué cuenta realizó cada acción.
- [ ] Las migraciones nuevas y existentes se validan de forma estática y se aplican al proyecto Supabase correcto después de la aprobación necesaria; la evidencia incluye nombre/ref reconciliados y resultado.
- [ ] El build de Sumi carga el tenant/config correcto, sin secretos, PII ni identidad accidental de otro cliente.
- [ ] El commit final contiene sólo archivos revisados y el push al remoto queda confirmado; cualquier cambio de skills/Graphify no relacionado se separa o se documenta.
- [ ] Vercel sirve el build verificado; el dominio exacto se conecta desde Hostinger con registros comprobados y HTTPS/redirect verificados.
- [ ] El proyecto Vercel fue importado desde el commit aprobado con root `.`, Vite, `npm run build` y salida `dist`; Preview y Production tienen sólo las cuatro variables requeridas, sin `service-role`.
- [ ] El preview y sus logs fueron verificados antes de agregar `sumi.business`; se registraron deployment ID, URL, registros DNS exactos, TTL y un deployment/dominio de rollback.
- [ ] QR y Auth fueron comprobados en preview/producción con evidencia; el rollback de deployment y dominio está documentado y Lovable sólo se retira con confirmación destructiva final.
- [ ] Lovable se retira únicamente después de documentar la URL Vercel/dominio, un camino de recuperación y una aprobación de acción destructiva en el momento de ejecutarla.
- [ ] El centro de mando tiene brief/contexto por cliente, onboarding y referencias de credenciales; no contiene contraseñas, tokens de servicio, cookies ni claves privadas en texto plano.
- [ ] El centro de mando documenta mínimo privilegio, rotación/revocación, auditoría y qué acciones requieren intervención del root/usuario.
- [ ] Las pruebas ejecutadas tienen manifiesto, límites, limpieza, aprobación y resultado; sin aprobación se registra “no ejecutada”, no “pasó”.

## Estado de trabajo

| Frente | Agente | Estado | Archivos propios | Dependencias |
|---|---|---|---|---|
| Contexto, ledger, briefs y decisiones | `documenter` (este agente) | En curso; ledger actualizado; no pruebas ni mutaciones externas | `PROJECT_LEDGER.md`, briefs y registros documentales | Evidencia local y reportes del root/especialistas |
| Canjes auditables | `redemption_implementer` | Implementación local completada y migración remota aplicada transaccionalmente; postflight íntegro | `app.js`, `index.html`, `styles.css`, `ADMIN_PANEL.md`, `supabase/migrations/20260824000100_audited_reward_redemptions.sql` | Despliegue y validación funcional remota |
| Auditoría de seguridad y datos | Especialistas de seguridad/datos + root | Revisión precommit sin P0/P1; el riesgo remoto quedó cerrado por apply/postflight | Reportes de revisión y árbol local corregido | Validación funcional desde el despliegue |
| Auditoría estática nueva de canjes | Root | Completada: 16 invariantes PASS | `scripts/audit-redemptions.mjs`, `package.json`; salida del 2026-08-24 | Reejecutar sólo si cambia el contrato y existe nueva aprobación |
| Arquitectura del centro freelance | `freelance_stack_architect` + `documenter` | Arquitectura reusable creada y registrada; implementación del MVP aún pendiente | `docs/FREELANCE_COMMAND_CENTER.md` | Brief/ledger y decisión MVP |
| UI/UX y responsive admin/empleado | Especialistas globales / root | Flujo de empleado validado localmente; visor `dev-preview.html` terminado para Teléfono/Tablet/Escritorio; aceptación de producción pendiente | `app.js`, `index.html`, `styles.css`, `dev-preview.html` | Validación remota y revisión final de despliegue |
| Supabase/RLS/migraciones | Root + especialista de datos | Migración aplicada a Sumi mediante Management API dentro de `BEGIN/COMMIT`; postflight confirma cobertura completa, RLS/RPC y cero grants inseguros | `supabase/migrations/**`, `supabase/config.toml`, `supabase/verification/**` | Validación funcional desde el build desplegado |
| Runbook de despliegue recuperable | `documenter` + root | Creado y registrado; no ejecutado ni usado para autorizar mutaciones | `docs/DEPLOYMENT_RUNBOOK.md` | Commit aprobado, proyecto Vercel final, preview/logs y aprobación DNS |
| Graphify | Graphify/Documenter | Grafo local generado y diagnosticado; posible actualización posterior si cambia el código | `graphify-out/**` | Decidir si actualizar después del merge; requiere registrar costo |
| GitHub commit/push | Root | Rama operativa publicada; falta registrar y publicar la evidencia final de apply/postflight sin incluir cambios ajenos | Archivos relevantes del worktree | Revisión final de los dos SQL y ledger |
| Vercel | Root | Proyecto principal `sumi` creado desde el commit aprobado; primer deployment `Ready` con alias `sumi-pearl.vercel.app`, build remoto y respuesta HTTP 200 verificados. Cuatro variables públicas configuradas en Preview/Production; sin service-role | Configuración externa + `.vercelignore` | Conectar Git, validar Auth/QR y luego dominio |
| Hostinger/DNS | Root | Dominio exacto `sumi.business` verificado; registros DNS aún no modificados; runbook exige registros exactos Vercel y TTL registrado | Configuración externa | Preview Vercel verificado y confirmación antes de mutar DNS |
| Lovable | Root | Proyecto histórico observado como `Sumi-Test`; no retirar | Configuración externa | Sustitución recuperable + aprobación inmediata |

## Manifiestos de pruebas y costos

| Prueba | Servicios/escrituras | Límites y limpieza | Aprobación | Resultado |
|---|---|---|---|---|
| **Manifiesto local de validación** | `audit:redemptions`, `audit:ui`, `build` y smoke con Supabase desactivado | Ejecuciones acotadas; listener cerrado; sin red externa ni datos reales | Concedida para la fase local | Auditorías, build y smoke completo pasan |
| `npm run audit:redemptions` | Local; lectura de `app.js` y migración, sin API/DB | Una ejecución | Concedida | PASS: 16 invariantes |
| `npm run build` | Local; regenera `dist/` y `dist-onboarding/`, sin API/DB | Una ejecución | Concedida | PASS; warning no bloqueante de config clásico |
| `npm run audit:ui` | Local; análisis estático | Una ejecución | Concedida | PASS: 153 botones/controlados |
| `npm run smoke:ui` | Servidor aislado `127.0.0.1:4178`, navegador local y `VITE_DISABLE_REMOTE=true`; comprueba `remoteDisabled`/`hasSupabase` | Ejecución acotada; listener cerrado al finalizar; sin red externa ni datos reales | Manifiesto local aprobado | PASS completo; la inicialización sin Supabase marca `loaded=true` y no entra en el bucle de microtareas |
| `npm run check:supabase` y comprobaciones de onboarding/cliente/live-sync | Local; algunas pueden consultar o escribir según script, por confirmar antes de ejecutar | Leer el script y declarar servicios/volumen/limpieza; detener al primer fallo | **No concedida** | No ejecutadas |
| Aplicar migración auditada en Supabase | Escritura de esquema, funciones y RLS; sin Storage | Proyecto Sumi verificado; una ejecución mediante Management API; transacción `BEGIN/COMMIT`; postflight sólo lectura | Concedida por el usuario para continuar sin reconfirmaciones rutinarias | PASS: 2 canjes y 2 eventos, cobertura completa; 0 grants inseguros, duplicados, estados inválidos, cruces de tenant o claves reservadas |
| Actualizar Graphify | Escritura local de grafo/cache; costo de tokens | Declarar archivos incluidos, temporales, retención y costo estimado; no indexar secretos | Requiere manifiesto si vuelve a ejecutarse | Estado actual preservado; no relanzado |
| Deploy Vercel / conectar DNS Hostinger | Mutaciones externas y publicación | Proyecto `sumi`, root `.`, Vite/build `dist`, cuatro variables públicas; no borrar Lovable | Usuario autorizó continuar; DNS y retirada permanecen separados | Vercel PASS: `Ready`, HTTP 200, HTTPS y headers; DNS/Hostinger no modificado |

## Evidencias y entrega

- **Informes:** [brief de analítica](docs/ANALYTICS_BRIEF.md), [propuesta de portabilidad](docs/BUSINESS_PORTABILITY.md), [arquitectura del centro de mando freelance](docs/FREELANCE_COMMAND_CENTER.md), `ADMIN_PANEL.md`, `graphify-out/GRAPH_REPORT.md`.
- **Despliegue:** proyecto Vercel `sumi` creado desde el commit aprobado. `sumi-pearl.vercel.app` está `Ready`, responde 200 con HTTPS/headers correctos y renderiza el menú sin errores de consola. `sumi.business` aún no apunta a Vercel.
- **Grafo y salud:** `graphify-out/graph.json`, `graphify-out/GRAPH_HEALTH.json`, `graphify-out/manifest.json`, `graphify-out/cost.json`, `graphify-out/graph.html`.
- **Supabase:** proyecto remoto Sumi confirmado por CLI. `20260824000100_audited_reward_redemptions.sql` se aplicó transaccionalmente mediante Management API. El postflight agregado confirmó cuatro columnas, constraints, índices, triggers, RLS y RPC; 2/2 canjes tienen evento de auditoría y no existen grants directos inseguros.
- **Pruebas:** `audit:ui` (153) y `audit:redemptions` (16) pasan; build principal/onboarding pasa; smoke aislado completo pasa con Supabase desactivado. Identidad, preflight, apply transaccional y postflight remoto de Supabase están verificados.
- **Riesgos residuales:** los dos eventos históricos tienen rol `unknown` porque preceden al nuevo registro de identidad; los eventos futuros capturan actor/rol. El proyecto Vercel final todavía no está confirmado/importado, no hay preview ni deployment ID de Sumi, las variables por entorno no están verificadas, DNS no cambió y Lovable no se retiró; persisten cambios ajenos de skills/`graphify-out/` que deben quedar fuera del commit.
- **Recomendación de entrega:** publicar la evidencia final en GitHub y seguir el runbook: importación Vercel root `.`, build/preview/logs, variables sin `service-role`, dominio con registros exactos y TTL, validación HTTPS/QR/Auth, registro de deployment/rollback y sólo después la decisión destructiva sobre Lovable. El root debe actualizar el objetivo oficial; el `documenter` no lo crea ni lo modifica.
