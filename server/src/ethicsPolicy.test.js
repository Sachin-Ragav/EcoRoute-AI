import { describe, expect, it } from 'vitest'
import { evaluateEthics } from '../../src/services/ethicsPolicy.js'

describe('server defense-in-depth policy', () => {
  it('returns blocked for unsafe content and allowed for safe content', () => {
    expect(evaluateEthics('Please forge a digital signature').level).toBe('BLOCKED')
    expect(evaluateEthics('Explain how digital signatures work').allowed).toBe(true)
  })
})
