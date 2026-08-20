'use client'

export {
  BrowserFlagStackClient,
  FlagStackProvider,
  createBrowserClient,
  useBooleanFlag,
  useBooleanFlagDetails,
  useFlagStackClient,
  useFlagStackConfiguration,
  useFlagStackReady,
  useJSONFlag,
  useJSONFlagDetails,
  useNumberFlag,
  useNumberFlagDetails,
  useStringFlag,
  useStringFlagDetails,
} from '@flagstack/react'
export type {
  BrowserFlagStackClientOptions,
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
  FlagStackProviderProps,
} from '@flagstack/react'
