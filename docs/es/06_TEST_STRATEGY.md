**Español** | [English](../06_TEST_STRATEGY.md)

# Estrategia de pruebas

Las pruebas respaldan tanto la verificación —construir el producto correctamente— como la
validación —confirmar que sirve para el uso previsto—.

Cada caso de prueba debe identificar:

1. objetivo;
2. entradas;
3. resultado esperado;
4. entorno;
5. ejecución;
6. resultado observado y conclusión.

## Pruebas unitarias

Se enfocan en el comportamiento significativo más pequeño:

- validación de rutas;
- exclusiones y descubrimiento;
- normalización y desduplicación del inventario;
- clasificación de fuentes;
- configuración del parser y conservación de ubicaciones;
- transformación del modelo;
- comportamiento de las reglas;
- normalización y orden de los hallazgos;
- validación de la configuración;
- escape y serialización de los generadores de informes.

Cada regla requiere:

- fixture positivo;
- fixture negativo;
- fixture de límite o de valor no compatible cuando sea pertinente;
- conteo esperado exacto de hallazgos y campos importantes.

## Pruebas de integración

Límites requeridos:

- opciones de la CLI -> solicitud de la aplicación;
- descubrimiento -> inventario -> clasificación;
- parser -> modelo;
- modelo -> cargador de reglas -> evaluador;
- `AuditResult` -> cada generador de informes;
- servicio completo de la aplicación sin iniciar un shell.

## Pruebas de sistema y de extremo a extremo

Ejecuta la CLI instalada/compilada con proyectos React/TypeScript controlados y verifica:

- código de salida;
- resumen de consola;
- archivos generados;
- identidades y ubicaciones de los hallazgos;
- errores recuperables del parser;
- comportamiento ante una ruta o configuración no válida;
- nuevas ejecuciones deterministas.

## Proyectos de validación controlados

Mantén al menos:

- `valid-project`: implementaciones que no deben producir ninguno de los hallazgos seleccionados.
- `invalid-project`: una o más infracciones conocidas para cada regla estable.
- `mixed-project`: JavaScript/TypeScript, carpetas anidadas, salida excluida y casos límite de
  sintaxis.
- `security-project`: nombres/textos maliciosos, enlaces simbólicos y cadenas de inyección HTML.
- `large-project`: componentes repetidos generados para medir el rendimiento.

Los resultados esperados se versionan y revisan.

## Medidas de exactitud

Para cada regla estable, registra:

- verdaderos positivos;
- falsos positivos;
- verdaderos negativos cuando sean significativos;
- falsos negativos;
- precisión = TP / (TP + FP);
- exhaustividad = TP / (TP + FN).

No combines todas las reglas en una sola puntuación sin conservar los resultados por regla.

## Usabilidad

La CLI y los informes son la interfaz de usuario. Valida tareas como:

- descubrir cómo ejecutar un análisis;
- analizar un proyecto;
- identificar el hallazgo de mayor prioridad;
- ubicar el archivo fuente;
- comprender la recomendación;
- encontrar el informe JSON/HTML.

Registra finalización, tiempo, errores, retrocesos, comentarios y un cuestionario SUS cuando haya
participantes disponibles. Si no hay participantes reales disponibles, distingue claramente la
revisión heurística experta de las pruebas con personas usuarias.

## Seguridad y robustez

Ejecuta la lista de comprobación de `07_SECURITY.md`, la auditoría de dependencias, las pruebas de
contenido malicioso de informes, límites de rutas, enlaces simbólicos, fuentes malformadas, fallos de
permisos de salida y límites de recursos.

## Evidencia

Almacena comandos, entorno, versiones de herramientas, resultados legibles por máquina, muestras
seleccionadas de salida y conclusiones humanas bajo `evidence/`. Nunca fabriques un resultado que no
se haya ejecutado.

## Línea base ejecutada de M01

- Las pruebas Vitest enfocadas cubren los metadatos del producto, ayuda/versión/delegación de la CLI
  y correspondencia de códigos de salida, orquestación de la aplicación, validación de la raíz del
  proyecto y presentación de controles hostiles en la terminal.
- La integración con el sistema de archivos usa directorios temporales controlados; los errores de
  permisos y carreras usan un adaptador inyectado en lugar de `chmod`, que depende de la plataforma.
