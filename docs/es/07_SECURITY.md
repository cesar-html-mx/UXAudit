**Español** | [English](../07_SECURITY.md)

# Seguridad

## Modelo de amenazas

UXAudit procesa un proyecto seleccionado por el usuario, pero todo el contenido del proyecto se trata
como no confiable. Las amenazas pertinentes para un analizador estático local incluyen:

- recorrido de rutas y acceso fuera de la raíz aprobada;
- ciclos de enlaces simbólicos o enlaces a archivos externos;
- nombres de archivo y cadenas de código fuente maliciosos;
- inyección de HTML o scripts en los informes generados;
- ejecución o importación del código analizado;
- agotamiento de recursos por proyectos grandes o malformados;
- rutas de salida inseguras y sobrescritura de archivos no relacionados;
- vulnerabilidades de dependencias y de la cadena de suministro;
- filtración de rutas sensibles en informes o registros.

## Controles requeridos

1. Convertir a forma canónica y validar la raíz del proyecto.
2. Usar una política explícita de enlaces simbólicos y seguimiento de rutas reales visitadas.
3. Nunca ejecutar código de destino, scripts de paquetes, módulos de configuración ni shells.
4. Analizar únicamente texto.
5. Escapar cada valor controlado por el proyecto en HTML.
6. Serializar JSON mediante codificadores estándar.
7. Dirigir de forma predeterminada las rutas de salida a un directorio controlado e impedir
   sobrescrituras no intencionadas.
8. Usar un manejo acotado y claro para archivos sobredimensionados o ilegibles cuando se incorporen.
9. Evitar secretos, telemetría y transmisión externa por red.
10. Incluir el lockfile en un commit y ejecutar revisión o auditoría de dependencias.
11. Devolver errores con tipo sin exponer datos sensibles innecesarios del entorno.
12. Probar entradas hostiles.

## Escenarios de aceptación de seguridad

- Durante el descubrimiento, `../../` y las entradas descendientes equivalentes no escapan de la raíz
  canónica seleccionada por el usuario. Seleccionar una raíz mediante `..` sí está permitido porque
  el usuario de la CLI autoriza esa raíz explícitamente.
- Los ciclos de enlaces simbólicos terminan de forma segura.
- Un enlace simbólico que apunta fuera de la raíz sigue la política documentada.
- `<script>alert(1)</script>` en un nombre de archivo, texto JSX o atributo se muestra como texto en
  HTML.
- Los scripts de `package.json` de un proyecto de destino nunca se ejecutan.
- El JSX malformado y profundamente anidado no puede corromper los resultados de otro archivo.
- Los fallos de escritura de salida se informan sin afirmar éxito.
- Los resultados de la auditoría de dependencias y las excepciones aceptadas se registran.

## Declaración del contexto de producción

El MVP es local y no expone un servicio HTTP, una capa de autenticación, una base de datos ni un WAF.
No se deben inventar esos controles. La evaluación de seguridad debe centrarse en la arquitectura real
y explicar qué cambiaría si UXAudit se convirtiera posteriormente en un servicio alojado.

## Controles y límites implementados en M01

- La raíz del proyecto se convierte a forma canónica, se comprueba como directorio y se verifica
  previamente su acceso de lectura o búsqueda.
- Los fallos de ausencia, tipo distinto de directorio, acceso denegado y sistema de archivos
  desconocido se convierten en errores con tipo. La CLI no imprime sus causas nativas.
- La CLI renderiza los controles C0/C1, controles bidireccionales, saltos de línea inyectados y
  separadores de línea Unicode de rutas y valores de error no confiables como escapes visibles antes
  de escribirlos en los flujos de terminal.
- El comportamiento del producto utiliza las API del sistema de archivos de Node y no ejecuta un
  shell ni código de destino.
- Las dependencias directas son exactas y están bloqueadas; npm rechaza incompatibilidades de engine,
  conflictos de dependencias peer y scripts de instalación no revisados. esbuild `0.28.1` es el único
  script de dependencia aprobado,
  mientras que los scripts opcionales de fsevents se rechazan explícitamente.
