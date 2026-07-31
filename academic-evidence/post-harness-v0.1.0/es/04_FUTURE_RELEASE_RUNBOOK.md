**Español** | [English](../en/04_FUTURE_RELEASE_RUNBOOK.md)

# Procedimiento para versiones futuras

## Principio

Los cambios de código y pull requests no requieren un token npm. La autenticación Git sigue
gestionando ramas y pull requests. Solo el job de publicación necesita autenticarse con npm y el
diseño actual obtiene automáticamente una identidad OIDC de corta duración desde GitHub Actions.

No crees otro token npm reutilizable de publicación, no agregues `NPM_TOKEN` ni `NODE_AUTH_TOKEN` y
no ejecutes `npm publish` localmente. Una publicación interactiva con 2FA sigue siendo técnicamente
posible, pero queda fuera del procedimiento controlado de este proyecto.

## Condiciones previas

Antes de preparar una versión, confirma:

- `main` está limpia y sincronizada con `origin/main`;
- la nueva versión semántica nunca se ha publicado;
- `package.json`, `package-lock.json` y `PRODUCT_VERSION` en `src/index.ts` usarán la misma versión;
- el environment de GitHub sigue llamándose `npm`;
- npm Trusted Publishing todavía indica `cesar-html-mx/UXAudit`, `release.yml` y `npm`;
- `.github/workflows/release.yml` aún contiene `id-token: write` y ninguna variable de token;
- Node.js y npm satisfacen los engines declarados por el paquete.

Antes de la siguiente publicación también deben cerrarse o registrarse explícitamente estas dos
brechas:

- agregar un ruleset activo de tags de GitHub para `v*.*.*` que controle la creación, actualización
  y eliminación de tags de publicación; proteger `main` no protege por sí solo los tags;
- exigir aprobación para el environment `npm` de GitHub e impedir la autoaprobación cuando exista
  una persona revisora distinta. En un repositorio académico con un solo mantenedor y sin segunda
  persona revisora, registra esa excepción en lugar de afirmar que hubo aprobación independiente.

npm recomienda tanto protección de tags como aprobaciones de despliegue para Trusted Publishing.
Como postura futura todavía más fuerte, considera cambiar Trusted Publisher para permitir únicamente
`npm stage publish` y exigir aprobación interactiva con 2FA para cada artefacto preparado. Ese sería
un cambio de diseño separado, no un requisito para documentar el workflow actual.

## Preparar el cambio

Los comandos siguientes usan `0.1.1` solamente como ejemplo. Sustitúyela por la versión disponible
que se desea publicar.

```bash
(
  set -euo pipefail
  git switch main
  git pull --ff-only origin main
  git status --short --branch
  git switch -c release/v0.1.1
  npm ci
  npm version 0.1.1 --no-git-tag-version
)
```

Actualiza `PRODUCT_VERSION` en `src/index.ts` a `0.1.1` y después verifica las tres ubicaciones:

```bash
node --input-type=module -e "import packageManifest from './package.json' with { type: 'json' }; console.log(packageManifest.version)"
rg -n '"version": "0.1.1"' package.json package-lock.json
rg -n "PRODUCT_VERSION.*0.1.1" src/index.ts
```

Actualiza la documentación en inglés y español latinoamericano cuando cambie el comportamiento
observable. Después ejecuta la puerta de publicación:

```bash
npm run release:check
npm pack --dry-run
git diff --check
git status --short
```

Revisa el diff, crea un commit convencional y envía únicamente la rama de publicación:

```bash
(
  set -euo pipefail
  git add package.json package-lock.json src/index.ts
  git commit -m "chore(release): prepare v0.1.1"
  git push -u origin release/v0.1.1
)
```

Agrega antes del commit cualquier archivo de comportamiento, prueba o documentación que corresponda
legítimamente a esa versión. El ejemplo de tres archivos para `git add` representa únicamente el
caso mínimo de cambio de versión.

## Pull request y fusión

Crea un pull request desde `release/v0.1.1` hacia `main`. No omitas:

- Product Quality en Ubuntu, Windows y macOS;
- CodeQL;
- Dependency Review;
- el requisito de rama actualizada;
- la protección de conversaciones sin resolver.

Usa el método de fusión que conserva historial lineal. Después de integrar el pull request,
sincroniza localmente y repite la puerta completa desde el commit exacto de `main` que se etiquetará:

```bash
(
  set -euo pipefail
  git switch main
  git pull --ff-only origin main
  git status --short --branch
  npm ci
  npm run release:check
)
```

## Crear y enviar el tag de publicación

Confirma de nuevo que la versión del paquete es `0.1.1`. Verifica que el ruleset de tags esté activo
o registra la excepción aprobada de mantenedor único antes de continuar. Después crea un único tag
anotado:

```bash
(
  set -euo pipefail
  RELEASE_VERSION=0.1.1
  RELEASE_TAG="v${RELEASE_VERSION}"

  if git rev-parse --verify --quiet "refs/tags/${RELEASE_TAG}" >/dev/null; then
    printf 'Refusing to continue: local tag %s already exists.\n' "$RELEASE_TAG" >&2
    exit 1
  fi

  REMOTE_TAG_MATCHES=$(git ls-remote --tags origin "refs/tags/${RELEASE_TAG}")
  if [[ -n "$REMOTE_TAG_MATCHES" ]]; then
    printf 'Refusing to continue: remote tag %s already exists.\n' "$RELEASE_TAG" >&2
    exit 1
  fi

  git tag -a "$RELEASE_TAG" -m "Release ${RELEASE_TAG}"
  git show --no-patch --decorate "$RELEASE_TAG"
  git push origin "refs/tags/${RELEASE_TAG}"
)
```

