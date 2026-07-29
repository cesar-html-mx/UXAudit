/**
 * A position in the original source text.
 *
 * Lines are one-based for developer-facing locations. Columns and offsets are
 * zero-based UTF-16 code-unit indexes, matching JavaScript string indexing.
 */
export interface SourcePosition {
  readonly column: number;
  readonly line: number;
  readonly offset: number;
}

/**
 * A half-open source range whose file path is portable and project-relative.
 *
 * `start` is inclusive and `end` is exclusive.
 */
export interface SourceLocation {
  readonly end: SourcePosition;
  readonly filePath: string;
  readonly start: SourcePosition;
}