- CI utiliza permisos mínimos, SHA inmutables de acciones, auditoría de dependencias y CodeQL y
  Dependency Review condicionales según la visibilidad del repositorio o la disponibilidad de GitHub
  Code Security. Los gates de auditoría y revisión de dependencias rechazan vulnerabilidades de
  severidad moderada o superior.

El acceso a la raíz puede cambiar después de la validación, y el comportamiento de `X_OK` o las ACL
varía según la plataforma. M02 debe tratar la comprobación previa como orientativa, manejar los fallos
reales del recorrido, detectar ciclos de enlaces simbólicos y aplicar la contención canónica de
descendientes.

## Controles de recorrido implementados en M02

- El descubrimiento vuelve a validar la raíz canónica y cada directorio en cola inmediatamente antes
  de enumerarlo. La contención canónica y la identidad del directorio se comprueban antes de consultar
  metadatos de una ruta redirigida. La pérdida de la raíz es un fallo fatal con tipo; los fallos de
  descendientes se convierten en problemas recuperables estables sin mensajes nativos ni divulgación
  de rutas absolutas.
- Los nombres de directorios y resultados normalizados usan un orden ordinal explícito en lugar del
  orden del sistema de archivos dependiente de la configuración regional.
- La política predeterminada no sigue enlaces simbólicos. La activación interna
  `follow-within-root` resuelve destinos, comprueba la contención con `path.relative`, vuelve a aplicar
  las exclusiones al destino canónico y utiliza directorios canónicos visitados para detener alias y
  ciclos.
- Los valores desconocidos de la política en tiempo de ejecución fallan de forma cerrada mediante la
  omisión predeterminada de enlaces, en lugar de entrar en la rama activada.
- Las entradas excluidas se rechazan antes de resolver un enlace y los destinos canónicos dentro de
  directorios excluidos vuelven a rechazarse para evitar la elusión mediante alias.
- Los casos de prefijo hermano POSIX, unidad o separador de Windows, enlace externo, enlace roto,
  ciclo, carrera, acceso y entrada no compatible están cubiertos con árboles temporales y un límite
  inyectado del sistema de archivos.
- El proyecto controlado integral contiene un centinela de script de paquete y demuestra que nunca
  se crea. La evidencia conservada se construye a partir de una copia aislada de la fuente con un
  entorno hijo de lista de permitidos, sin variables de credenciales heredadas, enlaces simbólicos
  rechazados en la instantánea, entorno de ejecución fijado y aserciones del harness activo, rechazo
  de rutas personales o tokens, publicación inicial atómica y un manifiesto SHA-256 que también
  cubre el informe finalizado del hito.

Las API portátiles del sistema de archivos no pueden eliminar todas las carreras entre la validación
y una lectura posterior del archivo. M03 debe tratar el inventario de M02 como una lista de
candidatos, volver a convertir a forma canónica y verificar la contención al abrir un archivo, y
aislar los cambios que ocurran después del descubrimiento.

## Controles y límites de fuentes implementados en M03

- La lectura de fuentes solo acepta una raíz absoluta canónica cuya identidad de directorio
  permanezca estable. Cada candidato declarado debe ser un descendiente portátil exacto, resolverse
  al archivo canónico esperado dentro de la raíz y seguir siendo un archivo regular, conservando el
  dispositivo, el inodo, el tamaño, la hora de modificación y la hora de cambio entre las
  observaciones de ruta y descriptor.
- Las aperturas POSIX solicitan comportamiento de solo lectura, sin seguimiento y sin bloqueo.
  Windows usa solo lectura más las mismas comprobaciones de identidad de descriptor y ruta. El
  contenido se lee únicamente mediante el descriptor verificado, que se cierra exactamente una vez
  en caso de éxito, fallo recuperable o pérdida fatal de la raíz.
- Cada fuente está limitada a 1 MiB; las lecturas del descriptor solicitan no más de 64 KiB y pueden
  observar un byte adicional para rechazar el crecimiento. La decodificación UTF-8 estricta falla de
  forma cerrada ante bytes malformados y conserva deliberadamente un BOM inicial para el analizador.
