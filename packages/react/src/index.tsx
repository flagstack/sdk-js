import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  type BrowserFlagStackClient,
  type Configuration,
  type EvaluationContext,
  type EvaluationDetails,
} from '@flagstack/browser'

const FlagStackContext = createContext<BrowserFlagStackClient | undefined>(undefined)

export interface FlagStackProviderProps {
  client: BrowserFlagStackClient
  children?: ReactNode
}

export function FlagStackProvider({ client, children }: FlagStackProviderProps) {
  return <FlagStackContext.Provider value={client}>{children}</FlagStackContext.Provider>
}

export function useFlagStackClient(): BrowserFlagStackClient {
  const client = useContext(FlagStackContext)
  if (!client) {
    throw new Error('FlagStack hooks must be used inside a FlagStackProvider.')
  }
  return client
}

export function useFlagStackConfiguration(): Configuration | undefined {
  const client = useFlagStackClient()
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client])
  const getSnapshot = useCallback(() => client.configuration, [client])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useFlagStackReady(): boolean {
  return useFlagStackConfiguration() !== undefined
}

function useReactiveClient(): BrowserFlagStackClient {
  const client = useFlagStackClient()
  useFlagStackConfiguration()
  return client
}

export function useBooleanFlag(key: string, fallback: boolean, context: EvaluationContext = {}): boolean {
  return useBooleanFlagDetails(key, fallback, context).value
}

export function useBooleanFlagDetails(
  key: string,
  fallback: boolean,
  context: EvaluationContext = {},
): EvaluationDetails<boolean> {
  return useReactiveClient().getBooleanDetails(key, fallback, context)
}

export function useStringFlag(key: string, fallback: string, context: EvaluationContext = {}): string {
  return useStringFlagDetails(key, fallback, context).value
}

export function useStringFlagDetails(
  key: string,
  fallback: string,
  context: EvaluationContext = {},
): EvaluationDetails<string> {
  return useReactiveClient().getStringDetails(key, fallback, context)
}

export function useNumberFlag(key: string, fallback: number, context: EvaluationContext = {}): number {
  return useNumberFlagDetails(key, fallback, context).value
}

export function useNumberFlagDetails(
  key: string,
  fallback: number,
  context: EvaluationContext = {},
): EvaluationDetails<number> {
  return useReactiveClient().getNumberDetails(key, fallback, context)
}

export function useJSONFlag<T>(key: string, fallback: T, context: EvaluationContext = {}): T {
  return useJSONFlagDetails(key, fallback, context).value
}

export function useJSONFlagDetails<T>(
  key: string,
  fallback: T,
  context: EvaluationContext = {},
): EvaluationDetails<T> {
  return useReactiveClient().getJSONDetails(key, fallback, context)
}

export {
  BrowserFlagStackClient,
  createBrowserClient,
} from '@flagstack/browser'
export type {
  BrowserFlagStackClientOptions,
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@flagstack/browser'
