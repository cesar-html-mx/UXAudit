**Español** | [English](../10_DOCUMENTATION_POLICY.md)

# Política de documentación

La documentación forma parte de la implementación; no es una tarea final de limpieza.

## Documentación pública bilingüe

- Los documentos públicos se mantienen en inglés y en español latinoamericano dentro del mismo
  pull request.
- Las traducciones al español usan español latinoamericano neutral.
- El código, los identificadores, los comandos y las salidas exactas no se traducen.
- Los archivos internos del harness y la evidencia generada o finalizada de los hitos permanecen en
  inglés.
- Los originales en inglés en sus rutas establecidas siguen siendo la referencia operativa para la
  automatización.
- Cualquier divergencia entre un documento público en inglés y su espejo en español es un defecto
  de documentación.

## Siempre actualizados

- `README.md`, `README.en.md` y `README.es.md`
- `docs/00_INDEX.md`, cada documento público en inglés y su equivalente en `docs/es/`
- orientación pública de seguridad, pull requests, entrada a la evidencia, usabilidad y metodología
  de evidencia
- comportamiento del producto y opciones de la CLI
- arquitectura y contratos públicos
- catálogo de reglas y limitaciones
- trazabilidad de requisitos
- ExecPlan activo
- estado, decisiones, riesgos, bloqueadores, registro de sesión e índice de evidencia

## Documentación de componentes

Un nuevo componente principal debe documentar:

- responsabilidad;
- entradas y salidas;
- dependencias;
- comportamiento ante errores;
- consideraciones de rendimiento o seguridad;
- requisitos y pruebas relacionados.

## Documentación de reglas

Una regla no está completa hasta que el catálogo incluye su alcance, activador, ejemplos válidos,
limitaciones, severidad, recomendación y referencias.

## Historial de cambios

Usa el historial de Git para dar seguimiento a los cambios por archivo y `DECISIONS.md` para las
razones que las futuras personas contribuidoras necesiten comprender. No dupliques cada commit en
forma de prosa.

## Evidencia académica

Las notas de implementación deben ser objetivas. Conserva los comandos y resultados observados para
que el capítulo de pruebas del TFM pueda distinguir los planes del trabajo completado.
