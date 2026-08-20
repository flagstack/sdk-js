export { bucket } from './bucket.js'
export { evaluateFlag } from './evaluator.js'
export { validateEvaluationConfiguration } from './validation.js'
export {
  SwitchOnYourCodeAuthenticationError,
  SwitchOnYourCodeClient,
  SwitchOnYourCodeConfigurationError,
  SwitchOnYourCodeError,
  SwitchOnYourCodeHTTPError,
  parseConfiguration,
} from './config-client.js'
export type { SwitchOnYourCodeClientOptions, RefreshResult } from './config-client.js'
export {
  BUCKET_SCALE,
  SCHEMA_VERSION,
} from './types.js'
export type {
  Allocation,
  Condition,
  Configuration,
  ConfigurationEnvironment,
  ConfigurationFlag,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
  MatchMode,
  Operator,
  Outcome,
  Policy,
  Rule,
  Segment,
  Variant,
} from './types.js'
