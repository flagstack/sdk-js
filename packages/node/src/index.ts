import {
  SwitchOnYourCodeClient,
  type SwitchOnYourCodeClientOptions,
  type RefreshResult,
} from '@switchonyourcode/core'

const SERVER_KEY_PREFIX = 'syoc_server_'

export interface NodeSwitchOnYourCodeClientOptions extends Omit<SwitchOnYourCodeClientOptions, 'sdkKey'> {
  serverKey: string
  autoPoll?: boolean
}

export class NodeSwitchOnYourCodeClient extends SwitchOnYourCodeClient {
  readonly #autoPoll: boolean

  constructor(options: NodeSwitchOnYourCodeClientOptions) {
    const { serverKey, autoPoll = false, ...clientOptions } = options
    const normalizedKey = serverKey.trim()
    if (!normalizedKey.startsWith(SERVER_KEY_PREFIX)) {
      throw new TypeError('Node SDK requires a Switch On Your Code server key (syoc_server_...).')
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
} from '@switchonyourcode/core'
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@switchonyourcode/core'
