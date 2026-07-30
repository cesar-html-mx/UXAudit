**Español** | [English](../07_SECURITY.md)

# Seguridad y privacidad

## Modelo de seguridad

UXAudit analiza repositorios que pueden no ser confiables. Los archivos fuente, nombres, rutas,
configuración, entrada del parser, observaciones de reglas y valores de informes se tratan como datos
no confiables.

El producto se ejecuta localmente. Un análisis no requiere conexión de red y UXAudit no tiene
telemetría, servicio alojado, base de datos ni ruta de carga. La instalación del paquete puede
contactar al registro npm configurado, pero ejecutar la CLI instalada no envía datos del proyecto.

## Límites de confianza

| Límite                  | Entrada no confiable                                     | Resultado requerido                                     |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| CLI                     | Argumentos, rutas y valores dirigidos a terminal         | Validar y presentar registros estables de una línea.    |
| Recorrido del proyecto  | Entradas, enlaces, permisos y cambios de ruta            | Permanecer en la raíz canónica y evitar ciclos.         |
| Lector de fuentes       | Identidad, tamaño, codificación y cambios concurrentes   | Leer un archivo regular acotado o cerrar con seguridad. |
| Parser                  | Texto JavaScript, TypeScript, JSX y TSX arbitrario       | Devolver datos normalizados o un fallo seguro tipado.   |
| Configuración           | Estructura JSON local y rutas de salida                  | Aceptar únicamente un esquema cerrado e inerte.         |
| Motor de reglas         | Definiciones y observaciones de reglas                   | Validar contratos y aislar fallos seguros.              |
| Generadores de informes | Hallazgos, rutas, mensajes, referencias y metadatos      | Escapar según el contexto de terminal, JSON o HTML.     |
| Escritor de informes    | Directorios de salida y carreras del sistema de archivos | Escribir solo archivos nuevos autorizados en la raíz.   |

## Controles de recorrido del proyecto

- El directorio seleccionado se resuelve como raíz canónica antes del análisis.
- Se rechazan rutas vacías, faltantes, archivos regulares y raíces inaccesibles.
- Los enlaces simbólicos se omiten de forma predeterminada.
- El seguimiento interno, cuando se usa por programación, solo acepta destinos canónicos dentro de
  la raíz y registra identidades para evitar ciclos.
- Dependencias, cachés, salidas generadas, cobertura, metadatos de control de versiones y archivos de
  configuración comunes se excluyen antes de leer fuentes.
- El orden de directorios e inventario es determinista para que la enumeración hostil no lo cambie.
- Los fallos de permisos o desaparición de descendientes se normalizan sin exponer detalles nativos.

## Controles de lectura y parsing

- El descubrimiento no autoriza una fuente para siempre. La raíz y el candidato se vuelven a validar
  alrededor de cada lectura basada en descriptor.
- Las fuentes deben ser archivos regulares dentro de la raíz y pueden contener como máximo 1 MiB.
- Las lecturas usan fragmentos de no más de 64 KiB y comparan identidad y metadatos durante la operación.
- La decodificación UTF-8 es estricta; una codificación inválida es un fallo seguro por archivo.
- Babel analiza el texto solo como sintaxis. Los módulos del proyecto y de configuración nunca se
  importan ni ejecutan.
- La fuente sin procesar, los árboles de sintaxis y errores nativos permanecen dentro del límite.
- Los fallos por archivo pueden aislarse para permitir que continúen elementos seguros.

Estos controles reducen el recorrido de rutas y riesgos comunes entre comprobación y uso, pero ningún
programa de espacio de usuario elimina todas las carreras concurrentes con privilegios. No analices
un árbol activamente hostil con más privilegios de los necesarios.

## Controles de configuración

`uxaudit.config.json` y los archivos elegidos con `--config` son JSON inerte. UXAudit acepta un
objeto plano y cerrado con `schemaVersion: 1`, claves conocidas, arreglos densos y acotados, valores
únicos válidos y directorios seguros compatibles entre plataformas.

El lector rechaza enlaces para el archivo convencional dentro de la raíz, archivos no regulares,
UTF-8 inválido, datos demasiado grandes, JSON malformado, propiedades de acceso, proxies, claves
desconocidas y valores inválidos. La configuración nunca se evalúa como JavaScript.

