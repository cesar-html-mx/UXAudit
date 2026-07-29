import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, fieldName: string): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) {
    throw new TypeError(`package.json field "${fieldName}" must be an object.`);
  }

  return value;
};

describe('parser dependency contract', () => {
  it('pins the approved Babel runtime packages and Node.js 24 engine', async () => {
    const manifestContent = await readFile(new URL('../../package.json', import.meta.url), 'utf8');
    const manifest: unknown = JSON.parse(manifestContent);
    const packageManifest = requireRecord(manifest, 'root');
    const dependencies = requireRecord(packageManifest['dependencies'], 'dependencies');
    const developmentDependencies = requireRecord(
      packageManifest['devDependencies'],
      'devDependencies',
    );
    const engines = requireRecord(packageManifest['engines'], 'engines');
    const babelDependencies = Object.fromEntries(
      Object.entries(dependencies).filter(([name]) => name.startsWith('@babel/')),
    );

    expect(babelDependencies).toEqual({
      '@babel/parser': '8.0.4',
      '@babel/traverse': '8.0.4',
      '@babel/types': '8.0.4',
    });
    expect(engines['node']).toBe('>=24.18.0 <25');
    expect(dependencies).not.toHaveProperty('@babel/core');
    expect(developmentDependencies).not.toHaveProperty('@babel/core');
  });
});
