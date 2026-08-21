import {
  SwitchOnYourCodeClient,
  SwitchOnYourCodeRealtimeStream,
  type SwitchOnYourCodeClientOptions,
  type SwitchOnYourCodeRealtimeStreamOptions,
  type RefreshResult,
} from '@switchonyourcode/core'

const SERVER_KEY_PREFIX = 'syoc_server_'
const DEFAULT_FALLBACK_POLL_INTERVAL_MS = 5 * 60_000

export interface NodeSwitchOnYourCodeClientOptions extends Omit<SwitchOnYourCodeClientOptions, 'sdkKey'> {
  serverKey: string
  autoPoll?: boolean
  autoRealtime?: boolean
  realtimeReconnectDelayMs?: number
}

export class NodeSwitchOnYourCodeClient extends SwitchOnYourCodeClient {
  readonly #autoPoll: boolean
  readonly #autoRealtime: boolean
  readonly #realtime: SwitchOnYourCodeRealtimeStream

  constructor(options: NodeSwitchOnYourCodeClientOptions) {
    const {
      serverKey,
      autoRealtime = false,
      autoPoll = autoRealtime,
      pollIntervalMs = DEFAULT_FALLBACK_POLL_INTERVAL_MS,
      realtimeReconnectDelayMs,
      ...clientOptions
    } = options
    const normalizedKey = serverKey.trim()
    if (!normalizedKey.startsWith(SERVER_KEY_PREFIX)) {
      throw new TypeError('Node SDK requires a Switch On Your Code server key (syoc_server_...).')
    }

    super({ ...clientOptions, pollIntervalMs, sdkKey: normalizedKey })

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

  close(): void {
    this.stopRealtime()
    super.close()
  }
}

export async function createNodeClient(options: NodeSwitchOnYourCodeClientOptions): Promise<NodeSwitchOnYourCodeClient> {
  const client = new NodeSwitchOnYourCodeClient(options)
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
