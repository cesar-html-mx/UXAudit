import { createComponentId, createJsxNodeId } from './analysis-model-ids.js';
import {
  ANALYZED_SOURCE_LANGUAGES,
  COMPONENT_USE_KINDS,
  COMPONENT_KINDS,
  JSX_ATTRIBUTE_KINDS,
  JSX_ELEMENT_KINDS,
  JSX_NODE_KINDS,
  type AnalysisModel,
  type AnalyzedComponent,
  type AnalyzedComponentExport,
  type AnalyzedComponentUse,
  type AnalyzedFile,
  type AnalyzedSourceLanguage,
  type AnalyzedSourceFile,
  type ComponentKind,
  type ComponentLink,
  type JsxAttribute,
  type JsxElement,
  type JsxElementKind,
  type JsxNode,
} from './analysis-model.js';
import {
  JSX_VALUE_CONFIDENCE,
  type JsxAttributeValue,
  type JsxObjectProperty,
  type JsxTextContent,
  type JsxValueConfidence,
} from './jsx-value.js';
import { resolveComponentLinks } from './resolve-component-links.js';
import type { SourceLocation, SourcePosition } from './source-location.js';

export const ANALYSIS_MODEL_ERROR_CODES = Object.freeze({
  invariantFailed: 'ANALYSIS_MODEL_INVARIANT_FAILED',
} as const);

export class AnalysisModelInvariantError extends Error {
  public readonly code = ANALYSIS_MODEL_ERROR_CODES.invariantFailed;

  public constructor() {
    super('Analysis model construction reached an invalid internal state.');
    this.name = 'AnalysisModelInvariantError';
  }
}

interface ProjectedAnalyzedSourceFile {
  readonly componentExports: readonly AnalyzedComponentExport[];
  readonly componentUses: readonly AnalyzedComponentUse[];
  readonly components: readonly AnalyzedComponent[];
  readonly file: AnalyzedFile;
  readonly jsxNodes: readonly JsxNode[];
}

const MAX_OBJECT_VALUE_DEPTH = 20;
const MAX_STATIC_TEXT_CODE_UNITS = 256;
const windowsDrivePrefixPattern = /^[A-Za-z]:/u;

