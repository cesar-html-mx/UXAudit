**Español** | [English](../06_TEST_STRATEGY.md)

# Estrategia de pruebas

## Objetivos

Las pruebas deben demostrar que UXAudit:

- produce resultados normalizados correctos para casos estáticos compatibles;
- permanece determinista con entradas estables;
- aísla fallos recuperables de archivos y reglas;
- rechaza rutas inseguras, configuraciones malformadas e invariantes rotas;
- nunca ejecuta ni modifica el código objetivo;
- presenta hechos equivalentes mediante terminal, JSON y HTML;
- puede instalarse y ejecutarse desde el paquete que reciben las personas usuarias.

## Capas de pruebas

| Capa               | Enfoque                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Unitaria           | Validadores puros, orden, modelo, reglas, resúmenes, escape y generación.                         |
| Integración        | Adaptadores de archivos, composición parser/modelo, configuración, motor de reglas y escritores.  |
| CLI                | Argumentos, ayuda, avance, salida segura, anuncios de informes y códigos de salida.               |
| Sistema            | Ejecutable compilado contra proyectos controlados válidos, inválidos, mixtos, hostiles y grandes. |
| Distribución       | Lista del paquete, metadatos, permiso ejecutable, instalación, resolución y análisis consumidor.  |
| Seguridad/robustez | Enlaces, recorrido, permisos, datos malformados, valores hostiles, límites y no ejecución.        |

El comportamiento público requiere casos positivos, negativos, de límite y error en la capa útil más
baja, además de un caso integral cuando la composición pueda cambiar el resultado.

## Comandos focalizados del repositorio

