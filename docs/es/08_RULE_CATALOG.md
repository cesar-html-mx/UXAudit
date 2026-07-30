**Español** | [English](../08_RULE_CATALOG.md)

# Catálogo inicial de reglas

Estado de las reglas:

- **required**: debe implementarse y validarse en M04.
- **stable**: implementada con un alcance estático revisado y evidencia de verificación conservada.
- **experimental**: puede desarrollarse como prototipo, pero no puede presentarse como confiable sin
  evidencia.
- **deferred**: trabajo futuro documentado.

## Accesibilidad

### A11Y-001 — Texto alternativo de imagen

- ID: `accessibility/img-alt`
- Estado: stable (required para M04)
- Severidad: high
- Confianza del hallazgo: high cuando se puede demostrar la ausencia del atributo `alt` efectivo.
- Alcance y activador: únicamente nodos `<img>` intrínsecos. Resuelve los atributos JSX de derecha a
  izquierda; emite un hallazgo en el rango del elemento cuando no existe un `alt` con nombre ni una
  propagación posterior sin resolver.
- Ejemplos válidos: `<img alt="Quarterly revenue chart" />` y `<img alt="" />` para una imagen
  decorativa.
- Comportamiento no compatible/de límite: una propagación efectiva es desconocida y no produce
  ningún hallazgo. Cualquier `alt` explícito con nombre, incluido un valor dinámico, satisface esta
  comprobación inicial que solo verifica su presencia; la regla no afirma que su valor sea
  descriptivo.
- Recomendación: agrega un `alt` descriptivo o `alt=""` para una imagen intencionalmente decorativa.
- Limitaciones: no se infieren componentes/alias personalizados de imágenes, no se evalúan los
  valores de propagación en tiempo de ejecución ni se califica la calidad del texto alternativo.
- Referencia: concepto de WCAG 1.1.1.
- Verificación: `tests/rules/accessibility/img-alt.test.ts` y el fixture de integración de
  accesibilidad confirmado en el repositorio.

### A11Y-002 — Etiqueta de control de formulario

- ID: `accessibility/input-label`
- Estado: stable (required para M04)
- Severidad: high
- Confianza del hallazgo: high dentro del alcance documentado de asociación estática.
- Alcance y activador: nodos intrínsecos `input`, `select` y `textarea`. Emite cuando un control que
  requiere etiqueta no tiene un ancestro `<label>` intrínseco, una asociación exacta dentro del
  mismo componente mediante `htmlFor`/`for` más `id`, ni un `aria-label` o `aria-labelledby` exacto y
  no vacío.
- Ejemplos válidos: `<label>Email <input /></label>`, `<label htmlFor="email">…</label>` junto con
  `<input id="email" />` y un control con un atributo de nombre ARIA no vacío.
- Exclusiones: tipos de input `hidden`, `button`, `submit`, `reset` e `image` que coincidan exactamente
  sin distinguir mayúsculas de minúsculas.
- Comportamiento no compatible/de límite: los valores dinámicos de tipo/ID/ARIA y las propagaciones
  JSX efectivas no producen hallazgos porque no es posible demostrar la asociación ni la
  aplicabilidad de la etiqueta. Los ID/cadenas ARIA vacíos y los valores ARIA exactamente `null`
  siguen requiriendo etiqueta. El tipo de input predeterminado/null sigue requiriendo etiqueta. Las
  etiquetas externas requieren igualdad literal exacta y sin recortar entre `htmlFor`/`for` e `id`
  dentro de un componente reconocido; las etiquetas no se emparejan entre límites de componentes ni
  ámbitos JSX sin propietario.
- Recomendación: usa anidamiento de etiquetas intrínsecas, `htmlFor`/`id` exactos o un nombre ARIA no
  vacío.
- Limitaciones: no se resuelven abstracciones personalizadas de etiquetas/controles, asociaciones
  dinámicas, la existencia del destino ARIA referenciado ni el algoritmo completo de nombre
  accesible. La regla excluye deliberadamente los tipos de input `hidden`, `button`, `submit`,
  `reset` e `image`, y no valida la restricción de un solo descendiente etiquetable dentro de una
  etiqueta anidada.
