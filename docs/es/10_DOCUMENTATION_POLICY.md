**Español** | [English](../10_DOCUMENTATION_POLICY.md)

# Política de documentación

## Audiencias

La documentación se organiza para:

- personas que instalan y ejecutan la CLI;
- quienes la integran en scripts del proyecto o CI;
- quienes contribuyen a arquitectura, reglas, pruebas, paquete o documentación;
- quienes revisan los límites de confianza y seguridad local.

El recorrido de uso aparece primero. Los registros históricos de implementación no deben interrumpir
la instalación, configuración, interpretación de reglas ni solución de problemas.

## Idiomas

La documentación informativa duradera se mantiene en inglés y español latinoamericano natural. Esto
incluye el README raíz, guías del producto y contribución, seguridad, reglas e historia.

El código, identificadores, IDs de reglas, claves de configuración, comandos, rutas, nombres de
archivo y paquete, valores de esquemas y formatos legibles por máquinas permanecen en inglés.
Traducir esos literales haría incorrectos los ejemplos.

## Emparejamiento de documentos

- `README.md` contiene secciones sustanciales de entrada en español e inglés.
- `README.en.md` y `README.es.md` son guías completas y recíprocas.
- Cada documento en inglés debajo de `docs/` tiene la misma ruta debajo de `docs/es/`.
- Cada par comienza con un selector recíproco visible de idioma.
- La jerarquía, forma de tablas, ejemplos delimitados y literales técnicos permanecen alineados.
- Los enlaces relativos deben quedarse en el repositorio y apuntar a archivos y encabezados existentes.

`npm run docs:check` valida estas garantías mecánicas. La revisión humana sigue siendo responsable
del significado, fluidez, tono y equivalencia veraz.

## Contenido según el tipo

| Tipo                     | Contenido requerido                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Guía de uso              | Instalación, inicio, opciones, configuración, informes, reglas, salidas, privacidad y límites. |
| Catálogo de reglas       | Alcance, activador, no activador, recomendación, severidad, confianza y limitaciones.          |
| Arquitectura             | Límites actuales, flujo de datos, contratos, determinismo y propiedad de errores.              |
| Estrategia de pruebas    | Capas, escenarios, seguridad, distribución y expectativas de publicación actuales.             |
| Seguridad                | Amenazas, controles, privacidad, riesgos residuales y canal privado.                           |
| Criterios de publicación | Condiciones observables y comprobables para un artefacto público.                              |
| Historia                 | Contexto breve del archivo sin convertir el proceso interno en instrucciones del producto.     |

## Fuente de verdad

El comportamiento observable de la CLI se basa en la implementación y las pruebas, y después se
explica en la especificación. La arquitectura define los límites previstos. El catálogo debe
coincidir con las reglas registradas. Los comandos e instrucciones de instalación deben coincidir con
`package.json` y el tarball probado.

Cuando las fuentes discrepen, no copies el conflicto silenciosamente entre idiomas. Resuelve el
contrato, actualiza implementación o pruebas cuando esté autorizado y después actualiza ambos
documentos.

## Guía de redacción

- Comienza con el resultado para la persona usuaria.
- Usa lenguaje sencillo y ejemplos breves ejecutables.
- Distingue un hallazgo estático de un hecho en ejecución.
- Indica las limitaciones junto a la afirmación que restringen.
- No anuncies comandos, informes, políticas, métricas ni integraciones no implementadas.
- No presentes una revisión experta como investigación con participantes.
- Evita IDs de tareas internas, cronología de construcción o comandos de archivo en guías públicas.
- Excluye valores sensibles, credenciales, rutas privadas y fuentes no confiables de los ejemplos.

## Lista de actualización

Cuando cambie un comportamiento público:

1. actualiza las pruebas y el contrato correspondiente;
2. actualiza inglés y español en el mismo cambio;
3. conserva literales exactos y ejemplos delimitados idénticos byte por byte;
4. actualiza el índice y la trazabilidad cuando cambie una página o contrato duradero;
5. ejecuta `npm run docs:check` y las comprobaciones de formato;
6. revisa la instalación y los enlaces desde la perspectiva de alguien nuevo.
