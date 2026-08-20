import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  type BrowserSwitchOnYourCodeClient,
  type Configuration,
  type EvaluationContext,
  type EvaluationDetails,
} from '@switchonyourcode/browser'

const SwitchOnYourCodeContext = createContext<BrowserSwitchOnYourCodeClient | undefined>(undefined)

export interface SwitchOnYourCodeProviderProps {
  client: BrowserSwitchOnYourCodeClient
  children?: ReactNode
}

export function SwitchOnYourCodeProvider({ client, children }: SwitchOnYourCodeProviderProps) {
  return <SwitchOnYourCodeContext.Provider value={client}>{children}</SwitchOnYourCodeContext.Provider>
}

export function useSwitchOnYourCodeClient(): BrowserSwitchOnYourCodeClient {
  const client = useContext(SwitchOnYourCodeContext)
  if (!client) {
    throw new Error('SwitchOnYourCode hooks must be used inside a SwitchOnYourCodeProvider.')
  }
  return client
}

export function useSwitchOnYourCodeConfiguration(): Configuration | undefined {
  const client = useSwitchOnYourCodeClient()
  const subscribe = useCallback((listener: () => void) => client.subscribe(listener), [client])
  const getSnapshot = useCallback(() => client.configuration, [client])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function useSwitchOnYourCodeReady(): boolean {
  return useSwitchOnYourCodeConfiguration() !== undefined
}

function useReactiveClient(): BrowserSwitchOnYourCodeClient {
  const client = useSwitchOnYourCodeClient()
  useSwitchOnYourCodeConfiguration()
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
  BrowserSwitchOnYourCodeClient,
  createBrowserClient,
} from '@switchonyourcode/browser'
export type {
  BrowserSwitchOnYourCodeClientOptions,
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
} from '@switchonyourcode/browser'