- Los errores nativos del sistema de archivos o Babel, las rutas absolutas, los bytes o el texto
  fuente, los valores AST y las causas no se exponen mediante registros recuperables del analizador
  ni errores fatales de la aplicación. Los caracteres de control y bidireccionales permanecen como
  datos no confiables del modelo y se escapan en el límite de terminal.
- Una ruta interna de candidato no portátil falla mediante una invariante fatal genérica en lugar de
  copiarse en un registro de error recuperable.
- El compuesto de Babel solo analiza el texto proporcionado. No importa candidatos ni ejecuta la
  configuración del proyecto o los scripts del paquete; tampoco invoca un shell ni evalúa
  expresiones JSX.
- Los candidatos se ejecutan secuencialmente en orden determinista. Los problemas esperados y
  locales al archivo de lectura, sintaxis y extracción no corrompen ni suprimen modelos relacionados
  seguros; la pérdida de autorización de la raíz, las invariantes del lote o modelo y las invariantes
  inesperadas de extracción detienen el procesamiento.

Las comprobaciones portátiles en espacio de usuario no pueden volver inmutables permanentemente los
nombres de ruta. Todavía podría ocurrir un reemplazo entre la última observación de la ruta y una
actividad externa posterior en el sistema de archivos. UXAudit limita esta exposición TOCTOU residual
al usar solo bytes leídos del descriptor verificado, comparar la identidad de ruta y descriptor antes
y después de la lectura acotada, volver a autorizar la raíz durante todo el proceso y fallar de forma
cerrada siempre que se observe un cambio.

## Controles y límites de reglas implementados en M04

- Las reglas reciben únicamente el `AnalysisModel` normalizado; no leen archivos ni importan nodos
  del analizador. Tampoco ejecutan código de destino, invocan un shell ni realizan acceso de red del
  producto.
- El registro valida y copia contratos ejecutables, rechaza ID duplicados, reglas diferidas,
  metadatos incompletos y referencias con credenciales o que no sean HTTP(S), y después congela las
  reglas aceptadas.
- Los filtros por categoría o ID requieren datos propios simples, rechazan valores y claves
  desconocidos y fallan de forma cerrada ante contenedores o descriptores de acceso malformados. Las
  reglas experimentales requieren una activación por ID exacto.
- Antes de la evaluación, el motor congela profundamente una vez el modelo confiable. Las reglas que
  lanzan excepciones y los lotes de resultados malformados se convierten en errores estables por
  regla; los hallazgos seguros relacionados continúan.
- Cada rango no nulo de un hallazgo debe coincidir exactamente con una ubicación canónica del modelo.
  Las reglas no pueden inyectar una ruta absoluta o imposible de rastrear, y las excepciones nativas
  o el texto del proyecto no entran en los errores de ejecución normalizados.
- Las fábricas configurables de reglas inspeccionan descriptores propios sin invocar getters,
  rechazan contenedores dispersos o exóticos, normalizan proxies que lanzan a errores estables no
  reflectantes y copian los valores aceptados en conjuntos o números privados y deterministas.
- Las reglas del catálogo estable suprimen la incertidumbre dinámica o propagada, o usan redacción
  consultiva y confianza explícitas. Los componentes personalizados, CSS renderizado, enrutamiento,
  prioridad en la ventana gráfica y contexto accesible completo permanecen como limitaciones
  documentadas en lugar de afirmaciones de seguridad o tiempo de ejecución.
- La evidencia de M04 se ejecuta en una copia de fuentes de lista de permitidos y sin credenciales,
  rechaza la mutación de la instantánea y JSON de escenario no canónico, y vuelve a autorizar un
  destino regular dentro del repositorio inmediatamente antes de la publicación atómica. Las listas
  de archivos permitidos exactas, los análisis de secretos o rutas, la comparación estable de la
  segunda ejecución y un manifiesto SHA-256 fallan de forma cerrada; la finalización verifica el
  manifiesto existente de 20 artefactos antes de agregar el informe del hito.

La integración de la CLI de M06 compone este motor con los límites de resultados e informes de M05
sin proporcionar a las reglas acceso al sistema de archivos, analizador, generador de informes ni
proceso. Cada campo de hallazgo normalizado sigue siendo no confiable en la presentación.

