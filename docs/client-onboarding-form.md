# Formulario de onboarding para negocios Sumi

Este formulario junta datos objetivos. Las decisiones visuales finas se validan en llamada.

Formato operativo:

1. Copiar `docs/business-intake.template.json` como `business-intake.json`.
2. Completar el JSON con las respuestas de este formulario.
3. Validar antes de crear la config:

```powershell
npm run check:onboarding -- --intake business-intake.json
```

Ese check no reemplaza la llamada, pero evita avanzar con datos clave faltantes:
owner, dominio, fuentes de menu, idiomas, flags, limites de staff y creditos IA.

## Datos basicos

- Nombre del negocio:
- Direccion:
- WhatsApp:
- Instagram:
- Sitio web actual:
- Logo:
- Lema o frase:
- Horarios:
- Rubro: cafeteria / bar / restaurante / heladeria / otro.
- Tipo de atencion: local / take away / delivery.
- Dominio deseado o existente:
- Email del owner:
- Emails de empleados iniciales:

## Menu

- Tiene menu actualizado: si / no.
- Archivos del menu: imagenes / PDF / editable.
- Fotos de productos disponibles: si / no.
- Catalogos deseados:
- Categorias por catalogo:
- Productos principales:
- Productos a destacar:
- Productos que no quiere promocionar:

Si tiene imagenes, PDF o fotos actualizadas del menu, puede subirlas directamente y Sumi organiza la informacion.

## Sistema de puntos

- Puntos por registrarse:
- Acumulacion por monto consumido:
- Acumulacion por visita:
- Acumulacion por producto especifico:
- Puntos por referido:
- Puntos para quien refiere:
- Puntos para el referido:
- Vencimiento de puntos: si / no.
- Meses hasta vencimiento:
- Niveles deseados:
- Umbral para Plata:
- Umbral para Oro:
- Umbral para Platino:

Recomendacion inicial: dar puntos de bienvenida ayuda a que el cliente vea valor desde el primer uso.

## Premios

Repetir por cada premio:

- Nombre:
- Descripcion:
- Puntos necesarios:
- Stock:
- Imagen:
- Nivel minimo:
- Vigencia:
- Activo al lanzar: si / no.

## Rachas

- Activar rachas: si / no.
- Tipo recomendado: semanal.
- Cuando se pierde:
- Beneficio por mantener:
- Beneficio al llegar a X semanas:

Para gastronomia se recomienda racha semanal porque es mas realista que exigir visitas diarias.

## Idiomas

- Idioma principal:
- Idiomas secundarios:
- Selector de idioma visible para clientes: si / no.
- Codigo de cada idioma, por ejemplo `es`, `en`, `ar`, `fr`, `pt`:
- Etiqueta visible de cada idioma:
- Bandera/asset para cada idioma, por ejemplo `mx`, `us`, `lb`:
- Direccion de lectura por idioma: `ltr` o `rtl`.
- Traduccion automatica inicial: si / no.
- Revisar traducciones antes de publicar: si / no.
- Terminos que no se deben traducir:

## Contenido y comunicacion

- Redes sociales:
- Estilo: elegante / cercano / juvenil / premium / familiar / divertido.
- Frases que usan normalmente:
- Promociones frecuentes:
- Productos estrella:
- Fechas importantes:

## QRs del negocio

- Dominio raiz que deben abrir los QRs:
- Usos iniciales: mesa / mostrador / redes / flyer.
- Objetivo principal: menu y puntos / registro / premios / promocion.
- Tono del QR: directo / elegante / divertido / premium.
- Estilo visual preferido: editorial / simple / sello del club.
- Color principal: marca / ambar / oliva / vino.
- Texto principal sugerido:
- Requiere version impresa para mesas: si / no.
- Requiere version para redes: si / no.

## Operacion y limites

Estos datos no se usan para diseno; sirven para estimar soporte y costos.

- Cantidad aproximada de clientes por mes:
- Cantidad aproximada de consumos por dia:
- Cantidad de empleados que usaran caja:
- Quiere generaciones IA incluidas: si / no.
- Cantidad estimada de piezas de contenido por mes:
- Nombre del plan de IA:
- Creditos IA incluidos por mes:
- Creditos por generacion:
- Avisar cuando queden menos de X creditos:
- Necesita soporte por WhatsApp: si / no.
- Horarios criticos del negocio:

## Seguridad operativa

- Monto maximo que puede cargar un empleado por consumo:
- Monto maximo diario que puede cargar un empleado:
- Cantidad maxima diaria de consumos por empleado:
- Empleados deben usar QR obligatoriamente para cargar consumo: si / no.
- Owner puede corregir consumos: si / no.
- Quien revisa consumos sospechosos:

## Llamada de identidad visual

Resolver en llamada:

- Paleta de colores.
- Tipografia aproximada.
- Estilo visual.
- Nivel de formalidad.
- Elementos de marca a respetar.
- Elementos que no les gustan.
- Ejemplos de negocios que les gustan.
