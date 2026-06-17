// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { validateJsonSchema } from '../../../../src/renderer/shared/lib/schema-validator'

// ─── type checks ──────────────────────────────────────────────────────

describe('validateJsonSchema — type checks', () => {
  it('validates string type correctly', () => {
    const schema = { type: 'string' }
    expect(validateJsonSchema('hello', schema).valid).toBe(true)
    expect(validateJsonSchema(42, schema).valid).toBe(false)
    expect(validateJsonSchema(null, schema).valid).toBe(false)
  })

  it('validates number type correctly', () => {
    const schema = { type: 'number' }
    expect(validateJsonSchema(42, schema).valid).toBe(true)
    expect(validateJsonSchema(3.14, schema).valid).toBe(true)
    expect(validateJsonSchema('42', schema).valid).toBe(false)
    expect(validateJsonSchema(NaN, schema).valid).toBe(false)
  })

  it('validates integer type correctly', () => {
    const schema = { type: 'integer' }
    expect(validateJsonSchema(42, schema).valid).toBe(true)
    expect(validateJsonSchema(3.14, schema).valid).toBe(false)
    expect(validateJsonSchema('42', schema).valid).toBe(false)
  })

  it('validates boolean type correctly', () => {
    const schema = { type: 'boolean' }
    expect(validateJsonSchema(true, schema).valid).toBe(true)
    expect(validateJsonSchema(false, schema).valid).toBe(true)
    expect(validateJsonSchema('true', schema).valid).toBe(false)
    expect(validateJsonSchema(1, schema).valid).toBe(false)
  })

  it('validates object type correctly', () => {
    const schema = { type: 'object' }
    expect(validateJsonSchema({ key: 'val' }, schema).valid).toBe(true)
    expect(validateJsonSchema(null, schema).valid).toBe(false)
    expect(validateJsonSchema([], schema).valid).toBe(false)
    expect(validateJsonSchema('string', schema).valid).toBe(false)
  })

  it('validates array type correctly', () => {
    const schema = { type: 'array' }
    expect(validateJsonSchema([1, 2, 3], schema).valid).toBe(true)
    expect(validateJsonSchema({}, schema).valid).toBe(false)
    expect(validateJsonSchema('string', schema).valid).toBe(false)
  })

  it('passes when type is undefined', () => {
    const schema = {}
    expect(validateJsonSchema('anything', schema).valid).toBe(true)
    expect(validateJsonSchema(42, schema).valid).toBe(true)
  })
})

// ─── required ─────────────────────────────────────────────────────────

describe('validateJsonSchema — required', () => {
  it('passes when all required properties are present', () => {
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    }
    const result = validateJsonSchema({ name: 'Alice', age: 30 }, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('reports missing required properties', () => {
    const schema = {
      type: 'object',
      required: ['name', 'age'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    }
    const result = validateJsonSchema({ name: 'Alice' }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('age'))).toBe(true)
  })

  it('reports multiple missing required properties', () => {
    const schema = {
      type: 'object',
      required: ['a', 'b', 'c'],
    }
    const result = validateJsonSchema({ a: 1 }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── nested properties ────────────────────────────────────────────────

describe('validateJsonSchema — nested properties', () => {
  it('validates nested object properties recursively', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            zip: { type: 'string' },
          },
          required: ['city'],
        },
      },
    }
    const valid = validateJsonSchema(
      { name: 'Alice', address: { city: 'NYC', zip: '10001' } },
      schema,
    )
    expect(valid.valid).toBe(true)

    const invalid = validateJsonSchema(
      { name: 'Alice', address: { zip: '10001' } },
      schema,
    )
    expect(invalid.valid).toBe(false)
    expect(invalid.errors.some((e) => e.includes('city'))).toBe(true)
  })

  it('validates deep nesting', () => {
    const schema = {
      type: 'object',
      properties: {
        a: {
          type: 'object',
          properties: {
            b: {
              type: 'object',
              properties: {
                c: { type: 'number' },
              },
              required: ['c'],
            },
          },
        },
      },
    }
    expect(validateJsonSchema({ a: { b: { c: 42 } } }, schema).valid).toBe(true)
    expect(validateJsonSchema({ a: { b: {} } }, schema).valid).toBe(false)
  })

  it('ignores properties not in schema', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    }
    const result = validateJsonSchema(
      { name: 'Alice', extra: 'ignored' },
      schema,
    )
    expect(result.valid).toBe(true)
  })
})

