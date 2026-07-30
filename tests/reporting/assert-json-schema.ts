export type JsonSchemaRegistry = Readonly<Record<string, unknown>>;

interface JsonSchemaRecord extends Readonly<Record<string, unknown>> {
  readonly $ref?: unknown;
  readonly additionalProperties?: unknown;
  readonly const?: unknown;
  readonly enum?: unknown;
  readonly format?: unknown;
  readonly items?: unknown;
  readonly minItems?: unknown;
  readonly minLength?: unknown;
  readonly minimum?: unknown;
  readonly oneOf?: unknown;
  readonly pattern?: unknown;
  readonly properties?: unknown;
  readonly required?: unknown;
  readonly type?: unknown;
  readonly uniqueItems?: unknown;
}

export class JsonSchemaAssertionError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'JsonSchemaAssertionError';
  }
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepEqual = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const fail = (path: string, reason: string): never => {
  throw new JsonSchemaAssertionError(`${path}: ${reason}`);
};

const resolvePointer = (root: unknown, reference: string): unknown => {
  if (reference === '#') {
    return root;
  }

  if (!reference.startsWith('#/')) {
    throw new JsonSchemaAssertionError(`$schema: unsupported local reference ${reference}`);
  }

  let current = root;

  for (const encodedSegment of reference.slice(2).split('/')) {
    const segment = encodedSegment.replaceAll('~1', '/').replaceAll('~0', '~');

    if (!isRecord(current)) {
      throw new JsonSchemaAssertionError(`$schema: unresolved local reference ${reference}`);
    }

    const next = current[segment];

    if (next === undefined) {
      throw new JsonSchemaAssertionError(`$schema: unresolved local reference ${reference}`);
    }

    current = next;
  }

  return current;
};

const matchesType = (value: unknown, type: string): boolean => {
  switch (type) {
    case 'array':
      return Array.isArray(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return typeof value === 'number' && Number.isSafeInteger(value);
    case 'null':
      return value === null;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'object':
      return isRecord(value);
    case 'string':
      return typeof value === 'string';
    default:
      return false;
  }
};

const requireSchemaArray = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new JsonSchemaAssertionError(`$schema: ${path} must be an array`);
  }

  return value;
};

const requireSchemaRecord = (value: unknown, path: string): JsonSchemaRecord => {
  if (!isRecord(value)) {
    throw new JsonSchemaAssertionError(`$schema: ${path} must be an object`);
  }

  return value;
};

const validate = (
  value: unknown,
  schemaValue: unknown,
  rootSchema: unknown,
  registry: JsonSchemaRegistry,
  path: string,
): void => {
  if (typeof schemaValue === 'boolean') {
    if (!schemaValue) {
      fail(path, 'boolean schema rejected the value');
    }
    return;
  }

  const schema = requireSchemaRecord(schemaValue, path);

  const reference = schema.$ref;

  if (reference !== undefined) {
    if (typeof reference !== 'string') {
      throw new JsonSchemaAssertionError(`$schema: ${path} has a non-string $ref`);
    }

    if (reference.startsWith('#')) {
      validate(value, resolvePointer(rootSchema, reference), rootSchema, registry, path);
      return;
    }

    const externalSchema = registry[reference];

    if (externalSchema === undefined) {
      fail('$schema', `unresolved external reference ${reference}`);
    }

    validate(value, externalSchema, externalSchema, registry, path);
    return;
  }

  if ('const' in schema && !deepEqual(value, schema.const)) {
    fail(path, 'value does not match const');
  }

  const enumValues = schema.enum;

  if (
    enumValues !== undefined &&
    !requireSchemaArray(enumValues, 'enum').some((candidate) => deepEqual(value, candidate))
  ) {
    fail(path, 'value is not in enum');
  }

  const oneOf = schema.oneOf;

  if (oneOf !== undefined) {
    let matches = 0;

    for (const candidate of requireSchemaArray(oneOf, 'oneOf')) {
      try {
        validate(value, candidate, rootSchema, registry, path);
        matches += 1;
      } catch (error) {
        if (!(error instanceof JsonSchemaAssertionError)) {
          throw error;
        }
      }
    }

    if (matches !== 1) {
      fail(path, `expected exactly one oneOf match, received ${String(matches)}`);
    }

    return;
  }

  const declaredType = schema.type;

  if (declaredType !== undefined) {
    const declaredTypes =
      typeof declaredType === 'string'
        ? [declaredType]
        : requireSchemaArray(declaredType, 'type').map((type) => {
            if (typeof type !== 'string') {
              throw new JsonSchemaAssertionError('$schema: type array contains a non-string value');
            }
            return type;
          });

    if (!declaredTypes.some((type) => matchesType(value, type))) {
      fail(path, `value does not match type ${declaredTypes.join('|')}`);
    }
  }

  if (isRecord(value)) {
    const required = schema.required;

    if (required !== undefined) {
      for (const property of requireSchemaArray(required, 'required')) {
        if (typeof property !== 'string' || !(property in value)) {
          fail(path, `missing required property ${String(property)}`);
        }
      }
    }

    const propertiesValue = schema.properties;
    const properties = propertiesValue === undefined ? {} : propertiesValue;
    const propertySchemas = requireSchemaRecord(properties, 'properties');

    for (const [property, child] of Object.entries(value)) {
      const propertySchema = propertySchemas[property];

      if (propertySchema !== undefined) {
        validate(child, propertySchema, rootSchema, registry, `${path}.${property}`);
      } else if (schema.additionalProperties === false) {
        fail(path, `unexpected property ${property}`);
      }
    }
  }

  if (Array.isArray(value)) {
    const minimumItems = schema.minItems;

    if (
      minimumItems !== undefined &&
      (typeof minimumItems !== 'number' || value.length < minimumItems)
    ) {
      fail(path, 'array is shorter than minItems');
    }

    if (
      schema.uniqueItems === true &&
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    ) {
      fail(path, 'array items are not unique');
    }

    const itemSchema = schema.items;

    if (itemSchema !== undefined) {
      value.forEach((item, index) => {
        validate(item, itemSchema, rootSchema, registry, `${path}[${String(index)}]`);
      });
    }
  }

  if (typeof value === 'string') {
    const minimumLength = schema.minLength;

    if (
      minimumLength !== undefined &&
      (typeof minimumLength !== 'number' || value.length < minimumLength)
    ) {
      fail(path, 'string is shorter than minLength');
    }

    const pattern = schema.pattern;

    if (pattern !== undefined) {
      if (typeof pattern !== 'string' || !new RegExp(pattern, 'u').test(value)) {
        fail(path, 'string does not match pattern');
      }
    }

    if (
      schema.format === 'date-time' &&
      (!Number.isFinite(Date.parse(value)) || new Date(Date.parse(value)).toISOString() !== value)
    ) {
      fail(path, 'string is not a canonical date-time');
    }
  }

  if (typeof value === 'number') {
    const minimum = schema.minimum;

    if (minimum !== undefined && (typeof minimum !== 'number' || value < minimum)) {
      fail(path, 'number is below minimum');
    }
  }
};

export const assertMatchesJsonSchema = (
  value: unknown,
  schema: unknown,
  registry: JsonSchemaRegistry = {},
): void => {
  validate(value, schema, schema, registry, '$');
};
