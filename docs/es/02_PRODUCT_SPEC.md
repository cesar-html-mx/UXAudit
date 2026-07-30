**Español** | [English](../02_PRODUCT_SPEC.md)

# Especificación del producto y la CLI

## Distribución y ejecución

El paquete de npm se llama `@cesar-html-mx/uxaudit` y el ejecutable se llama `ux-audit`. Las personas
consumidoras instalan el paquete como dependencia de desarrollo y ejecutan el binario desde su
proyecto:

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

La ejecución sin conexión exige la dependencia local instalada y evita que npm resuelva otro paquete
con un nombre parecido. Quien instala el paquete no compila UXAudit ni hereda los scripts npm de este
repositorio. Solo quienes contribuyen desde el código fuente usan el flujo de compilación del
repositorio.

## Flujo observable del análisis

`ux-audit scan <project-path>` realiza estas etapas en orden:

1. valida que la ruta seleccionada sea un directorio legible y no vacío, y resuelve su raíz canónica;
2. carga la configuración JSON inerte opcional;
3. descubre entradas del sistema de archivos en orden determinista relativo al proyecto;
4. selecciona candidatos seguros `.js`, `.jsx`, `.ts` y `.tsx`;
5. lee y analiza archivos fuente UTF-8 acotados sin ejecutarlos;
6. construye un solo modelo de análisis independiente del parser;
7. carga y evalúa las reglas estables seleccionadas con aislamiento de fallos;
8. construye un resultado normalizado e inmutable de la auditoría;
9. presenta la salida de terminal y escribe los archivos JSON o HTML seleccionados.

El comando imprime resúmenes de validación de ruta, descubrimiento y análisis antes del informe de
terminal. Un informe de archivo solo se anuncia después de terminar su escritura correctamente.

## Opciones del comando

| Opción                  | Contrato                                                                      |
| ----------------------- | ----------------------------------------------------------------------------- |
| `--config <path>`       | Selecciona un archivo explícito de configuración JSON.                        |
| `--format <format>`     | Selecciona `terminal`, `json`, `html` o `all`; repetible y sin duplicados.    |
| `--output <directory>`  | Selecciona un directorio relativo compatible entre plataformas.               |
| `--category <category>` | Filtra por `accessibility`, `performance`, `seo` o `ux`; se puede repetir.    |
| `--rule <rule-id>`      | Filtra por el ID exacto de una regla incluida; se puede repetir.              |
| `--severity <severity>` | Filtra detalles de terminal con `info`, `low`, `medium`, `high` o `critical`. |
| `--no-color`            | Desactiva los colores ANSI fijos de las etiquetas de severidad.               |
| `--verbose`             | Muestra errores recuperables normalizados del procesamiento en la terminal.   |

`--help` y `--version` están disponibles en el comando raíz; `scan --help` describe el subcomando.

## Descubrimiento y selección de fuentes

El recorrido predeterminado omite enlaces simbólicos y directorios comunes de dependencias, control
de versiones, caché, contenido generado, cobertura y compilación. También omite nombres
convencionales de configuración de herramientas, `uxaudit.config.json`, declaraciones TypeScript
terminadas en `.d.ts` y archivos compatibles cuyo nombre normalizado coincide con el patrón
convencional `config`.

El descubrimiento produce candidatos, no una autorización permanente. Antes de leer, UXAudit vuelve
a autorizar la raíz canónica y la identidad del archivo, exige un archivo regular dentro de la raíz,
limita el contenido a 1 MiB, lee fragmentos de no más de 64 KiB y decodifica UTF-8 estrictamente.

## Contrato de configuración

Sin `--config`, UXAudit busca `uxaudit.config.json` en la raíz canónica del proyecto. Una ruta
explícita de configuración se trata como un archivo local seleccionado por la persona usuaria. Ambos
casos se analizan como datos y nunca se importan como código.

