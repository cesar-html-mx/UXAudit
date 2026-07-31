**Español** | [English](../en/05_EVIDENCE_CATALOG.md)

# Catálogo de evidencias

## Evidencia pública y verificable en Git

| ID          | Clase | Evidencia y afirmación respaldada                                                                                                                                                                                                                                            |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-001` | `B`   | [`2fa29c7`](https://github.com/cesar-html-mx/UXAudit/commit/2fa29c72ba37ce19ab0ddef27a6da0d679bb5f47) cierra M06 con el harness archivado como terminado.                                                                                                                    |
| `EV-PH-002` | `A`   | El [pull request #9](https://github.com/cesar-html-mx/UXAudit/pull/9) integra M06 en `main`.                                                                                                                                                                                 |
| `EV-PH-003` | `A`   | El [pull request #10](https://github.com/cesar-html-mx/UXAudit/pull/10) integra la documentación bilingüe post-M06.                                                                                                                                                          |
| `EV-PH-004` | `B`   | [`harness-complete-v1`](https://github.com/cesar-html-mx/UXAudit/tree/harness-complete-v1) conserva el harness y las evidencias antes de la limpieza pública.                                                                                                                |
| `EV-PH-005` | `A`   | El [pull request #11](https://github.com/cesar-html-mx/UXAudit/pull/11) prepara la distribución npm pública y el repositorio orientado al producto.                                                                                                                          |
| `EV-PH-006` | `A`   | La [ejecución Product Quality fallida](https://github.com/cesar-html-mx/UXAudit/actions/runs/30569151477) registra los defectos de portabilidad Windows/macOS sin ocultarlos.                                                                                                |
| `EV-PH-007` | `B`   | [`cf8e4d6`](https://github.com/cesar-html-mx/UXAudit/commit/cf8e4d69d86d08e2905d79002d2a3194dd87d024) admite separadores portables y estabiliza la detección de entrada mediante rutas enlazadas.                                                                            |
| `EV-PH-008` | `A`   | La [ejecución Product Quality corregida](https://github.com/cesar-html-mx/UXAudit/actions/runs/30570680109) aprueba la rama en los tres sistemas operativos.                                                                                                                 |
| `EV-PH-009` | `B`   | [`v0.1.0`](https://github.com/cesar-html-mx/UXAudit/tree/v0.1.0) es un tag anotado que apunta al commit de fusión `6668d8f`.                                                                                                                                                 |
| `EV-PH-010` | `A`   | La [ejecución de publicación](https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315) y el [job](https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315/job/91027158681) terminaron correctamente.                                                     |
| `EV-PH-011` | `A`   | La [página npm](https://www.npmjs.com/package/@cesar-html-mx/uxaudit/v/0.1.0) y los [metadatos](https://registry.npmjs.org/%40cesar-html-mx%2Fuxaudit/0.1.0) exponen versión, binario, engines, repositorio e integridad.                                                    |
| `EV-PH-012` | `A`   | Las [attestations públicas](https://registry.npmjs.org/-/npm/v1/attestations/%40cesar-html-mx%2Fuxaudit@0.1.0) vinculan el digest con tag, workflow, commit y ejecución.                                                                                                     |
| `EV-PH-013` | `A`   | La [API pública de `main`](https://api.github.com/repos/cesar-html-mx/UXAudit/branches/main) informa protección y los cinco contextos obligatorios.                                                                                                                          |
| `EV-PH-014` | `A`   | La [API pública de environments](https://api.github.com/repos/cesar-html-mx/UXAudit/environments) informa el environment `npm` y una política personalizada.                                                                                                                 |
| `EV-PH-015` | `A`   | El [pull request #12](https://github.com/cesar-html-mx/UXAudit/pull/12) migra el workflow actual a OIDC y aprueba todas las comprobaciones informadas.                                                                                                                       |
| `EV-PH-016` | `B`   | El [permalink del workflow actual](https://github.com/cesar-html-mx/UXAudit/blob/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7/.github/workflows/release.yml) contiene OIDC y ninguna variable de token.                                                                          |
| `EV-PH-017` | `B`   | El [permalink de la prueba OIDC](https://github.com/cesar-html-mx/UXAudit/blob/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7/tests/release-workflow.test.ts) exige OIDC y rechaza nombres de token.                                                                               |
| `EV-PH-018` | `A`   | [Product Quality](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618128), [CodeQL](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618131) y [Dependency Review](https://github.com/cesar-html-mx/UXAudit/actions/runs/30590618120) de #12 aprobaron. |
| `EV-PH-019` | `B`   | [`main` en `de540f0`](https://github.com/cesar-html-mx/UXAudit/commit/de540f0ec3d3a7d198905eccd06eae46bc3ac3e7) es el estado fuente verificado tras migrar a OIDC.                                                                                                           |
| `EV-PH-020` | `A`   | La [API del repositorio](https://api.github.com/repos/cesar-html-mx/UXAudit) lo informa público, con `main` predeterminada y licencia MIT.                                                                                                                                   |
| `EV-PH-021` | `A`   | Las [políticas de despliegue del environment](https://api.github.com/repos/cesar-html-mx/UXAudit/environments/npm/deployment-branch-policies) informan `v*.*.*` como patrón de tag.                                                                                          |
| `EV-PH-022` | `A`   | Al corte, la [API del environment](https://api.github.com/repos/cesar-html-mx/UXAudit/environments/npm) no expone revisor obligatorio y la [API de rulesets](https://api.github.com/repos/cesar-html-mx/UXAudit/rulesets) devuelve una lista vacía.                          |

## Confirmaciones del mantenedor no reproducibles públicamente

Estos controles no pueden inspeccionarse por completo mediante una API pública sin autenticación.
Para una entrega académica deben respaldarse con capturas ocultando datos privados o con una
exportación autenticada de configuración.

| ID          | Clase | Estado confirmado por el mantenedor                                                                                                |
| ----------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-C01` | `C`   | La protección detallada de `main` exige pull requests, ramas actualizadas, conversaciones resueltas, historial lineal y no bypass. |
| `EV-PH-C02` | `C`   | El secret de arranque usado para `v0.1.0` contenía un token granular de npm de corta duración.                                     |
| `EV-PH-C03` | `C`   | La cuenta npm tiene 2FA activa y obligatoria para acciones de escritura.                                                           |
| `EV-PH-C04` | `C`   | npm Trusted Publisher indica GitHub Actions, `cesar-html-mx/UXAudit`, `release.yml`, environment `npm` y `npm publish`.            |
| `EV-PH-C05` | `C`   | El secret `NPM_TOKEN` del environment de GitHub se eliminó después de fusionar #12.                                                |
| `EV-PH-C06` | `C`   | El token granular temporal de npm se revocó y la página de tokens mostró cero elementos.                                           |
| `EV-PH-C07` | `C`   | El acceso usa `Require two-factor authentication and disallow bypass 2FA tokens (recommended)`.                                    |

