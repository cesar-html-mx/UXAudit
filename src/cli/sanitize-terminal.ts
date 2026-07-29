const unsafeTerminalCharacterPattern =
  // eslint-disable-next-line no-control-regex -- This boundary must recognize terminal controls.
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/gu;

const toUnicodeEscape = (value: string): string =>
  `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`;

export const sanitizeTerminalValue = (value: string): string =>
  value.replace(unsafeTerminalCharacterPattern, toUnicodeEscape);

export const sanitizeTerminalOutput = (value: string): string =>
  value.split('\n').map(sanitizeTerminalValue).join('\n');

export const sanitizeTerminalRecord = (value: string): string =>
  sanitizeTerminalValue(value).replace(/\\u000a$/u, '\n');
