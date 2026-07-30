**Español** | [English](../11_INFRASTRUCTURE.md)

# Infraestructura y distribución

## Entorno de uso

UXAudit es una CLI local de Node.js. El entorno compatible es Node.js `>=24.18.0 <25`; npm
`>=11.16.0 <12` es compatible para instalación y scripts. El proyecto React objetivo no necesita
servidor, base de datos, contenedor, navegador ni integración de compilación específica.

```bash
npm install --save-dev @cesar-html-mx/uxaudit
npm exec --offline -- ux-audit scan .
```

El análisis se ejecuta en el entorno del proceso invocador y usa el sistema de archivos local. La
ejecución del producto no requiere acceso de red.

## Artefacto npm público

El paquete npm es `@cesar-html-mx/uxaudit`; el binario es `ux-audit`. El tarball publicado contiene
únicamente:

- archivos compilados de ejecución debajo de `dist/`;
- esquemas JSON públicos debajo de `schemas/`;
- `LICENSE`;
- `README.md`, `README.en.md` y `README.es.md`;
- metadatos del paquete generados por npm.

Las fuentes, pruebas, fixtures, informes locales, registros internos, scripts de desarrollo y
automatización de GitHub no forman parte del artefacto consumidor. UXAudit se distribuye como CLI, no
como API pública de JavaScript que se pueda importar.

La compilación emite JavaScript ESM, declaraciones y mapas de fuente. La entrada ejecutable es
`dist/cli/index.js` y la instalación la enlaza como `ux-audit`.

## Entorno de desarrollo desde fuente

Quienes contribuyen usan el entorno fijado y el lockfile:

```bash
nvm install
nvm use
npm ci
npm run verify
```

`npm ci` instala herramientas de desarrollo solo en una copia del repositorio. Quienes consumen el
paquete no ejecutan la verificación ni los hooks del repositorio. Quienes contribuyen pueden activar
hooks locales con `npm run setup:hooks`.

## Integración continua

El flujo de calidad debe ejecutarse en entornos Linux, Windows y macOS compatibles. Comprueba formato,
documentación bilingüe, lint, tipos estrictos, pruebas, compilación, comportamiento de la CLI e
instalación desde el artefacto npm empaquetado. Linux también ejecuta cobertura, auditoría de
dependencias y validaciones completas del sistema controlado.

Dependency Review y CodeQL protegen cambios cuando el plan de GitHub y la configuración los permiten.
Las acciones externas permanecen fijadas a hashes inmutables revisados y Dependabot propone
actualizaciones controladas de dependencias y workflows.

El estado de CI alojado es independiente de afirmaciones locales. Una comprobación se reporta como
ejecutada solo cuando su resultado real está disponible.

## Puerta de publicación

Antes de publicar:

```bash
npm ci
npm run release:check
npm pack --dry-run
```

`npm run release:check` compone las comprobaciones locales completas de calidad, sistema controlado,
robustez, exactitud e instalación. `prepack` reconstruye `dist/`. `prepublishOnly` es una protección
local cuando alguien publica sin `--ignore-scripts`; el workflow automatizado ejecuta la puerta de
forma explícita y después usa `npm publish --ignore-scripts` para no repetirla.

La prueba del paquete crea un tarball y proyecto consumidor temporales, verifica el contenido
permitido, instala sin depender del repositorio, resuelve el binario y ejecuta comandos
representativos de ayuda, versión y análisis.

## Publicación

Publicar requiere la cuenta npm autorizada `cesar-html-mx`, autenticación vigente, política de dos
factores o publicador confiable según la configuración y una versión semántica sin usar. El paquete
está configurado para acceso público y procedencia npm.

La primera versión pública es `0.1.0`. Las versiones anteriores a `1.0.0` todavía pueden evolucionar,
por lo que conviene comparar el contrato documentado y los cambios del repositorio antes de
actualizar. Publica cada versión de forma deliberada; nunca reutilices ni sobrescribas una versión que
ya llegó al registro.

### Flujo automatizado de publicación

El repositorio publica solo desde `.github/workflows/release.yml` después de enviar un tag llamado
`vX.Y.Z`. El workflow rechaza un tag cuya versión difiere de `package.json` o cuyo commit no está
contenido en `main`. Después ejecuta la puerta completa y publica con procedencia npm.

Para la primera publicación:

1. activa la autenticación de dos factores en la cuenta npm propietaria del scope del paquete;
2. convierte el repositorio de GitHub en público y protege la rama `main`;
3. crea un environment de GitHub llamado `npm` y restríngelo a tags de versión o despliegues
   aprobados;
4. crea un token granular de npm con la expiración práctica más corta, `Packages and scopes`
   configurado como `Read and write`, `Select packages` como `All Packages` y `Bypass 2FA` activado;
   un paquete que aún no existe no puede seleccionarse de forma individual;
5. agrega el token únicamente como secret `NPM_TOKEN` del environment `npm`; nunca guardes su valor
   en el repositorio;
6. después de que exista la primera versión, configura npm Trusted Publishing para el repositorio
   `cesar-html-mx/UXAudit`, el workflow `release.yml` y el environment `npm`;
7. elimina el secret `NPM_TOKEN`, revoca el token temporal y configura el acceso de publicación como
   `Require two-factor authentication and disallow tokens`.

Para cada versión, actualiza `package.json`, `package-lock.json` y `PRODUCT_VERSION` en
`src/index.ts` al mismo número semántico sin usar. Integra el cambio mediante el pull request y la CI
habituales. Desde una rama `main` limpia y actualizada, valida y crea el tag:

```bash
npm ci
npm run release:check
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

No ejecutes `npm publish` localmente. Confirma la ejecución de GitHub Actions y la entrada del
registro antes de anunciar la versión.

## Artefactos y persistencia

UXAudit no despliega un servicio. Sus únicos artefactos son la salida de terminal y archivos locales
JSON/HTML opcionales dentro del proyecto. El directorio predeterminado es `uxaudit-reports`. Los
informes se crean de forma exclusiva y no se sobrescriben.

La salida de compilación `dist/`, cobertura, tarballs temporales e informes de pruebas son artefactos
de desarrollo reproducibles y no se controlan como datos del producto.

## Portabilidad

- Las rutas usan APIs de Node.js y configuración relativa al proyecto compatible entre plataformas.
- La validación rechaza rutas absolutas, barras invertidas, segmentos superiores, controles, nombres
  inseguros de Windows y componentes inválidos en plataformas.
- Las pruebas distinguen garantías entre plataformas de permisos, enlaces o mediciones que varían por
  sistema.
- La CLI no requiere entorno gráfico e informa texto como UTF-8.
