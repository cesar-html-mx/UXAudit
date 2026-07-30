**Español** | [English](../02_PRODUCT_SPEC.md)

# Especificación del producto

## Comando

La interfaz principal es:

```bash
ux-audit scan <project-path> [options]
```

### Base implementada de descubrimiento y análisis

- `--help` y ayuda del comando.
- `--version`.
- `scan <project-path>` con un argumento de ruta obligatorio.
- Validación de la raíz canónica del proyecto para comprobar su existencia, tipo de directorio y
  acceso de lectura/búsqueda.
- Descubrimiento recursivo seguro con exclusiones predeterminadas exactas y omisión segura de enlaces
  simbólicos.
- Inventario canónico determinista y clasificación conservadora de `.js`/`.jsx`/`.ts`/`.tsx`.
- Lecturas acotadas del código fuente, análisis sintáctico con Babel, extracción de JSX/componentes
  sin AST y construcción determinista del modelo normalizado.
- Errores recuperables de lectura, análisis sintáctico y extracción aislados por archivo de código
  fuente.
- Mensajes estables de ruta, resumen de descubrimiento y resumen de análisis sintáctico sin
  afirmaciones sobre reglas, hallazgos ni auditorías.

### Dominio de reglas implementado

- Metadatos inmutables de reglas, hallazgos normalizados y autónomos, errores estables de ejecución
  de reglas y contadores de evaluación independientes de los informes.
- Registro explícito validado junto con filtrado de categorías/ID de reglas que se cierra ante
  fallos.
- Evaluación determinista exactamente una vez con aislamiento por regla, validación transaccional de
  la salida, procedencia canónica de la ubicación en el código fuente e inmutabilidad del modelo en
  tiempo de ejecución.
- Ocho reglas estables dentro de los alcances estáticos documentados: tres comprobaciones de
  accesibilidad, recomendaciones sobre carga diferida/dimensiones de imágenes, revisión de varios H1
  dentro del componente, texto exacto ambiguo en enlaces y revisión literal de texto pequeño en
  línea.

### Contratos implementados de configuración e informes

- Esquema de configuración versión `1` con filtros explícitos de categorías/reglas, formatos de
  informe, directorio de salida, severidad mínima de presentación, color y nivel de detalle.
- Valores predeterminados inmutables: catálogo estable (filtros `null`), salida en terminal, umbral
  `info`, color, modo detallado deshabilitado y el directorio relativo portable `uxaudit-reports`.
- Nombres fijos de informes locales `audit-report.json` y `audit-report.html`.
- Esquema `AuditResult` `1.0.0` con metadatos de configuración/herramienta/tiempo, contadores de
  archivos descubiertos/seleccionados/analizados/fallidos, contadores completos de reglas y
  hallazgos, errores normalizados de descubrimiento/código fuente/reglas, resúmenes con ceros por
  categoría/severidad/etapa y rutas de informes relativas al proyecto que admiten valores nulos.
- Un contrato puro de generación de informes que consume exactamente un resultado completado.
- Un generador de informes JSON determinista y sin pérdidas que conserva el resultado completo y
  las coordenadas almacenadas como JSON canónico con sangría de dos espacios y un único LF final.
- Un escritor compartido de archivos JSON/HTML que solo acepta destinos relativos fijos configurados,
  los crea de forma exclusiva dentro de la raíz canónica autorizada y devuelve una ruta únicamente
  después de escribir, sincronizar, cerrar y completar la autorización final correctamente.

El límite realiza copias defensivas, valida, ordena de forma canónica e inmoviliza los datos del
resultado.

### Integración implementada de la CLI en M06

El comando `scan` de producción integra la validación de la raíz canónica, la carga de configuración,
la fachada de análisis existente, la carga/evaluación de reglas, un `AuditResult` inmutable, la
renderización para terminal y la persistencia JSON/HTML seleccionada. La configuración se carga
después de autorizar la raíz, pero antes de recorrer/analizar sintácticamente el código fuente. La
fachada de análisis se ejecuta una vez; las reglas consumen ese único modelo normalizado y los
generadores de informes consumen ese único resultado completado.

Los filtros `null` de la configuración se convierten en filtros omitidos del motor de reglas, mientras
que `[]` permanece como una selección intencional de cero reglas. Solo los valores cuya fuente de
Commander sea la línea de comandos forman la capa de sobrescritura, por lo que los valores
predeterminados de opciones ausentes no reemplazan la configuración del archivo.

Opciones implementadas:

- `--config <path>`: archivo de configuración; la búsqueda predeterminada es
  `uxaudit.config.json` en la raíz del proyecto.
- `--format <terminal|json|html|all>`: generadores de informes seleccionados; se puede repetir y se
  eliminan duplicados. `all` es una facilidad de la CLI y no es un valor del archivo de
  configuración.
