---
name: reportes
description: Crear reportes ejecutivos claros y accionables cuando el usuario pida un reporte, resumen de cambios, informe para equipo o cliente, estado del proyecto, pendientes, changelog humano, o recapitulacion de trabajo realizado. Usar especialmente cuando el reporte deba agrupar puntos importantes sin repetir iteraciones tecnicas.
---

# Reportes

Crear reportes listos para enviar a equipo, cliente o stakeholders. Priorizar claridad, impacto y agrupacion por tema.

## Flujo

1. Identificar el objetivo del reporte: cambios realizados, estado actual, pendientes, riesgos, decisiones o siguiente paso.
2. Agrupar por temas, no por orden cronologico, salvo que el usuario pida una linea de tiempo.
3. Omitir iteraciones repetidas sobre el mismo problema; mencionar solo el resultado importante.
4. Separar hechos confirmados de recomendaciones o pendientes.
5. Usar lenguaje profesional, simple y directo.

## Estructura Recomendada

Usar esta estructura por defecto:

```markdown
**Reporte**

Breve contexto de 1-2 frases.

**Cambios Realizados**
- Tema: cambio importante y efecto.
- Tema: cambio importante y efecto.

**Decisiones O Criterios**
- Decision tomada y motivo.

**Pendiente**
- Punto pendiente, por que importa y siguiente accion sugerida.

**Validacion**
- Pruebas, build, revision de datos o estado de commit/push, si aplica.
```

## Reglas De Estilo

- No listar cada intento o correccion intermedia.
- No exagerar; escribir solo lo que esta hecho o verificado.
- Evitar jerga interna si el reporte es para cliente.
- Mantener bullets cortos y con verbo claro.
- Si hay incertidumbre, decir "pendiente de confirmar" o "recomendado".
- Si el usuario pide "que queda pendiente", separar pendientes por prioridad.

## Reportes De Producto

Para cambios de producto o app, incluir:

- Modulo afectado.
- Problema original.
- Cambio implementado.
- Impacto para usuario.
- Pendiente o recomendacion.

## Reportes Tecnicos

Para cambios tecnicos, incluir:

- Archivos o areas tocadas solo si aportan valor.
- Validaciones ejecutadas.
- Riesgos residuales.
- Datos medidos o auditados.

