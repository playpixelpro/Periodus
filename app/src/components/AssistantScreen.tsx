import { useEffect, useMemo, useRef, useState } from 'react'
import { getSetting, removeSetting, setSetting, SK } from '../db/schema'
import {
  anthropicCredentialKind,
  ANTHROPIC_MODELS,
  askAssistant,
  CLI_TOKEN_PREFIX,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_CUSTOM_MODEL,
  DEFAULT_OPENAI_MODEL,
  type AssistantConfig,
  type AssistantProvider,
  type ChatMessage,
} from '../lib/assistant'
import {
  collectApprovedAssistantContext,
  NO_ASSISTANT_CONSENT,
  parseAssistantConsent,
  type AssistantConsent,
} from '../lib/assistantContext'
import { fetchAvailableModels, type AvailableModel } from '../lib/modelDiscovery'
import { screenAssistantUrgency } from '../lib/assistantSafety'
import {
  deleteSecureSecret,
  getSecureSecret,
  SECURE_SECRET_KEYS,
  secureVaultStatus,
  setSecureSecret,
} from '../native/secureVault'
import { useApp } from '../state/appStore'
import { LunaraMark } from './LunaraMark'
import '../styles/assistant.css'

const CONSENT_OPTIONS: Array<{
  key: keyof AssistantConsent
  title: string
  detail: string
  sensitive?: boolean
}> = [
  { key: 'cycle', title: 'Cycle summary', detail: 'Period starts and current prediction' },
  { key: 'symptoms', title: 'Symptoms & mood', detail: 'Up to 30 recent logged days' },
  {
    key: 'fertility',
    title: 'Fertility & intimacy',
    detail: 'BBT, tests, discharge, sex, and pregnancy timing',
    sensitive: true,
  },
  { key: 'notes', title: 'Private notes', detail: 'Up to 12 recent notes', sensitive: true },
]

const STARTERS = [
  'What can change cycle length?',
  'Help me prepare questions for my doctor.',
  'Explain my fertile-window estimate.',
]

function defaultModel(provider: AssistantProvider): string {
  if (provider === 'anthropic') return DEFAULT_ANTHROPIC_MODEL
  if (provider === 'custom') return DEFAULT_CUSTOM_MODEL
  return DEFAULT_OPENAI_MODEL
}

function vaultKeyFor(provider: AssistantProvider) {
  if (provider === 'anthropic') return SECURE_SECRET_KEYS.anthropicApiKey
  if (provider === 'custom') return SECURE_SECRET_KEYS.customAiApiKey
  return SECURE_SECRET_KEYS.openAiApiKey
}

