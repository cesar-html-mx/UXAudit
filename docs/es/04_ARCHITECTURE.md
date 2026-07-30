**Español** | [English](../04_ARCHITECTURE.md)

# Arquitectura

## Estilo

UXAudit utiliza una canalización de procesamiento por etapas con orquestación de aplicación y
contratos de dominio. El flujo principal está dirigido intencionalmente:

```text
CLI
  -> AuditOrchestrator
  -> ProjectDiscovery
  -> FileInventory
  -> FileClassifier
  -> SourceParser
  -> AnalysisModelBuilder
  -> RuleLoader / RuleEvaluator
  -> AuditResult
  -> Terminal / JSON / HTML Reporters
```

## Paquetes

```text
src/
├── cli/
├── application/
├── project/
│   ├── discovery/
│   ├── inventory/
│   └── classification/
├── parsing/
├── domain/
│   ├── models/
│   ├── rules/
│   ├── findings/
│   └── errors/
├── rules/
│   ├── ux/
│   ├── accessibility/
│   ├── seo/
│   └── performance/
├── reporting/
│   ├── terminal/
│   ├── json/
│   └── html/
├── configuration/
└── shared/
```

Los nombres exactos de los archivos pueden evolucionar, pero la dirección de las dependencias y los
límites de responsabilidad no pueden colapsarse sin una decisión de arquitectura.

## Composición de producción implementada

```text
src/cli/index.ts
  -> src/cli/run-cli.ts
       -> src/application/audit-project.ts
            -> src/project/validate-project-path.ts
            -> src/configuration/load-configuration.ts
            -> src/application/analyze-project.ts
            -> src/rules/load-rules.ts / evaluate-rules.ts
            -> src/domain/audit/audit-result.ts
            -> src/reporting/json/ and html/
            -> src/reporting/files/write-report-file.ts
       -> src/reporting/terminal/terminal-reporter.ts
       -> src/cli/sanitize-terminal.ts (compatibility re-export)
            -> src/shared/sanitize-terminal.ts
src/application/analyze-project.ts
  -> src/application/scan-project.ts
       -> validation / discovery / inventory / classification
  -> src/parsing/analyze-source-candidates.ts
       -> verified source read / Babel parse / AST-free extraction
  -> src/domain/models/build-analysis-model.ts
```

- `cli/index.ts` es el único límite del proceso. Proporciona los argumentos y flujos, y asigna
  `process.exitCode`.
- `run-cli.ts` es responsable de la gramática completa de Commander y del mapeo estable de salidas.
  Los llamadores existentes inyectados de solo escaneo y análisis conservan su comportamiento ya
  completado; producción proporciona la fachada de auditoría aditiva. Los errores de entrada de
  comando, ruta o configuración usan `2`, los errores fatales de canalización o informe usan `3`, y
  una auditoría completada usa `0` incluso con hallazgos o errores recuperables. El progreso, los
  diagnósticos y las afirmaciones de rutas generadas convierten controles no confiables y caracteres
  bidireccionales en escapes visibles. El informe de terminal, que ya es seguro, se escribe
  directamente para que el ANSI fijo y confiable no sea neutralizado por un segundo sanitizador de
  toda la salida.
- `audit-project.ts` autoriza la raíz, carga la configuración inerte antes del recorrido o análisis
  sintáctico, invoca `analyzeProject` exactamente una vez, carga y evalúa las reglas estables
  seleccionadas sobre su único modelo, construye un único resultado inmutable y después escribe los
  informes JSON/HTML seleccionados en orden canónico. Devuelve el progreso de análisis preservado, el
  resultado completado y únicamente los valores `WrittenReport` devueltos efectivamente por el
  escritor.
- `scan-project.ts` compone `validation → discovery → inventory → classification`, conserva cada
  resultado normalizado de etapa, calcula el resumen de descubrimiento y transforma los fallos
  fatales de etapa en errores estables de aplicación. M03 no cambia este contrato público de M02 ya
  completado.
- `analyze-project.ts` compone `scanProject → source-candidate analysis → model construction`. Los
  errores recuperables del analizador sintáctico permanecen separados del modelo y de los contadores
  de descubrimiento; los fallos fatales del análisis de fuentes y del modelo se transforman en
  errores estables de aplicación distintos y sin causas.
