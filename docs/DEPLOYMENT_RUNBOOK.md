# Runbook de despliegue recuperable — Sumi

> Estado del documento: procedimiento aprobado para revisión; no ejecutado en
> este checkpoint. El agente raíz coordina las mutaciones externas y obtiene
> las aprobaciones necesarias. No contiene secretos ni valores de `.env`.

## Objetivo y límites

Publicar Sumi desde el repositorio aprobado en Vercel, verificar primero un
preview recuperable y conectar `sumi.business` sólo con los registros exactos
que Vercel muestre para ese proyecto. Lovable se conserva durante todo el
cutover y sólo puede retirarse después de una confirmación destructiva final.

Este runbook cubre el sitio Sumi en la raíz del repositorio. `scripts/build.mjs`
genera `dist` para el sitio principal y `dist-onboarding` para el artefacto de
onboarding; `vercel.json` declara `dist` como salida de este despliegue.

## Baseline público read-only y rollback

La siguiente fotografía pública fue verificada el 2026-08-24 antes de cualquier
mutación. Es una referencia de estado anterior y rollback, no una configuración
objetivo ni una instrucción para copiar estos valores al destino final:

| Elemento | Observación pública | Uso |
|---|---|---|
| Apex `sumi.business` | Registro `A` → `147.93.37.70`; TTL `1800` | Baseline/rollback; no asumirlo como destino Vercel |
| `www.sumi.business` | `CNAME` → `sumi.business`; TTL `300` | Baseline/rollback; no asumirlo como destino Vercel |
| Nameservers | `horizon.dns-parking.com` y `orbit.dns-parking.com`; TTL aproximado `86400` | Referencia; no sustituir nameservers completos |
| Registros adicionales | No se observaron `MX`, `TXT` ni `CAA` públicos en esta consulta | No inferir ausencia definitiva; volver a verificar antes del cutover |
| HTTPS | Respuesta `200`; título `Sumi Menu Admin`; servidor `LiteSpeed` | Baseline de producción actual |
| Cabeceras | CSP sólo `upgrade-insecure-requests`; no se observó HSTS ni `Cache-Control` | Baseline de respuesta actual, no objetivo de seguridad |
| Bundle servido | `assets/index-DqzCP29E.js` (`359320` bytes); no contiene `manage_reward_redemption_status_v2` ni `employee-workspace` | Evidencia de que producción sirve la versión anterior al flujo local auditado |

La verificación fue pública y read-only: no se ingresó a Hostinger ni se
modificó ningún registro DNS. No se registran hashes ni se infiere un proveedor
adicional. Si se realiza el cutover, debe limitarse a los registros web exactos
que entregue el proyecto Vercel final; no se deben cambiar los nameservers
completos ni alterar registros no relacionados por inferencia.

## Puertas previas

- [ ] El root/usuario aprobó el commit exacto y el push que se va a desplegar.
- [ ] El diff fue revisado; no se despliega un árbol sucio ni archivos de otro cliente.
- [ ] El destino Supabase, su URL y su project ref fueron reconciliados con Sumi.
- [ ] Las variables de Vercel se cargarán por entorno y sin `service_role`, claves secretas, cookies ni credenciales en el bundle.
- [ ] Existe un despliegue conocido como recuperación y se conservará su ID/URL.
- [ ] El dominio de Hostinger y el proyecto `sumi.business` fueron confirmados; no se modifica DNS por inferencia.

El `.env` local se preserva para el entorno local, pero fue retirado del
tracking; `.gitignore` excluye `.env`, `.env.local` y `.env.*.local`. El archivo
`.env.example` existe y contiene sólo placeholders para las variables públicas
esperadas. Nunca se copia `.env` a Vercel ni se imprime su contenido.

## Secuencia oficial

### 1. Congelar el artefacto

1. Registrar commit, rama, remoto y aprobación en el ledger.
2. Importar en Vercel el repositorio GitHub aprobado
   (`N1ckas1o/scan-and-earn-buddy`) y seleccionar la rama/commit aprobado.
3. Configurar el proyecto con:

   | Ajuste | Valor obligatorio |
   |---|---|
   | Root Directory | `.` |
   | Framework Preset | `Vite` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |

   Estos valores coinciden con `vercel.json`. No seleccionar
   `dist-onboarding` para el sitio principal.

### 2. Configurar variables por entorno

Crear las cuatro variables en **Preview** y **Production**, con los valores
del proyecto Sumi reconciliado:

| Variable | Preview | Production |
|---|---|---|
| `VITE_SUPABASE_URL` | URL HTTPS del Supabase Sumi aprobado | La misma URL HTTPS aprobada |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key pública aprobada | La misma key pública aprobada |
| `VITE_SUPABASE_PROJECT_ID` | Project ref reconciliado | El mismo project ref reconciliado |
| `VITE_PUBLIC_APP_URL` | URL exacta del preview Vercel | `https://sumi.business/` tras verificar el dominio |

No crear variables `service-role`, `SUPABASE_SERVICE_ROLE_KEY` ni equivalentes
en Vercel. Si un valor no coincide con el proyecto Sumi, detener el despliegue
y resolver la discrepancia antes de guardar o promover.

### 3. Crear y revisar el preview

