# Setup de una instancia Sumi para cliente

Objetivo: adaptar la plantilla sin mezclar datos demo con datos reales.

## 1. Preparar configuracion

1. Copiar `business.config.example.json` como `business.config.json`.
2. Completar datos desde `docs/client-onboarding-form.md`.
3. Definir `publicAppUrl`, por ejemplo `https://sumi.business/` o `https://cliente.com/`.
4. Revisar `qr.defaultUse`, `qr.defaultGoal`, `qr.defaultTone`, `qr.defaultStyle`,
   `qr.defaultColor` y `qr.defaultCta` para que el primer poster impreso salga
   con la tematica correcta.
5. Revisar si faltan datos operativos antes de generar archivos:

   ```powershell
   npm run check:client -- --config business.config.json
   ```

   El comando falla si faltan datos bloqueantes como owner, URL publica, flags,
   idiomas, reglas de puntos o creditos IA. Las advertencias no bloquean, pero
   conviene resolverlas antes de entregar una instancia real.

6. Validar la configuracion generada:

   ```powershell
   npm run prepare:client -- --config business.config.json --dry-run
   ```

7. Generar archivos iniciales:

   ```powershell
   npm run prepare:client -- --config business.config.json
   ```

8. Verificar que la instancia generada esta lista para migraciones/deploy:

   ```powershell
   npm run check:client:e2e -- --config business.config.json
   ```

   Este chequeo confirma que existen `businesses/<business-id>/config.js`,
   `supabase/seed.client.generated.sql`, migraciones clave, URL publica y
   variables `.env` esperadas. Para validar la plantilla demo sin bloquear por
   placeholders:

   ```powershell
   npm run check:client:e2e -- --config business.config.example.json --allow-template
   ```

9. Verificar que canjes en vivo tienen Realtime y polling de respaldo:

   ```powershell
   npm run check:live-sync
   ```

   Esta compuerta revisa que `reward_redemptions` este en la migracion de
   Realtime, que el frontend escuche cambios de Supabase y que conserve el
   polling fallback para proyectos donde Realtime demore o no este habilitado.

El comando crea `businesses/<business-id>/config.js` y
`supabase/seed.client.generated.sql`. Revisar ambos antes de publicar.

## 2. Base de datos

Modelo recomendado para primeros clientes: un proyecto Supabase por cliente.

Motivo: en esta etapa Sumi funciona mejor como kit personalizado que como SaaS
autoservicio. Separar proyectos reduce el riesgo de mezclar datos, simplifica
soporte y permite borrar, pausar o migrar un cliente sin afectar a otros.

Estructura esperada:

- `supabase/migrations`: estructura limpia.
- `supabase/seed.client.sql`: datos iniciales reales del cliente.
- `supabase/seed.demo.sql`: datos demo separados.

Reglas:

- No ejecutar `supabase/seed.demo.sql` en proyectos reales.
- No copiar datos de una instancia de prueba a una instancia de cliente.
- Todo dato visible del negocio debe venir de `business.config.json`,
  `businesses/<business-id>/config.js` o tablas del proyecto del cliente.
- Si un SQL fue generado, revisarlo antes de correrlo en Supabase.

Pasos:

1. Crear proyecto Supabase del cliente desde la cuenta operativa de Sumi.
2. Configurar Auth URLs con el dominio publico.
3. Ejecutar migraciones.
4. Ejecutar `supabase/seed.client.generated.sql` o mover su contenido revisado a `supabase/seed.client.sql`.
5. Crear usuario owner.
6. Crear usuarios employee iniciales, si el negocio los necesita.
7. Agregar owner y employees a `business_admins` usando el bloque generado en
   `supabase/seed.client.generated.sql`.
8. Verificar RLS con una cuenta cliente, una cuenta employee y una cuenta owner.

## 3. Variables

Configurar:

```env
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<publishable-key>"
VITE_PUBLIC_APP_URL="https://tu-dominio.com/"
```

El QR impreso debe apuntar al dominio raiz, no a una ruta interna con hash.
`VITE_PUBLIC_APP_URL` tiene prioridad en produccion. Si no esta definido, la app
usa `publicAppUrl` o `qr.defaultTarget` del config generado para mantener QRs
validos en entornos de prueba.