- `validate-project-path.ts` utiliza un adaptador inyectable del sistema de archivos para ejecutar
  `resolve → realpath → stat → access(R_OK | X_OK)`.
- Los módulos específicos del proyecto recorren mediante las API de Node, construyen un inventario
  con invariantes verificadas y clasifican candidatos del analizador sintáctico sin leer ni ejecutar
  código fuente.

## Contratos principales

### AuditApplication

Entrada: ruta del proyecto, ruta de configuración explícita opcional y valores de reemplazo de CLI
validados. Salida: `AnalyzeProjectResult` preservado, un `AuditResult` y afirmaciones exitosas y
ordenadas de `WrittenReport`.

M06 implementa este contrato de forma aditiva en `audit-project.ts`. Realiza una autorización inicial
de la ruta canónica para que la configuración pueda fallar antes del recorrido o análisis sintáctico
y luego pasa esa raíz canónica a la fachada de análisis ya completada. La fachada de análisis vuelve
a validar la raíz, pero realiza el descubrimiento, la lectura de fuentes, el análisis sintáctico y la
construcción del modelo una sola vez.

Las selecciones `null` de categoría o regla se omiten al construir los filtros de reglas de M04; los
arreglos vacíos explícitos permanecen presentes y habilitan cero reglas. Los contadores de archivos
corresponden exactamente a archivos descubiertos, candidatos de fuente, archivos analizados
sintácticamente y fallos del analizador. Un reloj inyectado cierra la medición inmediatamente antes
del constructor del resultado, por lo que el tiempo de persistencia no se representa como tiempo de
análisis.

Las rutas JSON/HTML configuradas forman parte del resultado antes del renderizado y no demuestran
éxito en el sistema de archivos. Los formatos de archivo se renderizan a partir de ese mismo valor
congelado y se persisten secuencialmente mediante el escritor de M05. Solo sus pares exactos de
formato y ruta devueltos entran en `writtenReports`. Un JSON exitoso seguido de un fallo de HTML se
propaga sin una eliminación insegura ni una afirmación de resultado completado.

### ProjectDiscovery

Entrada: raíz del proyecto validada y configuración de descubrimiento.
Salida: registros de archivos descubiertos y errores de descubrimiento recuperables.

M02 implementa este contrato mediante un recorrido iterativo ordenado ordinalmente. La raíz canónica
seleccionada permanece como límite de autorización. Cada destino candidato se resuelve de forma
canónica y se comprueba mediante contención relativa a la ruta; los nombres configurados se
comprueban tanto en la entrada observada como en el destino canónico. Los enlaces simbólicos se
omiten de forma predeterminada, mientras que la activación interna solo sigue destinos dentro de la
raíz y registra los directorios canónicos visitados. Los fallos de operaciones descendientes se
normalizan y aíslan; perder la raíz es fatal.

### FileInventory

Normaliza rutas canónicas y relativas al proyecto, elimina entradas duplicadas y devuelve un orden
determinista.

M02 define la identidad como la ruta canónica absoluta del archivo. Las entradas del inventario
conservan esa ruta absoluta nativa, derivan una ruta relativa al proyecto portátil separada por `/`,
normalizan a minúsculas la extensión final y solo contienen el tipo `file` justificable. Los alias
canónicos se deduplican y las entradas se ordenan ordinalmente por ruta relativa. Un registro que no
sea descendiente es un fallo interno de invariantes.

### FileClassifier

Selecciona candidatos de fuente compatibles. La clasificación puede utilizar la extensión y señales
conservadoras del código fuente. No debe afirmar falsamente que toda extensión compatible es un
componente de React.

M02 deriva el sufijo real de la ruta relativa portátil del inventario y asigna los archivos
compatibles únicamente a JavaScript/TypeScript y tipos de analizador con o sin JSX. Excluye
declaraciones y fuentes de configuración con nombres convencionales, no lee el contenido de los
archivos y no expone ningún campo de componente de React. La detección semántica permanece
exclusivamente en las etapas de analizador y modelo de M03.

### SourceParser

Analiza sintácticamente un archivo fuente y devuelve un resultado del analizador o un error por
archivo con tipo. Los detalles internos del analizador no deben filtrarse a las reglas.

