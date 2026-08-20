import { RE2JS } from 're2js'
import { EvaluationFailure } from './evaluation-error.js'
import { compareSemver } from './semver.js'
import {
  BUCKET_SCALE,
  type Condition,
  type Configuration,
  type ConfigurationFlag,
  type MatchMode,
  type Outcome,
  type Segment,
} from './types.js'

export function validateEvaluationConfiguration(configuration: Configuration): void {
  for (const segment of configuration.segments) {
    validateSegment(segment)
  }
  for (const flag of configuration.flags) {
    validateFlag(flag, configuration.environment.id)
  }
}

export function validateFlag(flag: ConfigurationFlag, environmentId: string): void {
  if (flag.id.trim() === '' || environmentId.trim() === '') {
    throw new EvaluationFailure('PARSE_ERROR', 'flag and environment IDs are required')
  }
  validateValueKind(flag.kind, flag.default_value)

  const allowed = new Set(['default'])
  if (flag.kind === 'boolean') {
    allowed.add('on')
    allowed.add('off')
  }
  for (const variant of flag.variants) {
    const key = variant.key.trim()
    if (key === '') {
      throw new EvaluationFailure('PARSE_ERROR', 'variant key is required')
    }
    if (allowed.has(key)) {
      throw new EvaluationFailure('PARSE_ERROR', `variant key ${JSON.stringify(key)} is reserved or duplicated`)
    }
    validateValueKind(flag.kind, variant.value)
    allowed.add(key)
  }

  const seenRules = new Set<string>()
  for (const rule of flag.policy.rules ?? []) {
    if (rule.id.trim() === '') {
      throw new EvaluationFailure('PARSE_ERROR', 'rule ID is required')
    }
    if (seenRules.has(rule.id)) {
      throw new EvaluationFailure('PARSE_ERROR', `duplicate rule ID ${JSON.stringify(rule.id)}`)
    }
    seenRules.add(rule.id)
    validateMatchMode(rule.match)
    if (rule.conditions.length === 0) {
      throw new EvaluationFailure('PARSE_ERROR', `rule ${JSON.stringify(rule.id)} must contain at least one condition`)
    }
    rule.conditions.forEach(validateCondition)
    validateOutcome(rule.outcome, allowed, true)
  }
  validateOutcome(flag.policy.fallthrough ?? {}, allowed, false)
}

export function validateSegment(segment: Segment): void {
  if (segment.key.trim() === '') {
    throw new EvaluationFailure('PARSE_ERROR', 'segment key is required')
  }
  validateMatchMode(segment.match)
  if (segment.conditions.length === 0) {
    throw new EvaluationFailure('PARSE_ERROR', `segment ${JSON.stringify(segment.key)} must contain at least one condition`)
  }
  segment.conditions.forEach(validateCondition)
}

function validateCondition(condition: Condition): void {
  if (condition.operator === 'in_segment' || condition.operator === 'not_in_segment') {
    if (typeof condition.value !== 'string' || condition.value.trim() === '') {
      throw new EvaluationFailure('PARSE_ERROR', 'segment reference must be a non-empty string')
    }
    return
  }
  if (condition.operator === 'exists' || condition.operator === 'not_exists') {
    if ((condition.attribute ?? '').trim() === '') {
      throw new EvaluationFailure('PARSE_ERROR', 'condition attribute is required')
    }
    return
  }
  if ((condition.attribute ?? '').trim() === '') {
    throw new EvaluationFailure('PARSE_ERROR', 'condition attribute is required')
  }
  if (!Object.prototype.hasOwnProperty.call(condition, 'value')) {
    throw new EvaluationFailure('PARSE_ERROR', 'condition value is required')
  }

  switch (condition.operator) {
    case 'equals':
    case 'not_equals':
    case 'contains':
    case 'not_contains':
    case 'starts_with':
    case 'ends_with':
    case 'greater_than':
    case 'greater_than_or_equal':
    case 'less_than':
    case 'less_than_or_equal':
      return
    case 'in':
    case 'not_in':
      if (!Array.isArray(condition.value)) {
        throw new EvaluationFailure('PARSE_ERROR', `${condition.operator} condition value must be an array`)
      }
      return
    case 'matches_regex':
      if (typeof condition.value !== 'string') {
        throw new EvaluationFailure('PARSE_ERROR', 'regex condition value must be a string')
      }
      try {
        RE2JS.compile(condition.value)
      } catch (error) {
        throw new EvaluationFailure('PARSE_ERROR', error instanceof Error ? error.message : 'invalid regular expression')
      }
      return
    case 'semver_greater_than':
    case 'semver_greater_than_or_equal':
    case 'semver_less_than':
    case 'semver_less_than_or_equal':
      if (typeof condition.value !== 'string' || compareSemver(condition.value, condition.value) === undefined) {
        throw new EvaluationFailure('PARSE_ERROR', 'semantic-version condition value must be a valid semantic version')
      }
      return
    default:
      throw new EvaluationFailure('PARSE_ERROR', `unsupported operator ${JSON.stringify(condition.operator)}`)
  }
}

function validateOutcome(outcome: Outcome, allowed: Set<string>, required: boolean): void {
  const hasVariant = (outcome.variant ?? '').trim() !== ''
  const rollout = outcome.rollout ?? []
  const hasRollout = rollout.length > 0
  if (hasVariant && hasRollout) {
    throw new EvaluationFailure('PARSE_ERROR', 'outcome cannot contain both a variant and a rollout')
  }
  if (!hasVariant && !hasRollout) {
    if (required) {
      throw new EvaluationFailure('PARSE_ERROR', 'outcome must contain a variant or rollout')
    }
    return
  }
  if (hasVariant) {
    if (!allowed.has(outcome.variant as string)) {
      throw new EvaluationFailure('PARSE_ERROR', `unknown variant ${JSON.stringify(outcome.variant)}`)
    }
    return
  }

  let total = 0
  for (const allocation of rollout) {
    if (!allowed.has(allocation.variant)) {
      throw new EvaluationFailure('PARSE_ERROR', `unknown rollout variant ${JSON.stringify(allocation.variant)}`)
    }
    if (!Number.isInteger(allocation.weight) || allocation.weight <= 0) {
      throw new EvaluationFailure('PARSE_ERROR', 'rollout weights must be positive integers')
    }
    total += allocation.weight
  }
  if (total !== BUCKET_SCALE) {
    throw new EvaluationFailure('PARSE_ERROR', `rollout weights must total ${BUCKET_SCALE}`)
  }
}

function validateMatchMode(mode: MatchMode): void {
  if (mode !== 'all' && mode !== 'any') {
    throw new EvaluationFailure('PARSE_ERROR', 'match mode must be "all" or "any"')
  }
}

function validateValueKind(kind: ConfigurationFlag['kind'], value: unknown): void {
  if (kind === 'boolean' && typeof value !== 'boolean') {
    throw new EvaluationFailure('PARSE_ERROR', 'value must be a boolean')
  }
  if (kind === 'string' && typeof value !== 'string') {
    throw new EvaluationFailure('PARSE_ERROR', 'value must be a string')
  }
  if (kind === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw new EvaluationFailure('PARSE_ERROR', 'value must be a number')
  }
}
