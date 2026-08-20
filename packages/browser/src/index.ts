import {
  FlagStackClient,
  type Configuration,
  type FlagStackClientOptions,
  type RefreshResult,
} from '@flagstack/core'

const CLIENT_KEY_PREFIX = 'fs_client_'

export interface BrowserFlagStackClientOptions extends Omit<FlagStackClientOptions, 'sdkKey'> {
  clientKey: string
  autoPoll?: boolean
}

export class BrowserFlagStackClient extends FlagStackClient {
  readonly #autoPoll: boolean
  readonly #configurationListeners: Set<() => void>

  constructor(options: BrowserFlagStackClientOptions) {
    const { clientKey, autoPoll = true, onConfigurationChanged, ...clientOptions } = options
    const normalizedKey = clientKey.trim()
    if (!normalizedKey.startsWith(CLIENT_KEY_PREFIX)) {
      throw new TypeError('Browser SDK requires a FlagStack client key (fs_client_...).')
    }

    const configurationListeners = new Set<() => void>()
    super({
      ...clientOptions,
      sdkKey: normalizedKey,
      onConfigurationChanged: (configuration: Configuration) => {
        onConfigurationChanged?.(configuration)
        for (const listener of configurationListeners) {
          listener()
        }
      },
    })
    this.#autoPoll = autoPoll
    this.#configurationListeners = configurationListeners
  }

  async initialize(): Promise<RefreshResult> {
    const result = await this.refresh()
    if (this.#autoPoll) {
      this.startPolling()
    }
    return result
  }

  subscribe(listener: () => void): () => void {
    this.#configurationListeners.add(listener)
    return () => {
      this.#configurationListeners.delete(listener)
    }
  }
}

export async function createBrowserClient(options: BrowserFlagStackClientOptions): Promise<BrowserFlagStackClient> {
  const client = new BrowserFlagStackClient(options)
  await client.initialize()
  return client
}

export {
  FlagStackAuthenticationError,
  FlagStackConfigurationError,
  FlagStackError,
  FlagStackHTTPError,
} from '@flagstack/core'
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@flagstack/core'