- Referencia: concepto de WCAG 1.3.1.
- Verificación: `tests/rules/accessibility/input-label.test.ts` y el fixture de integración de
  accesibilidad confirmado en el repositorio.

### A11Y-003 — Nombre accesible de botón

- ID: `accessibility/button-name`
- Estado: stable (required para M04)
- Severidad: high
- Confianza del hallazgo: high cuando el texto y toda la evidencia compatible de nombres ARIA se
  pueden demostrar vacíos o ausentes.
- Alcance y activador: únicamente nodos `<button>` intrínsecos. Emite en el rango del botón cuando el
  texto conservado está exactamente vacío y tanto `aria-label` como `aria-labelledby` están ausentes
  o son cadenas exactamente vacías.
- Ejemplos válidos: texto estático visible, texto estático conocido combinado con contenido dinámico
  o un atributo compatible de nombre ARIA exacto y no vacío.
- Comportamiento no compatible/de límite: el texto únicamente dinámico, un elemento hijo de icono
  personalizado, valores ARIA dinámicos o una propagación JSX efectiva no producen hallazgos. Los
  valores ARIA exactamente `null` se tratan como ausentes. No se infieren componentes `<Button>`
  personalizados.
- Recomendación: proporciona texto descriptivo visible o un nombre ARIA compatible no vacío.
- Limitaciones: no se resuelven el cálculo completo del nombre accesible, la existencia del destino
  referenciado, el contenido oculto mediante CSS ni la semántica de iconos personalizados.
- Referencia: concepto de WCAG 4.1.2.
- Verificación: `tests/rules/accessibility/button-name.test.ts` y el fixture de integración de
  accesibilidad confirmado en el repositorio.

## Rendimiento

### PERF-001 — Carga diferida de imágenes

- ID: `performance/img-lazy-loading`
- Estado: stable, advisory (required para M04)
- Severidad: low
- Confianza del hallazgo: medium porque la prioridad visual requiere revisión contextual.
- Alcance y activador: únicamente nodos `<img>` intrínsecos. Emite en el rango de la imagen cuando el
  atributo `loading` efectivo está ausente, es `eager` o tiene otro valor literal conocido. Una
  palabra clave `lazy` exacta sin distinguir mayúsculas de minúsculas es el caso compatible que no
  produce hallazgo.
- Comportamiento no compatible/de límite: los valores dinámicos y las propagaciones JSX efectivas
  son desconocidos y no producen hallazgos. No se infieren componentes personalizados de imagen.
- Recomendación: usa `loading="lazy"` cuando la imagen no se encuentre intencionalmente en la parte
  visible inicial.
- Limitaciones: el análisis estático no puede conocer la prioridad visual, el comportamiento de
  precarga ni la prioridad de recuperación en tiempo de ejecución; cada hallazgo solicita revisión y
  no afirma que la carga anticipada sea incorrecta.
- Referencia: atributos de carga diferida del HTML Standard.
- Verificación: `tests/rules/performance/img-lazy-loading.test.ts` y el conjunto de integración de
  rendimiento.

### PERF-002 — Dimensiones de imagen y riesgo de cambio de diseño

- ID: `performance/img-dimensions`
- Estado: stable (required para M04)
- Severidad: medium
- Confianza del hallazgo: medium porque otros mecanismos de diseño pueden reservar espacio.
- Alcance y activador: únicamente nodos `<img>` intrínsecos. Tanto `width` como `height` efectivos
  normalmente deben ser literales numéricos enteros positivos y seguros, o cadenas de enteros
  decimales ASCII. Emite en el rango de la imagen cuando se puede demostrar que alguno está
  ausente/no es válido, incluso si el otro es desconocido, o cuando se combina cero con una dimensión
  positiva.
- Comportamiento no compatible/de límite: una dimensión dinámica o una propagación JSX efectiva no
  produce hallazgo únicamente cuando no se haya demostrado ya una infracción en la otra dimensión.
  El literal cero por cero se trata como contenido no destinado a la persona usuaria y no produce un
  hallazgo. No se infieren componentes personalizados de imagen.
