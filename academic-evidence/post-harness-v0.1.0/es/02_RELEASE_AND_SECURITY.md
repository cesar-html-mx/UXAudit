**Español** | [English](../en/02_RELEASE_AND_SECURITY.md)

# Evidencia de publicación y seguridad

## Controles del repositorio

La API pública informa que `cesar-html-mx/UXAudit` es público y que `main` es su rama predeterminada.
El endpoint público de la rama informa que `main` está protegida y expone estas comprobaciones
obligatorias:

- `Node 24 / ubuntu-24.04`
- `Node 24 / windows-2025`
- `Node 24 / macos-15`
- `Analyze JavaScript and TypeScript`
- `Review dependency changes`

El endpoint detallado de protección requiere acceso administrativo autenticado. El mantenedor
confirmó por separado que los cambios requieren pull request, las ramas deben estar actualizadas antes
de fusionarse, las conversaciones deben resolverse, se exige historial lineal y no se permite omitir
la protección configurada. Esas afirmaciones detalladas son clase `C`, mientras que el estado
protegido y los nombres de checks son clase `A`.

El endpoint público de environments informa uno llamado `npm` con una política personalizada de
despliegue. Su endpoint público de políticas informa el patrón exacto `v*.*.*` con tipo `tag`; esta
es evidencia clase `A`. Al corte del registro, el endpoint del environment solo exponía la política
de ramas y tags, sin revisor obligatorio, mientras que el endpoint de rulesets devolvía una lista
vacía. Los nombres y valores de secrets no están disponibles mediante la API pública.

## Corrección multiplataforma

La primera ejecución Product Quality del pull request #11 falló en lugar de omitirse. Windows reveló
un supuesto sobre separadores de ruta en la prueba del manifiesto de validación del sistema. macOS
reveló que la detección de entrada del script no era estable mediante una ruta enlazada al
repositorio.

El commit `cf8e4d6` aceptó ambos separadores portables y usó `import.meta.main`, con una prueba de
regresión mediante ruta enlazada. La ejecución corregida aprobó en Ubuntu, Windows y macOS antes de
fusionar #11. Se conserva esta secuencia de fallo y corrección porque demuestra trabajo de
portabilidad basado en evidencia.

## Primera publicación npm

El tag anotado `v0.1.0` apunta al commit `6668d8f`, la fusión squash del pull request #11. El tag no
está firmado criptográficamente; este expediente no afirma lo contrario. GitHub presenta una página
del tag y archivos fuente automáticos, pero la API REST no informa un objeto GitHub Release creado
por el mantenedor.

La ejecución de publicación `30589077315`:

1. se activó al enviar `refs/tags/v0.1.0`;
2. validó que el tag coincidiera con `package.json`;
3. exigió que el commit etiquetado estuviera contenido en `main`;
4. instaló el lockfile y ejecutó `npm run release:check`;
5. publicó con acceso público y procedencia npm;
6. terminó con `success`.

El workflow almacenado en el tag `v0.1.0` todavía proporcionaba `NODE_AUTH_TOKEN` desde el secret
`NPM_TOKEN` del environment. Por tanto, la primera autenticación npm usó esa credencial de arranque.
El workflow demuestra la referencia al secret, pero no su valor ni el tipo, alcance o vencimiento del
token; el mantenedor confirmó por separado que era un token granular de npm de corta duración, un
hecho clase `C`. El permiso existente `id-token: write` permitió la procedencia; no debe presentarse
como autenticación Trusted Publishing para `0.1.0`.

## Artefacto publicado y procedencia

| Campo                      | Valor verificado                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Paquete                    | `@cesar-html-mx/uxaudit`                                                                                                           |
| Versión / dist-tag         | `0.1.0` / `latest`                                                                                                                 |
| Marca del registro         | `2026-07-30T23:01:38.023Z`                                                                                                         |
| Ejecutable                 | `ux-audit` → `dist/cli/index.js`                                                                                                   |
| Licencia                   | `MIT`                                                                                                                              |
| Entorno Node               | `>=24.18.0 <25`                                                                                                                    |
| Entorno npm                | `>=11.16.0 <12`                                                                                                                    |
| SHA-1                      | `58d2ccd0ef52434b1c37ab91cdf3a8982e368f9f`                                                                                         |
| Digest SHA-512 del subject | `bcdc2d28810d940557205bb25cffac6ce5e3a74ce7ae42e32b2670777ce3766a1bade9e2df518d972179b40ee4124e1fd68295a2f2fc49ab328848f075fd830d` |
| Predicado SLSA             | `https://slsa.dev/provenance/v1`                                                                                                   |
| Fuente de procedencia      | `refs/tags/v0.1.0`, `.github/workflows/release.yml`, commit `6668d8f`                                                              |
| Invocación de procedencia  | `https://github.com/cesar-html-mx/UXAudit/actions/runs/30589077315/attempts/1`                                                     |

