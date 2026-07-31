**Español** | [English](../en/00_INDEX.md)

# Índice de evidencia post-harness

## Propósito

Este índice cubre el trabajo realizado después de que el harness formal M01–M06 de UXAudit alcanzó
el estado `complete`. El límite archivístico es el tag anotado `harness-complete-v1`; el tag conserva
el harness terminado, sus evidencias y la documentación bilingüe post-M06 antes de simplificar la
rama pública.

## Documentos

1. [Informe post-harness](01_POST_HARNESS_REPORT.md) — alcance, límite, resultados y cronología.
2. [Publicación y seguridad](02_RELEASE_AND_SECURITY.md) — GitHub, npm, publicación, procedencia,
   OIDC y controles confirmados por el mantenedor.
3. [Validación con consumidor real](03_REAL_CONSUMER_VALIDATION.md) — instalación y ejecución en un
   proyecto React/TypeScript limpio.
4. [Procedimiento para versiones futuras](04_FUTURE_RELEASE_RUNBOOK.md) — publicación repetible sin
   tokens.
5. [Catálogo de evidencias](05_EVIDENCE_CATALOG.md) — identificadores, enlaces, clases de evidencia
   y lista de capturas.
6. [Fuentes legibles por máquina](../data/evidence-sources.json) — hechos estables usados por este
   expediente.

## Clases de evidencia

| Clase | Significado                                                                                   |
| ----- | --------------------------------------------------------------------------------------------- |
| `A`   | Evidencia pública reproducible disponible mediante GitHub o npm.                              |
| `B`   | Evidencia conservada en historial, refs, commits, tags, ramas o archivos del repositorio Git. |
| `C`   | Hecho confirmado por el mantenedor que no puede reproducirse mediante una API pública.        |
| `D`   | Resultado observado durante la sesión en un entorno controlado temporal.                      |

## Límite del alcance

Este expediente no afirma que `v0.1.0` se publicó mediante npm Trusted Publishing. El workflow
etiquetado demuestra públicamente que usó un secret de npm y generó procedencia; el mantenedor
confirmó por separado que ese secret contenía un token granular de corta duración, un hecho clase
`C`. El pull request #12 migró después el workflow actual a OIDC; la siguiente versión real será la
primera publicación operativa mediante esa configuración.
