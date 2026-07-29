import type { Rule } from '../../domain/rules/rule.js';
import { ambiguousLinkTextRule } from './ambiguous-link-text.js';
import { multipleH1Rule } from './multiple-h1.js';

export const seoRules: readonly Rule[] = Object.freeze([ambiguousLinkTextRule, multipleH1Rule]);