const failInvariant = (): never => {
  throw new AnalysisModelInvariantError();
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  isRecord(value) ? value : failInvariant();

const requireArray = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : failInvariant();

const requireBoolean = (value: unknown): boolean =>
  typeof value === 'boolean' ? value : failInvariant();

const requireString = (value: unknown): string =>
  typeof value === 'string' ? value : failInvariant();

const requireNonEmptyString = (value: unknown): string => {
  const stringValue = requireString(value);
  return stringValue.length > 0 ? stringValue : failInvariant();
};

const requireDefined = <Value>(value: Value | undefined): Value => {
  if (value === undefined) {
    return failInvariant();
  }

  return value;
};

const requireSafeInteger = (value: unknown, minimum: number): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
    ? value
    : failInvariant();

const compareOrdinal = (left: string, right: string): number => {
  if (left < right) {
    return -1;
  }

  return left > right ? 1 : 0;
};

const compareEntities = (
  left: { readonly id: string; readonly location: SourceLocation },
  right: { readonly id: string; readonly location: SourceLocation },
): number => {
  const offsetDifference = left.location.start.offset - right.location.start.offset;
  return offsetDifference === 0 ? compareOrdinal(left.id, right.id) : offsetDifference;
};

const arraysEqual = <Value>(
  left: readonly Value[],
  right: readonly Value[],
  compare: (leftValue: Value, rightValue: Value) => boolean = Object.is,
): boolean =>
  left.length === right.length &&
  left.every((value, index) => {
    const rightValue = right[index];
    return rightValue !== undefined && compare(value, rightValue);
  });

const requireUniqueStrings = (value: unknown): readonly string[] => {
  const values = requireArray(value).map(requireString);

  if (new Set(values).size !== values.length) {
    failInvariant();
  }

  return values;
};

const requirePortableFilePath = (value: unknown): string => {
  const filePath = requireNonEmptyString(value);
  const segments = filePath.split('/');

  if (
    filePath.startsWith('/') ||
    filePath.endsWith('/') ||
    filePath.includes('\\') ||
    windowsDrivePrefixPattern.test(filePath) ||
    segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')
  ) {
    failInvariant();
  }

  return filePath;
};

const requirePosition = (value: unknown): SourcePosition => {
  const position = requireRecord(value);
  const column = requireSafeInteger(position['column'], 0);
  const line = requireSafeInteger(position['line'], 1);
  const offset = requireSafeInteger(position['offset'], 0);

  return {
    column,
    line,
    offset,
  };
};

const comparePositions = (left: SourcePosition, right: SourcePosition): number => {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  if (left.column !== right.column) {
    return left.column - right.column;
  }

  return left.offset - right.offset;
};

const requireLocation = (value: unknown, filePath: string): SourceLocation => {
  const location = requireRecord(value);
  const locationFilePath = requireString(location['filePath']);
  const start = requirePosition(location['start']);
  const end = requirePosition(location['end']);

  if (
    locationFilePath !== filePath ||
    start.offset > end.offset ||
    comparePositions(start, end) > 0 ||
    (start.line === end.line && end.offset - start.offset !== end.column - start.column) ||
    (start.line !== end.line && start.offset === end.offset)
  ) {
    failInvariant();
  }

  return {
    end,
    filePath,
    start,
  };
};

const locationContains = (outer: SourceLocation, inner: SourceLocation): boolean =>
  outer.filePath === inner.filePath &&
  outer.start.offset <= inner.start.offset &&
  inner.end.offset <= outer.end.offset &&
  comparePositions(outer.start, inner.start) <= 0 &&
  comparePositions(inner.end, outer.end) <= 0;

const requireContainedLocation = (
  value: unknown,
  filePath: string,
  container: SourceLocation,
): SourceLocation => {
  const location = requireLocation(value, filePath);

  if (!locationContains(container, location)) {
    failInvariant();
  }

  return location;
};

const requireSourceOrdered = (entities: readonly { readonly location: SourceLocation }[]): void => {
  for (let index = 1; index < entities.length; index += 1) {
    const previous = entities[index - 1];
    const current = entities[index];

    if (
      previous === undefined ||
      current === undefined ||
      previous.location.start.offset >= current.location.start.offset
    ) {
      failInvariant();
    }
  }
};

const requireConfidence = (value: unknown): JsxValueConfidence => {
  if (value === JSX_VALUE_CONFIDENCE.dynamic) {
    return JSX_VALUE_CONFIDENCE.dynamic;
  }

  if (value === JSX_VALUE_CONFIDENCE.exact) {
    return JSX_VALUE_CONFIDENCE.exact;
  }

  return value === JSX_VALUE_CONFIDENCE.partial ? JSX_VALUE_CONFIDENCE.partial : failInvariant();
};

const requireComponentKind = (value: unknown): ComponentKind => {
  if (value === COMPONENT_KINDS.arrowFunction) {
    return COMPONENT_KINDS.arrowFunction;
  }

  if (value === COMPONENT_KINDS.class) {
    return COMPONENT_KINDS.class;
  }

  return value === COMPONENT_KINDS.function ? COMPONENT_KINDS.function : failInvariant();
};

const requireElementKind = (value: unknown): JsxElementKind => {
  if (value === JSX_ELEMENT_KINDS.custom) {
    return JSX_ELEMENT_KINDS.custom;
  }

  return value === JSX_ELEMENT_KINDS.intrinsic ? JSX_ELEMENT_KINDS.intrinsic : failInvariant();
};

const requireLanguage = (value: unknown): AnalyzedSourceLanguage => {
  if (value === ANALYZED_SOURCE_LANGUAGES.javascript) {
    return ANALYZED_SOURCE_LANGUAGES.javascript;
  }

  return value === ANALYZED_SOURCE_LANGUAGES.typescript
    ? ANALYZED_SOURCE_LANGUAGES.typescript
    : failInvariant();
};

const projectPrimitiveValue = (value: unknown): boolean | null | number | string => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value;
  }

  return failInvariant();
};

