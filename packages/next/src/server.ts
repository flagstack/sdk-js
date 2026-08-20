import { cache } from 'react'
import {
  NodeSwitchOnYourCodeClient,
  createNodeClient,
  type NodeSwitchOnYourCodeClientOptions,
} from '@switchonyourcode/node'

export interface NextSwitchOnYourCode {
  getClient(): Promise<NodeSwitchOnYourCodeClient>
  preload(): void
}

export function createNextSwitchOnYourCode(options: NodeSwitchOnYourCodeClientOptions): NextSwitchOnYourCode {
  const getClient = cache(async () => createNodeClient({ ...options, autoPoll: false }))

  return {
    getClient,
    preload() {
      void getClient()
    },
  }
}

export {
  NodeSwitchOnYourCodeClient,
  createNodeClient,
}
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
  NodeSwitchOnYourCodeClientOptions,
} from '@switchonyourcode/node'
