/**
 * JSON Schema validation helpers (main-process compatible).
 * Supports a subset of Draft-07 sufficient for dataview config schemas.
 *
 * Extracted from router.ts for testability.
 */

export function checkSchemaType(data: unknown, expected: string): boolean {
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

export function validateAgainstSchema(data: unknown, schema: any): boolean {
  if (!schema || typeof schema !== 'object') return true

  // anyOf
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.some((alt: any) => validateAgainstSchema(data, alt))
  }

  // type check
  if (schema.type !== undefined) {
    if (!checkSchemaType(data, schema.type)) return false
  }

  // enum check
  if (Array.isArray(schema.enum)) {
    return schema.enum.includes(data)
  }

  // object checks
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in obj)) return false
      }
    }

    // properties
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          if (!validateAgainstSchema(obj[key], propSchema)) return false
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
            if (!validateAgainstSchema(obj[key], propSchema)) return false
          }
        }
      }
    }
  }

  // array checks
  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      return false
    if (schema.items) {
      for (const item of data) {
        if (!validateAgainstSchema(item, schema.items)) return false
      }
    }
  }

  return true
}
