**Español** | [English](../en/01_POST_HARNESS_REPORT.md)

# Informe post-harness

## Registro

| Campo               | Valor                                                          |
| ------------------- | -------------------------------------------------------------- |
| Proyecto            | UXAudit                                                        |
| Alcance académico   | Puesta en operación y primera distribución pública             |
| Corte del registro  | `2026-07-30` en `America/Mexico_City`                          |
| Harness formal      | `complete`; M01–M06 completos; sin hito ni tarea activos       |
| Límite archivístico | `harness-complete-v1`                                          |
| Versión pública     | `@cesar-html-mx/uxaudit@0.1.0`                                 |
| Estado público      | `main` en `de540f0ec3d3a7d198905eccd06eae46bc3ac3e7`           |
| Rama de evidencia   | `evidence/post-harness-v0.1.0`; no está destinada a fusionarse |

## Límite con el harness

El harness formal terminó en la rama `milestone/m06-integration-validation` con el commit `2fa29c7`.
Su estado registra `status: complete`, los hitos M01–M06 terminados, ningún hito ni tarea activos, sin
bloqueos y una verificación final `PASS` con `619/619` pruebas. Una nueva ejecución de los scripts
archivados `validate-harness.mjs` y `show-status.mjs` desde esa rama devolvió `PASS` e informó el
mismo ciclo de vida terminado.

El pull request #9 integró M06 en `main`. Después, el pull request #10 agregó la política duradera de
documentación bilingüe como mantenimiento post-M06 sin cambiar el comportamiento del producto. El
tag anotado `harness-complete-v1` apunta al resultado posterior a #10 y conserva el harness interno y
sus evidencias antes de la limpieza pública.

Para este expediente, todo lo posterior a `harness-complete-v1` es inequívocamente post-harness. El
expediente no modifica el estado archivado ni afirma que existan hitos adicionales.

## Resultado

- El repositorio se convirtió en un árbol público orientado al producto y el historial interno siguió
  disponible mediante tags, commits y ramas de hitos.
- La documentación pública se alineó en español latinoamericano e inglés.
- La CLI se empaquetó como `@cesar-html-mx/uxaudit`, con `ux-audit` como ejecutable.
- La CI multiplataforma se corrigió y aprobó en Linux, Windows y macOS.
- `main` se protegió con comprobaciones obligatorias de calidad, CodeQL y Dependency Review.
- El tag anotado `v0.1.0` activó la primera publicación npm exitosa con procedencia.
- La credencial temporal de arranque se eliminó después de configurar npm Trusted Publishing.
- El pull request #12 convirtió el workflow actual a autenticación OIDC sin tokens.
- Un consumidor Vite React/TypeScript limpio instaló `0.1.0`, ejecutó la CLI, generó JSON y HTML y
  compiló correctamente.

## Cronología

Todas las marcas de esta tabla usan UTC para que el registro no dependa de la ubicación de quien lo
lea.

