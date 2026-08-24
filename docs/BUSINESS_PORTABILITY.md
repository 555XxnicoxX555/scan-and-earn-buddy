# Portabilidad y entrega por negocio

**Estado:** propuesta para revisión

**Fecha:** 24 de agosto de 2026

## Resumen

Sumi ya funciona como una plantilla configurable por negocio, pero la entrega todavía es semiautomática. Hoy se exporta un intake, se convierte manualmente a configuración, se genera un archivo del negocio y un seed de Supabase, y luego se cambia a mano el config cargado por `index.html`.

La recomendación es convertir ese proceso en un build white-label determinista: un esquema canónico, una configuración base neutral, assets aislados y comandos de exportación/importación del estado vivo.

## Qué puede cambiarse hoy

La configuración actual ya contempla:

- Nombre, iniciales, subtítulo y contacto.
- Tres colores base y tema derivado.
- Idiomas y traducciones.
- Menú, presentaciones, precios, premios y reglas de fidelización.
- Roles, límites operativos, QRs y créditos de IA.
- URL pública y datos necesarios para preparar Supabase.

La aplicación consume `window.SUMI_BUSINESS_CONFIG`, y el menú editado en producción se guarda por `business_id` en Supabase.

## Riesgos del flujo actual

### Bloqueantes

- El generador parte de la configuración demo completa de Sumi/Habibi. Un cliente sin catálogo completo puede heredar platos, traducciones o textos demo.
- `index.html` selecciona manualmente el archivo del negocio. El build copia todas las carpetas de negocios y el chequeo no confirma que cargue el tenant correcto.

### Importantes

- `logoPath` se acepta, pero el frontend no lo utiliza; predominan las iniciales.
- El admin, el menú público y los QRs no comparten todavía todos los tokens semánticos de color.
- El intake y la configuración final usan estructuras diferentes y requieren mapeo manual.
- Parte del contenido de marca existe en JSON pero no llega al frontend; quedan textos y hashtags de Habibi hardcodeados.
- No existe un export del estado vivo. Menú, premios y ajustes pueden divergir de los archivos después del lanzamiento.
- Los assets viven en rutas compartidas y pueden colisionar entre negocios.
- Los tests validan principalmente el demo y no bloquean identidad heredada, logo ausente o contraste deficiente.

## Arquitectura objetivo

### 1. Esquema único y versionado

Crear `business.schema.json` y usarlo en onboarding, validación, generador, frontend y CI. El archivo de cada negocio debería declarar `schemaVersion` para permitir migraciones controladas.

### 2. Base neutral

Separar una configuración base sin nombre, productos, traducciones ni promociones de Habibi. Cada negocio debe declarar explícitamente su identidad y catálogo; si falta información, el build debe fallar o usar placeholders neutros.

### 3. Build por tenant

Seleccionar el negocio mediante `SUMI_BUSINESS_ID` y generar un artefacto independiente:

```text
dist/
  <business-id>/
    index.html
    assets/
    business-config.js
    manifest.json
```

El artefacto no debe incluir configuraciones ni assets de otros negocios. `index.html` no debería editarse a mano.

### 4. Assets aislados

```text
businesses/
  <business-id>/
    business.json
    assets/
      brand/
        logo.svg
        icon.png
      menu/
        <dish-id>/
          cover.webp
```

El validador debe comprobar existencia, formato, tamaño, relación de aspecto y referencia de cada archivo.

### 5. Tema semántico compartido

En vez de colorear pantallas por separado, derivar tokens comunes:

- `brand-primary` y `brand-primary-strong`.
- `surface`, `surface-soft` y `canvas`.
- `ink`, `muted` y `line`.
- `success`, `warning`, `danger` e `info`.

Menú, admin, modales, QRs e imágenes generadas deben usar los mismos tokens. El logo real debe tener prioridad sobre las iniciales, con fallback explícito.

### 6. Supabase por cliente

Para la etapa actual conviene mantener un proyecto Supabase separado por negocio: reduce riesgo de fuga entre tenants, simplifica entrega y permite credenciales y backups independientes. La configuración y seeds nunca deben incluir secretos en el repositorio ni en el artefacto público.

## Flujo de entrega propuesto

1. Completar onboarding y exportar un intake validado.
2. Convertir automáticamente el intake al esquema canónico.
3. Incorporar logo, fotos y traducciones en la carpeta aislada del negocio.
4. Ejecutar `check:client` con validación de esquema, identidad, assets, contraste y strings demo.
5. Generar seed/migraciones para el Supabase del cliente.
6. Generar el build específico del tenant.
7. Ejecutar smoke test contra ese build y ese `business_id`.
8. Entregar artefacto, manifest, versión de esquema y reporte de verificación.

## Exportación e importación del estado vivo

Añadir dos operaciones complementarias:

- `export:client`: extrae configuración, menú, presentaciones, premios, reglas, referencias de Storage y versión de migraciones a un paquete portable.
- `import:client`: valida el paquete, previsualiza cambios y los aplica de forma idempotente a una instancia nueva.

El paquete no debe contener contraseñas, tokens, claves de servicio ni PII de clientes por defecto. La migración de clientes e historial debe ser un proceso separado, cifrado y explícitamente autorizado.

## Manifiesto mínimo

```json
{
  "schemaVersion": "1.0.0",
  "businessId": "example-business",
  "appVersion": "...",
  "exportedAt": "...",
  "content": {
    "menuItems": 0,
    "rewards": 0,
    "languages": []
  },
  "assets": [],
  "migrations": []
}
```

## Verificaciones que deben bloquear una entrega

- El build carga un tenant distinto al solicitado.
- Aparecen nombres, platos, hashtags, traducciones o URLs del demo.
- Falta el logo obligatorio o una imagen referenciada.
- Dos negocios comparten una ruta de asset mutable.
- El contraste de texto y controles activos no alcanza el mínimo acordado.
- La configuración, el seed y el build declaran `business_id` distintos.
- Se detecta un secreto o PII dentro del paquete.
- El smoke test no cubre menú público, admin, QR, idioma y edición básica.

## Implementación por etapas

### Etapa 1 — Entrega segura

- Base neutral.
- Selección automática por `SUMI_BUSINESS_ID`.
- Build aislado y bloqueo de strings demo.

### Etapa 2 — Esquema y marca

- JSON Schema único, migraciones de versión, logo real y tokens semánticos.
- Assets por negocio y validación de contraste.

### Etapa 3 — Portabilidad viva

- `export:client` e `import:client`.
- Manifest de assets, configuración, Storage y migraciones.

### Etapa 4 — Operación a escala

- CI por tenant, ambientes separados, backups, monitoreo y documentación de soporte.

## Decisiones para revisión

1. ¿Cada cliente tendrá su propio repositorio o un monorepo con builds aislados?
2. ¿Supabase seguirá siendo independiente por cliente en todos los planes?
3. ¿Qué datos vivos deben entrar en una exportación estándar: sólo configuración o también clientes e historial?
4. ¿El negocio puede editar los colores libremente o se ofrecen paletas validadas?
5. ¿Qué partes deben poder modificarse sin nuevo despliegue?
