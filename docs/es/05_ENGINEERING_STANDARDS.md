**Español** | [English](../05_ENGINEERING_STANDARDS.md)

# Estándares de ingeniería

## Entorno y gestión de paquetes

- Desarrolla y publica con Node.js `>=24.18.0 <25` y npm `>=11.16.0 <12`.
- Usa `npm ci` para instalaciones reproducibles y confirma los cambios de `package-lock.json`.
- Mantén exactas las versiones de dependencias directas y revisa cambios transitivos y de instalación.
- Las dependencias de producción requieren una necesidad clara, revisión de seguridad y justificación.
- El paquete público distribuye una CLI. No expongas por accidente una API de biblioteca que se pueda
  importar.

## TypeScript y módulos

- Usa TypeScript estricto y ESM.
- Evita `any`; valida valores `unknown` en los límites antes de estrechar el tipo.
- Prefiere funciones flecha y `async`/`await`.
- Mantén módulos enfocados y contratos explícitos.
- Usa contratos de entrada de solo lectura y resultados inmutables cuando sea práctico.
- Los tipos específicos del parser permanecen dentro del adaptador de parsing.
- Las reglas dependen del modelo normalizado; los generadores dependen de `AuditResult`.

## Determinismo y errores

- Define un orden canónico para archivos, entidades, reglas, hallazgos, errores y grupos de informes.
- Evita ordenamientos sensibles a la configuración regional en el comportamiento del producto.
- Rechaza valores externos malformados, duplicados, dispersos, envueltos en proxies o respaldados por
  propiedades de acceso en límites cerrados.
- Usa errores tipados con mensajes públicos estables.
- Conserva los fallos recuperables en los resultados; nunca los ocultes para aparentar un análisis limpio.
- No expongas fuentes, objetos nativos del parser, credenciales ni rutas absolutas sin control en terminal.

## Seguridad del sistema de archivos y procesos

- No invoques un shell para el comportamiento principal del producto.
- Trata las rutas descubiertas como candidatas y vuelve a autorizarlas al usarlas.
- Acota lecturas y escrituras, valida UTF-8 estrictamente y verifica identidad alrededor del descriptor.
- Evita ciclos de enlaces simbólicos y salidas de ruta.
- Nunca ejecutes, importes ni modifiques automáticamente las fuentes analizadas.
- Escapa contenido no confiable según su contexto; terminal, JSON y HTML tienen necesidades distintas.
- Rechaza rutas inseguras y destinos de informe existentes.

## Comportamiento público

Cualquier comando, opción, código de salida, campo de configuración, esquema, regla, hallazgo, informe
o error observable requiere:

1. un contrato explícito;
2. pruebas positivas, negativas, de límite y aislamiento de fallos según corresponda;
3. documentación en inglés y español latinoamericano;
4. revisión de compatibilidad cuando el comportamiento ya sea público.

Las limitaciones deben aparecer junto a la función o regla que califican.

## Comandos de calidad

| Comando                 | Propósito                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `npm run format:check`  | Comprobar el formato del repositorio.                                              |
| `npm run docs:check`    | Comprobar pares bilingües, literales técnicos, estructura y enlaces locales.       |
| `npm run lint`          | Ejecutar las reglas de ESLint sin advertencias.                                    |
| `npm run typecheck`     | Ejecutar TypeScript estricto sin emitir archivos.                                  |
| `npm test`              | Ejecutar una vez las pruebas focalizadas de Vitest.                                |
| `npm run test:coverage` | Ejecutar la suite con umbrales globales de cobertura V8.                           |
| `npm run build`         | Emitir JavaScript ESM, declaraciones y mapas de fuente en `dist/`.                 |
| `npm run test:smoke`    | Ejercitar la CLI compilada.                                                        |
| `npm run test:package`  | Inspeccionar y probar la instalación del tarball npm.                              |
| `npm run verify`        | Ejecutar la puerta principal de formato, docs, lint, tipos, pruebas y compilación. |
| `npm run release:check` | Ejecutar la puerta local completa para una versión pública.                        |

La cobertura apoya la revisión, pero no sustituye aserciones significativas. Las pruebas requeridas
no deben omitirse ni marcarse como trabajo futuro.

## Flujo de Git y contribución

- Crea una rama enfocada para cada cambio coherente.
- Usa commits convencionales como `feat(rules): add heading-order check` o
  `docs(cli): clarify JSON output`.
- Mantén fuera de los commits los archivos generados del paquete salvo que el proceso lo exija.
- No mezcles cambios funcionales con formato o refactorización no relacionados.
- Revisa el diff final, ejecuta comprobaciones proporcionales al riesgo y documenta lo no ejecutado.
- Usa `npm run setup:hooks` si quieres hooks locales; quienes instalan el paquete no se inscriben en
  los hooks del repositorio.

## Estándar de documentación

El código, identificadores, rutas, comandos, claves de configuración y formatos legibles por máquinas
permanecen en inglés. La documentación informativa duradera se empareja en inglés y español
latinoamericano natural. Ambas versiones deben describir el mismo comportamiento; una traducción no
debe afirmar más de lo que admite la implementación.
