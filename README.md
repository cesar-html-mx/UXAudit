# UXAudit

[Español](#español) | [English](#english)

## Español

UXAudit es una CLI local de análisis estático para proyectos React, JavaScript y TypeScript. Recorre
archivos `.js`, `.jsx`, `.ts` y `.tsx`, ejecuta reglas de accesibilidad, SEO, rendimiento y UX, y
genera informes en terminal, JSON y HTML. No ejecuta ni modifica el código del proyecto analizado.

### Instalación y primer análisis

Requiere Node.js `24.18.0` o una versión posterior de la línea 24.

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

El paquete de npm se llama `@cesar-html-mx/uxaudit`; el comando instalado se llama `ux-audit`.
`npm exec --offline` exige usar la dependencia local ya instalada y evita descargar por error otro
paquete con un nombre parecido. Para agregar un atajo al proyecto:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan ."
  }
}
```

Después puedes ejecutar `npm run audit:ux`. Para producir los tres formatos:

```bash
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

Los informes de archivo se guardan como `uxaudit-reports/audit-report.json` y
`uxaudit-reports/audit-report.html`. UXAudit no sobrescribe informes existentes.

### Alcance y privacidad

- Todo el análisis ocurre en el equipo local; no hay telemetría, servicio remoto ni base de datos.
- Los hallazgos orientan una revisión: no sustituyen pruebas con personas, tecnologías de asistencia,
  navegador o métricas de ejecución.
- Los hallazgos y errores recuperables no cambian por sí solos el código de salida `0`.
- Una configuración inválida usa el código `2`; un fallo interno o de escritura usa el código `3`.

Consulta la [guía completa en español](README.es.md), el
[índice de documentación](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/es/00_INDEX.md),
el [catálogo de reglas](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/es/08_RULE_CATALOG.md)
y la [política de seguridad](https://github.com/cesar-html-mx/UXAudit/blob/main/.github/SECURITY.md).

## English

UXAudit is a local static-analysis CLI for React, JavaScript, and TypeScript projects. It scans
`.js`, `.jsx`, `.ts`, and `.tsx` files, runs accessibility, SEO, performance, and UX rules, and
produces terminal, JSON, and HTML reports. It does not execute or modify the analyzed project code.

### Install and run your first audit

Node.js `24.18.0` or a later release in the Node.js 24 line is required.

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

The npm package is named `@cesar-html-mx/uxaudit`; the installed command is named `ux-audit`.
`npm exec --offline` requires the already-installed local dependency and prevents accidentally
downloading another similarly named package. To add a project shortcut:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan ."
  }
}
```

You can then run `npm run audit:ux`. To produce all three formats:

```bash
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

File reports are written to `uxaudit-reports/audit-report.json` and
`uxaudit-reports/audit-report.html`. UXAudit does not overwrite existing reports.

### Scope and privacy

- All analysis runs on the local machine; there is no telemetry, remote service, or database.
- Findings guide a review; they do not replace participant, assistive-technology, browser, or runtime
  measurement testing.
- Findings and recoverable errors do not by themselves change exit code `0`.
- Invalid configuration uses code `2`; an internal or report-write failure uses code `3`.

See the [complete English guide](README.en.md), the
[documentation index](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/00_INDEX.md), the
[rule catalog](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/08_RULE_CATALOG.md), and the
[security policy](https://github.com/cesar-html-mx/UXAudit/blob/main/.github/SECURITY.md).
