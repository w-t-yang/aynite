/**
 * Lightweight JSON Schema (Draft-07) validator.
 *
 * Handles the subset of JSON Schema features used by view configs:
 *   - type (string | number | object | array | boolean | integer)
 *   - required
 *   - properties (with per-property schemas)
 *   - items (array item schema)
 *   - minItems
 *   - anyOf
 *   - enum
 *   - patternProperties (object key patterns)
 */

interface ValidationResult {
  valid: boolean
  errors: string[]
}

function addError(errors: string[], path: string, message: string) {
  errors.push(`at ${path || '<root>'}: ${message}`)
}

/**
 * Validate `data` against a JSON Schema.
 * Returns { valid, errors }.
 */
export function validateJsonSchema(
  data: unknown,
  schema: any,
): ValidationResult {
  const errors: string[] = []
  validate(data, schema, '', errors)
  return { valid: errors.length === 0, errors }
}

function validate(
  data: unknown,
  schema: any,
  path: string,
  errors: string[],
): void {
  if (schema === undefined || schema === null) return

  // ── anyOf ──────────────────────────────────────────────────────────────
  if (Array.isArray(schema.anyOf)) {
    const subErrors: string[][] = []
    for (const alt of schema.anyOf) {
      const inner: string[] = []
      validate(data, alt, path, inner)
      if (inner.length === 0) return // passed one of them
      subErrors.push(inner)
    }
    addError(
      errors,
      path,
      `does not match any schema in anyOf: ${subErrors.map((e) => e.join('; ')).join(' || ')}`,
    )
    return
  }

  // ── type ───────────────────────────────────────────────────────────────
  if (schema.type !== undefined) {
    const typeOk = checkType(data, schema.type)
    if (!typeOk) {
      addError(errors, path, `expected type ${schema.type}, got ${typeof data}`)
      return // skip further checks if type is wrong
    }
  }

  // ── enum ───────────────────────────────────────────────────────────────
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      addError(
        errors,
        path,
        `value must be one of: ${JSON.stringify(schema.enum)}`,
      )
    }
    return // enum implies full value validation, no further checks needed
  }

  // ── object checks ──────────────────────────────────────────────────────
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          addError(errors, path, `missing required property "${key}"`)
        }
      }
    }

    // properties
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validate(obj[key], propSchema, path ? `${path}.${key}` : key, errors)
        }
      }
    }

    // patternProperties
    if (
      schema.patternProperties &&
      typeof schema.patternProperties === 'object'
    ) {
      for (const [patternStr, propSchema] of Object.entries(
        schema.patternProperties,
      )) {
        const regex = new RegExp(patternStr)
        for (const key of Object.keys(obj)) {
          if (regex.test(key)) {
            validate(
              obj[key],
              propSchema,
              path ? `${path}.${key}` : key,
              errors,
            )
          }
        }
      }
    }
  }

  // ── array checks ───────────────────────────────────────────────────────
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      addError(
        errors,
        path,
        `expected at least ${schema.minItems} items, got ${data.length}`,
      )
    }

    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        validate(data[i], schema.items, `${path}[${i}]`, errors)
      }
    }
  }
}

function checkType(data: unknown, expected: string): boolean {
  switch (expected) {
    case 'string':
      return typeof data === 'string'
    case 'number':
      return typeof data === 'number' && !Number.isNaN(data)
    case 'integer':
      return Number.isInteger(data)
    case 'boolean':
      return typeof data === 'boolean'
    case 'object':
      return typeof data === 'object' && data !== null && !Array.isArray(data)
    case 'array':
      return Array.isArray(data)
    default:
      return true
  }
}