- Recomendación: proporciona dimensiones enteras positivas que conserven la relación de aspecto de
  la imagen o verifica una reserva de espacio equivalente mediante CSS.
- Limitaciones: no se evalúan CSS externo, `aspect-ratio`, el diseño de componentes ni los metadatos
  de imagen en tiempo de ejecución; un hallazgo describe un riesgo de cambio de diseño, no un cambio
  de diseño observado.
- Referencia: atributos de dimensiones del HTML Standard.
- Verificación: `tests/rules/performance/img-dimensions.test.ts` y el conjunto de integración de
  rendimiento.

## SEO

### SEO-001 — Varios elementos H1

- ID: `seo/multiple-h1`
- Estado: stable, advisory (required para M04)
- Severidad: medium
- Confianza del hallazgo: medium porque la propiedad estática no equivale a la composición de la
  página renderizada.
- Alcance y activador: cuenta los nodos `<h1>` intrínsecos de manera independiente dentro de cada
  componente reconocido sintácticamente. Emite un hallazgo por componente afectado en su segundo
  `<h1>`, incluso cuando existan más encabezados. El JSX sin propietario no se combina en un conteo
  por archivo/proyecto.
- Comportamiento válido/de límite: cero o un `<h1>` intrínseco por componente no produce hallazgos.
  Los componentes personalizados de encabezado se ignoran. Los encabezados en ramas mutuamente
  excluyentes siguen siendo un hallazgo advisory con confianza medium porque no se evalúa la
  selección de ramas en tiempo de ejecución.
- Recomendación: revisa el componente y conserva un encabezado principal para cada contexto de
  página renderizada.
- Limitaciones: las rutas, el renderizado condicional, la composición de componentes, los encabezados
  personalizados y los roles de encabezado pueden cambiar la jerarquía renderizada; la regla no
  afirma un conteo por página para todo el proyecto.
- Verificación: `tests/rules/seo/multiple-h1.test.ts` y el conjunto de integración de SEO.

### SEO-002 — Texto ambiguo de enlace

- ID: `seo/ambiguous-link-text`
- Estado: stable (required para M04)
- Severidad: medium
- Confianza del hallazgo: medium porque el contexto accesible circundante está fuera del alcance
  inicial.
- Alcance y activador: `<a>` intrínseco con texto conservado exacto que, después de normalización
  determinista NFKC, colapso de espacios en blanco, recorte y conversión a minúsculas, coincide
  completamente con el conjunto configurado. Los valores predeterminados son `click here`, `here`,
  `read more`, `aquí` y `ver más`.
- Configuración: `createAmbiguousLinkTextRule` acepta un arreglo validado de cadenas no vacías; los
  valores configurados sustituyen los predeterminados y se normalizan/desduplican.
- Comportamiento no compatible/de límite: los superconjuntos descriptivos, las diferencias de
  puntuación, el texto parcial/dinámico y los componentes personalizados de enlace no producen
  hallazgos.
- Recomendación: usa texto visible que identifique el destino o propósito y revisa su contexto
  accesible.
- Limitaciones: no se evalúan el contenido circundante, los nombres ARIA, las URL de destino, el
  contexto visual ni los componentes personalizados renderizados.
- Verificación: `tests/rules/seo/ambiguous-link-text.test.ts` y el conjunto de integración de SEO.

## UX

### UX-001 — Texto literal en línea muy pequeño

- ID: `ux/small-inline-text`
- Estado: stable (required para M04)
- Severidad: medium
- Confianza del hallazgo: high para texto conservado exacto y medium para texto conservado parcial
  dentro del alcance limitado de estilos literales en línea.
- Alcance y activador: elementos intrínsecos con texto estático conocido, conservado y no vacío, y un
  `style` efectivo de literal de objeto exacto. Emite en la propiedad `fontSize` efectiva cuando su
  último valor literal es un número finito no negativo o una cadena `px` por debajo del umbral
  configurado; el valor predeterminado es `12px` y la igualdad no produce un hallazgo.
