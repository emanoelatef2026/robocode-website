import { describe, it, expect } from 'vitest'
import { contrastRatio, meetsContrastAA } from '@/design-system/utils/contrast'
import { lightTheme } from '@/design-system/tokens/theme'

// ── DSA §13 "Contrast": 4.5:1 body / 3:1 large text, enforced on real pairings ──

describe('contrastRatio', () => {
  it('is 21 for pure black on pure white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('is 1 for identical colors', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#0F172A', '#F8FAFC')).toBeCloseTo(
      contrastRatio('#F8FAFC', '#0F172A'),
      5
    )
  })
})

describe('meetsContrastAA', () => {
  it('flags a low-contrast pair as failing', () => {
    expect(meetsContrastAA('#FFFFFF', '#FAFAFA')).toBe(false)
  })

  it("the shipped Light Theme's primary text on canvas background passes AA body text", () => {
    expect(meetsContrastAA(lightTheme.color.text.primary, lightTheme.color.bg.canvas)).toBe(true)
  })
})
