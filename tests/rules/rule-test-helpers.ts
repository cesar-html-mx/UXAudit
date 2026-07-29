import type { AnalysisModel } from '../../src/domain/models/analysis-model.js';
import type { SourceLocation } from '../../src/domain/models/source-location.js';
import {
  RULE_SEVERITIES,
  RULE_STATUSES,
  type Rule,
  type RuleCategory,
  type RuleFinding,
} from '../../src/domain/rules/rule.js';

export const fileLocation: SourceLocation = {
  end: { column: 0, line: 8, offset: 180 },
  filePath: 'src/App.tsx',
  start: { column: 0, line: 1, offset: 0 },
};

export const firstElementLocation: SourceLocation = {
  end: { column: 20, line: 3, offset: 70 },
  filePath: 'src/App.tsx',
  start: { column: 2, line: 3, offset: 52 },
};

export const secondElementLocation: SourceLocation = {
  end: { column: 22, line: 5, offset: 130 },
  filePath: 'src/App.tsx',
  start: { column: 2, line: 5, offset: 110 },
};

export const styleAttributeLocation: SourceLocation = {
  end: { column: 19, line: 5, offset: 127 },
  filePath: 'src/App.tsx',
  start: { column: 7, line: 5, offset: 115 },
};

export const fontSizeLocation: SourceLocation = {
  end: { column: 18, line: 5, offset: 126 },
  filePath: 'src/App.tsx',
  start: { column: 10, line: 5, offset: 118 },
};

export const model: AnalysisModel = {
  components: [],
  files: [
    {
      componentIds: [],
      filePath: 'src/App.tsx',
      jsxNodeIds: ['jsx:src/App.tsx:52', 'jsx:src/App.tsx:110'],
      language: 'typescript',
      location: fileLocation,
      usesJsx: true,
    },
  ],
  jsxNodes: [
    {
      attributes: [],
      childNodeIds: [],
      componentId: null,
      elementKind: 'intrinsic',
      id: 'jsx:src/App.tsx:52',
      kind: 'element',
      location: firstElementLocation,
      name: 'img',
      parentNodeId: null,
      textContent: { confidence: 'exact', value: '' },
    },
    {
      attributes: [
        {
          kind: 'named',
          location: styleAttributeLocation,
          name: 'style',
          value: {
            confidence: 'exact',
            hasUnknownProperties: false,
            kind: 'object',
            properties: [
              {
                location: fontSizeLocation,
                name: 'fontSize',
                value: {
                  confidence: 'exact',
                  kind: 'literal',
                  value: 11,
                },
              },
            ],
          },
        },
      ],
      childNodeIds: [],
      componentId: null,
      elementKind: 'intrinsic',
      id: 'jsx:src/App.tsx:110',
      kind: 'element',
      location: secondElementLocation,
      name: 'span',
      parentNodeId: null,
      textContent: { confidence: 'exact', value: 'Small' },
    },
  ],
};

interface CreateTestRuleOptions {
  readonly category?: RuleCategory;
  readonly evaluate?: Rule['evaluate'];
  readonly findings?: readonly RuleFinding[];
  readonly id?: string;
}

export const createTestRule = ({
  category = 'accessibility',
  evaluate,
  findings = [],
  id = 'accessibility/test-rule',
}: CreateTestRuleOptions = {}): Rule => ({
  evaluate: evaluate ?? (() => findings),
  metadata: {
    category,
    defaultSeverity: RULE_SEVERITIES.medium,
    explanation: 'The static pattern needs review.',
    id,
    limitations: ['Dynamic runtime behavior is not evaluated.'],
    recommendation: 'Review the source and use an explicit accessible pattern.',
    reference: null,
    status: RULE_STATUSES.stable,
    title: 'Test rule',
  },
});