const projectAttributeValue = (
  value: unknown,
  filePath: string,
  container: SourceLocation,
  activeObjects: WeakSet<object>,
  depth = 0,
): JsxAttributeValue => {
  const sourceValue = requireRecord(value);

  if (activeObjects.has(sourceValue)) {
    failInvariant();
  }

  activeObjects.add(sourceValue);

  try {
    const kind = requireString(sourceValue['kind']);
    const confidence = requireConfidence(sourceValue['confidence']);

    if (kind === 'literal') {
      if (confidence !== JSX_VALUE_CONFIDENCE.exact) {
        failInvariant();
      }

      return {
        confidence: JSX_VALUE_CONFIDENCE.exact,
        kind: 'literal',
        value: projectPrimitiveValue(sourceValue['value']),
      };
    }

    if (kind === 'dynamic') {
      if (confidence !== JSX_VALUE_CONFIDENCE.dynamic) {
        failInvariant();
      }

      return {
        confidence: JSX_VALUE_CONFIDENCE.dynamic,
        kind: 'dynamic',
      };
    }

    if (kind !== 'object' || depth > MAX_OBJECT_VALUE_DEPTH) {
      return failInvariant();
    }

    if (confidence !== JSX_VALUE_CONFIDENCE.exact && confidence !== JSX_VALUE_CONFIDENCE.partial) {
      failInvariant();
    }

    const hasUnknownProperties = requireBoolean(sourceValue['hasUnknownProperties']);
    const properties = requireArray(sourceValue['properties']).map((propertyValue) => {
      const property = requireRecord(propertyValue);
      const location = requireContainedLocation(property['location'], filePath, container);

      return {
        location,
        name: requireString(property['name']),
        value: projectAttributeValue(
          property['value'],
          filePath,
          location,
          activeObjects,
          depth + 1,
        ),
      } satisfies JsxObjectProperty;
    });
    requireSourceOrdered(properties);

    const containsUncertainValue = properties.some(
      (property) => property.value.confidence !== JSX_VALUE_CONFIDENCE.exact,
    );
    const expectedConfidence =
      hasUnknownProperties || containsUncertainValue
        ? JSX_VALUE_CONFIDENCE.partial
        : JSX_VALUE_CONFIDENCE.exact;

    if (confidence !== expectedConfidence) {
      failInvariant();
    }

    return {
      confidence: expectedConfidence,
      hasUnknownProperties,
      kind: 'object',
      properties,
    };
  } finally {
    activeObjects.delete(sourceValue);
  }
};

const projectTextContent = (value: unknown): JsxTextContent => {
  const textContent = requireRecord(value);
  const confidence = requireConfidence(textContent['confidence']);
  const textValue = requireString(textContent['value']);

  if (
    textValue.length > MAX_STATIC_TEXT_CODE_UNITS ||
    (confidence === JSX_VALUE_CONFIDENCE.dynamic && textValue.length > 0) ||
    (confidence === JSX_VALUE_CONFIDENCE.partial && textValue.length === 0)
  ) {
    failInvariant();
  }

  return {
    confidence,
    value: textValue,
  };
};

const projectAttributes = (
  value: unknown,
  filePath: string,
  container: SourceLocation,
): readonly JsxAttribute[] => {
  const attributes = requireArray(value).map((attributeValue): JsxAttribute => {
    const attribute = requireRecord(attributeValue);
    const kind = requireString(attribute['kind']);
    const location = requireContainedLocation(attribute['location'], filePath, container);

    if (kind === JSX_ATTRIBUTE_KINDS.spread) {
      return {
        kind: JSX_ATTRIBUTE_KINDS.spread,
        location,
      };
    }

    if (kind !== JSX_ATTRIBUTE_KINDS.named) {
      return failInvariant();
    }

    return {
      kind: JSX_ATTRIBUTE_KINDS.named,
      location,
      name: requireNonEmptyString(attribute['name']),
      value: projectAttributeValue(attribute['value'], filePath, location, new WeakSet<object>()),
    };
  });
  requireSourceOrdered(attributes);
  return attributes;
};

const projectNullableId = (value: unknown): null | string => {
  if (value === null) {
    return null;
  }

  return requireNonEmptyString(value);
};

const projectNullableName = (value: unknown): null | string =>
  value === null ? null : requireNonEmptyString(value);

const projectComponent = (
  value: unknown,
  filePath: string,
  fileLocation: SourceLocation,
): AnalyzedComponent => {
  const component = requireRecord(value);
  const location = requireContainedLocation(component['location'], filePath, fileLocation);
  const id = requireNonEmptyString(component['id']);
  const expectedId = createComponentId(filePath, location.start.offset);
  const kind = requireComponentKind(component['kind']);
  const name = projectNullableName(component['name']);

  if (id !== expectedId) {
    failInvariant();
  }

  return {
    id,
    jsxNodeIds: requireUniqueStrings(component['jsxNodeIds']),
    kind,
    location,
    name,
    rootJsxNodeIds: requireUniqueStrings(component['rootJsxNodeIds']),
  };
};

