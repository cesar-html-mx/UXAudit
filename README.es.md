# UXAudit

**Español** | [English](README.en.md)

UXAudit es una herramienta de línea de comandos para análisis estático local de proyectos React,
JavaScript y TypeScript. Convierte la estructura del código fuente en hallazgos revisables de
accesibilidad, SEO, rendimiento y UX sin ejecutar ni modificar el código analizado.

## Qué hace

Un comando `scan`:

1. valida y convierte en canónico el directorio seleccionado del proyecto;
2. descubre archivos `.js`, `.jsx`, `.ts` y `.tsx` compatibles en orden determinista;
3. analiza candidatos seguros y construye un modelo de análisis independiente del parser;
4. evalúa las reglas seleccionadas y aísla los fallos recuperables de archivos y reglas;
5. crea un resultado normalizado y genera informes en terminal, JSON o HTML.

De forma predeterminada se omiten dependencias, salidas generadas, cachés, directorios de cobertura,
archivos comunes de configuración, declaraciones y enlaces simbólicos. Los módulos objetivo nunca
se importan.

## Requisitos

- Node.js `>=24.18.0 <25`
- npm `>=11.16.0 <12` al instalar o desarrollar con npm

## Instalación

### Dependencia del proyecto recomendada

Instala UXAudit en el proyecto que quieres analizar:

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

El paquete de npm se llama `@cesar-html-mx/uxaudit`; su ejecutable se llama `ux-audit`. Los ejemplos
usan `npm exec --offline` para que solo la dependencia local ya instalada proporcione el comando;
esto evita resolver otro paquete con un nombre parecido. Una dependencia local de desarrollo
mantiene una versión reproducible para el equipo y la integración continua. Puedes exponerla en los
scripts del proyecto:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan ."
  }
}
```

Ejecútala con `npm run audit:ux`.

### Instalación global opcional

Para uso interactivo en varios proyectos locales:

```bash
npm install --global @cesar-html-mx/uxaudit
ux-audit scan /path/to/project
```

En flujos automatizados, prefiere una dependencia del proyecto para registrar la versión elegida.

## Inicio rápido

La auditoría predeterminada imprime un informe en la terminal:

```bash
npm exec --offline -- ux-audit scan .
```

Genera a la vez las salidas de terminal, JSON y HTML:

```bash
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

Los informes de archivo son:

- `uxaudit-reports/audit-report.json`
- `uxaudit-reports/audit-report.html`

UXAudit crea los archivos de informe de forma exclusiva y no sobrescribe un destino existente. Elige
otro directorio de salida o elimina deliberadamente el informe anterior antes de volver a generar
archivos.

## Referencia del comando

```text
ux-audit scan <project-path> [options]
```

Opciones:

- `--config <path>`: usa un archivo explícito de configuración JSON.
- `--format <format>`: selecciona `terminal`, `json`, `html` o `all`; repite la opción para combinar
  formatos.
- `--output <directory>`: selecciona un directorio relativo al proyecto y compatible entre plataformas.
- `--category <category>`: selecciona `accessibility`, `performance`, `seo` o `ux`; se puede repetir.
- `--rule <rule-id>`: selecciona el ID exacto de una regla incluida; se puede repetir.
- `--severity <severity>`: define el umbral de detalle en terminal como `info`, `low`, `medium`,
  `high` o `critical`.
- `--no-color`: desactiva los colores de las etiquetas en terminal.
- `--verbose`: incluye errores recuperables normalizados del procesamiento en la salida de terminal.

Usa `npm exec --offline -- ux-audit --help`, `npm exec --offline -- ux-audit scan --help` o
`npm exec --offline -- ux-audit --version` para consultar la ayuda del comando local.

## Configuración

Coloca `uxaudit.config.json` en la raíz del proyecto o indica un archivo con `--config`:

