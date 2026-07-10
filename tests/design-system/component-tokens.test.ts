import { describe, it, expect } from 'vitest'
import { COMPONENT_TOKENS } from '@/design-system/tokens/component'
import { LIGHT_SEMANTIC_COLOR } from '@/design-system/tokens/semantic/color'
import { SEMANTIC_RADIUS } from '@/design-system/tokens/semantic/radius'
import { SEMANTIC_ELEVATION } from '@/design-system/tokens/semantic/elevation'

// ── Component Tokens must only ever reference Semantic Tokens, never a raw
// Primitive value directly (DSA §5.7) — every registered resolver is run
// against the real Light Theme context and asserted to produce values that
// exist somewhere in that Semantic layer.

const SHIPPED_PRIMITIVES = [
  'Button', 'IconButton', 'Label', 'Input', 'EmailInput', 'PasswordInput',
  'SearchInput', 'NumberInput', 'Textarea', 'Select', 'Checkbox', 'Radio',
  'Switch', 'Badge', 'Avatar', 'Spinner', 'Skeleton', 'Progress',
  'LoadingIndicator', 'Tooltip', 'Divider', 'Separator', 'ScrollArea',
]

describe('Component Token registry (Sprint 2)', () => {
  it('has a registered resolver for every shipped Primitive', () => {
    for (const name of SHIPPED_PRIMITIVES) {
      expect(COMPONENT_TOKENS[name]).toBeTypeOf('function')
    }
  })

  it('every resolver runs against the Light Theme context without throwing', () => {
    const ctx = { color: LIGHT_SEMANTIC_COLOR, radius: SEMANTIC_RADIUS, elevation: SEMANTIC_ELEVATION }
    for (const name of SHIPPED_PRIMITIVES) {
      expect(() => COMPONENT_TOKENS[name]!(ctx)).not.toThrow()
      const resolved = COMPONENT_TOKENS[name]!(ctx)
      expect(Object.keys(resolved).length).toBeGreaterThan(0)
    }
  })
})