- La cobertura V8 exige umbrales globales de 90% para sentencias, ramas, funciones y líneas.
- Un ejecutor smoke portable de Node.js prueba los escenarios de ayuda, versión, directorio válido,
  ruta inexistente, archivo regular y argumento ausente contra la CLI compilada sin un shell.
- La matriz de CI de Node.js 24 cubre Ubuntu, Windows y macOS. Linux también exige cobertura y
  rechaza vulnerabilidades de npm de severidad moderada o superior.

## Línea base ejecutada de M02

- Las pruebas unitarias cubren exclusiones predeterminadas/personalizadas exactas, recorrido ordinal,
  fallos fatales frente a recuperables del sistema de archivos, comportamiento predeterminado y
  opcional de enlaces simbólicos, enlaces externos/cíclicos/rotos, carreras de contención canónica,
  invariantes/desduplicación del inventario y la matriz de candidatos fuente.
- La prueba de integración de la aplicación con sistema de archivos real ejecuta
  `validation → discovery → inventory → classification` dos veces sobre un proyecto temporal mixto,
  afirma resultados normalizados idénticos y demuestra que no se crea el centinela de su script de
  package.
- El conjunto smoke de la CLI compilada conserva los seis escenarios de M01 y ahora afirma el resumen
  estable de descubrimiento de un proyecto vacío.
- El escenario controlado de M02 versiona JSON esperado y real para 10 entradas canónicas de
  inventario, cinco candidatos, exclusiones, política predeterminada y opcional de enlaces, dos
  ejecuciones idénticas byte por byte y ausencia de ejecución del código objetivo.
- La ejecución aislada de evidencia con Node.js `24.18.0` realiza una instalación limpia bloqueada,
  el criterio completo, cobertura, smoke y escenario controlado, validación del harness y auditoría
  de dependencias. El conjunto medido contiene 66 pruebas que pasan en nueve archivos, con 99.64% de
  sentencias/líneas, 100% de funciones y 94.15% de ramas; el registro JSON de pruebas también debe
  demostrar cero pruebas omitidas o todo.

## Línea base ejecutada del parser/extracción de M03-T03

- Las pruebas de extracción con Babel cubren declaraciones de funciones PascalCase, expresiones
  arrow/de función, variantes compatibles de clases React, exportaciones predeterminadas anónimas,
  candidatos inactivos, límites de propiedad de renderizado de clase y funciones anidadas, además de
  JSX insertado en atributos.
- Los casos JSX cubren formas intrínsecas, personalizadas, de miembro/con espacio de nombres,
  fragmento abreviado y `React.Fragment`; relaciones bidireccionales exactas entre
  padre/hijo/componente/raíz; atributos con nombre, abreviados y propagados; valores primitivos
  finitos, de plantilla estática, objeto acotado, dinámicos, parciales, no finitos, profundos y
  sensibles al prototipo.
- Las aserciones de texto distinguen confianza exacta, parcial y dinámica, incluidos elementos hijos
  de expresiones primitivas, JSX anidado, incertidumbre de elementos hijos personalizados,
  normalización de espacios en blanco y el límite de conservación de 256 unidades de código UTF-16.
- Las aserciones de ubicación verifican archivos completos, JSX multilínea, atributos, propiedades
  de objetos, propagaciones, fragmentos, offsets UTF-16 y rangos con extremo final exclusivo. Las
  ejecuciones deterministas y las inspecciones de claves serializadas demuestran que no escapan los
  nodos de Babel, metadatos nativos, texto fuente ni rutas absolutas de fixtures.
- Los casos de recursos y robustez cubren el contrato máximo de 100,000 nodos, límites configurados
  no válidos, ausencia de ubicaciones requeridas y normalización fatal estable de fallos inesperados
  del recorrido.
- El criterio ejecutado con Node.js `24.18.0` pasó 22 pruebas enfocadas de extracción y las 106
  pruebas del repositorio. El formato, lint, typecheck y compilación pasaron; la cobertura V8 global
  midió 97.17% de sentencias, 90.71% de ramas, 100% de funciones y 97.13% de líneas.

## Línea base ejecutada del constructor de modelos de M03-T04