- `--output <directory>`: directorio de salida de informes.
- `--category <ux|accessibility|seo|performance>`: filtro de categorías repetible.
- `--rule <rule-id>`: filtro explícito de reglas repetible.
- `--severity <info|low|medium|high|critical>`: severidad mínima mostrada donde sea compatible.
- `--no-color`: salida de terminal sin color ANSI.
- `--verbose`: detalle del procesamiento y errores recuperables.

## Resultado integrado del análisis

El contrato completado de `scanProject` continúa devolviendo la raíz canónica del proyecto, el
resultado completo del descubrimiento, el inventario normalizado, los candidatos de código fuente
clasificados y los conteos del descubrimiento. La fachada independiente `analyzeProject` agrega:

- un `AnalysisModel` normalizado;
- una lista ordenada de errores recuperables del analizador sintáctico por archivo;
- conteos de archivos analizados, archivos fallidos, componentes y nodos JSX.

La CLI de producción conserva estas líneas de progreso antes del informe de terminal seleccionado y
de las confirmaciones de informes en archivos:

```text
Project path validated: <canonical-project-path>
Discovery summary: discovered=<n> inventory=<n> candidates=<n> exclusions=<n> issues=<n>
Parsing summary: parsed=<n> failed=<n> components=<n> jsx=<n>
```

El recorrido predeterminado omite los enlaces simbólicos. Existe una política interna
`follow-within-root` para clientes controlados, pero todavía no se expone como opción de la CLI. Los
fallos de operaciones descendientes pueden conservarse como problemas recuperables; un fallo de una
invariante de la raíz o del flujo detiene el procesamiento con un mensaje estable.

Los candidatos clasificados se procesan secuencialmente según el orden ordinal de la ruta relativa al
proyecto. El lector vuelve a autorizar la raíz canónica del proyecto y el candidato antes y después
de abrir y leer un descriptor de archivo. Solo acepta archivos regulares dentro de la raíz de hasta
1 MiB, solicita como máximo 64 KiB por lectura, rechaza UTF-8 no válido y conserva un BOM UTF-8
inicial. Los fallos de lectura y sintaxis, y los fallos esperados de extracción, se conservan
separados del modelo para que puedan continuar los archivos hermanos posteriores. Las declaraciones
internas no portables de candidatos, la autorización de la raíz, las invariantes del lote de
candidatos, las invariantes inesperadas de extracción y las invariantes del modelo siguen siendo
fatales y no exponen detalles.

El adaptador de Babel es propietario del AST transitorio e integra la decodificación estricta de
texto, el análisis sintáctico específico del tipo de código fuente y la extracción sin AST. Ningún
módulo objetivo, script de paquete ni configuración del proyecto se importa o ejecuta. El modelo
normalizado conserva archivos, componentes justificados sintácticamente, elementos/fragmentos JSX,
atributos, valores, relaciones y ubicaciones UTF-16 semiabiertas. No afirma representar la semántica
de React en tiempo de ejecución.

El informe de terminal ya se sanea por cada valor dinámico y puede agregar insignias ANSI fijas y
confiables. La CLI lo escribe directamente en vez de volver a aplicar por segunda vez el saneador
anterior sobre toda la salida. El progreso, los diagnósticos de Commander, los errores tipados y las
confirmaciones de rutas generadas permanecen saneados.

## Ejecución exitosa

Una auditoría exitosa devuelve un `AuditResult` que contiene:

- raíz del proyecto;
- metadatos de inicio/fin o duración;
- archivos descubiertos, seleccionados, analizados y fallidos;
- conteos de reglas habilitadas y ejecutadas;
- hallazgos normalizados;
- errores de ejecución recuperables;
- resumen por categoría y severidad;
- rutas de destino JSON/HTML configuradas.

Esas rutas de destino describen la salida seleccionada, no una persistencia exitosa. La CLI solo
anuncia como generados los registros `WrittenReport` devueltos.

## Códigos de salida

Política implementada en M06:

- `0`: ayuda/versión o una auditoría completada, incluso cuando se conservaron hallazgos o errores
  recuperables de descubrimiento/código fuente/reglas.
- `1`: reservado para una futura política configurada de fallo por hallazgos. La configuración
  actual no tiene ese campo y `minimumSeverity` solo controla la presentación en terminal.
- `2`: error de entrada del comando, argumento, ruta/acceso del proyecto o configuración.
- `3`: fallo fatal de validación, descubrimiento, inventario, clasificación, autorización de la
  raíz, lote de código fuente, modelo, orquestación de reglas/resultados, escritura de informes o
  fallo inesperado de la aplicación.

## Determinismo