| Marca de tiempo            | Evento                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `2026-07-30T08:23:17Z`     | El commit `2fa29c7` cerró M06 con el harness en estado `complete`.                                                               |
| `2026-07-30T15:04:47Z`     | El pull request #9 integró M06 en `main` como `8e0e327`.                                                                         |
| `2026-07-30T16:30:14Z`     | El pull request #10 integró documentación pública bilingüe como `f9fb70c`.                                                       |
| `2026-07-30T17:07:48Z`     | El tag anotado `harness-complete-v1` archivó `f9fb70c`, incluido el harness y sus evidencias.                                    |
| `2026-07-30T18:09:03Z`     | Se abrió el pull request #11 desde `release/public-v0.1.0`.                                                                      |
| `2026-07-30T18:09:09Z`     | La primera ejecución de calidad de #11 falló en Windows y macOS y reveló supuestos de portabilidad.                              |
| `2026-07-30T18:24:48Z`     | El commit `cf8e4d6` corrigió rutas portables y la ejecución del script mediante rutas enlazadas.                                 |
| `2026-07-30T18:30:14Z`     | Comenzó la ejecución corregida de #11, que después aprobó en Linux, Windows y macOS.                                             |
| `2026-07-30T18:33:48Z`     | El pull request #11 se fusionó como `6668d8f` y produjo el estado fuente de distribución pública.                                |
| `2026-07-30T22:58:39Z`     | Se creó el tag anotado `v0.1.0` en `6668d8f`.                                                                                    |
| `2026-07-30T23:00:10Z`     | GitHub Actions inició la ejecución `30589077315` para el tag `v0.1.0`.                                                           |
| `2026-07-30T23:01:38.023Z` | npm registró `@cesar-html-mx/uxaudit@0.1.0` y le asignó el dist-tag `latest`.                                                    |
| `2026-07-30T23:01:42Z`     | La ejecución `30589077315` terminó con `success`.                                                                                |
| `2026-07-30T23:28:22Z`     | Se abrió el pull request #12 para retirar tokens del workflow actual y exigir OIDC mediante una prueba.                          |
| `2026-07-30T23:33:37Z`     | El pull request #12 se fusionó como `de540f0`; las nueve comprobaciones informadas habían aprobado.                              |
| Sesión posterior al merge  | Se eliminó el secret de GitHub, se revocó el token npm, se endureció el acceso y se completó una validación con consumidor real. |

## Decisiones y justificación

### Conservar el historial sin exponerlo en el recorrido de uso

El harness terminado, las evidencias de los hitos y el historial de implementación se conservaron
mediante el tag de archivo y las ramas. Solo se retiraron del árbol público de `main` para que la
documentación de instalación y contribución describiera el producto, no el mecanismo interno de
ejecución.

### Arrancar una vez y migrar de inmediato

El paquete no existía antes de `0.1.0`, por lo que una relación específica de Trusted Publisher no
podía completar por sí sola todo el arranque. El workflow etiquetado demuestra que la primera
publicación usó un secret de npm dentro de un environment de GitHub limitado por tags; el mantenedor
confirmó que ese secret contenía un token granular de corta duración. Una vez existente el paquete,
el mantenedor configuró Trusted Publishing, integró un workflow que ya no consume una credencial npm
reutilizable de publicación, eliminó el secret de GitHub, revocó el token npm y seleccionó la
política restrictiva de acceso.

### Evitar una versión artificial

No se publicó una versión sintética `0.1.1` solamente para ejercitar OIDC. La configuración y su
prueba de regresión están verificadas; la primera publicación operativa mediante OIDC ocurrirá con la
siguiente versión legítima.

## Limitaciones residuales

- La política detallada de acceso npm, los inventarios de tokens y secrets y parte de la protección
  de ramas son estados de plataforma que no están disponibles mediante las APIs públicas empleadas.
  Se registran como confirmaciones del mantenedor.
- El workflow OIDC actual todavía no ha publicado una versión. Su resultado real deberá agregarse
  después de la siguiente versión legítima.
- El recorrido automatizado de publicación está limitado por el workflow, la política de tags del
  environment y la identidad Trusted Publisher, pero no es la única vía técnica: un mantenedor de npm
  aún puede publicar de forma interactiva con 2FA. Al corte del registro no se observó públicamente
  un ruleset para tags ni un revisor obligatorio del environment.
- El proyecto consumidor y los informes fueron temporales. Se documentan los resultados y digests
  observados, pero los archivos se movieron a la papelera y no se incorporaron a ningún commit. La
  resolución exacta de dependencias no puede reconstruirse porque no se conservaron el lockfile ni
  los artefactos generados.
- Un resultado de análisis estático orienta una revisión; los nueve hallazgos observados en el
  proyecto Vite no certifican su accesibilidad, UX, SEO ni rendimiento.
- Al corte del registro, la descripción del repositorio en GitHub todavía presentaba UXAudit como una
  herramienta “planned”. Actualizar esa descripción administrativa para reflejar la CLI publicada
  permanece como seguimiento no bloqueante del mantenedor.
