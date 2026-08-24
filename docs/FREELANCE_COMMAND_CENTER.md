# Centro de mando freelance reusable

**Estado:** arquitectura aprobable, implementación pendiente

**Fecha:** 24 de agosto de 2026

## Objetivo

Mantener en local un registro único de clientes y proyectos que permita a Codex
y a sus subagentes conocer el brief, el estado, los enlaces operativos y los
criterios de aceptación sin recibir contraseñas, tokens, cookies ni secretos.

El centro de mando no es un almacén de credenciales. Conserva referencias y
alias; las operaciones privilegiadas las ejecuta el agente principal mediante
sesiones ya autenticadas o credenciales revocables de mínimo privilegio.

## Decisión de arquitectura

- Un repositorio GitHub por cliente para aislar contenido, permisos y deploys.
- Un repositorio privado independiente para el centro de mando.
- Astro para la interfaz y Content Collections para registros tipados.
- Keystatic en modo local para el primer MVP local.
- Keystatic GitHub mode sólo cuando los editores tengan acceso al repositorio.
- Keystatic Cloud o un portal propio si un cliente sin GitHub necesita editar.
- Vercel Preview para revisión y Production sólo después de aprobación.
- Un proyecto Supabase por negocio durante la etapa inicial de Sumi.

Keystatic GitHub mode no debe presentarse como un login arbitrario por email y
contraseña: el acceso se basa en GitHub. Keystatic Cloud tiene un modelo de
acceso por equipo que debe evaluarse antes de alojar varios clientes.

## Componentes

```text
Centro local Astro + Keystatic
        |
        | fichas, context packs y alias sin secretos
        v
Agente principal ----> broker allowlisted ----> GitHub / Vercel / Supabase
        |
        +----> subagentes con contexto redactado y acciones no privilegiadas
```

### Ficha de proyecto

Cada ficha incluye:

- cliente, contacto operativo y `businessId`;
- repositorio, rama productiva y versión de esquema;
- proyecto Vercel, preview y dominio productivo;
- proyecto Supabase y enlaces de consola;
- panel de contenido;
- estado: `intake`, `building`, `preview`, `live`, `maintenance` o `archived`;
- brief, reglas, referencias visuales y criterios de aceptación;
- riesgos, tareas abiertas, último deploy y última entrega;
- alias y estado de credenciales, nunca sus valores;
- timeline de auditoría redactado.

### Context pack para agentes

Un subagente recibe únicamente:

- identificador del proyecto;
- brief vigente y criterios de aceptación;
- matriz de roles y límites por tenant;
- rutas o archivos conocidos;
- referencias de servicios no secretas;
- restricciones, propietario de archivos y condición de parada.

Todo contenido aportado por un cliente se trata como dato no confiable y no
puede ampliar permisos ni autorizar herramientas.

## Esquema mínimo

```ts
type Client = {
  id: string;
  displayName: string;
  legalName?: string;
  ownerEmail?: string;
  status: "lead" | "onboarding" | "active" | "paused" | "archived";
};

type Project = {
  id: string;
  clientId: string;
  businessId: string;
  repo: { host: "github"; owner: string; name: string; defaultBranch: string };
  vercel: { projectId?: string; productionDomain?: string };
  supabase: { projectRef?: string };
  contextPackPath: string;
  status: "intake" | "building" | "preview" | "live" | "maintenance" | "archived";
  schemaVersion: string;
};

type CredentialRef = {
  alias: string;
  projectId: string;
  provider: "github" | "vercel" | "supabase" | "browser";
  storage: "windows-credential-manager" | "remote-provider-secret";
  scope: string[];
  expiresAt?: string;
  status: "active" | "pending-rotation" | "revoked";
  lastRotatedAt?: string;
  secretValue: never;
};

type AgentRun = {
  id: string;
  projectId: string;
  actor: "primary" | "subagent";
  operation: string;
  approvalId?: string;
  result: "success" | "failed" | "denied";
  redactedSummary: string;
};
```

La regla `secretValue: never` debe existir también en los validadores y en la
revisión de código.

## Política de credenciales

### Prohibido

- Guardar secretos en Git, JSON, Markdown, prompts, logs o clipboard persistente.
- Entregar `.env`, tokens, contraseñas, cookies o connection strings a subagentes.
- Extraer cookies o perfiles de Chrome.
- Ejecutar comandos que impriman tokens.
- Usar almacenamiento inseguro de GitHub CLI.
- Crear una operación genérica que devuelva o imprima secretos.