- Las pruebas del constructor cubren el modelo vacío canónico, entrada invertida de varios archivos,
  orden ordinal de rutas portables, orden global determinista de entidades, conservación del orden
  fuente para atributos y propiedades de objetos, proyección defensiva profunda, inmutabilidad de la
  entrada y eliminación de elementos adicionales de AST/fuente.
- Los casos de rutas, ID y coordenadas rechazan duplicados, rutas absolutas/de Windows/con
  diagonales invertidas/segmentos de punto, ID no canónicos, rangos no válidos, correspondencias
  incoherentes de offset/línea/columna, rutas de archivos que no coinciden y ubicaciones fuera de los
  contenedores de archivo/componente/padre/atributo/propiedad.
- Los casos de relaciones ejercitan pertenencia exacta a archivo y componente, propiedad, conjuntos
  raíz, reciprocidad y orden padre/hijo, referencias ausentes y entre archivos, gráficos
  propios/cíclicos y congruencia de `usesJsx`.
- Los casos de valores cubren discriminantes, nombres y lenguajes compatibles; estados de texto
  exacto/dinámico/parcial; literales primitivos finitos; confianza, orden de propiedades y contención
  de objetos; claves sensibles al prototipo; ciclos de objetos; y los límites de profundidad/texto
  establecidos por T03.
- Los caracteres de control hostiles se conservan como datos inertes del modelo, mientras cada caso
  de entrada malformada produce el mismo `AnalysisModelInvariantError` fatal sin una causa, valor
  rechazado, ruta sensible ni detalle de la fuente.
- El criterio ejecutado con Node.js `24.18.0` pasó 26 pruebas enfocadas del constructor y las 132
  pruebas del repositorio en 16 archivos. El formato, lint, typecheck y compilación pasaron; la
  cobertura V8 global midió 97.00% de sentencias (973/1003), 90.31% de ramas (634/702), 100% de
  funciones y 96.95% de líneas.

## Línea base ejecutada de integración/aislamiento de M03-T05

- Las pruebas del lector seguro cubren contención declarada/canónica, redireccionamiento y pérdida
  de identidad de la raíz, cambios en snapshots de ruta/handle, archivos sustituidos no regulares,
  flags POSIX sin seguimiento/no bloqueantes, la ruta de solo lectura en Windows, comportamiento
  exacto de cierre y normalización estable de errores sin filtrar rutas/mensajes nativos.
- Los casos de límites de bytes aceptan exactamente 1 MiB, rechazan crecimiento inicial u observado
  por encima de este valor, limitan cada solicitud del descriptor a 64 KiB, detectan lecturas cortas
  o no válidas, rechazan UTF-8 malformado y demuestran que un BOM inicial sobrevive tanto las rutas
  inyectadas como las del sistema de archivos de producción.
- Las pruebas de composición demuestran delegación estricta `read → Babel parse → extraction`,
  cortocircuitan cada etapa recuperable, propagan fallos fatales y no serializan ninguna cadena de
  fuente ni AST mediante el resultado público del parser.
- Las pruebas por lotes demuestran entrada ordinal clonada, ejecución secuencial, salida
  determinista, invariantes de duplicados y rutas de resultados, cortocircuito fatal y continuación
  independiente después de fallos de lectura, parsing y extracción.
- Las pruebas de integración de aplicación y sistema de archivos real conservan el resultado
  completo de `scanProject`, mantienen separados los resúmenes de descubrimiento y parsing, aíslan
  la sintaxis malformada mientras modelan elementos relacionados seguros, conservan ubicaciones y
  demuestran que los centinelas inertes del código objetivo nunca se ejecutan. Las pruebas de la CLI
  conservan la compatibilidad de dependencias de solo scan y verifican la tercera línea de resumen
  de producción más la correspondencia estable de salida de errores fatales.
- El criterio ejecutado con Node.js `24.18.0` pasó las 208 pruebas del repositorio en 21 archivos. El
  formato, lint, typecheck y compilación pasaron; la cobertura V8 global midió 97.63% de sentencias,
  91.86% de ramas, 100% de funciones y 97.59% de líneas.

## Línea base ejecutada de reglas/catálogo de M04

- Cada regla estable tiene aserciones enfocadas positivas, negativas, múltiples, de límite, no
  compatibles, de metadatos y de ubicación. Los valores dinámicos/propagados, las abstracciones
  personalizadas, la propiedad de componentes, la sintaxis literal, los accessors/proxies de
  configuración y las limitaciones advisory tienen casos explícitos.
