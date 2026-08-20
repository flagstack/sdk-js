import { cache } from 'react'
import {
  NodeFlagStackClient,
  createNodeClient,
  type NodeFlagStackClientOptions,
} from '@flagstack/node'

export interface NextFlagStack {
  getClient(): Promise<NodeFlagStackClient>
  preload(): void
}

export function createNextFlagStack(options: NodeFlagStackClientOptions): NextFlagStack {
  const getClient = cache(async () => createNodeClient({ ...options, autoPoll: false }))

  return {
    getClient,
    preload() {
      void getClient()
    },
  }
}

export {
  NodeFlagStackClient,
  createNodeClient,
} from '@flagstack/node'
export type {
  Configuration,
  EvaluationContext,
  EvaluationDetails,
  EvaluationErrorCode,
  EvaluationReason,
  FlagKind,
  NodeFlagStackClientOptions,
} from '@flagstack/node'
