**Español** | [English](../09_ACCEPTANCE_CRITERIA.md)

# Criterios de aceptación

## Nivel de producto

UXAudit es aceptable para la contribución inicial del TFM cuando:

1. `ux-audit scan <path>` ejecuta el flujo completo de análisis estático.
2. La entrada no válida se rechaza claramente antes del recorrido.
3. Los archivos fuente pertinentes se seleccionan sin procesar las carpetas excluidas de
   dependencias o compilación.
4. Los archivos JSX/TSX/JS/TS se analizan en un modelo interno normalizado.
5. Las reglas estables de las cuatro categorías se ejecutan de manera independiente.
6. Los hallazgos incluyen regla, categoría, severidad, explicación, recomendación, archivo y
   ubicación cuando están disponibles.
7. Las salidas de terminal, JSON y HTML contienen datos de hallazgos congruentes.
8. La ejecución repetida es determinista.
9. Los proyectos controlados producen resultados esperados versionados.
10. Las limitaciones y la evidencia de falsos positivos y falsos negativos se informan con
    veracidad.
11. Las pruebas de límites de seguridad pasan.
12. La documentación y las instrucciones de uso permiten que otra persona desarrolladora ejecute y
    comprenda la herramienta.

## Criterios de cierre de los hitos

### M01

- Esqueleto de CLI en TypeScript que puede compilarse.
- Comando de ayuda y comando de análisis disponibles.
- Comportamiento de rutas válidas y no válidas probado.
- Comandos de calidad y CI existentes.
- Primer paquete de evidencia registrado.

### M02

- El recorrido seguro, las exclusiones, el inventario y la clasificación funcionan en árboles
  controlados.
- No hay duplicados; el orden es estable; la política de enlaces simbólicos está probada.
- La CLI puede mostrar o exponer internamente el resumen de descubrimiento.

### M03

- La sintaxis compatible se analiza con ubicaciones.
- Los errores de archivos malformados se aíslan.
- El modelo de análisis expone la información JSX y de componentes requerida sin nodos de Babel en
  los contratos de las reglas.

### M04

- El registro y el evaluador de reglas funcionan de manera determinista.
- Todas las reglas requeridas tienen pruebas positivas, negativas y de limitaciones.
- El fallo de una regla no descarta resultados de reglas no relacionadas cuando es seguro
  conservarlos.

### M05

- La configuración se valida y se combina con los valores predeterminados.
- Los generadores de informes de terminal, JSON y HTML usan el mismo `AuditResult`.
- Las pruebas de inyección en HTML pasan.
- Los informes generados son reproducibles, salvo los metadatos volátiles documentados.

### M06

- La CLI de extremo a extremo pasa con los proyectos controlados.
- Existe una tabla de exactitud por cada regla estable.
- Existe evidencia de robustez, rendimiento y seguridad.
- El protocolo de usabilidad se ejecuta o su estado no ejecutado se declara con veracidad.
- El paquete de evidencia de la Actividad 3 y la documentación de implementación están completos.
