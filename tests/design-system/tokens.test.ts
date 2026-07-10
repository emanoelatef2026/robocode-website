import { describe, it, expect } from 'vitest'
import { STATUS_BUCKET_KEYS, SEMANTIC_STATUS_COLOR } from '@/design-system/tokens/semantic/color'
import { PRIMITIVE_COLOR } from '@/design-system/tokens/primitive/color'
import { APPLICATION_DENSITY } from '@/design-system/tokens/application'
import { DENSITY_KEYS } from '@/design-system/foundation/density'
import { PORTAL_KEYS } from '@/design-system/tokens/types'

// ── Semantic layer must only ever reference values that exist on Primitive ─────
// (DSA §5.7: a Screen/Component never sees a raw hex outside a Semantic Token)

describe('Semantic Token contract', () => {
  it('defines all six StatusBadge buckets (DESIGN.md §3)', () => {
    expect(STATUS_BUCKET_KEYS).toHaveLength(6)
    for (const bucket of STATUS_BUCKET_KEYS) {
      expect(SEMANTIC_STATUS_COLOR[bucket]).toBeDefined()
    }
  })

  it('every semantic status color resolves to a known Primitive hex', () => {
    const primitiveHexes = new Set<string>(Object.values(PRIMITIVE_COLOR))
    for (const bucket of STATUS_BUCKET_KEYS) {
      const { bg, text, dot } = SEMANTIC_STATUS_COLOR[bucket]
      expect(primitiveHexes.has(bg)).toBe(true)
      expect(primitiveHexes.has(text)).toBe(true)
      expect(primitiveHexes.has(dot)).toBe(true)
    }
  })
})

describe('Application Token — density-to-persona mapping (DSA §9.3)', () => {
  it('every portal has a density assignment', () => {
    for (const portal of PORTAL_KEYS) {
      expect(DENSITY_KEYS).toContain(APPLICATION_DENSITY[portal].default)
    }
  })

  it('Instructor and Student default to touch density, unconditionally', () => {
    expect(APPLICATION_DENSITY.instructor.default).toBe('touch')
    expect(APPLICATION_DENSITY.student.default).toBe('touch')
  })
})
