import {
  SwitchOnYourCodeAuthenticationError,
  SwitchOnYourCodeHTTPError,
} from './config-client.js'

export interface SwitchOnYourCodeRealtimeStreamOptions {
  baseUrl: string
  sdkKey: string
  fetch: typeof fetch
  reconnectDelayMs?: number
  onConfigurationChanged: () => void | Promise<void>
  onError: ((error: unknown) => void) | undefined
}

interface ServerSentEvent {
  event: string
  data: string
}

interface ConsumeOptions {
  onEvent: (event: ServerSentEvent) => void
  onRetry: (retryMs: number) => void
}

export class SwitchOnYourCodeRealtimeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SwitchOnYourCodeRealtimeError'
  }
}

export class SwitchOnYourCodeRealtimeStream {
  readonly #baseUrl: string
  readonly #sdkKey: string
  readonly #fetch: typeof fetch
  readonly #onConfigurationChanged: () => void | Promise<void>
  readonly #onError: ((error: unknown) => void) | undefined
  readonly #defaultReconnectDelayMs: number

  #controller: AbortController | undefined
  #task: Promise<void> | undefined
  #refreshTask: Promise<void> | undefined
  #refreshPending = false

  constructor(options: SwitchOnYourCodeRealtimeStreamOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, '')
    const sdkKey = options.sdkKey.trim()
    if (baseUrl === '') {
      throw new TypeError('SwitchOnYourCode realtime baseUrl is required.')
    }
    if (sdkKey === '') {
      throw new TypeError('SwitchOnYourCode realtime sdkKey is required.')
    }
    if (typeof options.fetch !== 'function') {
      throw new TypeError('A fetch implementation is required for realtime updates.')
    }
    if (options.reconnectDelayMs !== undefined && (!Number.isFinite(options.reconnectDelayMs) || options.reconnectDelayMs <= 0)) {
      throw new TypeError('reconnectDelayMs must be a positive number.')
    }

    this.#baseUrl = baseUrl
    this.#sdkKey = sdkKey
    this.#fetch = options.fetch
    this.#onConfigurationChanged = options.onConfigurationChanged
    this.#onError = options.onError
    this.#defaultReconnectDelayMs = options.reconnectDelayMs ?? 5_000
  }

  get running(): boolean {
    return this.#task !== undefined
  }

  start(): void {
    if (this.#task) {
      return
    }

    const controller = new AbortController()
    this.#controller = controller
    const task = this.#run(controller)
    this.#task = task
    void task.finally(() => {
      if (this.#task === task) {
        this.#task = undefined
        this.#controller = undefined
      }
    })
  }

  stop(): void {
    this.#controller?.abort()
  }

  close(): void {
    this.stop()
  }

  async #run(controller: AbortController): Promise<void> {
    let reconnectDelayMs = this.#defaultReconnectDelayMs

    while (!controller.signal.aborted) {
      try {
        const response = await this.#fetch(`${this.#baseUrl}/sdk/v1/events`, {
          method: 'GET',
          headers: new Headers({
            Accept: 'text/event-stream',
            Authorization: `Bearer ${this.#sdkKey}`,
          }),
          signal: controller.signal,
        })

        if (response.status === 401) {
          this.#onError?.(new SwitchOnYourCodeAuthenticationError())
          return
        }
        if (!response.ok) {
          throw new SwitchOnYourCodeHTTPError(response.status, `SwitchOnYourCode event stream request failed with HTTP ${response.status}.`)
        }
        const contentType = response.headers.get('Content-Type') ?? ''
        if (!contentType.toLowerCase().startsWith('text/event-stream')) {
          throw new SwitchOnYourCodeRealtimeError('SwitchOnYourCode event stream returned an unexpected Content-Type.')
        }
        if (!response.body) {
          throw new SwitchOnYourCodeRealtimeError('SwitchOnYourCode event stream did not provide a readable response body.')
        }

        let credentialRevoked = false
        await consumeServerSentEvents(response.body, {
          onRetry: (retryMs) => {
            reconnectDelayMs = Math.max(1_000, retryMs)
          },
          onEvent: (event) => {
            if (event.event === 'configuration_changed') {
              this.#queueConfigurationRefresh()
              return
            }
            if (event.event === 'credential_revoked') {
              credentialRevoked = true
              this.#onError?.(new SwitchOnYourCodeAuthenticationError('SwitchOnYourCode SDK credential was revoked.'))
              controller.abort()
            }
          },
        })

        if (credentialRevoked || controller.signal.aborted) {
          return
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }
        if (error instanceof SwitchOnYourCodeAuthenticationError) {
          this.#onError?.(error)
          return
        }
        this.#onError?.(error)
      }

      await wait(reconnectDelayMs, controller.signal)
    }
  }

  #queueConfigurationRefresh(): void {
    this.#refreshPending = true
    if (this.#refreshTask) {
      return
    }

    const task = (async () => {
      while (this.#refreshPending) {
        this.#refreshPending = false
        try {
          await this.#onConfigurationChanged()
        } catch (error) {
          this.#onError?.(error)
        }
      }
    })()
    this.#refreshTask = task
    void task.finally(() => {
      if (this.#refreshTask === task) {
        this.#refreshTask = undefined
      }
    })
  }
}

async function consumeServerSentEvents(body: ReadableStream<Uint8Array>, options: ConsumeOptions): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let eventName = ''
  let dataLines: string[] = []

  const dispatch = () => {
    if (eventName !== '' || dataLines.length > 0) {
      options.onEvent({ event: eventName || 'message', data: dataLines.join('\n') })
    }
    eventName = ''
    dataLines = []
  }

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) {
      return
    }

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) {
      value = value.slice(1)
    }

    if (field === 'event') {
      eventName = value
      return
    }
    if (field === 'data') {
      dataLines.push(value)
      return
    }
    if (field === 'retry' && /^\d+$/.test(value)) {
      const retryMs = Number(value)
      if (Number.isSafeInteger(retryMs)) {
        options.onRetry(retryMs)
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      buffer += decoder.decode(value, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        processLine(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
      }
    }

    buffer += decoder.decode()
    if (buffer !== '') {
      processLine(buffer)
    }
    dispatch()
  } finally {
    reader.releaseLock()
  }
}

function wait(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, delayMs)
    const abort = () => {
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}
