**Español** | [English](../05_ENGINEERING_STANDARDS.md)

# Estándares de ingeniería

## Entorno de ejecución y lenguaje

- CLI local compatible con Node.js que utiliza la línea LTS de Node.js 24 (`>=24.18.0 <25`). M01
  adoptó esta línea base aprobada por el responsable porque Node.js 20 llegó al fin de su vida útil
  y Node.js 24 es la línea LTS actual.
- Modo estricto de TypeScript.
- Módulos ESM.
- `npm` y un archivo de bloqueo versionado.
- Exportar deliberadamente los contratos públicos; evitar exportaciones de barril amplias que
  generen ciclos.

## Dependencias iniciales aprobadas

Producción:

- `commander`
- paquetes `@babel/parser`, `@babel/traverse` y `@babel/types` `8.0.4` alineados y con versiones
  exactas, aislados dentro del límite de análisis sintáctico de M03

Desarrollo:

- `typescript`
- `tsx`
- `vitest`
- `@vitest/coverage-v8`
- `eslint` y paquetes de TypeScript ESLint
- `prettier`
- `husky`

Una nueva dependencia de producción requiere un registro de decisión antes de instalarla.

## TypeScript y estilo de código

- Preferir funciones flecha.
- Preferir `async`/`await`.
- No usar `any` sin una justificación local por escrito; preferir `unknown` y la validación.
- Mantener los efectos secundarios en los límites.
- Usar datos de dominio inmutables o de solo lectura cuando sea práctico.
- Evitar la herencia salvo que mejore sustancialmente un contrato; preferir la composición.
- Usar clases de error tipadas o resultados discriminados para los fallos esperados.
- No ocultar fallos con bloques de captura vacíos.
- Mantener explícito el ordenamiento determinista.
- Los comentarios explican razones, restricciones o comportamientos no evidentes, no la sintaxis.

## Archivos y rutas

- Usar las API de rutas de Node.
- Almacenar las rutas de informes relativas al proyecto con normalización `/` cuando sea necesario
  para obtener una salida estable.
- Resolver y verificar las raíces canónicas.
- Registrar las rutas reales visitadas cuando se sigan enlaces simbólicos.
- Nunca usar comandos de shell para recorrer proyectos ni realizar análisis sintáctico.

## Pruebas

- Todo comportamiento público y toda corrección de errores requieren pruebas.
- Las reglas requieren casos positivos, negativos y de límite.
- No abusar de las instantáneas; comprobar explícitamente el comportamiento del dominio.
- Los fixtures deben ser mínimos y explicar por qué existen.
- Las pruebas deben ser deterministas y estar aisladas del sistema de archivos real del
  desarrollador, salvo por directorios temporales controlados.

## Git

- Commits convencionales.
- Incluir el ID de la tarea en el ámbito: `feat(parser-0302): parse TSX source files`.
- Un commit coherente por cada tarea completada; se permiten commits de reparación antes de cerrar
  el hito.
- No reescribir el historial compartido ni realizar un envío forzado.
- Las ramas de hito siguen `.github/harness/HARNESS_CONFIG.yml`.

## Definición de terminado

El código, las pruebas, la documentación, la trazabilidad, la evidencia y una verificación exitosa
constituyen una sola entrega.
