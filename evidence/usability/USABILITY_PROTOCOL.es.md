# Protocolo de usabilidad de UXAudit

**Español** | [English](USABILITY_PROTOCOL.md)

## Perfil de participantes

Personas desarrolladoras frontend o estudiantes con conocimientos básicos de React/TypeScript y uso
de la terminal. Registra su nivel real de experiencia sin recopilar datos personales innecesarios.

## Tareas

1. Encontrar cómo ejecutar un análisis.
2. Analizar el proyecto controlado proporcionado.
3. Identificar el hallazgo de mayor severidad.
4. Localizar el archivo fuente y la línea relacionados.
5. Explicar el hallazgo y la corrección propuesta.
6. Localizar y abrir los informes JSON y HTML.

## Medidas

- finalización de tareas;
- tiempo;
- errores;
- retrocesos;
- ayuda solicitada;
- comentarios y confusión;
- satisfacción posterior a la tarea;
- SUS solo con respuestas reales.

## Ética y veracidad

La participación es voluntaria. No identifiques a las personas participantes en el repositorio. Si no
se realiza una prueba con participantes, describe el trabajo como una revisión heurística, no como
una prueba con personas usuarias.

## Ejecución de la revisión experta de M06

No hay observaciones ni respuestas de participantes disponibles para M06. El sustituto ejecutado es
una revisión heurística experta de las seis tareas anteriores, versionada en
`fixtures/m06-validation/heuristic-review.json` y reproducida mediante
`npm run test:usability:m06`.

El ejecutor invoca la CLI compilada sin un shell y registra, para cada tarea:

- finalización;
- duración de reloj de pared del procedimiento programado de revisión experta;
- errores del procedimiento y retrocesos;
- si se utilizó la ayuda de la CLI;
- observación revisada, severidad y acción correctiva.

Esas duraciones no son tiempos de tareas de participantes. Cero errores del procedimiento, cero
retrocesos y el uso de la ayuda describen únicamente el script de revisión ejecutado; no deben
generalizarse a las personas usuarias.

Cuando se proporciona `--output <directory>` directamente a `scripts/run-m06-usability.mjs`, este
escribe `heuristic-review.json`, `usability-status.json` y `heuristic-review.csv`. Los dos primeros
son las entradas legibles por máquina que espera el recopilador final de evidencia de M06.
