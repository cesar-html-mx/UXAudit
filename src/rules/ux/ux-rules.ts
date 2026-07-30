import type { Rule } from '../../domain/rules/rule.js';
import { smallInlineTextRule } from './small-inline-text.js';

export const uxRules: readonly Rule[] = Object.freeze([smallInlineTextRule]);
