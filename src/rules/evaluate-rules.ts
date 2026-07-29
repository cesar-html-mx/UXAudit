import {
  RULE_EXECUTION_ERROR_CODES,
  createRuleExecutionError,
  type RuleExecutionError,
} from '../domain/errors/rule-execution-error.js';
import { createFinding, type Finding } from '../domain/findings/finding.js';
import type { AnalysisModel } from '../domain/models/analysis-model.js';
import type { JsxAttributeValue } from '../domain/models/jsx-value.js';
import type { SourceLocation, SourcePosition } from '../domain/models/source-location.js';
import type { RuleEvaluationResult } from '../domain/rules/rule-evaluation-result.js';
import {
  FINDING_CONFIDENCES,
  type FindingConfidence,
  type RuleFinding,
} from '../domain/rules/rule.js';
import type { LoadedRuleSet } from './load-rules.js';
import { compareOrdinal } from './rule-order.js';

export interface EvaluateRulesRequest {
  readonly loadedRules: LoadedRuleSet;
  readonly model: AnalysisModel;
}

const findingConfidences = Object.values(FINDING_CONFIDENCES);

const deepFreeze = (value: unknown, seen: WeakSet<object>): void => {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return;
  }

  seen.add(value);

  for (const child of Object.values(value)) {
    deepFreeze(child, seen);
  }

  Object.freeze(value);
};

const freezeAnalysisModel = (model: AnalysisModel): void => {
  deepFreeze(model, new WeakSet());
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requirePosition = (value: unknown): SourcePosition | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const column = value['column'];
  const line = value['line'];
  const offset = value['offset'];

  if (
    typeof column !== 'number' ||
    !Number.isSafeInteger(column) ||
    column < 0 ||
    typeof line !== 'number' ||
    !Number.isSafeInteger(line) ||
    line < 1 ||
    typeof offset !== 'number' ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    return undefined;
  }

  return { column, line, offset };
};

const requireLocation = (value: unknown): null | SourceLocation | undefined => {
  if (value === null) {
    return null;
  }

  if (!isRecord(value) || typeof value['filePath'] !== 'string') {
    return undefined;
  }

  const start = requirePosition(value['start']);
  const end = requirePosition(value['end']);

  if (
    start === undefined ||
    end === undefined ||
    start.offset > end.offset ||
    start.line > end.line ||
    (start.line === end.line && start.column > end.column)
  ) {
    return undefined;
  }

  return {
    end,
    filePath: value['filePath'],
    start,
  };
};

const locationKey = (location: SourceLocation): string =>
  JSON.stringify([
    location.filePath,
    location.start.line,
    location.start.column,
    location.start.offset,
    location.end.line,
    location.end.column,
    location.end.offset,
  ]);

const addValueLocations = (value: JsxAttributeValue, keys: Set<string>): void => {
  if (value.kind !== 'object') {
    return;
  }

  for (const property of value.properties) {
    keys.add(locationKey(property.location));
    addValueLocations(property.value, keys);
  }
};

const collectModelLocationKeys = (model: AnalysisModel): ReadonlySet<string> => {
  const keys = new Set<string>();

  for (const file of model.files) {
    keys.add(locationKey(file.location));
  }

  for (const component of model.components) {
    keys.add(locationKey(component.location));
  }

  for (const node of model.jsxNodes) {
    keys.add(locationKey(node.location));

    if (node.kind === 'element') {
      for (const attribute of node.attributes) {
        keys.add(locationKey(attribute.location));

        if (attribute.kind === 'named') {
          addValueLocations(attribute.value, keys);
        }
      }
    }
  }

  return keys;
};

const normalizeRuleFindings = (
  value: unknown,
  allowedLocationKeys: ReadonlySet<string>,
): readonly RuleFinding[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized: RuleFinding[] = [];
  const identities = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) {
      return undefined;
    }

    const confidence = candidate['confidence'];
    const message = candidate['message'];
    const location = requireLocation(candidate['location']);

    if (
      typeof confidence !== 'string' ||
      !findingConfidences.includes(confidence as FindingConfidence) ||
      typeof message !== 'string' ||
      message.length === 0 ||
      message !== message.trim() ||
      location === undefined ||
      (location !== null && !allowedLocationKeys.has(locationKey(location)))
    ) {
      return undefined;
    }

    const identity = JSON.stringify([message, location === null ? null : locationKey(location)]);

    if (identities.has(identity)) {
      return undefined;
    }

    identities.add(identity);
    normalized.push({
      confidence: confidence as FindingConfidence,
      location,
      message,
    });
  }

  return normalized;
};

const compareNumbers = (left: number, right: number): number => left - right;

const compareFindings = (left: Finding, right: Finding): number => {
  const ruleDifference = compareOrdinal(left.ruleId, right.ruleId);

  if (ruleDifference !== 0) {
    return ruleDifference;
  }

  const leftFilePath = left.location?.filePath ?? '';
  const rightFilePath = right.location?.filePath ?? '';
  const fileDifference = compareOrdinal(leftFilePath, rightFilePath);

  if (fileDifference !== 0) {
    return fileDifference;
  }

  const startDifference = compareNumbers(
    left.location?.start.offset ?? -1,
    right.location?.start.offset ?? -1,
  );

  if (startDifference !== 0) {
    return startDifference;
  }

  const endDifference = compareNumbers(
    left.location?.end.offset ?? -1,
    right.location?.end.offset ?? -1,
  );

  if (endDifference !== 0) {
    return endDifference;
  }

  return compareOrdinal(left.message, right.message);
};

export const evaluateRules = ({
  loadedRules,
  model,
}: EvaluateRulesRequest): RuleEvaluationResult => {
  freezeAnalysisModel(model);
  const allowedLocationKeys = collectModelLocationKeys(model);
  const findings: Finding[] = [];
  const errors: RuleExecutionError[] = [];
  let succeededRuleCount = 0;

  for (const rule of loadedRules.rules) {
    let evaluated: unknown;

    try {
      evaluated = rule.evaluate({ model });
    } catch {
      errors.push(
        createRuleExecutionError(
          rule.metadata.id,
          rule.metadata.category,
          RULE_EXECUTION_ERROR_CODES.evaluationFailed,
        ),
      );
      continue;
    }

    let candidates: readonly RuleFinding[] | undefined;

    try {
      candidates = normalizeRuleFindings(evaluated, allowedLocationKeys);
    } catch {
      candidates = undefined;
    }

    if (candidates === undefined) {
      errors.push(
        createRuleExecutionError(
          rule.metadata.id,
          rule.metadata.category,
          RULE_EXECUTION_ERROR_CODES.invalidResult,
        ),
      );
      continue;
    }

    const normalizedFindings = candidates.map((candidate) =>
      createFinding(rule.metadata, candidate),
    );
    findings.push(...normalizedFindings);
    succeededRuleCount += 1;
  }

  findings.sort(compareFindings);
  errors.sort((left, right) => compareOrdinal(left.ruleId, right.ruleId));

  const failedRuleCount = errors.length;
  const executedRuleCount = succeededRuleCount + failedRuleCount;

  return {
    errors,
    findings,
    summary: {
      availableRuleCount: loadedRules.availableRuleCount,
      enabledRuleCount: loadedRules.rules.length,
      executedRuleCount,
      failedRuleCount,
      findingCount: findings.length,
      succeededRuleCount,
    },
  };
};
