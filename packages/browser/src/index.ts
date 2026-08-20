import {
  SwitchOnYourCodeClient,
  type Configuration,
  type SwitchOnYourCodeClientOptions,
  type RefreshResult,
} from '@switchonyourcode/core'

const CLIENT_KEY_PREFIX = 'syoc_client_'

export interface BrowserSwitchOnYourCodeClientOptions extends Omit<SwitchOnYourCodeClientOptions, 'sdkKey'> {
  clientKey: string
  autoPoll?: boolean
}

export class BrowserSwitchOnYourCodeClient extends SwitchOnYourCodeClient {
  readonly #autoPoll: boolean
  readonly #configurationListeners: Set<() => void>

  constructor(options: BrowserSwitchOnYourCodeClientOptions) {
    const { clientKey, autoPoll = true, onConfigurationChanged, ...clientOptions } = options
    const normalizedKey = clientKey.trim()
    if (!normalizedKey.startsWith(CLIENT_KEY_PREFIX)) {
      throw new TypeError('Browser SDK requires a SwitchOnYourCode client key (syoc_client_...).')
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
} from '@switchonyourcode/core'
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@switchonyourcode/core'
