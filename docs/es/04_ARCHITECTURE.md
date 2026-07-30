**Español** | [English](../04_ARCHITECTURE.md)

# Arquitectura

## Vista general del sistema

UXAudit es una CLI local por capas. Los adaptadores del sistema de archivos y parser convierten un
proyecto autorizado en un modelo normalizado del dominio. Las reglas solo operan sobre ese modelo.
Los generadores de informes solo operan sobre un resultado normalizado de auditoría.

```text
project path
  -> path validation
  -> discovery and inventory
  -> source classification and bounded reading
  -> parsing and normalized analysis model
  -> rule loading and isolated evaluation
  -> normalized audit result
  -> terminal / JSON / HTML reporters
```

Esta dirección evita que las reglas dependan de nodos de sintaxis de Babel y que los generadores
repitan el análisis.

## Límites de módulos

| Área                       | Ubicación            | Responsabilidad                                                                     |
| -------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Ejecutable y CLI           | `src/cli/`           | Comandos Commander, salida segura, origen de opciones y mapeo de códigos de salida. |
| Aplicación                 | `src/application/`   | Orquestar escaneo, análisis, auditoría, tiempos y persistencia de informes.         |
| Procesamiento del proyecto | `src/project/`       | Validar raíces, descubrir entradas, crear inventario y clasificar candidatos.       |
| Parsing                    | `src/parsing/`       | Lecturas acotadas, adaptador Babel, extracción y aislamiento de fallos por archivo. |
| Dominio de análisis        | `src/domain/models/` | Archivos, componentes, nodos JSX, valores, relaciones y ubicaciones independientes. |
| Dominio de auditoría       | `src/domain/audit/`  | Errores normalizados, contadores, tiempos, hallazgos e invariantes del resultado.   |
| Dominio de reglas          | `src/domain/rules/`  | Metadatos, evaluación, categorías, severidad, confianza y estado de reglas.         |
| Reglas                     | `src/rules/`         | Registro, selección, evaluación aislada y verificaciones por categoría.             |
| Configuración              | `src/configuration/` | Lectura JSON inerte, validación estricta, predeterminados y reemplazos explícitos.  |
| Informes                   | `src/reporting/`     | Generación pura de terminal, JSON y HTML, y escritura exclusiva segura.             |
| Utilidades de seguridad    | `src/shared/`        | Normalización neutral reutilizada en límites públicos de salida.                    |

Las dependencias apuntan hacia contratos explícitos internos. Los módulos del dominio no importan
adaptadores de la CLI ni de informes.

## Flujo de procesamiento

La fachada completa de aplicación valida el proyecto antes de buscar la configuración. La
configuración se carga antes del recorrido para conocer las reglas y formatos seleccionados. Después,
el análisis de fuentes escanea, clasifica, lee, analiza y construye un solo modelo. La carga y
evaluación de reglas ocurre una vez. El resultado se congela antes de persistir cualquier informe.

El tiempo de auditoría cubre desde la validación hasta la construcción del resultado normalizado.
Excluye intencionalmente la persistencia posterior de JSON y HTML. El valor devuelto por la aplicación
separa el resultado de auditoría de la lista de archivos cuya escritura se confirmó.

## Contratos principales

### Descubrimiento e inventario

La raíz canónica del proyecto es el límite de autorización. El descubrimiento usa orden ordinal
determinista, omite enlaces de forma predeterminada, evita ciclos cuando el seguimiento interno está
habilitado y registra fallos recuperables de descendientes. La identidad del inventario se basa en
rutas canónicas, mientras el orden público usa rutas normalizadas relativas al proyecto.

Una entrada de inventario solo es un candidato. Las lecturas posteriores deben volver a validar la
raíz, ruta, identidad de archivo regular, instantánea del descriptor, tamaño y autorización final.

### Parsing y modelo de análisis

El límite del parser recibe texto acotado y un tipo explícito de fuente, y devuelve un éxito
normalizado o un fallo seguro tipado. Los árboles de sintaxis de Babel y el texto fuente permanecen
dentro del límite.

`AnalysisModel` es una representación plana y serializable de archivos, propiedad reconocida de
componentes, nodos JSX, atributos efectivos, valores estáticos conservados y ubicaciones semiabiertas.
Las líneas empiezan en uno; las columnas almacenadas y desplazamientos UTF-16 empiezan en cero. Los
IDs y arreglos usan orden determinista, y el modelo terminado es inmutable de forma recursiva.

