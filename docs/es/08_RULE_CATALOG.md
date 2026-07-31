**Español** | [English](../08_RULE_CATALOG.md)

# Catálogo de reglas

## Resumen

UXAudit incluye ocho reglas estables de análisis estático. Cada hallazgo contiene ID de regla,
categoría, severidad predeterminada, confianza, ubicación cuando está disponible, explicación,
recomendación y limitaciones.

| ID de regla                    | Categoría     | Severidad | Revisión estática                                                                 |
| ------------------------------ | ------------- | --------- | --------------------------------------------------------------------------------- |
| `accessibility/button-name`    | accessibility | high      | Botón nativo sin evidencia estática compatible de nombre accesible.               |
| `accessibility/img-alt`        | accessibility | high      | Imagen nativa sin atributo alternativo explícito y conocido estáticamente.        |
| `accessibility/input-label`    | accessibility | high      | Control nativo compatible sin evidencia estática de etiqueta.                     |
| `performance/img-dimensions`   | performance   | medium    | Imagen nativa sin reserva válida de ancho y alto positivos.                       |
| `performance/img-lazy-loading` | performance   | low       | Imagen nativa sin configuración estática de carga diferida.                       |
| `seo/ambiguous-link-text`      | seo           | medium    | Enlace nativo cuyo texto conservado coincide exactamente con una frase genérica.  |
| `seo/multiple-h1`              | seo           | medium    | Varios aportes de `h1` nativos propios o enlazados exactamente por un componente. |
| `ux/small-inline-text`         | ux            | medium    | Texto conservado con tamaño literal en línea inferior al umbral.                  |

## Interpretar hallazgos

Un hallazgo es un punto de revisión, no prueba de comportamiento en ejecución ni cumplimiento total.
La confianza describe la calidad de la evidencia estática; la severidad indica la prioridad
predeterminada. Los valores dinámicos y spreads no resueltos suelen permanecer desconocidos en vez de
producir un hallazgo especulativo.

La severidad es metadato fijo en el catálogo actual. `--severity` y `minimumSeverity` filtran el
detalle de terminal; no cambian la severidad, ocultan registros JSON/HTML ni modifican el código de
salida.

## Accesibilidad

### `accessibility/button-name`

Reporta un `button` nativo cuando el modelo estático conservado establece que no existe evidencia
compatible de nombre accesible.

Revisa agregando texto visible descriptivo, `aria-label` o `aria-labelledby` con un nombre no vacío.

Limitaciones:

- no implementa el cálculo completo de nombre accesible;
- contenido solo dinámico, spreads JSX no resueltos y componentes de icono personalizados son desconocidos;
- no resuelve objetivos de `aria-labelledby` ni contenido oculto mediante CSS.

### `accessibility/img-alt`

Reporta un `img` nativo cuando el atributo efectivo explícito `alt` está estáticamente ausente. Se
acepta un valor `alt` vacío porque puede marcar intencionalmente una imagen decorativa.

Revisa agregando texto alternativo descriptivo o `alt=""` para una imagen decorativa intencional.

Limitaciones:

- no infiere componentes de imagen personalizados ni alias;
- un spread JSX posterior no resuelto puede aportar `alt` y permanece desconocido;
- la regla comprueba presencia del atributo, no calidad descriptiva.

### `accessibility/input-label`

Revisa controles nativos compatibles en busca de evidencia estática de etiqueta o nombre accesible.
La evidencia compatible incluye anidación aplicable, coincidencia literal `htmlFor`/`id`,
`aria-label` no vacío o `aria-labelledby` no vacío.

Limitaciones:

- IDs, etiquetas y spreads dinámicos permanecen desconocidos;
- no resuelve abstracciones personalizadas entre límites de componentes;
- no valida objetivos de `aria-labelledby` ni el cálculo completo de nombre accesible;
- tipos de input hidden, button, submit, reset e image están fuera de esta regla;
- no valida etiquetas anidadas contra todas las restricciones del modelo de contenido HTML.

## Rendimiento

### `performance/img-dimensions`

Reporta un `img` nativo sin atributos `width` y `height` que sean enteros positivos válidos de forma
estática, o con un par inválido revisable. Una imagen literal de cero por cero se considera contenido
no destinado a la persona; cero junto con una dimensión positiva permanece revisable.

Revisa agregando dimensiones que conserven la proporción o verificando que CSS reserve espacio
equivalente.

Limitaciones:

- la regla describe riesgo de desplazamiento; no observa el desplazamiento real;
- CSS, `aspect-ratio` y el diseño del componente pueden reservar espacio equivalente;
- dimensiones dinámicas y spreads no resueltos permanecen desconocidos salvo que otro valor pruebe una violación;
- no infiere componentes personalizados ni metadatos en ejecución.

