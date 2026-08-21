import {
  SwitchOnYourCodeClient,
  SwitchOnYourCodeRealtimeStream,
  type Configuration,
  type SwitchOnYourCodeClientOptions,
  type SwitchOnYourCodeRealtimeStreamOptions,
  type RefreshResult,
} from '@switchonyourcode/core'

const CLIENT_KEY_PREFIX = 'syoc_client_'
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 5 * 60_000

export interface BrowserSwitchOnYourCodeClientOptions extends Omit<SwitchOnYourCodeClientOptions, 'sdkKey'> {
  clientKey: string
  autoPoll?: boolean
  autoRealtime?: boolean
  realtimeReconnectDelayMs?: number
}

export class BrowserSwitchOnYourCodeClient extends SwitchOnYourCodeClient {
  readonly #autoPoll: boolean
  readonly #autoRealtime: boolean
  readonly #configurationListeners: Set<() => void>
  readonly #realtime: SwitchOnYourCodeRealtimeStream

  constructor(options: BrowserSwitchOnYourCodeClientOptions) {
    const {
      clientKey,
      autoPoll = true,
      autoRealtime = true,
      pollIntervalMs = DEFAULT_FALLBACK_POLL_INTERVAL_MS,
      realtimeReconnectDelayMs,
      onConfigurationChanged,
      ...clientOptions
    } = options
    const normalizedKey = clientKey.trim()
    if (!normalizedKey.startsWith(CLIENT_KEY_PREFIX)) {
      throw new TypeError('Browser SDK requires a Switch On Your Code client key (syoc_client_...).')
    }

    const configurationListeners = new Set<() => void>()
    super({
      ...clientOptions,
      pollIntervalMs,
      sdkKey: normalizedKey,
      onConfigurationChanged: (configuration: Configuration) => {
        onConfigurationChanged?.(configuration)
        for (const listener of configurationListeners) {
          listener()
        }
      },
    })

    const realtimeOptions: SwitchOnYourCodeRealtimeStreamOptions = {
      baseUrl: clientOptions.baseUrl,
      sdkKey: normalizedKey,
      fetch: clientOptions.fetch ?? globalThis.fetch,
      onConfigurationChanged: async () => {
        await this.refresh()
      },
      onError: clientOptions.onError,
    }
    if (realtimeReconnectDelayMs !== undefined) {
      realtimeOptions.reconnectDelayMs = realtimeReconnectDelayMs
    }

    this.#autoPoll = autoPoll
    this.#autoRealtime = autoRealtime
    this.#configurationListeners = configurationListeners
    this.#realtime = new SwitchOnYourCodeRealtimeStream(realtimeOptions)
  }

  get realtimeRunning(): boolean {
    return this.#realtime.running
  }

  async initialize(): Promise<RefreshResult> {
    const result = await this.refresh()
    if (this.#autoRealtime) {
      this.startRealtime()
    }
    if (this.#autoPoll) {
      this.startPolling()
    }
    return result
  }

  startRealtime(): void {
    this.#realtime.start()
  }

  stopRealtime(): void {
    this.#realtime.stop()
  }

  subscribe(listener: () => void): () => void {
    this.#configurationListeners.add(listener)
    return () => {
      this.#configurationListeners.delete(listener)
    }
  }

  close(): void {
    this.stopRealtime()
    super.close()
  }
}

export async function createBrowserClient(options: BrowserSwitchOnYourCodeClientOptions): Promise<BrowserSwitchOnYourCodeClient> {
  const client = new BrowserSwitchOnYourCodeClient(options)
  await client.initialize()
  return client
}

export {
  SwitchOnYourCodeAuthenticationError,
  SwitchOnYourCodeConfigurationError,
  SwitchOnYourCodeError,
  SwitchOnYourCodeHTTPError,
  SwitchOnYourCodeRealtimeError,
} from '@switchonyourcode/core'
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@switchonyourcode/core'