Enviar el tag activa la publicación. No invoques por tu cuenta la publicación npm.

## Verificar la publicación OIDC

Abre la ejecución `Publish npm package` activada por el tag y verifica:

1. la fuente del workflow es el commit etiquetado;
2. `Validate tag and package version` termina correctamente;
3. `Require release commit on main` termina correctamente;
4. `Run release quality gate` termina correctamente;
5. `Publish through npm trusted publishing` termina correctamente;
6. la ejecución no solicita un secret `NPM_TOKEN`;
7. el registro contiene exactamente la nueva versión y el dist-tag previsto;
8. las attestations públicas vinculan el digest con el tag, workflow, commit y ejecución.

Cuando exista la entrada del registro, verifícala desde un consumidor limpio:

```bash
(
  set -euo pipefail
  npm view @cesar-html-mx/uxaudit@0.1.1 version dist.integrity
  UXAUDIT_SOURCE_ROOT=$(git rev-parse --show-toplevel)
  UXAUDIT_CONSUMER_PARENT=$(mktemp -d)

  case "$UXAUDIT_CONSUMER_PARENT" in
    "$UXAUDIT_SOURCE_ROOT" | "$UXAUDIT_SOURCE_ROOT"/*)
      printf 'Refusing to scaffold inside UXAudit: %s\n' "$UXAUDIT_CONSUMER_PARENT" >&2
      exit 1
      ;;
  esac

  printf 'Consumer evidence directory: %s\n' "$UXAUDIT_CONSUMER_PARENT"
  cd -- "$UXAUDIT_CONSUMER_PARENT"
  npm create vite@9.1.2 uxaudit-release-consumer -- --template react-ts
  cd -- uxaudit-release-consumer
  npm install
  npm install --save-dev @cesar-html-mx/uxaudit@0.1.1
  npm exec --offline -- ux-audit --version
  npm exec --offline -- ux-audit scan .
  npm run build
)
```

Registra el directorio temporal y las rutas de evidencia; después mueve ese consumidor exacto a la
papelera cuando hayas conservado el lockfile saneado, las salidas y los informes necesarios para
reproducibilidad.

La primera versión legítima posterior a `0.1.0` es especialmente importante: su ejecución exitosa
será la primera prueba operativa del recorrido actual Trusted Publishing/OIDC. Agrega esa ejecución
y su attestation a este registro académico o a su sucesor.

## Manejo de fallos

### Fallo antes del tag

Corrige el problema en la rama de publicación, repite las comprobaciones obligatorias y fusiona
mediante otro commit revisado. Ningún estado de npm habrá cambiado.

### Fallo después de enviar el tag

Primero determina la verdad del registro; no deduzcas el estado de publicación únicamente por la
conclusión del workflow:

```bash
npm view @cesar-html-mx/uxaudit@0.1.1 version dist.integrity --json
```

Revisa también el endpoint público de attestations para esa versión exacta. Si la versión existe,
npm aceptó la publicación aunque el job fallara después o perdiera su respuesta. Trátala como
publicada, conserva la evidencia del fallo y sigue el procedimiento de versión inmutable indicado
abajo.

Si la versión no existe:

- ante un fallo transitorio de plataforma o una corrección limitada a la configuración privada de
  Trusted Publisher, vuelve a ejecutar la misma ejecución de GitHub Actions. Confirma que conserva
  el mismo tag, ref y commit;
- si deben cambiar el artefacto o el workflow etiquetado, corrige mediante pull request, elige otra
  versión disponible y crea un tag nuevo.

Nunca muevas por fuerza un tag público hacia otro código. Una versión omitida es evidencia más segura
que un historial de publicación mutable.

Ante un fallo de autenticación OIDC, revisa:

- propietario, repositorio, nombre del workflow y environment exactos en npm Trusted Publisher;
- `permissions: id-token: write`;
- `environment: npm` en el job;
- versión compatible de npm;
- tag y ascendencia en `main`;
- cambios en la política de acceso o relación del publicador.

No resuelvas un fallo de configuración OIDC restaurando un token de larga duración.

### Fallo después de publicar

Las versiones npm son inmutables. No sobrescribas, reutilices ni muevas la versión publicada. Corrige
el problema en una nueva versión patch o en la versión semántica que corresponda. Si es necesario,
marca la versión afectada como obsoleta con un mensaje claro después de revisar la política npm.

## Evidencia que debe conservar cada versión

- URL del pull request y commit de fusión;
- URLs de comprobaciones obligatorias exitosas;
- objeto del tag anotado y commit destino;
- URLs de la ejecución y job de publicación;
- marca de tiempo de la versión en npm, dist-tag, integridad y URL del tarball;
- URLs de attestations de publicación y SLSA;
- resumen de instalación, versión, análisis y compilación en un consumidor limpio;
- cualquier fallo, diagnóstico, corrección y nueva ejecución;
- confirmación explícita de que no se introdujo un token reutilizable de publicación npm.

Orientación vigente de las plataformas:

- [Trusted Publishing y prácticas de seguridad de npm](https://docs.npmjs.com/trusted-publishers/)
- [Publicación preparada de npm](https://docs.npmjs.com/cli/v11/commands/npm-stage/)
- [Rulesets de tags en GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)
- [Environments de despliegue en GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
