import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepositoryRoot = path.resolve(path.dirname(scriptPath), '..');
const explicitBilingualPairs = [
  ['README.en.md', 'README.es.md'],
  ['evidence/README.md', 'evidence/README.es.md'],
  ['evidence/security/SECURITY_CHECKLIST.md', 'evidence/security/SECURITY_CHECKLIST.es.md'],
  ['evidence/usability/USABILITY_PROTOCOL.md', 'evidence/usability/USABILITY_PROTOCOL.es.md'],
  ['evidence/usability/SUS_EN.md', 'evidence/usability/SUS_ES.md'],
];
const inlineBilingualDocuments = [
  {
    exactVisibleLines: ['[Español](#español) | [English](#english)'],
    fileName: 'README.md',
    sectionHeadings: ['Español', 'English'],
    visibleMarkers: [],
  },
  {
    exactVisibleLines: [],
    fileName: '.github/SECURITY.md',
    sectionHeadings: ['Español', 'English'],
    visibleMarkers: [],
  },
  {
    exactVisibleLines: [],
    fileName: '.github/pull_request_template.md',
    sectionHeadings: [],
    visibleMarkers: [
      'Hito o tarea',
      'Milestone or task',
      'Resultado observable',
      'Observable outcome',
      'Riesgos y limitaciones',
      'Risks and limitations',
    ],
  },
];

const toPortablePath = (value) => value.split(path.sep).join('/');
const isFileSystemError = (error) => typeof error === 'object' && error !== null && 'code' in error;
const displayPath = (rootDirectory, filePath) =>
  toPortablePath(path.relative(rootDirectory, filePath)) || '.';
const countExactVisibleLines = (analysis, value) =>
  analysis.visibleLines.filter((line) => line.text.trimEnd() === value).length;
