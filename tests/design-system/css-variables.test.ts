import { describe, it, expect } from 'vitest'
import { themeToCssVariables, cssVariablesToDeclarationBlock } from '@/design-system/utils/css-variables'
import { lightTheme, darkTheme } from '@/design-system/tokens/theme'

describe('themeToCssVariables', () => {
  it('produces the same variable names for every theme (only values differ)', () => {
    const lightKeys = Object.keys(themeToCssVariables(lightTheme)).sort()
    const darkKeys = Object.keys(themeToCssVariables(darkTheme)).sort()
    expect(darkKeys).toEqual(lightKeys)
  })

  it('every key is prefixed with --rc', () => {
    for (const key of Object.keys(themeToCssVariables(lightTheme))) {
      expect(key.startsWith('--rc')).toBe(true)
    }
  })

  it('renders a well-formed CSS declaration block', () => {
    const block = cssVariablesToDeclarationBlock(themeToCssVariables(lightTheme))
    expect(block).toContain('--rc-')
    expect(block.trim().endsWith(';')).toBe(true)
  })
})
