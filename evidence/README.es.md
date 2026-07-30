# Evidencia de UXAudit

**Español** | [English](README.md)

Cada hito almacena aquí evidencia reproducible. Usa la plantilla
`.github/harness/templates/TEST_EVIDENCE_TEMPLATE.md`.

Estructura requerida:

```text
evidence/
├── m01-bootstrap/
├── m02-discovery/
├── m03-parsing/
├── m04-rules/
├── m05-reporting/
├── m06-validation/
├── usability/
└── security/
```

No incluyas secretos, rutas absolutas privadas ni salidas sin procesar modificadas.

## Paquetes disponibles

- `m01-bootstrap/`: evidencia completa de la base de la CLI con Node.js 24, incluida una instalación
  aislada con `npm ci`, la puerta de calidad del producto, cobertura, escenarios de la CLI compilada,
  validación del harness, auditoría de dependencias y el digest SHA-256 de la instantánea exacta del
  código fuente, además de un manifiesto de integridad por artefacto. Comienza con
  `m01-bootstrap/SUMMARY.md`.
- `m02-discovery/`: evidencia completa de descubrimiento, inventario y clasificación con Node.js 24,
  incluida una instalación aislada con `npm ci`, la puerta de calidad del producto, cobertura,
  pruebas de humo compiladas de la CLI, un proyecto controlado con resultados esperados y reales
  revisados, repeticiones deterministas, pruebas de enlaces simbólicos y exclusiones, auditoría de
  dependencias, digest de la instantánea de la fuente, un registro de pruebas sin omisiones ni tareas
  pendientes y un manifiesto SHA-256 por artefacto que cubre el informe finalizado del hito. Comienza
  con `m02-discovery/SUMMARY.md`.
- `m03-parsing/`: evidencia completa del lector de fuentes, canalización de Babel, modelo normalizado
  y aislamiento de errores con Node.js 24. Incluye una instalación aislada con `npm ci`, la puerta de
  calidad del producto, cobertura, pruebas de humo compiladas de la CLI, un escenario revisado con
  resultados esperados y reales para cuatro tipos de archivo, repeticiones idénticas byte por byte,
  pruebas de ubicación y no ejecución del código objetivo, auditoría de dependencias, árbol exacto de
  dependencias de Babel, digest de la instantánea de la fuente, registro sin omisiones ni tareas
  pendientes, observaciones acotadas de rendimiento y un manifiesto SHA-256 por artefacto que cubre
  el informe finalizado del hito. Comienza con `m03-parsing/SUMMARY.md`.
- `m04-rules/`: evidencia completa del motor de reglas y catálogo inicial con Node.js 24. Incluye una
  instalación aislada con `npm ci`, la puerta de calidad del producto de 344 pruebas, cobertura,
  pruebas de humo compiladas de la CLI, hallazgos esperados y reales revisados para ocho reglas,
  repeticiones idénticas byte por byte, filtros de categoría e ID, metadatos y limitaciones,
  aislamiento de reglas hermanas cuando una regla lanza una excepción, no ejecución del código
  objetivo, auditoría de dependencias, digest de la instantánea de la fuente, registro sin omisiones
  ni tareas pendientes y un manifiesto SHA-256 por artefacto que cubre el informe del hito. Comienza
  con `m04-rules/SUMMARY.md`.
- `m05-reporting/`: evidencia completa del resultado normalizado y los informes de terminal, JSON y
  HTML. Incluye una instalación aislada, puerta de calidad del producto, cobertura, pruebas de humo
  compiladas, proyecciones exactas entre generadores de informes, comportamiento de color en
  terminal, verificaciones
  estructurales de XSS y CSP, escrituras exclusivas dentro de la raíz, auditoría de dependencias,
  registro sin omisiones ni tareas pendientes, digest de la fuente y un manifiesto SHA-256
  finalizado. Comienza con `m05-reporting/SUMMARY.md`.
- `m06-validation/`: la recopilación base completa de M06-T05 contiene exactamente 42 artefactos
  manifestados para la Actividad 3 después de una instalación aislada y bloqueada, puerta de calidad
  completa, proyectos controlados, exactitud por regla, ejecución de robustez, seguridad y
  rendimiento, y revisión heurística experta. Una segunda ejecución coincidió con los resultados
  estables y conservó el primer paquete. `npm run evidence:m06:finalize` añadió únicamente el informe
  factual del hito; el manifiesto final cubre los 42 artefactos base y ese informe.

## Guías públicas

Las siguientes guías y plantillas públicas no finalizadas se mantienen en inglés y español. Los
paquetes finalizados de M01-M06 anteriores permanecen en inglés para conservar intactos sus
manifiestos de integridad.

- Lista de verificación de ejecución de seguridad:
  [Español](security/SECURITY_CHECKLIST.es.md) | [English](security/SECURITY_CHECKLIST.md)
- Protocolo de usabilidad: [Español](usability/USABILITY_PROTOCOL.es.md) |
  [English](usability/USABILITY_PROTOCOL.md)
- Plantilla de la Escala de Usabilidad del Sistema: [Español](usability/SUS_ES.md) |
  [English](usability/SUS_EN.md)
