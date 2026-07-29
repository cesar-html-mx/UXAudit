import type { Rule } from '../../domain/rules/rule.js';
import { buttonNameRule } from './button-name.js';
import { imgAltRule } from './img-alt.js';
import { inputLabelRule } from './input-label.js';

export const accessibilityRules: readonly Rule[] = Object.freeze([
  buttonNameRule,
  imgAltRule,
  inputLabelRule,
]);