const projectJsxNode = (
  value: unknown,
  filePath: string,
  fileLocation: SourceLocation,
): JsxNode => {
  const node = requireRecord(value);
  const location = requireContainedLocation(node['location'], filePath, fileLocation);
  const id = requireNonEmptyString(node['id']);
  const expectedId = createJsxNodeId(filePath, location.start.offset);
  const kind = node['kind'];
  const common = {
    childNodeIds: requireUniqueStrings(node['childNodeIds']),
    componentId: projectNullableId(node['componentId']),
    id,
    location,
    parentNodeId: projectNullableId(node['parentNodeId']),
    textContent: projectTextContent(node['textContent']),
  };

  if (id !== expectedId) {
    failInvariant();
  }

  if (kind === JSX_NODE_KINDS.fragment) {
    return {
      ...common,
      kind: JSX_NODE_KINDS.fragment,
    };
  }

  if (kind !== JSX_NODE_KINDS.element) {
    return failInvariant();
  }

  const elementKind = requireElementKind(node['elementKind']);

  const element: JsxElement = {
    ...common,
    attributes: projectAttributes(node['attributes'], filePath, location),
    elementKind,
    kind: JSX_NODE_KINDS.element,
    name: requireNonEmptyString(node['name']),
  };
  return element;
};

const projectComponentExport = (
  value: unknown,
  componentsById: ReadonlyMap<string, AnalyzedComponent>,
): AnalyzedComponentExport => {
  const componentExport = requireRecord(value);
  const componentId = requireNonEmptyString(componentExport['componentId']);

  requireDefined(componentsById.get(componentId));

  return {
    componentId,
    exportedName: requireNonEmptyString(componentExport['exportedName']),
  };
};

const projectComponentUse = (
  value: unknown,
  componentsById: ReadonlyMap<string, AnalyzedComponent>,
  nodesById: ReadonlyMap<string, JsxNode>,
): AnalyzedComponentUse => {
  const componentUse = requireRecord(value);
  const jsxNodeId = requireNonEmptyString(componentUse['jsxNodeId']);
  const jsxNode = requireDefined(nodesById.get(jsxNodeId));

  if (
    jsxNode.kind !== JSX_NODE_KINDS.element ||
    jsxNode.elementKind !== JSX_ELEMENT_KINDS.custom ||
    jsxNode.name.includes('.') ||
    jsxNode.name.includes(':')
  ) {
    failInvariant();
  }

  if (componentUse['kind'] === COMPONENT_USE_KINDS.local) {
    const targetComponentId = requireNonEmptyString(componentUse['targetComponentId']);
    requireDefined(componentsById.get(targetComponentId));

    return {
      jsxNodeId,
      kind: COMPONENT_USE_KINDS.local,
      targetComponentId,
    };
  }

  if (componentUse['kind'] !== COMPONENT_USE_KINDS.imported) {
    return failInvariant();
  }

  return {
    importedName: requireNonEmptyString(componentUse['importedName']),
    jsxNodeId,
    kind: COMPONENT_USE_KINDS.imported,
    moduleSpecifier: requireNonEmptyString(componentUse['moduleSpecifier']),
  };
};

const assertUniqueEntities = (entities: readonly { readonly id: string }[]): void => {
  if (new Set(entities.map((entity) => entity.id)).size !== entities.length) {
    failInvariant();
  }
};

const assertExpectedIds = (actual: readonly string[], expected: readonly string[]): void => {
  if (!arraysEqual(actual, expected)) {
    failInvariant();
  }
};

const assertAcyclicJsx = (nodesById: ReadonlyMap<string, JsxNode>): void => {
  const completedIds = new Set<string>();

  for (const node of nodesById.values()) {
    const lineage: string[] = [];
    const activeIds = new Set<string>();
    let current: JsxNode | undefined = node;

    while (current !== undefined && !completedIds.has(current.id)) {
      if (activeIds.has(current.id)) {
        failInvariant();
      }

      activeIds.add(current.id);
      lineage.push(current.id);
      current = current.parentNodeId === null ? undefined : nodesById.get(current.parentNodeId);
    }

    for (const id of lineage) {
      completedIds.add(id);
    }
  }
};

const collectValueLocations = (value: JsxAttributeValue, locations: SourceLocation[]): void => {
  if (value.kind !== 'object') {
    return;
  }

  for (const property of value.properties) {
    locations.push(property.location);
    collectValueLocations(property.value, locations);
  }
};

