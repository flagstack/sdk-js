import { RE2JS } from 're2js'
import { bucket } from './bucket.js'
import { EvaluationFailure } from './evaluation-error.js'
import { compareSemver } from './semver.js'
import { validateFlag, validateSegment } from './validation.js'
import {
  type Condition,
  type ConfigurationFlag,
  type EvaluationContext,
  type EvaluationDetails,
  type MatchMode,
  type Outcome,
  type Segment,
} from './types.js'

export function evaluateFlag<T = unknown>(
  flag: ConfigurationFlag,
  environmentId: string,
  context: EvaluationContext = {},
  segments: Segment[] = [],
): EvaluationDetails<T> {
  try {
    validateFlag(flag, environmentId)
    const segmentIndex = new Map<string, Segment>()
    for (const segment of segments) {
      validateSegment(segment)
      segmentIndex.set(segment.key, segment)
    }

    if (!flag.enabled) {
      return details(flag.default_value as T, 'default', 'DISABLED')
    }

    for (const rule of flag.policy.rules ?? []) {
      if (!matchConditions(rule.match, rule.conditions, context, segmentIndex, new Set())) {
        continue
      }
      const result = resolveOutcome<T>(flag, environmentId, rule.outcome, context)
      return {
        ...result,
        reason: (rule.outcome.rollout?.length ?? 0) > 0 ? 'SPLIT' : 'TARGETING_MATCH',
        ruleId: rule.id,
      }
    }

    const fallthrough = flag.policy.fallthrough ?? {}
    if (outcomeEmpty(fallthrough)) {
      if (flag.kind === 'boolean') {
        return details(true as T, 'on', 'STATIC')
      }
      return details(flag.default_value as T, 'default', 'DEFAULT')
    }

    const result = resolveOutcome<T>(flag, environmentId, fallthrough, context)
    return {
      ...result,
      reason: (fallthrough.rollout?.length ?? 0) > 0 ? 'SPLIT' : 'STATIC',
    }
  } catch (error) {
    const failure = error instanceof EvaluationFailure
      ? error
      : new EvaluationFailure('PARSE_ERROR', error instanceof Error ? error.message : String(error))
    return {
      value: flag.default_value as T,
      variant: 'default',
      reason: 'ERROR',
      errorCode: failure.code,
      errorMessage: failure.message,
    }
  }
}

function resolveOutcome<T>(
  flag: ConfigurationFlag,
  environmentId: string,
  outcome: Outcome,
  context: EvaluationContext,
): Omit<EvaluationDetails<T>, 'reason'> {
  if ((outcome.variant ?? '').trim() !== '') {
    const key = outcome.variant as string
    return { value: variantValue(flag, key) as T, variant: key }
  }

  const allocations = outcome.rollout ?? []
  const value = resolveBucketValue(context, outcome.bucket_by)
  const selectedBucket = bucket(environmentId, flag.id, value)
  let cumulative = 0
  for (const allocation of allocations) {
    cumulative += allocation.weight
    if (selectedBucket < cumulative) {
      return { value: variantValue(flag, allocation.variant) as T, variant: allocation.variant }
    }
  }
  throw new EvaluationFailure('PARSE_ERROR', 'rollout did not resolve a variant')
}

function resolveBucketValue(context: EvaluationContext, bucketBy?: string): string {
  if (!bucketBy || bucketBy === 'targetingKey') {
    const targetingKey = context.targetingKey
    if (typeof targetingKey !== 'string' || targetingKey === '') {
      throw new EvaluationFailure('TARGETING_KEY_MISSING', 'targeting key is required for percentage rollout')
    }
    return targetingKey
  }

  const found = contextValue(context, bucketBy)
  if (!found.exists) {
    throw new EvaluationFailure('INVALID_CONTEXT', `bucket attribute ${JSON.stringify(bucketBy)} is missing`)
  }
  const value = found.value
  if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
    throw new EvaluationFailure('INVALID_CONTEXT', `bucket attribute ${JSON.stringify(bucketBy)} must be a scalar string, boolean or number`)
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new EvaluationFailure('INVALID_CONTEXT', `bucket attribute ${JSON.stringify(bucketBy)} must be a finite number`)
  }
  return JSON.stringify(value)
}

function variantValue(flag: ConfigurationFlag, key: string): unknown {
  if (key === 'default') return flag.default_value
  if (flag.kind === 'boolean' && key === 'on') return true
  if (flag.kind === 'boolean' && key === 'off') return false
  const variant = flag.variants.find((candidate) => candidate.key === key)
  if (!variant) {
    throw new EvaluationFailure('PARSE_ERROR', `unknown variant ${JSON.stringify(key)}`)
  }
  return variant.value
}

function matchConditions(
  mode: MatchMode,
  conditions: Condition[],
  context: EvaluationContext,
  segments: Map<string, Segment>,
  visiting: Set<string>,
): boolean {
  if (mode === 'any') {
    return conditions.some((condition) => conditionMatches(condition, context, segments, visiting))
  }
  return conditions.every((condition) => conditionMatches(condition, context, segments, visiting))
}