## Controles y límites de configuración implementados en M05-T02

- La configuración es JSON inerte en lugar de un módulo JavaScript o TypeScript importado. La
  decodificación UTF-8 estricta está acotada a 64 KiB y el contenido malformado o sobredimensionado
  falla mediante errores estables sin conservar causas nativas ni rutas privadas.
- El archivo convencional se autoriza como hijo canónico exacto de una raíz canónica del proyecto
  sin cambios. Tanto los archivos convencionales como los seleccionados explícitamente deben
  permanecer regulares con instantáneas estables de dispositivo e inodo, tamaño, hora de
  modificación y hora de cambio alrededor de una lectura exclusiva del descriptor. POSIX solicita
  indicadores de solo lectura, sin seguimiento y sin bloqueo; Windows usa solo lectura con las
  mismas comprobaciones portátiles de identidad.
- Las capas de archivo y CLI son registros cerrados de datos simples. Los descriptores de acceso,
  proxies,
  arreglos dispersos, exóticos o sobredimensionados, claves o reglas desconocidas, duplicados y
  valores primitivos no válidos fallan de forma cerrada sin invocar los getters proporcionados.
- Los directorios de salida son rutas relativas portátiles acotadas. Las rutas absolutas, prefijos de
  unidad, barras invertidas, componentes vacíos o de punto, controles o sustituciones bidireccionales,
  caracteres no válidos de Windows, nombres reservados de dispositivos y puntos o espacios finales
  ambiguos se rechazan antes de que pueda construirse un `AuditResult` o destino del escritor.

Un archivo de configuración explícito es autoridad separada del usuario y puede estar fuera del
proyecto analizado; aun así, está sujeto a la política de archivo regular e identidad. Las
comprobaciones portátiles en espacio de usuario no pueden eliminar todas las carreras de nombres de
ruta, por lo que los cambios observados fallan de forma cerrada y solo se analizan los bytes del
descriptor verificado. M05-T04 sigue siendo responsable de la autorización canónica del directorio de
salida, la creación resistente a enlaces simbólicos y las escrituras exclusivas de informes.

## Controles de terminal implementados en M05-T03

- El generador de informes de terminal no interpola cadenas sin procesar del proyecto o resultado.
  Cada valor se sanitiza antes de agregar separadores estructurales o ANSI confiable, por lo que los
  saltos de línea inyectados no pueden falsificar registros de informes y los escapes proporcionados
  por la fuente no pueden cambiar el estado de la terminal.
- El sanitizador compartido renderiza controles C0/C1, bytes ANSI/OSC, marcas y aislados
  bidireccionales, separadores de línea Unicode, BOM y sustitutos UTF-16 sin pareja como secuencias
  visibles `\uXXXX` en minúsculas, mientras conserva Unicode bien formado.
- El color es un valor de configuración normalizado en lugar de un comportamiento de TTY o entorno.
  Solo las insignias fijas de severidad o etapa reciben ANSI; la salida sin color no contiene
  caracteres de escape y eliminar el ANSI propiedad del generador produce exactamente los bytes sin
  color.
- El modo detallado expone solo registros de errores recuperables ya normalizados. Las causas
  nativas, pilas, texto fuente y rutas absolutas adicionales no están disponibles para el generador.

La CLI de M06 escribe directamente la salida de este renderizador puro y no la pasa por un
sanitizador de salida ensamblada que neutralizaría ANSI confiable. El progreso, los diagnósticos y las
afirmaciones de generación de archivos siguen usando el límite de valores seguros, mientras que solo
el generador de informes introduce secuencias fijas de color.

## Controles de JSON y escritura de informes implementados en M05-T04

- JSON usa el codificador estándar sobre el resultado completo ya validado, por lo que las cadenas
  hostiles permanecen como datos y no se confía en sintaxis JSON concatenada manualmente.
- El escritor solo acepta una solicitud simple cerrada cuyo destino relativo coincida exactamente
  con el directorio configurado validado y el nombre de archivo de formato fijo. Los objetos
  malformados, proxies, descriptores de acceso, UTF-16 malformado, rutas absolutas o ambiguas y
  sustituciones de nombres de archivo fallan antes de mutar el sistema de archivos.