El reconocimiento de componentes es sintáctico y conservador. Reconoce patrones compatibles de
funciones, flechas y clases, pero no resuelve importaciones, alias en ejecución, componentes de orden
superior, rutas ni composición renderizada.

### Reglas y hallazgos

Una `Rule` combina metadatos inmutables con una función de evaluación que recibe el modelo
normalizado. No puede leer archivos fuente ni consumir nodos de Babel mediante el contrato público.

El registro valida IDs únicos y definiciones inmutables. La carga aplica filtros de categoría e ID en
orden canónico. El evaluador ejecuta una vez cada regla habilitada, valida sus observaciones, las
normaliza como hallazgos autosuficientes y registra un error seguro si una regla falla. Las demás
reglas continúan cuando el aislamiento es seguro.

Un hallazgo normalizado contiene identidad de regla, categoría, severidad, confianza, explicación,
recomendación, limitaciones, mensaje, referencia y una copia defensiva de la ubicación disponible.

### Resultado de auditoría e informes

`AuditResult` con esquema `1.0.0` es el único valor inmutable consumido por todos los generadores.
Contiene:

- versiones del producto y esquema;
- raíz canónica del proyecto y tiempos;
- configuración efectiva y rutas configuradas de informes;
- resúmenes de archivos, reglas, hallazgos, severidad, categoría y errores de procesamiento;
- hallazgos y errores recuperables normalizados.

El generador de terminal puede filtrar detalle visible, no los totales subyacentes. El generador JSON
conserva el valor completo. El generador HTML presenta el valor completo con agrupación fija y escape
seguro. Los generadores son funciones puras; la persistencia es un adaptador independiente.

### Configuración

`AuditConfiguration` es un valor completo y validado. El cargador lee el archivo opcional
`uxaudit.config.json` o uno explícito como JSON UTF-8 inerte, valida un esquema cerrado y mezcla solo
los valores de CLI proporcionados expresamente sobre el archivo y los predeterminados.

Los filtros de categoría o regla con `null` significan sin filtro. Un arreglo vacío selecciona cero
elementos de forma intencional. Los directorios de salida son rutas relativas al proyecto y
compatibles entre plataformas; los nombres de informe son fijos según el formato.

## Modelo de errores

Los errores públicos son estables y tipados en el límite que puede decidir la recuperación:

- los comandos, rutas o configuraciones inválidos se convierten en fallos de entrada;
- los descendientes inaccesibles, fuentes individuales malformadas y fallos aislados de reglas pueden
  registrarse y permitir que continúen los elementos seguros;
- las invariantes rotas, fallos de autorización de raíz y de persistencia detienen la auditoría;
- las causas nativas del sistema de archivos y parser no se exponen directamente.

La CLI sanea los valores dinámicos antes de mostrarlos. Un error recuperable nunca se descarta en
silencio: contribuye a contadores normalizados y está disponible en los informes completos.

## Determinismo

Archivos, entidades del modelo, reglas seleccionadas, hallazgos, errores y grupos de informes tienen
un orden estable explícito. Los valores duplicados se rechazan o eliminan en límites definidos. Un
árbol de fuentes, configuración, versión de UXAudit, semántica del sistema de archivos de la
plataforma y reloj inyectado fijos producen la misma proyección estable. La raíz, marcas de tiempo y
duración son campos volátiles esperados.

## Autorización del sistema de archivos y salida

Los lectores y escritores usan raíces canónicas, comprobaciones basadas en descriptores, fragmentos
acotados y autorización posterior a la operación. El escritor crea directorios faltantes con permisos
restrictivos, rechaza enlaces y destinos existentes, y nunca anuncia un archivo antes de que su
sincronización, cierre y autorización final tengan éxito.

Se evita deliberadamente una reversión automática después de una escritura parcial ambigua porque una
condición de carrera en la identidad de la ruta podría eliminar un archivo que ya no pertenece a la
operación.

## Reglas de extensión

- Agrega una sintaxis de fuente solo mediante el límite del parser y el modelo normalizado.
- Agrega una regla mediante el registro validado; no la acoples a módulos de CLI ni informes.
- Agrega un formato como generador puro de `AuditResult` y una ruta de persistencia autorizada.
- Conserva las dependencias unidireccionales y el orden determinista.
- Trata cualquier cambio de esquemas de configuración, hallazgo, resultado, códigos de salida o
  informes como un cambio de contrato público que requiere pruebas y documentación bilingüe.

Hay referencias visuales complementarias en