## Validación observada durante la sesión

| ID          | Clase | Observación                                                                                                                                     |
| ----------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `EV-PH-D01` | `D`   | Un consumidor Vite React/TypeScript temporal instaló `@cesar-html-mx/uxaudit@0.1.0` desde npm y resolvió `ux-audit` como versión `0.1.0`.       |
| `EV-PH-D02` | `D`   | El análisis procesó dos fuentes, ejecutó correctamente ocho reglas, produjo nueve hallazgos y cero errores de procesamiento y generó JSON/HTML. |
| `EV-PH-D03` | `D`   | `npm run audit:ux` produjo los mismos nueve hallazgos y `tsc -b && vite build` terminó correctamente.                                           |
| `EV-PH-D04` | `D`   | La auditoría del árbol consumidor final de 54 paquetes informó cero vulnerabilidades conocidas al validar.                                      |
| `EV-PH-D05` | `D`   | El consumidor temporal se movió a la papelera y la copia de UXAudit permaneció limpia.                                                          |

## Capturas sugeridas como anexos

Los siguientes nombres se recomiendan para las capturas existentes del mantenedor. No se incluyen en
esta rama porque los adjuntos de la conversación no estaban disponibles como archivos locales
originales.

| Nombre de archivo                         | Evidencia respaldada |
| ----------------------------------------- | -------------------- |
| `C01-main-protection-required-checks.png` | `EV-PH-C01`          |
| `C02-initial-npm-token-properties.png`    | `EV-PH-C02`          |
| `C03-npm-account-2fa-enabled.png`         | `EV-PH-C03`          |
| `C04-npm-trusted-publisher.png`           | `EV-PH-C04`          |
| `C05-github-npm-token-secret-removed.png` | `EV-PH-C05`          |
| `C06-npm-token-revoked-zero-tokens.png`   | `EV-PH-C06`          |
| `C07-npm-publishing-access-hardened.png`  | `EV-PH-C07`          |
| `D01-pr11-portability-failure.png`        | `EV-PH-006`          |
| `D02-pr11-all-checks-passed.png`          | `EV-PH-008`          |
| `D03-pr12-all-checks-passed.png`          | `EV-PH-015`          |
| `D04-codeql-success.png`                  | `EV-PH-018`          |

Ninguna captura debe exponer tokens npm, secrets de GitHub, códigos de recuperación, cookies de
sesión, contraseñas, rutas fuente privadas ni desafíos de autenticación. Recorta elementos no
relacionados del navegador y oculta valores privados antes de incluir una imagen.

## Notas de reproducción

- Las APIs y el registro públicos son preferibles a capturas para hechos reproducibles.
- Los permalinks de commits y workflows son preferibles a enlaces de ramas que pueden moverse.
- Una rama enviada a este repositorio público puede descubrirse aunque nunca se fusione con `main`;
  revisa y oculta datos sensibles de cada adjunto antes de publicarlo.
- `v0.1.0` tiene un tag anotado y una página de tag presentada por GitHub. El endpoint REST de
  Releases no devuelve un objeto creado por el mantenedor; no describas los archivos fuente
  automáticos como una publicación binaria mantenida.
- La primera ejecución usó el workflow etiquetado y su configuración temporal de token. El workflow
  OIDC actual solo existe después del pull request #12.
- Los valores exactos legibles por máquina se duplican en
  [`evidence-sources.json`](../data/evidence-sources.json).