### `performance/img-lazy-loading`

Reporta un `img` nativo cuyo valor estático efectivo `loading` está ausente, es eager o inválido en
lugar de `loading="lazy"`.

Revisa si la imagen está fuera del primer viewport y debería usar carga diferida. Conserva la carga
inmediata cuando la prioridad visual lo requiera.

Limitaciones:

- el análisis estático no sabe si una imagen es prioritaria, por lo que todo hallazgo es consultivo;
- los valores dinámicos y spreads no resueltos permanecen desconocidos;
- no infiere componentes personalizados, precargas ni prioridades en ejecución.

## SEO

### `seo/ambiguous-link-text`

Reporta un `a` nativo cuando su texto conservado normalizado coincide exactamente con las frases
genéricas predeterminadas: “click here”, “here”, “read more”, “aquí” o “ver más”.

Revisa usando texto visible que identifique el destino o propósito.

Limitaciones:

- solo compara texto conservado exacto; no reporta texto parcial ni dinámico;
- no infiere componentes de enlace personalizados;
- no evalúa texto circundante, nombre ARIA, URL de destino ni contexto visual.

### `seo/multiple-h1`

Reporta como máximo un hallazgo por cada componente reconocido sintácticamente. Cuando un componente
posee más de un `h1` nativo, la regla conserva su comportamiento local al archivo y reporta el segundo
`h1` local, incluso si antes aparece un aporte enlazado. En los demás casos, la regla también evalúa la
composición en orden del código fuente JSX mediante relaciones `ComponentLink` locales directas y
exactas. Cada uso JSX de una definición hija enlazada aporta como máximo un `h1` a su componente padre,
por lo que varios encabezados dentro de ese hijo no multiplican la misma causa en el padre. Los usos
repetidos se evalúan por separado y cada uso puede aportar una vez. Cuando el uso de un hijo aporta la
segunda contribución, el hallazgo se ubica en ese uso JSX del componente propietario.

Revisa el contexto de la página renderizada y conserva un encabezado principal cuando corresponda,
usando niveles inferiores para secciones subordinadas.

Limitaciones:

- solo recorre relaciones locales directas y exactas representadas por `ComponentLink`; las
  referencias no resueltas o ambiguas, los imports de paquetes y los recorridos que dependen de
  aristas cíclicas se tratan de forma conservadora y no aportan contribuciones `h1` inferidas;
- no evalúa renderizado condicional, rutas ni si los encabezados aparecen juntos en ejecución;
- se admiten exactamente `64` saltos `ComponentLink` desde cada componente raíz evaluado; los
  recorridos con más de `64` saltos permanecen desconocidos y no se infieren;
- cada componente raíz dispone de un presupuesto independiente de `100000` pasos de recorrido; el
  trabajo que requiere más de `100000` pasos para esa raíz permanece desconocido y no se infiere;
- no infiere sintaxis de encabezado personalizada ni roles de encabezado.

## UX

### `ux/small-inline-text`

Reporta texto no vacío conservado en un elemento nativo renderizado cuando el valor literal exacto de
`fontSize` en el estilo en línea es no negativo e inferior a 12 píxeles.

Revisa usando al menos 12 píxeles o un tamaño legible equivalente en el sistema de estilos.

Limitaciones:

- no evalúa hojas externas, nombres de clase, herencia ni cascada renderizada;
- estilos dinámicos, spreads no resueltos y objetos con propiedades desconocidas permanecen desconocidos;
- no resuelve unidades relativas, porcentajes, cálculos, zoom ni configuración de pantalla;
- solo evalúa elementos nativos con texto estático conservado.

## Seleccionar reglas

Usa categorías, IDs exactos o ambos:

```bash
npm exec --offline -- ux-audit scan . --category accessibility
npm exec --offline -- ux-audit scan . --rule accessibility/img-alt
npm exec --offline -- ux-audit scan . --category performance --rule performance/img-dimensions
```

Repite `--category` o `--rule` para seleccionar más valores. Cuando se proporcionan ambos filtros,
una regla debe coincidir con los dos. Un arreglo vacío en la configuración selecciona cero reglas
para ese filtro; `null` significa sin filtro.

## Agregar o cambiar una regla

Una contribución debe definir alcance, metadatos, fixtures positivos y negativos, casos no
compatibles, ubicaciones, limitaciones, documentación, orden determinista y aislamiento. Las reglas
solo consumen el modelo normalizado y no deben leer, ejecutar ni modificar archivos objetivo.
