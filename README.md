# UXAudit

[Español](#español) | [English](#english)

## Español

UXAudit es una CLI local de análisis estático para proyectos React, JavaScript y TypeScript. Descubre
archivos `.js`, `.jsx`, `.ts` y `.tsx`, construye un modelo de análisis independiente del analizador
sintáctico, ejecuta reglas aisladas de accesibilidad, SEO, rendimiento y UX, y genera informes de
terminal, JSON y HTML sin ejecutar ni modificar el código analizado.

El proyecto completó los seis hitos de su harness y su flujo de calidad pasa más de 600 pruebas
automatizadas. La evidencia final conserva las limitaciones reales: UXAudit no sustituye pruebas con
personas, ejecución en navegador ni mediciones de experiencia en tiempo de ejecución.

- [Documentación completa en español latinoamericano](README.es.md)
- [Índice de documentación en español](docs/es/00_INDEX.md)
- [Índice de evidencia en español](evidence/README.es.md)
- [Política de seguridad en español e inglés](.github/SECURITY.md)

### Inicio rápido

Requiere Node.js `24.18.0` y npm `11.16.0`.

```bash
nvm install
nvm use
npm ci
npm run build
node dist/cli/index.js scan "/path/to/project"
```

Para generar informes de terminal, JSON y HTML:

```bash
node dist/cli/index.js scan "/path/to/project" \
  --format all \
  --output uxaudit-reports
```

## English

UXAudit is a local static-analysis CLI for React, JavaScript, and TypeScript projects. It discovers
`.js`, `.jsx`, `.ts`, and `.tsx` files, builds a parser-independent analysis model, runs isolated
accessibility, SEO, performance, and UX rules, and produces terminal, JSON, and HTML reports without
executing or modifying analyzed code.

The project completed all six harness milestones, and its quality flow passes more than 600 automated
tests.
The final evidence preserves the actual limitations: UXAudit does not replace participant testing,
browser execution, or runtime experience measurements.

- [Complete English documentation](README.en.md)
- [English documentation index](docs/00_INDEX.md)
- [Evidence index in English](evidence/README.md)
- [Security policy in English and Spanish](.github/SECURITY.md)

### Quick start

Requires Node.js `24.18.0` and npm `11.16.0`.

```bash
nvm install
nvm use
npm ci
npm run build
node dist/cli/index.js scan "/path/to/project"
```

To generate terminal, JSON, and HTML reports:

```bash
node dist/cli/index.js scan "/path/to/project" \
  --format all \
  --output uxaudit-reports
```
