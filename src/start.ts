import { createStart } from '@tanstack/react-start'
import { userErrorMiddleware } from '@/lib/user-error-middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [userErrorMiddleware],
}))