const isWithinRoot = (rootDirectory, candidatePath) => {
  const relativePath = path.relative(rootDirectory, candidatePath);

  return (
    relativePath === '' ||
    (relativePath !== '..' &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
};

const discoverMarkdownPaths = async (directory, relativeDirectory = '') => {
  let entries;

  try {
    entries = await readdir(path.join(directory, relativeDirectory), { withFileTypes: true });
  } catch (error) {
    if (isFileSystemError(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const paths = [];

  for (const entry of entries.toSorted((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(relativeDirectory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...(await discoverMarkdownPaths(directory, relativePath)));
    } else if (
      (entry.isFile() || entry.isSymbolicLink()) &&
      path.extname(entry.name).toLowerCase() === '.md' &&
      entry.name.toLowerCase() !== 'agents.md'
    ) {
      paths.push(relativePath);
    }
  }

  return paths;
};

export const createRequiredBilingualPairs = async (rootDirectory) => {
  const docsDirectory = path.join(rootDirectory, 'docs');
  const spanishDocsDirectory = path.join(docsDirectory, 'es');
  const [allEnglishPaths, allSpanishPaths] = await Promise.all([
    discoverMarkdownPaths(docsDirectory),
    discoverMarkdownPaths(spanishDocsDirectory),
  ]);
  const englishPaths = allEnglishPaths.filter(
    (relativePath) => relativePath.split(path.sep)[0] !== 'es',
  );
  const relativeDocumentationPaths = [...new Set([...englishPaths, ...allSpanishPaths])].toSorted(
    (left, right) => toPortablePath(left).localeCompare(toPortablePath(right)),
  );
  const documentationPairs = relativeDocumentationPaths.map((relativePath) => ({
    englishPath: path.join(docsDirectory, relativePath),
    spanishPath: path.join(spanishDocsDirectory, relativePath),
  }));

  return [
    ...explicitBilingualPairs.map(([englishPath, spanishPath]) => ({
      englishPath: path.join(rootDirectory, englishPath),
      spanishPath: path.join(rootDirectory, spanishPath),
    })),
    ...documentationPairs,
  ];
};

export const createRequiredLinkSources = (rootDirectory, pairs) => [
  path.join(rootDirectory, 'README.md'),
  ...pairs.flatMap(({ englishPath, spanishPath }) => [englishPath, spanishPath]),
  path.join(rootDirectory, '.github', 'SECURITY.md'),
  path.join(rootDirectory, '.github', 'pull_request_template.md'),
];

const splitLines = (content) => {
  const lines = [];
  const linePattern = /[^\r\n]*(?:\r\n|\n|\r|$)/gu;

  for (const match of content.matchAll(linePattern)) {
    const raw = match[0];
    const offset = match.index;

    if (raw === '' && offset === content.length) {
      break;
    }

    lines.push({
      lineNumber: lines.length + 1,
      offset,
      raw,
      text: raw.replace(/(?:\r\n|\n|\r)$/u, ''),
    });
  }

  return lines;
};

const getTableColumnCount = (line) => {
  const trimmed = line.trim();

  if (!trimmed.includes('|')) {
    return undefined;
  }

  const withoutOuterPipes = trimmed.replace(/^\|/u, '').replace(/\|$/u, '');
  const cells = withoutOuterPipes.split('|').map((cell) => cell.trim());

  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell))
    ? cells.length
    : undefined;
};

const maskHtmlCommentsInLine = (rawLine, startsInsideComment) => {
  const masked = rawLine.split('');
  let insideComment = startsInsideComment;
  let index = 0;

  while (index < rawLine.length) {
    if (insideComment) {
      const closingIndex = rawLine.indexOf('-->', index);
      const endIndex = closingIndex === -1 ? rawLine.length : closingIndex + 3;

      for (let maskIndex = index; maskIndex < endIndex; maskIndex += 1) {
        if (masked[maskIndex] !== '\n' && masked[maskIndex] !== '\r') {
          masked[maskIndex] = ' ';
        }
      }

      insideComment = closingIndex === -1;
      index = endIndex;
      continue;
    }

    const openingIndex = rawLine.indexOf('<!--', index);

    if (openingIndex === -1) {
      break;
    }

    index = openingIndex;
    insideComment = true;
  }

  const raw = masked.join('');

  return {
    insideComment,
    raw,
    text: raw.replace(/(?:\r\n|\n|\r)$/u, ''),
  };
};

const matchFence = (line, opening) => {
  const withoutBlockquote = line.replace(/^(?: {0,3}>[\t ]?)*/u, '');
  const pattern = opening ? /^ {0,3}(`{3,}|~{3,})(.*)$/u : /^ {0,3}([`~]+)[\t ]*$/u;

  return pattern.exec(withoutBlockquote);
};

const analyzeMarkdown = (content, fileLabel) => {
  const visibleLines = [];
  const visibleContentParts = [];
  const visibleSegments = [];
  const fencedBlocks = [];
  const issues = [];
  let currentVisibleSegment = [];
  let insideHtmlComment = false;
  let openFence;

  for (const line of splitLines(content)) {
    if (openFence !== undefined) {
      visibleContentParts.push(line.raw.replace(/[^\r\n]/gu, ' '));
      const closingMatch = matchFence(line.text, false);

      if (
        closingMatch?.[1]?.[0] === openFence.character &&
        closingMatch[1].length >= openFence.length
      ) {
        fencedBlocks.push(content.slice(openFence.offset, line.offset + line.raw.length));
        openFence = undefined;
      }

      continue;
    }

    const maskedLine = maskHtmlCommentsInLine(line.raw, insideHtmlComment);

    insideHtmlComment = maskedLine.insideComment;

    const openingMatch = matchFence(maskedLine.text, true);

    if (openingMatch?.[1] !== undefined) {
      visibleContentParts.push(line.raw.replace(/[^\r\n]/gu, ' '));

      if (currentVisibleSegment.length > 0) {
        visibleSegments.push(currentVisibleSegment.join(''));
        currentVisibleSegment = [];
      }

      openFence = {
        character: openingMatch[1][0],
        length: openingMatch[1].length,
        lineNumber: line.lineNumber,
        offset: line.offset,
      };
      continue;
    }

    visibleContentParts.push(maskedLine.raw);
    currentVisibleSegment.push(maskedLine.raw);
    visibleLines.push({
      ...line,
      raw: maskedLine.raw,
      text: maskedLine.text,
    });
  }

  if (currentVisibleSegment.length > 0) {
    visibleSegments.push(currentVisibleSegment.join(''));
  }

  if (openFence !== undefined) {
    issues.push(`Unclosed fenced block in ${fileLabel}:${String(openFence.lineNumber)}.`);
  }

  if (insideHtmlComment) {
    issues.push(`Unclosed HTML comment in ${fileLabel}.`);
  }

  const headings = [];
  const headingEntries = [];
  const tableColumnCounts = [];

  for (const [index, line] of visibleLines.entries()) {
    const atxMatch = /^ {0,3}(#{1,6})(?:[\t ]+(.*)|[\t ]*)$/u.exec(line.text);

    if (atxMatch !== null) {
      const heading = (atxMatch[2] ?? '').replace(/[\t ]+#+[\t ]*$/u, '').trim();

      headings.push(heading);
      headingEntries.push({
        level: atxMatch[1].length,
        lineNumber: line.lineNumber,
        text: heading,
      });
    } else if (/^ {0,3}(?:=+|-+)[\t ]*$/u.test(line.text)) {
      const previousLine = visibleLines[index - 1];

      if (
        previousLine !== undefined &&
        previousLine.lineNumber === line.lineNumber - 1 &&
        previousLine.text.trim() !== ''
      ) {
        const heading = previousLine.text.trim();

        headings.push(heading);
        headingEntries.push({
          level: line.text.trim().startsWith('=') ? 1 : 2,
          lineNumber: previousLine.lineNumber,
          text: heading,
        });
      }
    }

    const tableColumnCount = getTableColumnCount(line.text);

    if (tableColumnCount !== undefined) {
      tableColumnCounts.push(tableColumnCount);
    }
  }

  return {
    fencedBlocks,
    headingEntries,
    headings,
    inlineCodeSpans: visibleSegments.flatMap((segment) => parseInlineCodeSpans(segment).spans),
    issues,
    tableColumnCounts,
    visibleContent: visibleContentParts.join(''),
    visibleLines,
  };
};

const parseInlineCodeSpans = (content) => {
  const masked = content.split('');
  const spans = [];
  let index = 0;

  while (index < content.length) {
    if (content[index] !== '`' || isEscaped(content, index)) {
      index += 1;
      continue;
    }

    let runLength = 1;

    while (content[index + runLength] === '`') {
      runLength += 1;
    }

    const delimiter = '`'.repeat(runLength);
    let closingIndex = content.indexOf(delimiter, index + runLength);

    while (
      closingIndex !== -1 &&
      (content[closingIndex - 1] === '`' || content[closingIndex + runLength] === '`')
    ) {
      closingIndex = content.indexOf(delimiter, closingIndex + runLength);
    }

    if (closingIndex === -1) {
      index += runLength;
      continue;
    }

    spans.push(content.slice(index + runLength, closingIndex));

    for (let maskIndex = index; maskIndex < closingIndex + runLength; maskIndex += 1) {
      if (masked[maskIndex] !== '\n' && masked[maskIndex] !== '\r') {
        masked[maskIndex] = ' ';
      }
    }

    index = closingIndex + runLength;
  }

  return {
    masked: masked.join(''),
    spans,
  };
};

const maskInlineCode = (line) => parseInlineCodeSpans(line).masked;

const isEscaped = (content, index) => {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && content[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
};

const parseLinkDestination = (content) => {
  let index = 0;

  while (/[\t ]/u.test(content[index] ?? '')) {
    index += 1;
  }

  if (content[index] === '<') {
    const closingIndex = content.indexOf('>', index + 1);

    return closingIndex === -1 ? undefined : content.slice(index + 1, closingIndex);
  }

  const start = index;
  let parenthesisDepth = 0;

  while (index < content.length) {
    const character = content[index];

    if (character === '\\') {
      index += 2;
      continue;
    }

    if (/[\t ]/u.test(character ?? '') && parenthesisDepth === 0) {
      break;
    }

    if (character === '(') {
      parenthesisDepth += 1;
    } else if (character === ')') {
      if (parenthesisDepth === 0) {
        break;
      }

      parenthesisDepth -= 1;
    }

    index += 1;
  }

  return content.slice(start, index);
};

const extractInlineLinks = (line) => {
  const masked = maskInlineCode(line);
  const links = [];

  for (let index = 0; index < masked.length - 1; index += 1) {
    const openingBracketIndex = masked.lastIndexOf('[', index);

    if (
      masked[index] !== ']' ||
      masked[index + 1] !== '(' ||
      isEscaped(masked, index) ||
      openingBracketIndex === -1 ||
      isEscaped(masked, openingBracketIndex)
    ) {
      continue;
    }

    let cursor = index + 2;
    let depth = 1;
    let quote;

    while (cursor < masked.length && depth > 0) {
      const character = masked[cursor];

      if (character === '\\') {
        cursor += 2;
        continue;
      }

      if (quote !== undefined) {
        if (character === quote) {
          quote = undefined;
        }
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
      }

      cursor += 1;
    }

    if (depth !== 0) {
      continue;
    }

    const destination = parseLinkDestination(line.slice(index + 2, cursor - 1));

    if (destination !== undefined) {
      links.push(destination);
    }

    index = cursor - 1;
  }

  return links;
};

const extractReferenceDefinition = (line) => {
  const match = /^ {0,3}\[[^\]\r\n]+\]:[\t ]*(?:<([^>\r\n]+)>|(\S+))/u.exec(maskInlineCode(line));

  return match?.[1] ?? match?.[2];
};

const unescapeMarkdownDestination = (destination) =>
  destination.replace(/\\([!"#$%&'()*+,./:;<=>?@[\\\]^_`{|}~-])/gu, '$1');

const decodeLinkPart = (value, label, addIssue) => {
  try {
    return decodeURIComponent(value);
  } catch {
    addIssue(`Invalid percent-encoding in relative link ${label}.`);
    return undefined;
  }
};

const githubSlug = (heading) =>
  heading
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, '')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/[`*_~]/gu, '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s_-]/gu, '')
    .replace(/\s+/gu, '-');

const collectMarkdownAnchors = (analysis) => {
  const anchors = new Set();
  const slugCounts = new Map();

  for (const heading of analysis.headings) {
    const baseSlug = githubSlug(heading);

    if (baseSlug === '') {
      continue;
    }

    const duplicateCount = slugCounts.get(baseSlug) ?? 0;
    const slug = duplicateCount === 0 ? baseSlug : `${baseSlug}-${String(duplicateCount)}`;

    slugCounts.set(baseSlug, duplicateCount + 1);
    anchors.add(slug);
  }

  for (const line of analysis.visibleLines) {
    if (/^(?: {4}|\t)/u.test(line.text)) {
      continue;
    }

    const visibleText = maskInlineCode(line.text);

    for (const match of visibleText.matchAll(
      /<[A-Za-z][A-Za-z0-9:-]*[^<>]*\s(?:id|name)=["']([^"']+)["'][^<>]*>/giu,
    )) {
      const anchor = match[1];

      if (
        match.index !== undefined &&
        !isEscaped(visibleText, match.index) &&
        anchor !== undefined &&
        anchor !== ''
      ) {
        anchors.add(anchor);
      }
    }
  }

  return anchors;
};

const describeInlineCodeSpanDifferences = (englishSpans, spanishSpans) => {
  const countSpans = (spans) => {
    const counts = new Map();

    for (const span of spans) {
      counts.set(span, (counts.get(span) ?? 0) + 1);
    }

    return counts;
  };
  const englishCounts = countSpans(englishSpans);
  const spanishCounts = countSpans(spanishSpans);
  const differingSpans = [...new Set([...englishCounts.keys(), ...spanishCounts.keys()])]
    .filter((span) => englishCounts.get(span) !== spanishCounts.get(span))
    .toSorted();
  const descriptions = differingSpans
    .slice(0, 5)
    .map(
      (span) =>
        `${JSON.stringify(span)} (English=${String(englishCounts.get(span) ?? 0)}, Spanish=${String(
          spanishCounts.get(span) ?? 0,
        )})`,
    );

  if (differingSpans.length > descriptions.length) {
    descriptions.push(`and ${String(differingSpans.length - descriptions.length)} more`);
  }

  return descriptions.join(', ');
};

const getSectionContent = (analysis, headingEntry) => {
  const nextHeading = analysis.headingEntries.find(
    (candidate) =>
      candidate.lineNumber > headingEntry.lineNumber && candidate.level <= headingEntry.level,
  );
  const endLineNumber = nextHeading?.lineNumber ?? Number.POSITIVE_INFINITY;

  return analysis.visibleLines
    .filter((line) => line.lineNumber > headingEntry.lineNumber && line.lineNumber < endLineNumber)
    .map((line) => line.text)
    .join('\n');
};

const hasSubstantiveText = (content) => (content.match(/\p{Letter}/gu)?.length ?? 0) >= 10;

const inspectRelativeLink = async ({
  addIssue,
  analysisFor,
  destination,
  filePath,
  lineNumber,
  rootDirectory,
}) => {
  const unescaped = unescapeMarkdownDestination(destination.trim());

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(unescaped) || unescaped.startsWith('//')) {
    return;
  }

  const hashIndex = unescaped.indexOf('#');
  const rawPathAndQuery = hashIndex === -1 ? unescaped : unescaped.slice(0, hashIndex);
  const rawFragment = hashIndex === -1 ? '' : unescaped.slice(hashIndex + 1);
  const queryIndex = rawPathAndQuery.indexOf('?');
  const rawPath = queryIndex === -1 ? rawPathAndQuery : rawPathAndQuery.slice(0, queryIndex);
  const linkLabel = `\`${destination}\` in ${displayPath(rootDirectory, filePath)}:${String(
    lineNumber,
  )}`;
  const decodedPath = decodeLinkPart(rawPath, linkLabel, addIssue);
  const decodedFragment = decodeLinkPart(rawFragment, linkLabel, addIssue);

  if (decodedPath === undefined || decodedFragment === undefined) {
    return;
  }

  const targetPath =
    decodedPath === ''
      ? filePath
      : decodedPath.startsWith('/')
        ? path.resolve(rootDirectory, decodedPath.slice(1).split('/').join(path.sep))
        : path.resolve(path.dirname(filePath), decodedPath.split('/').join(path.sep));

  if (!isWithinRoot(rootDirectory, targetPath)) {
    addIssue(`Relative link escapes the repository: ${linkLabel}.`);
    return;
  }

  let targetMetadata;
  let canonicalRoot;
  let canonicalTarget;

  try {
    [targetMetadata, canonicalRoot, canonicalTarget] = await Promise.all([
      stat(targetPath),
      realpath(rootDirectory),
      realpath(targetPath),
    ]);
  } catch (error) {
    if (isFileSystemError(error) && error.code === 'ENOENT') {
      addIssue(
        `Broken relative link ${linkLabel}; target ${displayPath(rootDirectory, targetPath)} does not exist.`,
      );
      return;
    }

    addIssue(`Unable to resolve relative link ${linkLabel}.`);
    return;
  }

  if (!isWithinRoot(canonicalRoot, canonicalTarget)) {
    addIssue(
      `Relative link resolves outside the repository through a symbolic link: ${linkLabel}.`,
    );
    return;
  }

  if (!targetMetadata.isFile() && !targetMetadata.isDirectory()) {
    addIssue(`Relative link target is not a regular file or directory: ${linkLabel}.`);
    return;
  }

  if (decodedFragment === '') {
    return;
  }

  if (!targetMetadata.isFile() || path.extname(targetPath).toLowerCase() !== '.md') {
    addIssue(`Markdown anchor targets a non-Markdown file: ${linkLabel}.`);
    return;
  }

  const targetAnalysis = await analysisFor(targetPath);

  if (targetAnalysis === undefined) {
    return;
  }

  const expectedAnchor = decodedFragment.replace(/^user-content-/u, '');
  const anchors = collectMarkdownAnchors(targetAnalysis);

  if (!anchors.has(expectedAnchor)) {
    addIssue(
      `Broken Markdown anchor ${linkLabel}; \`#${decodedFragment}\` was not found in ${displayPath(
        rootDirectory,
        targetPath,
      )}.`,
    );
  }
};

export const checkBilingualDocumentation = async (options = {}) => {
  const rootDirectory = path.resolve(options.rootDirectory ?? defaultRepositoryRoot);
  const pairs = options.pairs ?? (await createRequiredBilingualPairs(rootDirectory));
  const linkSources = [
    ...new Set(options.linkSources ?? createRequiredLinkSources(rootDirectory, pairs)),
  ];
  const issues = [];
  const issueSet = new Set();
  const contentCache = new Map();
  const analysisCache = new Map();
  const addIssue = (issue) => {
    if (!issueSet.has(issue)) {
      issueSet.add(issue);
      issues.push(issue);
    }
  };
  const readDocument = async (filePath, missingMessage) => {
    if (contentCache.has(filePath)) {
      return contentCache.get(filePath);
    }

    try {
      const [canonicalRoot, canonicalDocument] = await Promise.all([
        realpath(rootDirectory),
        realpath(filePath),
      ]);

      if (!isWithinRoot(canonicalRoot, canonicalDocument)) {
        addIssue(
          `Required Markdown document resolves outside the repository through a symbolic link: ${displayPath(
            rootDirectory,
            filePath,
          )}.`,
        );
        contentCache.set(filePath, undefined);
        return undefined;
      }

      const content = await readFile(filePath, 'utf8');

      contentCache.set(filePath, content);
      return content;
    } catch (error) {
      addIssue(
        isFileSystemError(error) && error.code === 'ENOENT'
          ? missingMessage
          : `Unable to read ${displayPath(rootDirectory, filePath)}.`,
      );
      contentCache.set(filePath, undefined);
      return undefined;
    }
  };
  const analysisFor = async (filePath, missingMessage) => {
    if (analysisCache.has(filePath)) {
      return analysisCache.get(filePath);
    }

    const content = await readDocument(
      filePath,
      missingMessage ?? `Missing Markdown link source: ${displayPath(rootDirectory, filePath)}.`,
    );

    if (content === undefined) {
      return undefined;
    }

    const analysis = analyzeMarkdown(content, displayPath(rootDirectory, filePath));

    for (const issue of analysis.issues) {
      addIssue(issue);
    }

    analysisCache.set(filePath, analysis);
    return analysis;
  };

  for (const documentRequirement of inlineBilingualDocuments) {
    const filePath = path.join(rootDirectory, documentRequirement.fileName);
    const analysis = await analysisFor(
      filePath,
      `Missing required inline bilingual document: ${documentRequirement.fileName}.`,
    );

    if (analysis === undefined) {
      continue;
    }

    for (const exactVisibleLine of documentRequirement.exactVisibleLines) {
      if (countExactVisibleLines(analysis, exactVisibleLine) !== 1) {
        addIssue(
          `${documentRequirement.fileName} must contain exactly one visible bilingual line: ${exactVisibleLine}`,
        );
      }
    }

    const visibleTextWithoutInlineCode = analysis.visibleLines
      .map((line) => maskInlineCode(line.text))
      .join('\n');

    for (const marker of documentRequirement.visibleMarkers) {
      if (!visibleTextWithoutInlineCode.includes(marker)) {
        addIssue(`${documentRequirement.fileName} is missing visible bilingual marker: ${marker}`);
      }
    }

    for (const sectionHeading of documentRequirement.sectionHeadings) {
      const matchingHeadings = analysis.headingEntries.filter(
        (heading) => heading.text === sectionHeading,
      );

      if (matchingHeadings.length !== 1) {
        addIssue(
          `${documentRequirement.fileName} must contain exactly one visible \`${sectionHeading}\` language section.`,
        );
        continue;
      }

      if (!hasSubstantiveText(getSectionContent(analysis, matchingHeadings[0]))) {
        addIssue(
          `${documentRequirement.fileName} has no substantive visible content in its \`${sectionHeading}\` language section.`,
        );
      }
    }
  }

  for (const { englishPath, spanishPath } of pairs) {
    const englishLabel = displayPath(rootDirectory, englishPath);
    const spanishLabel = displayPath(rootDirectory, spanishPath);
    const [englishContent, spanishContent] = await Promise.all([
      readDocument(
        englishPath,
        `Missing required English bilingual document: ${englishLabel} (pair: ${spanishLabel}).`,
      ),
      readDocument(
        spanishPath,
        `Missing required Spanish bilingual document: ${spanishLabel} (pair: ${englishLabel}).`,
      ),
    ]);

    if (englishContent === undefined || spanishContent === undefined) {
      continue;
    }

    const [englishAnalysis, spanishAnalysis] = await Promise.all([
      analysisFor(englishPath),
      analysisFor(spanishPath),
    ]);

    if (englishAnalysis === undefined || spanishAnalysis === undefined) {
      continue;
    }

    const englishTarget = toPortablePath(path.relative(path.dirname(englishPath), spanishPath));
    const spanishTarget = toPortablePath(path.relative(path.dirname(spanishPath), englishPath));
    const englishSelector = `[Español](${englishTarget}) | **English**`;
    const spanishSelector = `**Español** | [English](${spanishTarget})`;
    if (countExactVisibleLines(englishAnalysis, englishSelector) !== 1) {
      addIssue(
        `${englishLabel} must contain exactly one reciprocal language selector: ${englishSelector}`,
      );
    }

    if (countExactVisibleLines(spanishAnalysis, spanishSelector) !== 1) {
      addIssue(
        `${spanishLabel} must contain exactly one reciprocal language selector: ${spanishSelector}`,
      );
    }

    if (englishAnalysis.headingEntries.length !== spanishAnalysis.headingEntries.length) {
      addIssue(
        `Heading count mismatch for ${englishLabel} <-> ${spanishLabel}: English=${String(
          englishAnalysis.headingEntries.length,
        )}, Spanish=${String(spanishAnalysis.headingEntries.length)}.`,
      );
    }

    const englishHeadingLevels = englishAnalysis.headingEntries.map(({ level }) => level);
    const spanishHeadingLevels = spanishAnalysis.headingEntries.map(({ level }) => level);

    if (JSON.stringify(englishHeadingLevels) !== JSON.stringify(spanishHeadingLevels)) {
      addIssue(
        `Heading hierarchy mismatch for ${englishLabel} <-> ${spanishLabel}: English=${JSON.stringify(
          englishHeadingLevels,
        )}, Spanish=${JSON.stringify(spanishHeadingLevels)}.`,
      );
    }

    if (englishAnalysis.tableColumnCounts.length !== spanishAnalysis.tableColumnCounts.length) {
      addIssue(
        `Table count mismatch for ${englishLabel} <-> ${spanishLabel}: English=${String(
          englishAnalysis.tableColumnCounts.length,
        )}, Spanish=${String(spanishAnalysis.tableColumnCounts.length)}.`,
      );
    }

    if (
      JSON.stringify(englishAnalysis.tableColumnCounts) !==
      JSON.stringify(spanishAnalysis.tableColumnCounts)
    ) {
      addIssue(
        `Table shape mismatch for ${englishLabel} <-> ${spanishLabel}: English=${JSON.stringify(
          englishAnalysis.tableColumnCounts,
        )}, Spanish=${JSON.stringify(spanishAnalysis.tableColumnCounts)}.`,
      );
    }

    const englishCodeSpans = englishAnalysis.inlineCodeSpans.toSorted();
    const spanishCodeSpans = spanishAnalysis.inlineCodeSpans.toSorted();

    if (JSON.stringify(englishCodeSpans) !== JSON.stringify(spanishCodeSpans)) {
      addIssue(
        `Inline code-span multiset mismatch for ${englishLabel} <-> ${spanishLabel}: English=${String(
          englishCodeSpans.length,
        )}, Spanish=${String(
          spanishCodeSpans.length,
        )}; differing entries: ${describeInlineCodeSpanDifferences(
          englishCodeSpans,
          spanishCodeSpans,
        )}.`,
      );
    }

    if (englishAnalysis.fencedBlocks.length !== spanishAnalysis.fencedBlocks.length) {
      addIssue(
        `Fenced-block count mismatch for ${englishLabel} <-> ${spanishLabel}: English=${String(
          englishAnalysis.fencedBlocks.length,
        )}, Spanish=${String(spanishAnalysis.fencedBlocks.length)}.`,
      );
    }

    const comparableBlockCount = Math.min(
      englishAnalysis.fencedBlocks.length,
      spanishAnalysis.fencedBlocks.length,
    );

    for (let index = 0; index < comparableBlockCount; index += 1) {
      if (englishAnalysis.fencedBlocks[index] !== spanishAnalysis.fencedBlocks[index]) {
        addIssue(
          `Fenced block ${String(index + 1)} is not byte-identical for ${englishLabel} <-> ${spanishLabel}.`,
        );
      }
    }
  }

  for (const filePath of linkSources) {
    const analysis = await analysisFor(
      filePath,
      `Missing required Markdown link source: ${displayPath(rootDirectory, filePath)}.`,
    );

    if (analysis === undefined) {
      continue;
    }

    for (const line of analysis.visibleLines) {
      const destinations = extractInlineLinks(line.text);
      const referenceDestination = extractReferenceDefinition(line.text);

      if (referenceDestination !== undefined) {
        destinations.push(referenceDestination);
      }

      for (const destination of destinations) {
        await inspectRelativeLink({
          addIssue,
          analysisFor,
          destination,
          filePath,
          lineNumber: line.lineNumber,
          rootDirectory,
        });
      }
    }
  }

  if (issues.length > 0) {
    throw new Error(
      `UXAudit bilingual documentation check failed with ${String(issues.length)} issue(s):\n${issues
        .map((issue) => `- ${issue}`)
        .join('\n')}`,
    );
  }

  return {
    linkSourceCount: linkSources.length,
    pairCount: pairs.length,
  };
};

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === scriptPath) {
  try {
    const result = await checkBilingualDocumentation();

    console.log(
      `UXAudit bilingual documentation check: PASS (${String(result.pairCount)} pairs, ${String(
        result.linkSourceCount,
      )} link sources)`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Bilingual documentation check failed.');
    process.exitCode = 1;
  }
}