M03 define este límite como un `SourceParserResult` discriminado. Un resultado exitoso contiene un
`AnalyzedSourceFile` normalizado y sin AST; un problema esperado de lectura, sintaxis o extracción
contiene un error recuperable estable con la ruta de archivo portátil, la etapa, el código y una
posición de fuente opcional. Las causas nativas del sistema de archivos o Babel, los marcos de código,
las rutas absolutas, el texto fuente y los valores AST no forman parte del contrato.

El adaptador de Babel 8 está aislado en `src/parsing/babel/`. Analiza exactamente una cadena
proporcionada, no carga configuración de Babel del proyecto ni del host y selecciona complementos
según el tipo de fuente clasificada: JavaScript, JavaScript con JSX, TypeScript o TypeScript con JSX.
Utiliza detección inequívoca de script o módulo, conserva ubicaciones y el nombre de archivo relativo,
desactiva la recuperación parcial de errores y normaliza los fallos lanzados por el analizador antes
de que salgan del límite del adaptador.

M03-T05 agrega las mitades de apertura de fuentes y procesamiento por lotes del límite:

- `read-source-candidate.ts` trata el inventario de M02 como candidatos, no como autorización. Valida
  que la raíz proporcionada sea su directorio canónico absoluto estable, comprueba la contención del
  candidato declarado y canónico, y compara dispositivo/inodo, tamaño, hora de modificación y hora
  de cambio entre instantáneas de ruta y descriptor. Una declaración de candidato estructuralmente
  no portátil es una invariante fatal genérica, por lo que no puede reflejarse en un campo de ruta
  recuperable.
- Las aperturas POSIX usan indicadores de solo lectura, sin seguimiento y sin bloqueo; Windows usa
  el indicador portátil de solo lectura y las mismas comprobaciones de identidad posteriores a la
  apertura. El descriptor verificado es la única ruta de lectura del contenido fuente y se cierra
  exactamente una vez.
- El tamaño de la fuente está limitado a 1,048,576 bytes. Las lecturas solicitan como máximo 65,536
  bytes y un byte adicional acotado detecta crecimiento por encima del límite. La decodificación
  UTF-8 estricta rechaza bytes malformados; `ignoreBOM: true` conserva un U+FEFF inicial en la cadena
  proporcionada a Babel.
- `parse-source-candidate.ts` compone el lector, el analizador de Babel y el extractor en ese orden.
  Un resultado recuperable detiene únicamente las etapas restantes para ese candidato; la cadena de
  fuente transitoria y el AST de Babel nunca cruzan el límite compuesto.
- `analyze-source-candidates.ts` clona y ordena ordinalmente los candidatos, rechaza rutas duplicadas
  o no coincidentes como invariantes fatales y procesa un candidato a la vez. Los fallos esperados de
  lectura, análisis sintáctico y extracción se recopilan en orden determinista mientras los elementos
  relacionados seguros continúan.

M03-T03 agrega el adaptador interno de extracción de Babel al dominio. Visita el AST una vez, hasta
100,000 nodos, y luego ordena los registros extraídos por desplazamiento en la fuente con criterios de
desempate ordinales. El adaptador reconoce declaraciones de funciones PascalCase justificadas
sintácticamente, expresiones de flecha o de función, formas de clase compatibles de `Component` o
`PureComponent` y exportaciones predeterminadas anónimas. Una clase posee JSX únicamente a través de
su método de instancia `render`; las funciones anidadas y los miembros de clase forman límites de
pertenencia. El JSX dentro de un atributo se conserva como una raíz de relación separada en lugar de
como hijo renderizado del elemento receptor.

La sintaxis intrínseca, personalizada, de miembro o espacio de nombres, de fragmento abreviado y de
`React.Fragment` se proyecta a nombres y tipos de nodo de UXAudit. Los atributos con nombre y
propagados conservan el orden de la fuente. Los valores primitivos finitos y de plantillas estáticas
son exactos; las propiedades acotadas de objetos se conservan como datos ordenados; los valores
calculados, propagados, no finitos, profundos o no resueltos de otra manera permanecen parciales o
dinámicos. El texto descendiente se normaliza en espacios en blanco con confianza exacta, parcial o
dinámica y conserva como máximo 256 unidades de código UTF-16 por nodo JSX. Los descendientes
personalizados y las expresiones dinámicas no pueden promoverse a texto exacto.

