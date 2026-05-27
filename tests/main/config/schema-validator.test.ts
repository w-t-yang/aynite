import { describe, expect, it } from 'vitest'
import {
  checkSchemaType,
  validateAgainstSchema,
} from '../../../src/main/config/schema-validator'

// ─── checkSchemaType ────────────────────────────────────────────────────

describe('checkSchemaType', () => {
  it('validates string type', () => {
    expect(checkSchemaType('hello', 'string')).toBe(true)
    expect(checkSchemaType('', 'string')).toBe(true)
    expect(checkSchemaType(42, 'string')).toBe(false)
    expect(checkSchemaType(null, 'string')).toBe(false)
  })

  it('validates number type', () => {
    expect(checkSchemaType(42, 'number')).toBe(true)
    expect(checkSchemaType(0, 'number')).toBe(true)
    expect(checkSchemaType(-3.14, 'number')).toBe(true)
    expect(checkSchemaType(NaN, 'number')).toBe(false)
    expect(checkSchemaType('42', 'number')).toBe(false)
  })

  it('validates integer type', () => {
    expect(checkSchemaType(42, 'integer')).toBe(true)
    expect(checkSchemaType(0, 'integer')).toBe(true)
    expect(checkSchemaType(-3, 'integer')).toBe(true)
    expect(checkSchemaType(3.14, 'integer')).toBe(false)
    expect(checkSchemaType('42', 'integer')).toBe(false)
  })

  it('validates boolean type', () => {
    expect(checkSchemaType(true, 'boolean')).toBe(true)
    expect(checkSchemaType(false, 'boolean')).toBe(true)
    expect(checkSchemaType(1, 'boolean')).toBe(false)
    expect(checkSchemaType('true', 'boolean')).toBe(false)
  })

  it('validates object type', () => {
    expect(checkSchemaType({}, 'object')).toBe(true)
    expect(checkSchemaType({ key: 'value' }, 'object')).toBe(true)
    expect(checkSchemaType([], 'object')).toBe(false) // arrays are not objects
    expect(checkSchemaType(null, 'object')).toBe(false)
  })

  it('validates array type', () => {
    expect(checkSchemaType([], 'array')).toBe(true)
    expect(checkSchemaType([1, 2, 3], 'array')).toBe(true)
    expect(checkSchemaType({}, 'array')).toBe(false)
    expect(checkSchemaType('', 'array')).toBe(false)
  })

  it('returns true for unknown type', () => {
    expect(checkSchemaType('anything', 'unknown_type')).toBe(true)
    expect(checkSchemaType(42, '')).toBe(true)
  })
})

// ─── validateAgainstSchema ──────────────────────────────────────────────