- La raíz y cada segmento del directorio deben permanecer como directorios canónicos dentro de la
  raíz con identidad estable de dispositivo e inodo. Los segmentos se crean individualmente con modo
  `0700`; el informe se abre con `O_EXCL`, `O_CREAT`, `O_WRONLY`, `O_NOFOLLOW` de POSIX y modo
  `0600`.
- Los bytes UTF-8 se escriben posicionalmente en fragmentos de no más de 64 KiB. Los conteos de
  escritura nativos de cero, sobredimensionados o no válidos; los fallos de
  escritura/sincronización/estado/cierre; los cambios de enlace/identidad/instantánea; y las formas
  inseguras de errores nativos se convierten en errores estables sin detalles y nunca devuelven una
  ruta generada.
- La identidad de ruta y descriptor y el tamaño final se comprueban durante la escritura y de nuevo
  después del cierre. Las pruebas incluyen un comportamiento real sin sobrescritura y ventanas
  inyectadas de reemplazo de raíz, ancestro y destino.

Las API portátiles del sistema de archivos de Node no proporcionan una transacción `openat`/`openat2`
multiplataforma y algunos sistemas de archivos de red podrían no respetar de forma idéntica la
semántica local de `O_EXCL`. Los controles detectan cambios observables, pero no pueden eliminar
todas las carreras de nombres de ruta. Si ocurre un fallo después de la creación exclusiva, UXAudit
deja deliberadamente el destino posiblemente parcial: desvincular a ciegas esa ruta después de una
carrera de identidad podría eliminar un reemplazo del atacante. La CLI solo puede anunciar como
generado un `WrittenReport` devuelto.

## Controles de HTML implementados en M05-T05

- El documento tiene etiquetas, ID, clases y CSS fijos y confiables; ningún valor del resultado
  selecciona marcado o estilo. No contiene scripts, atributos de controladores de eventos,
  formularios, marcos, objetos, recursos incrustados, imágenes, enlaces a hojas de estilo, `@import`
  ni `url()` de CSS.
- Una CSP temprana permite únicamente el estilo constante en línea y rechaza otras fuentes o
  acciones predeterminadas, de scripts, objetos, bases y formularios. El informe es un único archivo
  HTML5 UTF-8 local sin servicio en tiempo de ejecución.
- Cada valor dinámico usa primero la neutralización visible compartida para C0/C1, secuencias
  ESC/terminal, marcas o aislados bidireccionales, separadores de línea Unicode, BOM y sustitutos
  aislados; después escapa `&`, `<`, `>`, `"` y `'` para HTML. El Unicode bien formado, como los
  emoji, permanece intacto.
- Las URL de referencia vuelven a tratarse como no confiables en el momento de la presentación,
  incluso si el objeto se falsifica como `AuditResult`. Los controles sin procesar o el formato
  direccional, UTF-16 malformado, esquemas que no sean HTTP(S) y credenciales vuelven inerte la
  referencia. Los enlaces aceptados usan la URL analizada en el atributo escapado, mientras que el
  valor original permanece como texto escapado.
- HTML nunca oculta errores mediante `verbose` ni hallazgos mediante `minimumSeverity`, por lo que
  los registros de seguridad y procesamiento permanecen disponibles para revisión. Los valores
  nulos o vacíos y cada grupo de cero son explícitos.

La validación XSS consiste en fixtures hostiles, inspección de etiquetas de apertura o atributos,
aserciones de escape, inspección de CSP y ausencia de marcado ejecutable o que contenga recursos. No
ejecuta un navegador y no debe describirse como una prueba de explotación en tiempo de ejecución. La
persistencia de archivos sigue usando el escritor de T04 y hereda sus límites residuales del sistema
de archivos portátil.

## Controles y límites de integración implementados en M06-T01

- La raíz del proyecto se convierte a forma canónica antes de cargar la configuración. La
  configuración convencional permanece dentro de la raíz; una ruta explícita sigue siendo autoridad
  separada del usuario. La configuración termina antes del descubrimiento, la lectura de fuentes o
  el análisis sintáctico.