## 4. Checklist funcional

- Cliente se registra.
- Cliente ve puntos, QR y premios.
- Empleado escanea QR.
- Empleado carga consumo manual.
- Employee no puede entrar al admin completo, pero si puede operar consumos y
  canjes.
- Employee no puede cargar consumos por encima de los limites definidos en
  `operations.staffSecurity`.
- El detalle de un consumo muestra rol, revision staff y acumulados diarios.
- Canje queda pendiente.
- Empleado aprueba/rechaza canje.
- Solicitar dos veces el mismo premio deja una sola solicitud pendiente.
- Una solicitud vencida no se puede aprobar; el cliente debe pedirla de nuevo.
- Con el panel owner abierto, crear un canje desde otra sesion y confirmar que
  aparece solo en `Necesita atencion` sin recargar la pagina.
- Owner edita reglas de fidelizacion.
- Owner cambia umbrales de niveles y una cuenta existente recalcula su nivel.
- Owner ajusta puntos manualmente desde la ficha de cliente y el movimiento
  queda auditado en `point_events`.
- Owner crea, pausa y elimina premios, incluyendo imagen opcional si el cliente
  la provee.
- Premios con nivel minimo se bloquean en Supabase si el cliente no alcanzo ese
  nivel, aunque tenga puntos suficientes.
- Racha semanal acredita bonus solo una vez por semana si `bonusPoints` > 0.
- Cancelar un consumo revierte tambien el bonus de racha ligado a ese consumo.
- Consumo, canje, cancelacion y ajuste manual devuelven el nivel segun los
  umbrales configurados para el negocio.
- QR de negocio descarga PNG y PDF.
- Biblioteca tiene contraste legible.

## 5. Credenciales y costos

Para primeros clientes, Sumi gestiona infraestructura y APIs.

No pedir al cliente:

- Cuenta Supabase.
- API keys de IA.
- Secretos de hosting.

La mensualidad debe incluir limites claros:

- Hosting.
- Base de datos.
- Soporte basico.
- Generaciones de contenido incluidas.
- Creditos mensuales de IA.

Si supera el limite, vender creditos extra o plan superior.

Configurar esos limites en `business.config.json`:

```json
{
  "aiCredits": {
    "planName": "Plan base",
    "monthlyLimit": 150,
    "generationCreditCost": 2,
    "lowBalanceWarningThreshold": 20
  }
}
```

`npm run prepare:client` copia esos valores al frontend y al seed de
`business_ai_settings`. La Edge Function usa esa tabla para descontar creditos.
El admin muestra uso mensual, creditos restantes, generaciones disponibles y el
ultimo movimiento para que el owner entienda el costo antes de generar.

Politica recomendada para venderlo:

- Plan inicial: 60 creditos/mes.
- Plan base: 150 creditos/mes.
- Plan pro: 400 creditos/mes.
- Cada pieza de contenido o mejora de foto de producto consume
  `generationCreditCost`.
- Descargar, conservar, editar textos o subir referencias no consume creditos.
- Al quedarse sin saldo, la UI bloquea nuevas generaciones y el backend vuelve a
  validar con `insufficient_credits`.

## 6. Entrega y operacion

Antes de entregar:

- Confirmar dominio publico y que `VITE_PUBLIC_APP_URL` coincide con los QRs.
- Probar registro, consumo, canje y edicion de premios con datos reales chicos.
- Crear al menos una cuenta owner y, si aplica, una cuenta employee.
- Confirmar que el owner no ve datos demo.
- Descargar un QR PNG y PDF de prueba.
- Documentar limites incluidos: generaciones IA, soporte, almacenamiento y
  volumen razonable de clientes/consumos.

Operacion mensual recomendada:

- Revisar costos de Supabase, hosting e IA.
- Revisar errores de Edge Functions.
- Revisar cantidad de generaciones IA usadas.
- Mantener backup/export del proyecto antes de cambios importantes.
- Registrar cambios de reglas de puntos, premios o migraciones aplicadas.
