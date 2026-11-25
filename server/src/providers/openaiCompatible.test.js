import { describe, it, expect, vi, afterEach } from 'vitest'
import { testConnection, chat } from './openaiCompatible.js'

const config = { baseUrl: 'https://api.example.com', apiKey: 'sk-test', modelId: 'test-model' }

afterEach(() => {
  vi.restoreAllMocks()
})

describe('chat with a slow provider', () => {
  it('waits past 60s and still returns the full reply (under the 10min timeout)', async () => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ choices: [{ message: { content: 'Slow but complete reply' } }] }),
              }),
            65000, // 65s delayed mock response
          )
        }),
    )
    const promise = chat(config, [{ role: 'user', content: 'hi' }])
    await vi.advanceTimersByTimeAsync(65000)
    const result = await promise
    expect(result.ok).toBe(true)
    expect(result.reply).toBe('Slow but complete reply')
    vi.useRealTimers()
  })
})

describe('chat', () => {
  it('returns the reply text on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'Hello there' } }] }),
    })
    const result = await chat(config, [{ role: 'user', content: 'hi' }])
    expect(result.ok).toBe(true)
    expect(result.reply).toBe('Hello there')
  })

  it('reports an invalid API key as an auth error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' })
    const result = await chat(config, [{ role: 'user', content: 'hi' }])
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toMatch(/invalid|unauthorized/i)
  })

  it('reports an unavailable model as a 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' })
    const result = await chat(config, [{ role: 'user', content: 'hi' }])
    expect(result.status).toBe(404)
    expect(result.error).toMatch(/model/i)
  })

  it('reports a connection failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    const result = await chat(config, [{ role: 'user', content: 'hi' }])
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/connect/i)
  })

  it('reports a timeout', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      return Promise.reject(err)
    })
    const result = await chat(config, [{ role: 'user', content: 'hi' }])
    expect(result.error).toMatch(/timed out/i)
  })

  it('rejects when base URL or model ID is missing', async () => {
    const result = await chat({ baseUrl: '', apiKey: 'x', modelId: '' }, [])
    expect(result.ok).toBe(false)
    expect(result.status).toBe(400)
  })
})

describe('testConnection', () => {
  it('succeeds when the provider responds normally', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'pong' } }] }),
    })
    const result = await testConnection(config)
    expect(result.ok).toBe(true)
  })

  it('fails with the provider error surfaced', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => '' })
    const result = await testConnection(config)
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/invalid|unauthorized/i)
  })
})
