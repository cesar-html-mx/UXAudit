# Risk Register

| ID | Risk | Impact | Planned control |
|---|---|---:|---|
| R-001 | False positives caused by dynamic JSX values | High | Narrow rule conditions, explicit confidence, negative fixtures, document limits |
| R-002 | False negatives from component abstractions | High | Preserve source locations and component relationships; record unsupported cases |
| R-003 | Parser incompatibility with valid syntax | High | Configured Babel plugins, parser fixtures, per-file error isolation |
| R-004 | Symlink loops or traversal outside project | High | Canonical paths, visited realpaths, configurable symlink policy |
| R-005 | Malicious source text injected into HTML report | High | Escape all project-controlled values and test XSS payloads |
| R-006 | Large projects consume excessive memory/time | Medium | Exclusions, single parse, deterministic inventory, benchmark fixtures |
| R-007 | Rule errors terminate the entire audit | Medium | Isolated evaluation and normalized execution errors |
| R-008 | Agent changes architecture while solving a local task | High | Active ExecPlan, contracts, traceability, architecture gate |
| R-009 | Documentation and state drift | Medium | Machine state, integrity script, required closure updates |
| R-010 | Dependency or supply-chain vulnerability | High | Lockfile, Dependabot, audit evidence, minimal dependencies |
| R-011 | UX rule claims exceed static-analysis capability | High | Stable/experimental/deferred status and evidence-based promotion |
| R-012 | GitHub push or PR automation unavailable | Low | Local commits, explicit blocker record, no false success claims |
