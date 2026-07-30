**Español** | [English](../11_INFRASTRUCTURE.md)

# Infraestructura y herramientas

## Entorno de ejecución

UXAudit se ejecuta en la línea LTS de Node.js 24 (`>=24.18.0 <25`) con npm 11
(`>=11.16.0 <12`); M01 fija Node.js `24.18.0` y npm `11.16.0` para desarrollo y CI. Lee archivos del
proyecto y escribe localmente los informes JSON/HTML seleccionados. El producto no requiere backend,
contenedor, base de datos, servicio en la nube ni conexión de red.

## Desarrollo

- Visual Studio Code y Codex
- Git y GitHub
- Node.js y npm
- TypeScript
- Commander.js
- Analizador y recorrido de Babel
- Vitest
- ESLint y Prettier
- Husky

## Integración continua

La configuración de GitHub Actions de M01 verifica:

- la integridad del harness en Node.js 24;
- la instalación de dependencias desde el lockfile en Ubuntu 24.04, Windows 2025 y macOS 15;
- la comprobación de formato;
- el lint;
- la comprobación de tipos;
- las pruebas específicas;
- la generación de cobertura y sus umbrales en Linux;
- la compilación;
- el conjunto de pruebas de humo de la CLI compilada en cada plataforma de la matriz;
- la auditoría de npm con un umbral de fallo de severidad moderada en Linux;
- CodeQL en pushes o pull requests a `main`, programación semanal y ejecución manual donde GitHub
  Code Security esté disponible;
- Dependency Review para repositorios públicos o repositorios privados marcados explícitamente como
  poseedores de GitHub Code Security, que falla ante cambios de dependencias de severidad moderada o
  superior.

Los flujos de trabajo utilizan permisos mínimos, cancelación de concurrencia, tiempos de espera
acotados, ninguna credencial persistente del checkout y SHA inmutables de acciones. Dependabot
supervisa las versiones de npm y GitHub Actions. Los repositorios públicos habilitan CodeQL y
Dependency Review automáticamente; los repositorios privados elegibles se adhieren mediante
`CODEQL_ENABLED=true` y `DEPENDENCY_REVIEW_ENABLED=true`.

## Artefactos

Compilación del producto:

- JavaScript ejecutable y declaraciones de tipos en `dist/` si se publica.

Salidas de auditoría:

- resumen de terminal;
- `audit-report.json`;
- `audit-report.html`;

Actualmente, el producto no genera un formato de registro de ejecución. Los registros de comandos
sin procesar solo pertenecen a la evidencia de ingeniería.

Evidencia de ingeniería:

- resúmenes de resultados de pruebas;
- resumen de cobertura;
- comparación esperada y real del proyecto controlado;
- registros de seguridad y usabilidad.

M02 agrega un escenario controlado de descubrimiento sin shell y un recopilador aislado de evidencia:

- `npm run test:scenario:m02` compila UXAudit, crea un proyecto mixto temporal, compara los resultados
  normalizados esperados y reales del descubrimiento, verifica dos ejecuciones idénticas byte por
  byte y demuestra que los scripts de destino no se ejecutan.
- `npm run evidence:m02` copia la instantánea de fuentes sin dependencias, evidencia conservada,
  metadatos de Git, archivos de credenciales ni claves privadas; realiza una instalación limpia y
  bloqueada en Node.js 24; rechaza enlaces simbólicos incluidos; afirma el entorno de ejecución
  fijado y el estado activo de M02; ejecuta el gate completo de M02 con un registro explícito de cero
  estados skip o todo; y conserva atómicamente solo registros sanitizados y con suma de
  comprobación en `evidence/m02-discovery/`.
- `npm run evidence:m02:finalize` se ejecuta después de escribir el informe del hito y vuelve a
  generar el manifiesto atómicamente para que el informe esté cubierto por el mismo contrato de
  integridad.

M06-T01 amplía a once escenarios el conjunto de pruebas de humo compiladas sin shell. Ahora cubre
diagnósticos hostiles de terminal, la auditoría integrada predeterminada, los tres generadores de
informes, sintaxis recuperable, precedencia entre configuración y CLI, una selección explícita de
cero reglas, límites estables de entrada o salida fatal y rechazo exclusivo de un destino existente.
Cada escenario utiliza las API de procesos de Node en lugar de un shell y el código fuente de destino
permanece inerte.

M06-T02 agrega `npm run test:scenario:m06`. El script compila la CLI real, copia o genera cinco
proyectos controlados en raíces temporales, ejecuta cada uno dos veces con salida de terminal, JSON y
HTML, y compara proyecciones estables después de omitir únicamente la volatilidad de la raíz canónica
y la medición. Nunca reutiliza un árbol de salida porque la persistencia de informes es
intencionalmente exclusiva. La creación de enlaces simbólicos en tiempo de ejecución es consciente
de capacidades, y cada enlace creado debe informarse como excluido por la política predeterminada.

M06-T04 agrega `npm run test:robustness:m06`. Compila la CLI real y ejecuta 15 casos de Linux sin
shell que cubren fallos de entrada o configuración, autorización y sobrescritura de salida,
aislamiento de elementos malformados, recorrido con 32 directorios de profundidad, no ejecución, HTML
hostil, repeticiones deterministas, enlaces simbólicos, denegaciones reales de permisos, auditoría de
dependencias y una línea base de rendimiento con cinco ejecuciones y 240 archivos. El máximo
`VmRSS` del proceso hijo en Linux se observa mediante muestreo de `/proc` cada 5 ms y no se representa
como un pico exacto durante toda la vida del proceso; otras plataformas deben registrar la medición
de memoria como no disponible en lugar de sustituir un proceso distinto. El ejecutor no impone
ningún umbral de tiempo dependiente de la máquina y registra CodeQL alojado como no ejecutado salvo
que se recupere un resultado alojado real.

M06-T05 agrega `npm run test:usability:m06`, un ejecutor de revisión experta sobre seis tareas
controladas de desarrollo. Sus valores de tiempo de reloj por tarea miden el procedimiento de
revisión experta mediante script, no el tiempo de tarea de un participante. Las pruebas con
participantes permanecen sin ejecutar y SUS sigue sin ser aplicable porque no existen respuestas
reales.

`npm run evidence:m06` copia un árbol de fuentes de lista de permitidos en un espacio de trabajo
temporal sin credenciales, realiza una instalación bloqueada, ejecuta sin shell el gate completo de
producto, cobertura, ausencia de pruebas omitidas, humo, sistema, exactitud, robustez, usabilidad,
harness y auditoría, y publica exactamente 42 artefactos base sanitizados con integridad SHA-256.
Una segunda ejecución debe coincidir con la fuente y las proyecciones estables mientras trata
únicamente como volátiles el rendimiento registrado y la medición del procedimiento experto; además,
conserva el primer paquete. `npm run evidence:m06:finalize` valida ese manifiesto base y agrega
únicamente el informe del hito. El recopilador nunca trata CodeQL alojado, pruebas con participantes,
SUS, ejecución de navegador ni publicación no disponible como trabajo ejecutado.

## Portabilidad

Se debe evitar el comportamiento de shell específico del sistema operativo en el código del
producto. CI debe incluir más de un sistema operativo para el contrato compatible de Node.js 24.
Solo se debe agregar otra línea de Node.js después de que se convierta en un contrato LTS compatible;
no se debe usar una versión Current no compatible como señal de calidad. Las diferencias específicas
de plataforma deben documentarse y probarse cuando se descubran.