## Controles del motor de reglas

Las reglas reciben un modelo normalizado e inmutable de forma recursiva y no acceden al árbol del
parser mediante el contrato público. El registro y la evaluación validan IDs, metadatos, ubicaciones,
observaciones y forma del resultado. Una excepción de regla se convierte en un error normalizado
seguro cuando el aislamiento puede conservar el resto de la auditoría.

El registro inicial pertenece al código. UXAudit no carga plugins ni módulos de reglas desde el
proyecto analizado.

## Controles de terminal

Los valores dinámicos se convierten en texto visible bien formado. Los caracteres de control, bytes
de escape, separadores de línea y controles bidireccionales se representan de forma segura para que
nombres no confiables no inyecten registros, secuencias de color ni texto reordenado.

El color se limita a etiquetas fijas de la aplicación. `--no-color` produce una salida sin secuencias
de escape ANSI. Las excepciones nativas, fuentes sin procesar y valores sin control no se imprimen.

## Controles de JSON y HTML

La serialización JSON usa el resultado normalizado validado. Quien consuma un informe debe tratarlo
como datos de un proyecto no confiable y validarlo con el esquema publicado al cruzar otro límite.

Los informes HTML:

- escapan texto derivado del proyecto después de volver visible Unicode hostil;
- contienen CSS fijo integrado, sin scripts ni recursos externos;
- establecen una política de seguridad de contenido restrictiva;
- permiten un enlace solo si la referencia normalizada vuelve a analizarse como HTTP(S) sin credenciales;
- presentan cualquier otra referencia como texto inerte.

El informe se diseña para revisión local. Abrir un archivo derivado de entrada no confiable sigue
siendo una operación para un navegador actual y aislado.

## Controles de escritura de informes

Las rutas JSON y HTML usan nombres fijos debajo de un directorio relativo compatible entre
plataformas. El escritor:

- vuelve a autorizar la raíz canónica y cada segmento de directorio;
- rechaza rutas absolutas, recorridos superiores, enlaces, salidas y nombres incompatibles o inseguros;
- crea directorios y archivos con permisos restrictivos;
- abre destinos de forma exclusiva y nunca sobrescribe un archivo existente;
- escribe en fragmentos acotados, sincroniza, cierra y vuelve a autorizar antes de confirmar.

Si falla una escritura posterior, puede permanecer un informe anterior o un destino parcial. Se evita
la eliminación automática porque una carrera podría hacer que se borre otro archivo. Inspecciona el
error y elige un destino nuevo antes de reintentar.

## Controles de dependencias y publicación

Las dependencias directas se fijan de forma exacta, el lockfile se confirma, los scripts de
instalación se permiten expresamente y la puerta de publicación incluye auditoría de dependencias y
prueba de instalación del paquete. CI usa plataformas compatibles y debe fijar acciones externas en
revisiones inmutables.

Ningún control garantiza la ausencia de riesgo en la cadena de suministro. Revisa actualizaciones,
cambios del lockfile, contenido del tarball publicado y procedencia antes de publicar.

## Limitaciones residuales

- El análisis estático no es un escáner de seguridad de la aplicación objetivo.
- UXAudit no inspecciona DOM en ejecución, políticas del navegador, solicitudes de red ni servidor.
- Los hallazgos no certifican cumplimiento de WCAG, SEO, rendimiento, privacidad o seguridad.
- Quien pueda alterar el proyecto concurrentemente aún puede causar denegación de servicio o carreras
  de plataforma; ejecuta con privilegios mínimos sobre una copia estable.
- Los informes de terminal, JSON y HTML incluyen la raíz canónica absoluta del proyecto. También
  pueden contener rutas relativas de fuentes, hallazgos y tiempos. Revísalos o elimina esos datos
  antes de compartirlos y manéjalos según los requisitos de confidencialidad del proyecto.

## Informar una vulnerabilidad

No incluyas código fuente confidencial, credenciales ni detalles de explotación en un issue público.
Sigue las instrucciones privadas de la [política de seguridad](../../.github/SECURITY.md).
Para defectos ordinarios no sensibles y falsos positivos, usa el rastreador público de issues.