Los casos esperados de ubicación faltante o límite de recursos se convierten en errores recuperables
estables de extracción. Las invariantes internas rotas del recorrido o las relaciones son fatales y
solo exponen el `BabelAnalysisInvariantError` estable, no detalles nativos del analizador. Los nodos
de Babel, las cadenas de fuente, las causas nativas y las rutas absolutas permanecen dentro del
límite del adaptador.

### AnalysisModelBuilder

Convierte la salida del analizador en modelos de dominio de UXAudit que contienen únicamente la
información justificable necesaria para las reglas. Conserva las ubicaciones de fuente y puede
extenderse deliberadamente.

Los contratos de M03 utilizan un modelo plano serializable de archivos, componentes justificados
sintácticamente y nodos JSX conectados mediante ID deterministas. Los elementos distinguen nombres
intrínsecos de personalizados; los fragmentos permanecen explícitos; los atributos distinguen valores
con nombre de valores propagados; y los valores o el texto incluyen confianza exacta, parcial o
dinámica. Los objetos literales conservan propiedades acotadas con nombre para que el catálogo inicial
pueda inspeccionar `style.fontSize` sin conservar un árbol de expresiones.

Cada ubicación contiene una ruta de archivo portátil relativa al proyecto y un rango de fuente
semiabierto. Las líneas comienzan en uno; las columnas y los desplazamientos son índices de unidades
de código UTF-16 que comienzan en cero. El modelo no contiene ni la raíz absoluta del proyecto ni el
contenido fuente completo.

M03-T03 implementa la mitad de extracción por archivo de este límite: los registros de archivo,
componente, JSX, atributo, propiedad de objeto, relación, confianza y ubicación no contienen AST y
son deterministas.

M03-T04 implementa la mitad del proyecto mediante `buildAnalysisModel`. El constructor trata cada
`AnalyzedSourceFile` como entrada del límite y proyecta recursivamente únicamente los campos
documentados en objetos y arreglos nuevos. Nunca conserva referencias de entrada ni elementos
adicionales del analizador o de la fuente. Los archivos se ordenan ordinalmente por la ruta relativa
portátil canónica; los componentes y nodos JSX se reconstruyen en orden de archivo y fuente, y cada
ID proporcionado debe ser igual al valor canónico derivado de esa ruta y del desplazamiento inicial
UTF-16. El orden de los atributos y las propiedades de objetos sigue siendo significativo respecto a
la fuente. Los arreglos normalizados y planos ya satisfacen las necesidades documentadas de las
reglas, por lo que no se expone una API de consultas especulativa.

La construcción valida coordenadas de enteros seguros, coherencia entre ubicaciones y contención; ID
canónicos y únicos; pertenencia y propiedad exactas de archivos o componentes; conjuntos no vacíos de
raíces de componentes; enlaces recíprocos y con el mismo propietario entre elementos padre e hijo; y
grafos JSX acíclicos. También valida discriminantes compatibles, valores literales finitos,
combinaciones de confianza exacta, dinámica o parcial, longitud del texto estático, profundidad
acotada de objetos y entrada cíclica de objetos. `usesJsx` debe coincidir con el inventario JSX. Los
caracteres de control y bidireccionales en una ruta de archivo que por lo demás sea portátil
permanecen como datos no confiables en lugar de normalizarse; los límites de presentación posteriores
son responsables del escape.

Cualquier entrada malformada del constructor es un fallo interno de integridad. El límite captura sus
detalles y lanza únicamente el `AnalysisModelInvariantError` fatal, cuyo código y mensaje estables no
contienen entradas, causas nativas, rutas absolutas ni texto fuente.

### Rule

M04-T01 define una `Rule` inmutable como:

- `RuleMetadata`: ID estable, título, categoría, severidad predeterminada, estado del catálogo,
  explicación, recomendación aplicable, referencia estructurada anulable y limitaciones explícitas;
- `RuleContext`: el `AnalysisModel` normalizado y ningún estado del analizador ni del generador de
  informes;
- una operación síncrona `evaluate` que devuelve cero, una o varias observaciones locales de la regla
  con un mensaje, confianza y `SourceLocation` anulable.