- Las pruebas de registro/cargador/evaluador cubren contratos malformados, ejecución exacta una vez,
  intersección de categoría/ID, activación opcional de elementos experimentales, inmutabilidad
  profunda del modelo, validación transaccional de salida, procedencia canónica de ubicaciones,
  orden/contadores deterministas y continuación recuperable de elementos relacionados.
- El escenario controlado compilado analiza un proyecto TSX inerte sin ejecutar su centinela y
  produce exactamente un hallazgo normalizado por cada una de las ocho reglas estables. El resultado
  completo coincide byte por byte con un JSON esperado y revisado en dos ejecuciones.
- Las proyecciones conservadas del escenario incluyen una matriz positiva/segura/no compatible,
  muestras completas de hallazgos, metadatos y limitaciones, filtros
  predeterminados/categoría/intersección/ID/vacíos, rechazo de ID desconocidos y una novena regla que
  lanza un error cuyo error estable conserva los ocho hallazgos relacionados.
- El criterio aislado de evidencia con Node.js `24.18.0`/npm `11.16.0` pasó las 344 pruebas del
  repositorio en 38 archivos, sin omisiones ni todo conocidos. La instalación limpia bloqueada,
  formato, lint, typecheck, compilación, seis smokes de la CLI, validación del harness, escenario
  compilado y auditoría con umbral moderado pasaron; la cobertura V8 global midió 97.14% de
  sentencias, 92.79% de ramas, 99.70% de funciones y 97.14% de líneas.
- El paquete se recopiló dos veces. La segunda ejecución coincidió con el digest de la fuente y las
  mediciones/proyecciones estables del escenario, y conservó los 20 artefactos publicados
  inicialmente.

## Línea base ejecutada del contrato de M05-T01

- Las pruebas de configuración verifican el vocabulario de esquema/versión, valores predeterminados
  inmutables, nombres fijos de informes, errores estables y la diferencia semántica entre filtros de
  reglas ausentes y explícitamente vacíos.
- Las pruebas de resultados de auditoría cubren congelamiento recursivo defensivo, orden canónico de
  hallazgos/errores, resúmenes completos rellenados con ceros, normalización de errores de
  descubrimiento/fuente/regla, resultados vacíos solo para terminal, destinos relativos seguros de
  informes, tiempo canónico, controles de URL/rutas e invariantes de contadores.
- El JSON Schema cerrado exacto se resuelve con el esquema local de hallazgos y se valida contra un
  resultado preparado completo; las propiedades inesperadas se rechazan.
- Una prueba pura del contrato de generadores de informes demuestra que la presentación recibe
  exactamente el `AuditResult` proporcionado sin agregar estado de salida al dominio.
- La ejecución final de la tarea con Node.js `24.18.0` pasó las 372 pruebas en 41 archivos, además de
  formato, lint, typecheck y compilación. La cobertura V8 global pasó con 95.88% de sentencias, 90.76%
  de ramas, 99.19% de funciones y 95.84% de líneas; las métricas finales del hito se recopilarán de
  nuevo con todas las tareas de M05.

## Línea base ejecutada de configuración de M05-T02

- Los casos con sistema de archivos real distinguen un archivo convencional ausente de una ruta
  explícita inexistente, aceptan un BOM UTF-8 inicial y un archivo regular externo autorizado
  explícitamente, y nunca ejecutan la configuración como código.
- Los casos con sistema de archivos inyectado cubren rutas no regulares y que escapan, cambio de
  identidad de la raíz canónica, aceptación exacta de 64 KiB, tamaño inicial/observado excesivo,
  lecturas acotadas del descriptor, UTF-8 malformado, deriva del snapshot del descriptor, conteos de
  bytes nativos no válidos, flags de apertura POSIX/Windows, fallos estables no reflectivos y
  comportamiento exacto de cierre.
- Los casos del cargador cubren valores predeterminados, valores parciales de archivo, precedencia
  `defaults < file < CLI`, filtros null/vacíos, orden canónico, JSON malformado, rechazo de
  esquema/clave/valor/regla, duplicados, rutas portables no seguras, accessors, arreglos dispersos,
  copias defensivas, congelamiento y resultados normalizados estables byte por byte.
