import type { AuditConfiguration, AuditConfigurationOverrides } from './configuration.js';
import {
  mergeAuditConfiguration,
  parseConfigurationJson,
  validateConfigurationOverrides,
} from './configuration-validation.js';
import { readConfigurationFile, type ReadConfigurationFile } from './read-configuration-file.js';
import { initialRuleRegistry } from '../rules/initial-rule-registry.js';

export interface LoadAuditConfigurationRequest {
  readonly configurationPath?: string;
  readonly overrides?: AuditConfigurationOverrides;
  readonly projectRoot: string;
}

export interface LoadAuditConfigurationDependencies {
  readonly knownRuleIds: readonly string[];
  readonly readFile: ReadConfigurationFile;
}

export type LoadAuditConfiguration = (
  request: LoadAuditConfigurationRequest,
) => Promise<AuditConfiguration>;

export const createLoadAuditConfiguration = ({
  knownRuleIds,
  readFile,
}: LoadAuditConfigurationDependencies): LoadAuditConfiguration => {
  const capturedRuleIds = new Set(knownRuleIds);

  return async ({ configurationPath, overrides, projectRoot }) => {
    const text = await readFile({
      ...(configurationPath === undefined ? {} : { configurationPath }),
      projectRoot,
    });
    const fileLayer = text === null ? undefined : parseConfigurationJson(text, capturedRuleIds);
    const cliLayer = validateConfigurationOverrides(overrides, capturedRuleIds);

    return mergeAuditConfiguration(fileLayer, cliLayer);
  };
};

export const loadAuditConfiguration = createLoadAuditConfiguration({
  knownRuleIds: initialRuleRegistry.rules.map((rule) => rule.metadata.id),
  readFile: readConfigurationFile,
});