const assertCoordinateConsistency = (
  file: AnalyzedFile,
  components: readonly AnalyzedComponent[],
  jsxNodes: readonly JsxNode[],
): void => {
  const locations: SourceLocation[] = [
    file.location,
    ...components.map((component) => component.location),
  ];

  for (const node of jsxNodes) {
    locations.push(node.location);

    if (node.kind === JSX_NODE_KINDS.element) {
      for (const attribute of node.attributes) {
        locations.push(attribute.location);

        if (attribute.kind === JSX_ATTRIBUTE_KINDS.named) {
          collectValueLocations(attribute.value, locations);
        }
      }
    }
  }

  const positionsByOffset = new Map<number, SourcePosition>();

  for (const location of locations) {
    for (const position of [location.start, location.end]) {
      const existing = positionsByOffset.get(position.offset);

      if (
        existing !== undefined &&
        (existing.line !== position.line || existing.column !== position.column)
      ) {
        failInvariant();
      }

      positionsByOffset.set(position.offset, position);
    }
  }

  const positions = [...positionsByOffset.values()].toSorted(
    (left, right) => left.offset - right.offset,
  );

  for (let index = 1; index < positions.length; index += 1) {
    const previous = requireDefined(positions[index - 1]);
    const current = requireDefined(positions[index]);

    if (
      comparePositions(previous, current) >= 0 ||
      (previous.line === current.line &&
        current.offset - previous.offset !== current.column - previous.column)
    ) {
      failInvariant();
    }
  }
};

const projectAnalyzedSourceFile = (value: unknown): ProjectedAnalyzedSourceFile => {
  const analyzedSourceFile = requireRecord(value);
  const sourceFile = requireRecord(analyzedSourceFile['file']);
  const filePath = requirePortableFilePath(sourceFile['filePath']);
  const fileLocation = requireLocation(sourceFile['location'], filePath);
  const sourceComponentIds = requireUniqueStrings(sourceFile['componentIds']);
  const sourceJsxNodeIds = requireUniqueStrings(sourceFile['jsxNodeIds']);
  const language = requireLanguage(sourceFile['language']);
  const usesJsx = requireBoolean(sourceFile['usesJsx']);
  const components = requireArray(analyzedSourceFile['components'])
    .map((component) => projectComponent(component, filePath, fileLocation))
    .toSorted(compareEntities);
  const jsxNodes = requireArray(analyzedSourceFile['jsxNodes'])
    .map((node) => projectJsxNode(node, filePath, fileLocation))
    .toSorted(compareEntities);

  assertUniqueEntities(components);
  assertUniqueEntities(jsxNodes);
  assertExpectedIds(
    sourceComponentIds,
    components.map((component) => component.id),
  );
  assertExpectedIds(
    sourceJsxNodeIds,
    jsxNodes.map((node) => node.id),
  );

  if (usesJsx !== jsxNodes.length > 0) {
    failInvariant();
  }

  const componentsById = new Map(components.map((component) => [component.id, component] as const));
  const nodesById = new Map(jsxNodes.map((node) => [node.id, node] as const));
  const componentExports = requireArray(analyzedSourceFile['componentExports'])
    .map((componentExport) => projectComponentExport(componentExport, componentsById))
    .toSorted((left, right) => {
      const nameComparison = compareOrdinal(left.exportedName, right.exportedName);
      return nameComparison === 0
        ? compareOrdinal(left.componentId, right.componentId)
        : nameComparison;
    });
  const componentUses = requireArray(analyzedSourceFile['componentUses'])
    .map((componentUse) => projectComponentUse(componentUse, componentsById, nodesById))
    .toSorted((left, right) => {
      const leftNode = requireDefined(nodesById.get(left.jsxNodeId));
      const rightNode = requireDefined(nodesById.get(right.jsxNodeId));
      return compareEntities(leftNode, rightNode);
    });
  const ownedNodesByComponent = new Map<string, JsxNode[]>();
  const childNodesByParent = new Map<string, JsxNode[]>();

  for (const component of components) {
    ownedNodesByComponent.set(component.id, []);
  }

  if (
    new Set(componentExports.map(({ exportedName }) => exportedName)).size !==
      componentExports.length ||
    new Set(componentUses.map(({ jsxNodeId }) => jsxNodeId)).size !== componentUses.length
  ) {
    failInvariant();
  }

  for (const node of jsxNodes) {
    if (node.componentId !== null) {
      const component = requireDefined(componentsById.get(node.componentId));

      if (!locationContains(component.location, node.location)) {
        failInvariant();
      }

      requireDefined(ownedNodesByComponent.get(component.id)).push(node);
    }

    if (node.parentNodeId !== null) {
      const parent = requireDefined(nodesById.get(node.parentNodeId));

      if (
        parent.id === node.id ||
        parent.componentId !== node.componentId ||
        !locationContains(parent.location, node.location)
      ) {
        failInvariant();
      }

      const childNodes = childNodesByParent.get(parent.id) ?? [];
      childNodes.push(node);
      childNodesByParent.set(parent.id, childNodes);
    }
  }

  for (const node of jsxNodes) {
    const expectedChildIds = (childNodesByParent.get(node.id) ?? []).map((child) => child.id);
    assertExpectedIds(node.childNodeIds, expectedChildIds);
  }

  for (const component of components) {
    const ownedNodes = requireDefined(ownedNodesByComponent.get(component.id));

    if (ownedNodes.length === 0) {
      failInvariant();
    }

    const rootNodes = ownedNodes.filter((node) => node.parentNodeId === null);

    if (rootNodes.length === 0) {
      failInvariant();
    }

    assertExpectedIds(
      component.jsxNodeIds,
      ownedNodes.map((node) => node.id),
    );
    assertExpectedIds(
      component.rootJsxNodeIds,
      rootNodes.map((node) => node.id),
    );
  }

  assertAcyclicJsx(nodesById);

  const file: AnalyzedFile = {
    componentIds: components.map((component) => component.id),
    filePath,
    jsxNodeIds: jsxNodes.map((node) => node.id),
    language,
    location: fileLocation,
    usesJsx,
  };
  assertCoordinateConsistency(file, components, jsxNodes);

  return {
    componentExports,
    componentUses,
    components,
    file,
    jsxNodes,
  };
};

