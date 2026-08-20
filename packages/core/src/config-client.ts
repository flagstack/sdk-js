import { evaluateFlag } from './evaluator.js'
import { validateEvaluationConfiguration } from './validation.js'
import {
  SCHEMA_VERSION,
  type Configuration,
  type ConfigurationFlag,
  type EvaluationContext,
  type EvaluationDetails,
  type EvaluationErrorCode,
  type FlagKind,
  type Outcome,
  type Policy,
  type Rule,
  type Segment,
} from './types.js'

export type RefreshResult = 'updated' | 'not-modified'

export interface SwitchOnYourCodeClientOptions {
  baseUrl: string
  sdkKey: string
  fetch?: typeof fetch
  pollIntervalMs?: number
  onError?: (error: unknown) => void
  onConfigurationChanged?: (configuration: Configuration) => void
}

export class SwitchOnYourCodeError extends Error {}

export class SwitchOnYourCodeAuthenticationError extends SwitchOnYourCodeError {
  constructor(message = 'SwitchOnYourCode SDK credential was rejected.') {
    super(message)
    this.name = 'SwitchOnYourCodeAuthenticationError'
  }
}

export class SwitchOnYourCodeHTTPError extends SwitchOnYourCodeError {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SwitchOnYourCodeHTTPError'
    this.status = status
  }
}

export class SwitchOnYourCodeConfigurationError extends SwitchOnYourCodeError {
  constructor(message: string) {
    super(message)
    this.name = 'SwitchOnYourCodeConfigurationError'
  }
}

export class SwitchOnYourCodeClient {
  readonly #baseUrl: string
  readonly #sdkKey: string
  readonly #fetch: typeof fetch
  readonly #pollIntervalMs: number
  readonly #onError: ((error: unknown) => void) | undefined
  readonly #onConfigurationChanged: ((configuration: Configuration) => void) | undefined

  #configuration: Configuration | undefined
  #etag: string | undefined
  #flags = new Map<string, ConfigurationFlag>()
  #pollTimer: ReturnType<typeof setInterval> | undefined

  constructor(options: SwitchOnYourCodeClientOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, '')
    const sdkKey = options.sdkKey.trim()
    if (baseUrl === '') {
      throw new TypeError('SwitchOnYourCode baseUrl is required.')
    }
    if (sdkKey === '') {
      throw new TypeError('SwitchOnYourCode sdkKey is required.')
    }
    const fetchImplementation = options.fetch ?? globalThis.fetch
    if (typeof fetchImplementation !== 'function') {
      throw new TypeError('A fetch implementation is required.')
    }
    if (options.pollIntervalMs !== undefined && (!Number.isFinite(options.pollIntervalMs) || options.pollIntervalMs <= 0)) {
      throw new TypeError('pollIntervalMs must be a positive number.')
    }

