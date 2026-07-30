# UXAudit

**Español** | [English](README.en.md)

UXAudit es una CLI local de análisis estático para proyectos React y TypeScript. La implementación
actual con Node.js 24 descubre y clasifica de forma segura candidatos de código fuente `.js`, `.jsx`,
`.ts` y `.tsx`, los analiza sintácticamente mediante un límite interno de Babel y construye un modelo
de análisis determinista e independiente del analizador sintáctico. La capa de dominio completada en
M04 incorpora un motor determinista de reglas aisladas y ocho reglas estables de accesibilidad,
rendimiento, SEO y UX. La capa de generación de informes completada en M05 incorpora valores
predeterminados y carga de configuración versionada, un `AuditResult` normalizado e inmutable,
resúmenes completos de archivos, reglas, hallazgos y errores, generadores puros y deterministas para
terminal, JSON sin pérdida y HTML independiente, además de un escritor local exclusivo y compartido.

El comando `scan` valida y convierte en canónica la raíz seleccionada, carga una configuración JSON
inerte antes de recorrer y analizar sintácticamente los archivos fuente, analiza candidatos seguros
sin ejecutar el código objetivo, evalúa las reglas estables seleccionadas sobre un único modelo
normalizado y construye un `AuditResult` inmutable. Cuando se selecciona, presenta la salida de
terminal y guarda localmente los informes JSON y HTML elegidos mediante el escritor exclusivo. Los
hallazgos y los errores recuperables de descubrimiento, relacionados con las fuentes o de reglas no
hacen que una auditoría completada falle por sí solos.

## Requisitos

- Node.js `24.18.0` LTS (el repositorio fija la versión en `.nvmrc`)
- npm `11.16.0` o una versión posterior de la línea npm 11
- Git

Con nvm:

```bash
nvm install
nvm use
npm ci
```

El paquete exige Node.js 24, versiones directas exactas de las dependencias, resolución estricta de
dependencias pares y una lista de permitidos revisada para los scripts de instalación de
dependencias.

## Uso de la CLI

Primero compila y después ejecuta el archivo generado:

```bash
npm run build
node dist/cli/index.js --help
node dist/cli/index.js --version
node dist/cli/index.js scan .
node dist/cli/index.js scan ./project --format all --output reports --no-color --verbose
```

