import { createMiddleware } from '@tanstack/react-start'
import { isNotFound, isRedirect } from '@tanstack/react-router'
import { UserError, isUserError } from './user-error'

function withoutStack<T extends Error>(error: T): T {
  delete error.stack
  return error
}

/**
 * Runs around every server function. A UserError reaches the browser with its
 * message only; any other error is logged here and reaches the browser as a
 * bare "Internal error", so Drive, D1 or configuration details and stack
 * traces never leave the Worker.
 */
export const userErrorMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    if (error instanceof Response || isRedirect(error) || isNotFound(error)) {
      throw error
    }
    if (isUserError(error)) throw withoutStack(new UserError(error.message))
    console.error(error)
    throw withoutStack(new Error('Internal error'))
  }
})
