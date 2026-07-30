# Lista de verificación de ejecución de seguridad

**Español** | [English](SECURITY_CHECKLIST.md)

- [x] Se probó la canonicalización de la raíz del proyecto.
- [x] Se probó en Linux el comportamiento ante rutas inexistentes y realmente inaccesibles.
- [x] Se creó y excluyó un bucle de enlaces simbólicos conforme a la política predeterminada.
- [x] Se creó y excluyó un enlace simbólico fuera de la raíz conforme a la política predeterminada.
- [x] No se ejecutaron el código ni los scripts del paquete del proyecto objetivo.
- [x] El nombre de archivo y el contenido de fuente hostiles permanecieron inertes en HTML escapado y
      validado estructuralmente.
- [x] El JSON permaneció válido con cadenas hostiles.
- [x] Se probaron el escape de salida, la autorización de enlaces simbólicos, la denegación de
      permisos y el comportamiento de sobrescritura.
- [x] Se probó el aislamiento de fuentes con formato incorrecto.
- [x] Se midieron, sin umbral de tiempo, un archivo fuente ubicado bajo 32 directorios anidados y
      cinco ejecuciones completas del proyecto generado de 240 archivos.
- [x] Se incluyó el archivo de bloqueo de dependencias en el repositorio y se inspeccionó la política
      estricta de instalación.
- [x] `npm audit --audit-level=moderate --json` registró cero vulnerabilidades.
- [x] El estado de CodeQL se registró como no ejecutado porque no se recuperó ningún resultado
      alojado.
- [x] No se introdujeron secretos, telemetría, servicios de producción ni bases de datos.

Las comprobaciones de HTML verifican el escape, la CSP y la ausencia de estructuras ejecutables o
capaces de cargar recursos; no constituyen la ejecución de un exploit en un navegador. El valor
máximo observado de `VmRSS` del proceso secundario en Linux se muestreó cada 5 ms mediante `/proc` y
no se presenta como el pico exacto durante toda la vida del proceso. El paquete de evidencia M06
conservado registra las observaciones variables de tiempo y memoria.
