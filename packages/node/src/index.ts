import {
  FlagStackClient,
  type FlagStackClientOptions,
  type RefreshResult,
} from '@flagstack/core'

const SERVER_KEY_PREFIX = 'fs_server_'

export interface NodeFlagStackClientOptions extends Omit<FlagStackClientOptions, 'sdkKey'> {
  serverKey: string
  autoPoll?: boolean
}

export class NodeFlagStackClient extends FlagStackClient {
  readonly #autoPoll: boolean

  constructor(options: NodeFlagStackClientOptions) {
    const { serverKey, autoPoll = false, ...clientOptions } = options
    const normalizedKey = serverKey.trim()
    if (!normalizedKey.startsWith(SERVER_KEY_PREFIX)) {
      throw new TypeError('Node SDK requires a FlagStack server key (fs_server_...).')
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

export async function createNodeClient(options: NodeFlagStackClientOptions): Promise<NodeFlagStackClient> {
  const client = new NodeFlagStackClient(options)
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