export function AssistantScreen() {
  const setAssistantOpen = useApp((state) => state.setAssistantOpen)
  const [provider, setProvider] = useState<AssistantProvider>('anthropic')
  const [model, setModel] = useState(DEFAULT_ANTHROPIC_MODEL)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [consent, setConsent] = useState<AssistantConsent>(NO_ASSISTANT_CONSENT)
  const [vaultLabel, setVaultLabel] = useState('secure storage')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupOpen, setSetupOpen] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [models, setModels] = useState<AvailableModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [modelFilter, setModelFilter] = useState('')
  const [isCustomManual, setIsCustomManual] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const composerInput = useRef<HTMLTextAreaElement>(null)

  const filteredModels = useMemo(() => {
    if (!modelFilter.trim()) return models
    const q = modelFilter.toLowerCase().trim()
    return models.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        (m.ownedBy && m.ownedBy.toLowerCase().includes(q)),
    )
  }, [models, modelFilter])

  const credentialKind = apiKey ? anthropicCredentialKind(apiKey) : null

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [savedProvider, savedModel, savedBaseUrl, savedConsent, status, legacyKey, savedOpenAiKey, savedAnthropicKey, savedCustomKey] =
        await Promise.all([
          getSetting(SK.aiProvider),
          getSetting(SK.aiModel),
          getSetting(SK.aiBaseUrl),
          getSetting(SK.aiConsent),
          secureVaultStatus(),
          getSetting(SK.aiKey),
          getSecureSecret(SECURE_SECRET_KEYS.openAiApiKey),
          getSecureSecret(SECURE_SECRET_KEYS.anthropicApiKey),
          getSecureSecret(SECURE_SECRET_KEYS.customAiApiKey),
        ])
      const nextProvider: AssistantProvider =
        savedProvider === 'openai' ? 'openai' : savedProvider === 'custom' ? 'custom' : 'anthropic'

      // One-time migration from the old Dexie implementation. Plaintext is
      // removed immediately after the secure bridge accepts it.
      if (legacyKey) {
        await setSecureSecret(SECURE_SECRET_KEYS.openAiApiKey, legacyKey)
        await removeSetting(SK.aiKey)
      }
      const key =
        nextProvider === 'anthropic'
          ? savedAnthropicKey
          : nextProvider === 'custom'
            ? savedCustomKey
            : legacyKey || savedOpenAiKey
      if (!alive) return
      setProvider(nextProvider)
      setModel(savedModel || defaultModel(nextProvider))
      setBaseUrl(savedBaseUrl || '')
      setConsent(parseAssistantConsent(savedConsent))
      setApiKey(key)
      setVaultLabel(
        status.persistence === 'memory'
          ? 'memory only for this browser tab'
          : `${status.persistence}${status.hardwareBacked ? ' · hardware protected' : ''}`,
      )
      setSetupOpen(nextProvider === 'custom' ? !savedBaseUrl && !key : !key)
      setLoading(false)
    })().catch((reason: unknown) => {
      if (!alive) return
      setError(reason instanceof Error ? reason.message : 'Could not load AI settings.')
      setLoading(false)
      setSetupOpen(true)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    const textarea = composerInput.current
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 104)}px`
  }, [input])

  async function chooseProvider(next: AssistantProvider) {
    setProvider(next)
    setModel(defaultModel(next))
    setKeyInput('')
    setError(null)
    setNotice(null)
    setApiKey(await getSecureSecret(vaultKeyFor(next)))
  }

  async function saveConfiguration() {
    const cleanModel = model.trim() || defaultModel(provider)
    setError(null)
    setNotice(null)
    try {
      const suppliedKey = keyInput.trim()
      if (suppliedKey) {
        if (provider === 'anthropic' && anthropicCredentialKind(suppliedKey) === null) {
          setError('Anthropic credentials start with sk-ant- (an API key or a `claude setup-token` token).')
          return
        }
        if (provider === 'openai' && !suppliedKey.startsWith('sk-')) {
          setError('That does not look like an OpenAI API key.')
          return
        }
        await setSecureSecret(vaultKeyFor(provider), suppliedKey)
        setApiKey(suppliedKey)
        setKeyInput('')
      }
      await Promise.all([
        setSetting(SK.aiProvider, provider),
        setSetting(SK.aiModel, cleanModel),
        setSetting(SK.aiBaseUrl, baseUrl.trim()),
      ])
      setModel(cleanModel)
      if (provider === 'custom' && !baseUrl.trim()) {
        setError('Please specify an API endpoint / Base URL for your custom AI provider.')
        return
      }
      if (provider !== 'custom' && !apiKey && !suppliedKey) {
        setError(
          provider === 'anthropic'
            ? 'Add an Anthropic API key, or paste a token from `claude setup-token`.'
            : 'Add an OpenAI project key, or choose another provider.',
        )
        return
      }
      setSetupOpen(false)
      setNotice('AI connection settings saved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save AI settings.')
    }
  }

  async function removeKey() {
    await deleteSecureSecret(vaultKeyFor(provider))
    setApiKey(null)
    setKeyInput('')
    setNotice(
      provider === 'anthropic'
        ? 'Anthropic credential removed from this device. Revoke it in the Anthropic console to invalidate it everywhere.'
        : provider === 'custom'
          ? 'Custom AI credential removed.'
          : 'OpenAI key removed.',
    )
  }

  async function loadModels(urlOverride?: string) {
    const endpoint = (urlOverride ?? baseUrl).trim()
    if (!endpoint) {
      setModelsError('Enter an API endpoint / Base URL first, then load models.')
      return
    }
    setModelsLoading(true)
    setModelsError(null)
    try {
      const found = await fetchAvailableModels(endpoint, apiKey ?? undefined)
      setModels(found)
      if (found.length) {
        setModel((current) => (current && found.some((m) => m.id === current) ? current : found[0].id))
      } else {
        setModelsError('No models found at this endpoint. Enter the model name manually below.')
      }
    } catch (reason) {
      setModelsError(reason instanceof Error ? reason.message : 'Could not load models from this endpoint.')
    } finally {
      setModelsLoading(false)
    }
  }

  // Automatically probe the endpoint for available models once it looks like a
  // real URL, so the user only has to pick one. Debounced so typing doesn't
  // hammer the provider.
  useEffect(() => {
    if (provider !== 'custom') {
      setModels([])
      setModelsError(null)
      return
    }
    if (!baseUrl.trim() || !/^https?:\/\//.test(baseUrl.trim())) {
      setModels([])
      setModelsError(null)
      return
    }
    const timer = setTimeout(() => {
      void loadModels()
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, provider])

  async function toggleConsent(key: keyof AssistantConsent) {
    const next = { ...consent, [key]: !consent[key] }
    setConsent(next)
    await setSetting(SK.aiConsent, JSON.stringify(next))
  }

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim()
    if (!text || busy) return
    if (provider !== 'custom' && !apiKey) {
      setSetupOpen(true)
      setError(
        provider === 'anthropic'
          ? 'Add an Anthropic key or CLI token before sending a message.'
          : 'Add an OpenAI key before sending a message.',
      )
      return
    }

    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    const safetyIntercept = screenAssistantUrgency(text)
    if (safetyIntercept) {
      setMessages([...next, { role: 'assistant', content: safetyIntercept.response }])
      setError(null)
      setNotice('This safety message was generated on device; no provider request was made.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const approvedContext = await collectApprovedAssistantContext(consent)
      const config: AssistantConfig = {
        provider,
        apiKey: apiKey ?? undefined,
        model,
        baseUrl: baseUrl || undefined,
      }
      const reply = await askAssistant(config, next, approvedContext)
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }


  const sharedCount = Object.values(consent).filter(Boolean).length

  return (
    <div
      className="overlay assistant-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Periodus AI assistant"
    >
      <header className="overlay-head assistant-head">
        <button className="back-btn" onClick={() => setAssistantOpen(false)} aria-label="Close">
          ‹
        </button>
        <div className="assistant-title">
          <LunaraMark decorative size={25} />
          <span>
            <span className="assistant-kicker">Private companion</span>
            <h2>Periodus AI</h2>
          </span>
        </div>
        <button
          className={`icon-button assistant-settings-button ${setupOpen ? 'is-active' : ''}`}
          onClick={() => setSetupOpen((open) => !open)}
          aria-label={setupOpen ? 'Close AI settings' : 'Open AI settings'}
          aria-pressed={setupOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="5" cy="12" r="1.25" />
            <circle cx="12" cy="12" r="1.25" />
            <circle cx="19" cy="12" r="1.25" />
          </svg>
        </button>
      </header>

      {loading ? (
        <div className="overlay-body assistant-loading">
          <LunaraMark decorative size={30} />
          <span>Preparing your private space…</span>
        </div>
      ) : setupOpen ? (
        <div className="overlay-body assistant-setup">
          <section className="assistant-setup-intro">
            <p className="eyebrow">Connection</p>
            <h3>Choose where answers come from</h3>
            <p>Your key stays on this device. Periodus never ships a shared key.</p>
            <div className="ai-provider-grid">
              <button
                className={`choice-card compact ${provider === 'anthropic' ? 'selected' : ''}`}
                onClick={() => void chooseProvider('anthropic')}
              >
                <span className="choice-icon">✳</span>
                <span><strong>Anthropic</strong><small>Claude API / CLI</small></span>
              </button>
              <button
                className={`choice-card compact ${provider === 'openai' ? 'selected' : ''}`}
                onClick={() => void chooseProvider('openai')}
              >
                <span className="choice-icon">✦</span>
                <span><strong>OpenAI</strong><small>Official API</small></span>
              </button>
              <button
                className={`choice-card compact ${provider === 'custom' ? 'selected' : ''}`}
                onClick={() => void chooseProvider('custom')}
              >
                <span className="choice-icon">⚙</span>
                <span><strong>Custom / Other</strong><small>Any endpoint</small></span>
              </button>
            </div>
          </section>

          <section className="card ai-setup-card">
            {provider === 'anthropic' ? (
              <>
                <div className="field">
                  <label htmlFor="assistant-key">Anthropic API key or CLI token</label>
                  <input
                    id="assistant-key"
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={apiKey ? 'Saved securely · enter to replace' : 'sk-ant-api… or sk-ant-oat…'}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                  />
                  {apiKey && (
                    <small className="field-hint">
                      Currently using{' '}
                      {credentialKind === 'cli-token'
                        ? 'a Claude CLI subscription token'
                        : 'a console API key'}
                      .
                    </small>
                  )}
                </div>

                <details className="assistant-key-fallback">
                  <summary>Use your Claude subscription instead (CLI login)</summary>
                  <p className="microcopy">
                    Periodus runs in a mobile WebView, so it cannot shell out to the{' '}
                    <code>claude</code> CLI the way a server can. Run this once on a computer
                    where you are signed in:
                  </p>
                  <pre className="cli-snippet"><code>claude setup-token</code></pre>
                  <p className="microcopy">
                    Paste the <code>{CLI_TOKEN_PREFIX}…</code> token it prints into the field
                    above. Periodus sends it as an OAuth bearer credential, so answers are billed
                    to your Claude subscription rather than to API credits. The token expires —
                    rerun the command to refresh it.
                  </p>
                </details>

                <div className="field">
                  <label htmlFor="assistant-model">Model</label>
                  <select
                    id="assistant-model"
                    value={ANTHROPIC_MODELS.some((entry) => entry.id === model) ? model : DEFAULT_ANTHROPIC_MODEL}
                    onChange={(event) => setModel(event.target.value)}
                  >
                    {ANTHROPIC_MODELS.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : provider === 'openai' ? (
              <>
                <div className="field">
                  <label htmlFor="assistant-key">OpenAI project API key</label>
                  <input
                    id="assistant-key"
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={apiKey ? 'Saved securely · enter to replace' : 'sk-proj-…'}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="assistant-model">Model</label>
                  <select
                    id="assistant-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  >
                    <option value="gpt-4o">GPT-4o · flagship</option>
                    <option value="gpt-4o-mini">GPT-4o mini · fast & affordable</option>
                    <option value="o3-mini">o3-mini · reasoning</option>
                    <option value="o1">o1 · deep reasoning</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    {!['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'gpt-4-turbo'].includes(model) && model && (
                      <option value={model}>{model} (Current)</option>
                    )}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="assistant-endpoint">API endpoint / Base URL</label>
                  <input
                    id="assistant-endpoint"
                    type="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="https://openrouter.ai/api/v1 or https://api.deepseek.com"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                  />
                  <small className="field-hint">
                    Works with OpenRouter, DeepSeek, Groq, Mistral, Ollama, LM Studio, or any OpenAI-compatible server.
                  </small>
                </div>

                <div className="field">
                  <label htmlFor="assistant-key">API key (optional for local models)</label>
                  <input
                    id="assistant-key"
                    type="password"
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={apiKey ? 'Saved securely · enter to replace' : 'Bearer API key'}
                    value={keyInput}
                    onChange={(event) => setKeyInput(event.target.value)}
                  />
                </div>

                <div className="field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label htmlFor="assistant-model">Model {models.length > 0 ? `(${models.length} loaded)` : ''}</label>
                    {models.length > 0 && (
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: 11, padding: 0, minHeight: 'auto', color: 'var(--primary)' }}
                        onClick={() => setIsCustomManual((prev) => !prev)}
                      >
                        {isCustomManual ? `Choose from list (${models.length})` : 'Type manually'}
                      </button>
                    )}
                  </div>

                  {models.length > 0 && !isCustomManual ? (
                    <>
                      {models.length > 6 && (
                        <input
                          type="search"
                          style={{ minHeight: 38, fontSize: 13, marginBottom: 8 }}
                          placeholder="Filter models (e.g. gpt, claude, deepseek, llama)…"
                          value={modelFilter}
                          onChange={(e) => setModelFilter(e.target.value)}
                        />
                      )}
                      <select
                        id="assistant-model"
                        value={model}
                        onChange={(event) => {
                          if (event.target.value === '__manual__') {
                            setIsCustomManual(true)
                          } else {
                            setModel(event.target.value)
                          }
                        }}
                      >
                        {model && !filteredModels.some((m) => m.id === model) && (
                          <option value={model}>{model} (Selected)</option>
                        )}
                        {filteredModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}{m.ownedBy ? ` (${m.ownedBy})` : ''}
                          </option>
                        ))}
                        <option value="__manual__">✏️ Enter custom model name…</option>
                      </select>
                    </>
                  ) : (
                    <input
                      id="assistant-model"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="e.g. deepseek-chat, llama-3.3-70b-versatile, gpt-4o"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                    />
                  )}

                  <div className="model-load-row">
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void loadModels()}
                      disabled={modelsLoading || !baseUrl.trim()}
                    >
                      {modelsLoading
                        ? 'Loading models…'
                        : models.length
                          ? `↻ ${models.length} model${models.length === 1 ? '' : 's'} · refresh`
                          : 'Load available models'}
                    </button>
                    <span className="field-hint" role="status">
                      {modelsLoading
                        ? 'Probing endpoint…'
                        : modelsError
                          ? 'Not discoverable — type the model name above.'
                          : models.length
                            ? `${models.length} models discovered. Pick one above.`
                            : 'Enter a model name, or load the list.'}
                    </span>
                  </div>
                </div>

                <div className="openrouter-hint">
                  <strong>New to AI endpoints?</strong>
                  <p>
                    Create a free account on <b>OpenRouter</b> and use its free tier — one key
                    unlocks many models from a single endpoint.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setBaseUrl('https://openrouter.ai/api/v1')
                      void loadModels('https://openrouter.ai/api/v1')
                    }}
                  >
                    Use the OpenRouter endpoint
                  </button>
                  <div className="privacy-alert" role="alert">
                    <b>Beware — free tiers can train on your data.</b> Many free or zero-credit
                    endpoints log your prompts and may use them to train their models. For private
                    health topics, prefer a paid provider you trust or a fully local model (e.g.
                    Ollama) that never leaves your device.
                  </div>
                </div>
              </>
            )}
            <p className="microcopy">
              Storage: {vaultLabel}. Credentials never enter the cycle database or a backup.
            </p>
            {apiKey && (
              <button className="text-button danger" onClick={removeKey}>
                Remove saved credential
              </button>
            )}
          </section>

          {notice && <div className="assistant-notice" role="status">{notice}</div>}
          {error && <div className="assistant-error" role="alert">{error}</div>}
          <button className="cta" onClick={saveConfiguration}>
            Save connection
          </button>
        </div>
      ) : (
        <>
          <section className={`assistant-context-panel ${contextOpen ? 'is-open' : ''}`}>
            <button
              className="assistant-context-summary"
              onClick={() => setContextOpen((open) => !open)}
              aria-expanded={contextOpen}
              aria-controls="assistant-consent-options"
            >
              <span className="assistant-context-mark" aria-hidden="true">
                <LunaraMark decorative size={18} />
              </span>
              <span className="assistant-context-copy">
                <strong>Tracker context</strong>
                <small>
                  {sharedCount === 0
                    ? 'Nothing shared'
                    : `${sharedCount} categor${sharedCount === 1 ? 'y' : 'ies'} selected`}
                </small>
              </span>
              <span className="privacy-pill">
                <i aria-hidden="true" />
                {provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Custom AI'}
              </span>
              <svg className="assistant-context-chevron" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m7 9.5 5 5 5-5" />
              </svg>
            </button>

            {contextOpen && (
              <div className="assistant-context-disclosure" id="assistant-consent-options">
                <div className="assistant-context-note">
                  <strong>Choose what travels with your next message.</strong>
                  <span>Nothing is attached unless you select it here.</span>
                </div>
                <div className="consent-grid">
                  {CONSENT_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      className={`consent-row ${consent[option.key] ? 'selected' : ''}`}
                      onClick={() => toggleConsent(option.key)}
                      aria-pressed={consent[option.key]}
                    >
                      <span>
                        <strong>{option.title}</strong>
                        <small>
                          {option.detail}
                          {option.sensitive ? ' · Sensitive' : ''}
                        </small>
                      </span>
                      <span className="toggle-dot" aria-hidden="true"><i /></span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div
            className={`overlay-body assistant-messages ${messages.length === 0 ? 'is-empty' : ''}`}
            ref={scroller}
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="assistant-empty">
                <div className="assistant-orb" aria-hidden="true">
                  <span />
                  <LunaraMark decorative size={38} />
                </div>
                <span className="assistant-empty-kicker">Private by design</span>
                <h3>What would you like to understand?</h3>
                <p>
                  Ask a general question, or selectively share tracker context for a more
                  personal answer.
                </p>
                <div className="starter-list" aria-label="Starter questions">
                  {STARTERS.map((starter) => (
                    <button key={starter} onClick={() => send(starter)}>
                      <span>{starter}</span>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M7 17 17 7M9 7h8v8" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={`chat-bubble ${message.role}`}>
                {message.role === 'assistant' && (
                  <span className="chat-bubble-mark" aria-hidden="true">
                    <LunaraMark decorative size={14} />
                  </span>
                )}
                <span>{message.content}</span>
              </div>
            ))}
            {busy && (
              <div className="chat-bubble assistant typing" aria-label="Periodus is thinking">
                <span className="chat-bubble-mark" aria-hidden="true">
                  <LunaraMark decorative size={14} />
                </span>
                <span>Thinking</span>
                <i /><i /><i />
              </div>
            )}
            {notice && <div className="assistant-notice" role="status">{notice}</div>}
            {error && <div className="assistant-error" role="alert">{error}</div>}
          </div>
        </>
      )}

      {!loading && !setupOpen && (
        <form
          className="assistant-compose"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <div className="assistant-compose-row">
            <textarea
              ref={composerInput}
              rows={1}
              placeholder="Message Periodus…"
              aria-label="Message Periodus"
              enterKeyHint="send"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 18V6m-5 5 5-5 5 5" />
              </svg>
            </button>
          </div>
          <p>Educational support only · not diagnosis or emergency care</p>
        </form>
      )}
    </div>
  )
}