```json
{
  "schemaVersion": 1,
  "categories": null,
  "ruleIds": null,
  "formats": ["terminal"],
  "minimumSeverity": "info",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

El objeto es cerrado: las claves desconocidas y los tipos inválidos son errores. Los arreglos son
acotados, densos, únicos y normalizados. `categories: null` y `ruleIds: null` dejan abiertos esos
filtros; `[]` selecciona intencionalmente cero reglas para ese filtro. Cuando ambos filtros son
arreglos, se usa su intersección.

Solo las opciones del comando proporcionadas expresamente reemplazan el archivo. Los valores del
archivo reemplazan los predeterminados. El archivo de configuración se limita a 64 KiB y debe ser
JSON UTF-8 válido con `schemaVersion: 1`.

## Contrato de informes

Todos los generadores consumen el mismo resultado normalizado:

- Terminal es interactivo, puede usar etiquetas fijas de color y aplica `minimumSeverity` solo a los
  detalles visibles de hallazgos. Los totales completos permanecen visibles.
- JSON es la representación legible por máquinas sin pérdida, con sangría de dos espacios y un salto
  de línea final.
- HTML es independiente, usa CSS constante integrado, no contiene scripts ni recursos externos,
  escapa valores no confiables del proyecto y establece una política de seguridad de contenido
  restrictiva.

El paquete expone contratos de validación JSON en `schemas/audit-result.schema.json` y
`schemas/finding.schema.json`. En una instalación local la primera ruta es
`node_modules/@cesar-html-mx/uxaudit/schemas/audit-result.schema.json`. Los esquemas apoyan a quienes
consumen informes; UXAudit sigue siendo una CLI y no expone una API pública que se pueda importar.

JSON y HTML usan nombres de archivo fijos:

- `audit-report.json`
- `audit-report.html`

El directorio de salida debe ser una ruta relativa compatible entre plataformas y estar debajo de la
raíz del proyecto. La escritura rechaza rutas absolutas, recorridos al directorio superior, enlaces,
salidas de la raíz y destinos existentes. Si se selecciona más de un formato de archivo, un archivo
anterior puede existir cuando falla una escritura posterior; UXAudit no realiza una reversión
automática insegura.

## Códigos de salida

| Código | Contrato                                                                                                          |
| -----: | ----------------------------------------------------------------------------------------------------------------- |
|    `0` | Ayuda, versión o auditoría completada, incluso con hallazgos y errores recuperables.                              |
|    `1` | Reservado para una política futura de fallo y no se emite actualmente debido a hallazgos.                         |
|    `2` | Comando, argumento, ruta del proyecto o configuración de entrada inválidos.                                       |
|    `3` | Fallo fatal de canalización, violación de invariantes, error inesperado de la aplicación o escritura de informes. |

`minimumSeverity` es un filtro de presentación y no cambia el código de salida.

## Fallos recuperables y fatales

Los descendientes ilegibles, archivos fuente malformados, fallos seguros de extracción y fallos
aislados de reglas se registran cuando es posible, mientras continúan los archivos y reglas no
afectados. Una raíz inválida, los errores de configuración, las invariantes globales rotas y los
fallos de escritura detienen el comando con el código distinto de cero correspondiente.

Los detalles nativos del parser y sistema de archivos, el texto fuente sin procesar, las rutas
absolutas de fuentes y los árboles internos de sintaxis no se exponen a través de los errores
públicos. Los valores dinámicos de terminal se normalizan para que los caracteres de control y
bidireccionales no creen registros engañosos.

## Compatibilidad y objetivos excluidos

El entorno compatible es Node.js `>=24.18.0 <25`. UXAudit analiza código JavaScript y TypeScript del
ecosistema React, pero no exige que el proyecto objetivo use un empaquetador específico.

La ejecución en navegador, instrumentación en tiempo de ejecución, cambios automáticos de código,
rastreo de red, telemetría, certificación de cumplimiento y paneles alojados no son funciones del
producto. Las reglas son verificaciones estáticas conservadoras y deben publicar sus propios límites.