Las categorías son `accessibility`, `performance`, `seo` y `ux`. Las severidades son `info`, `low`,
`medium`, `high` y `critical`; la confianza del hallazgo es, de forma independiente, `low`, `medium`
o `high`. Una regla es independiente del formato del informe, no importa Babel y no depende de la
ejecución de otra regla.

### Finding

M04-T01 normaliza una observación de regla y sus metadatos en un único `Finding` autónomo. Conserva
ID y título de la regla, categoría, severidad, mensaje, explicación, recomendación, referencia,
limitaciones, confianza y una copia defensiva anulable de la ubicación de fuente semiabierta completa
de M03. Las coordenadas siguen comenzando en uno para las líneas y en cero para las columnas o
desplazamientos. La conversión de línea o columna específica de la presentación pertenece a los
generadores de informes de M05.

Los fallos de reglas no son hallazgos. Un `RuleExecutionError` recuperable contiene únicamente el ID
de la regla, la categoría, el código y el mensaje estables y el indicador de recuperabilidad; las causas
nativas y el contenido del proyecto de destino no cruzan este límite. `RuleEvaluationResult`
mantiene los hallazgos, errores de ejecución y contadores explícitos disponibles, habilitados,
exitosos, fallidos y de hallazgos sin ningún estado de presentación. El contador de ejecutadas
registra cada regla habilitada que se intentó y es igual a exitosas más fallidas.

### RuleEvaluator

M04-T02 separa el registro, la carga y la evaluación:

- `createRuleRegistry` valida y copia defensivamente una lista explícita de reglas, rechaza mediante
  errores fatales estables los metadatos malformados, las referencias inseguras o que no sean
  HTTP(S), las reglas diferidas ejecutables o los ID duplicados; congela los contratos registrados y
  los ordena ordinalmente por ID de regla.
- `loadRules` valida listas de permitidos opcionales de categorías e ID de reglas. Cuando ambas
  existen, se intersecan; una lista de permitidos vacía no selecciona reglas, un ID de regla
  desconocido es un error y la ausencia de filtros selecciona la parte estable y requerida del
  registro explícito. Las reglas experimentales requieren una inclusión explícita por ID exacto de
  regla. Los contenedores no válidos, las claves desconocidas y los descriptores de acceso que lanzan
  fallan de forma cerrada.
- `evaluateRules` llama exactamente una vez a cada regla cargada sobre el mismo `AnalysisModel`
  confiable. Los fallos de evaluación lanzados y los resultados malformados se convierten en errores
  recuperables estables por regla. El lote de candidatos completo de una regla malformada se descarta
  antes de aceptar resultados seguros relacionados.

Cada ubicación no nula de hallazgo debe coincidir exactamente con la ubicación de un archivo,
componente, nodo JSX, atributo o propiedad de objeto conservada en el modelo. Esto impide que el
resultado de una regla introduzca una ruta absoluta o imposible de rastrear. Los hallazgos aceptados
se ordenan por ID de regla, ruta de archivo portátil, desplazamientos inicial y final y mensaje; los
errores de ejecución se ordenan por ID de regla. El resultado registra los conteos disponibles,
habilitados, ejecutados, exitosos, fallidos y de hallazgos.

El aislamiento supone que el modelo de M03 permanece válido y que las reglas respetan el contrato de
solo lectura. El motor congela profundamente ese modelo una vez antes de la evaluación para que una
conversión insegura en tiempo de ejecución no pueda mutarlo y contaminar una regla posterior. No
clona ni vuelve a analizar el proyecto para cada regla.

`initialRuleRegistry` ensambla explícitamente las ocho reglas estables de M04: tres de accesibilidad,
dos de rendimiento, dos de SEO y una de UX. Los módulos de categorías siguen siendo comprobables de
forma independiente; el registro es el catálogo predeterminado canónico y ordena sus ID antes de
cargarlos. Las fábricas específicas de reglas capturan frases validadas de enlaces ambiguos y el
umbral de píxeles para texto en línea sin agregar configuración mutable a `RuleContext`.

### Reporter

M05-T01 define un generador de informes puro como una identidad de formato más
`render(result): string`. Transforma exactamente un `AuditResult` completado en una representación y
nunca descubre, analiza sintácticamente, vuelve a evaluar reglas, muta el resultado ni escribe
mediante el contrato de dominio. Los adaptadores de terminal, JSON y HTML y su escritor opcional del
sistema de archivos permanecen como límites de presentación.