- La ejecución final de la tarea con Node.js `24.18.0` pasó las 435 pruebas en 43 archivos, además de
  formato, lint, typecheck y compilación. La cobertura V8 global pasó con 95.77% de sentencias, 91.08%
  de ramas, 99.29% de funciones y 95.72% de líneas; las métricas finales del hito se recopilarán de
  nuevo con todas las tareas de M05.

## Línea base ejecutada de terminal de M05-T03

- La salida exacta sin color cubre resúmenes completos de
  archivos/reglas/categorías/severidades/errores, hallazgos canónicos, recomendaciones, limitaciones,
  referencias, coordenadas de presentación y errores detallados de descubrimiento, fuente y regla.
- Las pruebas de color demuestran que solo las insignias fijas reciben ANSI y que eliminar esas
  secuencias produce el informe sin color byte por byte. Los cinco umbrales inclusivos conservan los
  totales completos y el orden de entrada.
- Los hallazgos vacíos/ocultos, ubicaciones/referencias null, errores no detallados, cada etapa de
  fuente y el renderizado repetido tienen casos explícitos. La entrada congelada permanece sin
  cambios.
- Las cadenas hostiles de proyecto, archivo, título, mensaje, explicación, recomendación, limitación,
  referencia y herramienta cubren controles C0/C1, líneas inyectadas, ANSI/OSC,
  bidireccionalidad/aislados, sustitutos no emparejados y Unicode astral válido. Los casos existentes
  de salida hostil de la CLI pasan mediante la reexportación de compatibilidad.
- La ejecución final de la tarea con Node.js `24.18.0` pasó las 449 pruebas en 44 archivos, además de
  formato, lint, typecheck y compilación. La cobertura V8 global pasó con 95.94% de sentencias, 91.42%
  de ramas, 99.31% de funciones y 95.90% de líneas; las métricas finales del hito se recopilarán de
  nuevo con todas las tareas de M05.

## Línea base ejecutada de JSON y persistencia de M05-T04

- Las pruebas de JSON afirman bytes exactos con dos espacios/LF, igualdad completa con el esquema
  local, conservación de tiempo y coordenadas de base cero, recorridos de ida y vuelta de cadenas
  hostiles, grupos explícitos vacíos, renderizado repetido determinista e inmutabilidad de la
  entrada.
- Las pruebas del escritor compartido cubren validación cerrada de solicitudes, selección fija de
  destinos JSON/HTML, creación portable de directorios, flags y modos exclusivos/sin seguimiento,
  salida exacta en el sistema de archivos real y conservación sin sobrescritura, escrituras
  parciales acotadas, comportamiento de sincronización/cierre y normalización estable de errores
  nativos.
- Las carreras inyectadas sustituyen raíces, ancestros o destinos antes y después de
  abrir/escribir/cerrar. Las rutas de enlace simbólico, escape, snapshot no coincidente, conteo de
  bytes no válido, proxy/accessor y operación fallida nunca devuelven éxito. La última operación
  observable exitosa del sistema de archivos es la autorización del destino.
- La ejecución final de la tarea con Node.js `24.18.0` pasó las 490 pruebas en 46 archivos, además de
  formato, lint, typecheck y compilación. La cobertura V8 global pasó con 95.66% de sentencias, 91.19%
  de ramas, 99.36% de funciones y 95.62% de líneas; las métricas finales del hito se recopilarán de
  nuevo con todas las tareas de M05.

## Línea base ejecutada de HTML de M05-T05

- Las pruebas de documentos independientes fijan el digest determinista exacto, el envolvente
  UTF-8/LF, CSP temprano, estilos en línea constantes y ausencia de script, atributos de manejadores
  de eventos, etiquetas que portan recursos, activos externos, `@import` o URL de CSS.
- Los casos de resultados completos cubren metadatos, selecciones null frente a vacías de
  configuración, rutas de informes, tiempo, todos los contadores de
  archivos/reglas/categorías/severidades/etapas, cada variante de hallazgo/error,
  ubicaciones/referencias/URL null, ambos offsets UTF-16, columnas de presentación de base uno y
  rangos con extremo final exclusivo. La configuración de severidad y nivel de detalle de terminal
  no suprime registros HTML.
