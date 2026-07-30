**Español** | [English](../13_GLOSSARY.md)

# Glosario

| Término                 | Significado                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| Modelo de análisis      | Representación inmutable e independiente del parser de archivos, componentes, JSX, valores y ubicaciones. |
| `AnalysisModel`         | Nombre del tipo del modelo normalizado que consumen las reglas.                                           |
| Auditoría               | Análisis local completo desde la ruta autorizada hasta el resultado y los informes seleccionados.         |
| `AuditResult`           | Resultado inmutable versionado que consumen los generadores de terminal, JSON y HTML.                     |
| Raíz canónica           | Identidad real del proyecto y límite de autorización para recorrido e informes.                           |
| Categoría               | Agrupación de reglas: accesibilidad, rendimiento, SEO o UX.                                               |
| Confianza               | Metadato que describe la fuerza de la evidencia estática de un hallazgo.                                  |
| Hallazgo                | Observación normalizada de revisión producida por una regla.                                              |
| Ubicación semiabierta   | Rango de fuente cuyo inicio está incluido y cuyo final está excluido.                                     |
| Inventario              | Registro ordenado de forma determinista de entradas descubiertas.                                         |
| Error de procesamiento  | Fallo recuperable normalizado de descubrimiento, fuente, parser o regla que se conserva.                  |
| Generador de informes   | Adaptador puro que presenta un `AuditResult` como texto de terminal, JSON o HTML.                         |
| Regla                   | Verificación estática independiente con metadatos validados y evaluación sobre `AnalysisModel`.           |
| Registro de reglas      | Colección inmutable validada desde la cual se seleccionan reglas habilitadas.                             |
| Severidad               | Prioridad predeterminada de revisión: info, low, medium, high o critical.                                 |
| Candidato de fuente     | Entrada compatible que puede reautorizarse, leerse de forma acotada y analizarse.                         |
| Proyección estable      | Vista que excluye valores volátiles documentados como raíz, tiempos o duración.                           |
| Análisis estático       | Inspección de la estructura sin ejecutar el programa analizado.                                           |
| Saneamiento de terminal | Conversión de valores dinámicos no confiables en texto visible, bien formado y seguro.                    |
| Desconocido             | Estado dinámico o no compatible cuya evidencia no justifica una conclusión.                               |

Estos términos describen los contratos actuales. Los términos y limitaciones de cada regla aparecen
en el [catálogo de reglas](08_RULE_CATALOG.md).