const buildAnalysisModelInternal = (value: unknown): AnalysisModel => {
  const analyzedFiles = requireArray(value)
    .map(projectAnalyzedSourceFile)
    .toSorted((left, right) => compareOrdinal(left.file.filePath, right.file.filePath));
  const filePaths = analyzedFiles.map(({ file }) => file.filePath);

  if (new Set(filePaths).size !== filePaths.length) {
    failInvariant();
  }

  const files = analyzedFiles.map(({ file }) => file);
  const components = analyzedFiles.flatMap((file) => file.components);
  const jsxNodes = analyzedFiles.flatMap((file) => file.jsxNodes);
  const localComponentLinks: ComponentLink[] = analyzedFiles.flatMap((file) =>
    file.componentUses.flatMap((componentUse) =>
      componentUse.kind === COMPONENT_USE_KINDS.local
        ? [
            {
              jsxNodeId: componentUse.jsxNodeId,
              targetComponentId: componentUse.targetComponentId,
            },
          ]
        : [],
    ),
  );

  if (
    new Set(components.map((component) => component.id)).size !== components.length ||
    new Set(jsxNodes.map((node) => node.id)).size !== jsxNodes.length
  ) {
    failInvariant();
  }

  const importedComponentLinks = resolveComponentLinks(
    analyzedFiles.map((analyzedFile) => ({
      componentExports: analyzedFile.componentExports,
      componentUses: analyzedFile.componentUses,
      filePath: analyzedFile.file.filePath,
    })),
  );
  const unresolvedOrderLinks = [...localComponentLinks, ...importedComponentLinks];
  const linksByJsxNodeId = new Map<string, ComponentLink>();
  const componentsById = new Map(components.map((component) => [component.id, component] as const));
  const nodesById = new Map(jsxNodes.map((node) => [node.id, node] as const));

  for (const link of unresolvedOrderLinks) {
    const node = requireDefined(nodesById.get(link.jsxNodeId));
    requireDefined(componentsById.get(link.targetComponentId));

    if (
      linksByJsxNodeId.has(link.jsxNodeId) ||
      node.kind !== JSX_NODE_KINDS.element ||
      node.elementKind !== JSX_ELEMENT_KINDS.custom ||
      node.name.includes('.') ||
      node.name.includes(':')
    ) {
      failInvariant();
    }

    linksByJsxNodeId.set(link.jsxNodeId, link);
  }

  const componentLinks = jsxNodes.flatMap((node) => {
    const link = linksByJsxNodeId.get(node.id);
    return link === undefined ? [] : [link];
  });

  return {
    componentLinks,
    components,
    files,
    jsxNodes,
  };
};

export type BuildAnalysisModel = (analyzedFiles: readonly AnalyzedSourceFile[]) => AnalysisModel;

export const buildAnalysisModel: BuildAnalysisModel = (analyzedFiles) => {
  try {
    return buildAnalysisModelInternal(analyzedFiles);
  } catch {
    throw new AnalysisModelInvariantError();
  }
};