```json
{
  "schemaVersion": 1,
  "categories": ["accessibility", "seo"],
  "ruleIds": null,
  "formats": ["terminal", "json", "html"],
  "minimumSeverity": "medium",
  "outputDirectory": "uxaudit-reports",
  "color": true,
  "verbose": false
}
```

Valores predeterminados:

- todas las reglas estables mediante `categories: null` y `ruleIds: null`;
- `formats: ["terminal"]`;
- `minimumSeverity: "info"`;
- `outputDirectory: "uxaudit-reports"`;
- `color: true`;
- `verbose: false`.

### Prioridad y filtros

Las opciones explícitas de la línea de comandos reemplazan los valores del archivo; los valores del
archivo reemplazan los predeterminados. `null` en `categories` o `ruleIds` significa sin filtro,
mientras que `[]` habilita intencionalmente cero reglas para ese filtro. Cuando ambas listas están
presentes, una regla debe coincidir con las dos. Se rechazan claves desconocidas, entradas
duplicadas, IDs de reglas desconocidos, valores inválidos y rutas de salida inseguras.

El archivo de configuración es JSON inerte: UXAudit lo lee como datos y nunca lo importa ni lo
ejecuta. Debe ser UTF-8 válido, no superar 64 KiB y usar `schemaVersion: 1`.

## Informes

- Terminal es el resumen interactivo predeterminado. `minimumSeverity` filtra el detalle visible de
  los hallazgos, no los totales ni el resultado de la auditoría. `verbose` muestra detalles seguros y
  normalizados del procesamiento.
- JSON contiene el resultado normalizado completo, incluida la configuración, tiempos, contadores de
  archivos y reglas, hallazgos, errores recuperables y rutas configuradas de informes.
- HTML es un informe independiente con CSS integrado, sin scripts ni recursos externos, contenido
  del proyecto escapado y una política de seguridad de contenido restrictiva.

Quien consuma JSON puede validarlo con el esquema incluido
`node_modules/@cesar-html-mx/uxaudit/schemas/audit-result.schema.json`; el esquema complementario es
`node_modules/@cesar-html-mx/uxaudit/schemas/finding.schema.json`. Estos archivos definen contratos de
validación y no convierten la CLI en una API de biblioteca que se pueda importar.

JSON y HTML solo se escriben debajo de la raíz canónica del proyecto. Las rutas de salida no pueden
ser absolutas, salir de la raíz, atravesar enlaces simbólicos ni reemplazar archivos existentes.

## Reglas incluidas

| ID de regla                    | Categoría     | Severidad predeterminada | Enfoque de revisión                     |
| ------------------------------ | ------------- | ------------------------ | --------------------------------------- |
| `accessibility/button-name`    | accessibility | high                     | Nombre accesible de botones nativos     |
| `accessibility/img-alt`        | accessibility | high                     | Texto alternativo de imágenes nativas   |
| `accessibility/input-label`    | accessibility | high                     | Etiqueta o nombre de controles          |
| `performance/img-dimensions`   | performance   | medium                   | Dimensiones intrínsecas de imágenes     |
| `performance/img-lazy-loading` | performance   | low                      | Oportunidad revisable de carga diferida |
| `seo/ambiguous-link-text`      | seo           | medium                   | Texto estático ambiguo de enlaces       |
| `seo/multiple-h1`              | seo           | medium                   | Varios encabezados propios o enlazados  |
| `ux/small-inline-text`         | ux            | medium                   | Texto literal en línea muy pequeño      |

`seo/multiple-h1` conserva su hallazgo local en el segundo `h1` nativo. También evalúa composición
acotada mediante registros `ComponentLink` locales directos y exactos: una definición hija aporta
como máximo un `h1` en cada uso JSX, los usos repetidos cuentan por separado y, cuando un hijo aporta
la segunda contribución, el hallazgo se ubica en ese uso JSX. Las referencias no resueltas o
ambiguas, los imports de paquetes, los ciclos, el renderizado condicional y las rutas se tratan de
forma conservadora y no se infieren. Se admiten exactamente `64` saltos `ComponentLink` desde cada
componente raíz evaluado; los recorridos con más de `64` saltos permanecen desconocidos. Cada componente
raíz dispone de un presupuesto independiente de `100000` pasos de recorrido, y el trabajo que supera
ese presupuesto permanece desconocido.

