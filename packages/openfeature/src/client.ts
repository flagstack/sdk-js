import {
  OpenFeatureEventEmitter,
  ProviderEvents,
  type EvaluationContext,
  type JsonValue,
  type Logger,
  type Provider,
  type ResolutionDetails,
} from '@openfeature/web-sdk'
import {
  BrowserSwitchOnYourCodeClient,
  type BrowserSwitchOnYourCodeClientOptions,
} from '@switchonyourcode/browser'
import { toSwitchOnYourCodeContext, toOpenFeatureResolution } from './common.js'

export type SwitchOnYourCodeClientProviderOptions = BrowserSwitchOnYourCodeClientOptions

export class SwitchOnYourCodeClientProvider implements Provider {
  readonly metadata = { name: 'Switch On Your Code' } as const
  readonly runsOn = 'client' as const
  readonly events = new OpenFeatureEventEmitter()
  readonly client: BrowserSwitchOnYourCodeClient

  #initialized = false

  constructor(options: SwitchOnYourCodeClientProviderOptions) {
    const { onConfigurationChanged, ...clientOptions } = options
    this.client = new BrowserSwitchOnYourCodeClient({
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

  resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<boolean> {
    return toOpenFeatureResolution(
      this.client.getBooleanDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<string> {
    return toOpenFeatureResolution(
      this.client.getStringDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<number> {
    return toOpenFeatureResolution(
      this.client.getNumberDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }

  resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    _logger: Logger,
  ): ResolutionDetails<T> {
    return toOpenFeatureResolution(
      this.client.getJSONDetails(flagKey, defaultValue, toSwitchOnYourCodeContext(context)),
      this.client.configuration,
      flagKey,
    )
  }
}
