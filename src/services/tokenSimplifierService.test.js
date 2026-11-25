import { describe, it, expect } from 'vitest'
import { simplifyPrompt } from './tokenSimplifierService.js'

describe('simplifyPrompt - normal conversational prompts', () => {
  it('removes filler words and collapses whitespace', () => {
    const input = 'Hi,   I was wondering if   you could  really    help me basically plan a trip.'
    const result = simplifyPrompt(input)
    expect(result.optimized).not.toMatch(/wondering if|really|basically/i)
    expect(result.optimized).not.toMatch(/ {2,}/)
    expect(result.changed).toBe(true)
    expect(result.optimizedTokens).toBeLessThan(result.originalTokens)
  })
})

describe('simplifyPrompt - long prompts', () => {
  it('reduces a long, repetitive prompt', () => {
    const input = Array(20)
      .fill('Please note that this is very important and each and every detail matters a lot.   ')
      .join('')
    const result = simplifyPrompt(input)
    expect(result.changed).toBe(true)
    expect(result.tokensSaved).toBeGreaterThan(0)
    expect(result.percentSaved).toBeGreaterThan(0)
  })
})

describe('simplifyPrompt - structured content is never touched', () => {
  it('leaves code fences untouched', () => {
    const code = '```js\nfunction add(a,   b) { return a+b; } // very   basically done\n```'
    const input = `Please note that here is code:\n${code}`
    const result = simplifyPrompt(input)
    expect(result.optimized).toContain(code)
  })

  it('leaves inline code untouched', () => {
    const input = 'Run `npm   install   really` basically now.'
    const result = simplifyPrompt(input)
    expect(result.optimized).toContain('`npm   install   really`')
  })

  it('leaves URLs untouched', () => {
    const url = 'https://example.com/path?x=really_basically_param'
    const input = `Please note that see ${url} for details.`
    const result = simplifyPrompt(input)
    expect(result.optimized).toContain(url)
  })

  it('leaves JSON-like objects untouched', () => {
    const json = '{ "note": "please   note that this is really important", "n": 1 }'
    const input = `Please note that use this config: ${json}`
    const result = simplifyPrompt(input)
    expect(result.optimized).toContain(json)
  })

  it('leaves quoted text untouched', () => {
    const quoted = '"please   note that this is really important"'
    const input = `Basically keep this exact quote: ${quoted}`
    const result = simplifyPrompt(input)
    expect(result.optimized).toContain(quoted)
  })
})

describe('simplifyPrompt - meaning-sensitive instructions are preserved', () => {
  it('keeps negation and instruction words intact', () => {
    const input = 'Do not delete the database. Please note that you must always ask before deploying.'
    const result = simplifyPrompt(input)
    expect(result.optimized).toMatch(/do not delete the database/i)
    expect(result.optimized).toMatch(/must always ask before deploying/i)
  })

  it('keeps technical terms intact', () => {
    const input = 'Please note that we really need OAuth2, JWT, and gRPC support basically.'
    const result = simplifyPrompt(input)
    expect(result.optimized).toMatch(/OAuth2/)
    expect(result.optimized).toMatch(/JWT/)
    expect(result.optimized).toMatch(/gRPC/)
  })
})

describe('simplifyPrompt - immutability of original', () => {
  it('never mutates the input and always returns the unchanged original', () => {
    const input = 'Please note that this   is basically a test.'
    const inputCopy = input.slice()
    const result = simplifyPrompt(input)
    expect(input).toBe(inputCopy)
    expect(result.original).toBe(input)
  })
})

describe('simplifyPrompt - safe fallback', () => {
  it('returns the original unchanged when nothing can be safely simplified', () => {
    const input = 'Fix bug.'
    const result = simplifyPrompt(input)
    expect(result.optimized).toBe(input)
    expect(result.changed).toBe(false)
    expect(result.tokensSaved).toBe(0)
  })

  it('handles empty input without throwing', () => {
    const result = simplifyPrompt('')
    expect(result.optimized).toBe('')
    expect(result.changed).toBe(false)
  })
})

describe('simplifyPrompt - token savings calculations', () => {
  it('computes consistent token counts and percentage saved', () => {
    const input = 'Please note that this is really, really basically a very simple   test   prompt.'
    const result = simplifyPrompt(input)
    expect(result.isEstimate).toBe(true)
    expect(result.originalTokens).toBeGreaterThan(0)
    expect(result.optimizedTokens).toBeLessThanOrEqual(result.originalTokens)
    expect(result.tokensSaved).toBe(result.originalTokens - result.optimizedTokens)
    const expectedPercent = Math.round((result.tokensSaved / result.originalTokens) * 1000) / 10
    expect(result.percentSaved).toBe(expectedPercent)
  })
})
