# Revision inicial - Sumi Gastronomia

## Skills utiles para este proyecto

- `discord-project-context`: util para mantener este canal como workspace del proyecto y recordar decisiones/archivos por canal.
- `business-plan`: util para convertir la idea en una estructura de negocio defendible: problema, solucion, mercado, operaciones, ingresos, riesgos y resumen ejecutivo.
- `loyalty-modeling`: muy util porque Sumi es un sistema de fidelizacion. Sirve para modelar puntos, canjes, costo de recompensas, retencion y ROI para el local.
- `document-xlsx`: util para auditar y mejorar la planilla Excel con supuestos, formulas, validaciones y escenarios.
- `financial-modeling`: util para revisar proyecciones, punto de equilibrio, escenarios conservador/base/optimista y coherencia de margenes.
- `powerpoint`: util para auditar o rehacer la presentacion con mejor narrativa y layout.

## Archivos revisados

- `source/Sumi_Costos_Consolidado.xlsx`
- `source/Sumi_Presentacion_Consolidado.pptx`
- `source/brief-original.txt`

## Lectura de la planilla

### Resumen

- Precio implementacion: USD 800 / ARS 1.149.600
- Margen implementacion: USD 540,82 / ARS 777.160
- Mantenimiento mensual: USD 100 / ARS 143.700
- Margen mensual por cliente: USD 99,60 / ARS 143.129,32
- Costos fijos mensuales: USD 1.495 / ARS 2.148.315
- Clientes necesarios para cubrir fijos: 15 segun la planilla
- Ganancia acumulada 12 meses: USD 37.359,45 / ARS 53.685.535,82

### Costos

Costos variables iniciales:

- Acrilicos con QR: USD 139,18
- Dominio anual: USD 4,00
- Hosting mensual: USD 0,06
- Comision del vendedor: USD 120,00

Costos fijos mensuales:

- Desarrollador: USD 800
- Disenador: USD 500
- Marketing / administracion: USD 150
- Herramientas de software: USD 45

### Proyeccion

- Mes 1: 3 clientes, ganancia mensual USD 426,27
- Mes 4: 15 clientes, ganancia mensual USD 2.162,33
- Mes 12: 47 clientes, ganancia mensual USD 5.349,62
- Acumulado 12 meses: USD 37.359,45

## Observaciones importantes

1. La proyeccion parece calculada con esta logica:

   Ganancia mensual = margen implementacion por nuevos clientes + margen mensual por clientes totales - costos fijos.

2. El margen de implementacion de USD 540,82 sale de:

   USD 800 - USD 139,18 - USD 120 = USD 540,82

   Es decir: no descuenta dominio ni hosting dentro de la implementacion. Eso esta bien si dominio/hosting se tratan como costos recurrentes, pero conviene explicarlo mejor.

3. El margen mensual de USD 99,60 parece descontar hosting mensual y una parte mensualizada del dominio anual:

   USD 100 - USD 0,06 - USD 0,33 aprox = USD 99,60

4. El punto de equilibrio dice 15 clientes, pero matematicamente USD 1.495 / USD 99,60 = 15,01. Si se redondea hacia arriba, deberia decir 16 clientes para cubrir fijos solo con mantenimiento mensual.

5. Si se considera la ganancia por implementacion de clientes nuevos, el negocio cubre fijos antes. Pero entonces la metrica debe llamarse distinto: no es solo punto de equilibrio mensual recurrente.

## Recomendacion de ajuste

Para evitar que el docente cuestione los numeros, conviene separar tres conceptos:

- Margen por implementacion: precio inicial menos acrilicos y comision de venta.
- Margen recurrente mensual: mantenimiento menos hosting y dominio mensualizado.
- Punto de equilibrio recurrente: clientes activos necesarios para cubrir costos fijos sin contar nuevas ventas.

Con esta separacion, la historia financiera queda mucho mas defendible.

## Recomendacion para la presentacion

La presentacion ya tiene buena estructura, pero necesita reforzar:

- slide 7: aclarar que algunos costos son de implementacion y otros recurrentes.
- slide 8: mostrar tabla o grafico con clientes totales, ganancia mensual y acumulada.
- conclusion: evitar prometer rentabilidad sin mencionar que depende de adquirir al menos 4 locales nuevos por mes despues del primer mes.

## Siguiente trabajo sugerido

1. Corregir la planilla: cambiar punto de equilibrio recurrente de 15 a 16 o explicar el criterio.
2. Crear una hoja de supuestos con tipo de cambio, precios, costos y formulas visibles.
3. Agregar escenarios: conservador, base y optimista.
4. Ajustar la presentacion con una narrativa mas clara y menos vulnerable a preguntas.
