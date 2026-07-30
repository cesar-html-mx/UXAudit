import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {
  createScanProject,
  scanProject as defaultScanProject,
} from '../dist/application/scan-project.js';
import { runCli } from '../dist/cli/run-cli.js';
import { classifySourceCandidates } from '../dist/project/classification/classify-source-candidates.js';
import {
  DEFAULT_DISCOVERY_CONFIGURATION,
  SYMLINK_POLICIES,
} from '../dist/project/discovery/discovery-config.js';
import { discoverProjectFiles } from '../dist/project/discovery/discover-project.js';
import { buildFileInventory } from '../dist/project/inventory/build-file-inventory.js';
import { toProjectRelativePath } from '../dist/project/project-paths.js';
import { validateProjectPath } from '../dist/project/validate-project-path.js';

const rootDirectory = process.cwd();
const expectedPath = path.join(rootDirectory, 'tests', 'fixtures', 'discovery', 'expected.json');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputDirectory =
  outputIndex >= 0 && args[outputIndex + 1] ? path.resolve(args[outputIndex + 1]) : undefined;
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'uxaudit-discovery-scenario-'));
const projectRoot = path.join(temporaryRoot, 'project');
const externalRoot = path.join(temporaryRoot, 'external');
const sentinelPath = path.join(projectRoot, 'TARGET_CODE_EXECUTED');
const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (content) => `sha256:${createHash('sha256').update(content).digest('hex')}`;

const fixture = {
  excludedFiles: [
    '.cache/cache.js',
    'dist/bundle.js',
    'node_modules/dependency/index.js',
    'vite.config.ts',
  ],
  files: [
    'README.md',
    'package.json',
    'src/App.TSX',
    'src/button.config.ts',
    'src/helper.ts',
    'src/legacy.js',
    'src/nested/View.JSX',
    'src/shared/Duplicate.tsx',
    'src/styles.css',
    'src/types.d.ts',
  ],
  links: [
    { path: 'alias', target: 'src/shared' },
    { path: 'cycle', target: '.' },
    { path: 'dependency-alias', target: 'node_modules/dependency' },
    { path: 'outside-link', target: '<OUTSIDE_ROOT>' },
  ],
  targetExecutionSentinel: 'TARGET_CODE_EXECUTED',
};

