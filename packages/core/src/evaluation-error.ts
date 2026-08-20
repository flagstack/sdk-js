import type { EvaluationErrorCode } from './types.js'

export class EvaluationFailure extends Error {
  readonly code: EvaluationErrorCode

  constructor(code: EvaluationErrorCode, message: string) {
    super(message)
    this.name = 'EvaluationFailure'
    this.code = code
  }
}