El endpoint público de attestations devuelve tanto la constancia de publicación npm como procedencia
SLSA. El digest del subject SLSA coincide con los metadatos de integridad del tarball. El registro npm
también publica su propia firma del paquete; esa firma del registro es distinta del tag Git sin
firma.

## Migración a Trusted Publishing

Después de que existiera el paquete, el mantenedor configuró npm Trusted Publishing para:

| Configuración       | Valor            |
| ------------------- | ---------------- |
| Publisher           | `GitHub Actions` |
| Organización o user | `cesar-html-mx`  |
| Repositorio         | `UXAudit`        |
| Nombre del workflow | `release.yml`    |
| Environment         | `npm`            |
| Acción permitida    | `npm publish`    |

Estas configuraciones del backend son estado de plataforma confirmado por el mantenedor y pertenecen
a la clase `C`. Su configuración compatible en el repositorio sí es reproducible públicamente:

- `.github/workflows/release.yml` concede `id-token: write`;
- el job de publicación usa `environment: npm`;
- el job ejecuta
  `npm publish --access public --ignore-scripts --provenance --tag "$NPM_DIST_TAG"`;
- el workflow actual no contiene `NPM_TOKEN` ni `NODE_AUTH_TOKEN`;
- `tests/release-workflow.test.ts` impide reintroducir esos nombres y exige el permiso OIDC, el
  environment y el comando de publicación.

El pull request #12 aprobó Product Quality en los tres sistemas operativos, CodeQL y Dependency
Review antes de fusionarse.

## Retiro de credenciales y endurecimiento de acceso

Después de fusionar #12, el mantenedor confirmó estas acciones de plataforma:

1. se eliminó el secret `NPM_TOKEN` del environment de GitHub;
2. se revocó el token granular de npm de corta duración confirmado por el mantenedor y la cuenta npm
   mostró cero tokens de acceso;
3. la autenticación de dos factores siguió activa y obligatoria para acciones de escritura;
4. el acceso de publicación se cambió a
   `Require two-factor authentication and disallow bypass 2FA tokens (recommended)`;
5. la relación npm Trusted Publisher permaneció configurada.

El workflow público actual demuestra que no consume una credencial npm reutilizable de publicación.
No puede demostrar por sí solo la eliminación en almacenes de secrets ni la política de la cuenta
npm, por lo que esos controles permanecen como clase `C`.

## Postura de seguridad actual

- Los cambios normales usan ramas protegidas, pull requests y comprobaciones obligatorias de CI.
- El recorrido automatizado de publicación npm del repositorio está limitado a tags de versión que
  coinciden, el environment `npm`, el workflow de publicación y la identidad Trusted Publisher.
- El workflow actual no requiere una credencial reutilizable de escritura en npm.
- Este recorrido automatizado no es técnicamente exclusivo. npm documenta que la política
  seleccionada bloquea tokens granulares, pero todavía permite que un mantenedor publique de forma
  interactiva con 2FA.
- Proteger `main` no protege por sí mismo los tags de publicación. Al corte no se observó
  públicamente un ruleset para tags ni un revisor obligatorio del environment. Antes de la siguiente
  versión deben agregarse esos controles o registrarse la excepción explícita; npm recomienda
  protección de tags y aprobaciones de despliegue para Trusted Publishing.
- La siguiente versión legítima proporcionará la primera evidencia pública operativa de que la
  autenticación OIDC funciona de extremo a extremo.
- Este expediente no registra valores de secrets, tokens, códigos de recuperación ni credenciales.

La orientación vigente relevante está en la
[guía de seguridad de Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), el
[comportamiento 2FA de paquetes](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)
de npm y la
[documentación de protección de environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
de GitHub.