Con el mismo contenido del proyecto, configuración y versión de UXAudit, el orden y el contenido de
los resultados deben ser estables. Las marcas de tiempo absolutas y las duraciones pueden variar y
no deben afectar las comparaciones de instantáneas.

## Hallazgo

Cada hallazgo contiene al menos:

- ID y título de la regla;
- categoría;
- severidad;
- mensaje y explicación;
- recomendación;
- limitaciones y confianza;
- una ubicación completa semiabierta en el código fuente relativa al proyecto cuando esté
  disponible;
- fragmento opcional de evidencia o metadatos;
- estándar/referencia estructurado que admite valores nulos.

El contrato de dominio de M04 conserva líneas basadas en uno y
columnas/desplazamientos UTF-16 basados en cero. Los generadores de informes de M05 son responsables
de cualquier conversión a coordenadas de presentación.

## Configuración

La configuración es JSON local. Las claves desconocidas, los valores no válidos y las opciones en
conflicto deben producir un error claro y estable. `uxaudit.config.json` en la raíz canónica del
proyecto es opcional; una ruta seleccionada explícitamente debe existir. Los archivos deben ser
regulares, no superar 64 KiB, contener JSON UTF-8 estricto y nunca se importan ni ejecutan. El archivo
de versión 1 solo acepta `schemaVersion`, `categories`, `ruleIds`, `formats`, `outputDirectory`,
`minimumSeverity`, `color` y `verbose`; las claves de nivel superior duplicadas se rechazan en vez de
resolverse mediante el comportamiento donde prevalece el último valor.

Los valores predeterminados son salida solo en terminal, severidad mínima de presentación `info`,
color habilitado, modo detallado deshabilitado, `uxaudit-reports` y filtros de categorías/reglas
`null`. Un archivo puede sobrescribir cualquier valor predeterminado; los valores validados de la CLI
sobrescriben el archivo. Los filtros `null` de categorías/reglas seleccionan el catálogo estable,
mientras que los arreglos vacíos explícitos no seleccionan ninguna regla. Los arreglos de selección
se deduplican y normalizan a un orden estable. Los directorios de salida deben ser rutas relativas
portables sin segmentos punto, barras invertidas, caracteres de control/bidireccionales ni
componentes reservados de Windows. Una configuración seleccionada explícitamente constituye una
autoridad independiente del usuario y puede estar fuera de la raíz del proyecto.

## Informes

- Terminal: resumen inmediato conciso, grupos completos de categoría/severidad/etapa de error,
  hallazgos legibles y ordenados canónicamente en o por encima del umbral inclusivo de presentación,
  columnas de presentación basadas en uno, detalle de errores normalizado opcional y modos
  explícitos con color/sin color. Los totales del resumen siempre describen el resultado completo,
  incluso cuando se filtra el detalle de los hallazgos.
- JSON: el resultado completo estable y legible por máquina, incluidos los metadatos de tiempo y las
  columnas UTF-16 almacenadas basadas en cero, serializado con sangría de dos espacios y un único LF
  final.
- HTML: un informe completo, autónomo y con contenido escapado que no requiere servicios externos.
  Muestra todos los hallazgos y errores normalizados independientemente de los ajustes de
  severidad/nivel de detalle de la terminal, los agrupa en un orden fijo de severidad/etapa, muestra
  columnas basadas en uno junto con desplazamientos UTF-16 y rangos de fin exclusivo, y mantiene
  inertes las referencias inseguras.

Los destinos JSON y HTML solo utilizan el directorio de salida portable configurado y nombres de
archivo fijos. El escritor compartido rechaza destinos existentes y enlaces, escapes o cambios de
identidad observados, y reporta fallos estables sin afirmar que se generó una ruta. Un fallo después
de la creación exclusiva puede dejar un destino parcial para su revisión/eliminación manual;
desvincularlo automáticamente después de una carrera en el nombre de ruta no sería seguro.

El tiempo de la auditoría termina cuando se construye el `AuditResult` inmutable y excluye la
persistencia posterior. Cuando se seleccionan varios formatos de archivo, JSON se escribe antes que
HTML. Por lo tanto, un fallo posterior puede dejar un archivo hermano completado o un destino
parcial; la CLI devuelve `3`, no anuncia ningún conjunto de informes completado y no realiza una
reversión insegura.

El documento HTML contiene CSS constante en línea, no contiene scripts ni recursos externos, y
utiliza al principio una CSP sin scripts/objetos/base/formularios. Cada valor dinámico se neutraliza
contra controles hostiles, formato direccional, BOM y UTF-16 malformado antes de escapar HTML. Solo
una referencia HTTP(S) que se volvió a analizar por separado y no contiene controles ni credenciales
se convierte en un enlace.
