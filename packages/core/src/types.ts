export const SCHEMA_VERSION = 1 as const
export const BUCKET_SCALE = 100_000

export type FlagKind = 'boolean' | 'string' | 'number' | 'json'
export type MatchMode = 'all' | 'any'
export type Operator =
  | 'equals'
  | 'not_equals'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'greater_than_or_equal'
  | 'less_than'
  | 'less_than_or_equal'
  | 'exists'
  | 'not_exists'
  | 'matches_regex'
  | 'semver_greater_than'
  | 'semver_greater_than_or_equal'
  | 'semver_less_than'
  | 'semver_less_than_or_equal'
  | 'in_segment'
  | 'not_in_segment'

export type EvaluationReason =
  | 'STATIC'
  | 'DEFAULT'
  | 'TARGETING_MATCH'
  | 'SPLIT'
  | 'DISABLED'
  | 'ERROR'

export type EvaluationErrorCode =
  | 'PARSE_ERROR'
  | 'TARGETING_KEY_MISSING'
  | 'INVALID_CONTEXT'
  | 'PROVIDER_NOT_READY'
  | 'FLAG_NOT_FOUND'
  | 'TYPE_MISMATCH'

export interface EvaluationContext {
  targetingKey?: string
  [attribute: string]: unknown
}

export interface Variant {
  key: string
  value: unknown
}

export interface Condition {
  attribute?: string
  operator: Operator
  value?: unknown
}

export interface Allocation {
  variant: string
  weight: number
}

export interface Outcome {
  variant?: string
  rollout?: Allocation[]
  bucket_by?: string
}

export interface Rule {
  id: string
  name?: string
  match: MatchMode
  conditions: Condition[]
  outcome: Outcome
}

export interface Policy {
  rules?: Rule[]
  fallthrough?: Outcome
}

export interface Segment {
  key: string
  name: string
  match: MatchMode
  conditions: Condition[]
}

export interface ConfigurationEnvironment {
  id: string
  key: string
}

export interface ConfigurationFlag {
  id: string
  key: string
  kind: FlagKind
  default_value: unknown
  enabled: boolean
  variants: Variant[]
  policy: Policy
  revision: number
}

export interface Configuration {
  schema_version: typeof SCHEMA_VERSION
  environment: ConfigurationEnvironment
  flags: ConfigurationFlag[]
  segments: Segment[]
}

export interface EvaluationDetails<T = unknown> {
  value: T
  variant: string
  reason: EvaluationReason
  ruleId?: string
  errorCode?: EvaluationErrorCode
  errorMessage?: string
}
