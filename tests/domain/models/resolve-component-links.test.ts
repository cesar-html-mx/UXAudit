import { describe, expect, it } from 'vitest';

import {
  resolveComponentLinks,
  type ComponentLinkInputFile,
  type ComponentUseFact,
} from '../../../src/domain/models/resolve-component-links.js';

const importedUse = (
  jsxNodeId: string,
  moduleSpecifier: string,
  importedName: string,
): ComponentUseFact => ({
  importedName,
  jsxNodeId,
  kind: 'imported',
  moduleSpecifier,
});

const sourceFile = (
  filePath: string,
  componentUses: readonly ComponentUseFact[] = [],
): ComponentLinkInputFile => ({
  componentExports: [],
  componentUses,
  filePath,
});

const componentFile = (
  filePath: string,
  exportedName: string,
  componentId: string,
  componentUses: readonly ComponentUseFact[] = [],
): ComponentLinkInputFile => ({
  componentExports: [{ componentId, exportedName }],
  componentUses,
  filePath,
});

describe('resolveComponentLinks', () => {
  it('resolves default and normalized named alias imports', () => {
    const files = [
      sourceFile('src/App.tsx', [
        importedUse('jsx:src/App.tsx:10', './Button', 'default'),
        importedUse('jsx:src/App.tsx:20', './Card', 'Card'),
      ]),
      componentFile('src/Button.tsx', 'default', 'component:src/Button.tsx:0'),
      componentFile('src/Card.tsx', 'Card', 'component:src/Card.tsx:0'),
    ];

    expect(resolveComponentLinks(files)).toEqual([
      {
        jsxNodeId: 'jsx:src/App.tsx:10',
        targetComponentId: 'component:src/Button.tsx:0',
      },
      {
        jsxNodeId: 'jsx:src/App.tsx:20',
        targetComponentId: 'component:src/Card.tsx:0',
      },
    ]);
  });

  it('resolves parent-relative, explicit-extension, and index module paths', () => {
    const files = [
      sourceFile('src/pages/Home.tsx', [
        importedUse('jsx:src/pages/Home.tsx:10', '../components/Hero', 'Hero'),
        importedUse('jsx:src/pages/Home.tsx:20', '../components/Logo.jsx', 'default'),
        importedUse('jsx:src/pages/Home.tsx:30', '../components/Card', 'Card'),
      ]),
      componentFile('src/components/Hero.tsx', 'Hero', 'component:src/components/Hero.tsx:0'),
      componentFile('src/components/Logo.jsx', 'default', 'component:src/components/Logo.jsx:0'),
      componentFile(
        'src/components/Card/index.tsx',
        'Card',
        'component:src/components/Card/index.tsx:0',
      ),
    ];

    expect(resolveComponentLinks(files)).toEqual([
      {
        jsxNodeId: 'jsx:src/pages/Home.tsx:10',
        targetComponentId: 'component:src/components/Hero.tsx:0',
      },
      {
        jsxNodeId: 'jsx:src/pages/Home.tsx:20',
        targetComponentId: 'component:src/components/Logo.jsx:0',
      },
      {
        jsxNodeId: 'jsx:src/pages/Home.tsx:30',
        targetComponentId: 'component:src/components/Card/index.tsx:0',
      },
    ]);
  });

  it('keeps missing modules and missing or duplicate exports unknown', () => {
    const duplicateExportFile: ComponentLinkInputFile = {
      componentExports: [
        { componentId: 'component:src/Duplicate.tsx:0', exportedName: 'Duplicate' },
        { componentId: 'component:src/Duplicate.tsx:100', exportedName: 'Duplicate' },
      ],
      componentUses: [],
      filePath: 'src/Duplicate.tsx',
    };
    const files = [
      sourceFile('src/App.tsx', [
        importedUse('jsx:src/App.tsx:10', './Missing', 'default'),
        importedUse('jsx:src/App.tsx:20', './Button', 'MissingName'),
        importedUse('jsx:src/App.tsx:30', './Duplicate', 'Duplicate'),
      ]),
      componentFile('src/Button.tsx', 'default', 'component:src/Button.tsx:0'),
      duplicateExportFile,
    ];

    expect(resolveComponentLinks(files)).toEqual([]);
  });

  it.each([
    ['package import', '@scope/design-system'],
    ['bare package import', 'react'],
    ['root escape', '../../outside/Button'],
    ['backslash', '.\\Button'],
    ['NUL', './Button\0hidden'],
    ['unsupported extension', './Button.css'],
  ])('rejects a conservative %s specifier', (_caseName, moduleSpecifier) => {
    const files = [
      sourceFile('src/App.tsx', [importedUse('jsx:src/App.tsx:10', moduleSpecifier, 'default')]),
      componentFile('src/Button.tsx', 'default', 'component:src/Button.tsx:0'),
    ];

    expect(resolveComponentLinks(files)).toEqual([]);
  });

  it('leaves extensionless resolution unknown when more than one candidate file exists', () => {
    const files = [
      sourceFile('src/App.tsx', [importedUse('jsx:src/App.tsx:10', './Button', 'default')]),
      componentFile('src/Button.ts', 'default', 'component:src/Button.ts:0'),
      componentFile('src/Button.tsx', 'default', 'component:src/Button.tsx:0'),
    ];

    expect(resolveComponentLinks(files)).toEqual([]);
  });

  it('represents cycles as ordinary links without recursive traversal', () => {
    const files = [
      componentFile('src/A.tsx', 'default', 'component:src/A.tsx:0', [
        importedUse('jsx:src/A.tsx:20', './B', 'default'),
      ]),
      componentFile('src/B.tsx', 'default', 'component:src/B.tsx:0', [
        importedUse('jsx:src/B.tsx:20', './A', 'default'),
      ]),
    ];

    expect(resolveComponentLinks(files)).toEqual([
      {
        jsxNodeId: 'jsx:src/A.tsx:20',
        targetComponentId: 'component:src/B.tsx:0',
      },
      {
        jsxNodeId: 'jsx:src/B.tsx:20',
        targetComponentId: 'component:src/A.tsx:0',
      },
    ]);
  });

  it('ignores non-imported uses and produces the same order for inverted normalized input', () => {
    const localUse: ComponentUseFact = {
      jsxNodeId: 'jsx:src/App.tsx:5',
      kind: 'local',
      targetComponentId: 'component:src/App.tsx:0',
    };
    const app = sourceFile('src/App.tsx', [
      importedUse('jsx:src/App.tsx:300', './Card', 'Card'),
      localUse,
      importedUse('jsx:src/App.tsx:20', './Button', 'default'),
    ]);
    const button = componentFile('src/Button.tsx', 'default', 'component:src/Button.tsx:0');
    const card = componentFile('src/Card.tsx', 'Card', 'component:src/Card.tsx:0');
    const forward = resolveComponentLinks([app, button, card]);
    const reverse = resolveComponentLinks([
      card,
      button,
      { ...app, componentUses: [...app.componentUses].reverse() },
    ]);

    expect(reverse).toEqual(forward);
    expect(forward.map((link) => link.jsxNodeId)).toEqual([
      'jsx:src/App.tsx:20',
      'jsx:src/App.tsx:300',
    ]);
  });
});