const createControlledProject = async () => {
  await Promise.all([
    mkdir(path.join(projectRoot, '.cache'), { recursive: true }),
    mkdir(path.join(projectRoot, 'dist'), { recursive: true }),
    mkdir(path.join(projectRoot, 'node_modules', 'dependency'), {
      recursive: true,
    }),
    mkdir(path.join(projectRoot, 'src', 'nested'), { recursive: true }),
    mkdir(path.join(projectRoot, 'src', 'shared'), { recursive: true }),
    mkdir(externalRoot, { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(projectRoot, 'README.md'), '# Discovery fixture\n', 'utf8'),
    writeFile(
      path.join(projectRoot, 'package.json'),
      `${JSON.stringify({
        scripts: {
          sentinel: "node -e \"require('node:fs').writeFileSync('TARGET_CODE_EXECUTED', '')\"",
        },
      })}\n`,
      'utf8',
    ),
    writeFile(path.join(projectRoot, '.cache', 'cache.js'), 'generated();\n', 'utf8'),
    writeFile(path.join(projectRoot, 'dist', 'bundle.js'), 'generated();\n', 'utf8'),
    writeFile(
      path.join(projectRoot, 'node_modules', 'dependency', 'index.js'),
      'dependency();\n',
      'utf8',
    ),
    writeFile(path.join(projectRoot, 'src', 'App.TSX'), 'export const App = () => null;\n'),
    writeFile(path.join(projectRoot, 'src', 'button.config.ts'), 'export const config = {};\n'),
    writeFile(path.join(projectRoot, 'src', 'helper.ts'), 'export const helper = true;\n'),
    writeFile(
      path.join(projectRoot, 'src', 'legacy.js'),
      "require('node:fs').writeFileSync(require('node:path').join(__dirname, '..', 'TARGET_CODE_EXECUTED'), '');\n",
    ),
    writeFile(
      path.join(projectRoot, 'src', 'nested', 'View.JSX'),
      'export const View = () => null;\n',
    ),
    writeFile(
      path.join(projectRoot, 'src', 'shared', 'Duplicate.tsx'),
      'export const Duplicate = () => null;\n',
    ),
    writeFile(path.join(projectRoot, 'src', 'styles.css'), '.root {}\n'),
    writeFile(path.join(projectRoot, 'src', 'types.d.ts'), 'export type Value = string;\n'),
    writeFile(path.join(projectRoot, 'vite.config.ts'), 'export default {};\n'),
    writeFile(path.join(externalRoot, 'outside.tsx'), 'export const Outside = () => null;\n'),
  ]);

  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  await Promise.all([
    symlink(path.join(projectRoot, 'src', 'shared'), path.join(projectRoot, 'alias'), linkType),
    symlink(projectRoot, path.join(projectRoot, 'cycle'), linkType),
    symlink(
      path.join(projectRoot, 'node_modules', 'dependency'),
      path.join(projectRoot, 'dependency-alias'),
      linkType,
    ),
    symlink(externalRoot, path.join(projectRoot, 'outside-link'), linkType),
  ]);
};

const createScanner = (symlinkPolicy) =>
  createScanProject({
    buildInventory: buildFileInventory,
    classifyCandidates: classifySourceCandidates,
    discoverFiles: (root) =>
      discoverProjectFiles(root, {
        ...DEFAULT_DISCOVERY_CONFIGURATION,
        symlinkPolicy,
      }),
    validatePath: validateProjectPath,
  });

const projectResult = (result) => ({
  candidates: result.sourceCandidates.map(({ extension, relativePath, sourceKind }) => ({
    extension,
    relativePath,
    sourceKind,
  })),
  discovered: result.discovery.files.map(({ absolutePath, observedPath, viaSymlink }) => ({
    canonicalPath: toProjectRelativePath(result.projectPath, absolutePath),
    observedPath: toProjectRelativePath(result.projectPath, observedPath),
    viaSymlink,
  })),
  exclusions: result.discovery.exclusions,
  inventory: result.inventory.entries.map(({ extension, kind, relativePath }) => ({
    extension,
    kind,
    relativePath,
  })),
  issues: result.discovery.issues,
  summary: result.summary,
});

const runScenario = async () => {
  const defaultScanner = createScanner(SYMLINK_POLICIES.skip);
  const followScanner = createScanner(SYMLINK_POLICIES.followWithinRoot);
  const canonicalProjectRoot = await realpath(projectRoot);
  const defaultResult = await defaultScanner({
    projectPath: canonicalProjectRoot,
  });
  const followResult = await followScanner({
    projectPath: canonicalProjectRoot,
  });

  return {
    fixture,
    runs: {
      default: projectResult(defaultResult),
      followWithinRoot: projectResult(followResult),
    },
    targetCodeExecuted: await access(sentinelPath)
      .then(() => true)
      .catch(() => false),
  };
};

const captureCliSummary = async () => {
  const stderr = [];
  const stdout = [];
  const canonicalProjectRoot = await realpath(projectRoot);
  const exitCode = await runCli(['scan', projectRoot], {
    io: {
      writeErr: (value) => stderr.push(value),
      writeOut: (value) => stdout.push(value),
    },
    scanProject: defaultScanProject,
  });
  const normalizedStdout = stdout.join('').replace(canonicalProjectRoot, '<PROJECT_ROOT>');
  const expectedStdout =
    'Project path validated: <PROJECT_ROOT>\n' +
    'Discovery summary: discovered=10 inventory=10 candidates=5 exclusions=8 issues=0\n';

  assert.equal(exitCode, 0);
  assert.equal(stderr.join(''), '');
  assert.equal(normalizedStdout, expectedStdout);

  return {
    exitCode,
    stderr: '(empty)',
    stdout: normalizedStdout,
  };
};

try {
  await createControlledProject();
  const first = await runScenario();
  const second = await runScenario();
  const firstJson = toJson(first);
  const secondJson = toJson(second);
  const expectedJson = await readFile(expectedPath, 'utf8');
  const cliSummary = await captureCliSummary();

  assert.equal(firstJson, secondJson, 'Repeated scenario output must be byte-identical');
  assert.equal(firstJson, expectedJson, 'Scenario output must match the reviewed expectation');
  assert.equal(first.targetCodeExecuted, false, 'Target code must never execute during scanning');
  await assert.rejects(
    access(sentinelPath),
    undefined,
    'Target code must never execute through the compiled CLI',
  );

  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    const inventoryProjection = (value) => ({
      default: value.runs.default.inventory,
      followWithinRoot: value.runs.followWithinRoot.inventory,
    });
    const exclusionProjection = {
      default: first.runs.default.exclusions,
      followWithinRoot: first.runs.followWithinRoot.exclusions,
    };
    const symlinkPaths = new Set(fixture.links.map((link) => link.path));
    const symlinkProjection = {
      default: first.runs.default.exclusions.filter(({ relativePath }) =>
        symlinkPaths.has(relativePath),
      ),
      followedFiles: first.runs.followWithinRoot.discovered.filter(({ viaSymlink }) => viaSymlink),
      followWithinRoot: first.runs.followWithinRoot.exclusions.filter(
        ({ relativePath }) => symlinkPaths.has(relativePath) || relativePath === 'src/shared',
      ),
    };
    const comparison = {
      byteIdentical: firstJson === secondJson,
      run1: digest(firstJson),
      run2: digest(secondJson),
    };

    await Promise.all([
      writeFile(path.join(outputDirectory, 'cli-summary.json'), toJson(cliSummary), 'utf8'),
      writeFile(
        path.join(outputDirectory, 'deterministic-comparison.json'),
        toJson(comparison),
        'utf8',
      ),
      writeFile(path.join(outputDirectory, 'deterministic-run-1.json'), firstJson, 'utf8'),
      writeFile(path.join(outputDirectory, 'deterministic-run-2.json'), secondJson, 'utf8'),
      writeFile(
        path.join(outputDirectory, 'excluded-paths.json'),
        toJson(exclusionProjection),
        'utf8',
      ),
      writeFile(
        path.join(outputDirectory, 'inventory-actual.json'),
        toJson(inventoryProjection(first)),
        'utf8',
      ),
      writeFile(
        path.join(outputDirectory, 'inventory-expected.json'),
        toJson(inventoryProjection(JSON.parse(expectedJson))),
        'utf8',
      ),
      writeFile(path.join(outputDirectory, 'scenario-actual.json'), firstJson, 'utf8'),
      writeFile(path.join(outputDirectory, 'scenario-expected.json'), expectedJson, 'utf8'),
      writeFile(
        path.join(outputDirectory, 'symlink-behavior.json'),
        toJson(symlinkProjection),
        'utf8',
      ),
    ]);
  }

  console.log('UXAudit controlled discovery scenario: PASS');
  console.log('Inventory: 10 canonical entries; source candidates: 5');
  console.log('Determinism: byte-identical across two runs');
  console.log('Target project code executed: no');
} finally {
  await rm(temporaryRoot, { force: true, recursive: true });
}