- Commander aporta únicamente valores procedentes explícitamente de la CLI. Su valor predeterminado
  de `--no-color` ausente no puede reemplazar un valor de archivo, y las selecciones repetibles se
  deduplican antes de la validación cerrada de la configuración.
- Las reglas reciben una vez el modelo normalizado existente y todos los generadores de informes
  reciben el mismo `AuditResult` congelado. Los módulos del proyecto de destino, scripts de paquetes,
  módulos de configuración y shells siguen sin ejecutarse.
- El progreso, los diagnósticos de Commander, los fallos con tipo y las rutas relativas confirmadas
  por el escritor sanitizan cada valor dinámico. El generador de informes de terminal conserva su
  propia sanitización por valor y ANSI fijo.
- Las rutas de resultado seleccionadas no se tratan como recibos de persistencia. JSON se intenta
  antes que HTML y solo se anuncian los registros exactos devueltos por el escritor. Un destino
  existente o un fallo de escritura posterior usa la salida `3`, no produce ninguna afirmación de
  conjunto de informes completado y no activa una reversión insegura.
- Los hallazgos y errores recuperables normalizados usan la salida `0`; la entrada de configuración o
  ruta usa `2`. La salida `1` sigue sin utilizarse porque no existe una política de fallo por
  hallazgos.

Esos controles específicos de integración y las pruebas de humo compiladas se complementaron
posteriormente con la ejecución completa de proyecto hostil, enlaces simbólicos, dependencias,
permisos, rendimiento y lista de verificación de seguridad de M06-T04.

## Controles y límites de seguridad del sistema ejecutados en M06-T04

- Un ejecutor sin shell ejercitó 15 casos completos de la CLI compilada en Linux y todas las
  aserciones ejecutables pasaron. Las denegaciones reales de permisos de la raíz del proyecto y la
  salida de informes produjeron los fallos estables documentados; permanecen disponibles alternativas
  conscientes de capacidades para plataformas donde `chmod` no puede reproducir la denegación.
- El proyecto hostil creó los tres enlaces simbólicos solicitados. Los enlaces internos, externos y
  cíclicos se excluyeron conforme a la política predeterminada, el escaneo terminó y ninguna fuente
  enlazada escapó hacia los hallazgos. Los centinelas de proyecto o script de paquete permanecieron
  ausentes durante toda la ejecución de proyectos hostiles, malformados, de sobrescritura y grandes.
- El escape de salida relativa al proyecto se rechazó antes de escribir. Un enlace simbólico del
  directorio de salida dirigido a un directorio externo se rechazó sin crear un informe externo.
  Repetir una escritura JSON exitosa devolvió el error de destino exclusivo, no emitió ninguna
  afirmación de informe generado y conservó los bytes del informe original.
- El informe JSON hostil permaneció analizable con el nombre de archivo original como dato. La
  validación estructural de HTML confirmó el texto escapado de la ruta hostil, la CSP restrictiva
  exacta, la ausencia de etiquetas ejecutables o con recursos, de atributos de controladores de
  eventos, de carga de recursos CSS y de caracteres de control o bidireccionales sin procesar. Esto
  establece la estructura y el escape del renderizador, no resistencia a la explotación en un
  navegador en tiempo de ejecución.
- Una fuente controlada con 32 directorios de profundidad y dos raíces hostiles nuevas se
  completaron; las salidas hostiles produjeron JSON estable y HTML normalizado iguales. Cinco
  escaneos completos del proyecto generado de 240 archivos registraron distribuciones de tiempo
  transcurrido y el máximo `VmRSS` del proceso hijo observado mediante muestreo de `/proc` cada 5 ms;
  no se afirma que sea un pico exacto durante toda la vida del proceso y no se impuso un umbral de
  rendimiento específico del entorno.
- El conjunto exacto y bloqueado de dependencias y la política estricta de instalación pasaron la
  inspección, y `npm audit --audit-level=moderate --json` informó cero vulnerabilidades. No se obtuvo
  ningún resultado alojado de CodeQL, por lo que CodeQL se registra verazmente como no ejecutado en
  lugar de inferirse a partir del archivo de flujo de trabajo local.
