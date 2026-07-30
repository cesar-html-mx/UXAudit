**Español** | [English](../01_PROJECT_CONTEXT.md)

# Contexto del proyecto

## Problema

La calidad del frontend depende de varias áreas relacionadas: UX, accesibilidad, SEO técnico y
rendimiento. Existen estándares y herramientas especializadas, pero el conocimiento y las
comprobaciones están distribuidos. La calidad de la revisión puede depender demasiado de la
experiencia y la memoria de cada desarrollador.

## Contribución

UXAudit proporcionará un proceso repetible de análisis estático para código fuente React y
TypeScript. No reemplazará la revisión experta. Ayudará a los desarrolladores a identificar
determinados problemas con anticipación, entender por qué son importantes, localizar el código
pertinente y recibir una recomendación.

## Usuario principal

Un desarrollador frontend que trabaja en un proyecto React desde una terminal.

## Flujo principal

1. El desarrollador proporciona la ruta de un proyecto.
2. UXAudit valida el acceso al proyecto.
3. Descubre y clasifica los archivos pertinentes.
4. Analiza sintácticamente el código fuente y crea un modelo normalizado.
5. Las reglas habilitadas evalúan el modelo.
6. Los hallazgos se normalizan y ordenan.
7. Los generadores de informes para terminal, JSON y HTML presentan el mismo resultado.

## Alcance

- Ejecución local desde la línea de comandos.
- Análisis estático.
- Proyectos React y TypeScript, incluidos aquellos que combinan `.js`/`.jsx`.
- Reglas iniciales de UX, accesibilidad, SEO y rendimiento.
- Hallazgos explicables con ubicación en el código fuente y recomendación.
- Proyectos de validación controlados y cercanos a casos reales.

## Exclusiones

- Ejecutar la aplicación analizada.
- Automatización del navegador o medición del rendimiento en tiempo de ejecución en el MVP.
- Modificación automática del código analizado.
- Un servicio alojado, cuentas de usuario, base de datos o telemetría.
- Una afirmación de conformidad completa con WCAG, SEO, UX o Core Web Vitals.
- Compatibilidad con todos los frameworks o lenguajes de programación.

## Éxito

La primera versión será exitosa cuando pueda analizar de forma reproducible proyectos controlados,
producir los hallazgos esperados con un comportamiento aceptable de falsos positivos y falsos
negativos para las reglas implementadas, y generar salidas coherentes para terminal, JSON y HTML.
