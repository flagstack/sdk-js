import {
  ErrorCode,
  type EvaluationContext as OpenFeatureEvaluationContext,
  type FlagMetadata,
  type ResolutionDetails,
} from '@openfeature/core'
import type {
  Configuration,
  EvaluationContext as FlagStackEvaluationContext,
  EvaluationDetails as FlagStackEvaluationDetails,
  EvaluationErrorCode,
} from '@flagstack/core'

const ERROR_CODES: Record<EvaluationErrorCode, ErrorCode> = {
  PARSE_ERROR: ErrorCode.PARSE_ERROR,
  TARGETING_KEY_MISSING: ErrorCode.TARGETING_KEY_MISSING,
  INVALID_CONTEXT: ErrorCode.INVALID_CONTEXT,
  PROVIDER_NOT_READY: ErrorCode.PROVIDER_NOT_READY,
  FLAG_NOT_FOUND: ErrorCode.FLAG_NOT_FOUND,
  TYPE_MISMATCH: ErrorCode.TYPE_MISMATCH,
}

export function toFlagStackContext(context: OpenFeatureEvaluationContext): FlagStackEvaluationContext {
  const converted: FlagStackEvaluationContext = {}
  for (const [key, value] of Object.entries(context)) {
    converted[key] = normalizeContextValue(value)
  }
  return converted
}

export function toOpenFeatureResolution<T>(
  details: FlagStackEvaluationDetails<T>,
  configuration: Configuration | undefined,
  flagKey: string,
): ResolutionDetails<T> {
  const flag = configuration?.flags.find((candidate) => candidate.key === flagKey)
  const flagMetadata: FlagMetadata = {}

  if (configuration) {
    flagMetadata['flagstack.environment'] = configuration.environment.key
    flagMetadata['flagstack.environment_id'] = configuration.environment.id
  }
  if (flag) {
    flagMetadata['flagstack.revision'] = flag.revision
    flagMetadata['flagstack.enabled'] = flag.enabled
  }
  if (details.ruleId) {
    flagMetadata['flagstack.rule_id'] = details.ruleId
  }

  const resolution: ResolutionDetails<T> = {
    value: details.value,
    variant: details.variant,
    reason: details.reason,
    flagMetadata,
  }
  if (details.errorCode) {
    resolution.errorCode = ERROR_CODES[details.errorCode]
  }
  if (details.errorMessage) {
    resolution.errorMessage = details.errorMessage
  }
  return resolution
}

function normalizeContextValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Array.isArray(value)) {
    return value.map(normalizeContextValue)
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeContextValue(nested)]),
    )
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
