# Brief de analítica gastronómica

**Estado:** borrador para revisión

**Fecha:** 24 de agosto de 2026

**Producto:** Sumi

## Decisión recomendada

Crear una sección independiente llamada **Estadísticas** y mantener **Inicio** como resumen operativo. El primer lanzamiento debe presentarse como inteligencia sobre **consumos registrados en Sumi**, no como analítica completa de ventas.

Sumi ya puede calcular platos más cargados, demanda por horario, ticket promedio, recurrencia y uso de premios. Sin embargo, hoy sólo registra consumos asociados a una cuenta de fidelización. No incluye ventas anónimas ni tiene todavía un ledger de pedidos conectado a un POS.

## Objetivo del MVP

Dar al dueño respuestas rápidas a cinco preguntas:

1. ¿Cuánto consumo registró el negocio en el período?
2. ¿Qué platos se cargaron más?
3. ¿En qué días y horarios hubo más actividad?
4. ¿Qué clientes regresan y cuáles están en riesgo?
5. ¿Cómo está funcionando la fidelización?

## Alcance funcional

### Controles comunes

- Período: Hoy, 7, 30 y 90 días, más rango personalizado.
- Comparación contra el período anterior equivalente.
- Zona horaria y moneda configurables por negocio.
- Aviso persistente: **“Basado en consumos registrados en Sumi”**.
- Fecha de última actualización y acción para actualizar.

### Resumen

| Indicador | Definición para el MVP |
|---|---|
| Consumo registrado | Suma de `purchase_total` en consumos confirmados o corregidos |
| Operaciones | Cantidad de consumos confirmados o corregidos |
| Ticket promedio | Consumo registrado / operaciones |
| Clientes compradores | Clientes distintos con al menos un consumo válido |
| Variación | Cambio porcentual respecto del período anterior |

### Productos

- Ranking de platos por unidades registradas.
- Separación por presentación cuando corresponda.
- Categoría y participación sobre el total itemizado.
- Indicador de **cobertura de itemización**: consumos con al menos un ítem / consumos válidos.
- No usar likes como señal comercial: Sumi permite ajustes manuales de likes y mezclar ambos valores distorsionaría la lectura.

### Horarios

- Heatmap por día de la semana y hora.
- Pico principal y segunda franja más activa.
- Comparación entre días laborables y fin de semana.
- En el MVP, el horario representa el momento de registro. Para medir consumo real debe añadirse `occurred_at` separado de `created_at`.

### Clientes

- Nuevos, activos, repetidores y en riesgo.
- Tasa de repetición: clientes con dos o más consumos / clientes con al menos uno en el período.
- Frecuencia media y días desde la última visita.
- Ticket promedio por cliente activo.
- Acceso desde el segmento a la lista de Clientes, sin exponer PII en los agregados.

### Fidelización

- Puntos emitidos, canjeados y saldo pendiente.
- Solicitudes de premio por estado: solicitada, aprobada, entregada y cancelada.
- Tasa de canje entregado calculada sobre cohortes maduras.
- Premios más solicitados y clientes con puntos próximos a vencer, si se incorpora vencimiento.

## Correcciones necesarias antes del MVP

1. Excluir consumos `cancelled` de Inicio, rankings e importes. Actualmente algunas pantallas los incluyen y otras no.
2. Retirar o renombrar la “conversión” actual. Hoy divide unidades históricas por vistas históricas sin atribución por sesión, pedido o ventana y puede superar el 100%.
3. Alinear todas las métricas a la misma ventana temporal.
4. Mostrar claramente la cobertura de datos y evitar llamar “ventas” o “facturación” a consumos de fidelización.
5. Unificar zona horaria y moneda. Parte del código usa horario local, otra parte UTC, y el formato monetario está fijado a MXN.
6. Evitar cálculos globales sobre lotes truncados. El dashboard actual limita clientes y eventos antes de calcular estadísticas.

## Propuesta técnica para Supabase

### MVP

