**Español** | [English](../01_PROJECT_CONTEXT.md)

# Contexto del proyecto

## Problema

Los equipos de React pueden introducir riesgos revisables de usabilidad, accesibilidad, SEO y
rendimiento directamente en JSX y TSX. Los linters generales cubren bien la sintaxis y las
convenciones de código, pero no siempre presentan estos aspectos transversales como una sola
auditoría local y comprensible.

## Propósito del producto

UXAudit ofrece a quienes desarrollan una revisión estática temprana y repetible antes de validar con
navegadores y personas. Descubre fuentes `.js`, `.jsx`, `.ts` y `.tsx`, construye un modelo
normalizado, evalúa reglas independientes y produce informes de terminal, JSON y HTML.

El producto ayuda a priorizar la revisión. No certifica cumplimiento ni sustituye pruebas con
navegadores, tecnologías de asistencia, herramientas de rendimiento o participantes.

## Personas usuarias previstas

- Quienes desarrollan con React y TypeScript y quieren retroalimentación mientras programan.
- Quienes mantienen proyectos y quieren un comando reproducible de auditoría en integración continua.
- Especialistas en UX, accesibilidad, SEO y rendimiento que necesitan un informe revisable en
  distintas plataformas.
- Quienes contribuyen al escáner, modelo, reglas o generadores de informes.

## Límites del producto

- Herramienta local de línea de comandos; no hay servicio alojado, base de datos ni telemetría.
- Solo análisis estático; el código objetivo no se importa, ejecuta ni modifica.
- Las extensiones compatibles son `.js`, `.jsx`, `.ts` y `.tsx`.
- Los hallazgos son observaciones deterministas con recomendaciones y limitaciones explícitas.
- El diseño, comportamiento, estilos, red y experiencia real en ejecución quedan fuera del alcance.
- Los informes permanecen en el sistema de archivos local salvo que la persona decida compartirlos.

## Principios del producto

La seguridad, el determinismo, los límites honestos, la salida accionable y un comando sencillo son
más importantes que maximizar la cantidad de hallazgos especulativos. Los casos dinámicos no
compatibles deben permanecer como desconocidos en lugar de presentarse como defectos comprobados.