M05-T03 implementa el adaptador de terminal como texto LF determinista. Conserva el orden canónico de
hallazgos y errores, usa grupos completos del resumen, filtra únicamente los registros de hallazgos
mostrados mediante la severidad configurada inclusiva, convierte las columnas iniciales almacenadas
en etiquetas que comienzan en uno e incluye errores individuales de procesamiento normalizados solo
cuando el modo detallado está activo. Un sanitizador compartido neutral convierte controles no
confiables, marcadores bidireccionales, BOM y sustitutos sin pareja en escapes visibles antes de que
el generador agregue ANSI fijo alrededor de las insignias. No inspecciona el proceso, TTY, entorno ni
estado del sistema de archivos.

M05-T04 implementa el adaptador JSON como el `AuditResult` exacto proporcionado, codificado mediante
`JSON.stringify` con dos espacios y un LF. No omite la medición ni convierte coordenadas del dominio;
tampoco ordena, proyecta ni muta datos. JSON y HTML comparten un escritor separado: el renderizado permanece
puro, mientras que la persistencia valida el destino exacto de formato fijo y devuelve una ruta
relativa solo después de completarse.

M05-T05 implementa HTML como otro adaptador puro. Construye una estructura HTML5 semántica fija con
CSS en línea constante y una CSP restrictiva, incluye metadatos, configuración y resúmenes completos,
así como cada hallazgo o error normalizado, y agrupa los registros mediante órdenes fijos de
enumeraciones sin ordenar la entrada. Los ajustes de severidad y detalle exclusivos de la terminal
se informan, pero no suprimen datos HTML. El renderizador convierte columnas en etiquetas humanas que
comienzan en uno, conserva tanto los desplazamientos como el contrato de final exclusivo, neutraliza
Unicode hostil antes del escape HTML específico del contexto y vuelve a analizar enlaces potenciales
en URL HTTP(S) sin credenciales o texto inerte. `writeHtmlReport` delega los bytes exactos
renderizados y la ruta configurada fija al escritor compartido.

### Configuration

La configuración M05 normalizada es un valor completo con versión de esquema que incluye filtros de
categorías y reglas, formatos seleccionados de terminal, JSON y HTML, un directorio de salida portátil
relativo al proyecto, severidad mínima de presentación, color y nivel de detalle. Los filtros `null`
representan el catálogo estable predeterminado; los arreglos vacíos habilitan intencionalmente cero
reglas. Los valores predeterminados seleccionan salida de terminal, `info`, color, detalle no
verboso y `uxaudit-reports`.

M05-T02 separa la autorización del sistema de archivos de la normalización de datos. El lector
autoriza la raíz canónica y el nombre de archivo convencional, o trata una ruta de configuración
explícita como autoridad separada del usuario; rechaza enlaces y archivos no regulares, así como
cambios observados de raíz, ruta o descriptor, lee como máximo 64 KiB y decodifica UTF-8 estricto. El
cargador analiza JSON, valida registros cerrados de datos propios de versión 1 y arreglos densos
acotados, resuelve los ID de reglas contra el registro estable, vuelve canónico el orden de selección
y combina `defaults < file < CLI`. La configuración devuelta es una copia defensiva congelada. No se
importa ni ejecuta ningún módulo de configuración del proyecto. El adaptador Commander de M06
construye la capa de CLI únicamente a partir de opciones cuya fuente de valor sea explícitamente
`cli`; por lo tanto, los valores predeterminados del marco de trabajo no pueden ocultar los ajustes
del archivo.

### AuditResult

M05-T01 define el esquema `1.0.0` de `AuditResult` como el único valor congelado recursivamente que
consume cada generador de informes. Contiene:

- la configuración normalizada más las versiones de herramienta y esquema;
- la raíz canónica del proyecto y las marcas de tiempo UTC canónicas de inicio y finalización con su
  duración;
- contadores de archivos descubiertos, seleccionados, analizados sintácticamente y fallidos;
- los contadores completos de M04 disponibles, habilitados, ejecutados, exitosos, fallidos y de
  hallazgos, junto con los hallazgos;
- errores normalizados recuperables de descubrimiento, errores de lectura, análisis sintáctico o
  extracción de fuentes y errores de reglas;
- totales explícitos para cada categoría, severidad y etapa de procesamiento, incluidos los grupos
  con valor cero; y
