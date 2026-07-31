**Español** | [English](../en/03_REAL_CONSUMER_VALIDATION.md)

# Validación con consumidor real

## Objetivo

Validar el paquete que una persona externa recibe desde npm, con independencia de la copia fuente de
UXAudit. El escenario usó un proyecto Vite React/TypeScript recién generado, instaló la versión
pública exacta, invocó el ejecutable enlazado localmente, generó todos los formatos, ejercitó un
script del proyecto y compiló el consumidor.

Esta fue una integración realista con un consumidor limpio, no una certificación de un proyecto en
producción ni un estudio con participantes.

## Entorno

| Componente                | Valor observado                         |
| ------------------------- | --------------------------------------- |
| Sistema operativo         | Linux                                   |
| Node.js                   | `24.18.0`                               |
| npm                       | `11.16.0`                               |
| Generador del proyecto    | `create-vite@9.1.2`                     |
| Vite                      | `8.2.0`                                 |
| React / React DOM         | `19.2.8`                                |
| TypeScript                | `6.0.2`                                 |
| UXAudit                   | `@cesar-html-mx/uxaudit@0.1.0`          |
| Ejecutable instalado      | `ux-audit`                              |
| Fuente de UXAudit         | Registro npm público, no una ruta local |
| Persistencia del proyecto | Temporal; movido a papelera al terminar |

## Procedimiento

Los siguientes comandos registran el recorrido probado con la versión observada del generador
fijada:

```bash
npm create vite@9.1.2 uxaudit-real-consumer -- --template react-ts
cd uxaudit-real-consumer
npm install
npm install --save-dev @cesar-html-mx/uxaudit@0.1.0
npm exec --offline -- ux-audit --version
npm exec --offline -- ux-audit scan . --format all --output uxaudit-reports
```

La versión instalada informó:

```text
0.1.0
```

También se probó la integración habitual mediante un script del proyecto:

```json
{
  "scripts": {
    "audit:ux": "ux-audit scan . --format json --output uxaudit-script-report"
  }
}
```

```bash
npm run audit:ux
npm run build
```

El uso de `npm exec --offline` fue deliberado: después de instalar, el comando solo podía resolverse
desde la dependencia local del consumidor y no descargar un ejecutable de nombre parecido.

## Resultado del análisis principal

| Medición                     | Resultado |
| ---------------------------- | --------: |
| Entradas descubiertas        |        18 |
| Candidatos fuente            |         2 |
| Archivos analizados          |         2 |
| Fallos de parsing            |         0 |
| Componentes                  |         1 |
| Elementos JSX                |        52 |
| Reglas disponibles / activas |     8 / 8 |
| Reglas ejecutadas / exitosas |     8 / 8 |
| Reglas fallidas              |         0 |
| Hallazgos                    |         9 |
| Errores de procesamiento     |         0 |

Distribución de hallazgos:

| ID de regla                    | Severidad | Cantidad |
| ------------------------------ | --------- | -------: |
| `performance/img-dimensions`   | `medium`  |        4 |
| `performance/img-lazy-loading` | `low`     |        5 |

Todos los hallazgos pertenecieron a la categoría de revisión de rendimiento. Reflejaron imágenes
intrínsecas de la plantilla Vite sin dimensiones verificadas estáticamente e imágenes sin un valor
`loading="lazy"` configurado de forma estática. La CLI las describió correctamente como riesgos
estáticos revisables con limitaciones, no como fallos observados en ejecución.

La auditoría terminada devolvió el código `0`, como está documentado: los hallazgos por sí solos no
hacen fallar actualmente el proceso.

## Validación de informes

La primera ejecución generó:

- `uxaudit-reports/audit-report.json`
- `uxaudit-reports/audit-report.html`

El informe JSON se volvió a analizar y confirmó:

```json
{
  "version": "0.1.0",
  "findings": 9,
  "errors": 0,
  "files": {
    "discovered": 18,
    "failed": 0,
    "parsed": 2,
    "selected": 2
  }
}
```

Digests observados de los informes:

| Archivo             | SHA-256                                                            |
| ------------------- | ------------------------------------------------------------------ |
| `audit-report.json` | `50eeb169e12d70c0369011163294fd26d73f9626a54c084ca2f1a96ba7f149a3` |
| `audit-report.html` | `bacb1dba5dd7e13aa82cf72c4903114c6ca8dd7ecc461c05258bb48afa7038cf` |

El archivo HTML no estaba vacío y contenía la versión, el resumen de nueve hallazgos, ubicaciones y
ambos IDs de regla observados. Como los artefactos temporales no se versionaron, los digests
registran las salidas revisadas durante la sesión, pero no pueden recalcularse desde esta rama.

Fijar la versión observada del generador estabiliza el comando de creación, pero la resolución exacta
de dependencias no es reproducible desde este expediente. No se conservaron el lockfile del
consumidor, los informes generados ni salidas saneadas de los comandos; por ello, los digests y
versiones registrados siguen siendo observaciones clase `D`, no artefactos reproducibles de forma
independiente.

## Resultado del script y la compilación

`npm run audit:ux` resolvió el mismo ejecutable instalado y produjo un informe JSON con los mismos
nueve hallazgos. Para entonces las salidas generadas aumentaron el inventario descubierto a 20 y las
exclusiones a 3, mientras el conjunto seleccionado y analizado permaneció en dos archivos.

Después, el consumidor aprobó:

```text
tsc -b && vite build
20 modules transformed
build completed successfully
```

La auditoría final de dependencias npm informó cero vulnerabilidades conocidas para el árbol
consumidor de 54 paquetes en el momento de la validación.

## Contención y limpieza

Vite interpretó inicialmente un destino absoluto como una ruta relativa debajo de la copia de
UXAudit. Ahí no ocurrió ninguna instalación. Se inspeccionó el directorio exacto generado y se movió
a `/tmp` antes de continuar; se retiró el padre accidental vacío y se verificó que el árbol de
UXAudit estuviera limpio.

Después de validar, el directorio consumidor temporal exacto se movió a la papelera en lugar de
eliminarlo permanentemente. La operación era recuperable en ese momento y dejó sin cambios el
repositorio UXAudit.

## Conclusión

El paquete público `0.1.0` cumplió el recorrido de consumo externo evaluado:

1. la instalación npm terminó correctamente;
2. se enlazó el ejecutable previsto e informó la versión correcta;
3. la CLI analizó fuentes React/TypeScript sin una copia del código fuente;
4. las ocho reglas terminaron sin errores de procesamiento;
5. se generaron salidas de terminal, JSON y HTML internamente consistentes;
6. funcionó la integración mediante script del proyecto;
7. el proyecto React/TypeScript consumidor siguió compilando.
