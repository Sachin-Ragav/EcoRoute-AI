import { describe, it, expect } from 'vitest'
import { classifyPrompt, selectModel, routePrompt } from './modelRouterService.js'

describe('classifyPrompt', () => {
  it('classifies greetings as SIMPLE', () => {
    expect(classifyPrompt('hi')).toBe('SIMPLE')
    expect(classifyPrompt('Hello!')).toBe('SIMPLE')
  })

  it('classifies code-related prompts as CODING', () => {
    expect(classifyPrompt('Please fix this bug: ```js\nfunction x(){}\n``` throws an exception')).toBe('CODING')
    expect(classifyPrompt('Help me debug a null pointer exception in my code')).toBe('CODING')
  })

  it('classifies analytical/math prompts as REASONING', () => {
    expect(classifyPrompt('Analyze the trade-offs of this algorithm step by step')).toBe('REASONING')
    expect(classifyPrompt('Calculate the optimal route using this equation')).toBe('REASONING')
  })

  it('classifies condensing requests as SUMMARIZATION', () => {
    expect(classifyPrompt('Summarize the key points of this report')).toBe('SUMMARIZATION')
    expect(classifyPrompt('Can you give me a TL;DR of this document')).toBe('SUMMARIZATION')
  })

  it('classifies everything else as GENERAL', () => {
    expect(classifyPrompt('What is the best way to plan a delivery schedule for our warehouse?')).toBe('GENERAL')
  })

  it('is deterministic for the same input', () => {
    const text = 'Explain how routing works in this app'
    expect(classifyPrompt(text)).toBe(classifyPrompt(text))
  })
})

const codingModel = { id: 'c1', name: 'Coder', modelId: 'code-7b', enabled: true, isDefault: false, capabilities: ['coding'] }
const reasoningModel = { id: 'r1', name: 'Reasoner', modelId: 'reason-70b', enabled: true, isDefault: false, capabilities: ['reasoning'] }
const defaultModel = { id: 'd1', name: 'Default', modelId: 'general-13b', enabled: true, isDefault: true, capabilities: ['general'] }
const disabledFast = { id: 'f1', name: 'Fast (disabled)', modelId: 'fast-1b', enabled: false, isDefault: false, capabilities: ['fast'] }

describe('selectModel', () => {
  it('selects the profile matching the category capability', () => {
    const result = selectModel({ category: 'CODING', profiles: [codingModel, defaultModel] })
    expect(result.selectedProfileId).toBe('c1')
    expect(result.selectedModelId).toBe('code-7b')
    expect(result.confidence).toBeGreaterThan(0.5)
  })

  it('never selects a disabled model', () => {
    const result = selectModel({ category: 'SIMPLE', profiles: [disabledFast, defaultModel] })
    expect(result.selectedProfileId).not.toBe('f1')
    expect(result.selectedProfileId).toBe('d1') // falls back to default
  })

  it('falls back to the default enabled model when no specialized profile exists', () => {
    const result = selectModel({ category: 'REASONING', profiles: [codingModel, defaultModel] })
    expect(result.selectedProfileId).toBe('d1')
    expect(result.confidence).toBeLessThan(0.9)
  })

  it('honors a manual override even when a specialized model exists', () => {
    const result = selectModel({ category: 'CODING', profiles: [codingModel, defaultModel], manualProfileId: 'd1' })
    expect(result.selectedProfileId).toBe('d1')
    expect(result.confidence).toBe(1)
  })

  it('ignores a manual override pointing at a disabled/missing profile', () => {
    const result = selectModel({ category: 'SIMPLE', profiles: [defaultModel], manualProfileId: 'does-not-exist' })
    expect(result.selectedProfileId).toBe('d1')
  })

  it('returns no selection when nothing is configured', () => {
    const result = selectModel({ category: 'GENERAL', profiles: [] })
    expect(result.selectedProfileId).toBeNull()
    expect(result.confidence).toBe(0)
  })

  it('never invents a capability a profile was not assigned', () => {
    const plain = { id: 'x1', name: 'Plain', modelId: 'm', enabled: true, isDefault: true, capabilities: [] }
    const result = selectModel({ category: 'CODING', profiles: [plain] })
    expect(result.selectedProfileId).toBe('x1') // only via default fallback
    expect(result.reason).toMatch(/default/i)
  })
})

describe('routePrompt', () => {
  it('classifies and selects in one call', () => {
    const result = routePrompt({ text: 'fix this bug in my code', profiles: [codingModel, defaultModel] })
    expect(result.category).toBe('CODING')
    expect(result.selectedProfileId).toBe('c1')
  })
})
