import { describe, it, expect } from 'vitest'
import { lightTheme, darkTheme, THEMES, createTheme } from '@/design-system/tokens/theme'
import { STATUS_BUCKET_KEYS } from '@/design-system/tokens/semantic/color'

// ── Every Theme must expose the exact same shape (DSA §5.6) ────────────────────
// so a Theme swap never leaves a Component reading an undefined token.

describe('Theme Token contract', () => {
  it('light and dark themes declare the same top-level keys', () => {
    expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort())
  })

  it('light and dark themes declare the same color token keys', () => {
    expect(Object.keys(darkTheme.color).sort()).toEqual(Object.keys(lightTheme.color).sort())
  })

  it('both themes define all six status buckets', () => {
    for (const bucket of STATUS_BUCKET_KEYS) {
      expect(lightTheme.color.status[bucket]).toBeDefined()
      expect(darkTheme.color.status[bucket]).toBeDefined()
    }
  })

  it('colorScheme matches the theme id', () => {
    expect(lightTheme.colorScheme).toBe('light')
    expect(darkTheme.colorScheme).toBe('dark')
  })

  it('THEMES registry exposes both shipped themes', () => {
    expect(THEMES.light).toBe(lightTheme)
    expect(THEMES.dark).toBe(darkTheme)
  })

  it('createTheme produces a structurally valid override (white-label mechanism)', () => {
    const custom = createTheme(lightTheme, { id: 'partner-demo' })
    expect(custom.id).toBe('partner-demo')
    expect(custom.color).toBe(lightTheme.color)
  })
})
