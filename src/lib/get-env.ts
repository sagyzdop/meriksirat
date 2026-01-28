import { createServerFn } from '@tanstack/react-start'

export const getEnvironmentFn = createServerFn({ method: 'GET' })
    .handler(async () => {
        const nodeEnv = process.env.NODE_ENV

        const isDevelopment = nodeEnv === 'development'

        return {            isDevelopment        }
    })