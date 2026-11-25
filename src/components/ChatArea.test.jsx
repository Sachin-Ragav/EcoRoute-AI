import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ChatArea from './ChatArea.jsx'
import { sendChatMessage } from '../services/aiService.js'

vi.mock('../services/aiService.js', () => ({
  sendChatMessage: vi.fn().mockResolvedValue({ reply: 'ok', usedProfileId: 'p1', usedModelId: 'm1' }),
}))

const codingProfile = { id: 'p-code', name: 'Coder', modelId: 'code-model', enabled: true, isDefault: false, capabilities: ['coding'] }
const defaultProfile = { id: 'p-default', name: 'Default', modelId: 'general-model', enabled: true, isDefault: true, capabilities: [] }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const FILLER_PROMPT = 'Please note that this is really, really basically a very simple   test   prompt.'

function typeAndSend(text) {
  const textarea = screen.getByPlaceholderText('Message EcoRoute AI...')
  fireEvent.change(textarea, { target: { value: text } })
  fireEvent.click(screen.getByLabelText('Send message'))
}

describe('ChatArea - Token Simplifier integration', () => {
  it('disabled by default: sends the redacted original unchanged', async () => {
    render(<ChatArea messages={[]} onMessagesChange={() => {}} aiConfigured />)
    typeAndSend(FILLER_PROMPT)
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    const sent = sendChatMessage.mock.calls[0][0]
    expect(sent.at(-1).text).toBe(FILLER_PROMPT) // no redaction needed here, so unchanged
    expect(screen.getByText(/Token Optimizer/)).toBeTruthy()
  })

  it('enabled: sends the optimized prompt to the provider', async () => {
    render(<ChatArea messages={[]} onMessagesChange={() => {}} aiConfigured />)
    fireEvent.click(screen.getByText(/Token Simplifier: Off/))
    expect(screen.getByText(/Token Simplifier: On/)).toBeTruthy()

    typeAndSend(FILLER_PROMPT)
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    const sent = sendChatMessage.mock.calls[0][0]
    expect(sent.at(-1).text).not.toBe(FILLER_PROMPT)
    expect(sent.at(-1).text.length).toBeLessThan(FILLER_PROMPT.length)
  })

  it('never sends unredacted sensitive info, in either mode', async () => {
    const sensitive = 'My email is jane.doe@example.com, please note that email me really soon.'
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        confidentialTerms={['jane.doe@example.com']}
      />,
    )
    fireEvent.click(screen.getByText(/Token Simplifier: Off/)) // enable
    typeAndSend(sensitive)
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    const sentDisabledOff = sendChatMessage.mock.calls[0][0]
    expect(sentDisabledOff.at(-1).text).not.toContain('jane.doe@example.com')

    vi.clearAllMocks()
    cleanup()
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        confidentialTerms={['jane.doe@example.com']}
      />,
    )
    typeAndSend(sensitive) // simplifier off this render
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    const sentOff = sendChatMessage.mock.calls[0][0]
    expect(sentOff.at(-1).text).not.toContain('jane.doe@example.com')
  })

  it('shows clear feedback when no tokens are saved', async () => {
    render(<ChatArea messages={[]} onMessagesChange={() => {}} aiConfigured />)
    typeAndSend('Fix bug.')
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    expect(screen.getByText('No tokens saved on this prompt')).toBeTruthy()
  })
})

describe('ChatArea - Smart Model Router integration', () => {
  it('routes a coding prompt to the coding-capable profile', async () => {
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        profiles={[codingProfile, defaultProfile]}
        routingEnabled
      />,
    )
    typeAndSend('Please fix this function() { return null pointer } bug in my code')
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    expect(sendChatMessage.mock.calls[0][1]).toBe('p-code')
    expect(screen.getByText(/CODING/)).toBeTruthy()
  })

  it('manual override always wins over automatic routing', async () => {
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        profiles={[codingProfile, defaultProfile]}
        routingEnabled
        manualProfileId="p-default"
      />,
    )
    typeAndSend('fix my code please, function() throws exception')
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    expect(sendChatMessage.mock.calls[0][1]).toBe('p-default')
  })

  it('falls back to the default model when no specialized profile exists', async () => {
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        profiles={[defaultProfile]}
        routingEnabled
      />,
    )
    typeAndSend('fix my code please, function() throws exception')
    await waitFor(() => expect(sendChatMessage).toHaveBeenCalled())
    expect(sendChatMessage.mock.calls[0][1]).toBe('p-default')
  })

  it('reports routing analytics via onRouteResult without fabricating data', async () => {
    const onRouteResult = vi.fn()
    render(
      <ChatArea
        messages={[]}
        onMessagesChange={() => {}}
        aiConfigured
        profiles={[defaultProfile]}
        routingEnabled
        onRouteResult={onRouteResult}
      />,
    )
    typeAndSend('hello there')
    await waitFor(() => expect(onRouteResult).toHaveBeenCalled())
    const stats = onRouteResult.mock.calls[0][0]
    expect(stats.success).toBe(true)
    expect(typeof stats.durationMs).toBe('number')
    expect(stats.category).toBe('SIMPLE')
  })
})