- rutas JSON/HTML anulables relativas al proyecto, resueltas a partir del directorio de salida
  controlado y los nombres fijos `audit-report.json` y `audit-report.html`.

Las rutas anulables son destinos seleccionados o configurados, no recibos de persistencia. La lista
`writtenReports` separada de M06 contiene únicamente las rutas confirmadas por el escritor que la CLI
puede anunciar.

El constructor copia defensivamente los datos anteriores, deriva resúmenes, restaura el orden
canónico de hallazgos o errores, rechaza contadores contradictorios o datos de límite malformados
mediante un error de invariante sin detalles y congela el resultado sin congelar la entrada propiedad
del llamador. Las coordenadas de fuente almacenadas conservan las líneas que comienzan en uno y las
columnas o desplazamientos UTF-16 que comienzan en cero de M03. Los generadores de informes para
personas pueden convertir las columnas para mostrarlas; JSON debe conservar las coordenadas del
dominio.

## Persistencia

La versión inicial no tiene base de datos. La configuración, JSON y HTML son archivos locales. El
inventario transitorio, la salida del adaptador AST, el modelo y los hallazgos permanecen en memoria
durante una auditoría. Actualmente, el producto no genera un formato de registro de ejecución.

El escritor compartido de informes crea un directorio de salida aprobado, un segmento a la vez,
vuelve a autorizar la raíz canónica y las identidades de dispositivo e inodo del directorio, rechaza
enlaces y escapes de ruta, y abre el destino fijo con creación exclusiva (`O_NOFOLLOW` en POSIX).
Escribe UTF-8 en fragmentos posicionales acotados, sincroniza, verifica las instantáneas de ruta y
descriptor, cierra exactamente una vez y repite la autorización final antes de exponer un registro de
éxito congelado y relativo al proyecto. Las API portátiles de Node no ofrecen una garantía
multiplataforma `openat` relativa al descriptor de directorio, por lo que las carreras observables
fallan de forma cerrada, pero permanece una carrera residual de nombres de ruta. Los fallos posteriores
a la creación pueden conservar un destino parcial en lugar de arriesgar la eliminación de una ruta
reemplazada.

## Límites de errores

- CLI, ruta o configuración no válidas: detener después de la autorización mínima de raíz necesaria
  para la configuración y antes del recorrido o análisis sintáctico.
- Fallo fatal de descubrimiento, inventario o clasificación: detener con un error estable de
  aplicación.
- Error descendiente de descubrimiento o error esperado de lectura, análisis sintáctico o extracción:
  registrarlo y continuar con otros archivos cuando sea seguro.
- Declaración de candidato no portátil, pérdida de autorización de la raíz canónica, invariante del
  lote de candidatos, invariante inesperada de extracción o modelo normalizado no válido: detener con
  un error fatal estable.
- Error de una regla individual: registrarlo y continuar con las demás reglas cuando la integridad
  del modelo siga siendo válida.
- Fallo de escritura del informe: devolver la salida `3`, informar claramente el fallo estable y no
  afirmar que se completó el conjunto de informes. Un elemento relacionado anterior o un destino
  parcial puede permanecer sin reversión.
- Fallo interno de invariantes: detener con un error irrecuperable.

## Límites de seguridad

Los proyectos analizados son entradas no confiables. Nunca se debe ejecutar su código ni importar sus
módulos; tampoco se debe interpolar su texto en HTML sin escape ni recorrer fuera de la raíz
aprobada.

El usuario puede seleccionar explícitamente cualquier raíz, incluida una alcanzada mediante `..` o
un enlace simbólico. UXAudit utiliza el `realpath` canónico de esa raíz como límite aprobado. M02
comprueba cada descendiente canónico recorrido contra esa raíz antes de leer metadatos fuera del
límite y maneja los fallos reales de las operaciones. M03 vuelve a autorizar la raíz y cada fuente
alrededor de una lectura acotada por descriptor y falla de forma cerrada ante cambios observados. Las
API portátiles del sistema de archivos aún no pueden eliminar un reemplazo en el intervalo entre la
comprobación final de la ruta y su uso posterior; por lo tanto, el comportamiento descendente consume
únicamente los bytes ya leídos del descriptor y conserva explícitamente este límite TOCTOU residual.
