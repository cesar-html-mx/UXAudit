import { accessibilityRules } from './accessibility/accessibility-rules.js';
import { performanceRules } from './performance/performance-rules.js';
import { createRuleRegistry } from './rule-registry.js';
import { seoRules } from './seo/seo-rules.js';
import { uxRules } from './ux/ux-rules.js';

export const initialRuleRegistry = createRuleRegistry([
  ...accessibilityRules,
  ...performanceRules,
  ...seoRules,
  ...uxRules,
]);
