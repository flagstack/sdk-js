import {
  FlagStackClient,
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

  constructor(options: BrowserFlagStackClientOptions) {
    const { clientKey, autoPoll = true, ...clientOptions } = options
    const normalizedKey = clientKey.trim()
    if (!normalizedKey.startsWith(CLIENT_KEY_PREFIX)) {
      throw new TypeError('Browser SDK requires a FlagStack client key (fs_client_...).')
    }

    super({ ...clientOptions, sdkKey: normalizedKey })
    this.#autoPoll = autoPoll
  }

  async initialize(): Promise<RefreshResult> {
    const result = await this.refresh()
    if (this.#autoPoll) {
      this.startPolling()
    }
    return result
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
