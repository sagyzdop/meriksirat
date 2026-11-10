/**
 * An error whose message is written for the person using the app. Only these
 * messages are shown in the UI; every other error shows the caller's fallback.
 * The name survives the server function boundary, so the check works on both
 * sides.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export function isUserError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'UserError'
}

/** The message a person may see for `error`, or `fallback`. */
export function userMessage(error: unknown, fallback: string): string {
  return isUserError(error) ? error.message : fallback
}
