import { describe, it, expect } from 'vitest'
import {
  matchesNamingConvention,
  isLegitimateRoleSpecificComponent,
  COMPONENT_TAXONOMY_CATEGORIES,
} from '@/design-system/conventions'

// ── blueprint §18 naming convention, transcribed as validators ─────────────────

describe('matchesNamingConvention', () => {
  it('accepts PascalCase components', () => {
    expect(matchesNamingConvention('component', 'StatusBadge')).toBe(true)
    expect(matchesNamingConvention('component', 'statusBadge')).toBe(false)
  })

  it('accepts use-prefixed hooks only', () => {
    expect(matchesNamingConvention('hook', 'useGroupWorkspace')).toBe(true)
    expect(matchesNamingConvention('hook', 'groupWorkspace')).toBe(false)
  })

  it('accepts verb-first Action-suffixed server actions', () => {
    expect(matchesNamingConvention('serverAction', 'editGroupAllocationRangeAction')).toBe(true)
    expect(matchesNamingConvention('serverAction', 'GroupAction')).toBe(false)
  })

  it('accepts kebab-case routes only', () => {
    expect(matchesNamingConvention('route', 'team-leaders')).toBe(true)
    expect(matchesNamingConvention('route', 'TeamLeaders')).toBe(false)
  })
})

// ── Architecture Closure v1 CLS-C4(a), the mechanical fork test ────────────────

describe('isLegitimateRoleSpecificComponent', () => {
  it('rejects a component that only differs by permission (forbidden fork)', () => {
    expect(
      isLegitimateRoleSpecificComponent({
        structurallyDistinctIgnoringPermissions: false,
        composesFromSameFoundation: true,
      })
    ).toBe(false)
  })

  it('accepts a structurally distinct component built from the same foundation', () => {
    expect(
      isLegitimateRoleSpecificComponent({
        structurallyDistinctIgnoringPermissions: true,
        composesFromSameFoundation: true,
      })
    ).toBe(true)
  })

  it('rejects a structurally distinct component that does not reuse the foundation', () => {
    expect(
      isLegitimateRoleSpecificComponent({
        structurallyDistinctIgnoringPermissions: true,
        composesFromSameFoundation: false,
      })
    ).toBe(false)
  })
})

describe('Component Taxonomy registry', () => {
  it('declares all twenty component-library-specification.md §3 categories', () => {
    expect(COMPONENT_TAXONOMY_CATEGORIES).toHaveLength(20)
  })
})
