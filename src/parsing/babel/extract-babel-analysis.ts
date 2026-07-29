import type { ParseResult } from '@babel/parser';
import traverse, { type NodePath, type Visitor } from '@babel/traverse';
import * as t from '@babel/types';

import { createComponentId, createJsxNodeId } from '../../domain/models/analysis-model-ids.js';
import {
  ANALYZED_SOURCE_LANGUAGES,
  COMPONENT_KINDS,
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalyzedComponent,
  type AnalyzedSourceFile,
  type ComponentKind,
  type JsxAttribute,
  type JsxElement,
  type JsxFragment,
  type JsxNode,
} from '../../domain/models/analysis-model.js';
import {
  JSX_VALUE_CONFIDENCE,
  type JsxAttributeValue,
  type JsxObjectProperty,
  type JsxTextContent,
} from '../../domain/models/jsx-value.js';
import type { SourceLocation, SourcePosition } from '../../domain/models/source-location.js';
import { SOURCE_KINDS, type SourceKind } from '../../project/classification/source-candidate.js';
import { compareOrdinal } from '../../project/project-paths.js';
import {
  SOURCE_PARSER_ERROR_CODES,
  SOURCE_PARSER_ERROR_STAGES,
  type SourceParserError,
} from '../parser-contracts.js';

export const DEFAULT_EXTRACTION_NODE_LIMIT = 100_000;
export const STATIC_TEXT_CODE_UNIT_LIMIT = 256;

const MAX_OBJECT_DEPTH = 20;
const componentNamePattern = /^[A-Z][A-Za-z0-9_$]*$/u;

export interface ExtractBabelAnalysisRequest {
  readonly ast: ParseResult;
  readonly filePath: string;
  readonly maxNodes?: number;
  readonly sourceKind: SourceKind;
}

export interface ExtractBabelAnalysisSuccess {
  readonly analyzedFile: AnalyzedSourceFile;
  readonly success: true;
}

export interface ExtractBabelAnalysisFailure {
  readonly error: SourceParserError;
  readonly success: false;
}

export type ExtractBabelAnalysisResult = ExtractBabelAnalysisFailure | ExtractBabelAnalysisSuccess;

interface ComponentCandidate {
  readonly kind: ComponentKind;
  readonly locationNode: t.Node;
  readonly name: null | string;
}

interface TextState {
  readonly hasDynamicContent: boolean;
  readonly rawValue: string;
}

interface ExtractedJsxRecord {
  readonly astNode: t.JSXElement | t.JSXFragment;
  readonly owner: ComponentCandidate | null;
  readonly parent: ExtractedJsxRecord | null;
  textState?: TextState;
}

class ExtractionProblem extends Error {
  public readonly code:
    | typeof SOURCE_PARSER_ERROR_CODES.extractFailed
    | typeof SOURCE_PARSER_ERROR_CODES.extractLimitExceeded;
  public readonly position?: SourcePosition;

  public constructor(
    code:
      | typeof SOURCE_PARSER_ERROR_CODES.extractFailed
      | typeof SOURCE_PARSER_ERROR_CODES.extractLimitExceeded,
    message: string,
    position?: SourcePosition,
  ) {
    super(message);
    this.name = 'ExtractionProblem';
    this.code = code;

    if (position !== undefined) {
      this.position = position;
    }
  }
}

export class BabelAnalysisInvariantError extends Error {
  public readonly code = 'BABEL_ANALYSIS_INVARIANT_FAILED';

  public constructor() {
    super('Babel analysis extraction reached an invalid internal state.');
    this.name = 'BabelAnalysisInvariantError';
  }
}

const isSafeNonNegativeInteger = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isSafeInteger(value) && value >= 0;

const toOptionalPosition = (node: t.Node): SourcePosition | undefined => {
  const location = node.loc;
  const offset = node.start;

  if (
    location === null ||
    location === undefined ||
    !isSafeNonNegativeInteger(offset) ||
    !Number.isSafeInteger(location.start.line) ||
    location.start.line < 1 ||
    !Number.isSafeInteger(location.start.column) ||
    location.start.column < 0
  ) {
    return undefined;
  }

  return {
    column: location.start.column,
    line: location.start.line,
    offset,
  };
};