1. Crear un deployment Preview desde el commit aprobado.
2. Registrar deployment ID, URL, rama/commit, hora y entorno.
3. Revisar los build logs y runtime logs de Vercel; detenerse ante fallos de
   instalación, build, variables, rutas o errores de runtime.
4. Verificar en el preview, sin usar datos reales innecesarios:

   - menú público, tenant Sumi y URL base correctos;
   - ausencia de secretos en HTML, assets, logs y variables expuestas;
   - QR de menú y QR de cliente/empleado con destino esperado;
   - Auth: inicio de sesión, sesión persistente, cierre de sesión y separación
     de roles, según fixtures/autorización disponibles;
   - enlaces, assets y rutas sin 404 ni redirecciones inesperadas.

   La verificación del preview es una puerta: no cambiar Hostinger ni retirar
   Lovable si no está documentada y aprobada.

### 4. Añadir el dominio en Vercel

1. En el proyecto correcto de Vercel, agregar exactamente `sumi.business`.
2. Copiar los registros DNS que Vercel muestre para ese dominio y deployment.
3. Registrar tipo, nombre, valor, TTL solicitado, fecha y captura/evidencia.
4. No adivinar registros A/CNAME/ALIAS, no usar valores de otro proyecto y no
   borrar registros no relacionados.

El proyecto externo actualmente observado como `sumi-onboarding` y su dominio
`onboarding.sumi.business` no sustituyen este objetivo; el root debe confirmar
el proyecto final antes de agregar el dominio.

### 5. Cambiar Hostinger sólo después del preview

1. Tratar el baseline público anterior como referencia de rollback, no como configuración objetivo. Una vez autorizado el cambio, confirmar dentro de Hostinger los registros actuales y su TTL; la verificación pública anterior no sustituye esa confirmación.
2. Reducir el TTL del registro que se va a cambiar al valor mínimo razonable y
   aprobado por el operador, registrando el valor anterior y el nuevo.
3. Aplicar únicamente los registros web exactos entregados por Vercel para
   `sumi.business`; preservar los nameservers completos y todos los registros
   no relacionados.
4. Esperar la propagación necesaria y comprobar el estado del dominio en Vercel.

No hacer cambios DNS antes de que el preview esté verificado. El dominio
confirmado es `sumi.business`; no tocar otro dominio por similitud de nombre.

### 6. Validar producción y conservar evidencia

Cuando Vercel indique el dominio listo:

- validar HTTPS, certificado, redirección HTTP→HTTPS y ausencia de mixed content;
- cargar menú, rutas, assets y QR desde `https://sumi.business/`;
- repetir la comprobación autorizada de Auth y separación de roles;
- revisar los logs del deployment y registrar cualquier warning aceptado;
- registrar deployment ID, URL de preview, URL de producción, commit, variables
  por nombre (nunca valores), registros DNS y TTL antes/después;
- conservar el deployment previo conocido como rollback.

## Rollback

### Rollback de deployment

1. Detener la promoción o publicación si el preview/build falla.
2. Promover o restaurar el deployment Vercel conocido como bueno y registrar su
   ID; no reescribir ni borrar el historial Git.
3. Si el problema es una variable, corregir el entorno correspondiente y
   volver a desplegar el commit aprobado; no sustituir una key pública por una
   service-role.
4. Revalidar preview, logs y dominio antes de cualquier nueva promoción.

### Rollback de dominio

1. Si producción falla tras el cambio DNS, restaurar en Hostinger los registros
   web exactos y el TTL previamente documentados; el baseline read-only de esta
   sección sirve como referencia anterior, sujeto a confirmación autoritativa.
2. Mantener el deployment anterior y Lovable disponibles mientras se propaga
   el rollback; registrar timestamps y estado observado.
3. No borrar el dominio de Vercel ni el proyecto anterior hasta que el root y el
   usuario confirmen que la recuperación quedó estable.

## Retirada de Lovable

Lovable se conserva durante preview, cutover, validación HTTPS/QR/Auth y el
período de observación acordado. Sólo se puede retirar cuando:

- producción en Vercel y `sumi.business` están verificados;
- deployment ID, DNS, rollback y URL recuperable están registrados;
- el root presenta la acción concreta y obtiene confirmación destructiva final
  del usuario en ese momento.

Sin esa confirmación, el estado correcto es “Lovable conservado”.

## Registro de entrega

Completar después de una ejecución autorizada:

| Campo | Valor |
|---|---|
| Commit aprobado / rama | Pendiente |
| Proyecto Vercel / root | Pendiente / `.` |
| Preview URL / deployment ID | Pendiente |
| Production URL / dominio | Pendiente / `https://sumi.business/` |
| Baseline público read-only / rollback | Apex A `147.93.37.70` TTL `1800`; WWW CNAME `sumi.business` TTL `300`; nameservers observados `horizon.dns-parking.com`/`orbit.dns-parking.com` (~`86400`) |
| Variables presentes | Cuatro nombres requeridos; valores no se registran |
| Registros Vercel → Hostinger | Pendiente; copiar exactamente |
| TTL anterior / nuevo | Pendiente |
| HTTPS, QR y Auth | Pendiente de validación autorizada |
| Deployment de rollback | Pendiente |
| Estado de Lovable | Conservado hasta confirmación destructiva |
| Operador, fecha y aprobación | Pendiente |

## Fuentes oficiales

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel environments](https://vercel.com/docs/deployments/environments)
