# Prompt operativo para adaptar Sumi con Codex

Usar este prompt junto con `business.config.example.json` completado.

```text
Adapta esta plantilla Sumi para el negocio <NOMBRE> usando los datos de business.config.json.

Objetivo:
- Mantener la logica base.
- Ejecutar primero npm run check:client -- --config business.config.json y resolver bloqueantes.
- Luego ejecutar npm run prepare:client -- --config business.config.json --dry-run.
- Si el dry-run es correcto, ejecutar npm run prepare:client -- --config business.config.json.
- Actualizar marca, textos visibles, menu, premios, reglas de puntos, QRs e idiomas desde la configuracion generada.
- Mantener creditos de IA desde `aiCredits`, sin hardcodear limites en la UI.
- Eliminar datos demo visibles.
- Dejar la app lista para build y deploy.

Reglas:
- Antes de trabajar, consultar el ledger y el context pack del cliente. Usar
  solo identificadores, URLs publicas, claves publishable y alias de acceso.
- No pedir, copiar ni mostrar contrasenas, tokens, cookies, service-role keys,
  API keys privadas, Auth Hook secrets ni connection strings con password.
- Para acciones privilegiadas, usar una sesion oficial ya autenticada o un
  broker allowlisted de minimo privilegio. El usuario introduce cualquier
  secreto directamente en el proveedor; el agente solo recibe el alias y el
  estado de disponibilidad.
- No hardcodear datos nuevos fuera de la configuracion del negocio salvo que sea inevitable.
- Si algo cambia por cliente, documentarlo.
- Los QR deben apuntar al dominio publico raiz configurado en publicAppUrl, por ejemplo https://sumi.business/ o https://tu-dominio.com/.
- El owner ve Fidelizacion, Clientes, Consumos, QRs, Menu, Contenido y Biblioteca.
- El manager ve Inicio, Clientes, Consumos, Menu y gestion de canjes; no puede
  cambiar configuracion, reglas, contenido ni QRs.
- El employee solo opera carga de consumo y aprobacion de canjes.
- Usar `operations.employeeEmails` para generar membresias employee iniciales
  en `business_admins` cuando esos usuarios ya existan en Auth.
- Usar `operations.managerEmails` para responsables con panel operativo y sin
  permisos de configuracion owner.
- Los clientes no ven panel admin ni tarjetas de staff.

Verificacion:
- Revisar businesses/<business-id>/config.js.
- Revisar supabase/seed.client.generated.sql antes de ejecutarlo.
- Ejecutar npm run build.
- Verificar menu publico.
- Verificar registro/login.
- Verificar QR cliente con logo.
- Verificar carga de consumo.
- Verificar canje pendiente, aprobado y entregado.
- Verificar ABM de premios.
- Verificar descarga de QR del negocio.
```

## Cambios esperados por cliente

- `businesses/<business-id>/config.js`
- assets de marca y productos en `assets/`
- variables `.env`
- `supabase/seed.client.generated.sql` revisado
- Auth redirect URLs en Supabase
- dominio publico

## No modificar salvo necesidad real

- RPCs de consumo/canje.
- RLS base.
- Componentes de admin compartidos.
- Estructura de eventos y puntos.