Para un directorio válido se conservan las líneas de avance de ruta canónica, descubrimiento y
análisis sintáctico antes del informe de terminal seleccionado y de las rutas confirmadas de
informes:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>
UXAudit <version>
...
```

Las opciones de `scan` son:

- `--config <path>` para indicar una configuración JSON inerte;
- `--format <terminal|json|html|all>`, `--category <category>` y `--rule <rule-id>`, que pueden
  repetirse;
- `--output <directory>` para indicar un directorio de informes portable y relativo al proyecto;
- `--severity <info|low|medium|high|critical>` únicamente para el detalle de terminal;
- `--no-color` y `--verbose`.

El recorrido predeterminado omite enlaces simbólicos y nombres relacionados con dependencias,
salidas generadas, caché, cobertura y configuración. El inventario conserva rutas canónicas dentro
de la raíz en un orden estable relativo al proyecto; la clasificación excluye declaraciones y
archivos fuente con nombres convencionales de configuración sin leer su contenido ni afirmar que
contengan componentes React.

Las raíces vacías, inexistentes, inaccesibles o que sean archivos regulares se rechazan antes del
recorrido. Los errores fatales de descubrimiento, inventario, clasificación, autorización de la
raíz o invariantes del lote y del modelo utilizan mensajes estables de la aplicación. Los errores
recuperables al descubrir descendientes se cuentan como `issues`; los errores recuperables de
lectura, sintaxis y extracción se cuentan como `failed`, mientras los archivos fuente seguros
continúan hacia el modelo.

La apertura de archivos fuente vuelve a autorizar la raíz canónica del proyecto y el candidato
alrededor de una lectura verificada mediante un descriptor de archivo. Un archivo fuente puede
contener como máximo 1 MiB y se lee en fragmentos de hasta 64 KiB. Los candidatos que no sean
archivos regulares, hayan cambiado, estén fuera de la raíz, no puedan leerse, superen el límite o
contengan UTF-8 inválido se rechazan de forma segura. UTF-8 se decodifica estrictamente y se conserva
un BOM inicial para Babel. Las causas nativas del sistema de archivos o Babel, el texto fuente, las
rutas absolutas y los valores del AST no salen de sus límites internos. Los caracteres de control y
bidireccionales, incluidos los saltos de línea inyectados, se presentan como escapes Unicode
visibles antes de llegar a la terminal.

Códigos de salida actuales de la CLI:

| Código | Significado                                                                                                      |
| -----: | ---------------------------------------------------------------------------------------------------------------- |
|    `0` | Ayuda, versión o auditoría completada, incluso con hallazgos y errores recuperables de procesamiento.            |
|    `1` | Reservado para una futura política configurable de fallo por hallazgos; `minimumSeverity` no activa este código. |
|    `2` | Comando, argumento, raíz del proyecto o configuración inválidos.                                                 |
|    `3` | Fallo fatal de la canalización o invariantes, error inesperado de la aplicación o fallo al escribir un informe.  |

## Configurar una auditoría

El límite de configuración carga un archivo opcional `uxaudit.config.json` desde una raíz de proyecto
ya convertida en canónica, o un archivo JSON elegido por la persona usuaria, sin importarlo ni
ejecutarlo. Este ejemplo solicita los tres generadores de informes y restringe las reglas por
categoría:

```json
{
  "schemaVersion": 1,
  "categories": ["accessibility", "seo"],
  "formats": ["terminal", "json", "html"],
  "minimumSeverity": "medium",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

Los valores predeterminados son salida de terminal, severidad `info`, color, detalle no verboso,
directorio `uxaudit-reports` y el catálogo estable de reglas. Los filtros de categorías o reglas con
valor `null` seleccionan ese catálogo; un arreglo `[]` selecciona intencionalmente cero reglas. Las
opciones validadas de la CLI tienen prioridad sobre el archivo, y el archivo tiene prioridad sobre los
valores predeterminados. Los archivos de configuración deben ser JSON UTF-8 estricto, están
limitados a 64 KiB y rechazan claves o valores desconocidos. Los directorios de salida deben ser
rutas portables relativas al proyecto. Únicamente las opciones proporcionadas expresamente en la
línea de comandos se convierten en valores de reemplazo, por lo que el valor predeterminado de Commander
para la ausencia de `--no-color` no puede sustituir una configuración de archivo.

El generador de informes de terminal consume un `AuditResult` completado. Conserva el orden canónico de los
hallazgos, filtra el detalle mostrado mediante el umbral inclusivo de severidad, mantiene los totales
completos, usa columnas humanas basadas en uno y muestra detalles normalizados de procesamiento solo
en modo verboso. La salida sin color no contiene bytes de escape; el color se limita a etiquetas
fijas después de convertir cada valor dinámico en texto visible seguro para terminal. La CLI escribe
directamente esta salida ya segura para que un segundo saneamiento del informe completo no neutralice
los códigos ANSI fijos y confiables.

El generador de informes JSON serializa el resultado completo con indentación de dos espacios y un LF
final; conserva la duración y las columnas almacenadas basadas en cero. La persistencia JSON y HTML
acepta únicamente el destino relativo configurado, rechaza enlaces, escapes de ruta y archivos
existentes, y devuelve una ruta solo después de escribir, sincronizar, cerrar y realizar la
autorización final. El escritor no elimina automáticamente un destino parcial después de un fallo,
porque una condición de carrera en la identidad de la ruta podría volver insegura la eliminación.
Las rutas dentro de `AuditResult` son destinos configurados; únicamente un resultado devuelto por el
escritor se anuncia como generado.

El generador de informes HTML muestra el resultado completo en grupos fijos de severidad y etapa de procesamiento;
los umbrales y el modo verboso de terminal no ocultan registros. Utiliza una CSP restrictiva, CSS
integrado constante, ningún script ni recurso externo, neutralización visible de Unicode hostil
seguida de escape HTML y una alternativa inerte para cualquier referencia que no pueda volver a
analizarse como HTTP(S) sin credenciales. Las ubicaciones para lectura humana usan columnas basadas
en uno, desplazamientos UTF-16 y una etiqueta explícita de final exclusivo.

## Desarrollo y verificación

```bash
npm run dev -- scan .
npm run verify
npm run test:coverage
npm run test:smoke
npm run test:accuracy:m06
npm run test:robustness:m06
npm run test:usability:m06
npm run test:scenario:m02
npm run test:scenario:m03
npm run test:scenario:m04
npm run test:scenario:m05
npm run test:scenario:m06
```

Comandos individuales útiles:

| Comando                         | Propósito                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run format`                | Aplicar la configuración base de Prettier del repositorio.                                                           |
| `npm run format:check`          | Rechazar diferencias de formato.                                                                                     |
| `npm run docs:check`            | Validar pares de documentos bilingües, literales técnicos y enlaces locales.                                         |
| `npm run lint`                  | Ejecutar las reglas tipadas de ESLint 10 sin advertencias.                                                           |
| `npm run typecheck`             | Ejecutar las verificaciones estrictas de TypeScript sin emitir archivos.                                             |
| `npm test`                      | Ejecutar una vez las pruebas focalizadas de Vitest.                                                                  |
| `npm run test:coverage`         | Ejecutar cobertura V8 con umbrales globales de 90 %.                                                                 |
| `npm run build`                 | Emitir JavaScript ESM, declaraciones y mapas de fuente en `dist/`.                                                   |
| `npm run test:smoke`            | Compilar y ejecutar once escenarios de la CLI sin usar un shell.                                                     |
| `npm run test:accuracy:m06`     | Comparar hallazgos de la CLI por regla con la verdad base revisada a nivel de instancia.                             |
| `npm run test:robustness:m06`   | Ejecutar casos de robustez, seguridad y rendimiento de la CLI compilada sin usar un shell.                           |
| `npm run test:usability:m06`    | Ejecutar la revisión heurística experta de seis tareas sin atribuir datos a personas usuarias.                       |
| `npm run test:scenario:m02`     | Verificar inventario, exclusiones, enlaces, determinismo y no ejecución revisados.                                   |
| `npm run test:scenario:m03`     | Ejecutar el escenario controlado del analizador sintáctico y modelo con cuatro tipos de archivo sin ejecutar código. |
| `npm run test:scenario:m04`     | Validar el catálogo determinista de ocho reglas sin ejecutar el código fuente.                                       |
| `npm run test:scenario:m05`     | Verificar configuración y todos los informes sobre un resultado controlado.                                          |
| `npm run test:scenario:m06`     | Auditar dos veces cinco proyectos controlados mediante la CLI compilada completa.                                    |
| `npm run evidence:m02`          | Recopilar el paquete aislado, saneado y verificado de evidencia M02.                                                 |
| `npm run evidence:m02:finalize` | Añadir el informe del hito al manifiesto SHA-256 conservado.                                                         |
| `npm run evidence:m03`          | Recopilar el paquete aislado, saneado y verificado de evidencia M03.                                                 |
| `npm run evidence:m03:finalize` | Añadir el informe del hito al manifiesto SHA-256 conservado de M03.                                                  |
| `npm run evidence:m04`          | Recopilar el paquete aislado, saneado y verificado de evidencia M04.                                                 |
| `npm run evidence:m04:finalize` | Añadir el informe del hito al manifiesto SHA-256 conservado de M04.                                                  |
| `npm run evidence:m05`          | Recopilar o verificar el paquete aislado y saneado de evidencia M05.                                                 |
| `npm run evidence:m05:finalize` | Añadir el informe del hito al manifiesto SHA-256 conservado de M05.                                                  |
| `npm run evidence:m06`          | Recopilar o verificar el paquete aislado de 42 artefactos de evidencia de la Actividad 3.                            |
| `npm run evidence:m06:finalize` | Añadir el informe del hito M06 al manifiesto SHA-256 conservado.                                                     |
| `npm run verify`                | Ejecutar formato, documentación bilingüe, lint, tipos, pruebas y compilación.                                        |

Husky ejecuta `npm run verify` antes de los commits locales. CI está configurado para Node.js 24 en
Ubuntu 24.04, Windows 2025 y macOS 15; la cobertura y la auditoría de dependencias se ejecutan en
Linux. Las acciones de GitHub están fijadas a hashes inmutables de versiones publicadas y Dependabot
monitorea actualizaciones. Dependency Review y CodeQL se ejecutan en repositorios públicos; los
repositorios privados pueden habilitarlos con `DEPENDENCY_REVIEW_ENABLED=true` y
`CODEQL_ENABLED=true` después de confirmar la disponibilidad de GitHub Code Security.

## Límites actuales

- Solo una CLI local; no hay servicio, base de datos, telemetría ni dependencia de red del
  producto.
- Análisis estático únicamente; el código analizado nunca se ejecuta ni se importa.
- La raíz canónica es el límite de autorización del recorrido. Los enlaces se omiten de forma
  predeterminada; la opción interna para seguirlos solo acepta destinos canónicos dentro de la raíz
  y previene ciclos.
- El descubrimiento y el inventario siguen siendo etapas que producen candidatos, no una
  autorización permanente de archivos. La apertura de fuentes vuelve a validar raíz, ruta, identidad
  de archivo regular y contenido acotado del descriptor.
- El AST de Babel y el texto fuente permanecen dentro del paquete de procesamiento. Las reglas solo
  consumen el `AnalysisModel` normalizado.
- El reconocimiento de componentes es intencionalmente sintáctico y conservador; no resuelve alias
  en tiempo de ejecución, abstracciones de orden superior, importaciones ni comportamiento
  renderizado.
- La CLI completa integra el motor de dominio, un único `AuditResult` congelado recursivamente y los
  tres generadores de informes de M05. No define una política de fallo por hallazgos;
  `minimumSeverity` solo afecta la presentación de terminal.
- La duración de la auditoría termina cuando se construye el resultado inmutable y excluye la
  persistencia posterior de archivos. Un fallo posterior de escritura usa el código de salida `3`,
  puede dejar un archivo hermano o destino parcial ya escrito y nunca genera una afirmación falsa de
  creación ni una reversión automática insegura.

## Mapa del repositorio

- `src/cli/`: límite ejecutable y adaptador de Commander.
- `src/application/`: fachadas conservadas de escaneo y análisis de fuentes, además del orquestador
  agregado de la auditoría completa.
- `src/project/`: validación de la raíz y módulos focalizados de descubrimiento, inventario y
  clasificación.
- `src/parsing/`: lector de fuentes acotado, adaptador AST exclusivo para Babel, extracción y lote
  de candidatos con errores aislados.
- `src/domain/models/`: contratos normalizados de análisis independientes del analizador sintáctico
  y constructor.
- `src/domain/rules/`, `findings/` y `errors/`: contratos de resultados de reglas independientes de
  los informes.
- `src/domain/audit/`: resultado de auditoría versionado, errores normalizados de procesamiento,
  resúmenes derivados y límite de invariantes.
- `src/rules/`: motor validado y reglas estáticas organizadas por categoría.
- `src/configuration/`: lectura JSON acotada, validación cerrada, precedencia, valores
  predeterminados inmutables, valores de reemplazo, formatos, nombres de archivo y errores estables.
- `src/reporting/`: adaptadores puros para un único resultado en terminal, JSON sin pérdida y HTML
  independiente con escape, además de escritura exclusiva y compartida de archivos JSON y HTML.
- `src/shared/`: saneamiento neutral de valores para terminal reutilizado por la CLI y los informes.
- `tests/`: pruebas específicas de dominio, analizador sintáctico, reglas, aplicación, CLI y
  proyecto.
- `fixtures/m06-validation/`: contratos revisados para proyectos válidos, inválidos, mixtos,
  hostiles o de seguridad y grandes generados.
- `.github/harness/`: estado de hitos, planes, decisiones, riesgos y scripts del ciclo de vida.
- `.github/workflows/`: automatización de calidad, harness, CodeQL y revisión de dependencias.
- `docs/`: sistema de registro del producto y la ingeniería.
- `evidence/`: evidencia reproducible de los hitos.

Valida el harness en cualquier momento:

```bash
node .github/harness/scripts/validate-harness.mjs
node .github/harness/scripts/show-status.mjs
```

El escenario M05 sigue disponible para validar de forma independiente los límites de configuración
y generación de informes:

```bash
npm run test:scenario:m05
```

Ese escenario controlado valida cinco casos de configuración y presenta dos veces un resultado
inmutable con todos los grupos de severidad y etapas de procesamiento mediante terminal, JSON y
HTML. Verifica proyecciones exactas entre formatos, salida determinista, escape visible de valores
hostiles, CSP restrictiva en HTML y escrituras seguras en rutas fijas sin ejecutar el código
objetivo. `npm run evidence:m05` reproduce la puerta de calidad histórica de M05 en una instantánea
aislada de la fuente y sin credenciales. Las pruebas de humo de la CLI compilada también ejecutan la auditoría
integrada predeterminada, todos los formatos, precedencia entre configuración y CLI, filtros vacíos
de reglas, sintaxis recuperable y rechazo de destinos existentes.

El escenario de sistema M06 compila la CLI y audita dos veces cinco proyectos controlados en raíces
temporales nuevas:

```bash
npm run test:scenario:m06
```

El proyecto válido versionado no produce hallazgos; el proyecto inválido produce un hallazgo por
cada una de las ocho reglas estables; y el proyecto mixto ejercita JavaScript y TypeScript anidados,
salidas excluidas, tres hallazgos controlados y un error de sintaxis recuperable. El ejecutor también
construye un proyecto hostil o de seguridad con enlaces omitidos de forma predeterminada y un
proyecto seguro de 240 archivos a partir de parámetros versionados. Verifica códigos de salida,
consistencia exacta entre terminal, JSON y HTML, cantidades esperadas de hallazgos y errores,
proyecciones estables idénticas byte por byte y ausencia de indicadores de ejecución del código
objetivo.

`npm run test:accuracy:m06` ejecuta el flujo compilado de informe JSON sobre los proyectos válidos,
inválidos y mixtos versionados. Relaciona los hallazgos con 27 instancias fuente revisadas según
regla y ubicación semiabierta del modelo; después registra TP, FP, TN, FN, precisión, exhaustividad,
hallazgos sin correspondencia y observaciones no compatibles para cada regla estable. Los valores
actuales de 1.0 para precisión y exhaustividad describen únicamente este pequeño corpus controlado;
no afirman nada sobre proyectos React arbitrarios ni sobre comportamiento en tiempo de ejecución.

`npm run test:robustness:m06` ejecuta 15 casos de la CLI compilada sin usar un shell. La ejecución en
Linux aprobó raíces canónicas o inexistentes, un argumento scan ausente, configuración malformada,
autorización de salida para rutas y enlaces simbólicos, protección exclusiva contra sobrescritura,
aislamiento de fuentes malformadas, una fuente a 32 directorios de profundidad, tres enlaces creados
y excluidos, denegaciones reales de permisos del proyecto e informes, aserciones de estructura HTML
hostil y CSP, no ejecución del código objetivo y repeticiones deterministas en raíces nuevas. También
realiza cinco escaneos completos del proyecto generado con 240 archivos y registra distribuciones de
duración y observaciones muestreadas del RSS de procesos secundarios desde `/proc`, sin un umbral
dependiente de la máquina. La auditoría de dependencias con umbral moderado reportó cero
vulnerabilidades; CodeQL alojado se registra como no ejecutado porque no se recuperó un resultado
alojado.