| Comando                           | Alcance                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm test`                        | Suite focalizada completa de Vitest.                                       |
| `npm run test:coverage`           | Cobertura V8 y umbrales globales.                                          |
| `npm run test:smoke`              | Casos de humo del comando compilado y sus códigos de salida.               |
| `npm run test:scenario:discovery` | Recorrido, inventario, clasificación, enlaces y exclusiones deterministas. |
| `npm run test:scenario:parser`    | Lecturas seguras, parsing, extracción, modelo y aislamiento.               |
| `npm run test:scenario:rules`     | Catálogo, filtros, orden, hallazgos y aislamiento de reglas.               |
| `npm run test:scenario:reporting` | Configuración, generadores, escape y persistencia segura.                  |
| `npm run test:scenario:system`    | Auditorías completas de proyectos controlados con la CLI compilada.        |
| `npm run test:accuracy`           | Casos revisados por regla y cálculo de la matriz de confusión.             |
| `npm run test:robustness`         | Entradas inválidas, seguridad, determinismo y rendimiento descriptivo.     |
| `npm run test:usability`          | Revisión experta repetible de tareas principales de desarrollo.            |
| `npm run test:package`            | Contenido del tarball, instalación, ejecutable y flujo consumidor.         |

`npm run verify` es la puerta normal para contribuir. `npm run release:check` compone la puerta local
completa para una versión pública.

## Proyectos controlados

Los fixtures de sistema cubren:

- un proyecto válido sin hallazgos esperados;
- un proyecto inválido con un activador revisado para cada regla incluida;
- un proyecto mixto JavaScript/TypeScript con hallazgos, exclusiones seguras y un fallo recuperable
  de sintaxis;
- un proyecto hostil para Unicode, enlaces, escape HTML y no ejecución del código objetivo;
- un proyecto grande generado para observaciones repetidas de la canalización completa.

Los resultados esperados se versionan en el nivel semántico. Las comparaciones normalizan únicamente
campos volátiles documentados, como raíces temporales canónicas, marcas de tiempo, duración y
observaciones de memoria dependientes de la máquina.

## Corpus intercomponente acotado

El corpus intercomponente controlado fija expectativas revisadas para imports relativos directos
`default` y nombrados, un alias de import nombrado, un uso local de componente y el uso repetido de un
componente importado. Su composición compatible contiene una `Page` que usa `Header` y `Hero`, con un
`h1` intrínseco en cada componente hijo. Los enlaces esperados, propiedad del hallazgo, ubicaciones
exactas y multiplicidad del uso repetido se versionan antes de la implementación.

Los casos de límite incluyen un ciclo de componentes, un módulo relativo faltante, un import de
paquete, sintaxis de namespace, un barrel o reexport, un alias de ruta de TypeScript, un candidato
relativo ambiguo, un binding sombreado y un centinela de ejecución de código objetivo. Los ciclos
deben terminar con resultados deterministas; los casos no compatibles o no resueltos deben permanecer
desconocidos y no deben adquirir enlaces especulativos. Invertir el orden de entrada de los archivos
analizados debe conservar los mismos enlaces y hallazgos ordenados.

Cada comportamiento intercomponente descrito como compatible en requisitos, arquitectura, metadatos
de reglas o documentación para personas usuarias debe aparecer como una instancia compatible
positiva, negativa o de límite. No debe excluirse de precisión o exhaustividad como caso no
compatible. Solo el comportamiento explícitamente fuera del contrato acotado puede contabilizarse
por separado como no compatible.

## Pruebas de reglas

Cada regla necesita:

- validación de metadatos y cobertura del ID único;
- al menos un caso positivo compatible;
- al menos un caso negativo compatible;
- casos dinámicos o no compatibles que no deben convertirse en hallazgos injustificados;
- aserciones exactas de ubicación, mensaje, severidad, confianza, recomendación y limitaciones;
- comportamiento aislado cuando otra regla falla.

Los cálculos de exactitud usan instancias revisadas. Los casos positivos contribuyen a verdaderos
positivos o falsos negativos; los negativos contribuyen a verdaderos negativos o falsos positivos.
Los casos no compatibles quedan fuera de los denominadores de precisión y exhaustividad y se
informan por separado. Las puntuaciones de un corpus controlado no deben generalizarse a proyectos
React arbitrarios.

## Pruebas de seguridad y robustez

Usa operaciones reales del sistema de archivos cuando funcionen de forma equivalente entre
plataformas y adaptadores inyectados para carreras o permisos que no puedan reproducirse con
seguridad. Cubre:

- raíces faltantes, vacías, que sean archivo, ilegibles o cambiantes;
- enlaces internos, externos, rotos, cíclicos y omitidos;
- candidatos malformados, demasiado grandes, UTF-8 inválidos, cambiantes o no regulares;
- destinos de informe inseguros, enlazados, existentes, parciales o inaccesibles;
- controles hostiles de terminal, caracteres bidireccionales, contenido HTML y referencias;
- valores de configuración malformados, grandes, desconocidos, duplicados o conflictivos;
- módulos objetivo con centinelas que revelarían una ejecución accidental.

Las pruebas de seguridad verifican un cierre seguro y mensajes estables, no textos nativos de cada
plataforma.

## Pruebas de rendimiento

Las comprobaciones de rendimiento ejercitan la CLI compilada completa sobre un tamaño y entorno
documentados. Registra varias duraciones de reloj y observaciones de memoria sin convertir los
valores de una máquina en un umbral general. Los límites funcionales, la salida determinista y las
operaciones acotadas se aplican independientemente del tiempo.

## Pruebas de usabilidad

Las tareas principales incluyen instalación, descubrimiento de ayuda, análisis predeterminado,
generación de informes, filtro de reglas e interpretación de un hallazgo. La revisión automatizada o
experta puede detectar fricción, pero no debe describirse como investigación con participantes. Los
resultados de participantes y puntuaciones estandarizadas solo se informan cuando personas reales
completaron el protocolo definido.

## Política de cobertura y publicación

Los umbrales globales de cobertura son al menos 90 % para sentencias, ramas, funciones y líneas. El
código nuevo debe mantener ramas focalizadas significativas en lugar de satisfacer cobertura mediante
ejecución incidental.

Una versión candidata aprueba formato, documentación bilingüe, lint, tipos estrictos, todas las
pruebas requeridas, compilación, instalación del paquete, escenarios de sistema y una auditoría
moderada de dependencias. Ninguna prueba requerida puede omitirse ni marcarse como pendiente. Las
comprobaciones específicas de plataforma deben indicar cuando no pudieron ejecutarse en lugar de
presentarse como aprobadas.
