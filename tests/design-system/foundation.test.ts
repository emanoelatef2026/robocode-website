import { describe, it, expect } from 'vitest'
import { SPACING_SCALE_KEYS } from '@/design-system/foundation/spacing'
import { PRIMITIVE_SPACING } from '@/design-system/tokens/primitive/spacing'
import { RADIUS_SCALE_KEYS } from '@/design-system/foundation/radius'
import { PRIMITIVE_RADIUS } from '@/design-system/tokens/primitive/radius'
import { Z_INDEX_LAYER_KEYS } from '@/design-system/foundation/z-index'
import { PRIMITIVE_Z_INDEX } from '@/design-system/tokens/primitive/z-index'
import { BREAKPOINT_KEYS } from '@/design-system/foundation/breakpoints'
import { PRIMITIVE_BREAKPOINT } from '@/design-system/tokens/primitive/breakpoint'

// ── Every Foundation schema key must be filled by the Primitive layer ──────────
// (DSA §4: Foundation defines categories; the Token layer assigns values)

describe('Foundation → Primitive contract', () => {
  it('every spacing scale key has a primitive value', () => {
    for (const key of SPACING_SCALE_KEYS) {
      expect(PRIMITIVE_SPACING[key]).toBeDefined()
    }
  })

  it('every radius scale key has a primitive value', () => {
    for (const key of RADIUS_SCALE_KEYS) {
      expect(PRIMITIVE_RADIUS[key]).toBeDefined()
    }
  })

  it('z-index layers are strictly increasing in the declared order', () => {
    const values = Z_INDEX_LAYER_KEYS.map((key) => PRIMITIVE_Z_INDEX[key])
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })

  it('breakpoints are strictly increasing mobile → wide', () => {
    const values = BREAKPOINT_KEYS.map((key) => PRIMITIVE_BREAKPOINT[key])
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })
})