### Permitido

- Alias como `github.sumi.deploy` o `supabase.sumi.migrations`.
- Windows Credential Manager o un vault compatible con DPAPI.
- Sesiones autenticadas del navegador sin inspeccionar su almacenamiento.
- GitHub App o token fine-grained por repositorio, con caducidad y mínimo alcance.
- Variables secretas gestionadas por el proveedor y separadas por ambiente.

### Broker allowlisted

El broker local recibe proyecto y operación, resuelve el alias internamente,
solicita aprobación, inyecta el secreto sólo al proceso efímero, redacta salida
y guarda auditoría sin valores sensibles.

Operaciones conceptuales:

```text
sumi-ops context show --project <id>
sumi-ops access request --project <id> --operation vercel.deploy
sumi-ops job run --project <id> --operation github.create-pr
sumi-ops credential rotate --project <id> --alias github.content
sumi-ops credential revoke --project <id> --alias vercel.deploy
sumi-ops audit list --project <id>
```

No existe una orden `secret get`, `print-token` ni un ejecutor arbitrario con
todos los secretos.

Límite honesto: un wrapper local no puede aislar por completo secretos de un
agente principal con shell irrestricto y los mismos privilegios del usuario. El
MVP reduce exposición y mejora trazabilidad; operaciones de alto impacto siguen
requiriendo aprobación interactiva o un runner remoto restringido.

## Onboarding y entrega

1. Intake del negocio, identidad, contenido, dominio, roles y criterios.
2. Normalización a un esquema versionado sin datos demo ni secretos.
3. Provisionamiento de repositorio, Vercel y Supabase aislados.
4. Creación del context pack y del ledger compartido.
5. Build Astro con frontera clara entre contenido y código.
6. Preview protegido, revisión interna y revisión del cliente.
7. Merge aprobado y deploy de Production.
8. Handoff con repo, dominio, guía de edición y recuperación.
9. Mantenimiento mediante PRs, auditoría y rotación periódica.

## Fases

### Fase 1 — Registro local de solo lectura

- Clientes, proyectos, enlaces, context packs y auditoría redactada.
- Sin operaciones externas ni secretos.

### Fase 2 — Plantilla reusable

- Astro, colecciones Keystatic, flujo PR → Preview → Production.
- Validadores de tenant, assets, contraste, datos demo y secretos.

### Fase 3 — Broker seguro

- Vault, alias, allowlist, aprobación, redacción, auditoría y revocación.

### Fase 4 — Onboarding y handoff

- Intake versionado, provisionamiento, paquete portable y guías.

### Fase 5 — Monitoreo

- Health checks, Observability, alertas de build/dominio y revisión de permisos.

## Criterios de aceptación

- [ ] Una ficha abre repo, preview, producción, panel y documentación.
- [ ] Ningún registro, export, prompt o log contiene secretos reales.
- [ ] Un subagente trabaja con alias pero no puede resolver ni imprimir secretos.
- [ ] Cada operación privilegiada exige proyecto y aprobación explícitos.
- [ ] GitHub, Vercel y Supabase están separados por proyecto y ambiente.
- [ ] Revocar un alias bloquea nuevas operaciones sin cambiar código.
- [ ] La auditoría registra actor, operación, proyecto, recurso y resultado.
- [ ] Production sólo cambia mediante el flujo aprobado.
- [ ] El handoff permite continuar a otro desarrollador.
- [ ] Se bloquean tenant incorrecto, datos demo y secretos en artefactos.

## Decisiones pendientes

1. Para clientes editores: GitHub mode, Keystatic Cloud o portal propio.
2. Quién puede aprobar Production y cambios de credenciales.
3. Retención de auditoría y tratamiento de PII.
4. Si los primeros clientes reciben repositorios propios desde el inicio.

## Fuentes oficiales

- [Astro: Why Astro](https://docs.astro.build/en/concepts/why-astro/)
- [Astro: Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Keystatic + Astro](https://keystatic.com/docs/installation-astro)
- [Keystatic GitHub mode](https://keystatic.com/docs/github-mode)
- [Keystatic local mode](https://keystatic.com/docs/local-mode)
- [Keystatic Cloud](https://keystatic.com/docs/cloud)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
- [GitHub credential security](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure)