- Los valores hostiles ejercitan etiquetas de cierre, payloads de script/imagen/evento, controles
  C0/C1 y de terminal, bidireccionalidad/aislados, BOM, separadores de línea, sustitutos aislados,
  metacaracteres y emoji válido. Las pruebas de URL falsificadas mantienen inertes los valores que no
  son HTTP(S), contienen credenciales, están malformados/controlados o son objetos, mientras HTTP(S)
  canónico sin credenciales se convierte en un enlace escapado.
- Las aserciones entre generadores de informes comparan cada campo de hallazgo y discriminante de
  error de procesamiento en registros contextuales, consideran coordenadas JSON de base cero frente
  a coordenadas humanas de base uno y demuestran orden canónico dentro de un mismo grupo de
  severidad. Se cubren la delegación exacta al escritor, selección null, propagación estable de
  fallos, renderizado repetido e inmutabilidad de la entrada congelada.
- La ejecución final enfocada de generadores de informes/escritor pasó 77 pruebas. La ejecución
  completa del producto con Node.js `24.18.0` pasó 512 pruebas en 47 archivos. La cobertura V8 global
  midió 95.81% de sentencias, 91.39% de ramas, 99.39% de funciones y 95.77% de líneas; el módulo HTML
  midió 100% de sentencias/funciones/líneas y 97.82% de ramas. La evidencia aislada final de M05
  recopila nuevamente estas métricas.

## Línea base ejecutada de integración de M06-T01

- Las pruebas de la aplicación componen entrada validada, precedencia de configuración, un análisis
  normalizado, carga/evaluación de reglas estables, contadores exactos de auditoría, tiempo y
  persistencia seleccionada de JSON/HTML. Distinguen los filtros omitidos de los explícitamente
  vacíos, conservan errores recuperables de regla/fuente, rechazan la deriva de la raíz después de la
  autorización, conservan fallos estables del escritor y normalizan fallos inesperados de etapa o
  renderizado sin filtrar detalles nativos.
- La integración con sistema de archivos real analiza un proyecto React/TypeScript inerte con ocho
  hallazgos de reglas estables y un archivo relacionado malformado, escribe informes completos JSON
  y HTML, rechaza la sobrescritura y demuestra que el código objetivo no se ejecuta.
- Las pruebas de la CLI cubren cada opción documentada, precedencia de archivo/CLI consciente de la
  fuente de Commander, orden canónico de valores repetibles, salida `0` para hallazgos
  completados/errores recuperables, salida de entrada `2`, salida fatal/de informe `3`, ANSI directo
  y confiable de terminal, progreso/afirmaciones de informes hostiles escapados y afirmaciones
  derivadas únicamente de resultados exitosos del escritor. La salida `1` permanece reservada
  porque no existe una política de fallo por hallazgos.
- El conjunto smoke compilado ahora cubre 11 escenarios completos: ayuda, versión, entrada
  desconocida hostil, auditoría vacía/predeterminada, todos los generadores de informes con una fuente
  malformada recuperable, rechazo de sobrescritura, filtros explícitamente vacíos y precedencia de la
  CLI, configuración no válida, ruta inexistente, entrada de archivo regular y argumentos ausentes.
- La ejecución final de la tarea con Node.js `24.18.0` pasó formato, lint, typecheck, compilación, las
  548 pruebas en 50 archivos y los 11 smokes compilados. La cobertura V8 global midió 95.88% de
  sentencias, 91.46% de ramas, 99.80% de funciones y 95.84% de líneas. Las afirmaciones de exactitud,
  rendimiento, seguridad completa y usabilidad siguen asignadas de M06-T03 a M06-T05.

## Línea base ejecutada de proyectos controlados de M06-T02

- Un manifiesto cerrado y canónico versiona el vocabulario exacto de ocho reglas, candidatos fuente,
  exclusiones, errores del parser, conteos de hallazgos/ID de casos, campos volátiles de resultados,
  centinelas de no ejecución, enlaces en tiempo de ejecución y parámetros de generación del proyecto
  grande.
- El `valid-project` confirmado produce cero hallazgos; `invalid-project` produce exactamente un
  hallazgo por cada regla estable; y `mixed-project` selecciona cinco candidatos
  `.js`/`.jsx`/`.ts`/`.tsx`, analiza cuatro, aísla un error de sintaxis y produce tres hallazgos
  revisados mientras excluye declaraciones, configuración y directorios generados.