Consulta el
[catálogo de reglas](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/es/08_RULE_CATALOG.md)
para conocer activadores, recomendaciones y limitaciones.

## Códigos de salida

| Código | Significado                                                                                              |
| -----: | -------------------------------------------------------------------------------------------------------- |
|    `0` | Ayuda, versión o auditoría completada, incluso con hallazgos o errores recuperables.                     |
|    `1` | Reservado para una política futura de fallo por hallazgos; ninguna opción actual lo emite por hallazgos. |
|    `2` | Comando, argumento, ruta de proyecto o configuración inválidos.                                          |
|    `3` | Fallo fatal del análisis, invariantes, proceso interno o escritura de informes.                          |

No uses el código de salida actual como umbral de hallazgos en CI. Consume el resultado JSON si un
flujo necesita una política específica del proyecto.

## Privacidad y seguridad

UXAudit se ejecuta localmente y no tiene telemetría del producto, base de datos, servicio alojado ni
dependencia de red. No sube el código fuente, los hallazgos ni los informes. Las reglas de análisis
estático consumen un modelo normalizado, no módulos ejecutables del proyecto ni nodos sin procesar
del parser.

El escáner vuelve a validar las rutas alrededor de cada lectura, limita cada archivo fuente a 1 MiB,
decodifica UTF-8 de forma estricta, omite enlaces de manera predeterminada, impide recorridos fuera de
la raíz canónica y escapa valores no confiables en terminal y HTML. Los informes incluyen la raíz
canónica absoluta del proyecto y pueden exponer nombres de directorios locales al compartirlos;
revísalos o elimina esos datos primero. Consulta
[Seguridad](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/es/07_SECURITY.md) para conocer el
modelo de amenazas y cómo informar problemas.

## Limitaciones actuales

- El análisis estático no puede observar el diseño renderizado, rutas, estado, cascada CSS,
  comportamiento de red ni interacción de las personas.
- El reconocimiento y la composición de componentes son conservadores y sintácticos. Solo se siguen
  relaciones locales directas y exactas representadas por `ComponentLink`; los alias no
  compatibles, las abstracciones de orden superior y las relaciones entre módulos permanecen
  desconocidos.
- Las reglas no implementan un algoritmo completo de nombre accesible ni afirman cumplimiento total
  de WCAG, SEO, UX o rendimiento.
- Los valores JSX dinámicos y spreads sin resolver suelen clasificarse como desconocidos para evitar
  conclusiones sin sustento.
- Los hallazgos son puntos de revisión y pueden incluir falsos positivos o negativos. Combina
  UXAudit con las pruebas de navegador, tecnologías de asistencia, rendimiento y participación que
  correspondan al proyecto.

## Desarrollo desde el código fuente

Las personas usuarias no necesitan clonar ni compilar UXAudit. Quienes contribuyan desde una copia
del repositorio pueden usar:

```bash
nvm install
nvm use
npm ci
npm run build
node dist/cli/index.js scan /path/to/project
```

Las comprobaciones comunes para contribuir son `npm run verify`, `npm test`,
`npm run test:coverage`, `npm run docs:check` y `npm run build`.

## Documentación y contribuciones

Comienza con el
[índice de documentación](https://github.com/cesar-html-mx/UXAudit/blob/main/docs/es/00_INDEX.md). Ahí
se agrupan por audiencia los contratos de arquitectura, ingeniería, pruebas, seguridad y
documentación. Las contribuciones deben conservar el comportamiento determinista, las pruebas y
documentación públicas, TypeScript estricto, los límites seguros del sistema de archivos y la
documentación emparejada en inglés y español latinoamericano.