describe('validateAgainstSchema', () => {
  describe('nil schema', () => {
    it('returns true for null schema', () => {
      expect(validateAgainstSchema('anything', null)).toBe(true)
    })

    it('returns true for undefined schema', () => {
      expect(validateAgainstSchema('anything', undefined)).toBe(true)
    })

    it('returns true for non-object schema', () => {
      expect(validateAgainstSchema('anything', 'not-a-schema')).toBe(true)
    })
  })

  describe('type validation', () => {
    it('passes when data matches type', () => {
      expect(validateAgainstSchema('hello', { type: 'string' })).toBe(true)
      expect(validateAgainstSchema(42, { type: 'number' })).toBe(true)
      expect(validateAgainstSchema(true, { type: 'boolean' })).toBe(true)
    })

    it('fails when data does not match type', () => {
      expect(validateAgainstSchema(42, { type: 'string' })).toBe(false)
      expect(validateAgainstSchema('hello', { type: 'number' })).toBe(false)
    })
  })

  describe('required fields', () => {
    it('passes when all required fields present', () => {
      const schema = {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      }
      expect(validateAgainstSchema({ name: 'test', value: 42 }, schema)).toBe(
        true,
      )
    })

    it('fails when a required field is missing', () => {
      const schema = {
        type: 'object',
        required: ['name', 'value'],
        properties: {
          name: { type: 'string' },
          value: { type: 'number' },
        },
      }
      expect(validateAgainstSchema({ name: 'test' }, schema)).toBe(false)
    })
  })

  describe('nested properties', () => {
    it('validates nested object properties', () => {
      const schema = {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'number' },
              label: { type: 'string' },
            },
          },
        },
      }
      expect(
        validateAgainstSchema({ data: { id: 1, label: 'x' } }, schema),
      ).toBe(true)
    })

    it('fails when nested property has wrong type', () => {
      const schema = {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              id: { type: 'number' },
            },
          },
        },
      }
      expect(
        validateAgainstSchema({ data: { id: 'not-a-number' } }, schema),
      ).toBe(false)
    })
  })

  describe('enum', () => {
    it('passes when value is in enum', () => {
      expect(
        validateAgainstSchema('red', {
          type: 'string',
          enum: ['red', 'green', 'blue'],
        }),
      ).toBe(true)
    })

    it('fails when value is not in enum', () => {
      expect(
        validateAgainstSchema('yellow', {
          type: 'string',
          enum: ['red', 'green', 'blue'],
        }),
      ).toBe(false)
    })
  })

  describe('anyOf', () => {
    it('passes when data matches any alternative', () => {
      const schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validateAgainstSchema('hello', schema)).toBe(true)
      expect(validateAgainstSchema(42, schema)).toBe(true)
    })

    it('fails when data matches none of the alternatives', () => {
      const schema = {
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }
      expect(validateAgainstSchema(true, schema)).toBe(false)
    })
  })

  describe('arrays', () => {
    it('validates array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' },
      }
      expect(validateAgainstSchema([1, 2, 3], schema)).toBe(true)
      expect(validateAgainstSchema([1, 'x', 3], schema)).toBe(false)
    })

    it('validates minItems', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' },
        minItems: 2,
      }
      expect(validateAgainstSchema([1, 2], schema)).toBe(true)
      expect(validateAgainstSchema([1], schema)).toBe(false)
    })
  })

  describe('patternProperties', () => {
    it('validates properties matching a regex pattern', () => {
      const schema = {
        type: 'object',
        patternProperties: {
          '^color_': { type: 'string' },
        },
      }
      const obj = {
        color_primary: '#fff',
        color_secondary: '#000',
        name: 'foo',
      }
      expect(validateAgainstSchema(obj, schema)).toBe(true)
    })

    it('fails when a matching property has wrong type', () => {
      const schema = {
        type: 'object',
        patternProperties: {
          '^color_': { type: 'string' },
        },
      }
      const obj = { color_primary: 123 }
      expect(validateAgainstSchema(obj, schema)).toBe(false)
    })
  })

  describe('real-world schemas (dataviews)', () => {
    it('validates DataViewChart schema', () => {
      const schema = {
        type: 'object',
        required: ['keys', 'data'],
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
              },
            },
            minItems: 1,
          },
        },
      }
      const valid = {
        keys: ['Features', 'Fixes'],
        data: [
          { name: 'Day 1', Features: 5, Fixes: 2 },
          { name: 'Day 2', Features: 3, Fixes: 1 },
        ],
      }
      expect(validateAgainstSchema(valid, schema)).toBe(true)

      const invalid = { keys: 'not-an-array', data: [] }
      expect(validateAgainstSchema(invalid, schema)).toBe(false)
    })

    it('validates DataViewGraph schema', () => {
      const schema = {
        type: 'object',
        required: ['nodes', 'links'],
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'label'],
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
              },
            },
          },
          links: {
            type: 'array',
            items: {
              type: 'object',
              required: ['source', 'target'],
              properties: {
                source: { type: 'string' },
                target: { type: 'string' },
              },
            },
          },
        },
      }
      const valid = {
        nodes: [{ id: 'a', label: 'Node A' }],
        links: [{ source: 'a', target: 'b' }],
      }
      expect(validateAgainstSchema(valid, schema)).toBe(true)

      const invalid = {
        nodes: [{ id: 'a' }], // missing label
        links: [],
      }
      expect(validateAgainstSchema(invalid, schema)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('validates additional properties are ignored (not rejected)', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      }
      expect(
        validateAgainstSchema({ name: 'test', extra: 'field' }, schema),
      ).toBe(true)
    })

    it('handles nested arrays', () => {
      const schema = {
        type: 'object',
        properties: {
          matrix: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' },
            },
          },
        },
      }
      expect(
        validateAgainstSchema(
          {
            matrix: [
              [1, 2],
              [3, 4],
            ],
          },
          schema,
        ),
      ).toBe(true)
      expect(
        validateAgainstSchema(
          {
            matrix: [
              [1, 'x'],
              [3, 4],
            ],
          },
          schema,
        ),
      ).toBe(false)
    })
  })
})
