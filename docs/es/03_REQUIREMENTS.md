**Español** | [English](../03_REQUIREMENTS.md)

# Requisitos

## Requisitos funcionales

| ID    | Requisito                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| RF-01 | Permitir que la persona usuaria seleccione un proyecto mediante la CLI.                                                                    |
| RF-02 | Validar que la ruta exista, sea un directorio y se pueda acceder a ella.                                                                   |
| RF-03 | Descubrir de forma recursiva los archivos dentro del proyecto.                                                                             |
| RF-04 | Excluir dependencias, salidas generadas, configuraciones y contenido irrelevante de acuerdo con la política definida.                      |
| RF-05 | Crear un inventario que conserve información normalizada de ubicación relativa y absoluta.                                                 |
| RF-06 | Clasificar los candidatos de código fuente que puedan contener código React/TypeScript pertinente.                                         |
| RF-07 | Analizar código fuente JavaScript, TypeScript, JSX y TSX mediante un parser compatible.                                                    |
| RF-08 | Construir un modelo normalizado de archivos, componentes, elementos JSX, propiedades, relaciones y ubicaciones necesarias para las reglas. |
| RF-09 | Cargar las reglas disponibles y habilitadas en las categorías de UX, accesibilidad, SEO y rendimiento.                                     |
| RF-10 | Ejecutar las reglas sobre el modelo normalizado en lugar de que cada una vuelva a leer archivos de forma independiente.                    |
| RF-11 | Permitir que cada regla devuelva cero, uno o varios hallazgos normalizados.                                                                |
| RF-12 | Conservar el archivo y la ubicación en el código fuente de cada hallazgo cuando estén disponibles.                                         |
| RF-13 | Incluir una explicación, recomendación y limitaciones conocidas.                                                                           |
| RF-14 | Clasificar los hallazgos por regla, categoría, severidad y confianza.                                                                      |
| RF-15 | Generar informes de terminal, JSON y HTML a partir de un resultado normalizado de auditoría.                                               |

## Requisitos no funcionales

| ID     | Requisito                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| RNF-01 | Responsabilidades modulares para CLI, aplicación, procesamiento de proyectos, parsing, dominio, reglas e informes. |
| RNF-02 | Contratos extensibles y validados para reglas y generadores de informes.                                           |
| RNF-03 | Módulos mantenibles, tipados, documentados y comprobables de forma independiente.                                  |
| RNF-04 | Orden y resultados repetibles para el mismo código, configuración, plataforma y versión.                           |
| RNF-05 | Trazar cada hallazgo hasta su regla y ubicación en el código cuando estén disponibles.                             |
| RNF-06 | Presentar resultados accionables a quienes desarrollan frontend mediante informes locales seguros.                 |
| RNF-07 | Evitar recorridos, parsing, evaluación de reglas y análisis específicos por informe que sean redundantes.          |
| RNF-08 | Admitir `.ts`, `.tsx`, `.js` y `.jsx` en proyectos React.                                                          |
| RNF-09 | Ejecutarse en los principales sistemas operativos compatibles con Node.js sin un entorno gráfico.                  |
| RNF-10 | Mantener el análisis independiente de la presentación de la salida.                                                |

## Restricciones del producto

- El análisis estático local es el único modelo de ejecución.
- Los módulos analizados nunca se importan, ejecutan ni cambian.
- No se introduce una base de datos, telemetría, servicio alojado ni dependencia de red en producción.
- Las reglas consumen el modelo normalizado de análisis, no árboles de sintaxis específicos del parser.
- Los generadores de informes consumen un resultado normalizado y no repiten el análisis.
- El recorrido y la escritura de informes permanecen dentro de raíces autorizadas expresamente.
- Los casos dinámicos o no compatibles se describen como desconocidos o limitados, no como defectos.

## Interpretación de requisitos

La [especificación del producto](02_PRODUCT_SPEC.md) define el comportamiento observable de la CLI.
La [arquitectura](04_ARCHITECTURE.md) define los límites de implementación y la
[matriz de trazabilidad](12_TRACEABILITY_MATRIX.md) relaciona cada requisito con código y verificación.

Una aclaración puede mejorar la redacción sin cambiar el comportamiento observable. Agregar, eliminar
o debilitar un comportamiento público requiere una decisión de diseño explícita, pruebas y
documentación bilingüe.
