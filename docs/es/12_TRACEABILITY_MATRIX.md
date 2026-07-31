**Español** | [English](../12_TRACEABILITY_MATRIX.md)

# Matriz de trazabilidad

Este mapa relaciona requisitos duraderos con sus límites principales de implementación y
verificación. Sirve para navegar, no sustituye las pruebas a nivel de código.

## Requisitos funcionales

| Requisito | Implementación principal                                                         | Verificación principal                                                                                                            |
| --------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| RF-01     | `src/cli/`, `src/application/audit-project.ts`                                   | pruebas de auditoría CLI e integración de aplicación                                                                              |
| RF-02     | `src/project/validate-project-path.ts`                                           | pruebas unitarias y de sistema de archivos para rutas                                                                             |
| RF-03     | `src/project/discovery/`                                                         | recorrido y escenario controlado de descubrimiento                                                                                |
| RF-04     | `src/project/discovery/discovery-config.ts`                                      | casos de exclusión, alias, contenido generado y enlaces                                                                           |
| RF-05     | `src/project/inventory/`                                                         | pruebas de normalización, identidad, desduplicación y orden                                                                       |
| RF-06     | `src/project/classification/`                                                    | matriz de extensiones y exclusiones conservadoras                                                                                 |
| RF-07     | `src/parsing/`, `src/parsing/babel/`                                             | pruebas de lector, parser, bindings de import/export, aislamiento y cuatro tipos                                                  |
| RF-08     | `src/parsing/babel/`, `src/domain/models/`, `src/application/analyze-project.ts` | extracción de exports/usos, invariantes, resolución `ComponentLink`, ambigüedad, ciclos, ubicaciones e integración de composición |
| RF-09     | `src/rules/`, `src/configuration/`                                               | registro, selección, configuración e integración del catálogo                                                                     |
| RF-10     | `src/rules/evaluate-rules.ts`, reglas conscientes de composición                 | evaluación solo del modelo, recorrido acotado de ciclos, observaciones y aislamiento                                              |
| RF-11     | `src/domain/findings/`, `src/rules/evaluate-rules.ts`                            | casos de cero, uno, varios, duplicados y observaciones inválidas                                                                  |
| RF-12     | `src/domain/models/source-location.ts`, normalización de hallazgos               | aserciones de ubicación semiabierta y presentación                                                                                |
| RF-13     | metadatos de reglas y hallazgos normalizados                                     | validación de metadatos y pruebas de recomendaciones y límites                                                                    |
| RF-14     | `src/domain/rules/`, `src/domain/findings/`                                      | categoría, severidad, confianza, identidad y resúmenes                                                                            |
| RF-15     | `src/reporting/`, `src/domain/audit/audit-result.ts`                             | contratos, esquemas, consistencia entre formatos y escritor                                                                       |

## Requisitos no funcionales

| Requisito | Implementación principal                                      | Verificación principal                                                                   |
| --------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| RNF-01    | directorios por capas debajo de `src/`                        | revisión de dependencias, fachadas inyectadas e integración                              |
| RNF-02    | contratos `Rule`, `Reporter`, `Finding` y `AuditResult`       | validadores cerrados y pruebas enfocadas en extensión                                    |
| RNF-03    | TypeScript estricto, ESM, módulos enfocados y documentación   | formato, docs, lint, tipos, pruebas, cobertura y compilación                             |
| RNF-04    | orden canónico en toda la canalización                        | ejecuciones repetidas, entrada invertida de archivos analizados y comparaciones estables |
| RNF-05    | identidad normalizada y ubicaciones de fuente                 | correspondencia exacta de regla, archivo y rango                                         |
| RNF-06    | recomendaciones en terminal/HTML y documentación pública      | aserciones de informes y revisión repetible de tareas principales                        |
| RNF-07    | un escaneo, un modelo enlazado, una evaluación y un resultado | spies de aplicación, corpus de enlaces de componentes y proyecto grande                  |
| RNF-08    | clasificación y adaptador de parser Babel                     | casos `.ts`, `.tsx`, `.js` y `.jsx` de parser/modelo                                     |
| RNF-09    | engines, rutas entre plataformas y matriz de CI               | entorno, CI, enlaces, permisos y casos de profundidad                                    |
| RNF-10    | resultado normalizado y generadores puros                     | esquema JSON, consistencia terminal/JSON/HTML y ausencia de reevaluación                 |

## Distribución y documentación

| Requisito | Implementación principal                                         | Verificación principal                                   |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| DIST-01   | `package.json`, `dist/`, `schemas/` y archivos README públicos   | `npm run test:package` e instalación temporal limpia     |
| DOC-I18N  | `README.md`, `README.en.md`, `README.es.md`, `docs/`, `docs/es/` | `npm run docs:check`, formato, enlaces y revisión humana |

## Regla de mantenimiento

Cuando cambie un requisito, opción pública, esquema, regla o informe, actualiza implementación,
pruebas, documentación emparejada y este mapa en el mismo cambio coherente.