- Configuración: `createSmallInlineTextRule` acepta un único `thresholdPx` numérico, finito y
  positivo.
- Comportamiento no compatible/de límite: los elementos personalizados, el texto
  vacío/solo dinámico, los objetos de estilo dinámicos/parciales, las propiedades/propagaciones de
  objetos desconocidas, los tamaños negativos y los valores en `rem`/`em`/`%`/`calc()` o no
  numéricos no producen hallazgos. El texto parcial conocido con una parte estática conservada no
  vacía se evalúa con confianza medium. Se excluyen los contenedores de texto de metadatos, inertes,
  vacíos y otros que intrínsecamente no se renderizan.
- Recomendación: usa al menos el umbral de píxeles configurado o un tamaño legible equivalente en el
  sistema de estilos del proyecto.
- Limitaciones: no se evalúan CSS externo, clases, herencia, cascada, cálculo de unidades relativas,
  zoom, configuraciones de la persona usuaria ni el contexto renderizado.
- Verificación: `tests/rules/ux/small-inline-text.test.ts`.

### UX-002 — Texto ambiguo de botón

- ID: `ux/ambiguous-button-text`
- Estado: experimental
- Severidad: low
- Detección: etiquetas estáticas genéricas configurables cuya acción no puede inferirse del propio
  botón.
- Requisito de promoción: ejemplos controlados y precisión aceptable.

### UX-003 — Ausencia de estado de carga

- ID: `ux/missing-loading-state`
- Estado: deferred/experimental
- Severidad: low
- Objetivo: identificar patrones estáticos limitados en los que una acción asíncrona de la persona
  usuaria no tiene retroalimentación visible de carga.
- Motivo del estado: una decisión general y confiable requiere comprender el tiempo de ejecución y
  el flujo de estados más allá del modelo inicial.

## Contrato de las reglas

Cada regla implementada debe proporcionar:

- ID estable;
- título;
- categoría;
- severidad predeterminada;
- estado en el catálogo;
- explicación;
- recomendación;
- estándar/referencia anulable con una etiqueta y una URL opcional;
- operación de evaluación;
- una o más limitaciones explícitas;
- fixtures positivos y negativos;
- fixture de límite o no compatible;
- trazabilidad a pruebas y evidencia.

El contrato de dominio de M04 distingue el estado de una regla en el catálogo de la confianza del
hallazgo. El estado describe la madurez o entrega en el catálogo (`required`, `stable`,
`experimental` o `deferred`); la confianza (`high`, `medium` o `low`) describe la solidez con la que
un hallazgo está justificado por la evidencia estática disponible. Los hallazgos conservan la
`SourceLocation` semiabierta completa cuando está disponible; los generadores de informes pueden
derivar después las coordenadas de presentación, pero las reglas no las aplanan ni convierten.

## Resultado de exactitud controlado de M06

La CLI compilada se comparó con la verdad de referencia revisada a nivel de instancia, en lugar de
tratar cada nodo JSX no informado como un verdadero negativo.

| ID de regla                    |  TP |  FP |  TN |  FN | Precisión | Exhaustividad | No compatible |
| ------------------------------ | --: | --: | --: | --: | --------: | ------------: | ------------: |
| `accessibility/button-name`    |   1 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `accessibility/img-alt`        |   1 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `accessibility/input-label`    |   2 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `performance/img-dimensions`   |   1 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `performance/img-lazy-loading` |   2 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `seo/ambiguous-link-text`      |   2 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `seo/multiple-h1`              |   1 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |
| `ux/small-inline-text`         |   1 |   0 |   1 |   0 |      1.00 |          1.00 |             1 |

Estos valores se aplican únicamente a 19 instancias controladas compatibles y ocho no compatibles.
Validan los contratos estáticos implementados y no estiman la exactitud en proyectos externos
representativos, páginas renderizadas, abstracciones dinámicas de componentes ni comportamiento en
tiempo de ejecución.
