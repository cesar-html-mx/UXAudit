import type { Rule } from '../../domain/rules/rule.js';
import { imgDimensionsRule } from './img-dimensions.js';
import { imgLazyLoadingRule } from './img-lazy-loading.js';

export const performanceRules: readonly Rule[] = Object.freeze([
  imgDimensionsRule,
  imgLazyLoadingRule,
]);
