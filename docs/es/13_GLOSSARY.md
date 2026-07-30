**Español** | [English](../13_GLOSSARY.md)

# Glosario

- **Sesión de auditoría**: una ejecución completa sobre un proyecto y una configuración.
- **Raíz del proyecto**: directorio validado que se seleccionó para el análisis.
- **Archivo descubierto**: entrada del sistema de archivos encontrada después de aplicar las
  exclusiones.
- **Inventario**: registros normalizados y deterministas de los archivos descubiertos.
- **Candidato de código fuente**: archivo compatible seleccionado para el análisis sintáctico.
- **Salida del adaptador de AST**: representación del límite del analizador sintáctico que puede
  usar internamente tipos de Babel.
- **Archivo de código fuente analizado**: resultado normalizado y sin AST de un candidato de código
  fuente procesado correctamente; es la entrada del constructor del modelo de análisis del proyecto.
- **Modelo de análisis**: representación del dominio de UXAudit independiente del analizador
  sintáctico que utilizan las reglas.
- **Ubicación en el código fuente**: ruta de archivo relativa y portable junto con un rango
  semiabierto del código fuente que utiliza líneas basadas en uno y columnas/desplazamientos UTF-16
  basados en cero.
- **Confianza del valor**: indicación `exact`, `partial` o `dynamic` de cuánta información de
  valor/texto JSX se puede justificar sin evaluar el código objetivo.
- **Regla**: un criterio de validación ejecutable de forma independiente.
- **Hallazgo**: evidencia normalizada de que una regla identificó una situación que se debe revisar.
- **Error de ejecución**: problema de procesamiento recuperable o no recuperable, distinto de un
  hallazgo.
- **AuditResult**: resultado normalizado completo que utiliza cada generador de informes.
- **Generador de informes**: adaptador de salida para terminal, JSON, HTML o un formato futuro.
- **Regla estable**: regla implementada, probada, documentada y validada dentro de su alcance
  declarado.
- **Regla experimental**: regla implementada o prototipada sin evidencia suficiente para realizar
  afirmaciones estables.
- **Regla diferida**: regla especificada, pero excluida intencionalmente de la implementación actual.
- **Proyecto controlado**: aplicación fixture con hallazgos esperados versionados.
- **ExecPlan**: plan autónomo y vivo de un hito.
- **Puerta de calidad**: comprobaciones obligatorias que se requieren para cerrar una tarea o un
  hito.