// ─── anyOf ────────────────────────────────────────────────────────────

describe('validateJsonSchema — anyOf', () => {
  it('passes when data matches any of the schemas', () => {
    const schema = {
      anyOf: [{ type: 'string' }, { type: 'number' }],
    }
    expect(validateJsonSchema('hello', schema).valid).toBe(true)
    expect(validateJsonSchema(42, schema).valid).toBe(true)
  })

  it('fails when data matches none of the schemas', () => {
    const schema = {
      anyOf: [{ type: 'string' }, { type: 'number' }],
    }
    const result = validateJsonSchema(true, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('passes when nested anyOf with object schemas match', () => {
    const schema = {
      anyOf: [
        { type: 'object', required: ['name'] },
        { type: 'object', required: ['id'] },
      ],
    }
    expect(validateJsonSchema({ name: 'Alice' }, schema).valid).toBe(true)
    expect(validateJsonSchema({ id: 1 }, schema).valid).toBe(true)
    expect(validateJsonSchema({ name: 'Alice', id: 1 }, schema).valid).toBe(
      true,
    ) // matches first
  })
})

// ─── enum ─────────────────────────────────────────────────────────────

describe('validateJsonSchema — enum', () => {
  it('passes when value is in enum', () => {
    const schema = { enum: ['red', 'green', 'blue'] }
    expect(validateJsonSchema('red', schema).valid).toBe(true)
    expect(validateJsonSchema('blue', schema).valid).toBe(true)
  })

  it('fails when value is not in enum', () => {
    const schema = { enum: ['red', 'green', 'blue'] }
    const result = validateJsonSchema('yellow', schema)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('red')
    expect(result.errors[0]).toContain('green')
  })
})

// ─── arrays ───────────────────────────────────────────────────────────

describe('validateJsonSchema — arrays', () => {
  it('validates array items against schema', () => {
    const schema = {
      type: 'array',
      items: { type: 'number' },
    }
    expect(validateJsonSchema([1, 2, 3], schema).valid).toBe(true)
    expect(validateJsonSchema([1, 'two', 3], schema).valid).toBe(false)
  })

  it('validates minItems constraint', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
    }
    expect(validateJsonSchema(['a', 'b'], schema).valid).toBe(true)
    expect(validateJsonSchema(['a'], schema).valid).toBe(false)
  })

  it('validates array of objects', () => {
    const schema = {
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'integer' },
        },
      },
    }
    expect(validateJsonSchema([{ id: 1 }, { id: 2 }], schema).valid).toBe(true)
    expect(validateJsonSchema([{ id: 1 }, { name: 'x' }], schema).valid).toBe(
      false,
    )
  })
})

// ─── patternProperties ────────────────────────────────────────────────

describe('validateJsonSchema — patternProperties', () => {
  it('validates properties matching regex pattern', () => {
    const schema = {
      type: 'object',
      patternProperties: {
        '^S_': { type: 'string' },
      },
    }
    expect(
      validateJsonSchema({ S_name: 'Alice', S_title: 'Engineer' }, schema)
        .valid,
    ).toBe(true)
    expect(validateJsonSchema({ S_name: 42 }, schema).valid).toBe(false)
  })

  it('only validates keys matching the pattern', () => {
    const schema = {
      type: 'object',
      patternProperties: {
        '^num_': { type: 'number' },
      },
    }
    // 'text_key' doesn't match ^num_, so it's not validated
    const result = validateJsonSchema(
      { num_count: 5, text_key: 'should be ignored' },
      schema,
    )
    expect(result.valid).toBe(true)
  })
})

// ─── edge cases ───────────────────────────────────────────────────────

describe('validateJsonSchema — edge cases', () => {
  it('handles null/undefined schema', () => {
    expect(validateJsonSchema('anything', null).valid).toBe(true)
    expect(validateJsonSchema('anything', undefined).valid).toBe(true)
  })

  it('reports errors with path information', () => {
    const schema = {
      type: 'object',
      properties: {
        user: {
          type: 'object',
          properties: {
            age: { type: 'integer' },
          },
        },
      },
    }
    const result = validateJsonSchema({ user: { age: 'not-a-number' } }, schema)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/user\.age/)
  })

  it('handles empty object schema', () => {
    const schema = { type: 'object', properties: {} }
    expect(validateJsonSchema({}, schema).valid).toBe(true)
    expect(validateJsonSchema({ a: 1 }, schema).valid).toBe(true)
  })
})
