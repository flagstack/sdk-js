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
  BrowserFlagStackClient,
  type BrowserFlagStackClientOptions,
} from '@flagstack/browser'
import { toFlagStackContext, toOpenFeatureResolution } from './common.js'

export type FlagStackClientProviderOptions = BrowserFlagStackClientOptions

export class FlagStackClientProvider implements Provider {
  readonly metadata = { name: 'FlagStack' } as const
  readonly runsOn = 'client' as const
  readonly events = new OpenFeatureEventEmitter()
  readonly client: BrowserFlagStackClient

  #initialized = false

  constructor(options: FlagStackClientProviderOptions) {
    const { onConfigurationChanged, ...clientOptions } = options
    this.client = new BrowserFlagStackClient({
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
      this.client.getBooleanDetails(flagKey, defaultValue, toFlagStackContext(context)),
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
      this.client.getStringDetails(flagKey, defaultValue, toFlagStackContext(context)),
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
      this.client.getNumberDetails(flagKey, defaultValue, toFlagStackContext(context)),
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
      this.client.getJSONDetails(flagKey, defaultValue, toFlagStackContext(context)),
      this.client.configuration,
      flagKey,
    )
  }
}
