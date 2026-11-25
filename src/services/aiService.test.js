import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  sendChatMessage,
  testConnection,
  getConfig,
  listProfiles,
  saveProfile,
  testProfileConnection,
} from './aiService.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sendChatMessage', () => {
  it('sends only redacted message content and returns the reply', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: 'Here is your answer', usedProfileId: 'p1' }),
    })
    const data = await sendChatMessage([{ role: 'user', text: '[EMAIL_1] please help' }])
    expect(data.reply).toBe('Here is your answer')
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.messages).toEqual([{ role: 'user', content: '[EMAIL_1] please help' }])
  })

  it('passes the selected profileId to the backend', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ reply: 'ok' }) })
    await sendChatMessage([{ role: 'user', text: 'hi' }], 'profile-coding')
    const body = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(body.profileId).toBe('profile-coding')
  })

  it('throws a clear error when the backend reports a failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'No AI provider is configured yet.' }),
    })
    await expect(sendChatMessage([{ role: 'user', text: 'hi' }])).rejects.toThrow(/not configured|configured/i)
  })
})

describe('profile management', () => {
  it('lists profiles without ever receiving an apiKey field', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profiles: [{ id: 'p1', name: 'Default', modelId: 'm1', enabled: true }] }),
    })
    const profiles = await listProfiles()
    expect(profiles[0].apiKey).toBeUndefined()
  })

  it('saveProfile POSTs new profiles and PUTs existing ones', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { id: 'p1' } }) })
    await saveProfile({ name: 'New', baseUrl: 'x', apiKey: 'y', modelId: 'z' })
    expect(global.fetch.mock.calls[0][1].method).toBe('POST')

    await saveProfile({ id: 'p1', name: 'Updated' })
    expect(global.fetch.mock.calls[1][1].method).toBe('PUT')
  })

  it('testProfileConnection throws a clear error on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'bad key' }) })
    await expect(testProfileConnection('p1')).rejects.toThrow(/bad key/)
  })
})

describe('getConfig', () => {
  it('returns the saved Model ID so Settings can repopulate it on reopen', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        configured: true,
        provider: 'custom-openai-compatible',
        baseUrl: 'https://example.com/v1',
        modelId: 'unsloth/llama-3',
      }),
    })
    const config = await getConfig()
    expect(config.modelId).toBe('unsloth/llama-3')
    // Must never include the API key.
    expect(config.apiKey).toBeUndefined()
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/config'))
  })

  it('throws a clear error when the backend request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'boom' }),
    })
    await expect(getConfig()).rejects.toThrow(/boom/)
  })
})

describe('testConnection', () => {
  it('resolves when the backend reports ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    await expect(testConnection({ baseUrl: 'x', apiKey: 'y', modelId: 'z' })).resolves.toEqual({ ok: true })
  })

  it('throws when the backend reports failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false, error: 'Invalid key' }) })
    await expect(testConnection({ baseUrl: 'x', apiKey: 'y', modelId: 'z' })).rejects.toThrow(/invalid key/i)
  })
})