const toSourceLocation = (node: t.Node, filePath: string): SourceLocation => {
  const location = node.loc;
  const startOffset = node.start;
  const endOffset = node.end;

  if (
    location === null ||
    location === undefined ||
    !isSafeNonNegativeInteger(startOffset) ||
    !isSafeNonNegativeInteger(endOffset) ||
    endOffset < startOffset ||
    !Number.isSafeInteger(location.start.line) ||
    location.start.line < 1 ||
    !Number.isSafeInteger(location.start.column) ||
    location.start.column < 0 ||
    !Number.isSafeInteger(location.end.line) ||
    location.end.line < 1 ||
    !Number.isSafeInteger(location.end.column) ||
    location.end.column < 0
  ) {
    throw new ExtractionProblem(
      SOURCE_PARSER_ERROR_CODES.extractFailed,
      'Source analysis could not retain a required location.',
      toOptionalPosition(node),
    );
  }

  return {
    end: {
      column: location.end.column,
      line: location.end.line,
      offset: endOffset,
    },
    filePath,
    start: {
      column: location.start.column,
      line: location.start.line,
      offset: startOffset,
    },
  };
};

const getStartOffset = (node: t.Node, filePath: string): number =>
  toSourceLocation(node, filePath).start.offset;

const getJsxName = (
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
): string => {
  if (t.isJSXIdentifier(name)) {
    return name.name;
  }

  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`;
  }

  return `${getJsxName(name.object)}.${getJsxName(name.property)}`;
};

const getAttributeName = (name: t.JSXIdentifier | t.JSXNamespacedName): string =>
  t.isJSXIdentifier(name) ? name.name : `${name.namespace.name}:${name.name.name}`;

const isCustomJsxName = (
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName,
): boolean =>
  t.isJSXMemberExpression(name) || (t.isJSXIdentifier(name) && !/^[a-z]/u.test(name.name));

const isPascalCaseComponentName = (name: string): boolean => componentNamePattern.test(name);

const isDirectDefaultExport = (path: NodePath): boolean =>
  path.parentPath.isExportDefaultDeclaration();

const isPresent = <Value>(value: Value | null): value is Value => value !== null;

const getVariableComponentName = (
  path: NodePath<t.ArrowFunctionExpression> | NodePath<t.FunctionExpression>,
): { readonly locationNode: t.VariableDeclarator; readonly name: string } | undefined => {
  const parentPath = path.parentPath as NodePath | null;

  if (
    parentPath === null ||
    !parentPath.isVariableDeclarator() ||
    !t.isIdentifier(parentPath.node.id)
  ) {
    return undefined;
  }

  const name = parentPath.node.id.name;

  return isPascalCaseComponentName(name)
    ? {
        locationNode: parentPath.node,
        name,
      }
    : undefined;
};

const isSupportedReactSuperclass = (node: t.Expression | null | undefined): boolean => {
  if (node === null || node === undefined) {
    return false;
  }

  if (t.isIdentifier(node)) {
    return node.name === 'Component' || node.name === 'PureComponent';
  }

  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object, { name: 'React' }) &&
    t.isIdentifier(node.property) &&
    (node.property.name === 'Component' || node.property.name === 'PureComponent')
  );
};

const getClassName = (
  node: t.ClassDeclaration | t.ClassExpression,
  path: NodePath<t.ClassDeclaration> | NodePath<t.ClassExpression>,
): null | string | undefined => {
  if (isDirectDefaultExport(path)) {
    return node.id?.name ?? null;
  }

  if (node.id !== null && node.id !== undefined && isPascalCaseComponentName(node.id.name)) {
    return node.id.name;
  }

  const parentPath = path.parentPath as NodePath | null;

  if (parentPath?.isVariableDeclarator() && t.isIdentifier(parentPath.node.id)) {
    const name = parentPath.node.id.name;
    return isPascalCaseComponentName(name) ? name : undefined;
  }

  return undefined;
};

const isRenderMethod = (node: t.ClassMethod): boolean =>
  !node.computed &&
  !node.static &&
  node.kind === 'method' &&
  ((t.isIdentifier(node.key) && node.key.name === 'render') ||
    (t.isStringLiteral(node.key) && node.key.value === 'render'));

const isJsxAttributeBoundary = (path: NodePath): boolean =>
  path.isJSXAttribute() || path.isJSXSpreadAttribute();

const isOwnershipBoundary = (path: NodePath): boolean =>
  path.isFunction() ||
  path.isClassDeclaration() ||
  path.isClassExpression() ||
  path.isClassProperty() ||
  path.isClassPrivateProperty() ||
  path.isStaticBlock();

const literalValue = (value: boolean | null | number | string): JsxAttributeValue => ({
  confidence: JSX_VALUE_CONFIDENCE.exact,
  kind: 'literal',
  value,
});

const dynamicValue = (): JsxAttributeValue => ({
  confidence: JSX_VALUE_CONFIDENCE.dynamic,
  kind: 'dynamic',
});

const getObjectPropertyName = (property: t.ObjectProperty): string | undefined => {
  if (property.computed) {
    return undefined;
  }

  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }

  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }

  return t.isNumericLiteral(property.key) ? String(property.key.value) : undefined;
};

const extractExpressionValue = (
  expression: t.Expression,
  filePath: string,
  objectDepth: number,
): JsxAttributeValue => {
  if (t.isStringLiteral(expression)) {
    return literalValue(expression.value);
  }

  if (t.isNumericLiteral(expression)) {
    return Number.isFinite(expression.value) ? literalValue(expression.value) : dynamicValue();
  }

  if (t.isBooleanLiteral(expression)) {
    return literalValue(expression.value);
  }

  if (t.isNullLiteral(expression)) {
    return literalValue(null);
  }

  if (
    t.isUnaryExpression(expression) &&
    (expression.operator === '+' || expression.operator === '-') &&
    t.isNumericLiteral(expression.argument)
  ) {
    const value =
      expression.operator === '+' ? expression.argument.value : -expression.argument.value;
    return Number.isFinite(value) ? literalValue(value) : dynamicValue();
  }

  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    const quasi = expression.quasis[0];
    return quasi === undefined
      ? literalValue('')
      : literalValue(quasi.value.cooked ?? quasi.value.raw);
  }

  if (!t.isObjectExpression(expression)) {
    return dynamicValue();
  }

  if (objectDepth >= MAX_OBJECT_DEPTH) {
    return {
      confidence: JSX_VALUE_CONFIDENCE.partial,
      hasUnknownProperties: true,
      kind: 'object',
      properties: [],
    };
  }

  const properties: JsxObjectProperty[] = [];
  let hasUnknownProperties = false;
  let hasDynamicValue = false;

  for (const property of expression.properties) {
    if (!t.isObjectProperty(property)) {
      hasUnknownProperties = true;
      continue;
    }

    const name = getObjectPropertyName(property);

    if (name === undefined || !t.isExpression(property.value)) {
      hasUnknownProperties = true;
      continue;
    }

    const value = extractExpressionValue(property.value, filePath, objectDepth + 1);
    hasDynamicValue ||= value.confidence !== JSX_VALUE_CONFIDENCE.exact;
    properties.push({
      location: toSourceLocation(property, filePath),
      name,
      value,
    });
  }

  return {
    confidence:
      hasUnknownProperties || hasDynamicValue
        ? JSX_VALUE_CONFIDENCE.partial
        : JSX_VALUE_CONFIDENCE.exact,
    hasUnknownProperties,
    kind: 'object',
    properties,
  };
};

const extractAttributeValue = (attribute: t.JSXAttribute, filePath: string): JsxAttributeValue => {
  if (attribute.value === null) {
    return literalValue(true);
  }

  if (t.isStringLiteral(attribute.value)) {
    return literalValue(attribute.value.value);
  }

  if (
    !t.isJSXExpressionContainer(attribute.value) ||
    t.isJSXEmptyExpression(attribute.value.expression)
  ) {
    return dynamicValue();
  }

  return extractExpressionValue(attribute.value.expression, filePath, 0);
};

const extractAttributes = (node: t.JSXElement, filePath: string): readonly JsxAttribute[] =>
  node.openingElement.attributes.map((attribute): JsxAttribute => {
    if (t.isJSXSpreadAttribute(attribute)) {
      return {
        kind: JSX_ATTRIBUTE_KINDS.spread,
        location: toSourceLocation(attribute, filePath),
      };
    }

    return {
      kind: JSX_ATTRIBUTE_KINDS.named,
      location: toSourceLocation(attribute, filePath),
      name: getAttributeName(attribute.name),
      value: extractAttributeValue(attribute, filePath),
    };
  });

const expressionTextState = (expression: t.Expression | t.JSXEmptyExpression): TextState => {
  if (t.isJSXEmptyExpression(expression)) {
    return {
      hasDynamicContent: false,
      rawValue: '',
    };
  }

  if (t.isStringLiteral(expression) || t.isNumericLiteral(expression)) {
    return {
      hasDynamicContent: false,
      rawValue: String(expression.value),
    };
  }

  if (t.isBooleanLiteral(expression) || t.isNullLiteral(expression)) {
    return {
      hasDynamicContent: false,
      rawValue: '',
    };
  }

  if (t.isTemplateLiteral(expression) && expression.expressions.length === 0) {
    const quasi = expression.quasis[0];
    return {
      hasDynamicContent: false,
      rawValue: quasi?.value.cooked ?? quasi?.value.raw ?? '',
    };
  }

  return {
    hasDynamicContent: true,
    rawValue: '',
  };
};

const sliceWithoutSplittingSurrogatePair = (value: string, codeUnitLimit: number): string => {
  let endOffset = codeUnitLimit;
  const finalCodeUnit = value.charCodeAt(endOffset - 1);
  const nextCodeUnit = value.charCodeAt(endOffset);

  if (
    finalCodeUnit >= 0xd800 &&
    finalCodeUnit <= 0xdbff &&
    nextCodeUnit >= 0xdc00 &&
    nextCodeUnit <= 0xdfff
  ) {
    endOffset -= 1;
  }

  return value.slice(0, endOffset);
};

const getTextState = (
  node: t.JSXElement | t.JSXFragment,
  recordsByNode: ReadonlyMap<t.Node, ExtractedJsxRecord>,
): TextState => {
  let hasDynamicContent = false;
  let rawValue = '';
  const appendStaticText = (value: string): void => {
    const availableCodeUnits = STATIC_TEXT_CODE_UNIT_LIMIT - rawValue.length;

    if (value.length > availableCodeUnits) {
      hasDynamicContent = true;
    }

    if (availableCodeUnits > 0) {
      rawValue += sliceWithoutSplittingSurrogatePair(value, availableCodeUnits);
    }
  };

  for (const child of node.children) {
    if (t.isJSXText(child)) {
      appendStaticText(child.value);
      continue;
    }

    if (t.isJSXExpressionContainer(child)) {
      const expressionState = expressionTextState(child.expression);
      hasDynamicContent ||= expressionState.hasDynamicContent;
      appendStaticText(expressionState.rawValue);
      continue;
    }

    if (t.isJSXElement(child) || t.isJSXFragment(child)) {
      const childRecord = recordsByNode.get(child);

      if (childRecord?.textState === undefined) {
        hasDynamicContent = true;
        continue;
      }

      const childIsCustom =
        t.isJSXElement(child) &&
        getJsxName(child.openingElement.name) !== 'React.Fragment' &&
        isCustomJsxName(child.openingElement.name);

      hasDynamicContent ||= childRecord.textState.hasDynamicContent || childIsCustom;
      appendStaticText(childRecord.textState.rawValue);
      continue;
    }

    hasDynamicContent = true;
  }

  return {
    hasDynamicContent,
    rawValue,
  };
};

const normalizeTextContent = (state: TextState): JsxTextContent => {
  const value = state.rawValue.replace(/\s+/gu, ' ').trim();

  if (!state.hasDynamicContent) {
    return {
      confidence: JSX_VALUE_CONFIDENCE.exact,
      value,
    };
  }

  return {
    confidence: value.length === 0 ? JSX_VALUE_CONFIDENCE.dynamic : JSX_VALUE_CONFIDENCE.partial,
    value,
  };
};

const getElementShape = (
  node: t.JSXElement,
):
  | {
      readonly elementKind: typeof JSX_ELEMENT_KINDS.custom | typeof JSX_ELEMENT_KINDS.intrinsic;
      readonly name: string;
    }
  | undefined => {
  const name = getJsxName(node.openingElement.name);

  if (name === 'React.Fragment') {
    return undefined;
  }

  return {
    elementKind: isCustomJsxName(node.openingElement.name)
      ? JSX_ELEMENT_KINDS.custom
      : JSX_ELEMENT_KINDS.intrinsic,
    name,
  };
};

const toExtractionError = (filePath: string, problem: ExtractionProblem): SourceParserError => {
  const stableError = {
    code: problem.code,
    filePath,
    message: problem.message,
    recoverable: true,
    stage: SOURCE_PARSER_ERROR_STAGES.extract,
  } as const;

  return problem.position === undefined
    ? stableError
    : {
        ...stableError,
        position: problem.position,
      };
};

const getLanguage = (sourceKind: SourceKind) =>
  sourceKind === SOURCE_KINDS.typescript || sourceKind === SOURCE_KINDS.typescriptJsx
    ? ANALYZED_SOURCE_LANGUAGES.typescript
    : ANALYZED_SOURCE_LANGUAGES.javascript;

const validateNodeLimit = (maxNodes: number): void => {
  if (!Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > DEFAULT_EXTRACTION_NODE_LIMIT) {
    throw new ExtractionProblem(
      SOURCE_PARSER_ERROR_CODES.extractFailed,
      'Source extraction node limit is invalid.',
    );
  }
};

export const extractBabelAnalysis = ({
  ast,
  filePath,
  maxNodes = DEFAULT_EXTRACTION_NODE_LIMIT,
  sourceKind,
}: ExtractBabelAnalysisRequest): ExtractBabelAnalysisResult => {
  try {
    validateNodeLimit(maxNodes);

    const candidates: ComponentCandidate[] = [];
    const jsxRecords: ExtractedJsxRecord[] = [];
    const recordsByNode = new Map<t.Node, ExtractedJsxRecord>();
    const ownershipContextByBoundary = new Map<t.Node, ComponentCandidate | null>();
    const jsxParentByOwnershipBoundary = new Map<t.Node, ExtractedJsxRecord | null>();
    const jsxParentRestoreStack: (ExtractedJsxRecord | null)[] = [];
    let activeComponent: ComponentCandidate | null = null;
    let activeJsxParent: ExtractedJsxRecord | null = null;
    let visitedNodes = 0;

    const registerCandidate = (candidate: ComponentCandidate): ComponentCandidate => {
      candidates.push(candidate);
      return candidate;
    };

    const visitor: Visitor = {
      enter(path) {
        visitedNodes += 1;

        if (visitedNodes > maxNodes) {
          throw new ExtractionProblem(
            SOURCE_PARSER_ERROR_CODES.extractLimitExceeded,
            'Source file exceeds the extraction node limit.',
            toOptionalPosition(path.node),
          );
        }

        let enteredCandidate: ComponentCandidate | undefined;

        if (path.isFunctionDeclaration()) {
          const name = path.node.id?.name ?? null;

          if (isDirectDefaultExport(path) || (name !== null && isPascalCaseComponentName(name))) {
            enteredCandidate = registerCandidate({
              kind: COMPONENT_KINDS.function,
              locationNode: path.node,
              name,
            });
          }
        } else if (path.isFunctionExpression() || path.isArrowFunctionExpression()) {
          const variableComponent = getVariableComponentName(path);

          if (variableComponent !== undefined) {
            enteredCandidate = registerCandidate({
              kind: path.isArrowFunctionExpression()
                ? COMPONENT_KINDS.arrowFunction
                : COMPONENT_KINDS.function,
              locationNode: variableComponent.locationNode,
              name: variableComponent.name,
            });
          } else if (isDirectDefaultExport(path)) {
            enteredCandidate = registerCandidate({
              kind: path.isArrowFunctionExpression()
                ? COMPONENT_KINDS.arrowFunction
                : COMPONENT_KINDS.function,
              locationNode: path.node,
              name: path.isFunctionExpression() ? (path.node.id?.name ?? null) : null,
            });
          }
        } else if (
          (path.isClassDeclaration() || path.isClassExpression()) &&
          isSupportedReactSuperclass(path.node.superClass)
        ) {
          const name = getClassName(path.node, path);

          if (name !== undefined) {
            enteredCandidate = registerCandidate({
              kind: COMPONENT_KINDS.class,
              locationNode: path.node,
              name,
            });
          }
        }

        if (isOwnershipBoundary(path)) {
          ownershipContextByBoundary.set(path.node, activeComponent);
          jsxParentByOwnershipBoundary.set(path.node, activeJsxParent);
          activeJsxParent = null;

          if (enteredCandidate !== undefined) {
            activeComponent = enteredCandidate;
          } else if (
            path.isClassMethod() &&
            isRenderMethod(path.node) &&
            activeComponent?.kind === COMPONENT_KINDS.class
          ) {
            // A class component owns JSX in its render method.
          } else {
            activeComponent = null;
          }
        }

        if (isJsxAttributeBoundary(path)) {
          jsxParentRestoreStack.push(activeJsxParent);
          activeJsxParent = null;
        }

        if (path.isJSXElement() || path.isJSXFragment()) {
          const record: ExtractedJsxRecord = {
            astNode: path.node,
            owner: activeComponent,
            parent: activeJsxParent,
          };
          jsxRecords.push(record);
          recordsByNode.set(path.node, record);
          activeJsxParent = record;
        }
      },
      exit(path) {
        if (path.isJSXElement() || path.isJSXFragment()) {
          const record = recordsByNode.get(path.node);

          if (record === undefined || activeJsxParent !== record) {
            throw new BabelAnalysisInvariantError();
          }

          record.textState = getTextState(path.node, recordsByNode);
          activeJsxParent = record.parent;
        }

        if (isJsxAttributeBoundary(path)) {
          const restoredParent = jsxParentRestoreStack.pop();

          if (restoredParent === undefined) {
            throw new BabelAnalysisInvariantError();
          }

          activeJsxParent = restoredParent;
        }

        if (isOwnershipBoundary(path)) {
          if (!ownershipContextByBoundary.has(path.node)) {
            throw new BabelAnalysisInvariantError();
          }

          activeComponent = ownershipContextByBoundary.get(path.node) ?? null;
          ownershipContextByBoundary.delete(path.node);

          if (!jsxParentByOwnershipBoundary.has(path.node)) {
            throw new BabelAnalysisInvariantError();
          }

          activeJsxParent = jsxParentByOwnershipBoundary.get(path.node) ?? null;
          jsxParentByOwnershipBoundary.delete(path.node);
        }
      },
    };

    traverse(ast, visitor);

    if (
      isPresent(activeComponent) ||
      isPresent(activeJsxParent) ||
      jsxParentRestoreStack.length > 0 ||
      ownershipContextByBoundary.size > 0 ||
      jsxParentByOwnershipBoundary.size > 0
    ) {
      throw new BabelAnalysisInvariantError();
    }

    const jsxStartOffsetByRecord = new Map(
      jsxRecords.map((record) => [record, getStartOffset(record.astNode, filePath)]),
    );
    const requireJsxStartOffset = (record: ExtractedJsxRecord): number => {
      const startOffset = jsxStartOffsetByRecord.get(record);

      if (startOffset === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      return startOffset;
    };
    const sortedJsxRecords = jsxRecords.toSorted((left, right) => {
      const offsetDifference = requireJsxStartOffset(left) - requireJsxStartOffset(right);
      return offsetDifference === 0
        ? compareOrdinal(left.astNode.type, right.astNode.type)
        : offsetDifference;
    });
    const jsxIdByRecord = new Map(
      sortedJsxRecords.map((record) => [
        record,
        createJsxNodeId(filePath, requireJsxStartOffset(record)),
      ]),
    );
    const childRecordsByParent = new Map<ExtractedJsxRecord, ExtractedJsxRecord[]>();
    const ownedRecordsByCandidate = new Map<ComponentCandidate, ExtractedJsxRecord[]>();

    for (const record of sortedJsxRecords) {
      if (record.parent !== null) {
        const childRecords = childRecordsByParent.get(record.parent) ?? [];
        childRecords.push(record);
        childRecordsByParent.set(record.parent, childRecords);
      }

      if (record.owner !== null) {
        const ownedRecords = ownedRecordsByCandidate.get(record.owner) ?? [];
        ownedRecords.push(record);
        ownedRecordsByCandidate.set(record.owner, ownedRecords);
      }
    }

    const unsortedActiveCandidates = candidates.filter((candidate) =>
      ownedRecordsByCandidate.has(candidate),
    );
    const componentStartOffsetByCandidate = new Map(
      unsortedActiveCandidates.map((candidate) => [
        candidate,
        getStartOffset(candidate.locationNode, filePath),
      ]),
    );
    const requireComponentStartOffset = (candidate: ComponentCandidate): number => {
      const startOffset = componentStartOffsetByCandidate.get(candidate);

      if (startOffset === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      return startOffset;
    };
    const activeCandidates = unsortedActiveCandidates.toSorted((left, right) => {
      const offsetDifference =
        requireComponentStartOffset(left) - requireComponentStartOffset(right);
      return offsetDifference === 0
        ? compareOrdinal(left.name ?? '', right.name ?? '')
        : offsetDifference;
    });
    const componentIdByCandidate = new Map(
      activeCandidates.map((candidate) => [
        candidate,
        createComponentId(filePath, requireComponentStartOffset(candidate)),
      ]),
    );
    const requireJsxId = (record: ExtractedJsxRecord): string => {
      const id = jsxIdByRecord.get(record);

      if (id === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      return id;
    };
    const requireComponentId = (candidate: ComponentCandidate): string => {
      const id = componentIdByCandidate.get(candidate);

      if (id === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      return id;
    };
    const jsxNodes: JsxNode[] = sortedJsxRecords.map((record): JsxNode => {
      const id = requireJsxId(record);
      const location = toSourceLocation(record.astNode, filePath);
      if (record.textState === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      const textContent = normalizeTextContent(record.textState);
      const parentNodeId = record.parent === null ? null : requireJsxId(record.parent);
      const childNodeIds = (childRecordsByParent.get(record) ?? []).map(requireJsxId);
      const componentId = record.owner === null ? null : requireComponentId(record.owner);

      if (t.isJSXFragment(record.astNode)) {
        const fragment: JsxFragment = {
          childNodeIds,
          componentId,
          id,
          kind: JSX_NODE_KINDS.fragment,
          location,
          parentNodeId,
          textContent,
        };
        return fragment;
      }

      const elementShape = getElementShape(record.astNode);

      if (elementShape === undefined) {
        const fragment: JsxFragment = {
          childNodeIds,
          componentId,
          id,
          kind: JSX_NODE_KINDS.fragment,
          location,
          parentNodeId,
          textContent,
        };
        return fragment;
      }

      const element: JsxElement = {
        attributes: extractAttributes(record.astNode, filePath),
        childNodeIds,
        componentId,
        elementKind: elementShape.elementKind,
        id,
        kind: JSX_NODE_KINDS.element,
        location,
        name: elementShape.name,
        parentNodeId,
        textContent,
      };
      return element;
    });
    const components: AnalyzedComponent[] = activeCandidates.map((candidate) => {
      const id = requireComponentId(candidate);
      const ownedRecords = ownedRecordsByCandidate.get(candidate);

      if (ownedRecords === undefined) {
        throw new BabelAnalysisInvariantError();
      }

      return {
        id,
        jsxNodeIds: ownedRecords.map(requireJsxId),
        kind: candidate.kind,
        location: toSourceLocation(candidate.locationNode, filePath),
        name: candidate.name,
        rootJsxNodeIds: ownedRecords
          .filter((record) => record.parent?.owner !== candidate)
          .map(requireJsxId),
      };
    });
    const jsxNodeIds = jsxNodes.map((node) => node.id);

    return {
      analyzedFile: {
        components,
        file: {
          componentIds: components.map((component) => component.id),
          filePath,
          jsxNodeIds,
          language: getLanguage(sourceKind),
          location: toSourceLocation(ast.program, filePath),
          usesJsx: jsxNodes.length > 0,
        },
        jsxNodes,
      },
      success: true,
    };
  } catch (error) {
    if (!(error instanceof ExtractionProblem)) {
      throw error instanceof BabelAnalysisInvariantError
        ? error
        : new BabelAnalysisInvariantError();
    }

    return {
      error: toExtractionError(filePath, error),
      success: false,
    };
  }
};