    this.#baseUrl = baseUrl
    this.#sdkKey = sdkKey
    this.#fetch = fetchImplementation
    this.#pollIntervalMs = options.pollIntervalMs ?? 30_000
    this.#onError = options.onError
    this.#onConfigurationChanged = options.onConfigurationChanged
  }

  get configuration(): Configuration | undefined {
    return this.#configuration
  }

  get etag(): string | undefined {
    return this.#etag
  }

  get ready(): boolean {
    return this.#configuration !== undefined
  }

  async refresh(): Promise<RefreshResult> {
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${this.#sdkKey}`,
    })
    if (this.#etag) {
      headers.set('If-None-Match', this.#etag)
    }

    const response = await this.#fetch(`${this.#baseUrl}/sdk/v1/config`, {
      method: 'GET',
      headers,
    })
    if (response.status === 304) {
      if (!this.#configuration) {
        throw new SwitchOnYourCodeConfigurationError('SwitchOnYourCode returned 304 before any configuration was loaded.')
      }
      return 'not-modified'
    }
    if (response.status === 401) {
      throw new SwitchOnYourCodeAuthenticationError()
    }
    if (!response.ok) {
      throw new SwitchOnYourCodeHTTPError(response.status, `SwitchOnYourCode configuration request failed with HTTP ${response.status}.`)
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch (error) {
      throw new SwitchOnYourCodeConfigurationError(`SwitchOnYourCode configuration response was not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
    const configuration = parseConfiguration(payload)
    this.#configuration = configuration
    this.#flags = new Map(configuration.flags.map((flag) => [flag.key, flag]))
    this.#etag = response.headers.get('ETag') ?? undefined
    this.#onConfigurationChanged?.(configuration)
    return 'updated'
  }

  startPolling(): void {
    if (this.#pollTimer) {
      return
    }
    this.#pollTimer = setInterval(() => {
      void this.refresh().catch((error) => this.#onError?.(error))
    }, this.#pollIntervalMs)
  }

  stopPolling(): void {
    if (!this.#pollTimer) {
      return
    }
    clearInterval(this.#pollTimer)
    this.#pollTimer = undefined
  }

  close(): void {
    this.stopPolling()
  }

  getBooleanValue(key: string, fallback: boolean, context: EvaluationContext = {}): boolean {
    return this.getBooleanDetails(key, fallback, context).value
  }

  getBooleanDetails(key: string, fallback: boolean, context: EvaluationContext = {}): EvaluationDetails<boolean> {
    return this.#evaluateTyped(key, 'boolean', fallback, context)
  }

  getStringValue(key: string, fallback: string, context: EvaluationContext = {}): string {
    return this.getStringDetails(key, fallback, context).value
  }

  getStringDetails(key: string, fallback: string, context: EvaluationContext = {}): EvaluationDetails<string> {
    return this.#evaluateTyped(key, 'string', fallback, context)
  }

  getNumberValue(key: string, fallback: number, context: EvaluationContext = {}): number {
    return this.getNumberDetails(key, fallback, context).value
  }

  getNumberDetails(key: string, fallback: number, context: EvaluationContext = {}): EvaluationDetails<number> {
    return this.#evaluateTyped(key, 'number', fallback, context)
  }

  getJSONValue<T>(key: string, fallback: T, context: EvaluationContext = {}): T {
    return this.getJSONDetails(key, fallback, context).value
  }

  getJSONDetails<T>(key: string, fallback: T, context: EvaluationContext = {}): EvaluationDetails<T> {
    return this.#evaluateTyped(key, 'json', fallback, context)
  }

  #evaluateTyped<T>(key: string, expectedKind: FlagKind, fallback: T, context: EvaluationContext): EvaluationDetails<T> {
    if (!this.#configuration) {
      return fallbackDetails(fallback, 'PROVIDER_NOT_READY', 'SwitchOnYourCode configuration has not been loaded yet.')
    }
    const flag = this.#flags.get(key)
    if (!flag) {
      return fallbackDetails(fallback, 'FLAG_NOT_FOUND', `Feature flag ${JSON.stringify(key)} was not found.`)
    }
    if (flag.kind !== expectedKind) {
      return fallbackDetails(fallback, 'TYPE_MISMATCH', `Feature flag ${JSON.stringify(key)} is ${flag.kind}, not ${expectedKind}.`)
    }
    return evaluateFlag<T>(flag, this.#configuration.environment.id, context, this.#configuration.segments)
  }
}

export function parseConfiguration(payload: unknown): Configuration {
  if (!isRecord(payload)) {
    throw new SwitchOnYourCodeConfigurationError('SwitchOnYourCode configuration must be an object.')
  }
  if (payload.schema_version !== SCHEMA_VERSION) {
    throw new SwitchOnYourCodeConfigurationError(`Unsupported SwitchOnYourCode schema version ${String(payload.schema_version)}.`)
  }
  if (!isRecord(payload.environment) || !nonEmptyString(payload.environment.id) || !nonEmptyString(payload.environment.key)) {
    throw new SwitchOnYourCodeConfigurationError('SwitchOnYourCode configuration environment is invalid.')
  }
  if (!Array.isArray(payload.flags) || !Array.isArray(payload.segments)) {
    throw new SwitchOnYourCodeConfigurationError('SwitchOnYourCode configuration flags and segments must be arrays.')
  }

  const segments = payload.segments.map(parseSegment)
  const flags = payload.flags.map(parseFlag)
  const configuration: Configuration = {
    schema_version: SCHEMA_VERSION,
    environment: { id: payload.environment.id, key: payload.environment.key },
    flags,
    segments,
  }
  try {
    validateEvaluationConfiguration(configuration)
  } catch (error) {
    throw new SwitchOnYourCodeConfigurationError(`SwitchOnYourCode configuration is not compatible with the v1 evaluator: ${error instanceof Error ? error.message : String(error)}`)
  }
  return configuration
}

function parseFlag(value: unknown): ConfigurationFlag {
  if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.key)) {
    throw new SwitchOnYourCodeConfigurationError('Flag entry is missing a valid id or key.')
  }
  if (!isFlagKind(value.kind) || typeof value.enabled !== 'boolean' || !Number.isInteger(value.revision) || (value.revision as number) < 0) {
    throw new SwitchOnYourCodeConfigurationError(`Flag ${JSON.stringify(value.key)} has invalid kind, enabled state or revision.`)
  }
  if (!Array.isArray(value.variants) || !isRecord(value.policy)) {
    throw new SwitchOnYourCodeConfigurationError(`Flag ${JSON.stringify(value.key)} has invalid variants or policy.`)
  }
  const variants = value.variants.map((variant) => {
    if (!isRecord(variant) || !nonEmptyString(variant.key) || !Object.prototype.hasOwnProperty.call(variant, 'value')) {
      throw new SwitchOnYourCodeConfigurationError(`Flag ${JSON.stringify(value.key)} contains an invalid variant.`)
    }
    return { key: variant.key, value: variant.value }
  })
  if (!Object.prototype.hasOwnProperty.call(value, 'default_value')) {
    throw new SwitchOnYourCodeConfigurationError(`Flag ${JSON.stringify(value.key)} is missing default_value.`)
  }
  return {
    id: value.id,
    key: value.key,
    kind: value.kind,
    default_value: value.default_value,
    enabled: value.enabled,
    variants,
    policy: parsePolicy(value.policy),
    revision: value.revision as number,
  }
}

function parsePolicy(value: Record<string, unknown>): Policy {
  const policy: Policy = {}
  if (value.rules !== undefined) {
    if (!Array.isArray(value.rules)) {
      throw new SwitchOnYourCodeConfigurationError('Policy rules must be an array.')
    }
    policy.rules = value.rules.map((rule) => {
      if (!isRecord(rule) || !nonEmptyString(rule.id) || (rule.match !== 'all' && rule.match !== 'any') || !Array.isArray(rule.conditions) || !isRecord(rule.outcome)) {
        throw new SwitchOnYourCodeConfigurationError('Policy contains an invalid rule.')
      }
      const parsed: Rule = {
        id: rule.id,
        match: rule.match,
        conditions: rule.conditions.map(parseCondition),
        outcome: parseOutcome(rule.outcome),
      }
      return typeof rule.name === 'string' ? { ...parsed, name: rule.name } : parsed
    })
  }
  if (value.fallthrough !== undefined) {
    if (!isRecord(value.fallthrough)) {
      throw new SwitchOnYourCodeConfigurationError('Policy fallthrough must be an object.')
    }
    policy.fallthrough = parseOutcome(value.fallthrough)
  }
  return policy
}

function parseSegment(value: unknown): Segment {
  if (!isRecord(value) || !nonEmptyString(value.key) || typeof value.name !== 'string' || (value.match !== 'all' && value.match !== 'any') || !Array.isArray(value.conditions)) {
    throw new SwitchOnYourCodeConfigurationError('Configuration contains an invalid segment.')
  }
  return { key: value.key, name: value.name, match: value.match, conditions: value.conditions.map(parseCondition) }
}

function parseCondition(value: unknown): Segment['conditions'][number] {
  if (!isRecord(value) || typeof value.operator !== 'string') {
    throw new SwitchOnYourCodeConfigurationError('Configuration contains an invalid condition.')
  }
  const condition: Segment['conditions'][number] = { operator: value.operator as Segment['conditions'][number]['operator'] }
  if (value.attribute !== undefined) {
    if (typeof value.attribute !== 'string') throw new SwitchOnYourCodeConfigurationError('Condition attribute must be a string.')
    condition.attribute = value.attribute
  }
  if (Object.prototype.hasOwnProperty.call(value, 'value')) {
    condition.value = value.value
  }
  return condition
}

function parseOutcome(value: Record<string, unknown>): Outcome {
  const outcome: Outcome = {}
  if (value.variant !== undefined) {
    if (typeof value.variant !== 'string') throw new SwitchOnYourCodeConfigurationError('Outcome variant must be a string.')
    outcome.variant = value.variant
  }
  if (value.bucket_by !== undefined) {
    if (typeof value.bucket_by !== 'string') throw new SwitchOnYourCodeConfigurationError('Outcome bucket_by must be a string.')
    outcome.bucket_by = value.bucket_by
  }
  if (value.rollout !== undefined) {
    if (!Array.isArray(value.rollout)) throw new SwitchOnYourCodeConfigurationError('Outcome rollout must be an array.')
    outcome.rollout = value.rollout.map((allocation) => {
      if (!isRecord(allocation) || !nonEmptyString(allocation.variant) || !Number.isInteger(allocation.weight)) {
        throw new SwitchOnYourCodeConfigurationError('Outcome contains an invalid rollout allocation.')
      }
      return { variant: allocation.variant, weight: allocation.weight as number }
    })
  }
  return outcome
}

function fallbackDetails<T>(fallback: T, code: EvaluationErrorCode, message: string): EvaluationDetails<T> {
  return { value: fallback, variant: 'default', reason: 'ERROR', errorCode: code, errorMessage: message }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isFlagKind(value: unknown): value is FlagKind {
  return value === 'boolean' || value === 'string' || value === 'number' || value === 'json'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