function conditionMatches(
  condition: Condition,
  context: EvaluationContext,
  segments: Map<string, Segment>,
  visiting: Set<string>,
): boolean {
  if (condition.operator === 'in_segment' || condition.operator === 'not_in_segment') {
    const segmentKey = condition.value
    if (typeof segmentKey !== 'string') {
      throw new EvaluationFailure('PARSE_ERROR', 'segment condition must reference a string key')
    }
    const matched = matchSegment(segmentKey, context, segments, visiting)
    return condition.operator === 'not_in_segment' ? !matched : matched
  }

  const found = contextValue(context, condition.attribute ?? '')
  if (condition.operator === 'exists') return found.exists
  if (condition.operator === 'not_exists') return !found.exists
  if (!found.exists) return false

  const actual = found.value
  const expected = condition.value
  switch (condition.operator) {
    case 'equals': return equalValues(actual, expected)
    case 'not_equals': return !equalValues(actual, expected)
    case 'in':
    case 'not_in': {
      if (!Array.isArray(expected)) {
        throw new EvaluationFailure('PARSE_ERROR', `${condition.operator} expects an array`)
      }
      const matched = expected.some((candidate) => equalValues(actual, candidate))
      return condition.operator === 'not_in' ? !matched : matched
    }
    case 'contains':
    case 'not_contains': {
      const matched = containsValue(actual, expected)
      return condition.operator === 'not_contains' ? !matched : matched
    }
    case 'starts_with': return typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected)
    case 'ends_with': return typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected)
    case 'greater_than':
    case 'greater_than_or_equal':
    case 'less_than':
    case 'less_than_or_equal': {
      if (typeof actual !== 'number' || typeof expected !== 'number') return false
      if (condition.operator === 'greater_than') return actual > expected
      if (condition.operator === 'greater_than_or_equal') return actual >= expected
      if (condition.operator === 'less_than') return actual < expected
      return actual <= expected
    }
    case 'matches_regex': {
      if (typeof actual !== 'string' || typeof expected !== 'string') return false
      try {
        return RE2JS.compile(expected).test(actual)
      } catch (error) {
        throw new EvaluationFailure('PARSE_ERROR', error instanceof Error ? error.message : 'invalid regular expression')
      }
    }
    case 'semver_greater_than':
    case 'semver_greater_than_or_equal':
    case 'semver_less_than':
    case 'semver_less_than_or_equal': {
      if (typeof actual !== 'string' || typeof expected !== 'string') return false
      const comparison = compareSemver(actual, expected)
      if (comparison === undefined) return false
      if (condition.operator === 'semver_greater_than') return comparison > 0
      if (condition.operator === 'semver_greater_than_or_equal') return comparison >= 0
      if (condition.operator === 'semver_less_than') return comparison < 0
      return comparison <= 0
    }
  }
}

function matchSegment(
  key: string,
  context: EvaluationContext,
  segments: Map<string, Segment>,
  visiting: Set<string>,
): boolean {
  const segment = segments.get(key)
  if (!segment) return false
  if (visiting.has(key)) {
    throw new EvaluationFailure('PARSE_ERROR', `segment cycle detected at ${JSON.stringify(key)}`)
  }
  visiting.add(key)
  try {
    return matchConditions(segment.match, segment.conditions, context, segments, visiting)
  } finally {
    visiting.delete(key)
  }
}

function contextValue(context: EvaluationContext, path: string): { exists: boolean; value?: unknown } {
  if (path === 'targetingKey') {
    return typeof context.targetingKey === 'string' && context.targetingKey !== ''
      ? { exists: true, value: context.targetingKey }
      : { exists: false }
  }
  if (path === '') return { exists: false }

  let current: unknown = context
  for (const part of path.split('.')) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { exists: false }
    }
    current = current[part]
  }
  return { exists: true, value: current }
}

function containsValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === 'string') {
    return typeof expected === 'string' && actual.includes(expected)
  }
  if (Array.isArray(actual)) {
    return actual.some((candidate) => equalValues(candidate, expected))
  }
  if (isRecord(actual)) {
    return typeof expected === 'string' && Object.prototype.hasOwnProperty.call(actual, expected)
  }
  return false
}

function equalValues(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') return left === right
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equalValues(value, right[index]))
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    return leftKeys.length === rightKeys.length && leftKeys.every(
      (key) => Object.prototype.hasOwnProperty.call(right, key) && equalValues(left[key], right[key]),
    )
  }
  return false
}

function outcomeEmpty(outcome: Outcome): boolean {
  return (outcome.variant ?? '').trim() === '' && (outcome.rollout?.length ?? 0) === 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function details<T>(value: T, variant: string, reason: EvaluationDetails<T>['reason']): EvaluationDetails<T> {
  return { value, variant, reason }
}
