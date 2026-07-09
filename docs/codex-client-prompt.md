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
- No hardcodear datos nuevos fuera de la configuracion del negocio salvo que sea inevitable.
- Si algo cambia por cliente, documentarlo.
- Los QR deben apuntar al dominio publico raiz configurado en publicAppUrl, por ejemplo https://sumi.business/ o https://tu-dominio.com/.
- El owner ve Fidelizacion, Clientes, Consumos, QRs, Menu, Contenido y Biblioteca.
- El employee solo opera carga de consumo y aprobacion de canjes.
- Usar `operations.employeeEmails` para generar membresias employee iniciales
  en `business_admins` cuando esos usuarios ya existan en Auth.
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