- El proyecto hostil/de seguridad en tiempo de ejecución agrega tres enlaces internos, externos y
  cíclicos omitidos de manera predeterminada, además de un nombre de archivo hostil portable que
  llega escapado al HTML mediante un hallazgo controlado. La capacidad de crear enlaces se registra
  en lugar de suponerse en plataformas que prohíben enlaces simbólicos.
- El proyecto grande generado contiene 240 componentes TSX seguros en 12 directorios. Su plantilla
  fuente, rutas, centinela de script de package y parámetro de rendimiento de cinco ejecuciones se
  versionan en lugar de confirmar contenido generado masivo.
- El escenario sin shell con la CLI compilada audita los cinco proyectos dos veces en raíces nuevas,
  verifica resultados esperados exactos, congruencia entre terminal/JSON/HTML, afirmaciones de
  informes, proyecciones estables y ausencia de centinelas de fuente/package. Seis pruebas enfocadas
  del manifiesto/corpus fijan el contrato físico y semántico. El criterio completo con Node.js 24
  pasó 554 pruebas en 51 archivos; la cobertura se mantuvo en 95.88% de sentencias, 91.46% de ramas,
  99.80% de funciones y 95.84% de líneas.

## Línea base ejecutada de exactitud de M06-T03

- Una verdad de referencia cerrada independiente versiona 27 casos a nivel de instancia: 11
  positivos, ocho negativos y ocho no compatibles. Cada regla estable tiene al menos un caso
  positivo más exactamente un límite negativo explícito y uno no compatible; los nodos ausentes y
  las combinaciones no relacionadas nunca se cuentan como verdaderos negativos.
- La CLI compilada produce los hallazgos JSON observados. Una segunda pasada de análisis se usa solo
  para relacionar nodos `data-uxaudit-case` con rangos semiabiertos del modelo; la correspondencia
  requiere el mismo proyecto, regla, archivo portable y offsets contenidos. Los hallazgos duplicados
  o no asignados cuentan como falsos positivos.
- Las detecciones/omisiones positivas se convierten en TP/FN; las detecciones/casos despejados
  negativos se convierten en FP/TN. Los casos no compatibles y su conteo observado se informan por
  separado y se excluyen de los denominadores de precisión y exhaustividad.
- El límite puro de métricas valida entrada simple cerrada, orden determinista de reglas, aritmética
  de enteros seguros, identidad duplicada de casos por regla, proporciones null con denominador cero
  e inmutabilidad de la entrada. Veintiuna pruebas enfocadas cubren casos normales, adversariales y
  de desbordamiento.
- Las ocho reglas coincidieron con las expectativas revisadas: 11 TP, cero FP, ocho TN, cero FN y
  cero detecciones no compatibles. La precisión y exhaustividad por regla fueron ambas 1.0 únicamente
  dentro de este corpus sintético controlado; no se afirma ninguna generalización agregada ni del
  mundo real.
- El criterio final con Node.js 24 pasó 577 pruebas en 53 archivos. La cobertura V8 global midió
  95.84% de sentencias, 91.39% de ramas, 99.81% de funciones y 95.80% de líneas.

## Línea base ejecutada de robustez, rendimiento y seguridad de M06-T04

- El ejecutor de robustez sin shell ejecutó 15 casos de la CLI compilada en Linux. Todos los casos
  pasaron, incluidos raíces canónicas e inexistentes, ausencia de argumento de scan, configuración
  malformada, escape de ruta de salida, rechazo de salida mediante enlace simbólico, conservación de
  escritura exclusiva, aislamiento de fuente malformada, una fuente por debajo de 32 directorios
  anidados, informes hostiles, nuevas ejecuciones deterministas, denegación real de permisos y el
  proyecto grande generado.
- El sistema de archivos real negó tanto la raíz del proyecto seleccionada como el destino de los
  informes según lo previsto. UXAudit devolvió los fallos documentados de entrada y escritura de
  informes sin filtrar detalles nativos; el ejecutor conserva referencias sustitutas portables para
  entornos donde no se pueda reproducir la denegación de permisos.
- Los tres enlaces en tiempo de ejecución del proyecto hostil —interno, externo y cíclico— se crearon
  y excluyeron mediante la política predeterminada. JSON permaneció válido, mientras las aserciones
  estructurales de HTML confirmaron el escape de rutas hostiles, el CSP restrictivo y la ausencia de
  markup ejecutable o que porte recursos, manejadores de eventos, controles sin procesar y carga de
  recursos CSS. Esto no fue una ejecución de exploit en un navegador.
