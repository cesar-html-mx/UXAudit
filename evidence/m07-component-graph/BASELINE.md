# M07 baseline and safeguards

- Evidence captured: 2026-07-31T10:41:35-06:00.
- Go/no-go deadline: 2026-07-31T15:38:04-06:00.
- Milestone branch: `milestone/m07-component-graph`.
- Product implementation commit reviewed by T05: `ab35da3456da32eb42f3e9f9cda34bb2dbfb4cec`.
- Public `main` baseline: `de540f0ec3d3a7d198905eccd06eae46bc3ac3e7`.
- Pre-v0.2 safeguard tag: `safeguard/pre-v0.2-main-20260731` at the same `main` baseline.
- Historical harness safeguard tag: `safeguard/post-harness-evidence-20260731` at
  `448dae9f341c48fed3019dbb72e5314b9ca5f506`.
- Published v0.1 tag: `v0.1.0` at `ccb13bae1ea479a92221cf6ccb5c31bf8fc187a6`.
- Runtime: Node.js 24.18.0 and npm 11.16.0.
- Host: Linux x86_64, kernel 6.8.0-134-generic.

`main` is an ancestor of the milestone branch and still resolves to the recorded baseline. M07 made
no merge, release, tag rewrite, npm publication, or source modification in the sibling
`uxaudit-demo-mercado-raiz` project. The internal harness exists only on the milestone branch.

The pre-M07 baseline gate passed 621 tests. M07 was therefore recoverable by discarding this branch
and returning to the recorded `main` commit or safeguard tag.
