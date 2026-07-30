# Security Execution Checklist

[Español](SECURITY_CHECKLIST.es.md) | **English**

- [x] Project root canonicalization tested.
- [x] Missing and real inaccessible-path behavior tested on Linux.
- [x] Symlink loop created and excluded under the default policy.
- [x] Symlink outside root created and excluded under the default policy.
- [x] Target project code and package scripts were not executed.
- [x] Hostile filename/source content remained inert in structurally validated escaped HTML.
- [x] JSON remained valid with hostile strings.
- [x] Output escape, symlink authorization, permission denial, and overwrite behavior tested.
- [x] Malformed source isolation tested.
- [x] A source below 32 nested directories and five complete runs of the generated 240-file project
      measured without a timing threshold.
- [x] Dependency lockfile committed and strict install policy inspected.
- [x] `npm audit --audit-level=moderate --json` recorded zero vulnerabilities.
- [x] CodeQL status recorded as unexecuted because no hosted result was retrieved.
- [x] No secrets, telemetry, production service, or database introduced.

HTML checks assert escaping, CSP, and absence of executable/resource-bearing structure; they are not
a browser exploit execution. The maximum observed Linux child `VmRSS` was sampled every 5 ms through
`/proc` and is not claimed as an exact lifetime peak. The retained M06 evidence package captures
volatile timing and memory observations.
