import {
  OpenFeatureEventEmitter,
  ProviderEvents,
  type EvaluationContext,
  type JsonValue,
  type Logger,
  type Provider,
  type ResolutionDetails,
} from '@openfeature/server-sdk'
import {
  NodeSwitchOnYourCodeClient,
  type NodeSwitchOnYourCodeClientOptions,
} from '@switchonyourcode/node'
import { toSwitchOnYourCodeContext, toOpenFeatureResolution } from './common.js'

export type SwitchOnYourCodeServerProviderOptions = NodeSwitchOnYourCodeClientOptions

export class SwitchOnYourCodeServerProvider implements Provider {
  readonly metadata = { name: 'Switch On Your Code' } as const
  readonly runsOn = 'server' as const
  readonly events = new OpenFeatureEventEmitter()
  readonly client: NodeSwitchOnYourCodeClient

  #initialized = false

  constructor(options: SwitchOnYourCodeServerProviderOptions) {
    const { onConfigurationChanged, ...clientOptions } = options
    this.client = new NodeSwitchOnYourCodeClient({
      ...clientOptions,
      onConfigurationChanged: (configuration) => {
        onConfigurationChanged?.(configuration)
        if (this.#initialized) {
          this.events.emit(ProviderEvents.ConfigurationChanged)
        }
      },
    })
  }

  async initialize(): Promise<void> {
    await this.client.initialize()
    this.#initialized = true
  }

  async onClose(): Promise<void> {
    this.#initialized = false
    this.client.close()
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<boolean>> {
    return toOpenFeatureResolution(
      this.client.getBooleanDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<string>> {
    return toOpenFeatureResolution(
      this.client.getStringDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<number>> {
    return toOpenFeatureResolution(
      this.client.getNumberDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  async resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    _logger: Logger,
  ): Promise<ResolutionDetails<T>> {
    return toOpenFeatureResolution(
      this.client.getJSONDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }
}