- Añadir `timezone` IANA y `currency` a la configuración del negocio.
- Añadir `occurred_at` a los consumos, conservando `created_at` como fecha de registro técnico.
- Crear el RPC `get_business_analytics(business_id, from, to)` que devuelva sólo agregados, comparación y cobertura.
- Calcular filtros y KPIs en la base de datos, no descargando perfiles y miles de eventos al navegador.
- Añadir índices por negocio, estado y fecha para compras y eventos de menú.
- Incorporar timestamps de transición para canjes o una tabla de historial de estados.

El Realtime actual de Sumi escucha únicamente `reward_redemptions`; el resto del panel se refresca mediante recarga y sondeo periódico. Para Estadísticas conviene actualizar al cambiar de rango, bajo demanda y ante eventos relevantes, con rollups horarios o diarios cuando crezca el volumen.

### Analítica completa de ventas

Para prometer ventas, margen y ticket real debe existir un ledger separado de fidelización:

- `orders`: negocio, cliente opcional, origen/POS, estado, canal, local, moneda, subtotal, descuentos, impuestos, propina, total, comensales y `occurred_at`.
- `order_items`: plato, presentación, snapshots de nombre/categoría, cantidad, precio unitario, descuento, total neto y costo opcional.
- `point_events.order_id`: vínculo entre la venta y los puntos sin convertir el ledger de puntos en un sistema de pedidos.
- `external_order_id` idempotente para importaciones desde POS o API.

Esto habilita ventas anónimas, ingresos por plato, margen, canal, salón/delivery y cobertura real del negocio.

## Integridad y privacidad

- Validar eventos de menú mediante RPC o Edge Function, rate limiting e idempotencia. Hoy un visitante anónimo puede contaminar métricas enviando eventos repetidos.
- Excluir tráfico de staff, previews, bots y pruebas.
- Mantener el identificador de sesión pseudónimo, rotativo y con retención limitada.
- Entregar agregados a Estadísticas; el detalle identificable debe permanecer en Clientes.
- Para alto volumen, generar rollups horarios/diarios en lugar de expandir JSON de ítems en cada consulta.

## Fases sugeridas

### Fase 0 — Veracidad

- Corregir estados, ventanas, zona horaria y nombre de métricas.
- Mostrar cobertura y retirar la conversión no atribuida.

### Fase 1 — MVP

- Nueva navegación Estadísticas.
- Resumen, productos, heatmap, clientes y fidelización.
- RPC agregado por rango y comparación con período anterior.

### Fase 2 — Pedidos/POS

- Ledger de pedidos e ítems, ventas anónimas e integración POS.
- Ingresos, canal, descuentos, impuestos, costos y margen.

### Fase 3 — Avanzado

- Cohortes 30/60/90, RFM, LTV, popularidad frente a rentabilidad, predicción de demanda y comparación entre locales.

## Criterios de aceptación del MVP

- Ningún KPI incluye consumos cancelados.
- Todos los widgets respetan el mismo período, zona horaria y moneda.
- Cada importe se identifica como consumo registrado.
- Ranking y cobertura se pueden reconciliar con el detalle de Consumos.
- No se transmite PII para construir tarjetas agregadas.
- La comparación con el período anterior es reproducible.
- La pantalla funciona en móvil sin depender de tablas horizontales para la lectura principal.

## Decisiones para revisión

1. ¿Sumi seguirá dependiendo de consumos cargados manualmente durante el MVP o se prioriza una integración POS?
2. ¿El ticket representa una operación, una mesa o un comensal? Hoy sólo puede representar una operación registrada.
3. ¿Qué zona horaria y moneda deben ser los valores iniciales por negocio?
4. ¿Se necesita separar salón, take-away y delivery desde la primera versión?
5. ¿Qué retención de eventos y sesiones es aceptable para el negocio?

## Referencias de producto

- [Square Dashboard Analytics](https://squareup.com/us/en/point-of-sale/features/dashboard/analytics)
- [Square for Restaurants: reporting](https://squareup.com/us/en/point-of-sale/restaurants/pricing)
- [Square: revisión de ventas diarias](https://squareup.com/help/us/en/article/8579-review-daily-sales-for-your-restaurant)
- [Lightspeed: Menu Reports](https://k-series-support.lightspeedhq.com/hc/en-us/articles/18235324645531-Menu-Reports)