- Las raíces hostiles nuevas produjeron JSON estable y HTML normalizado idénticos. Cinco ejecuciones
  completas de la CLI compilada procesaron el proyecto generado de 240 archivos, conservaron
  resultados esperados exactos y centinelas de ejecución ausentes, y registraron muestras de tiempo
  transcurrido más el `VmRSS` máximo del proceso hijo observado mediante muestreo de `/proc` cada
  5 ms. El registro de rendimiento es una línea base descriptiva con valores mínimo, mediana y
  máximo, sin un umbral de aprobación dependiente de la máquina; el valor de memoria no se presenta
  como un máximo exacto de toda la vida del proceso.
- La auditoría de dependencias con umbral moderado informó cero vulnerabilidades. Las comprobaciones
  del lockfile y la política estricta de instalación pasaron. CodeQL alojado no se ejecutó porque no
  se recuperó ningún resultado alojado; la inspección local del workflow se registra por separado y
  no se presenta como resultado de un análisis.
- El criterio con Node.js 24 pasó las 602 pruebas en 54 archivos, los 11 smokes compilados de la CLI,
  los escenarios de proyectos controlados, exactitud y robustez de 15 casos, y la validación del
  harness. La cobertura V8 global midió 95.84% de sentencias, 91.50% de ramas, 99.82% de funciones y
  95.79% de líneas.

## Revisión heurística experta ejecutada de M06-T05

- No había datos de participantes reales ni respuestas SUS disponibles. Las pruebas con
  participantes se registran como no ejecutadas y SUS como no aplicable con puntuación null; ninguna
  se presenta como investigación completada con personas usuarias.
- Un contrato cerrado versionado define seis tareas para personas desarrolladoras: descubrir el
  comando de scan, analizar el proyecto controlado no válido, identificar la severidad máxima,
  ubicar la fuente, comprender la recomendación y encontrar los informes JSON/HTML.
- El ejecutor de revisión sin shell completó las seis tareas con la CLI compilada y conservó una
  duración real de reloj de pared por cada procedimiento experto programado. Esos valores no son
  tiempos de tareas de personas usuarias; los cero errores/retrocesos y el uso de
  ayuda de la CLI también describen únicamente el script.
- Cinco tareas no produjeron ningún problema heurístico. La tarea de priorización registró una
  observación de severidad low: tres hallazgos de accesibilidad empatan con severidad high, mientras
  el informe de terminal no explica una política secundaria de priorización. La acción correctiva es
  documentar el orden canónico y considerar un orden secundario o control explícito en una versión
  futura.
- Las pruebas enfocadas del contrato fijan el JSON canónico, orden exacto de seis tareas, valores
  esperados del informe controlado, severidades de observaciones y estado de participantes/SUS.
  `npm run test:usability:m06` compila y ejecuta de manera independiente la revisión real de la CLI.

## Validación integrada final de M06

- El criterio definitivo con Node.js 24 pasó 619 pruebas en 56 archivos, con cero pruebas fallidas,
  omitidas o todo. La cobertura fue de 95.84% de sentencias, 91.50% de ramas, 99.82% de funciones y
  95.79% de líneas.
- El recopilador aislado ejecutó una instalación bloqueada, criterio de calidad, cobertura, registro
  de pruebas legible por máquina, 11 smokes compilados, escenario de cinco proyectos, exactitud de
  ocho reglas, robustez/seguridad/rendimiento de 15 casos, revisión experta de seis tareas, validación
  del harness y auditoría de dependencias.
- Los totales de exactitud conservados son 11 TP, cero FP, ocho TN y cero FN; ocho casos no
  compatibles permanecen fuera de los denominadores. Cinco ejecuciones de rendimiento usaron 240
  archivos fuente generados sin un umbral dependiente de la máquina.
- Dos recopilaciones definitivas usaron el mismo digest de la fuente y coincidieron con cada
  artefacto estable o proyección volátil documentada. La segunda ejecución conservó el primer paquete
  base de 42 artefactos; su manifiesto SHA-256, sanitización, JSON canónico y contrato exacto de
  archivos pasaron.
