# Evidence Index

Evidence is organized by milestone and test concern. Never record a successful result that was not
actually executed.

| Milestone | Evidence path                         | Status                                                                                           |
| --------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| M01       | `evidence/m01-bootstrap/`             | Complete: source digest/manifest, clean install, gate, 100% coverage, six smokes, harness, audit |
| M02       | `evidence/m02-discovery/`             | Complete: 66 tests/no skips, coverage, six smokes, deterministic scenario, audit, SHA-256 report |
| M03       | `evidence/m03-parsing/`               | Complete: 208 tests, coverage, six smokes, four-kind scenario, audit, SHA-256 report             |
| M04       | `evidence/m04-rules/`                 | Complete: 344 tests, coverage, 8-rule scenario, isolation, audit, SHA-256 report                 |
| M05       | `evidence/m05-reporting/`             | Complete: 512 tests, 3 reporters, config/XSS/write scenario, audit, SHA-256 report               |
| M06       | `evidence/m06-validation/`            | Complete: 619 tests, controlled/accuracy/robustness/usability evidence, audit, SHA-256 report    |
| Usability | `evidence/m06-validation/usability/`  | Complete expert review; participant testing and SUS explicitly unexecuted/N/A                    |
| Security  | `evidence/m06-validation/robustness/` | Complete local robustness/security checks; hosted CodeQL explicitly unexecuted                   |

Reusable unexecuted-test templates remain under `evidence/usability/` and `evidence/security/`;
they are not represented as executed results.
