# Security Execution Checklist

- [ ] Project root canonicalization tested.
- [ ] Missing/inaccessible path behavior tested.
- [ ] Symlink loop tested.
- [ ] Symlink outside root tested against policy.
- [ ] Target project code and package scripts are never executed.
- [ ] Hostile filename/source strings are escaped in HTML.
- [ ] JSON remains valid with hostile strings.
- [ ] Output overwrite/path behavior tested.
- [ ] Malformed source isolation tested.
- [ ] Large/deep project behavior measured.
- [ ] Dependency lockfile committed.
- [ ] `npm audit` or equivalent result recorded.
- [ ] CodeQL result recorded when available.
- [ ] No secrets or telemetry introduced.
