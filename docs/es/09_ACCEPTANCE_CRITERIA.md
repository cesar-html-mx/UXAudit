**Español** | [English](../09_ACCEPTANCE_CRITERIA.md)

# Criterios de aceptación de una versión pública

## Comportamiento del producto

- `ux-audit scan <project-path>` completa la auditoría estática integral documentada.
- Las fuentes `.js`, `.jsx`, `.ts` y `.tsx` compatibles se descubren y procesan de forma determinista.
- El código objetivo nunca se importa, ejecuta ni modifica.
- Los exports directos de componentes reconocidos y los usos locales de componentes se enlazan solo
  mediante la identidad léxica del binding. Los imports relativos directos `default` y nombrados,
  incluido un alias nombrado, se enlazan solo cuando coinciden exactamente un archivo objetivo
  compatible y un binding exportado.
- Los imports de paquetes, barrels y reexports, sintaxis de namespace, alias de rutas de TypeScript,
  abstracciones de orden superior o en ejecución y referencias faltantes o ambiguas permanecen
  desconocidos sin enlaces especulativos.
- Todas las reglas estables publicadas evalúan el modelo normalizado y exponen límites documentados.
- Los fallos recuperables de fuentes y reglas se aíslan e incluyen en el resultado normalizado.
- Terminal, JSON y HTML informan los mismos hechos subyacentes.
- Comandos, opciones, campos, nombres de archivo y códigos coinciden con la especificación pública.

## Experiencia de uso

- La instalación del paquete `@cesar-html-mx/uxaudit` expone el ejecutable `ux-audit`.
- El README raíz ofrece una instalación funcional y un inicio rápido de dos comandos sin requerir una
  copia del código ni compilación.
- La ayuda describe cada opción pública y una entrada inválida devuelve un mensaje seguro y accionable.
- Los hallazgos incluyen regla, ubicación disponible, explicación, recomendación y limitaciones.
- El comportamiento predeterminado es útil sin configuración; los filtros avanzados son explícitos.

## Seguridad y privacidad

- Los análisis se ejecutan localmente sin telemetría, carga, servicio alojado ni base de datos.
- Recorrido, lecturas de fuentes, configuración e informes respetan sus límites de autorización.
- Enlaces, salidas de ruta, destinos existentes, entradas malformadas, UTF-8 inválido y archivos
  demasiado grandes fallan de forma segura.
- Los valores no confiables de terminal y HTML no inyectan controles, marcado, scripts ni enlaces inseguros.
- Los informes no se anuncian hasta confirmar su escritura.
- La auditoría de dependencias y regresiones sensibles a seguridad aprueban al publicar.

## Distribución del paquete

- Los metadatos nombran licencia, repositorio, issues, entorno compatible, binario y acceso público.
- `npm pack --dry-run` contiene solo la salida de ejecución, esquemas, licencia y archivos README
  públicos previstos.
- Un consumidor temporal limpio puede instalar el tarball, resolver `ux-audit`, imprimir ayuda y
  versión, y analizar un proyecto controlado fuera del repositorio.
- El paquete publicado se construye desde una copia limpia y no depende de artefactos locales ignorados.
- `dist/cli/index.js` conserva su declaración ejecutable y el tarball excluye pruebas, fixtures
  internos, credenciales y registros exclusivos de desarrollo.

## Calidad de ingeniería

- Aprueban formato, docs bilingües, lint, tipos estrictos, pruebas, cobertura, compilación, humo,
  sistema, robustez, exactitud y paquete.
- Ninguna prueba requerida se omite ni marca como pendiente.
- La cobertura global de sentencias, ramas, funciones y líneas permanece al menos en 90 %.
- Resultados e informes tienen orden determinista; solo los campos volátiles documentados se excluyen.
- El comportamiento público tiene aserciones significativas positivas, negativas, de límite y fallo.
- El corpus intercomponente controlado cubre imports directos `default` y nombrados con alias, uso
  local y repetido, encabezados compuestos `Page -> Header + Hero`, un ciclo, un import local faltante,
  un import de paquete, ambigüedad, orden de entrada invertido y no ejecución del código objetivo.
- Cada caso intercomponente compatible anunciado contribuye a las expectativas de exactitud
  compatibles y no se reclasifica como no compatible para aprobar la puerta de publicación.
- El árbol de trabajo contiene únicamente cambios intencionales revisados.

## Documentación

- La documentación de uso y contribución está disponible en inglés y español latinoamericano.
- Instalación, uso, configuración, informes, reglas, códigos de salida, privacidad, seguridad,
  limitaciones y desarrollo desde fuente son claros y están enlazados.
- Los literales técnicos y ejemplos de código son idénticos entre pares de idiomas.
- Las guías se enfocan en instalación, uso, contribución y contratos mantenidos del producto.

## Decisión de publicación

Ejecuta `npm run release:check` desde un entorno compatible y limpio. Una versión está lista solo
cuando cumple cada criterio o una limitación documentada explica por qué no aplica. La falta de
credenciales o permisos del registro puede bloquear la publicación aunque el artefacto local esté
listo; no justifica debilitar las comprobaciones.
