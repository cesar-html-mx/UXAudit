**Español** | [English](../14_ACADEMIC_ALIGNMENT.md)

# Alineación académica para la Actividad 3

La entrega de pruebas debe basarse en evidencia ejecutada de la implementación real de UXAudit.

## Contenido esperado

1. Objetivos y entorno de las pruebas.
2. Pruebas unitarias:
   - unidades seleccionadas;
   - entradas y resultados esperados;
   - herramientas y justificación;
   - resultados ejecutados.
3. Pruebas de integración:
   - límites entre componentes;
   - interacciones y contratos de datos;
   - resultados ejecutados.
4. Pruebas de sistema/extremo a extremo:
   - flujo completo de la CLI;
   - escenarios normales y de error;
   - proyectos controlados.
5. Validación:
   - hallazgos esperados frente a obtenidos;
   - verdaderos/falsos positivos y falsos negativos;
   - limitaciones.
6. Usabilidad:
   - tareas definidas para personas desarrolladoras;
   - observaciones de tiempo, errores y retrocesos;
   - revisión heurística o SUS con participantes reales.
7. Seguridad:
   - modelo de amenazas real de la CLI local;
   - entrada de proyecto hostil;
   - seguridad de rutas, enlaces simbólicos, salidas, dependencias y HTML.
8. Acciones correctivas y trabajo restante.

## Evidencia requerida

- salidas de los comandos de prueba;
- versiones de herramientas y del entorno;
- resumen de cobertura con interpretación;
- resultados esperados y reales de los fixtures;
- muestras de informes de terminal, JSON y HTML;
- lista de comprobación de seguridad y resultados observados;
- protocolo de usabilidad y respuestas sin procesar/agregadas;
- lista de defectos encontrados y correcciones;
- lista veraz de pruebas no ejecutadas o no compatibles.

Los planes no deben presentarse como pruebas completadas.

## Evidencia de validación ejecutada en M06-T03

El ejecutor de validación usa la CLI compilada con proyectos confirmados y revisados, relaciona las
ubicaciones de los hallazgos observados con instancias explícitas de verdad de referencia y conserva
matrices de confusión por regla en JSON/CSV. El corpus actual contiene 11 instancias positivas, ocho
negativas y ocho no compatibles. Los resultados compatibles observados fueron 11 TP, cero FP, ocho
TN y cero FN; hubo cero detecciones no compatibles. La precisión y la exhaustividad se informan por
regla y se limitan explícitamente a este corpus sintético.

## Evidencia de sistema, robustez, rendimiento y seguridad ejecutada en M06-T04

El ejecutor de robustez sin shell ejercitó 15 casos de la CLI compilada en Linux y todos pasaron. El
conjunto ejecutado incluye raíces y configuraciones normales y no válidas, la ausencia de un
argumento de análisis, denegación real de permisos del proyecto y de la salida de informes,
protección contra escape y sobrescritura de salida, aislamiento de fuentes malformadas, una fuente
por debajo de 32 directorios anidados, tres enlaces simbólicos creados y excluidos, centinelas de no
ejecución, inspección estructural del escape de HTML/CSP y nuevas ejecuciones deterministas con
raíces nuevas.

La evidencia de rendimiento consta de cinco análisis completos sobre el proyecto generado de 240
archivos. Registra cada muestra de tiempo transcurrido, resúmenes de mínimo/mediana/máximo y el
`VmRSS` máximo del proceso hijo observado mediante muestreo de `/proc` de Linux cada 5 ms, sin
definir un umbral de aceptación dependiente de la máquina. El valor de memoria muestreado no se
presenta como un máximo exacto de toda la vida del proceso. La auditoría de npm con umbral moderado
informó cero vulnerabilidades. CodeQL alojado permanece explícitamente sin ejecutar porque no se
recuperó ningún resultado alojado; la inspección de su workflow no se presenta como un análisis
ejecutado.

## Sustituto de usabilidad ejecutado y límites de M06-T05

No se ejecutó ninguna sesión con participantes ni cuestionario SUS. El repositorio registra con
veracidad las pruebas con participantes como no ejecutadas, el número de participantes como cero,
SUS como no aplicable, el número de respuestas como cero y la puntuación como null.

El sustituto disponible es una revisión heurística experta con seis tareas versionadas. Su ejecutor
sin shell usa la CLI compilada para inspeccionar el descubrimiento de comandos, la ejecución completa
de la auditoría, la priorización por severidad, la ubicación en el código fuente, la orientación de
las recomendaciones y las rutas generadas de JSON/HTML. Los registros por tarea incluyen
finalización, duración real del procedimiento experto programado, errores del procedimiento,
retrocesos, uso de ayuda, observación, severidad y acción correctiva. Los tiempos y conteos de
interacción no son mediciones de participantes.

Los seis procedimientos controlados se completaron. La revisión registra una observación de
priorización de severidad baja sobre hallazgos de severidad alta empatados y ninguna observación
media/alta. Estos resultados respaldan una inspección experta de la CLI local actual; no establecen
satisfacción de las personas usuarias, facilidad de aprendizaje en una población ni una puntuación
SUS.

## Paquete de evidencia de la Actividad 3 de M06-T05

El paquete aislado de la Actividad 3 conserva el entorno y digest exactos de la fuente, comandos sin
procesar, totales de pruebas y cobertura legibles por máquina, resultados esperados y reales de
proyectos controlados, muestras de terminal/JSON/HTML, verdad de referencia y matrices de confusión
por regla, observaciones de robustez/seguridad, cinco mediciones de rendimiento, JSON/CSV de revisión
experta, defectos y correcciones, estados explícitos no compatibles/no ejecutados y resúmenes
objetivos de implementación/pruebas.

La ejecución definitiva pasó 619 pruebas en 56 archivos con cero fallidas/omitidas/todo, todos los
umbrales de cobertura, 11 smokes compilados, cinco proyectos controlados, 11 TP/0 FP/8 TN/0 FN en el
corpus revisado, 15 casos de robustez, cinco ejecuciones de rendimiento de 240 archivos, seis tareas
expertas y cero vulnerabilidades de dependencias. Una segunda ejecución aislada coincidió con los
resultados estables y conservó el primer paquete base de 42 artefactos. Su digest de fuente es
`sha256:92bd1c57cf85126082270c9111b03cd00fe28491d77a8c9cba7aa0b4d8ad404b`.

El paquete no convierte las pruebas con participantes, SUS, CodeQL/CI alojados, el comportamiento en
tiempo de ejecución del navegador ni la publicación remota no ejecutados en evidencia completada. El
informe del hito solo se agrega mediante el finalizador independiente después de completar la tarea
y la autoevaluación. La finalización pasó, y el manifiesto SHA-256 resultante cubre los 42 artefactos
base más `MILESTONE_REPORT.md`.
